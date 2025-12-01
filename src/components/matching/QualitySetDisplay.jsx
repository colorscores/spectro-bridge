import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';
import { Check } from 'lucide-react';
import { calculateQualityAssessment } from '@/lib/qualityAssessment';
import { useResolvedLabFromMatchMeasurement, useResolvedLabFromReference } from '@/hooks/useResolvedLab';
import { getSolidSpectralData } from '@/lib/colorUtils/spectralDataHelpers';
import { resolveActiveDataMode } from '@/lib/colorUtils/resolveActiveDataMode';
import { useSpectralCalculations } from '@/hooks/useSpectralCalculations';

// Helper to determine if a quality set has rules
const hasRules = (qs) => {
  if (!qs) return false;
  const rules = qs.quality_rules || qs.rules;
  return Array.isArray(rules) && rules.length > 0;
};

// Helper to check if measurement has complete Lab data
const hasCompleteLab = (measurement) => {
  if (!measurement) return false;
  
  // Check direct Lab columns
  const hasDirectLab = measurement.lab_l != null && measurement.lab_a != null && measurement.lab_b != null;
  if (hasDirectLab) return true;
  
  // Check nested Lab data
  const mcLab = measurement.matched_color_data?.lab;
  const hasNestedLab = mcLab && 
    (mcLab.L != null || mcLab.l != null) && 
    (mcLab.a != null || mcLab.A != null) && 
    (mcLab.b != null || mcLab.B != null);
  
  return hasNestedLab;
};

const QualityMetric = ({ rule, result, deltaEMethod }) => {
  // Use the display color from the result if available (calculated in resultsByRule)
  const displayColor = result?.displayColor || 'hsl(var(--muted-foreground))';

  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">
        {rule.reference || rule.name} {deltaEMethod}:
      </span>
      <span 
        className="text-sm font-medium"
        style={{ color: displayColor }}
      >
        {result ? `${result.value.toFixed(2)} (${result.levelName})` : '--'}
      </span>
    </div>
  );
};

const QualitySetDisplay = ({ 
  qualitySetId, 
  matchRequestId, 
  colorId, 
  qualitySet = null, 
  matchMeasurement = null, 
  colorMeasurements = null 
}) => {
  // If qualitySet is provided and has rules, use it directly (this comes from useOptimizedMatchData)
  // This ensures consistency with DetailsSidebar which gets the same qualitySet
  const shouldUseProvidedQualitySet = qualitySet && hasRules(qualitySet);
  
  console.log('[QualitySetDisplay] Props received:', {
    qualitySetId,
    hasProvidedQualitySet: !!qualitySet,
    providedQualitySetHasRules: shouldUseProvidedQualitySet,
    providedQualitySetId: qualitySet?.id,
    providedQualitySetName: qualitySet?.name,
    matchRequestId,
    colorId
  });
  // Fetch match-level quality set when qualitySetId is null
  const { data: matchLevelQualitySet, isLoading: matchQualitySetLoading } = useQuery({
    queryKey: ['match-level-quality-set', matchRequestId],
    queryFn: async () => {
      if (!matchRequestId) return null;
      
      
      
      const { data, error } = await supabase.rpc('get_quality_set_details_for_match', { 
        p_match_request_id: matchRequestId
      });
      
      console.log('[QualitySetDisplay] Match-level quality set result:', { data, error });
      
      if (error) {
        console.error('[QualitySetDisplay] Match-level quality set error:', error);
        return null;
      }
      
      return data;
    },
    enabled: !qualitySetId && !!matchRequestId,
  });

  // Only fetch quality set if we don't already have a valid one from props
  const { data: fetchedQualitySet, isLoading: qualitySetLoading, error: qualitySetError } = useQuery({
    queryKey: ['shared-quality-set-details', qualitySetId, matchRequestId],
    queryFn: async () => {
      if (!qualitySetId) return null;
      
      
      
      // Try RPC first
      const { data, error } = await supabase.rpc('get_shared_quality_set_details', { 
        qs_id: qualitySetId,
        match_request_id: matchRequestId 
      });
      
      console.log('[QualitySetDisplay] RPC result:', { data, error });
      
      if (error) {
        console.error('[QualitySetDisplay] RPC error:', error);
        throw error;
      }

      // Check if data contains an error (unauthorized access)
      if (data && data.error) {
        console.error('[QualitySetDisplay] Authorization error:', data.error);
        // Try direct fetch as fallback
        console.log('[QualitySetDisplay] Attempting direct fetch fallback');
        const { data: direct, error: directError } = await supabase
          .from('quality_sets')
          .select('id, name, measurement_settings, quality_rules(id, name, reference, quality_levels(id, name, range_from, range_to, action, display_color))')
          .eq('id', qualitySetId)
          .maybeSingle();
        
        console.log('[QualitySetDisplay] Direct fetch result:', { direct, directError });
        
        if (directError) {
          console.error('[QualitySetDisplay] Direct fetch error:', directError);
          throw directError;
        }
        return direct;
      }

      // Fallback: direct fetch if no rules returned
      if (!hasRules(data)) {
        console.log('[QualitySetDisplay] No rules found, trying direct fetch');
        const { data: direct, error: directError } = await supabase
          .from('quality_sets')
          .select('id, name, measurement_settings, quality_rules(id, name, reference, quality_levels(id, name, range_from, range_to, action, display_color))')
          .eq('id', qualitySetId)
          .maybeSingle();
        
        console.log('[QualitySetDisplay] Direct fetch result:', { direct, directError });
        
        if (directError) throw directError;
        return direct;
      }

      return data;
    },
    enabled: !!qualitySetId && !shouldUseProvidedQualitySet,
  });

  const { data: fetchedMatchMeasurement } = useQuery({
    queryKey: ['match-measurement', matchRequestId, colorId],
    queryFn: async () => {
      if (!matchRequestId || !colorId) return null;
      
      
      
      const { data, error } = await supabase
        .from('match_measurements')
        .select(`
          id, color_id, lab_l, lab_a, lab_b, 
          reference_lab_l, reference_lab_a, reference_lab_b, status,
          matched_color_data,
          spectral_data,
          colors(id, name, hex, lab_l, lab_a, lab_b)
        `)
        .eq('match_request_id', matchRequestId)
        .eq('color_id', colorId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('[QualitySetDisplay] Error fetching match measurement:', error);
        throw error;
      }
      
      console.log('[QualitySetDisplay] Fetched match measurement:', {
        hasData: !!data,
        hasCompleteLab: hasCompleteLab(data),
        labValues: data ? {
          lab_l: data.lab_l,
          lab_a: data.lab_a,
          lab_b: data.lab_b,
          nestedLab: data.matched_color_data?.lab
        } : null
      });
      
      return data;
    },
    // Always fetch if we don't have complete Lab data, even if matchMeasurement is provided
    enabled: !!matchRequestId && !!colorId && !hasCompleteLab(matchMeasurement),
  });

  const { data: fetchedColorMeasurements } = useQuery({
    queryKey: ['color-measurements', colorId],
    queryFn: async () => {
      if (!colorId) return null;
      
      const { data, error } = await supabase
        .from('color_measurements')
        .select('lab, spectral_data, mode')
        .eq('color_id', colorId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      console.log('[QualitySetDisplay] Fetched color measurements:', {
        count: data?.length || 0,
        hasAnyLab: Array.isArray(data) ? data.some(m => !!m?.lab && (m.lab.L != null || m.lab.l != null)) : false,
        hasAnySpectral: Array.isArray(data) ? data.some(m => m && m.spectral_data && Object.keys(m.spectral_data || {}).length > 0) : false,
      });
      return data;
    },
    enabled: !!colorId && !colorMeasurements,
  });

  // PRIORITY ORDER: provided qualitySet > fetched qualitySet > match-level qualitySet
  // This ensures consistency with DetailsSidebar which uses the same qualitySet from useOptimizedMatchData
  const rawQualitySet = shouldUseProvidedQualitySet ? qualitySet :
                       (hasRules(fetchedQualitySet) ? fetchedQualitySet : 
                        (fetchedQualitySet || matchLevelQualitySet));
  
  // Prefer the more complete measurement between provided and fetched
  const activeMatchMeasurement = (() => {
    const provided = matchMeasurement;
    const fetched = fetchedMatchMeasurement;
    
    // If we have both, prefer the one with complete Lab data
    if (provided && fetched) {
      const providedComplete = hasCompleteLab(provided);
      const fetchedComplete = hasCompleteLab(fetched);
      
      console.log('[QualitySetDisplay] Choosing between measurements:', {
        providedComplete,
        fetchedComplete,
        choosing: fetchedComplete ? 'fetched' : 'provided'
      });
      
      return fetchedComplete ? fetched : provided;
    }
    
    return provided || fetched;
  })();
  
  const activeColorMeasurements = colorMeasurements || fetchedColorMeasurements;
  const isLoading = (qualitySetLoading || matchQualitySetLoading) && !shouldUseProvidedQualitySet;

  // Fetch ink condition if match measurement has ink_condition_id but no usable match data
  const { data: inkCondition } = useQuery({
    queryKey: ['ink-condition-for-quality', activeMatchMeasurement?.ink_condition_id],
    queryFn: async () => {
      if (!activeMatchMeasurement?.ink_condition_id) return null;
      
      const { data, error } = await supabase
        .from('ink_conditions')
        .select('*')
        .eq('id', activeMatchMeasurement.ink_condition_id)
        .single();
      
      if (error) {
        console.error('[QualitySetDisplay] Error fetching ink condition:', error);
        return null;
      }
      
      console.log('[QualitySetDisplay] Fetched ink condition for quality:', {
        id: data?.id,
        name: data?.name,
        hasSpectralData: !!(data?.spectral_data && Object.keys(data.spectral_data).length > 0),
        hasAdaptedTints: !!(data?.adapted_tints && Object.keys(data.adapted_tints).length > 0),
        hasImportedTints: !!(data?.imported_tints && Object.keys(data.imported_tints).length > 0),
        active_data_mode: data?.active_data_mode,
        ui_state_mode: data?.ui_state?.active_data_mode
      });
      
      return data;
    },
    enabled: !!activeMatchMeasurement?.ink_condition_id && !hasCompleteLab(activeMatchMeasurement),
  });

  // Derive match Lab from ink condition if needed
  const inkConditionDerivedLab = useMemo(() => {
    if (!inkCondition || hasCompleteLab(activeMatchMeasurement)) return null;
    
    const activeMode = resolveActiveDataMode(inkCondition);
    console.log('[QualitySetDisplay] Resolving ink condition Lab:', {
      inkConditionId: inkCondition.id,
      activeMode,
      hasConditionSpectral: !!(inkCondition.spectral_data && Object.keys(inkCondition.spectral_data).length > 0),
      hasAdaptedTints: !!(inkCondition.adapted_tints && Object.keys(inkCondition.adapted_tints).length > 0)
    });
    
    // 🎯 Phase 2: Use correct tints based on activeMode
    const tintsToUse = activeMode === 'adapted'
      ? (inkCondition.adapted_tints || [])
      : (inkCondition.imported_tints || []);
    
    // Use getSolidSpectralData with strictAdapted=true to enforce active_data_mode
    const spectralResult = getSolidSpectralData(
      inkCondition,
      activeMode,
      tintsToUse,
      null,
      { mode: activeMatchMeasurement?.measurement_mode || 'M0', strictAdapted: true }
    );
    
    if (!spectralResult) {
      console.warn('[QualitySetDisplay] No spectral data found for ink condition with activeMode:', {
        inkConditionId: inkCondition.id,
        activeMode,
        strictAdapted: true
      });
      return null;
    }
    
    console.log('[QualitySetDisplay] Spectral data resolved from ink condition:', {
      source: spectralResult.source,
      mode: spectralResult.mode,
      hasLab: !!spectralResult.lab
    });
    
    // If spectral result has Lab, use it
    if (spectralResult.lab) {
      return {
        L: spectralResult.lab.L || spectralResult.lab.l,
        a: spectralResult.lab.a || spectralResult.lab.A,
        b: spectralResult.lab.b || spectralResult.lab.B
      };
    }
    
    // Otherwise, use the ink condition's Lab
    if (inkCondition.lab) {
      return {
        L: inkCondition.lab.L || inkCondition.lab.l,
        a: inkCondition.lab.a || inkCondition.lab.A,
        b: inkCondition.lab.b || inkCondition.lab.B
      };
    }
    
    return null;
  }, [inkCondition, activeMatchMeasurement]);

  // Extract full measurement settings from quality set (before normalization)
  const qualitySetMeasurementSettings = rawQualitySet?.measurement_settings || null;
  const requiredMode = qualitySetMeasurementSettings?.mode || 
                       rawQualitySet?.measurement_mode || 
                       null;

  if (import.meta.env.DEV && qualitySetMeasurementSettings) {
    console.log(`[MAIN-UI QualitySetDisplay] 🎯 Quality set measurement settings:`, qualitySetMeasurementSettings);
  }

  // Resolve Labs consistently for match and reference with FULL quality set settings
  const { lab: resolvedMatchLabDirect, source: matchLabSource, details: matchLabDetails } = useResolvedLabFromMatchMeasurement(
    activeMatchMeasurement,
    { 
      requiredMode,
      illuminant: qualitySetMeasurementSettings?.illuminant,
      observer: qualitySetMeasurementSettings?.observer,
      tableNumber: qualitySetMeasurementSettings?.table
    }
  );
  const resolvedMatchLab = resolvedMatchLabDirect || inkConditionDerivedLab;
  const { lab: resolvedRefLab, source: refLabSource, details: refLabDetails } = useResolvedLabFromReference(
    activeMatchMeasurement,
    activeColorMeasurements,
    { 
      requiredMode,
      illuminant: qualitySetMeasurementSettings?.illuminant,
      observer: qualitySetMeasurementSettings?.observer,
      tableNumber: qualitySetMeasurementSettings?.table
    }
  );

  console.log('[MAIN-UI] 🔵 LAB RESOLUTION DETAILS:', {
    requiredMode,
    matchLabSource,
    matchLabDetails,
    resolvedMatchLab,
    refLabSource,
    refLabDetails,
    resolvedRefLab,
    measurementSpectralDataType: typeof activeMatchMeasurement?.spectral_data,
    measurementHasSpectral: !!(activeMatchMeasurement?.spectral_data),
    colorMeasurementsSpectralCount: activeColorMeasurements?.filter(m => m?.spectral_data)?.length || 0
  });

  // Enhanced diagnostics for debugging authentication and data flow
  const hasMatchLabResolved = !!(resolvedMatchLab && Number.isFinite(resolvedMatchLab.L) && Number.isFinite(resolvedMatchLab.a) && Number.isFinite(resolvedMatchLab.b));
  const hasRefLabResolved = !!(resolvedRefLab && Number.isFinite(resolvedRefLab.L) && Number.isFinite(resolvedRefLab.a) && Number.isFinite(resolvedRefLab.b));

  console.info('[QualitySetDisplay] Debug info:', {
    qualitySetId,
    matchRequestId,
    colorId,
    shouldUseProvidedQualitySet,
    providedQualitySetId: qualitySet?.id,
    providedRules: ((qualitySet?.quality_rules || qualitySet?.rules) || []).length,
    fetchedRules: ((fetchedQualitySet?.quality_rules || fetchedQualitySet?.rules) || []).length,
    finalQualitySetId: rawQualitySet?.id,
    finalQualitySetName: rawQualitySet?.name,
    finalQualitySetSource: rawQualitySet?.source,
    hasActiveMatchMeasurement: !!activeMatchMeasurement,
    matchMeasurementLabValues: activeMatchMeasurement ? {
      lab_l: activeMatchMeasurement.lab_l,
      lab_a: activeMatchMeasurement.lab_a,
      lab_b: activeMatchMeasurement.lab_b,
      ink_condition_id: activeMatchMeasurement.ink_condition_id
    } : null,
    hasInkCondition: !!inkCondition,
    inkConditionDerivedLab,
    hasColorMeasurements: !!activeColorMeasurements?.length,
    matchLabSource: matchLabSource || (inkConditionDerivedLab ? 'ink-condition-derived' : undefined),
    refLabSource,
    hasMatchLabResolved,
    hasRefLabResolved,
    qualitySetLoading,
    isLoading
  });

  // Presence summary (independent of calculation path)
  const rulesCountPreNorm = ((rawQualitySet?.quality_rules || rawQualitySet?.rules) || []).length;
  console.info('[QualitySetDisplay] Presence summary:', { hasMatchLabResolved, hasRefLabResolved, rulesCount: rulesCountPreNorm });

  // Normalize the quality set data structure
  const activeQualitySet = rawQualitySet ? {
    ...rawQualitySet,
    rules: (rawQualitySet.quality_rules || rawQualitySet.rules || []).map(rule => ({
      ...rule,
      levels: rule.quality_levels || rule.levels || []
    }))
  } : null;

  // Early return if still loading critical data
  if (isLoading || !activeQualitySet) {
    return (
      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <div className="h-4 bg-muted animate-pulse rounded mb-2"></div>
        <div className="space-y-2">
          <div className="h-3 bg-muted animate-pulse rounded"></div>
          <div className="h-3 bg-muted animate-pulse rounded"></div>
        </div>
      </div>
    );
  }

  // Check match state to differentiate between "new/empty" vs "incomplete data"
  const matchState = activeMatchMeasurement?.match_measurement_state || 'empty';
  const isEmptyMatch = matchState === 'empty';


  if (!qualitySetId && !rawQualitySet) {
    return (
      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">No quality set assigned</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <div className="h-4 bg-muted animate-pulse rounded mb-2"></div>
        <div className="space-y-2">
          <div className="h-3 bg-muted animate-pulse rounded"></div>
          <div className="h-3 bg-muted animate-pulse rounded"></div>
        </div>
      </div>
    );
  }

  if (!activeQualitySet) {
    return (
      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">Quality set not found</p>
      </div>
    );
  }

  // If there are no rules, show a friendly placeholder
  if (!activeQualitySet.rules || activeQualitySet.rules.length === 0) {
    return (
      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">No rules defined for this quality set</p>
      </div>
    );
  }

  // Calculate quality results if we have both match and reference Lab data
  const canCalcMatch = !!(resolvedMatchLab && Number.isFinite(resolvedMatchLab.L) && Number.isFinite(resolvedMatchLab.a) && Number.isFinite(resolvedMatchLab.b));
  const canCalcRef = !!(resolvedRefLab && Number.isFinite(resolvedRefLab.L) && Number.isFinite(resolvedRefLab.a) && Number.isFinite(resolvedRefLab.b));

  console.log('🔍 [QualitySetDisplay] Quality calculation debug:', {
    canCalcMatch,
    canCalcRef,
    resolvedMatchLab,
    resolvedRefLab,
    activeQualitySetRules: activeQualitySet?.rules?.length || 0
  });

  let qualityResults = null;
  if (canCalcMatch && canCalcRef) {
    const measurementForCalc = {
      ...activeMatchMeasurement,
      lab_l: resolvedMatchLab.L,
      lab_a: resolvedMatchLab.a,
      lab_b: resolvedMatchLab.b,
    };

    const referenceColor = {
      lab_l: resolvedRefLab.L,
      lab_a: resolvedRefLab.a,
      lab_b: resolvedRefLab.b,
    };

    console.log('[MAIN-UI QualitySetDisplay] 🔵 CRITICAL DEBUG - Pre-calculation:', {
      measurementLab: { L: measurementForCalc.lab_l, a: measurementForCalc.lab_a, b: measurementForCalc.lab_b },
      referenceLab: { L: referenceColor.lab_l, a: referenceColor.lab_a, b: referenceColor.lab_b },
      matchLabSource,
      refLabSource,
      qualitySetName: activeQualitySet?.name,
      rulesCount: activeQualitySet?.rules?.length,
      measurementSettings: activeQualitySet?.measurement_settings
    });

    qualityResults = calculateQualityAssessment(measurementForCalc, referenceColor, activeQualitySet);

    console.log('[MAIN-UI QualitySetDisplay] 🔵 CRITICAL DEBUG - Post-calculation:', {
      hasResults: !!qualityResults,
      resultCount: qualityResults?.results?.length || 0,
      status: qualityResults?.status,
      allMetrics: qualityResults?.allMetrics,
      rawDeltaE2000: qualityResults?.allMetrics?.dE2000,
      rawDeltaE76: qualityResults?.allMetrics?.dE76
    });
  } else {
    console.log('[QualitySetDisplay] Missing Lab data - will show placeholders', { canCalcMatch, canCalcRef });
  }

  // Create results mapping by rule name with proper level matching
  const resultsByRule = {};
  if (qualityResults?.results) {
    qualityResults.results.forEach(result => {
      // Find the rule by reference/name to get levels
      const rule = activeQualitySet.rules?.find(r => r.reference === result.ruleName || r.name === result.ruleName);
      const key = rule?.reference || rule?.name || result.ruleName;
      
      if (!rule || !rule.levels) {
        resultsByRule[key] = {
          ...result,
          levelName: 'Unknown',
          displayColor: result.displayColor || '#6B7280' // Use display color from result if available
        };
        return;
      }

      // Sort levels by range_from to ensure proper order
      const levels = [...rule.levels].sort((a, b) => a.range_from - b.range_from);
      let levelName = 'Unknown';
      let matchingLevel = null;
      
      // Find the appropriate level based on the value
      for (const level of levels) {
        const inRange = result.value >= level.range_from && 
                       (level.range_to === null || level.range_to === undefined || result.value <= level.range_to);
        if (inRange) {
          levelName = level.name;
          matchingLevel = level;
          break;
        }
      }
      
      resultsByRule[key] = {
        ...result,
        levelName,
        displayColor: result.displayColor || matchingLevel?.display_color || '#6B7280'
      };
    });
  }

  const deltaEMethod = activeQualitySet.measurement_settings?.deltaE || 'dE76';

  return (
    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-medium text-foreground">{activeQualitySet.name}</h4>
      </div>
      <div className="space-y-2">
        {activeQualitySet.rules?.map((rule, index) => {
          const ruleKey = rule.reference || rule.name;
          const result = resultsByRule[ruleKey];
          
          // Guard against display formatting issues
          const safeResult = result && typeof result.value === 'number' ? result : null;
          
          return (
            <QualityMetric 
              key={index} 
              rule={rule} 
              result={safeResult}
              deltaEMethod={deltaEMethod}
            />
          );
        })}
      </div>
    </div>
  );
};

export default QualitySetDisplay;