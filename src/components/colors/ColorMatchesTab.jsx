
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatePresence, motion } from 'framer-motion';

import { useProfile } from '@/context/ProfileContext';
import { debug } from '@/lib/debugUtils';
// import { useMatchStatusUpdater } from '@/hooks/useMatchStatusUpdater';
import { ProgressiveLoader } from '@/components/common/LoadingOptimizations';
import { computeDefaultDisplayColor, isValidDisplayColor, spectralToLabASTME308 } from '@/lib/colorUtils';
import { calculateDeltaE } from '@/lib/deltaE';
import { computeDynamicDisplayColor } from '@/lib/objectSpecificColorCalculation';

import SimilarReferencePanel from '@/components/similar-colors/SimilarReferencePanel';
import MatchesList from '@/components/match-analysis/MatchesList';
import SimilarAnalysisPanel from '@/components/similar-colors/SimilarAnalysisPanel';
// Quality assessment now handled by enhanced RPC
import { useMatchesFilters } from '@/hooks/useMatchesFilters';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';

const ColorMatchesTab = ({ color, controls, setControls, standards, activeDataMode }) => {
    debug.log('ColorMatchesTab rendered for color:', color?.id);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMatchId, setSelectedMatchId] = useState(null);
    const [referenceLab, setReferenceLab] = useState(null);
    const [filteredMatchIds, setFilteredMatchIds] = useState([]); // Track filtered IDs to avoid stale objects
    const [selectedStatsRow, setSelectedStatsRow] = useState(null); // For stats-to-list connection
    const [deltaEType, setDeltaEType] = useState('dE00');
    const [threshold, setThreshold] = useState(3.0);
    const { profile } = useProfile();
    // const { rematchBySharedWith, setMatchState } = useMatchStatusUpdater();
    
    // Use centralized ASTM table cache to avoid redundant fetches
    const { astmTables, loading: astmLoading } = useAstmTablesCache();
    
    // Lightweight local fallbacks to avoid hook conflicts
    const rematchBySharedWith = async (measurementId, onSuccess) => {
      console.warn('[ColorMatchesTab] rematchBySharedWith called (fallback)');
      onSuccess?.();
    };
    const setMatchState = async (measurementId, targetState, onSuccess) => {
      console.warn('[ColorMatchesTab] setMatchState called (fallback)', { measurementId, targetState });
      onSuccess?.();
    };
    
    // Get organization defaults for color computation
    const orgDefaults = profile?.organization || {};
    
    // Filter hook for matches
    const {
        filters,
        setPrintSupplier,
        setPrintCondition,
        clearFilters,
        applyFilters,
        generateFilterOptions,
        isFilterActive
    } = useMatchesFilters();

    const handleFilteredMatchesChange = useCallback((filteredIds) => {
        // Store only IDs to avoid stale object references
        const ids = (filteredIds || [])
          .map(item => typeof item === 'string' ? item : item?.id)
          .filter(Boolean);
        setFilteredMatchIds(ids);
    }, []);

    const handleStatsRowSelect = useCallback((statsRow) => {
        setSelectedStatsRow(statsRow);
    }, []);

    const handleReferenceLabUpdate = useCallback((labUpdate) => {
        debug.log('ColorMatchesTab - Reference Lab update received:', labUpdate);
        setReferenceLab(labUpdate.lab);
    }, []);

    const handleSelectSimilar = useCallback((matchId) => {
        setSelectedMatchId(prev => prev === matchId ? null : matchId);
    }, []);

    // Memoize expensive calculations
    const labCalculator = useMemo(() => {
        const isValidNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) !== 0;
        const calculateLabFromMatch = (match) => {
            // Priority: database columns -> JSON lab -> spectral -> hex
            if (isValidNum(match.lab_l) && isValidNum(match.lab_a) && isValidNum(match.lab_b)) {
                return { L: Number(match.lab_l), a: Number(match.lab_a), b: Number(match.lab_b) };
            }
            
            if (match.matched_color_data?.lab) {
                const labData = match.matched_color_data.lab;
                const calculatedL = Number(labData.L ?? labData.l);
                const calculatedA = Number(labData.A ?? labData.a);
                const calculatedB = Number(labData.B ?? labData.b);
                if (Number.isFinite(calculatedL) && Number.isFinite(calculatedA) && Number.isFinite(calculatedB)) {
                    return { L: calculatedL, a: calculatedA, b: calculatedB };
                }
            }
            
            // NOTE: Removed hex-to-Lab fallback and spectral conversion fallback
            // Only authentic colorimetric data should be used for quality assessment
            // If no direct Lab data is available, return null to indicate missing data
            
            return null;
        };
        return { isValidNum, calculateLabFromMatch };
    }, []);

    // Helper to determine user's role in the match request context
    const getUserRole = useCallback((matchRequest) => {
        if (!matchRequest || !profile?.organization_id) {
            return 'unknown';
        }

        const userOrgId = profile.organization_id;
        
        // Check if user is the requestor (owner)
        if (matchRequest.organization_id === userOrgId) {
            return 'requestor';
        }
        
        // Check if user is routed-to (new recipient after routing) - use UUID first
        if (matchRequest.routed_to_org_id === userOrgId) {
            return 'routed-to';
        }
        
        // Check if user is the receiver (original shared_with) - use UUID first
        if (matchRequest.shared_with_org_id === userOrgId) {
            // If there's routing, this is the original receiver who became router
            if (matchRequest.routed_to_org_id) {
                return 'router';
            }
            return 'receiver';
        }
        
        // Fallback: Try name-based matching for backward compatibility
        const orgName = profile?.organization_name || profile?.organization?.name;
        if (orgName) {
            if (matchRequest.shared_with && 
                matchRequest.shared_with.toLowerCase().trim() === orgName.toLowerCase().trim()) {
                if (matchRequest.routed_to_org_id || matchRequest.routed_to) {
                    return 'router';
                }
                return 'receiver';
            }
            
            if (matchRequest.routed_to && 
                matchRequest.routed_to.toLowerCase().trim() === orgName.toLowerCase().trim()) {
                return 'routed-to';
            }
        }
        
        return 'unknown';
    }, [profile]);

    // Apply filters to matches
    const displayMatches = useMemo(() => {
        return applyFilters(matches);
    }, [matches, applyFilters]);

    // Derive filtered matches from current matches using stored IDs to keep them fresh on realtime updates
    const filteredMatches = useMemo(() => {
        if (!filteredMatchIds?.length) return [];
        const idSet = new Set(filteredMatchIds);
        return matches.filter(m => idSet.has(m.id));
    }, [matches, filteredMatchIds]);

    // Fetch color matches using the same RPC as the working detail page
    const fetchColorMatches = useCallback(async () => {
        if (!color?.id) {
            setLoading(false);
            return;
        }

        // Prevent overlapping fetch operations
        if (fetchColorMatches._isRunning) {
            return;
        }
        fetchColorMatches._isRunning = true;

        setLoading(true);
        debug.time('fetchColorMatches');

        try {
            // 1) Find match requests that include this specific color (previous working approach)
            const { data: matchMeasurements, error: measurementsError } = await supabase
                .from('match_measurements')
                .select('match_request_id')
                .eq('color_id', color.id);

            if (measurementsError) {
                throw new Error(`Could not fetch match measurements: ${measurementsError.message}`);
            }

            if (!matchMeasurements?.length) {
                setMatches([]);
                return;
            }

            const matchRequestIds = [...new Set(matchMeasurements.map(m => m.match_request_id))];

            // PHASE 1 OPTIMIZATION: Single RPC call instead of duplicate calls
            // Fetch match request details once
            const matchRequestsData = await Promise.all(
                matchRequestIds.map(async (requestId) => {
                    try {
                        const { data, error } = await supabase.rpc('get_match_request_details', { p_match_request_id: requestId });
                        if (error) {
                            debug.warn(`Error fetching match request ${requestId}:`, error);
                            return null;
                        }
                        return data;
                    } catch (err) {
                        debug.warn(`Error fetching match request ${requestId}:`, err);
                        return null;
                    }
                })
            );

            // Extract organization IDs from the RPC result (already contains org names)
            const orgIds = Array.from(new Set(
                matchRequestsData
                    .filter(Boolean)
                    .flat()
                    .filter(Boolean)
                    .flatMap(mr => [mr.shared_with_org_id, mr.routed_to_org_id])
                    .filter(Boolean)
            ));
            
            // Only fetch org data if we have IDs
            let organizationsData = [];
            if (orgIds.length > 0) {
                const { data: orgRows } = await supabase
                    .from('organizations')
                    .select('id, name')
                    .in('id', orgIds);
                organizationsData = orgRows || [];
            }

            // Normalize RPC rows (array) into aggregated matchRequest objects with colors[]
            const normalizeMatchRequest = (rows) => {
                if (!Array.isArray(rows) || rows.length === 0) return null;
                const first = rows[0] || {};
                return {
                    id: first.match_request_id,
                    name: first.match_request_name,
                    status: first.match_request_status,
                    created_at: first.match_request_created_at,
                    updated_at: first.match_request_updated_at,
                    organization_id: first.match_request_organization_id,
                    organization_name: first.match_request_organization_name,
                    // Include IDs and names for robust org lookup
                    shared_with_org_id: first.shared_with_org_id || null,
                    routed_to_org_id: first.routed_to_org_id || null,
                    shared_with_org_name: first.shared_with_org_name || null,
                    routed_to_org_name: first.routed_to_org_name || null,
                    requestor_org_name: first.requestor_org_name || null,
                    // Also keep legacy text fields for fallback
                    shared_with: first.shared_with || first.shared_with_org_name || null,
                    location_name: first.location_name || null,
                    location: first.location || first.match_request_location || first.location_name || null,
                    job_id: first.job_id || null,
                    print_condition: first.match_request_print_condition,
                    print_condition_name: first.print_condition_name || first.match_request_print_condition,
                    print_process: first.print_condition_print_process || first.match_request_print_process,
                    substrate: first.print_condition_substrate || first.match_request_substrate,
                    quality_set_id: first.match_request_quality_set_id,
                    quality_set: first.quality_set,
                    colors: rows.map(r => {
                        const mm = r.match_measurement || {};
                        const colorId = mm.color_id || r.match_request_color_id || null;
                        return {
                            id: colorId,
                            color_id: colorId,
                            hex: r.match_request_color_hex || mm.matched_hex || null,
                            lab_l: mm.lab_l ?? mm.lab?.L ?? null,
                            lab_a: mm.lab_a ?? mm.lab?.a ?? mm.lab?.A ?? null,
                            lab_b: mm.lab_b ?? mm.lab?.b ?? mm.lab?.B ?? null,
                            resolved_lab: mm.resolved_lab ?? null,
                            reference_lab: mm.reference_lab ?? null,
                            quality_results: mm.quality_results ?? null,
                            primary_quality_result: mm.primary_quality_result ?? null,
                            match_measurement: mm,
                            measurement_id: mm.id,
                            status: mm.status || null,
                        };
                    })
                };
            };

            const validMatchRequests = matchRequestsData
                .map(item => Array.isArray(item) ? normalizeMatchRequest(item) : (item?.match_request || item))
                .filter(Boolean);

            // Organizations already fetched in parallel above
            const orgNameById = Object.fromEntries((organizationsData || []).map(o => [o.id, o.name]));

            // 5) Fetch quality sets for match measurements (targeted fetch to satisfy RLS)
            const uniqueQualitySetIds = [...new Set(
                validMatchRequests
                    .flatMap(mr => mr.colors || [])
                    .map(c => c.match_measurement?.quality_set_id)
                    .filter(Boolean)
            )];

            let qualitySets = [];
            if (uniqueQualitySetIds.length > 0) {
                const { data: qsData, error: qsError } = await supabase
                    .from('quality_sets')
                    .select('id, name')
                    .in('id', uniqueQualitySetIds);

                if (qsError) {
                    debug.warn('Error fetching quality sets:', qsError);
                } else {
                    qualitySets = qsData || [];
                    debug.log(`✅ Fetched ${qualitySets.length} quality sets for ${uniqueQualitySetIds.length} unique IDs`);
                }
            }

            const processedMatches = [];

            // Wait for ASTM tables before processing matches to prevent flash
            if (!astmTables?.length) {
                setMatches([]);
                setLoading(false);
                return;
            }

            // OPTIMIZATION: Fetch ALL reference measurements in ONE query (eliminates N+1)
            const uniqueColorIds = [...new Set(validMatchRequests.flatMap(mr => 
                (mr.colors || []).map(c => c.color_id || c.id)
            ).filter(Boolean))];

            const { data: allReferenceMeasurements } = await supabase
                .from('color_measurements')
                .select('color_id, spectral_data, lab, mode, illuminant, observer')
                .in('color_id', uniqueColorIds)
                .eq('tint_percentage', 100)
                .order('created_at', { ascending: false });

            // Create lookup map for O(1) access
            const refMeasurementMap = new Map();
            allReferenceMeasurements?.forEach(rm => {
                if (!refMeasurementMap.has(rm.color_id)) {
                    refMeasurementMap.set(rm.color_id, rm);
                }
            });

            for (const matchRequest of validMatchRequests) {
                const colorsInRequest = matchRequest.colors || [];
                const colorInRequest = colorsInRequest.find(c => (c.color_id || c.id) === color.id);
                
                if (!colorInRequest) continue;
                
                // Org name will be resolved later via orgNameById and fallbacks when building the match object

                // Use pre-fetched reference measurement (from map instead of individual query)
                const refMeasurement = refMeasurementMap.get(color.id);

                // Use enhanced RPC data for Lab and quality assessment
                const resolvedLab = colorInRequest.resolved_lab;
                const qualityResults = colorInRequest.quality_results;
                const primaryQualityResult = colorInRequest.primary_quality_result;
                
        // Extract match measurement data with spectral
        const mm = colorInRequest.match_measurement || {};

        // Extract measurements array and filter by current mode
        const matchMeasurements = mm?.measurements || [];
        
        // Use default mode 'M0' if controls.mode is undefined/null
        const effectiveMode = controls.mode || 'M0';
        
        console.log('[ColorMatchesTab] Spectral extraction debug:', {
          effectiveMode,
          controlsMode: controls.mode,
          availableModes: matchMeasurements.map(m => m.mode),
          hasRootSpectral: !!mm?.spectral_data,
          measurementCount: matchMeasurements.length
        });
        
        const currentModeData = matchMeasurements.find(m => {
          const mMode = String(m.mode || '').trim().toUpperCase();
          const controlMode = String(effectiveMode || '').trim().toUpperCase();
          return mMode === controlMode;
        });
        
        console.log('[ColorMatchesTab] Mode matching result:', {
          found: !!currentModeData,
          hasSpectralInMatch: !!currentModeData?.spectral_data
        });

        // Priority: mode-specific spectral > root spectral > null
        const matchSpectralData = currentModeData?.spectral_data || 
                                  mm?.spectral_data || 
                                  null;
        
        console.log('[ColorMatchesTab] Final spectral data result:', {
          available: !!matchSpectralData,
          source: currentModeData?.spectral_data ? 'mode-specific' : 
                  mm?.spectral_data ? 'root-level' : 'none'
        });
                
                debug.log(`Match ${matchRequest.id}: Enhanced RPC data`, { 
                    labSource: resolvedLab?.source, 
                    hasQuality: !!qualityResults,
                    hasPrimary: !!primaryQualityResult 
                });
                
                // Enhanced process field extraction with fallbacks
                const extractProcess = () => {
                    // Priority: colorInRequest match_measurement -> request.print_process
                    if (colorInRequest.match_measurement?.match_print_process) return colorInRequest.match_measurement.match_print_process;
                    if (matchRequest.print_process) return matchRequest.print_process;
                    if (matchRequest.print_condition_print_process) return matchRequest.print_condition_print_process;
                    
                    // Extract first word from print_condition_name as fallback
                    const printCondition = matchRequest.print_condition_name || matchRequest.print_condition;
                    if (printCondition) {
                        const firstWord = printCondition.split(/[\s\-_]+/)[0];
                        if (firstWord && firstWord.length > 0) return firstWord;
                    }
                    
                    return 'N/A';
                };

                // Get quality set name - prioritize RPC data and mm.quality_set_id
                const qualitySetId = mm.quality_set_id || colorInRequest.quality_set_id || matchRequest.quality_set_id;
                const qualitySetName = qualityResults?.quality_set_name || 
                                     qualitySets?.find(qs => qs.id === qualitySetId)?.name || 
                                     'N/A';

                // Compute sample_color_hex dynamically - only use spectral computation, no stored hex fallback
                let computedHex = null;
                if (mm && astmTables?.length) {
                  const result = computeDefaultDisplayColor(mm, orgDefaults, astmTables, activeDataMode, matchSpectralData);
                  computedHex = result?.hex;
                }

                // Use computed hex or neutral placeholder - no stored hex fallback to prevent flash
                const finalHex = isValidDisplayColor(computedHex) ? computedHex : '#E5E7EB';

                // Build match object with enhanced RPC data + spectral data
                const match = {
                    id: mm?.id || colorInRequest.measurement_id || `${matchRequest.job_id}-${color.id}-${mm?.mode || 'M0'}`,
                    measurement_id: colorInRequest.measurement_id, // Actual UUID for backend operations
                    match_request_id: matchRequest.id,
                    color_id: color.id,
                    matched_by_name:
                        orgNameById[matchRequest.shared_with_org_id]
                        || matchRequest.shared_with_org_name
                        || orgNameById[matchRequest.routed_to_org_id]
                        || matchRequest.routed_to_org_name
                        || ((mm.matched_by_name && mm.matched_by_name !== 'Unknown') ? mm.matched_by_name : null)
                        || matchRequest.shared_with
                        || null,
                    organization_id: matchRequest.organization_id,
                    job_id: matchRequest.job_id,
                    match_location:
                        (colorInRequest.match_measurement?.match_location)
                        || matchRequest.location_name
                        || matchRequest.location
                        || mm.match_location
                        || null,
                    match_print_condition: matchRequest.print_condition_name || matchRequest.print_condition, // Correct field name
                    print_condition_print_process: extractProcess(), // Enhanced "Process" column
                    quality_set_name: qualitySetName, // For "Quality Set" column
                    status: colorInRequest.status || 'New',
                    created_at: matchRequest.date_shared || matchRequest.created_at,

                    // Lab values from enhanced RPC data
                    target_color_lab_l: colorInRequest.lab_l,
                    target_color_lab_a: colorInRequest.lab_a,
                    target_color_lab_b: colorInRequest.lab_b,
                    lab_l: mm?.lab_l || colorInRequest.lab_l,
                    lab_a: mm?.lab_a || colorInRequest.lab_a,
                    lab_b: mm?.lab_b || colorInRequest.lab_b,

                    // Enhanced RPC data
                    resolved_lab: resolvedLab,
                    quality_results: qualityResults,
                    primary_quality_result: primaryQualityResult,

                    // Spectral data for reactive calculations
                    reference_spectral_data: refMeasurement?.spectral_data || null,
                    matched_spectral_data: matchSpectralData,
                    spectral_data: matchSpectralData, // Alias for consistency
                    
                    // Reference Lab with per-row fallback
                    reference_lab: colorInRequest.reference_lab || {
                        L: refMeasurement?.lab?.L,
                        a: refMeasurement?.lab?.a,
                        b: refMeasurement?.lab?.b
                    },
                    
                    // Matched color data for fallbacks
                    matched_color_data: mm?.matched_color_data || null,
                    measurements: mm?.measurements || [],

                    quality_set_id: mm?.quality_set_id || qualitySetId,
                    match_measurement_state: colorInRequest.match_measurement_state || 'empty',
                    sample_color_hex: finalHex,

                    // Provide full color object as reference for proper deltaE calculation
                    referenceColor: color,

                    // Optional: attach request summary for downstream fallbacks
                    matchRequestSummary: {
                      print_condition_name: matchRequest.print_condition_name || matchRequest.print_condition,
                      print_condition_print_process: extractProcess(),
                      quality_set_id: qualitySetId,
                      quality_set_name: qualitySetName,
                      routing_chain: matchRequest.routing_chain || [],
                      organization_id: matchRequest.organization_id,
                    },
                };

                debug.log(`Match ${matchRequest.id}: Enhanced RPC data used`, { 
                    hasLab: !!resolvedLab, 
                    hasQuality: !!qualityResults 
                });

                processedMatches.push(match);
            }

            debug.log('ColorMatchesTab - Sample mapped match:', processedMatches[0]);
            
            // Duplicate ID detection
            const idCounts = {};
            processedMatches.forEach(m => {
                idCounts[m.id] = (idCounts[m.id] || 0) + 1;
            });
            const duplicates = Object.entries(idCounts).filter(([_, count]) => count > 1);
            if (duplicates.length > 0) {
                debug.warn('ColorMatchesTab - Duplicate match IDs detected:', duplicates.map(([id, count]) => `${id} (${count}x)`));
            }
            
            setMatches(processedMatches);
            debug.log('ColorMatchesTab - Matches loaded:', processedMatches?.length || 0);
        } catch (error) {
            debug.error('Error fetching color matches:', error);
            toast({
                title: 'Error',
                description: 'Failed to load color matches. Please try again.',
                variant: 'destructive',
            });
            setMatches([]);
        } finally {
            setLoading(false);
            fetchColorMatches._isRunning = false;
        }
    }, [color, standards, profile, labCalculator, getUserRole]);

    useEffect(() => {
        if (color?.id) {
          fetchColorMatches();
        }
        
        const channel = supabase
            .channel(`color-matches-${color?.id}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'match_measurements', 
                filter: `color_id=eq.${color?.id}` 
            }, () => {
                // Debounce real-time updates to prevent rapid-fire refetches
                clearTimeout(fetchColorMatches._realtimeTimeout);
                fetchColorMatches._realtimeTimeout = setTimeout(fetchColorMatches, 500);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };

    }, [color, fetchColorMatches]);

    if (!color) {
        return <div>Color data not available.</div>;
    }

    return (
        <Card className="h-full">
            <CardContent className="p-4 h-full">
                <div className="flex-grow flex gap-2 overflow-hidden h-full">
                  <AnimatePresence>
            <motion.div 
              key="matches-section"
              className="w-2/3 flex min-h-0"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="h-full w-full flex overflow-hidden shadow-lg rounded-lg border bg-card min-h-0">
                 <div className="w-1/4 flex-shrink-0 min-h-0">
                    <SimilarReferencePanel 
                        color={color} 
                        controls={controls} 
                        standards={standards} 
                        activeDataMode={activeDataMode}
                        onLabUpdate={handleReferenceLabUpdate} 
                    />
                 </div>
                <div className="w-3/4 flex flex-col min-h-0">
                   <ProgressiveLoader
                     isLoading={loading || standards?.loading || astmLoading || !astmTables?.length}
                     delay={200}
                     skeleton={
                       <div className="p-4 space-y-4">
                         {Array.from({ length: 3 }).map((_, i) => (
                           <div key={i} className="border rounded-lg p-4 space-y-2 h-[120px]">
                             <div className="flex items-center space-x-3">
                               <Skeleton className="w-16 h-16 rounded" />
                               <div className="flex-1 space-y-2">
                                 <Skeleton className="h-4 w-3/4" />
                                 <Skeleton className="h-3 w-1/2" />
                                 <Skeleton className="h-3 w-2/3" />
                               </div>
                             </div>
                           </div>
                         ))}
                        </div>
                      }
                    >
                        <MatchesList
                          matches={filteredMatches.length > 0 ? filteredMatches : displayMatches}
                         selectedMatchId={selectedMatchId} 
                         onSelectMatch={setSelectedMatchId}
                         controls={controls}
                         referenceLab={referenceLab}
                         astmTables={astmTables}
                         activeDataMode={activeDataMode}
                         onShare={(match) => debug.log('Share match:', match)}
                         onApprove={(match) => {
                           debug.log('Approve match:', match);
                           fetchColorMatches(); // Refresh matches after approval
                         }}
                         onSendForApproval={(match) => {
                           debug.log('Send for approval match:', match);
                           fetchColorMatches(); // Refresh matches after sending for approval
                         }}
                          onRematchBySharedWith={async (match) => {
                            console.log('ColorMatchesTab - rematch requested for match:', match);
                            if (!match.measurement_id) {
                              toast({ description: 'Unable to rematch: measurement ID missing', variant: 'destructive' });
                              return;
                            }
                            try {
                              await rematchBySharedWith(match.measurement_id, () => {
                                fetchColorMatches(); // Refresh matches after rematch
                              });
                            } catch (error) {
                              toast({ description: 'Failed to request rematch', variant: 'destructive' });
                            }
                          }}
                          onSetState={async (measurementId, targetState) => {
                            console.log('ColorMatchesTab - state change requested:', { measurementId, targetState });
                            if (!measurementId) {
                              toast({ description: 'Unable to update state: measurement ID missing', variant: 'destructive' });
                              return;
                            }
                            try {
                              await setMatchState(measurementId, targetState, () => {
                                fetchColorMatches(); // Refresh matches after state change
                              });
                            } catch (error) {
                              toast({ description: 'Failed to update match state', variant: 'destructive' });
                            }
                          }}
                        isRequestor={(() => {
                          // Determine user role based on organization ownership
                          // If user owns the color (brand), they are requestor, otherwise they are partner
                          return color?.organization_id === profile?.organization_id;
                        })()}
                        controls={{
                          ...controls,
                          table: controls?.table || '5',
                          deltaE: controls?.deltaE || 'dE76'
                        }}
                        matchRequest={{
                          organization_id: color?.organization_id,
                          routing_chain: matches[0]?.matchRequestSummary?.routing_chain || matches[0]?.routing_chain || [],
                          print_condition_name: matches[0]?.match_print_condition || matches[0]?.matchRequestSummary?.print_condition_name,
                          print_condition_print_process: matches[0]?.print_condition_print_process || matches[0]?.matchRequestSummary?.print_condition_print_process,
                          quality_set_name: matches[0]?.quality_set_name || matches[0]?.matchRequestSummary?.quality_set_name
                        }}
                        selectedStatsRow={selectedStatsRow}
                         onStatsRowProcessed={() => setSelectedStatsRow(null)}
                        // Filter props
                        filters={filters}
                        onPrintSupplierChange={setPrintSupplier}
                        onPrintConditionChange={setPrintCondition}
                        onClearFilters={clearFilters}
                        filterOptions={generateFilterOptions(matches)}
                        isFilterActive={isFilterActive}
                        />
                   </ProgressiveLoader>
                </div>
              </div>
            </motion.div>
            <motion.div 
              key="similar-analysis"
              className="w-1/3 flex-shrink-0 min-h-0"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
            >
              {(() => {
                debug.log('ColorMatchesTab - Raw matches for SimilarAnalysisPanel:', displayMatches);
                
                // Get weighting table for spectral calculations
                const weightingTable = useMemo(() => {
                  if (!astmTables?.length || !controls) return [];
                  const illuminant = controls.illuminant || 'D50';
                  const observer = controls.observer || '2';
                  const tableNumber = parseInt(controls.table || '5', 10);
                  // Build full table (all wavelength rows) matching the selection
                  return astmTables.filter(
                    (t) =>
                      t.illuminant_name === illuminant &&
                      t.observer === observer &&
                      t.table_number === tableNumber
                  );
                }, [astmTables, controls]);
                
                const similarColors = displayMatches
                  .map(m => {
                    let labL, labA, labB;
                    
                    // PRIORITY 1: Compute using computeDynamicDisplayColor (handles all measurement settings)
                    const measurementControls = {
                      mode: controls?.mode || 'M0',
                      illuminant: controls?.illuminant || 'D50',
                      observer: controls?.observer || '2',
                      table: controls?.table || '5'
                    };

                    // Extract spectral data from the match
                    // Priority: matched_spectral_data > matched_color_data.spectralData > measurements[0].spectral_data
                    const extractedSpectralData = 
                      m.matched_spectral_data || 
                      m.matched_color_data?.spectralData || 
                      (m.measurements?.[0]?.spectral_data) ||
                      null;

                    console.log('[ColorMatchesTab] Spectral data extraction for match:', {
                      matchId: m.id,
                      hasMatchedSpectral: !!m.matched_spectral_data,
                      hasColorDataSpectral: !!m.matched_color_data?.spectralData,
                      hasMeasurementSpectral: !!m.measurements?.[0]?.spectral_data,
                      finalSpectral: !!extractedSpectralData
                    });

                    // Build a color-like object for the match
                    const matchColorObject = {
                      id: m.id,
                      from_ink_condition_id: m.from_ink_condition_id,
                      inkCondition: m.inkCondition,
                      measurements: m.measurements,
                      imported_tints: m.imported_tints,
                      adapted_tints: m.adapted_tints
                    };

                    const matchActiveDataMode = m.active_data_mode || m.ui_state?.active_data_mode || 'imported';

                    // Pass spectral data directly to computeDynamicDisplayColor via spectralDataOverride
                    const computedResult = computeDynamicDisplayColor(
                      matchColorObject,
                      orgDefaults,
                      astmTables,
                      measurementControls,
                      matchActiveDataMode,
                      extractedSpectralData // Pass spectral data as override
                    );

                    // ONLY use computeDynamicDisplayColor result - it handles spectral->Lab conversion
                    // On pages with ColorSettingsBox, Lab should ALWAYS be calculated from spectral dynamically
                    if (computedResult?.lab?.L != null && isFinite(computedResult.lab.L)) {
                      labL = computedResult.lab.L;
                      labA = computedResult.lab.a;
                      labB = computedResult.lab.b;
                      console.log('[ColorMatchesTab] ✓ Computed Lab from spectral using dynamic settings:', { 
                        matchId: m.id,
                        lab: computedResult.lab,
                        measurementControls 
                      });
                    } else {
                      // FALLBACK: Only for lab-only colors (no spectral data)
                      // Use stored Lab values if they exist and are valid (not 0,0,0)
                      const storedL = m.lab_l ?? m.target_color_lab_l;
                      const storedA = m.lab_a ?? m.target_color_lab_a;
                      const storedB = m.lab_b ?? m.target_color_lab_b;
                      
                      const isValidStoredLab = 
                        typeof storedL === 'number' && isFinite(storedL) &&
                        typeof storedA === 'number' && isFinite(storedA) &&
                        typeof storedB === 'number' && isFinite(storedB) &&
                        !(storedL === 0 && storedA === 0 && storedB === 0);
                      
                      if (isValidStoredLab) {
                        labL = storedL;
                        labA = storedA;
                        labB = storedB;
                        console.log('[ColorMatchesTab] ⚠ Used stored Lab (lab-only color):', { matchId: m.id, lab: { labL, labA, labB } });
                      } else {
                        console.error('[ColorMatchesTab] ✗ No valid Lab found for match:', {
                          matchId: m.id,
                          hasSpectral: !!extractedSpectralData,
                          hasStoredLab: isValidStoredLab,
                          computedResult: computedResult
                        });
                      }
                    }
                    
                    return {
                      id: m.id,
                      name: m.target_color_name || m.name || m.matched_by_name || m.job_id || 'Match',
                      lab_l: labL,
                      lab_a: labA,
                      lab_b: labB,
                      hex: m.target_color_hex || m.hex || m.sample_color_hex,
                      standard_type: m.standard_type || 'Custom',
                      referenceColor: m.referenceColor,
                      deltaE: (() => {
                        // Calculate deltaE using reference Lab and current match Lab
                        if (Number.isFinite(labL) && Number.isFinite(labA) && Number.isFinite(labB) && referenceLab) {
                          return calculateDeltaE(
                            referenceLab,
                            { L: labL, a: labA, b: labB },
                            deltaEType
                          );
                        }
                        return null;
                      })(),
                      // Match-specific data for analysis panel
                      spectralData: m.spectralData,
                      qualitySetName: m.qualitySetName,
                      matchState: m.match_measurement_state,
                      measurements: m.measurements,
                      // Spectral data for GMG ColorCard printing
                      spectral_data: extractedSpectralData,
                      illuminant: controls?.illuminant || 'D50',
                      observer: controls?.observer || '2'
                    };
                  })
                  .filter(m => {
                    // Only show matches with valid Lab data (spectral or lab-only)
                    // For match workflow: measured → saved → approved means spectral data MUST exist
                    const hasValidLab = 
                      typeof m.lab_l === 'number' && Number.isFinite(m.lab_l) &&
                      typeof m.lab_a === 'number' && Number.isFinite(m.lab_a) &&
                      typeof m.lab_b === 'number' && Number.isFinite(m.lab_b);
                    
                    if (!hasValidLab) {
                      debug.log('[ColorMatchesTab] Filtered out match without valid Lab:', {
                        matchId: m.id,
                        lab: { L: m.lab_l, a: m.lab_a, b: m.lab_b }
                      });
                    }
                    return hasValidLab;
                  });
                
                console.log('📊 SimilarColors for panel:', similarColors.length, 'first:', similarColors[0]);
                debug.log('ColorMatchesTab - Processed similarColors for SimilarAnalysisPanel:', similarColors);
                return (
                  <SimilarAnalysisPanel
                    masterColor={color}
                    similarColors={similarColors}
                    deltaEType={deltaEType}
                    referenceLab={referenceLab}
                    threshold={threshold}
                    selectedSimilarId={selectedMatchId}
                    onSelectSimilar={handleSelectSimilar}
                    illuminantKey={controls?.illuminant || 'D65'}
                    loading={loading}
                    onFilteredColorsChange={handleFilteredMatchesChange}
                    onStatsRowSelect={handleStatsRowSelect}
                    astmTables={astmTables}
                  />
                );
              })()}
            </motion.div>
                  </AnimatePresence>
                </div>
            </CardContent>
        </Card>
    );
};

const AnalysisSkeleton = () => (
    <div className="flex-grow flex p-1 gap-4 overflow-hidden h-[calc(100vh-250px)]">
        <div className="w-1/6"><Skeleton className="h-full w-full" /></div>
        <div className="w-1/2"><Skeleton className="h-full w-full" /></div>
        <div className="w-1/3"><Skeleton className="h-full w-full" /></div>
    </div>
);

export default ColorMatchesTab;
