import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';

const TestchartsContext = createContext();

export const TestchartsProvider = ({ children }) => {
  // Add safety check to prevent crashes during context initialization
  let profile, profileLoading;
  try {
    const profileData = useProfile();
    profile = profileData?.profile;
    profileLoading = profileData?.loading;
  } catch (error) {
    console.error('TestchartsProvider: Failed to access ProfileContext:', error);
    // Provide fallback values when ProfileProvider is not available
    profile = null;
    profileLoading = true;
  }
  
  const [testcharts, setTestcharts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [lastOrganizationId, setLastOrganizationId] = useState(null);

  const fetchData = useCallback(async (organizationId) => {
    // Prevent duplicate fetches for the same organization
    if (lastOrganizationId === organizationId && lastFetchTime && Date.now() - lastFetchTime < 5000) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('test_charts')
        .select(`
          *,
          patch_set:patch_sets(id, name)
        `)
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      setTestcharts(data || []);
      setLastFetchTime(Date.now());
      setLastOrganizationId(organizationId);
    } catch (err) {
      console.error("Error fetching test charts:", err);
      setError(err);
      setTestcharts([]);
    } finally {
      setLoading(false);
    }
  }, [lastOrganizationId, lastFetchTime]);

  const refetch = useCallback(() => {
    if (profile?.organization_id) {
      // Force refetch by clearing the last fetch time
      setLastFetchTime(null);
      fetchData(profile.organization_id);
    }
  }, [profile?.organization_id, fetchData]);

  // Memoized effect to prevent unnecessary re-runs
  const shouldFetch = useMemo(() => {
    return !profileLoading && profile?.organization_id && 
           (lastOrganizationId !== profile.organization_id || !lastFetchTime);
  }, [profileLoading, profile?.organization_id, lastOrganizationId, lastFetchTime]);

  useEffect(() => {
    if (shouldFetch) {
      fetchData(profile.organization_id);
    } else if (!profileLoading && !profile) {
      setLoading(false);
      setTestcharts([]);
      setLastFetchTime(null);
      setLastOrganizationId(null);
    }
  }, [shouldFetch, profile, profileLoading, fetchData]);

  // Real-time subscription
  useEffect(() => {
    if (!profile?.organization_id) return;

    const channel = supabase.channel('public:test_charts');
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'test_charts' }, refetch)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id, refetch]);

  const value = useMemo(() => ({
    testcharts,
    loading: profileLoading || loading,
    error,
    refetch,
  }), [testcharts, profileLoading, loading, error, refetch]);

  return (
    <TestchartsContext.Provider value={value}>
      {children}
    </TestchartsContext.Provider>
  );
};

export const useTestchartsData = () => {
  const context = useContext(TestchartsContext);
  if (context === undefined) {
    console.error('useTestchartsData must be used within a TestchartsProvider');
    return { testcharts: [], loading: false, error: null, refetch: async () => {} };
  }
  return context;
};