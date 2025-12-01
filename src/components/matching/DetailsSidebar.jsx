import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/customSupabaseClient';
import { CheckCircle2, XCircle, Edit3, ChevronDown, ChevronRight, Loader2, Check } from 'lucide-react';
import { calculateDeltaE } from '@/lib/deltaE';
import { getColorMatchStatusForOrg } from '@/lib/matchStatusUtils.jsx';
import { debug } from '@/lib/debugUtils';
import QualityMetricsTable from './QualityMetricsTable';
import { useProfile } from '@/context/ProfileContext';
import { computeDynamicDisplayColor } from '@/lib/objectSpecificColorCalculation';
import { resolveActiveDataMode } from '@/lib/colorUtils/resolveActiveDataMode';

const DetailItem = ({ label, value }) => (
  <div className="flex justify-between text-sm">
    <span className="text-gray-500">{label}</span>
    <span className="font-medium text-gray-800">{value}</span>
  </div>
);

const RuleCard = ({ title, subtitle, value, unit = '', passed }) => (
  <div className={`flex items-center justify-between rounded-lg border p-3 mb-3 ${
    passed === false ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
  }`}>
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 ${passed === false ? 'text-red-600' : 'text-green-600'}`}>
        {passed === false ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
      </div>
      <div>
        <div className="text-sm font-medium text-gray-800">{title}</div>
        <div className="text-xs text-gray-500">{subtitle}</div>
      </div>
    </div>
    <div className={`text-xl font-semibold ${passed === false ? 'text-red-600' : 'text-emerald-600'}`}>
      {value ?? '—'}{value != null ? unit : ''}
    </div>
  </div>
);

function parseLab(lab) {
  if (!lab) return null;
  let L, a, b;
  if (typeof lab === 'string') {
    const nums = lab.match(/-?\d+(?:\.\d+)?/g);
    if (nums && nums.length >= 3) [L, a, b] = nums.slice(0, 3).map(Number);
  } else if (Array.isArray(lab)) {
    [L, a, b] = [lab[0], lab[1], lab[2]];
  } else if (typeof lab === 'object') {
    L = lab.L ?? lab.l; a = lab.a ?? lab.A; b = lab.b ?? lab.B;
  }
  if ([L, a, b].some(v => v == null || Number.isNaN(Number(v)))) return null;
  return { L: Number(L), a: Number(a), b: Number(b) };
}

const deriveLabFrom = (entity) => {
  if (!entity) return null;

  // 1) Direct LAB fields from entity itself
  const directLab =
    parseLab(entity.lab) ||
    parseLab(entity.reference_lab) ||
    (entity.lab_l != null && entity.lab_a != null && entity.lab_b != null ? { L: Number(entity.lab_l), a: Number(entity.lab_a), b: Number(entity.lab_b) } : null) ||
    (entity.L != null && entity.a != null && entity.b != null ? { L: Number(entity.L), a: Number(entity.a), b: Number(entity.b) } : null);
  if (directLab) return directLab;

  // 2) Spectral data on the entity
  for (const key of ['spectral_data', 'spectralData', 'spectral']) {
    const spec = entity[key];
    if (spec && typeof spec === 'object') {
      // NOTE: spectralToLab removed - would need ASTM tables for accurate calculation
      return null;
    }
  }

  // 3) Measurements array (prefer M1 if present, then M2)
  const measurements = Array.isArray(entity.measurements) ? entity.measurements : null;
  if (measurements && measurements.length) {
    const isM1 = (v) => String(v || '').toUpperCase() === 'M1';
    const isM2 = (v) => String(v || '').toUpperCase() === 'M2';
    const preferred =
      measurements.find((m) => isM1(m.mode) || isM1(m.measurement_condition) || isM1(m.condition) || isM1(m.standard_name)) ||
      measurements.find((m) => isM2(m.mode) || isM2(m.measurement_condition) || isM2(m.condition) || isM2(m.standard_name)) ||
      measurements[0];

    const mLab =
      parseLab(preferred.lab) ||
      (preferred.lab_l != null && preferred.lab_a != null && preferred.lab_b != null
        ? { L: Number(preferred.lab_l), a: Number(preferred.lab_a), b: Number(preferred.lab_b) }
        : null) ||
      (preferred.L != null && preferred.a != null && preferred.b != null
        ? { L: Number(preferred.L), a: Number(preferred.a), b: Number(preferred.b) }
        : null);
    
    if (mLab) return mLab;

    for (const key of ['spectral_data', 'spectralData', 'spectral']) {
      const spec = preferred[key];
      if (spec && typeof spec === 'object') {
        // NOTE: spectralToLab removed - would need ASTM tables for accurate calculation
        return null;
      }
    }
  }

  return null;
};

const hueAngle = ({ a, b }) => {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
};

const chroma = ({ a, b }) => Math.sqrt(a * a + b * b);

const DetailsSidebar = ({ selectedColor, loadedMatch, matchMeasurement, onSave, disabled = false, matchId, colorId, matchRequest, qualitySet, onMatchNameChange, activeTab, onTabChange, colorMeasurements, printConditionDetails, measurementControls, astmTables }) => {
  const { profile } = useProfile();
  const userOrgId = profile?.organization_id;
  const [qualityRules, setQualityRules] = useState([]);
  const [qualityResults, setQualityResults] = useState(null);
  const [qualitySetCache, setQualitySetCache] = useState(new Map()); // Remove after migration
  const [isLoadingQuality, setIsLoadingQuality] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [partnerOrg, setPartnerOrg] = useState(null);
  const [requestorOrg, setRequestorOrg] = useState(null);
  const [routedToOrg, setRoutedToOrg] = useState(null);
  const [isPrintConditionExpanded, setIsPrintConditionExpanded] = useState(false);
  const [resolvedLocation, setResolvedLocation] = useState(null);
  const [routedToLocation, setRoutedToLocation] = useState(null);
  const [matchedByName, setMatchedByName] = useState('N/A');
  const [pcDetails, setPcDetails] = useState(printConditionDetails || null);
  const [isPcLoading, setIsPcLoading] = useState(false);
  const [actualPrintCondition, setActualPrintCondition] = useState(null);
  const [isLoadingActualPrintCondition, setIsLoadingActualPrintCondition] = useState(false);
  // Track attempted fetches to avoid loops on RPC error
  const attemptedPcKeysRef = useRef(new Set());
  // Stable identifier for print condition
  const printConditionIdentifier =
    matchRequest?.print_condition_id ||
    matchRequest?.print_condition ||
    matchRequest?.print_condition_name;

  console.log('🔍 [DetailsSidebar] Print condition resolution:', {
    print_condition_id: matchRequest?.print_condition_id,
    print_condition: matchRequest?.print_condition,
    print_condition_name: matchRequest?.print_condition_name
  });

  const pcFetchKey = matchId && matchRequest ? `${matchId}__${String(printConditionIdentifier || 'fetch_anyway')}` : null;

  // "Matched by" resolution - show organization that created the match
  useEffect(() => {
    // First try the matched_by_name field (org name stored in DB)
    const storedName = loadedMatch?.matched_by_name || matchMeasurement?.matched_by_name;
    if (storedName && storedName.trim() !== '') {
      setMatchedByName(storedName.trim());
      return;
    }

    // Fallback: determine from routing
    if (matchRequest?.is_routed && matchRequest?.routed_to_org_name) {
      setMatchedByName(matchRequest.routed_to_org_name);
    } else if (matchRequest?.shared_with_org_name) {
      setMatchedByName(matchRequest.shared_with_org_name);
    } else {
      setMatchedByName('N/A');
    }
  }, [loadedMatch, matchMeasurement, matchRequest?.is_routed, matchRequest?.routed_to_org_name, matchRequest?.shared_with_org_name]);

  // Use provided data when available to avoid additional API calls
  const organizationName = matchRequest?.organization_name;
  const printConditionName = matchRequest?.print_condition;

  // Only fetch additional details if not provided in optimized data
  useEffect(() => {
    const fetchAdditionalDetails = async () => {
      try {
        // Determine user's organizational role for proper field display
        const isRequestor = userOrgId === matchRequest?.organization_id;
        const isSharedWith = userOrgId === matchRequest?.shared_with_org_id;
        const isRoutedTo = userOrgId === matchRequest?.routed_to_org_id;
        
        console.log('🔍 User organizational role:', { 
          userOrgId, 
          isRequestor, 
          isSharedWith, 
          isRoutedTo,
          requestOrgId: matchRequest?.organization_id,
          sharedWithOrgId: matchRequest?.shared_with_org_id,
          routedToOrgId: matchRequest?.routed_to_org_id
        });
        
        if (isRequestor) {
          // For requestor view: fetch partner (shared-with) organization details
          if (matchRequest?.shared_with) {
            setPartnerOrg(matchRequest.shared_with);
          } else if (matchRequest?.shared_with_org_id) {
            const { data: orgData, error: orgError } = await supabase
              .from('organizations')
              .select('name')
              .eq('id', matchRequest.shared_with_org_id)
              .maybeSingle();
            
            if (!orgError && orgData) {
              setPartnerOrg(orgData.name);
            }
          }
        } else if (isSharedWith || isRoutedTo) {
          // For shared-with org view: fetch requestor organization details
          // For routed-to org view: fetch shared-with organization details
          const orgIdToFetch = isRoutedTo ? matchRequest?.shared_with_org_id : matchRequest?.organization_id;
          
          if (orgIdToFetch) {
            const { data: orgData, error: orgError } = await supabase
              .from('organizations')
              .select('name')
              .eq('id', orgIdToFetch)
              .maybeSingle();
            
            if (!orgError && orgData) {
              setRequestorOrg(orgData.name);
            }
          }
          
          // If routed, also fetch routed-to organization details
          if (matchMeasurement?.is_routed ?? matchRequest?.is_routed) {
            if (matchRequest?.routed_to) {
              setRoutedToOrg(matchRequest.routed_to);
            } else if (matchRequest?.routed_to_org_id) {
              const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .select('name')
                .eq('id', matchRequest.routed_to_org_id)
                .maybeSingle();
              
              if (!orgError && orgData) {
                setRoutedToOrg(orgData.name);
              }
            }
          }
        }

        // Enhanced location resolution using RPC-provided org locations
        let locationToResolve = null;
        const isMatchRouted = (matchMeasurement?.is_routed ?? matchRequest?.is_routed) === true;
        
        if (isRequestor) {
          // Requestor view: ALWAYS show shared-with org's location
          // Never show routed-to location or match_location
          locationToResolve = matchRequest?.shared_with_location_name 
            || matchRequest?.location_name 
            || matchRequest?.location;
        } else {
          // Shared-with or routed-to view: location follows the matched-by org
          if (isMatchRouted) {
            // Routed-to created the match -> use routed-to org's location
            locationToResolve = matchMeasurement?.match_location 
              || matchRequest?.routed_to_location_name;
          } else {
            // Shared-with created the match -> use shared-with org's location
            locationToResolve = matchMeasurement?.match_location 
              || matchRequest?.shared_with_location_name 
              || matchRequest?.location_name 
              || matchRequest?.location;
          }
        }

        // Set the location directly - no UUID resolution needed
        if (isRequestor) {
          setResolvedLocation(locationToResolve);
        } else if (isMatchRouted) {
          setRoutedToLocation(locationToResolve);
        } else {
          setResolvedLocation(locationToResolve);
        }


        // Print condition details will be fetched by fetchActualPrintCondition
        // which handles the proper fallback chain and ID capture
      } catch (error) {
        debug.error('Error fetching additional details:', error);
      }
    };

    fetchAdditionalDetails();
  }, [matchRequest?.organization_id, organizationName, printConditionName, matchMeasurement?.match_location, matchRequest?.location, matchRequest?.id]);

  // Stabilize measurement controls with useMemo to prevent render loops
  const safeControls = useMemo(() => ({
    mode: measurementControls?.mode || 'M1',
    illuminant: measurementControls?.illuminant || 'D50',
    observer: measurementControls?.observer || '2',
    deltaE: measurementControls?.deltaE || 'dE00',
    table: measurementControls?.table || '5',
  }), [
    measurementControls?.mode,
    measurementControls?.illuminant,
    measurementControls?.observer,
    measurementControls?.deltaE,
    measurementControls?.table,
  ]);

  // Calculate reference color data (hex and Lab) using computeDynamicDisplayColor
  const referenceColorData = useMemo(() => {
    if (!selectedColor) {
      return { hex: null, lab: null };
    }
    
    return computeDynamicDisplayColor(
      selectedColor,
      {},  // No org defaults - use measurementControls directly
      astmTables || [],
      safeControls,
      'imported'
    );
  }, [selectedColor, astmTables, safeControls]);

  const referenceHex = referenceColorData.hex;
  const referenceLab = referenceColorData.lab || (() => {
    // Fall back to deriving from direct Lab fields if computeDynamicDisplayColor didn't return Lab
    const directLab = deriveLabFrom(selectedColor);
    if (directLab) {
      console.log('✅ DetailsSidebar referenceLab: Using direct Lab fields as fallback', {
        colorName: selectedColor?.name,
        lab: directLab
      });
      return directLab;
    }
    return null;
  })();

  // Calculate match color data (hex and Lab) using computeDynamicDisplayColor
  const matchColorData = useMemo(() => {
    if (!loadedMatch) {
      return { hex: null, lab: null };
    }
    
    const effectiveDataMode = resolveActiveDataMode(loadedMatch);
    
    return computeDynamicDisplayColor(
      loadedMatch,
      {},  // No org defaults - use measurementControls directly
      astmTables || [],
      safeControls,
      effectiveDataMode
    );
  }, [loadedMatch, astmTables, safeControls]);

  const matchHex = matchColorData.hex;
  const matchLab = matchColorData.lab || (() => {
    // Fall back to deriving Lab from direct fields if computeDynamicDisplayColor didn't return Lab
    const directLab = deriveLabFrom(loadedMatch);
    if (directLab) {
      console.log('✅ DetailsSidebar matchLab: Using direct Lab fields as fallback', {
        colorName: loadedMatch?.name,
        lab: directLab
      });
      return directLab;
    }
    return null;
  })();

  const colorMetrics = useMemo(() => {
    if (!referenceLab || !matchLab) return null;

    const dL = matchLab.L - referenceLab.L;
    const dA = matchLab.a - referenceLab.a;
    const dB = matchLab.b - referenceLab.b;

    const refChroma = Math.sqrt(referenceLab.a ** 2 + referenceLab.b ** 2);
    const matchChroma = Math.sqrt(matchLab.a ** 2 + matchLab.b ** 2);
    const dC = matchChroma - refChroma;

    const refHue = Math.atan2(referenceLab.b, referenceLab.a) * 180 / Math.PI;
    const matchHue = Math.atan2(matchLab.b, matchLab.a) * 180 / Math.PI;
    let dH = matchHue - refHue;
    if (dH > 180) dH -= 360;
    if (dH < -180) dH += 360;

    let dE = null;
    try {
      const method = safeControls.deltaE === 'dE00' ? 'dE2000' : safeControls.deltaE;
      dE = calculateDeltaE(referenceLab, matchLab, method);
    } catch (e) {
      debug.warn?.('Delta E calculation failed:', e);
    }

    return {
      dE: Number.isFinite(dE) ? Number(dE.toFixed(2)) : null,
      dL: Number(dL.toFixed(2)),
      dA: Number(dA.toFixed(2)),
      dB: Number(dB.toFixed(2)),
      dC: Number(dC.toFixed(2)),
      dH: Number(dH.toFixed(2)),
      referenceLab,
      matchLab
    };
  }, [referenceLab, matchLab, safeControls.deltaE]);
  // Create stable Lab keys from rounded values to prevent infinite loops
  const refKey = useMemo(() => referenceLab
    ? `${referenceLab.L.toFixed(4)}|${referenceLab.a.toFixed(4)}|${referenceLab.b.toFixed(4)}`
    : 'none'
  , [referenceLab?.L, referenceLab?.a, referenceLab?.b]);

  const matchKey = useMemo(() => matchLab
    ? `${matchLab.L.toFixed(4)}|${matchLab.a.toFixed(4)}|${matchLab.b.toFixed(4)}`
    : 'none'
  , [matchLab?.L, matchLab?.a, matchLab?.b]);

  // In-flight guard to prevent overlapping QA calculations
  const qaInFlightRef = useRef(false);

  // Stabilize fetchQualityAssessment - only depends on qualitySet
  const fetchQualityAssessment = useCallback(async (selectedLab, matchLab) => {
    if (!selectedLab || !matchLab) return;
    if (qaInFlightRef.current) {
      console.log('🔎 QA: Skipping - calculation already in progress');
      return;
    }
    
    qaInFlightRef.current = true;
    
    try {
      setIsLoadingQuality(true);
      debug.time('quality-assessment');
      
      // Use quality set directly from hook (already fetched by useOptimizedMatchData)  
      const qualitySetToUse = qualitySet;
      
      // Always calculate metrics, even without a quality set
      const rawRules = qualitySetToUse ? (qualitySetToUse.quality_rules || qualitySetToUse.rules || []) : [];
      const normalizedRules = rawRules.map((r) => ({
        ...r,
        levels: (r.quality_levels || r.levels || []).map(l => ({ ...l })),
      }));

      setQualityRules(normalizedRules);

      // Enhanced diagnostics - include source information and more context
      console.log('🔎 QA: Quality Set Analysis', {
        hasQualitySet: !!qualitySetToUse,
        qualitySetId: qualitySetToUse?.id || null,
        name: qualitySetToUse?.name || 'No Quality Set',
        source: qualitySetToUse?.source || 'unknown',
        rawRulesCount: rawRules.length,
        normalizedRulesCount: normalizedRules.length,
        measurementSettings: qualitySetToUse?.measurement_settings,
        matchRequestOrgId: matchRequest?.organization_id,
        matchRequestQualitySetId: loadedMatch?.quality_set_id || matchRequest?.quality_set_id
      });

      console.log('🔎 QA: Detailed quality rules', normalizedRules.map(r => ({
        reference: r.reference,
        metric: r.metric,
        levelsCount: r.levels?.length || 0
      })));
      
      const { calculateQualityAssessment, calculateAllColorMetrics, normalizeMetricKey } = await import('@/lib/qualityAssessment');
      
      // STEP 1: Harden inputs by explicitly coercing Lab components to finite numbers
      const matchMeasurement = { 
        lab_l: isFinite(Number(matchLab.L)) ? Number(matchLab.L) : 0, 
        lab_a: isFinite(Number(matchLab.a)) ? Number(matchLab.a) : 0, 
        lab_b: isFinite(Number(matchLab.b)) ? Number(matchLab.b) : 0 
      };
      
      const referenceColorData = { 
        lab: {
          L: isFinite(Number(selectedLab.L)) ? Number(selectedLab.L) : 0,
          a: isFinite(Number(selectedLab.a)) ? Number(selectedLab.a) : 0,
          b: isFinite(Number(selectedLab.b)) ? Number(selectedLab.b) : 0
        }
      };
      
      // Use quality set from hook, or create empty one for raw metrics calculation
      const activeQualitySet = qualitySetToUse ? { ...qualitySetToUse, rules: normalizedRules } : { 
        id: null, 
        name: 'No Quality Set', 
        rules: [], 
        measurement_settings: null 
      };
      
      // STEP 4: Add diagnostics - log inputs before calculation
      console.log('🔎 QA: Inputs to calculateQualityAssessment:', {
        matchLab: { L: matchMeasurement.lab_l, a: matchMeasurement.lab_a, b: matchMeasurement.lab_b },
        referenceLab: referenceColorData.lab,
        qualitySetRulesCount: activeQualitySet.rules?.length || 0
      });
      
      const results = calculateQualityAssessment(
        matchMeasurement,
        referenceColorData,
        activeQualitySet
      );
      
      console.log('🔎 QA: calculateQualityAssessment returned:', results);
      console.log('🔎 QA: results.results array length:', results?.results?.length || 0);
      console.log('🔎 QA: results structure', {
        hasResults: !!results,
        hasResultsArray: Array.isArray(results?.results),
        hasAllMetrics: !!results?.allMetrics,
        overallStatus: results?.overallStatus,
        qualitySetName: results?.qualitySetName
      });
      
      // STEP 2: Add fallback logic if results are empty but we have valid data
      if ((!results?.results || results.results.length === 0) && colorMetrics?.referenceLab && colorMetrics?.matchLab) {
        console.log('🔎 QA: Results empty, using fallback synthesis with live color metrics');
        
        // Calculate all metrics directly
        const allMetrics = calculateAllColorMetrics(colorMetrics.referenceLab, colorMetrics.matchLab);
        console.log('🔎 QA: Fallback allMetrics computed:', allMetrics);
        
        // Synthesize per-rule results if we have rules
        const synthesizedResults = [];
        if (activeQualitySet?.rules && activeQualitySet.rules.length > 0) {
          // Get the deltaE method from quality set measurement settings
          const deltaEMethod = activeQualitySet.measurement_settings?.deltaE || 'dE76';
          const normalizedMetric = normalizeMetricKey(deltaEMethod);
          let metricValue = null;
          
          // Map normalized metric to calculated value
          switch (normalizedMetric) {
            case 'de2000': metricValue = allMetrics.dE2000; break;
            case 'de76': metricValue = allMetrics.dE76; break;
            case 'decmc': metricValue = allMetrics.dECMC; break;
            case 'dl': metricValue = Math.abs(allMetrics.dL); break;
            case 'da': metricValue = Math.abs(allMetrics.da); break;
            case 'db': metricValue = Math.abs(allMetrics.db); break;
            case 'dc': metricValue = Math.abs(allMetrics.dC); break;
            case 'dh': metricValue = allMetrics.dH; break;
          }
          
          if (metricValue !== null && isFinite(metricValue)) {
            for (const rule of activeQualitySet.rules) {
              // Find matching level for this value
              const levels = (rule.quality_levels || rule.levels || []).sort((a, b) => a.range_from - b.range_from);
              let levelName = 'Unknown';
              let status = 'unknown';
              let displayColor = '#6B7280';
              
              for (const level of levels) {
                const inRange = metricValue >= level.range_from && 
                               (level.range_to === null || metricValue <= level.range_to);
                if (inRange) {
                  levelName = level.name;
                  status = level.action?.toLowerCase() === 'pass' ? 'pass' : 
                          level.action?.toLowerCase() === 'fail' ? 'fail' : 'warn';
                  displayColor = level.display_color || '#6B7280';
                  break;
                }
              }
              
              synthesizedResults.push({
                ruleName: rule.reference,
                metric: deltaEMethod,
                normalizedMetric,
                value: metricValue,
                formattedValue: `${metricValue.toFixed(2)} ${deltaEMethod}`,
                status,
                action: status,
                levelName,
                displayColor
              });
            }
          }
        }
        
        console.log('🔎 QA: Fallback synthesized results:', synthesizedResults);
        
        // Update results with fallback data
        const fallbackResults = {
          ...results,
          allMetrics,
          results: synthesizedResults,
          overallStatus: synthesizedResults.some(r => r.status === 'fail') ? 'fail' : 
                        synthesizedResults.some(r => r.status === 'warn') ? 'warn' : 'pass'
        };
        
        setQualityResults(fallbackResults);
      } else {
      setQualityResults(results);
      }
      debug.timeEnd('quality-assessment');
    } catch (error) {
      debug.error('Quality assessment error:', error);
    } finally {
      qaInFlightRef.current = false;
      setIsLoadingQuality(false);
    }
  }, [qualitySet?.id]);

  // Effect for quality calculation - only triggers when Lab keys change
  useEffect(() => {
    const orgId = matchRequest?.organization_id;
    const qualitySetId = loadedMatch?.quality_set_id || matchRequest?.quality_set_id;
    
    if (refKey === 'none' || matchKey === 'none') {
      console.log('🔎 QA Effect: Missing Lab keys', { refKey, matchKey });
      return;
    }
    // orgId not required for client-side QA calculation
    
    console.log('🔎 QA Effect: Triggering quality assessment calculation', { refKey, matchKey });
    fetchQualityAssessment(referenceLab, matchLab);
  }, [refKey, matchKey, matchRequest?.organization_id, loadedMatch?.quality_set_id, matchRequest?.quality_set_id, fetchQualityAssessment]);

  // Remove duplicate colorMetrics calculation - already done above


  // Add validation to prevent NaN values
  const dE = (colorMetrics?.dE != null && !isNaN(colorMetrics.dE)) ? colorMetrics.dE : null;
  const dL = (colorMetrics?.dL != null && !isNaN(colorMetrics.dL)) ? colorMetrics.dL : null;
  const dA = (colorMetrics?.dA != null && !isNaN(colorMetrics.dA)) ? colorMetrics.dA : null;
  const dB = (colorMetrics?.dB != null && !isNaN(colorMetrics.dB)) ? colorMetrics.dB : null;
  const dC = (colorMetrics?.dC != null && !isNaN(colorMetrics.dC)) ? colorMetrics.dC : null;
  const dH = (colorMetrics?.dH != null && !isNaN(colorMetrics.dH)) ? colorMetrics.dH : null;

  const metricValueMap = { de2000: dE, dh: dH };

  const ruleCards = qualityResults?.results?.map(result => ({
    id: result.ruleName,
    title: result.ruleName,
    subtitle: `Metric: ${result.formattedValue}`,
    value: result.value?.toFixed(2),
    passed: result.status === 'pass'
  })) || [];

  const rows = [
    { key: 'de', label: 'dE', target: qualityRules.find(r => r.metric === 'de2000')?.threshold ?? '—', value: dE, desc: null },
    { key: 'dl', label: 'dL', target: '—', value: dL, desc: dL != null ? (dL > 0 ? 'Too Light' : dL < 0 ? 'Too Dark' : null) : null },
    { key: 'da', label: 'dA', target: '—', value: dA, desc: dA != null ? (dA > 0 ? 'Too Red' : dA < 0 ? 'Too Green' : null) : null },
    { key: 'db', label: 'dB', target: '—', value: dB, desc: dB != null ? (dB > 0 ? 'Too Yellow' : dB < 0 ? 'Too Blue' : null) : null },
    { key: 'dc', label: 'dC', target: '—', value: dC, desc: dC != null ? (dC > 0 ? 'Too Saturated' : dC < 0 ? 'Less Saturated' : null) : null },
    { key: 'dh', label: 'dH', target: qualityRules.find(r => r.metric === 'dh')?.threshold ?? '—', value: dH, desc: null },
  ];

  const handleNameSave = () => {
    if (onMatchNameChange && editedName.trim()) {
      onMatchNameChange(editedName.trim());
    }
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setEditedName(loadedMatch?.name || '');
    setIsEditingName(false);
  };

  React.useEffect(() => {
    setEditedName(loadedMatch?.name || '');
  }, [loadedMatch?.name]);

  // Fetch actual print condition details from database using RPC functions only
  const fetchActualPrintCondition = useCallback(async () => {
    const key = pcFetchKey;
    console.log('🔍 [fetchActualPrintCondition] Starting - Debug info:', {
      matchId,
      'matchRequest.print_condition': matchRequest?.print_condition,
      'matchRequest.print_condition_id': matchRequest?.print_condition_id,
      'pcFetchKey': key,
      isLoadingActualPrintCondition,
      'has_matchRequest': !!matchRequest,
      'will_return_early': (!matchId || isLoadingActualPrintCondition || (!matchRequest?.print_condition && !matchRequest?.print_condition_id))
    });
    
    if (!matchId) {
      console.warn('[PrintCondition] No matchId available');
      return;
    }
    
    if (isLoadingActualPrintCondition) {
      console.warn('[PrintCondition] Already loading, skipping');
      return;
    }
    
    // Proceed even if identifier is missing; match RPC will resolve by matchId

    setIsLoadingActualPrintCondition(true);
    
    // Optimistic hydrate from matchRequest so UI doesn't show N/A while fetching
    if (!actualPrintCondition) {
      const optimistic = {
        id: matchRequest?.print_condition_id,
        name: matchRequest?.print_condition || matchRequest?.print_condition_name || matchMeasurement?.match_print_condition,
        print_process: matchRequest?.print_process || matchMeasurement?.match_print_process,
        substrate_type: matchRequest?.substrate_type || matchMeasurement?.match_substrate,
        material_type: matchRequest?.material_type,
        print_side: matchRequest?.print_side || matchRequest?.printing_side,
        pack_type: matchRequest?.pack_type,
      };
      setActualPrintCondition(optimistic);
    }
    
    try {
      // Debug authentication context first
      const { data: authDebug } = await supabase.rpc('debug_profile_access');
      console.info('[PrintCondition] Auth context:', authDebug);
      
      console.info('[PrintCondition] Fetching print condition details for match:', matchId);
      console.info('[PrintCondition] Available identifiers:', {
        print_condition_id: matchRequest?.print_condition_id,
        print_condition: matchRequest?.print_condition,
        print_condition_name: matchRequest?.print_condition_name
      });
      
      // NEW PRIMARY: Use the print_condition_id from the main RPC result first
      if (matchRequest?.print_condition_id) {
        console.info('[PrintCondition] PRIMARY: Using print_condition_id from main RPC:', matchRequest.print_condition_id);
        const { data: coreData, error: coreError } = await supabase.rpc('get_print_condition_core', {
          p_print_condition_id: matchRequest.print_condition_id
        });
        
        const coreResult = Array.isArray(coreData) ? coreData[0] : coreData;
        
        if (!coreError && coreResult) {
          console.info('[PrintCondition] SUCCESS: Fetched via core RPC:', coreResult);
          const processedData = {
            id: coreResult.id || coreResult.print_condition_id,
            name: coreResult.name || coreResult.print_condition_name,
            print_process: coreResult.print_process || coreResult.process_name || coreResult.printing_process,
            substrate_type: coreResult.substrate_type_name || coreResult.substrate_type || coreResult.substrate_name,
            material_type: coreResult.substrate_material_name || coreResult.material_type || coreResult.material_name,
            print_side: coreResult.printing_side || coreResult.print_side,
            pack_type: coreResult.pack_type || coreResult.pack_type_name,
          };
          
          setActualPrintCondition(processedData);
          setPcDetails({
            ...processedData,
            print_condition_id: processedData.id,
            substrate_material: processedData.material_type
          });
          return;
        } else {
          console.warn('[PrintCondition] Core RPC failed:', coreError);
        }
      } else {
        console.info('[PrintCondition] No print_condition_id in matchRequest data');
      }
      
      // FALLBACK 1: Try the match RPC that gets print condition details for match participants
      console.info('[PrintCondition] FALLBACK 1: Trying match-specific RPC');
      const { data: matchPcData, error: matchPcError } = await supabase
        .rpc('get_print_condition_details_for_match', {
          p_match_request_id: matchId,
        });

      const matchPcResult = Array.isArray(matchPcData) ? matchPcData[0] : matchPcData;
      
      console.info('[PrintCondition] Match RPC response:', { matchPcData, matchPcError });
      
      if (matchPcResult && !matchPcError) {
        console.info('[PrintCondition] SUCCESS: Fetched via match RPC:', matchPcResult);
        
        // Capture the ID from the match RPC response for future use
        const capturedId = matchPcResult.id || matchPcResult.print_condition_id;
        console.info('[PrintCondition] Captured print condition ID from match RPC:', capturedId);
        
        const processedData = {
          id: capturedId,
          name: matchPcResult.name,
          print_process: matchPcResult.print_process || matchPcResult.process_name || matchPcResult.printing_process,
          substrate_type: matchPcResult.substrate_type_name || matchPcResult.substrate_type || matchPcResult.substrate_name,
          material_type: matchPcResult.substrate_material_name || matchPcResult.material_type || matchPcResult.material_name,
          print_side: matchPcResult.printing_side || matchPcResult.print_side,
          pack_type: matchPcResult.pack_type || matchPcResult.pack_type_name,
        };
        
        console.info('[PrintCondition] Processed data from match RPC:', processedData);
        
        setActualPrintCondition(processedData);
        
        // Also update pcDetails to use the same data
        setPcDetails({
          ...processedData,
          print_condition_id: capturedId,
          substrate_material: processedData.material_type
        });
        return;
      } else {
        console.warn('[PrintCondition] Match RPC failed or returned no data:', matchPcError);
      }

      // Second try: Use shared print condition details RPC with name
      if (matchRequest?.print_condition) {
        console.info('[PrintCondition] Trying shared RPC with name:', matchRequest.print_condition);
        const { data: sharedData, error: sharedError } = await supabase
          .rpc('get_shared_print_condition_details', {
            p_print_condition_name: matchRequest.print_condition,
            p_match_request_id: matchId
          });

        const sharedResult = Array.isArray(sharedData) ? sharedData[0] : sharedData;
        
        console.info('[PrintCondition] Shared RPC response:', { sharedData, sharedError });
        
        if (sharedResult && !sharedError) {
          console.info('[PrintCondition] Successfully fetched via shared RPC:', sharedResult);
          
          const processedData = {
            id: sharedResult.id || sharedResult.print_condition_id,
            name: sharedResult.name || sharedResult.print_condition_name,
            print_process: sharedResult.print_process || sharedResult.process_name || sharedResult.printing_process,
            substrate_type: sharedResult.substrate_type_name || sharedResult.substrate_type || sharedResult.substrate_name,
            material_type: sharedResult.substrate_material_name || sharedResult.material_type || sharedResult.material_name,
            print_side: sharedResult.printing_side || sharedResult.print_side,
            pack_type: sharedResult.pack_type || sharedResult.pack_type_name,
          };
          
          console.info('[PrintCondition] Processed data from shared RPC:', processedData);
          
          setActualPrintCondition(processedData);
          setPcDetails({
            ...processedData,
            print_condition_id: processedData.id,
            substrate_material: processedData.material_type
          });
          return;
        }
        console.warn('[PrintCondition] Shared RPC failed:', sharedError);
      }

      // Final fallback: if we have a print_condition_id, try the core RPC
      if (matchRequest?.print_condition_id) {
        console.info('[PrintCondition] Trying core RPC with ID:', matchRequest.print_condition_id);
        const { data: coreData, error: coreError } = await supabase
          .rpc('get_print_condition_core', {
            p_print_condition_id: matchRequest.print_condition_id,
          });

        const coreResult = Array.isArray(coreData) ? coreData[0] : coreData;
        if (coreResult && !coreError) {
          console.info('[PrintCondition] Successfully fetched via core RPC:', coreResult);
          
          const processedData = {
            id: coreResult.id || coreResult.print_condition_id,
            name: coreResult.name,
            print_process: coreResult.print_process || coreResult.printing_process,
            substrate_type: coreResult.substrate_name,
            material_type: coreResult.material_type,
            print_side: coreResult.print_side || coreResult.printing_side,
            pack_type: coreResult.pack_type,
          };
          
          setActualPrintCondition(processedData);
          setPcDetails({
            ...processedData,
            print_condition_id: processedData.id,
            substrate_material: processedData.material_type
          });
          return;
        }
        console.warn('[PrintCondition] Core RPC failed:', coreError);
      }

      // FALLBACK 3a: Direct database query by ID (with valid relations only)
      if (matchRequest?.print_condition_id) {
        console.info('[PrintCondition] FALLBACK 3a: Trying direct DB by ID:', matchRequest.print_condition_id);
        const { data: directById, error: directByIdError } = await supabase
          .from('print_conditions')
          .select(`
            id,
            name,
            print_process,
            printing_side,
            pack_type,
            substrate_types(name),
            substrate_materials(name)
          `)
          .eq('id', matchRequest.print_condition_id)
          .maybeSingle();

        console.info('[PrintCondition] Direct-by-ID response:', { directById, directByIdError });

        if (directById && !directByIdError) {
          const processedData = {
            id: directById.id,
            name: directById.name,
            print_process: directById.print_process,
            substrate_type: directById.substrate_types?.name,
            material_type: directById.substrate_materials?.name,
            print_side: directById.printing_side,
            pack_type: directById.pack_type,
          };

          setActualPrintCondition(processedData);
          setPcDetails({
            ...processedData,
            print_condition_id: processedData.id,
            substrate_material: processedData.material_type
          });
          return;
        } else {
          console.warn('[PrintCondition] Direct-by-ID query failed:', directByIdError?.message || directByIdError);
        }
      }

      // FALLBACK 3b: Direct database query by name (with valid relations only)
      if (matchRequest?.print_condition) {
        console.info('[PrintCondition] FALLBACK 3b: Trying direct database query for name:', matchRequest.print_condition);
        const { data: directData, error: directError } = await supabase
          .from('print_conditions')
          .select(`
            id,
            name,
            print_process,
            printing_side,
            pack_type,
            substrate_types(name),
            substrate_materials(name)
          `)
          .eq('name', matchRequest.print_condition)
          .limit(1)
          .maybeSingle();

        if (directData && !directError) {
          console.info('[PrintCondition] SUCCESS: Fetched via direct query (name):', directData);
          
          const processedData = {
            id: directData.id,
            name: directData.name,
            print_process: directData.print_process,
            substrate_type: directData.substrate_types?.name,
            material_type: directData.substrate_materials?.name,
            print_side: directData.printing_side,
            pack_type: directData.pack_type,
          };
          
          setActualPrintCondition(processedData);
          setPcDetails({
            ...processedData,
            print_condition_id: processedData.id,
            substrate_material: processedData.material_type
          });
          return;
        } else {
          console.warn('[PrintCondition] Direct query (name) failed:', directError?.message || directError);
        }
      }

      // If all methods fail, log and set null
      console.warn('[PrintCondition] All fetch attempts failed, no print condition details available');
      setActualPrintCondition((prev) => prev || null);
    } catch (err) {
      console.error('Error fetching print condition details:', err);
      setActualPrintCondition((prev) => prev || null);
    } finally {
      setIsLoadingActualPrintCondition(false);
    }
  }, [pcFetchKey, matchId, matchRequest, matchMeasurement]);

  useEffect(() => {
    fetchActualPrintCondition();
  }, [fetchActualPrintCondition]);

  // When expanding the panel, ensure details are fetched at least once
  useEffect(() => {
    if (isPrintConditionExpanded && !actualPrintCondition && !isLoadingActualPrintCondition) {
      fetchActualPrintCondition();
    }
  }, [isPrintConditionExpanded, actualPrintCondition, isLoadingActualPrintCondition, fetchActualPrintCondition]);

  return (
    <aside className="flex-shrink-0 h-full min-h-0 flex flex-col">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 h-full min-h-0 flex flex-col">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Details</h3>
        
        <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col flex-grow min-h-0">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="info">Match Info</TabsTrigger>
            <TabsTrigger value="quality">Match Quality</TabsTrigger>
          </TabsList>
          
          <TabsContent value="info" className="mt-4 flex-grow h-full min-h-0 overflow-hidden">
            <ScrollArea className="h-full pr-2">
              <div className="space-y-3">
                 {/* Editable Match Name */}
                 <div className="space-y-2">
                   <label className="text-sm font-medium text-gray-700">Match Name</label>
                   {isEditingName ? (
                     <div className="relative">
                       <Input 
                         value={editedName}
                         onChange={(e) => setEditedName(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter') handleNameSave();
                           if (e.key === 'Escape') handleNameCancel();
                         }}
                         autoFocus
                         className="pr-16"
                       />
                       <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                         <button 
                           onClick={handleNameSave}
                           className="text-green-600 hover:text-green-700 p-1"
                           title="Save changes"
                         >
                           <Check className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={handleNameCancel}
                           className="text-gray-400 hover:text-gray-600 p-1"
                           title="Cancel changes"
                         >
                           <div className="flex gap-0.5">
                             <div className="w-1.5 h-1.5 bg-current rounded-full"></div>
                             <div className="w-1.5 h-1.5 bg-current rounded-full"></div>
                           </div>
                         </button>
                       </div>
                     </div>
                   ) : (
                     <div className="flex items-center justify-between p-2 border border-gray-200 rounded bg-white">
                       <span className="text-sm">{loadedMatch?.name || 'No match loaded'}</span>
                       {loadedMatch && (
                         <button 
                           onClick={() => setIsEditingName(true)}
                           className="text-gray-400 hover:text-gray-600 ml-2"
                         >
                           <Edit3 className="w-4 h-4" />
                         </button>
                       )}
                     </div>
                   )}
                 </div>

                  {/* Conditional fields based on user's organizational role */}
                   {userOrgId === matchRequest?.organization_id ? (
                    // Requestor view: show Partner information
                    <>
                      <DetailItem label="Partner" value={partnerOrg || matchRequest?.shared_with_org_name || matchRequest?.shared_with || matchRequest?.routed_to_org_name || matchRequest?.routed_to || 'N/A'} />
                      <DetailItem label="Partner Location" value={matchRequest?.shared_with_location_name || 'N/A'} />
                    </>
                  ) : (
                     // Shared-with or routed-to org view: show Requestor information and routing details
                     <>
                       <DetailItem label="Requested by" value={requestorOrg || matchRequest?.requestor_organization_name || matchRequest?.requestor_org_name || 'N/A'} />
                       
                       {/* Show "Matched by" only when applicable */}
                       {(matchMeasurement?.is_routed || matchRequest?.is_routed) ? (
                         // If routed, show routed-to org as "Matched by"
                         <DetailItem label="Matched by" value={routedToOrg || matchRequest?.routed_to_org_name || matchRequest?.routed_to || 'N/A'} />
                       ) : userOrgId === matchRequest?.shared_with_org_id && (
                         // If not routed and we're the shared-with org, show our own name or matched-by name
                         <DetailItem label="Matched by" value={matchedByName} />
                       )}
                       
                       {/* Show location based on who created the match */}
                       <DetailItem 
                         label="Location" 
                         value={(matchMeasurement?.is_routed || matchRequest?.is_routed) 
                           ? (routedToLocation || matchRequest?.routed_to_location_name || 'N/A')
                           : (resolvedLocation || matchMeasurement?.match_location || matchRequest?.shared_with_location_name || matchRequest?.location_name || matchRequest?.location || 'N/A')
                         } 
                       />
                     </>
                  )}
                   <DetailItem label="Print Condition" value={actualPrintCondition?.name || pcDetails?.name || matchRequest?.print_condition_name || matchRequest?.print_condition || 'N/A'} />
                 <DetailItem label="Job ID" value={matchRequest?.match_request_name || matchRequest?.job_id || 'N/A'} />
                 {matchRequest?.due_date && (
                   <DetailItem label="Due Date" value={new Date(matchRequest.due_date).toLocaleDateString()} />
                 )}
                 {matchRequest?.project_id && (
                   <DetailItem label="Product ID" value={matchRequest.project_id} />
                 )}
            
            {/* Print Condition Details Box */}
            {(pcDetails || isPcLoading || actualPrintCondition || isLoadingActualPrintCondition || matchRequest?.print_condition || matchRequest?.print_condition_name) && (
              <div className="mt-4 border border-gray-200 rounded-lg bg-white">
                <button
                  onClick={() => setIsPrintConditionExpanded(!isPrintConditionExpanded)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors rounded-t-lg"
                >
                  <div className="flex items-center">
                    <h4 className="text-sm font-semibold text-gray-700">Print Condition Details</h4>
                    {(isPcLoading || isLoadingActualPrintCondition) && <Loader2 className="w-3 h-3 ml-2 animate-spin" />}
                  </div>
                  {isPrintConditionExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                </button>
                
                {isPrintConditionExpanded && (
                  <div className="border-t border-gray-200">
                    <ScrollArea className="max-h-64 p-3">
                      {isPcLoading || isLoadingActualPrintCondition ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading print condition details...
                        </div>
                        ) : actualPrintCondition ? (
                          <div className="space-y-2">
                            <DetailItem 
                              label="Print Process" 
                              value={actualPrintCondition.print_process || matchMeasurement?.match_print_process || matchRequest?.print_process || 'N/A'} 
                            />
                            <DetailItem 
                              label="Substrate Type" 
                              value={actualPrintCondition.substrate_type || matchMeasurement?.match_substrate || matchRequest?.substrate_type || 'N/A'} 
                            />
                            <DetailItem 
                              label="Material Type" 
                              value={actualPrintCondition.material_type || matchRequest?.material_type || 'N/A'} 
                            />
                            <DetailItem 
                              label="Print Side" 
                              value={actualPrintCondition.print_side || matchRequest?.print_side || matchRequest?.printing_side || 'N/A'} 
                            />
                            <DetailItem 
                              label="Pack Type" 
                              value={actualPrintCondition.pack_type || matchRequest?.pack_type || 'N/A'} 
                            />
                          </div>
                       ) : pcDetails && !pcDetails.error ? (
                        <div className="space-y-2">
                          <DetailItem 
                            label="Print Process" 
                            value={pcDetails.print_process || 'N/A'} 
                          />
                          <DetailItem 
                            label="Substrate Type" 
                            value={pcDetails.substrate_type || 'N/A'} 
                          />
                          <DetailItem 
                            label="Substrate Material" 
                            value={pcDetails.material_type || pcDetails.substrate_material || 'N/A'} 
                          />
                          <DetailItem 
                            label="Print Side" 
                            value={pcDetails.printing_side || 'N/A'} 
                          />
                          <DetailItem 
                            label="Pack Type" 
                            value={pcDetails.pack_type || 'N/A'} 
                          />
                        </div>
                      ) : (
                        <div className="space-y-2 text-sm text-gray-700">
                          {isLoadingActualPrintCondition ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Loading print condition details...
                            </div>
                          ) : actualPrintCondition ? (
                            <>
                              <DetailItem 
                                label="Print Process" 
                                value={actualPrintCondition.print_process || matchMeasurement?.match_print_process || matchRequest?.print_process || 'N/A'} 
                              />
                              <DetailItem 
                                label="Substrate Type" 
                                value={actualPrintCondition.substrate_type || matchMeasurement?.match_substrate || matchRequest?.substrate_type || 'N/A'} 
                              />
                              <DetailItem 
                                label="Material Type" 
                                value={actualPrintCondition.material_type || matchRequest?.material_type || 'N/A'} 
                              />
                              <DetailItem 
                                label="Print Side" 
                                value={actualPrintCondition.print_side || matchRequest?.print_side || matchRequest?.printing_side || 'N/A'} 
                              />
                              <DetailItem 
                                label="Pack Type" 
                                value={actualPrintCondition.pack_type || matchRequest?.pack_type || 'N/A'} 
                              />
                            </>
                          ) : (
                            <div className="text-sm text-gray-500">
                              No print condition has been set for this match request.
                            </div>
                          )}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
                
                {matchRequest?.related_artwork_id && (
                  <DetailItem label="Related Artwork ID" value={matchRequest.related_artwork_id} />
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="quality" className="mt-4 flex-grow overflow-hidden h-full min-h-0">
            <div className="h-full flex flex-col">
              <div className="text-sm text-muted-foreground mb-4 flex-shrink-0">
                Quality assessment based on configured quality sets and comprehensive color metrics
              </div>
              
              {/* Comprehensive Quality Metrics Table */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full pr-2">
                  {isLoadingQuality && !qualityResults ? (
                    <div className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <div className="text-sm text-muted-foreground">
                          Calculating quality assessment...
                        </div>
                      </div>
                    </div>
                  ) : qualityResults ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Quality Assessment</h4>
                        {isLoadingQuality && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Updating...
                          </span>
                        )}
                      </div>
                      <QualityMetricsTable 
                        qualityResults={qualityResults} 
                        currentMeasurementSettings={measurementControls}
                        liveColorMetrics={colorMetrics}
                      />
                    </div>
                   ) : (
                      <div className="border border-gray-200 rounded-lg p-4 bg-white">
                        <div className="text-sm text-muted-foreground space-y-2">
                          <div>
                            {!loadedMatch 
                              ? 'Please load a color match to see Match Quality results.' 
                              : 'No quality assessment available.'}
                          </div>
                          {loadedMatch && (
                            <div className="text-xs">
                              {!selectedColor ? 'No reference color selected.' :
                               !colorMetrics?.referenceLab ? 'No reference Lab values available.' :
                               !qualitySet ? 'No quality set configured for this match request.' :
                               'Quality assessment calculation failed.'}
                            </div>
                          )}
                       </div>
                     </div>
                   )}
                </ScrollArea>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Status indicator at bottom */}
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Status</h3>
          <div className="border border-gray-200 rounded-lg p-3 bg-white">
            <div className="flex items-center gap-2">
              {(() => {
                // Build measurement object for proper status derivation
                const measurement = {
                  match_measurement_state: matchMeasurement?.match_measurement_state || 'empty',
                  is_routed: matchMeasurement?.is_routed || selectedColor?.is_routed || false,
                  ...matchMeasurement
                };
                const statusInfo = getColorMatchStatusForOrg(null, matchRequest, userOrgId, measurement);
                return (
                  <>
                    <span className={statusInfo.color}>{statusInfo.icon}</span>
                    <span className={`text-sm font-medium ${statusInfo.color}`}>
                      {statusInfo.text}
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default DetailsSidebar;
