import { useState, useEffect, useContext } from 'react';
import { ProfileContext } from '@/context/ProfileContext';
import { supabase } from '@/integrations/supabase/client';

export const useLicensing = (organizationId = null) => {
  // Always call hooks at the top level - never conditionally or in try-catch
  const [partners, setPartners] = useState([]);
  
  // useContext must be called unconditionally - never in try-catch
  const context = useContext(ProfileContext);
  const profile = context?.profile || null;
  
  // Use provided organizationId or fall back to user's organization
  const targetOrgId = organizationId || profile?.organization_id;
  
  // Defensive guard: If ProfileContext isn't ready yet, return safe defaults
  // This prevents crashes if useLicensing is accidentally called too early
  const isContextReady = context !== null && context !== undefined;
  
  const [licenses, setLicenses] = useState({
    libraries: { plan: 'Free', isEditing: false },
    printerKiosk: { plan: 'No', isEditing: false },
    matchPack: { plan: 'No', isEditing: false },
    createPack: { plan: 'No', isEditing: false }
  });
  
  // Load partners when target organization changes
  useEffect(() => {
    let cancelled = false;
    const loadPartners = async () => {
      if (!targetOrgId || !isContextReady) return;
      try {
        const { data, error } = await supabase.rpc('get_partners_for_org', { p_org_id: targetOrgId });
        if (error) throw error;
        if (!cancelled) setPartners(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setPartners([]);
      }
    };
    loadPartners();
    return () => { cancelled = true; };
  }, [targetOrgId]);

  // Load licenses from database when target organization changes
  useEffect(() => {
    const loadLicenses = async () => {
      if (!targetOrgId || !isContextReady) return;

      try {
        const { data: orgData, error } = await supabase
          .from('organizations')
          .select('color_libraries_license, printer_kiosk_license, match_pack_license, create_pack_license, type')
          .eq('id', targetOrgId)
          .single();

        if (error) {
          console.error('Error loading licenses:', error);
          return;
        }

        if (orgData) {
          setLicenses({
            libraries: { 
              plan: orgData.color_libraries_license || 'Free', 
              isEditing: false 
            },
            printerKiosk: { 
              plan: orgData.printer_kiosk_license || 'No', 
              isEditing: false 
            },
            matchPack: { 
              plan: orgData.match_pack_license || '1', 
              isEditing: false 
            },
            createPack: { 
              plan: orgData.create_pack_license || 'No', 
              isEditing: false 
            }
          });
        }
      } catch (error) {
        console.error('Exception loading licenses:', error);
      }
    };

    loadLicenses();
  }, [targetOrgId]);

  // Update license in database
  const updateLicense = async (type, newPlan) => {
    if (!targetOrgId || !isContextReady) return;

    const columnMap = {
      libraries: 'color_libraries_license',
      printerKiosk: 'printer_kiosk_license',
      matchPack: 'match_pack_license',
      createPack: 'create_pack_license'
    };

    try {
      const { error } = await supabase
        .from('organizations')
        .update({ [columnMap[type]]: newPlan })
        .eq('id', targetOrgId);

      if (error) {
        console.error('Error updating license:', error);
        return false;
      }

      // Update local state
      setLicenses(prev => ({
        ...prev,
        [type]: { ...prev[type], plan: newPlan, isEditing: false }
      }));

      return true;
    } catch (error) {
      console.error('Exception updating license:', error);
      return false;
    }
  };

  // Calculate usage for different license types
  const calculateUsage = (type) => {
    switch (type) {
      case 'matchPack':
        // Only count for Brand Owner organizations
        const isBrandOwner = profile?.organization?.type?.includes('Brand Owner');
        if (!isBrandOwner) return '-';
        
        return partners?.filter(partner => 
          partner.collect_color_matches === true &&
          ['connected', 'accepted'].includes(partner.status) &&
          partner.partner_roles?.some(role => ['Print Supplier', 'Ink Supplier'].includes(role))
        ).length || 0;
      case 'printerKiosk':
        return partners?.filter(partner => 
          ['connected', 'accepted'].includes(partner.status) &&
          partner.partner_roles?.some(role => role === 'Ink Supplier')
        ).length || 0;
      case 'createPack':
        return 0; // Placeholder for future logic
      default:
        return '-';
    }
  };

  // Calculate available licenses
  const getAvailableLicenses = (type) => {
    const currentPlan = licenses[type]?.plan;
    
    if (type === 'printerKiosk') {
      if (currentPlan === 'No') return 0;
      if (currentPlan === 'Lite') return 1;
      if (['Basic', 'Pro'].includes(currentPlan)) return 999; // Unlimited
      return 0;
    }
    
    if (currentPlan === 'No' || !currentPlan || isNaN(currentPlan)) return 0;
    
    const total = parseInt(currentPlan);
    const used = calculateUsage(type);
    return Math.max(0, total - used);
  };

  const getLicenseInfo = (type) => ({
    total: licenses[type]?.plan === 'No' ? 0 : parseInt(licenses[type]?.plan) || 0,
    used: calculateUsage(type),
    available: getAvailableLicenses(type)
  });

  return {
    licenses,
    setLicenses,
    updateLicense,
    calculateUsage,
    getAvailableLicenses,
    getLicenseInfo
  };
};