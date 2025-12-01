
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/context/ProfileContext';
import { generateInkConditionName, shouldUseAutoNameForInkCondition } from '@/lib/inkConditionNaming';
import { debug } from '@/lib/debugUtils';
import { debounce } from '@/utils/debounce';

// Performance optimization: disable debug logging
const DEBUG_INKS = false;

const InkContext = createContext();

export const InkProvider = ({ children }) => {
  // Add safety check to prevent crashes during context initialization
  let profile, profileLoading;
  try {
    const profileData = useProfile();
    profile = profileData?.profile;
    profileLoading = profileData?.loading;
  } catch (error) {
    if (DEBUG_INKS) console.error('InkProvider: Failed to access ProfileContext:', error);
    // Provide fallback values when ProfileProvider is not available
    profile = null;
    profileLoading = true;
  }
  
  const [inkBooks, setInkBooks] = useState([]);
  const [allInks, setAllInks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [lastOrganizationId, setLastOrganizationId] = useState(null);
  
  // Cache for loaded condition details (conditionId -> full data)
  const [conditionDetailsCache, setConditionDetailsCache] = useState(new Map());
  
  // Ref to track pending refetch to prevent multiple simultaneous fetches
  const refetchPendingRef = useRef(false);

  const fetchData = useCallback(async (organizationId, forceRefresh = false) => {
    // Prevent duplicate fetches for the same organization unless forcing refresh
    if (!forceRefresh && lastOrganizationId === organizationId && lastFetchTime && Date.now() - lastFetchTime < 5000) {
      if (DEBUG_INKS) console.log('🚫 InkContext: Skipping duplicate fetch');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // OPTIMIZED: Single lightweight RPC call to get ink list (without heavy JSONB fields)
      if (DEBUG_INKS) console.log('🔄 InkContext: Fetching minimal ink data via RPC');
      
      const { data: completeData, error: rpcError } = await supabase
        .rpc('get_inks_list_minimal', { p_org_id: organizationId });

      if (rpcError) {
        if (DEBUG_INKS) console.error('❌ InkContext: Error fetching complete ink data:', rpcError);
        throw rpcError;
      }

      // Parse the response
      const booksData = completeData?.ink_books || [];
      const inksArray = completeData?.inks || [];
      const substrateConditions = completeData?.substrate_conditions || [];

      // Create substrate lookup maps
      const substrateConditionMap = new Map(
        substrateConditions.map(sc => [
          sc.id,
          { 
            name: sc.name, 
            substrateName: sc.substrate_name,
            substrateTypeName: sc.substrate_type,
            substrateMaterialName: sc.substrate_material,
            substratePrintingSide: sc.substrate_printing_side
          }
        ])
      );

      // Format inks with enriched conditions
      const formattedAllInks = inksArray
        // Exclude hidden inks
        .filter(ink => !ink.is_hidden)
        .map(ink => {
          const conditions = (ink.conditions || [])
            // Exclude hidden conditions
            .filter(condition => !condition.is_hidden)
            .map(condition => {
              const substrateConditionName = condition.substrate_condition 
                ? substrateConditionMap.get(condition.substrate_condition)?.name 
                : null;

              const displayName = shouldUseAutoNameForInkCondition(condition)
                ? generateInkConditionName({
                    substrateConditionName,
                    inkCurve: condition.ink_curve,
                    packType: condition.pack_type,
                    version: condition.version
                  })
                : condition.name;

              const substrateDetails = condition.substrate_id 
                ? substrateConditionMap.get(condition.substrate_id) 
                : null;

              return {
                ...condition,
                displayName: displayName || condition.name || 'Untitled Ink Condition',
                substrateConditionName,
                substrateTypeName: substrateDetails?.substrateTypeName || null,
                substrateMaterialName: substrateDetails?.substrateMaterialName || null,
                substratePrintingSide: substrateDetails?.substratePrintingSide || null
              };
            });

          return {
            ...ink,
            conditions
          };
        });

      // Create ink map for fast lookup
      const inkMap = new Map(formattedAllInks.map(ink => [ink.id, ink]));

      // Format books with associated inks
      const formattedBooksData = booksData.map(book => ({
        ...book,
        inks: (book.associations || [])
          .map(assoc => {
            const ink = inkMap.get(assoc.ink_id);
            return ink ? { ...ink, associationId: assoc.id } : null;
          })
          .filter(Boolean)
      }));

      setInkBooks(formattedBooksData);
      setAllInks(formattedAllInks);
      setLastFetchTime(Date.now());
      setLastOrganizationId(organizationId);
      
      if (DEBUG_INKS) console.log('✅ InkContext: Data loaded', { books: formattedBooksData.length, inks: formattedAllInks.length });
    } catch (err) {
      if (DEBUG_INKS) console.error("Error fetching ink data:", err);
      setError(err);
      setInkBooks([]);
      setAllInks([]);
    } finally {
      setLoading(false);
    }
  }, [lastOrganizationId, lastFetchTime]);

  const refetch = useCallback((forceRefresh = true) => {
    if (profile?.organization_id && !refetchPendingRef.current) {
      refetchPendingRef.current = true;
      // Force refetch by clearing the last fetch time
      setLastFetchTime(null);
      return fetchData(profile.organization_id, forceRefresh).finally(() => {
        refetchPendingRef.current = false;
      });
    }
    return Promise.resolve();
  }, [profile?.organization_id, fetchData]);

  const forceRefresh = useCallback(() => {
    setLastFetchTime(null);
    setLastOrganizationId(null);
    if (profile?.organization_id) {
      return fetchData(profile.organization_id, true);
    }
    return Promise.resolve();
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
      setInkBooks([]);
      setAllInks([]);
      setLastFetchTime(null);
      setLastOrganizationId(null);
    }
  }, [shouldFetch, profile, profileLoading, fetchData]);

  // Real-time subscriptions for live updates with debouncing
  useEffect(() => {
    if (!profile?.organization_id) return;

    if (DEBUG_INKS) console.log('🔌 InkContext: Setting up real-time subscriptions for organization:', profile.organization_id);
    
    // Create debounced refetch to prevent cascading updates (500ms delay)
    const debouncedRefetch = debounce(() => {
      debug.log('🔄 InkContext: Executing debounced refetch');
      refetch();
    }, 500);
    
    // Use a simpler, more reliable channel setup for cross-user updates
    const channel = supabase.channel(`inks-${profile.organization_id}`, {
      config: {
        broadcast: { self: true },
        presence: { key: `user-${profile.id || 'unknown'}` }
      }
    });
    
    const handleInkChange = (payload) => {
      debug.log('🔔 InkContext: Ink changed', payload.eventType);
      const changeOrgId = payload.new?.organization_id || payload.old?.organization_id;
      
      // Only process changes for our organization
      if (changeOrgId !== profile.organization_id) return;
      
      // For INSERT/UPDATE, try optimistic update if we have the data
      if (payload.eventType === 'INSERT' && payload.new) {
        optimisticAddInk(payload.new);
        debouncedRefetch(); // Still refetch to get complete data with conditions
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        optimisticUpdateInk(payload.new);
        debouncedRefetch(); // Still refetch to ensure consistency
      } else if (payload.eventType === 'DELETE' && payload.old) {
        optimisticDeleteInk(payload.old.id);
        debouncedRefetch(); // Refetch to update related data
      } else {
        debouncedRefetch();
      }
    };

    const handleInkBookChange = (payload) => {
      debug.log('🔔 InkContext: Ink book changed', payload.eventType);
      const changeOrgId = payload.new?.organization_id || payload.old?.organization_id;
      
      if (changeOrgId === profile.organization_id) {
        // Books changes need full refetch to update associations
        debouncedRefetch();
      }
    };

    const handleInkConditionChange = (payload) => {
      debug.log('🔔 InkContext: Ink condition changed', payload.eventType);
      
      // Conditions affect ink names and display, so we need refetch
      // But debounce to avoid multiple rapid updates
      debouncedRefetch();
    };

    const handleInkBookAssocChange = (payload) => {
      debug.log('🔔 InkContext: Ink book association changed', payload.eventType);
      const changeOrgId = payload.new?.organization_id || payload.old?.organization_id;
      
      if (changeOrgId === profile.organization_id) {
        // Association changes need full refetch
        debouncedRefetch();
      }
    };
    
    channel
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'inks'
      }, handleInkChange)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'ink_books'
      }, handleInkBookChange)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'ink_conditions'
      }, handleInkConditionChange)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'ink_book_associations'
      }, handleInkBookAssocChange)
      .subscribe((status, err) => {
        debug.log('📡 InkContext: Subscription status:', status);
        if (err) {
          console.error('❌ InkContext: Subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          debug.log('✅ InkContext: Subscribed to real-time updates');
        }
      });

    return () => {
      debug.log('🔌 InkContext: Cleaning up real-time subscriptions');
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id, profile?.id, refetch]);

  // Optimistic update methods for better UX
  const optimisticDeleteInk = useCallback((inkId) => {
    setAllInks(prev => prev.filter(ink => ink.id !== inkId));
  }, []);

  const optimisticAddInk = useCallback((newInk) => {
    setAllInks(prev => [...prev, newInk]);
  }, []);

  const optimisticAddInkCondition = useCallback((inkId, newCondition) => {
    setAllInks(prev => prev.map(ink => 
      ink.id === inkId 
        ? { ...ink, conditions: [...(ink.conditions || []), newCondition] }
        : ink
    ));
  }, []);

  const optimisticUpdateInk = useCallback((updatedInk) => {
    setAllInks(prev => prev.map(ink => 
      ink.id === updatedInk.id ? { ...ink, ...updatedInk } : ink
    ));
  }, []);

  const optimisticUpdateInkCondition = useCallback((inkId, conditionId, partialUpdates) => {
    setAllInks(prev => prev.map(ink => 
      ink.id === inkId 
        ? {
            ...ink,
            conditions: ink.conditions?.map(condition =>
              condition.id === conditionId 
                ? { ...condition, ...partialUpdates }
                : condition
            ) || []
          }
        : ink
    ));
  }, []);

  const optimisticDeleteInkCondition = useCallback((inkId, conditionId) => {
    setAllInks(prev => prev.map(ink => 
      ink.id === inkId 
        ? {
            ...ink,
            conditions: ink.conditions?.filter(condition => condition.id !== conditionId) || []
          }
        : ink
    ));
  }, []);

  // Lazy-load full condition details (including heavy JSONB fields like imported_tints)
  const loadConditionDetails = useCallback(async (conditionId) => {
    // Check cache first
    if (conditionDetailsCache.has(conditionId)) {
      if (DEBUG_INKS) console.log('✅ InkContext: Using cached condition details for', conditionId);
      return conditionDetailsCache.get(conditionId);
    }

    try {
      if (DEBUG_INKS) console.log('🔄 InkContext: Fetching detailed condition data for', conditionId);
      
      // Direct fetch to get all fields including imported_tints
      const { data: detailedCondition, error: detailError } = await supabase
        .from('ink_conditions')
        .select('*')
        .eq('id', conditionId)
        .single();

      if (detailError) {
        console.error('❌ InkContext: Error fetching condition details:', detailError);
        throw detailError;
      }

      if (!detailedCondition) {
        throw new Error('Condition not found');
      }

      // Update the condition in allInks with full details
      setAllInks(prev => prev.map(ink => ({
        ...ink,
        conditions: ink.conditions?.map(condition =>
          condition.id === conditionId 
            ? { ...condition, ...detailedCondition }
            : condition
        ) || []
      })));

      // Add to cache
      setConditionDetailsCache(prev => new Map(prev).set(conditionId, detailedCondition));

      if (DEBUG_INKS) console.log('✅ InkContext: Condition details loaded and cached', conditionId);
      return detailedCondition;
    } catch (err) {
      console.error('Error loading condition details:', err);
      throw err;
    }
  }, [conditionDetailsCache]);

  const value = useMemo(() => ({
    inkBooks,
    allInks,
    loading: profileLoading || loading,
    error,
    refetch,
    forceRefresh,
    loadConditionDetails,
    optimisticDeleteInk,
    optimisticAddInk,
    optimisticUpdateInk,
    optimisticUpdateInkCondition,
    optimisticDeleteInkCondition,
    optimisticAddInkCondition,
    // Add method to force refresh ink conditions specifically
    forceRefreshConditions: () => {
      if (DEBUG_INKS) console.log('🔄 InkContext: Force refreshing conditions');
      setLastFetchTime(null);
      setLastOrganizationId(null);
      // Clear condition details cache on refresh
      setConditionDetailsCache(new Map());
      if (profile?.organization_id) {
        fetchData(profile.organization_id, true);
      }
    }
  }), [inkBooks, allInks, profileLoading, loading, error, refetch, forceRefresh, loadConditionDetails, optimisticDeleteInk, optimisticAddInk, optimisticUpdateInk, optimisticUpdateInkCondition, optimisticDeleteInkCondition, optimisticAddInkCondition, profile?.organization_id, fetchData]);

  return (
    <InkContext.Provider value={value}>
      {children}
    </InkContext.Provider>
  );
};

export const useInksData = () => {
  const context = useContext(InkContext);
  if (context === undefined) {
    console.error('useInksData must be used within an InkProvider');
    return { inkBooks: [], allInks: [], loading: false, error: null, refetch: async () => {}, forceRefresh: async () => {} };
  }
  return context;
};
