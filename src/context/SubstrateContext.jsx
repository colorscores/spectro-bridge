import React, { createContext, useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile, ProfileContext } from '@/context/ProfileContext';
import { generateSubstrateConditionName } from '@/lib/substrateConditionNaming';

export const SubstrateContext = createContext({
  substrates: [],
  loading: true,
  error: null,
  refetch: () => {},
});

export const SubstrateProvider = ({ children }) => {
  // Check if ProfileContext is available
  const profileContext = React.useContext(ProfileContext);
  if (!profileContext) {
    // If ProfileContext is not available, provide a fallback context
    const fallbackValue = useMemo(() => ({
      substrates: [],
      loading: true,
      error: null,
      refetch: () => {},
    }), []);
    
    return (
      <SubstrateContext.Provider value={fallbackValue}>
        {children}
      </SubstrateContext.Provider>
    );
  }
  
  const { profile, loading: profileLoading } = profileContext;
  const [substrates, setSubstrates] = useState([]);
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
      const { data, error } = await supabase
        .from('substrates')
        .select(`
          id, name, updated_at, printing_side, contrast, ink_adhesion,
          substrate_conditions (
            id, name, pack_type, updated_at, color_hex, lab, ch, substrate_id,
            construction_details, version, use_white_ink, description
          )
        `)
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      const formattedData = (data || []).map(s => ({
        id: s.id,
        name: s.name,
        printing_side: s.printing_side,
        contrast: s.contrast,
        ink_adhesion: s.ink_adhesion,
        updated_at: s.updated_at,
        conditions: (s.substrate_conditions || []).map(condition => ({
          id: condition.id,
          name: condition.name,
          displayName: shouldUseAutoName(condition, s) ? generateAutoName(condition, s) : condition.name,
          pack_type: condition.pack_type,
          updated_at: condition.updated_at,
          color_hex: condition.color_hex,
          lab: condition.lab,
          ch: condition.ch,
          substrate_id: condition.substrate_id,
          construction_details: condition.construction_details,
          version: condition.version,
          use_white_ink: condition.use_white_ink,
          description: condition.description,
        }))
      }));

      setSubstrates(formattedData);
    } catch (err) {
      setError(err);
      setSubstrates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper function to determine if we should use auto-generated name
  const shouldUseAutoName = (condition, substrate) => {
    // If no construction details, probably needs auto-naming
    if (!condition.construction_details) return true;
    
    // If name doesn't include substrate name, probably needs auto-naming
    if (!condition.name.includes(substrate.name)) return true;
    
    // If has version but name doesn't include it, needs auto-naming
    if (condition.version && !condition.name.includes(condition.version)) return true;
    
    return false;
  };

  // Helper function to generate auto name for display
  const generateAutoName = (condition, substrate) => {
    const details = condition.construction_details || {};
    
    // Validate required parameters to prevent errors
    if (!substrate?.printing_side) {
      return condition.name || 'Condition'; // Fallback to existing name
    }
    
    try {
      return generateSubstrateConditionName({
        substrateColor: null, // Color removed from substrates table
        printSide: substrate.printing_side, // Fixed parameter name
        useWhiteInk: details.useWhiteInk,
        primerEnabled: details.primerEnabled,
        basecoatEnabled: details.basecoatEnabled,
        coatingEnabled: details.coatingEnabled,
        laminateEnabled: details.laminateEnabled,
        laminateSurfaceQuality: details.laminateSurfaceQuality,
        varnishEnabled: details.varnishEnabled,
        varnishSurfaceQuality: details.varnishSurfaceQuality,
        version: condition.version
      });
    } catch (error) {
      return condition.name || 'Condition'; // Fallback to existing name
    }
  };

  const refetch = useCallback(() => {
    if (profile) {
      fetchData(profile.organization_id);
    }
  }, [profile, fetchData]);

  useEffect(() => {
    if (!profileLoading && profile?.organization_id) {
      fetchData(profile.organization_id);
    } else if (!profileLoading && !profile) {
      setLoading(false);
      setSubstrates([]);
    } else if (!profileLoading && profile && !profile.organization_id) {
      setLoading(false);
      setError('User profile missing organization information');
      setSubstrates([]);
    }
  }, [profile, profileLoading, fetchData]);

  useEffect(() => {
    if (!profile) return;

    const channel = supabase.channel('public:substrates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'substrates' }, () => {
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'substrate_conditions' }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, refetch]);

  // One-time migration: remove substrate name prefixes from condition names
  useEffect(() => {
    if (!profile) return;
    const key = `renameNoSubstratePrefix_${profile.organization_id}`;
    if (localStorage.getItem(key) === 'done') return;

    (async () => {
      try {
        const { data: substrates, error: subsError } = await supabase
          .from('substrates')
          .select('id, name')
          .eq('organization_id', profile.organization_id);
        if (subsError || !substrates?.length) return;

        const substrateMap = new Map(substrates.map(s => [s.id, (s.name || '').trim()]));

        const { data: conditions, error: condError } = await supabase
          .from('substrate_conditions')
          .select('id, name, substrate_id')
          .in('substrate_id', substrates.map(s => s.id));
        if (condError) return;

        const updates = [];
        for (const c of conditions || []) {
          const sname = substrateMap.get(c.substrate_id) || '';
          if (!sname || !c?.name) continue;
          const prefix = `${sname} - `;
          if (c.name.startsWith(prefix)) {
            const newName = c.name.slice(prefix.length).trim();
            if (newName && newName !== c.name) updates.push({ id: c.id, name: newName });
          }
        }

        const chunkSize = 20;
        for (let i = 0; i < updates.length; i += chunkSize) {
          const slice = updates.slice(i, i + chunkSize);
          await Promise.all(
            slice.map(u => supabase.from('substrate_conditions').update({ name: u.name }).eq('id', u.id))
          );
        }

        localStorage.setItem(key, 'done');
        if (updates.length > 0) refetch();
      } catch (e) {
        console.warn('Auto-rename substrate condition names failed:', e);
      }
    })();
  }, [profile, refetch]);

  // Optimistic update methods
  const optimisticAddSubstrate = useCallback((newSubstrate) => {
    setSubstrates(prev => [{ ...newSubstrate, conditions: [] }, ...prev]);
  }, []);

  const optimisticUpdateSubstrate = useCallback((updatedSubstrate) => {
    setSubstrates(prev => 
      prev.map(substrate => 
        substrate.id === updatedSubstrate.id 
          ? { ...substrate, ...updatedSubstrate }
          : substrate
      )
    );
  }, []);

  const optimisticAddSubstrateCondition = useCallback((substrateId, newCondition) => {
    setSubstrates(prev => 
      prev.map(substrate => 
        substrate.id === substrateId
          ? { 
              ...substrate, 
              conditions: [...(substrate.conditions || []), newCondition]
            }
          : substrate
      )
    );
  }, []);

  const optimisticUpdateSubstrateCondition = useCallback((substrateId, conditionId, updates) => {
    setSubstrates(prev => 
      prev.map(substrate => 
        substrate.id === substrateId
          ? {
              ...substrate,
              conditions: (substrate.conditions || []).map(condition =>
                condition.id === conditionId
                  ? { ...condition, ...updates }
                  : condition
              )
            }
          : substrate
      )
    );
  }, []);

  const value = useMemo(() => ({
    substrates,
    loading: profileLoading || loading,
    error,
    refetch,
    optimisticAddSubstrate,
    optimisticUpdateSubstrate,
    optimisticAddSubstrateCondition,
    optimisticUpdateSubstrateCondition,
  }), [substrates, profileLoading, loading, error, refetch, optimisticAddSubstrate, optimisticUpdateSubstrate, optimisticAddSubstrateCondition, optimisticUpdateSubstrateCondition]);

  return (
    <SubstrateContext.Provider value={value}>
      {children}
    </SubstrateContext.Provider>
  );
};

export const useSubstratesData = () => {
  const context = useContext(SubstrateContext);
  if (context === undefined) {
    return { substrates: [], loading: false, error: null, refetch: async () => {} };
  }
  return context;
};