import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/context/ProfileContext';

/**
 * Custom hook to get organization details (ID and name) for the current user
 * This is a lightweight hook specifically for getting organization information
 * without the heavy data loading of useOrganizationLogic
 */
export const useOrganizationProfile = () => {
  const { profile } = useProfile();
  const [organizationName, setOrganizationName] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrganizationName = async () => {
      if (!profile?.organization_id) {
        setOrganizationName(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: orgError } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', profile.organization_id)
          .single();

        if (orgError) {
          setError(orgError);
          setOrganizationName(null);
        } else {
          setOrganizationName(data?.name || null);
        }
      } catch (err) {
        setError(err);
        setOrganizationName(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizationName();
  }, [profile?.organization_id]);

  return {
    organizationId: profile?.organization_id || null,
    organizationName,
    loading,
    error,
  };
};