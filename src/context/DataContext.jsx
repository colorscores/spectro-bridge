import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';

export const DataContext = createContext({
  colors: [],
  substrates: [],
  partners: [],
  loading: true,
  error: null,
  refetch: () => {},
});

export const DataProvider = ({ children }) => {
  const { profile, loading: profileLoading } = useProfile();
  const [colors, setColors] = useState([]);
  const [substrates, setSubstrates] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (organizationId) => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [substratesRes, partnersRes] = await Promise.all([
        supabase.from('substrates').select('*').eq('organization_id', organizationId),
        supabase.rpc('get_partners_for_org', { p_org_id: organizationId }),
      ]);

      if (substratesRes.error) throw new Error(`Failed to fetch substrates: ${substratesRes.error.message}`);
      if (partnersRes.error) throw new Error(`Failed to fetch partners: ${partnersRes.error.message}`);
      
      setSubstrates(substratesRes.data || []);
      setPartners(partnersRes.data || []);

    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message);
      setSubstrates([]);
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profileLoading && profile) {
      fetchData(profile.organization_id);
    } else if (!profileLoading && !profile) {
      setLoading(false);
      setSubstrates([]);
      setPartners([]);
    }
  }, [profile, profileLoading, fetchData]);

  const refetch = useCallback(() => {
    if (profile) {
      fetchData(profile.organization_id);
    }
  }, [profile, fetchData]);

  const value = useMemo(() => ({
    colors,
    substrates,
    partners,
    loading: profileLoading || loading,
    error,
    refetch,
  }), [colors, substrates, partners, profileLoading, loading, error, refetch]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};