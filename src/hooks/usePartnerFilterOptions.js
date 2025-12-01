import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';

export const usePartnerFilterOptions = (enabled = true) => {
  const { profile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [partners, setPartners] = useState([]);
  const [error, setError] = useState(null);

  // Fetch partner organizations directly using get_partners_for_org
  useEffect(() => {
    const fetchPartners = async () => {
      if (!profile?.organization_id || !enabled) {
        setPartners([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // console.log('🤝 usePartnerFilterOptions - Fetching partners for org:', profile.organization_id);
        
        const { data, error: rpcError } = await supabase.rpc('get_partners_for_org', {
          p_org_id: profile.organization_id
        });

        // console.log('🤝 usePartnerFilterOptions - RPC response:', { data, error: rpcError });

        if (rpcError) throw rpcError;

        setPartners(data || []);
      } catch (err) {
        // console.error('🤝 usePartnerFilterOptions - Error:', err);
        setError(err.message);
        setPartners([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPartners();
  }, [profile?.organization_id, enabled]);

  // Determine organization types
  const organizationTypes = useMemo(() => {
    const orgTypes = Array.isArray(profile?.organization?.type)
      ? profile.organization.type
      : (profile?.organization?.type ? [profile.organization.type] : []);
    const isBrandOrg = orgTypes.some(t => /brand owner/i.test(t));
    const isPartnerOrg = !isBrandOrg;
    return { isBrandOrg, isPartnerOrg };
  }, [profile?.organization?.type]);

  // Format partner organizations for dropdown
  const partnerOrgOptions = useMemo(() => {
    // console.log('🤝 usePartnerFilterOptions - Formatting partner options:', partners);
    
    return partners.map(partner => ({
      value: partner.partner_organization_id,
      label: partner.partner_name || `Partner ${partner.partner_organization_id}`,
      partner_org_id: partner.partner_organization_id,
      partner_name: partner.partner_name,
      partner_location: partner.partner_location,
      partner_id: partner.id
    }));
  }, [partners]);

  // Filter partners to only show brand organizations for the owner filter
  const brandOrgOptions = useMemo(() => {
    // console.log('🤝 usePartnerFilterOptions - Creating brand org options from partners:', partners);
    
    return partners
      .filter(partner => partner.partner_type?.includes('Brand Owner'))
      .map(partner => ({
        value: partner.partner_name || `Brand ${partner.partner_organization_id}`,
        label: partner.partner_name || `Brand ${partner.partner_organization_id}`,
        partner_org_id: partner.partner_organization_id,
        partner_name: partner.partner_name,
        partner_id: partner.id
      }));
  }, [partners]);

  // Get locations for a specific organization
  const getLocationsForOrg = useCallback((orgId) => {
    return partners
      .filter(partner => partner.partner_organization_id === orgId)
      .map(partner => ({
        value: partner.id,
        label: partner.partner_location || 'Main Location',
        partner_id: partner.id,
        partner_location: partner.partner_location,
        partner_org_id: partner.partner_organization_id
      }));
  }, [partners]);

  const refetch = useCallback(async () => {
    if (!profile?.organization_id) return;
    
    setLoading(true);
    try {
      const { data } = await supabase.rpc('get_partners_for_org', {
        p_org_id: profile.organization_id
      });
      setPartners(data || []);
    } catch (err) {
      console.error('Failed to refetch partners:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id]);

  return {
    loading,
    error,
    partnerOrgOptions,
    brandOrgOptions,
    getLocationsForOrg,
    refetch,
    ...organizationTypes
  };
};