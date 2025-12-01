import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { calculateDeltaE } from '@/lib/deltaE';
import { Skeleton } from '@/components/ui/skeleton';
import { spectralToLabASTME308, labToHexD65 } from '@/lib/colorUtils';
import { supabase } from '@/lib/customSupabaseClient';
import LoadingErrorBoundary from '@/components/LoadingErrorBoundary';

import SimilarReferencePanel from '@/components/similar-colors/SimilarReferencePanel';
import SimilarColorsList from '@/components/similar-colors/SimilarColorsList';
import SimilarAnalysisPanel from '@/components/similar-colors/SimilarAnalysisPanel';

const MAX_RESULTS = 50; // Limit results for performance

const InkConditionMatchesTab = ({ condition, controls, setControls, standards, referencePatch = null, onRequestAutoSelection, activeDataMode = 'imported' }) => {
    const { colors, loading } = useAppContext();
    
    const [deltaEType, setDeltaEType] = useState('dE76'); // Start with fastest calculation
    const [threshold, setThreshold] = useState(5.0);
    const [selectedSimilarId, setSelectedSimilarId] = useState(null); // Track selected color

    // Sync local deltaEType with controls.deltaE when ColorSettingsBox changes
    useEffect(() => {
        if (controls?.deltaE && controls.deltaE !== deltaEType) {
            setDeltaEType(controls.deltaE);
        }
    }, [controls?.deltaE]);

    // Update controls when deltaEType changes from dropdown
    const handleDeltaETypeChange = useCallback((newType) => {
        setDeltaEType(newType);
        if (setControls) {
            setControls(prev => ({ ...prev, deltaE: newType }));
        }
    }, [setControls]);

    // Handle color selection in similar list
    const handleSelectSimilar = useCallback((colorId) => {
        setSelectedSimilarId(colorId);
    }, []);

    // Handle population filter changes from SimilarAnalysisPanel
    const handlePopulationFilterChange = useCallback((filteredColors) => {
        setPopulationFilteredColors(filteredColors);
    }, []);

    // Handle stats row selection (min/max patches)
    const handleStatsRowSelect = useCallback((statsRow) => {
        setSelectedStatsRow(statsRow);
    }, []);

    const [similarColors, setSimilarColors] = useState([]); // Raw calculation results
    const [filteredSimilar, setFilteredSimilar] = useState([]); // Stable display state - never cleared mid-calculation
    const [populationFilteredColors, setPopulationFilteredColors] = useState([]); // Population-filtered subset
    const [selectedStatsRow, setSelectedStatsRow] = useState(null); // For stats-to-list connection
    const [isCalculating, setIsCalculating] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const debounceRef = useRef(null);
    const cacheRef = useRef(new Map()); // Cache results by deltaE type
    const calculationRef = useRef(null); // Prevent simultaneous calculations
    const calculationIdRef = useRef(0); // Prevent race conditions
    const mountedRef = useRef(true);

    const [colorsWithMeasurements, setColorsWithMeasurements] = useState(null);
    const [loadingColorMeasurements, setLoadingColorMeasurements] = useState(false);
    const effectiveColors = colorsWithMeasurements || colors;

    // Sync population filter when filteredSimilar updates
    useEffect(() => {
        setPopulationFilteredColors(filteredSimilar);
    }, [filteredSimilar]);

    // Request auto-selection if no referencePatch is provided on mount
    useEffect(() => {
        if (!referencePatch && onRequestAutoSelection) {
            onRequestAutoSelection();
        }
    }, [referencePatch, onRequestAutoSelection]);

    // Controls readiness: wait until measurement settings are available
    const controlsReady = useMemo(() => {
        if (!controls) return false;
        const { mode, illuminant, observer, table } = controls;
        return !!mode && !!illuminant && !!observer && !!table;
    }, [controls]);

    // If context colors lack measurements, fetch minimal measurement LABs for similarity
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            try {
                if (!colors || colors.length === 0) {
                    setColorsWithMeasurements(null);
                    return;
                }
                const allHaveMeasurements = colors.every(c => Array.isArray(c.measurements) && c.measurements.length > 0);
                if (allHaveMeasurements) {
                    setColorsWithMeasurements(null);
                    return;
                }
                setLoadingColorMeasurements(true);
                const ids = colors.map(c => c.id).slice(0, 600);
                const chunkSize = 200;
                const chunks = [];
                for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));

                const all = [];
                for (const chunk of chunks) {
                    const { data, error } = await supabase
                        .from('colors_with_full_details')
                        .select('id, measurements')
                        .in('id', chunk);
                    if (error) throw error;
                    if (data) {
                        for (const row of data) {
                            if (Array.isArray(row.measurements)) {
                                for (const m of row.measurements) {
                                    all.push({ color_id: row.id, mode: m.mode, lab: m.lab, spectral_data: m.spectral_data });
                                }
                            }
                        }
                    }
                }

                const byColor = new Map();
                for (const m of all) {
                    const arr = byColor.get(m.color_id) || [];
                    arr.push(m);
                    byColor.set(m.color_id, arr);
                }
                const targetMode = controls?.mode || 'M0';
                const merged = colors.map(c => {
                    const ms = byColor.get(c.id) || [];
                    const preferred = ms.find(m => m.mode === targetMode) || ms[0];
                    return preferred
                        ? { ...c, measurements: [{ mode: preferred.mode, lab: preferred.lab, spectral_data: preferred.spectral_data }] }
                        : { ...c, measurements: [] };
                });
                if (!cancelled) setColorsWithMeasurements(merged);
            } catch (e) {
                if (!cancelled) setColorsWithMeasurements(null);
            } finally {
                if (!cancelled) setLoadingColorMeasurements(false);
            }
        };
        run();
        return () => { cancelled = true; };
    }, [colors, controls?.mode]);

    // Pre-calculate stable hex for the reference color to prevent flashing
    const referenceHex = useMemo(() => {
        if (!standards || standards.loading || !controlsReady) return null;
        
        // Priority 1: Use referencePatch spectral data
        if (referencePatch?.spectralData) {
            try {
                const illuminantName = controls.illuminant || 'D50';
                const observerName = controls.observer || '2';
                const tableNumber = parseInt(controls.table || '5', 10);
                
                const weightingTable = standards.astmTables.filter(
                    t => t.table_number === tableNumber && 
                        t.observer === observerName && 
                        t.illuminant_name === illuminantName
                );
                
                if (weightingTable.length > 0) {
                    const lab = spectralToLabASTME308(referencePatch.spectralData, weightingTable);
                    if (lab && Number.isFinite(lab.L) && Number.isFinite(lab.a) && Number.isFinite(lab.b)) {
                        return labToHexD65(lab.L, lab.a, lab.b, illuminantName);
                    }
                }
            } catch (error) {
                console.error('Error calculating reference hex from spectral:', error);
            }
        }
        
        // Priority 2: Use condition spectral data
        if (condition?.spectral_data) {
            try {
                const illuminantName = controls.illuminant || 'D50';
                const observerName = controls.observer || '2';
                const tableNumber = parseInt(controls.table || '5', 10);
                
                const weightingTable = standards.astmTables.filter(
                    t => t.table_number === tableNumber && 
                        t.observer === observerName && 
                        t.illuminant_name === illuminantName
                );
                
                if (weightingTable.length > 0) {
                    const lab = spectralToLabASTME308(condition.spectral_data, weightingTable);
                    if (lab && Number.isFinite(lab.L) && Number.isFinite(lab.a) && Number.isFinite(lab.b)) {
                        return labToHexD65(lab.L, lab.a, lab.b, illuminantName);
                    }
                }
            } catch (error) {
                console.error('Error calculating reference hex from condition spectral:', error);
            }
        }
        
        // Fallback to existing hex
        return referencePatch?.colorHex || condition?.color_hex || '#cccccc';
    }, [referencePatch?.spectralData, referencePatch?.colorHex, condition?.spectral_data, condition?.color_hex, standards, controlsReady, controls]);

    // Convert ink condition or reference patch to color-like object for reuse of existing components
    const displayReferenceColor = useMemo(() => {
        // Validation: ensure we have valid data before creating the object
        if (!condition && !referencePatch) {
            console.warn('displayReferenceColor: No condition or referencePatch available');
            return {
                id: 'invalid-ref',
                name: 'Invalid Reference',
                hex: '#cccccc',
                measurements: [],
                precomputedHex: '#cccccc'
            };
        }

        if (referencePatch) {
            // Generate proper display label for the selected wedge
            let displayLabel = 'Selected Wedge';
            if (referencePatch.isSubstrate || referencePatch.tintPercentage === 0) {
                displayLabel = 'Substrate';
            } else if (referencePatch.tintPercentage === 100) {
                displayLabel = 'Solid';
            } else if (typeof referencePatch.tintPercentage === 'number') {
                displayLabel = `${referencePatch.tintPercentage}%`;
            }
            
            return {
                id: condition?.id || 'ref-patch',
                name: displayLabel,
                hex: referenceHex || referencePatch.colorHex || condition?.color_hex || '#cccccc',
                measurements: referencePatch.spectralData || referencePatch.lab ? [{
                    mode: controls?.mode || 'M0',
                    spectral_data: referencePatch.spectralData,
                    lab: referencePatch.lab || null
                }] : [],
                precomputedHex: referenceHex || referencePatch.colorHex || '#cccccc',
                // Promote measurement lab to top-level for fallback displays
                lab_l: referencePatch.lab?.L,
                lab_a: referencePatch.lab?.a,
                lab_b: referencePatch.lab?.b
            };
        }
        
        if (!condition) {
            console.warn('displayReferenceColor: Condition is null/undefined');
            return {
                id: 'no-condition',
                name: 'No Condition',
                hex: '#cccccc',
                measurements: [],
                precomputedHex: '#cccccc'
            };
        }
        
        const result = {
            id: condition.id,
            name: condition.name || 'Unnamed Condition',
            hex: referenceHex || condition.color_hex || '#cccccc',
            measurements: condition.spectral_data ? [{
                mode: 'M0', // Default mode for ink conditions
                spectral_data: condition.spectral_data,
                lab: condition.lab
            }] : [],
            precomputedHex: referenceHex || condition.color_hex || '#cccccc',
            // Include ink condition data for activeDataMode support
            from_ink_condition_id: condition.id,
            imported_tints: condition.imported_tints
        };
        
        console.log('🔄 InkConditionMatchesTab - displayReferenceColor created:', {
            id: condition.id,
            name: condition.name,
            activeDataMode,
            hasImportedTints: !!condition.imported_tints,
            importedTintsLength: condition.imported_tints?.length || 0
        });
        
        return result;
    }, [referencePatch, condition, controls?.mode, referenceHex, activeDataMode]);

    // Temp diagnostics for reference patch plumbing
    useEffect(() => {
        try {
            console.debug('[MatchesTab] referencePatch', {
                conditionId: condition?.id,
                hasRef: !!referencePatch,
                pct: referencePatch?.tintPercentage,
                hasSpectral: !!referencePatch?.spectralData,
                hasLab: !!referencePatch?.lab,
                hex: referencePatch?.colorHex || condition?.color_hex
            });
        } catch {}
    }, [referencePatch, condition?.id]);

    // Fast calculation function with guards
    const calculateSimilarColors = useCallback(() => {
        // Prevent simultaneous calculations
        if (calculationRef.current) {
            return;
        }

        if (!condition) {
            // Only clear display state if condition truly disappears
            setFilteredSimilar([]);
            setIsCalculating(false);
            setIsInitialLoad(false);
            return;
        }
        
        if (!effectiveColors) {
            // Keep previous filtered display stable - no clearing mid-calculation
            setIsCalculating(false);
            setIsInitialLoad(false);
            return;
        }
        
        if (effectiveColors.length === 0) {
            // Keep previous filtered display stable - no clearing mid-calculation
            setIsCalculating(false);
            setIsInitialLoad(false);
            return;
        }

        // Prerequisites guard: wait for standards/controls - keep UI stable
        if (standards?.loading || !controlsReady) {
            setIsCalculating(false);
            setIsInitialLoad(false);
            return;
        }

        // Check cache first (exclude threshold from cache key - cache all results, filter at display time)
        const refPatchSignature = referencePatch ? `${referencePatch.tintPercentage ?? 'unk'}-${!!referencePatch.spectralData}` : 'cond';
        const cacheKey = `${condition.id}-${deltaEType}-${controls?.mode || 'M0'}-${controls?.illuminant || 'D50'}-${controls?.table || '5'}-${effectiveColors?.length || 0}-${refPatchSignature}`;
        
        if (cacheRef.current.has(cacheKey)) {
            const cached = cacheRef.current.get(cacheKey);
            // Always filter cached results by current threshold at display time
            const nextFiltered = cached.filter(c => c.deltaE <= threshold)
                                      .slice(0, MAX_RESULTS);
            
            // Only commit to display state if changed (stable state guard)
            setFilteredSimilar((prev) => {
                const prevIds = Array.isArray(prev) ? prev.map(c => c.id).join(',') : '';
                const nextIds = nextFiltered.map(c => c.id).join(',');
                if (prevIds === nextIds) {
                    return prev; // No change - keep UI stable
                }
                console.log('[CACHE HIT] Committing filteredSimilar:', nextIds.split(',').slice(0, 5).join(','), '...'); // Temp log
                return nextFiltered;
            });
            
            // Also update raw state for consistency
            setSimilarColors(nextFiltered);
            setIsCalculating(false);
            setIsInitialLoad(false);
            return;
        }

        calculationRef.current = true;
        const currentCalculationId = ++calculationIdRef.current;
        setIsCalculating(true);

        try {
            // Calculate LAB from spectral data using current measurement controls
            let referenceColor = { L: 0, a: 0, b: 0 };
            
            // Priority 1: Use referencePatch data if available
            if (referencePatch?.spectralData && controls && standards && !standards.loading) {
                // Use selected illuminant and table from controls
                const illuminantName = controls.illuminant || 'D50';
                const tableNumber = parseInt(controls.table || '5');
                
                const illuminant = standards.illuminants.find(i => i.name === illuminantName);
                const weightingTable = standards.astmTables.filter(t => 
                    t.table_number === tableNumber && t.illuminant_name === illuminantName
                );

                if (illuminant && weightingTable.length > 0) {
                    try {
                        const lab = spectralToLabASTME308(referencePatch.spectralData, weightingTable);
                        referenceColor = {
                            L: lab.L || 0,
                            a: lab.a || 0,
                            b: lab.b || 0
                        };
                    } catch (error) {
                        // Fallback to referencePatch lab values
                        if (referencePatch.lab) {
                            referenceColor = {
                                L: referencePatch.lab.L || 0,
                                a: referencePatch.lab.a || 0,
                                b: referencePatch.lab.b || 0
                            };
                        }
                    }
                } else if (referencePatch.lab) {
                    // Fallback to referencePatch lab values
                    referenceColor = {
                        L: referencePatch.lab.L || 0,
                        a: referencePatch.lab.a || 0,
                        b: referencePatch.lab.b || 0
                    };
                }
            } else if (referencePatch?.lab) {
                // Priority 2: Use referencePatch lab if no spectral data
                referenceColor = {
                    L: referencePatch.lab.L || 0,
                    a: referencePatch.lab.a || 0,
                    b: referencePatch.lab.b || 0
                };
            } else if (condition.spectral_data && controls && standards && !standards.loading) {
                // Priority 3: Fallback to condition spectral data
                // Use selected illuminant and table from controls
                const illuminantName = controls.illuminant || 'D50';
                const tableNumber = parseInt(controls.table || '5');
                
                const illuminant = standards.illuminants.find(i => i.name === illuminantName);
                const weightingTable = standards.astmTables.filter(t => 
                    t.table_number === tableNumber && t.illuminant_name === illuminantName
                );

                if (illuminant && weightingTable.length > 0) {
                    try {
                        const lab = spectralToLabASTME308(condition.spectral_data, weightingTable);
                        referenceColor = {
                            L: lab.L || 0,
                            a: lab.a || 0,
                            b: lab.b || 0
                        };
                    } catch (error) {
                        // Fallback to stored lab values
                        if (condition.lab) {
                            referenceColor = {
                                L: condition.lab.L || 0,
                                a: condition.lab.a || 0,
                                b: condition.lab.b || 0
                            };
                        }
                    }
                } else if (condition.lab) {
                    // Fallback to stored lab values
                    referenceColor = {
                        L: condition.lab.L || 0,
                        a: condition.lab.a || 0,
                        b: condition.lab.b || 0
                    };
                }
            } else if (condition.lab) {
                // Fallback to stored lab values
                referenceColor = {
                    L: condition.lab.L || 0,
                    a: condition.lab.a || 0,
                    b: condition.lab.b || 0
                };
            }

            // Pre-filter and calculate deltaE for valid colors only
            const results = [];
            const validColors = effectiveColors.filter(c => 
                c.measurements && 
                c.measurements.length > 0 &&
                c.measurements[0].lab
            );

            // Calculate deltaE for valid colors (limit processing to avoid blocking)
            const maxToProcess = Math.min(validColors.length, 500); // Limit to 500 colors max
            
            for (let i = 0; i < maxToProcess; i++) {
                const c = validColors[i];
                
                // Calculate LAB from spectral data using current measurement controls
                let compareColor = { L: 0, a: 0, b: 0 };
                
                if (c.measurements && c.measurements.length > 0 && controls && standards && !standards.loading) {
                    // Use the selected mode from controls, fallback to M0, then first measurement
                    const selectedMode = controls.mode || 'M0';
                    const measurement = c.measurements.find(m => m.mode === selectedMode) || 
                                       c.measurements.find(m => m.mode === 'M0') || 
                                       c.measurements[0];
                    
                    if (measurement?.spectral_data) {
                        // Use selected illuminant and table from controls
                        const illuminantName = controls.illuminant || 'D50';
                        const tableNumber = parseInt(controls.table || '5');
                        
                        const illuminant = standards.illuminants.find(i => i.name === illuminantName);
                        const weightingTable = standards.astmTables.filter(t => 
                            t.table_number === tableNumber && t.illuminant_name === illuminantName
                        );

                        if (illuminant && weightingTable.length > 0) {
                            try {
                                const lab = spectralToLabASTME308(measurement.spectral_data, weightingTable);
                                compareColor = {
                                    L: lab.L || 0,
                                    a: lab.a || 0,
                                    b: lab.b || 0
                                };
                            } catch (error) {
                                // Fallback to stored lab values
                                const colorLab = measurement.lab;
                                compareColor = {
                                    L: colorLab?.L || 0,
                                    a: colorLab?.a || 0,
                                    b: colorLab?.b || 0
                                };
                            }
                        } else {
                            // Fallback to stored lab values
                            const colorLab = measurement.lab;
                            compareColor = {
                                L: colorLab?.L || 0,
                                a: colorLab?.a || 0,
                                b: colorLab?.b || 0
                            };
                        }
                    } else {
                        // Fallback to stored lab values
                        const colorLab = measurement.lab;
                        compareColor = {
                            L: colorLab?.L || 0,
                            a: colorLab?.a || 0,
                            b: colorLab?.b || 0
                        };
                    }
                } else {
                    // Fallback to stored lab values
                    const colorLab = c.measurements[0].lab;
                    compareColor = {
                        L: colorLab?.L || 0,
                        a: colorLab?.a || 0,
                        b: colorLab?.b || 0
                    };
                }
                
                try {
                    const deltaE = calculateDeltaE(referenceColor, compareColor, deltaEType);
                    
                    // Collect result without strict prefilter; we'll filter/slice after sort
                    results.push({
                        ...c,
                        deltaE: deltaE,
                        uniqueKey: `${c.id}-${deltaEType}-${Math.round(deltaE * 100)}`,
                        // Add convenience LAB properties for display
                        lab_l: compareColor.L,
                        lab_a: compareColor.a,
                        lab_b: compareColor.b
                    });

                    // Early exit if we have enough good results
                    if (results.length >= MAX_RESULTS * 2) {
                        break;
                    }
                } catch (deltaEError) {
                    // Silent error handling
                }
            }

            // Sort by deltaE and cache non-empty results only
            results.sort((a, b) => a.deltaE - b.deltaE);
            if (results.length > 0) {
                cacheRef.current.set(cacheKey, results);
            }

            // Filter by threshold and limit results
            const filtered = results.filter(c => c.deltaE <= threshold)
                                   .slice(0, MAX_RESULTS);
            
            // Fallback: if nothing within threshold, show best matches
            const finalResults = filtered.length === 0 && results.length > 0 ? 
                results.slice(0, MAX_RESULTS) : filtered;
            
            // Check if this calculation is still current (prevents race conditions)
            if (currentCalculationId === calculationIdRef.current && mountedRef.current) {
                // Commit to stable display state only if changed
                setFilteredSimilar((prev) => {
                    const prevIds = Array.isArray(prev) ? prev.map(c => c.id).join(',') : '';
                    const nextIds = finalResults.map(c => c.id).join(',');
                    if (prevIds === nextIds) {
                        return prev; // No change - keep UI stable
                    }
                    console.log('[CALCULATION] Committing filteredSimilar:', nextIds.split(',').slice(0, 5).join(','), '...'); // Temp log
                    return finalResults;
                });
                
                // Also update raw state for consistency
                setSimilarColors(finalResults);
            }
        } catch (error) {
            console.error('[CALCULATION ERROR]', error); // Log errors but don't clear display
            // Keep previous filteredSimilar intact - don't clear on error
            if (currentCalculationId === calculationIdRef.current) {
                setSimilarColors([]); // Raw state can be cleared for consistency
            }
        } finally {
            if (currentCalculationId === calculationIdRef.current) {
                calculationRef.current = null;
                setIsCalculating(false);
                setIsInitialLoad(false);
            }
        }
    }, [condition, effectiveColors, deltaEType, threshold, controls, standards, controlsReady]);

    // Cleanup ref on unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Debounced calculation for threshold changes only
    const debouncedCalculate = useCallback(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        
        debounceRef.current = setTimeout(() => {
            calculateSimilarColors();
        }, 300); // 300ms debounce
    }, [calculateSimilarColors]);

    // Separate effect for deltaE type changes (immediate recalculation)
    useEffect(() => {
        if (!effectiveColors || effectiveColors.length === 0) {
            setIsInitialLoad(false);
            return;
        }
        
        if (!controlsReady || standards?.loading || loadingColorMeasurements) {
            return;
        }

        // DeltaE type changes should immediately trigger recalculation
        calculateSimilarColors();
    }, [condition, effectiveColors, deltaEType, controlsReady, standards?.loading, loadingColorMeasurements, calculateSimilarColors]);

    // Separate effect for threshold changes (debounced)
    useEffect(() => {
        if (!effectiveColors || effectiveColors.length === 0) {
            return;
        }
        
        if (!controlsReady || standards?.loading || loadingColorMeasurements) {
            return;
        }

        // Threshold changes should be debounced, but only if not initial load
        if (!isInitialLoad) {
            debouncedCalculate();
        }
    }, [threshold, controlsReady, standards?.loading, loadingColorMeasurements, debouncedCalculate, isInitialLoad]);

    if (!condition) {
        return <div>Ink condition data not available.</div>;
    }

    return (
        <div className="flex-grow flex gap-2 overflow-hidden h-[calc(100vh-250px)]">
            <div className="w-2/3 flex">
              <div className="h-full w-full flex overflow-hidden shadow-lg rounded-lg border bg-card">
                 <div className="w-1/4 flex-shrink-0">
                   <LoadingErrorBoundary>
                     <SimilarReferencePanel color={displayReferenceColor} controls={controls} standards={standards} activeDataMode={activeDataMode} />
                   </LoadingErrorBoundary>
                 </div>
                 <div className="w-3/4 flex flex-col">
                        <SimilarColorsList 
                          colors={populationFilteredColors} 
                          deltaEType={deltaEType} 
                          setDeltaEType={handleDeltaETypeChange}
                          threshold={threshold}
                          setThreshold={setThreshold}
                          selectedSimilarId={selectedSimilarId}
                          onSelectSimilar={handleSelectSimilar}
                          selectedStatsRow={selectedStatsRow}
                          onStatsRowProcessed={() => setSelectedStatsRow(null)}
                        />
                 </div>
               </div>
             </div>
             
             <div className="w-1/3 flex-shrink-0">
                <SimilarAnalysisPanel 
                  masterColor={displayReferenceColor}
                  similarColors={filteredSimilar}
                  deltaEType={deltaEType}
                  selectedSimilarId={selectedSimilarId}
                  onSelectSimilar={handleSelectSimilar}
                  onFilteredColorsChange={handlePopulationFilterChange}
                  onStatsRowSelect={handleStatsRowSelect}
                />
             </div>
        </div>
    );
};

export default InkConditionMatchesTab;