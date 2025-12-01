import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { calculateDeltaE } from '@/lib/deltaE';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { spectralToLabASTME308, labToHex, labToHexD65 } from '@/lib/colorUtils';
import { supabase } from '@/lib/customSupabaseClient';
import { isValidDeltaEMethod, DEFAULT_DELTA_E_METHOD } from '@/lib/constants/deltaEMethods';
import { useDebounce } from '@/hooks/useDebounce';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';

// Normalize illuminant name to key format expected by labToHex
const normalizeIlluminantKey = (illuminantName) => {
  if (!illuminantName) return 'D50';
  
  // Map common illuminant names to their keys
  const illuminantMap = {
    'D50': 'D50',
    'D65': 'D65',
    'A': 'A',
    'C': 'C',
    'E': 'E',
    'F2': 'F2',
    'F7': 'F7',
    'F11': 'F11'
  };
  
  // Try direct match first
  if (illuminantMap[illuminantName]) {
    return illuminantMap[illuminantName];
  }
  
  // Try to extract key from longer names
  const normalizedName = illuminantName.toUpperCase();
  for (const [key, value] of Object.entries(illuminantMap)) {
    if (normalizedName.includes(key)) {
      return value;
    }
  }
  
  // Default fallback
  return 'D50';
};

import SimilarReferencePanel from '@/components/similar-colors/SimilarReferencePanel';
import SimilarColorsList from '@/components/similar-colors/SimilarColorsList';
import SimilarAnalysisPanel from '@/components/similar-colors/SimilarAnalysisPanel';
import { sdebug, isSimilarDebugEnabled } from '@/lib/similarDebug';

const MAX_RESULTS = 50; // Limit results for performance

// Numeric coercion helper for potential string values
const toNum = (v) => (typeof v === 'string' ? parseFloat(v) : v);

// Helper to validate Lab values (accepts numeric strings)
const isFiniteLab = (lab) => {
    if (!lab) return false;
    const L = toNum(lab.L); const a = toNum(lab.a); const b = toNum(lab.b);
    return Number.isFinite(L) && Number.isFinite(a) && Number.isFinite(b);
};

const SimilarColorsTab = ({ color, controls, setControls, standards, activeTab, activeDataMode }) => {
    console.log('SimilarColorsTab MOUNTING with color:', color?.id, color?.name, 'activeTab:', activeTab);
    
    // Pull colors from context; enrich with minimal measurements if missing
    const { colors: ctxColors, loading } = useAppContext();
    const [colorsWithMeasurements, setColorsWithMeasurements] = useState(null);
    const [loadingColorMeasurements, setLoadingColorMeasurements] = useState(false);
    const colors = colorsWithMeasurements || ctxColors;
    console.log('SimilarColorsTab - colors source:', {
        ctxCount: ctxColors?.length,
        enriched: !!colorsWithMeasurements,
        effectiveCount: colors?.length,
    });
    
    // Normalize and validate deltaE method from controls
    const normalizeDeltaEMethod = useCallback((method) => {
        if (!method) return DEFAULT_DELTA_E_METHOD;
        
        // Handle common variations and normalize to standard format
        const normalized = method.toString().toLowerCase().trim();
        const mappings = {
            'de2000': 'dE00',
            'de00': 'dE00', 
            'ciede2000': 'dE00',
            'deltae2000': 'dE00',
            'de76': 'dE76',
            'deltae76': 'dE76',
            'cielab': 'dE76',
            'de94': 'dE94',
            'deltae94': 'dE94',
            'decmc': 'dECMC2:1',
            'decmc21': 'dECMC2:1',
            'decmc11': 'dECMC1:1',
            'cmc': 'dECMC2:1',
            'cmc21': 'dECMC2:1',
            'cmc11': 'dECMC1:1'
        };
        
        const mapped = mappings[normalized] || method;
        return isValidDeltaEMethod(mapped) ? mapped : DEFAULT_DELTA_E_METHOD;
    }, []);
    
    const [deltaEType, setDeltaEType] = useState(() => {
        const method = normalizeDeltaEMethod(controls?.deltaE);
        console.log('SimilarColorsTab - Initial deltaEType:', { controlsDeltaE: controls?.deltaE, normalized: method });
        return method;
    });
    const [threshold, setThreshold] = useState(() => {
        // Try to get threshold from localStorage or default to 10
        const savedThreshold = localStorage.getItem('similarColors_threshold');
        return savedThreshold ? Number(savedThreshold) : 10;
    });
    const debouncedThreshold = useDebounce(threshold, 300);
    const [similarColors, setSimilarColors] = useState([]);
    const [analysisColors, setAnalysisColors] = useState([]); // For uncapped analysis
    const [calculatingColors, setCalculatingColors] = useState(false);
    const [referenceLab, setReferenceLab] = useState(null);
    const [selectedSimilarId, setSelectedSimilarId] = useState(null);
    const [refTopLab, setRefTopLab] = useState(null); // Top-level Lab data for reference color
    const [refCurrentLab, setRefCurrentLab] = useState(null); // Current Lab from measurement controls
    const [refCurrentHex, setRefCurrentHex] = useState(null); // Current hex from measurement controls
    const [filteredColors, setFilteredColors] = useState([]); // Colors filtered by population controls
    const [selectedStatsRow, setSelectedStatsRow] = useState(null); // For stats-to-list connection
    
    const handleSelectSimilar = useCallback((id) => {
        setSelectedSimilarId(prev => prev === id ? null : id);
    }, []);

    const handleFilteredColorsChange = useCallback((filtered) => {
        setFilteredColors(filtered);
    }, []);

    const handleStatsRowSelect = useCallback((statsRow) => {
        setSelectedStatsRow(statsRow);
    }, []);

    const handleReferenceLabUpdate = useCallback((labUpdate) => {
        console.log('SimilarColorsTab - Reference Lab update received:', labUpdate);
        setRefCurrentLab(labUpdate.lab);
        setRefCurrentHex(labUpdate.hex);
    }, []);
    const debounceRef = useRef(null);
    const cacheRef = useRef(new Map()); // Cache results by deltaE type
    const runIdRef = useRef(0); // Guards against stale updates
const simDbg = isSimilarDebugEnabled();
// Prefer cached ASTM tables (with white point data) to avoid missing-data errors
const { astmTables: cachedAstmTables, loading: astmLoading } = useAstmTablesCache();
    
    // Clear old cache entries on mount (v2/v3/v4/v5)
    useEffect(() => {
        try {
            const keys = Object.keys(localStorage);
            const oldCacheKeys = keys.filter(key => key.includes('-v2') || key.includes('-v3') || key.includes('-v4') || key.includes('-v5'));
            oldCacheKeys.forEach(key => localStorage.removeItem(key));
            if (oldCacheKeys.length > 0) {
                console.log('Cleared old cache entries:', oldCacheKeys.length);
            }
        } catch (e) {
            console.log('Cache clear failed:', e);
        }
    }, []);

    // Controls readiness: check if we can calculate similar colors
    // For spectral data: need all measurement settings (mode, illuminant, observer, table)
    // For Lab data only: just need deltaE type
    const controlsReady = useMemo(() => {
        // We need a valid deltaE method - check both sources robustly
        const availableDeltaE = deltaEType || controls?.deltaE;
        const normalizedDeltaE = normalizeDeltaEMethod(availableDeltaE);
        
        if (!normalizedDeltaE || !isValidDeltaEMethod(normalizedDeltaE)) {
            if (simDbg) sdebug.log('controlsReady: false - no valid deltaE method', { 
                deltaEType, 
                controlsDeltaE: controls?.deltaE, 
                normalized: normalizedDeltaE 
            });
            return false;
        }
        
        // Check if reference color has Lab data available (using ColorInfoTab sanitize logic)
        const sanitize = (v) => {
            if (v === undefined || v === null) return null;
            if (typeof v === 'string') {
                const s = v.trim();
                if (s === '' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null' || s.toLowerCase() === 'nan') return null;
                const n = Number(s);
                return Number.isFinite(n) ? n : null;
            }
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        };

        const L = sanitize(color?.lab_l) ?? sanitize(refTopLab?.lab_l);
        const a = sanitize(color?.lab_a) ?? sanitize(refTopLab?.lab_a);
        const b = sanitize(color?.lab_b) ?? sanitize(refTopLab?.lab_b);
        const hasLabData = L !== null && a !== null && b !== null;
        
        const hasMeasurementLab = Array.isArray(color?.measurements) && 
            color.measurements.some(m => isFiniteLab(m?.lab));
        
        // If we have Lab data available, we can proceed without full spectral controls
        if (hasLabData || hasMeasurementLab) {
            if (simDbg) sdebug.log('controlsReady: true (Lab data available)', { hasLabData, hasMeasurementLab });
            return true;
        }
        
        // Check if reference has spectral data and we have standards available
        const hasSpectralData = Array.isArray(color?.measurements) && 
            color.measurements.some(m => m?.spectral_data);
        const { mode, illuminant, observer, table } = controls;
        const hasAllSpectralControls = !!mode && !!illuminant && !!observer && !!table;
        const hasStandards = standards && !standards.loading && 
            standards.illuminants && standards.observers && standards.astmTables;
        
        if (hasSpectralData && hasAllSpectralControls && hasStandards) {
            if (simDbg) sdebug.log('controlsReady: true (spectral data + standards)', { hasSpectralData, hasAllSpectralControls, hasStandards });
            return true;
        }
        
        if (simDbg) sdebug.log('controlsReady: false', { 
            deltaEType,
            controlsDeltaE: controls?.deltaE,
            normalizedDeltaE,
            hasLabData, 
            hasMeasurementLab, 
            hasSpectralData, 
            hasAllSpectralControls, 
            hasStandards: !!hasStandards,
            standardsLoading: standards?.loading 
        });
        return false;
    }, [controls, deltaEType, color, standards, simDbg, normalizeDeltaEMethod, refTopLab]);

    // Keep local deltaEType in sync with ColorSettingsBox controls
    useEffect(() => {
        if (controls?.deltaE) {
            const normalizedMethod = normalizeDeltaEMethod(controls.deltaE);
            if (normalizedMethod !== deltaEType) {
                console.log('SimilarColorsTab - Syncing deltaE from controls:', { 
                    originalControls: controls.deltaE, 
                    normalized: normalizedMethod, 
                    current: deltaEType 
                });
                setDeltaEType(normalizedMethod);
            }
        }
    }, [controls?.deltaE, deltaEType, normalizeDeltaEMethod]);

    // Fetch top-level Lab data for reference color if missing
    useEffect(() => {
        if (!color?.id) {
            setRefTopLab(null);
            return;
        }

        // Skip if color already has top-level Lab data
        const sanitize = (v) => {
            if (v === undefined || v === null) return null;
            if (typeof v === 'string') {
                const s = v.trim();
                if (s === '' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null' || s.toLowerCase() === 'nan') return null;
                const n = Number(s);
                return Number.isFinite(n) ? n : null;
            }
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        };

        const hasTopLab = sanitize(color?.lab_l) !== null && 
                         sanitize(color?.lab_a) !== null && 
                         sanitize(color?.lab_b) !== null;

        if (hasTopLab) {
            setRefTopLab(null);
            return;
        }

        // Fetch missing top-level Lab data
        const fetchTopLab = async () => {
            try {
                const { data, error } = await supabase
                    .from('colors')
                    .select('lab_l, lab_a, lab_b')
                    .eq('id', color.id)
                    .single();

                if (error) throw error;
                if (simDbg) sdebug.log('Fetched top-level Lab for reference:', data);
                setRefTopLab(data);
            } catch (error) {
                console.error('Error fetching top-level Lab for reference color:', error);
                setRefTopLab(null);
            }
        };

        fetchTopLab();
    }, [color?.id, color?.lab_l, color?.lab_a, color?.lab_b, simDbg]);

    // When user changes ΔE in the list, also reflect it in global controls box
    const handleDeltaEChange = useCallback((val) => {
        const normalizedMethod = normalizeDeltaEMethod(val);
        console.log('SimilarColorsTab - handleDeltaEChange:', { 
            original: val, 
            normalized: normalizedMethod 
        });
        setDeltaEType(normalizedMethod);
        setControls?.((prev) => ({ ...prev, deltaE: normalizedMethod }));
    }, [setControls, normalizeDeltaEMethod]);
    // If context colors lack measurements, fetch minimal measurement LABs for similarity
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            try {
                if (!ctxColors || ctxColors.length === 0) {
                    setColorsWithMeasurements(null);
                    return;
                }
                // Check if context colors have real measurement data (Lab or spectral)
                const allHaveRealMeasurements = ctxColors.every(c => 
                    Array.isArray(c.measurements) && 
                    c.measurements.some(m => m?.lab || m?.spectral_data)
                );
                if (allHaveRealMeasurements) {
                    console.log('All colors have real measurement data, using context colors directly');
                    setColorsWithMeasurements(null);
                    return;
                }
                setLoadingColorMeasurements(true);
                // Gather all color IDs (INCLUDE the active color for enrichment) - no limit for consistent results
                const ids = ctxColors.map(c => c.id);
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
                const merged = ctxColors.map(c => {
                    const ms = byColor.get(c.id) || [];
                    const preferred = ms.find(m => m.mode === targetMode) || ms[0];
                    return preferred
                        ? { ...c, measurements: [{ mode: preferred.mode, lab: preferred.lab, spectral_data: preferred.spectral_data }] }
                        : { ...c, measurements: [] };
                });
                
                console.log('Enrichment results:', {
                    totalColors: ctxColors.length,
                    enrichedWithLab: merged.filter(c => c.measurements?.[0]?.lab).length,
                    enrichedWithSpectral: merged.filter(c => c.measurements?.[0]?.spectral_data).length
                });
                if (!cancelled) setColorsWithMeasurements(merged);
            } catch (e) {
                console.error('Failed to fetch minimal measurements for similarity:', e);
                // Fallback: try direct color_measurements table
                try {
                    const fallbackIds = ctxColors.map(c => c.id);
                    const { data: fallbackData } = await supabase
                        .from('color_measurements')
                        .select('color_id, mode, lab')
                        .in('color_id', fallbackIds)
                        .not('lab', 'is', null);
                    
                    if (fallbackData?.length > 0) {
                        const fallbackByColor = new Map();
                        for (const m of fallbackData) {
                            const arr = fallbackByColor.get(m.color_id) || [];
                            arr.push(m);
                            fallbackByColor.set(m.color_id, arr);
                        }
                        const fallbackMerged = ctxColors.map(c => {
                            const ms = fallbackByColor.get(c.id) || [];
                            const preferred = ms.find(m => m.mode === targetMode) || ms[0];
                            return preferred
                                ? { ...c, measurements: [{ mode: preferred.mode, lab: preferred.lab }] }
                                : { ...c, measurements: [] };
                        });
                        if (!cancelled) setColorsWithMeasurements(fallbackMerged);
                    } else {
                        if (!cancelled) setColorsWithMeasurements(null);
                    }
                } catch (fallbackError) {
                    console.error('Fallback fetch also failed:', fallbackError);
                    if (!cancelled) setColorsWithMeasurements(null);
                }
            } finally {
                if (!cancelled) setLoadingColorMeasurements(false);
            }
        };
        run();
        return () => { cancelled = true; };
    }, [ctxColors, controls?.mode, color?.id]);

    // Fast calculation function
    const calculateSimilarColors = useCallback(() => {
        const currentRunId = ++runIdRef.current;
        console.log('=== calculateSimilarColors STARTED ===', { runId: currentRunId });
        if (simDbg) {
            sdebug.time(`similar-calc-${currentRunId}`);
        }
        console.log('calculateSimilarColors called', { 
            hasColor: !!color, 
            colorId: color?.id,
            colorsLength: colors?.length, 
            deltaEType, 
            threshold 
        });
        
        if (!color) {
            console.log('Early return - no color');
            if (runIdRef.current === currentRunId) {
                setSimilarColors([]);
                setCalculatingColors(false);
            }
            return;
        }
        
        if (!colors) {
            console.log('Early return - no colors array');
            if (runIdRef.current === currentRunId) {
                setSimilarColors([]);
                setCalculatingColors(false);
            }
            return;
        }
        
        if (colors.length === 0) {
            console.log('Early return - empty colors array');
            if (runIdRef.current === currentRunId) {
                setSimilarColors([]);
                setCalculatingColors(false);
            }
            return;
        }

        // Prerequisites guard: only defer if measurements are loading
        if (loadingColorMeasurements) {
            console.log('Deferring calculation - measurements loading');
            if (runIdRef.current === currentRunId) {
                setCalculatingColors(false);
            }
            return;
        }
        
        // Check if we have any Lab data for the reference color (including fetched top-level Lab)
        const hasReferenceLab = Number.isFinite(toNum(color?.lab_l)) && Number.isFinite(toNum(color?.lab_a)) && Number.isFinite(toNum(color?.lab_b));
        const hasReferenceTopLab = refTopLab && Number.isFinite(toNum(refTopLab?.lab_l)) && Number.isFinite(toNum(refTopLab?.lab_a)) && Number.isFinite(toNum(refTopLab?.lab_b));
        const hasReferenceLabFromMeasurement = Array.isArray(color?.measurements) && 
            color.measurements.some(m => isFiniteLab(m?.lab));
        
        // Only defer if we have no Lab data and standards are still loading
        if (!hasReferenceLab && !hasReferenceTopLab && !hasReferenceLabFromMeasurement && standards?.loading) {
            console.log('Deferring calculation - no reference Lab and standards loading');
            if (runIdRef.current === currentRunId) {
                setCalculatingColors(false);
            }
            return;
        }

        // Build dataset signature (enriched + validCount) before caching
        const enrichedFlag = !!colorsWithMeasurements;
        const validCount = colors.reduce((acc, c) => {
            if (c.id === color.id) return acc;
            const hasMeas = Array.isArray(c.measurements) && c.measurements.length > 0;
            const hasLabTop = (c.lab_l !== null && c.lab_a !== null && c.lab_b !== null);
            if (hasMeas) {
                const m = c.measurements[0];
                if (m?.lab || m?.spectral_data) return acc + 1;
            } else if (hasLabTop) {
                return acc + 1;
            }
            return acc;
        }, 0);
        if (simDbg) sdebug.log('Dataset signature', { enrichedFlag, total: colors?.length || 0, validCount });

        // Check cache first (include controls, threshold and dataset in key) - v7: includes validCount & enrichment flag
        const cacheKey = `${color.id}-${deltaEType}-${threshold}-${controls?.mode || 'M0'}-${controls?.illuminant || 'D50'}-${controls?.observer || '2'}-${controls?.table || '5'}-${colors?.length || 0}-${validCount}-${enrichedFlag ? 'E' : 'C'}-v7`;
        console.log('Checking cache for key:', cacheKey);
        console.log('Cache contents:', Array.from(cacheRef.current.keys()));
        
        if (cacheRef.current.has(cacheKey)) {
            console.log('CACHE HIT - Using cached results');
            const cached = cacheRef.current.get(cacheKey);
            console.log('Cached results length:', cached?.length);
            const validThreshold = Math.max(0.1, Number(threshold) || 0.1);
            const filtered = cached.filter(c => c.deltaE <= validThreshold).slice(0, MAX_RESULTS);
            console.log('Filtered cached results:', filtered.length);
            if (simDbg && Array.isArray(cached) && cached.length) {
                const sorted = [...cached].sort((a,b) => a.deltaE - b.deltaE);
                const n = sorted.length;
                const pick = (q) => sorted[Math.min(n - 1, Math.floor(n * q))]?.deltaE;
                const mean = sorted.reduce((s, r) => s + (r.deltaE || 0), 0) / n;
                const buckets = {
                    le1: sorted.filter(r => r.deltaE <= 1).length,
                    le2: sorted.filter(r => r.deltaE <= 2).length,
                    le5: sorted.filter(r => r.deltaE <= 5).length,
                    le10: sorted.filter(r => r.deltaE <= 10).length,
                    gt10: sorted.filter(r => r.deltaE > 10).length,
                };
                sdebug.log('Cached ΔE stats', { n, min: sorted[0]?.deltaE, p25: pick(0.25), p50: pick(0.5), p75: pick(0.75), max: sorted[n-1]?.deltaE, mean, buckets, underThreshold: filtered.length });
                sdebug.log('Top cached', sorted.slice(0, 5).map(r => ({ id: r.id, name: r.name, dE: r.deltaE })));
            }
            
            // Store all cached results for uncapped analysis
            if (runIdRef.current === currentRunId) {
                setAnalysisColors(cached);
                setSimilarColors(filtered);
                setCalculatingColors(false);
            }
            return;
        }

        console.log('CACHE MISS - Starting fresh calculation...');
        if (runIdRef.current === currentRunId) {
            setCalculatingColors(true);
        }

        try {
            console.log('Reference color object:', color);
            console.log('Reference color properties:', Object.keys(color));
            console.log('Reference color measurements:', color.measurements);
            console.log('Controls for calculation:', controls);
            
            // Calculate LAB from spectral data using current measurement controls
            // Prefer enriched color if available from measurement fetch
            const referenceSource = colorsWithMeasurements?.find(c => c.id === color?.id) || color;
            let referenceColor = null;
            const hasMeasurements = Array.isArray(referenceSource.measurements) && referenceSource.measurements.length > 0;
            
            if (hasMeasurements) {
                // Use the selected mode from controls, fallback to M0, then first measurement
                const selectedMode = (controls && controls.mode) ? controls.mode : 'M0';
                const measurement = referenceSource.measurements.find(m => m.mode === selectedMode) || 
                                   referenceSource.measurements.find(m => m.mode === 'M0') || 
                                   referenceSource.measurements[0];
                
                // Prefer spectral calculation when standards are available
                if (measurement?.spectral_data && standards && !standards.loading) {
                    const illuminantName = controls?.illuminant || 'D50';
                    const tableNumber = parseInt(controls?.table || '5', 10);
                    const observerName = controls?.observer || '2';
                    const sourceTables = (cachedAstmTables && cachedAstmTables.length) ? cachedAstmTables : standards.astmTables;
                    const weightingTable = sourceTables.filter(t => 
                        t.table_number === tableNumber && t.illuminant_name === illuminantName && String(t.observer) === String(observerName)
                    );
                    if (weightingTable.length > 0) {
                        try {
                            const lab = spectralToLabASTME308(measurement.spectral_data, weightingTable);
                            if (isFiniteLab(lab)) {
                                referenceColor = { L: lab.L, a: lab.a, b: lab.b };
                                console.log('Using spectral-calculated Lab for reference:', referenceColor);
                            }
                        } catch (error) {
                            console.error('Error calculating reference Lab from spectral:', error);
                        }
                    }
                }
                
                // Fallback to stored Lab if spectral failed or unavailable
                if (!referenceColor && isFiniteLab(measurement?.lab)) {
                    referenceColor = { L: toNum(measurement.lab.L), a: toNum(measurement.lab.a), b: toNum(measurement.lab.b) };
                    console.log('Using measurement Lab for reference:', referenceColor);
                }
            }
            
            // Fallback to top-level Lab fields
            if (!referenceColor && Number.isFinite(toNum(color?.lab_l)) && Number.isFinite(toNum(color?.lab_a)) && Number.isFinite(toNum(color?.lab_b))) {
                referenceColor = { L: toNum(color.lab_l), a: toNum(color.lab_a), b: toNum(color.lab_b) };
                console.log('Using top-level Lab for reference:', referenceColor);
            }

            // Final fallback to fetched top-level Lab
            if (!referenceColor && refTopLab && Number.isFinite(toNum(refTopLab.lab_l)) && Number.isFinite(toNum(refTopLab.lab_a)) && Number.isFinite(toNum(refTopLab.lab_b))) {
                referenceColor = { L: toNum(refTopLab.lab_l), a: toNum(refTopLab.lab_a), b: toNum(refTopLab.lab_b) };
                console.log('Using fetched top-level Lab for reference:', referenceColor);
            }
            
            // Abort if no valid reference Lab found
            if (!referenceColor) {
                console.error('No valid reference Lab found for color:', color.id);
                if (runIdRef.current === currentRunId) {
                    setSimilarColors([]);
                    setCalculatingColors(false);
                }
                return;
            }

            // Set reference lab state for analysis panel
            if (runIdRef.current === currentRunId) {
                setReferenceLab(referenceColor);
            }

            if (simDbg) {
                const hasMeasurements = Array.isArray(color.measurements) && color.measurements.length > 0;
                const selectedMode = (controls && controls.mode) ? controls.mode : 'M0';
                const m = hasMeasurements ? (color.measurements.find(mm => mm.mode === selectedMode) || color.measurements.find(mm => mm.mode === 'M0') || color.measurements[0]) : null;
                const usedSpectral = !!(m && m.spectral_data) && standards && !standards.loading;
                const source = hasMeasurements ? (usedSpectral ? 'spectral' : 'measurement.lab') : (color.lab_l !== null ? 'top-level' : 'none');
                sdebug.log('ReferenceLab resolved', { source, referenceColor });
            }

            // Pre-filter and calculate deltaE for valid colors only
            const results = [];
            const validColors = colors.filter(c => {
                if (c.id === color.id) return false;
                
                // Check for valid measurement Lab data
                if (c.measurements?.length > 0) {
                    const measurement = c.measurements[0];
                    if (isFiniteLab(measurement?.lab) || measurement?.spectral_data) {
                        return true;
                    }
                }
                
                // Check for valid top-level Lab data
                return Number.isFinite(toNum(c.lab_l)) && Number.isFinite(toNum(c.lab_a)) && Number.isFinite(toNum(c.lab_b));
            });

            // Only defer if ALL candidates are spectral-only and standards aren't ready
            const labAvailableCount = validColors.reduce((acc, c) => {
                const m = c.measurements?.[0];
                const hasMeasLab = !!(m && m.lab && isFiniteLab(m.lab));
                const hasTopLab = Number.isFinite(toNum(c.lab_l)) && Number.isFinite(toNum(c.lab_a)) && Number.isFinite(toNum(c.lab_b));
                return acc + (hasMeasLab || hasTopLab ? 1 : 0);
            }, 0);
            const spectralOnlyCount = validColors.length - labAvailableCount;
            
            // Only defer if ALL candidates are spectral-only and standards aren't ready
            if (spectralOnlyCount > 0 && labAvailableCount === 0 && (!standards || standards.loading)) {
                console.log(`Deferring calculation - ALL ${spectralOnlyCount} candidates are spectral-only but standards not ready`);
                if (simDbg) sdebug.warn('Deferring due to ALL candidates being spectral-only and no standards', { spectralOnlyCount, labAvailableCount, total: validColors.length });
                if (runIdRef.current === currentRunId) {
                    setCalculatingColors(false);
                }
                return;
            }

            console.log('Valid colors to process:', validColors.length);
            if (simDbg) {
                const datasetStats = validColors.reduce((acc, c) => {
                    const hasMeas = Array.isArray(c.measurements) && c.measurements.length > 0;
                    if (hasMeas) {
                        const m = c.measurements[0];
                        if (m?.spectral_data) acc.spectral += 1; else if (m?.lab) acc.measurementLab += 1; else acc.other += 1;
                    } else if (c.lab_l !== null && c.lab_a !== null && c.lab_b !== null) {
                        acc.topLevelLab += 1;
                    } else {
                        acc.other += 1;
                    }
                    return acc;
                }, { spectral: 0, measurementLab: 0, topLevelLab: 0, other: 0 });
                sdebug.log('Candidate dataset characterization', datasetStats);
            }
            console.log('Sample valid color objects:', validColors.slice(0, 2));
            console.log('Sample valid color properties:', validColors[0] ? Object.keys(validColors[0]) : 'No colors');
            console.log('Sample valid colors measurements:', validColors.slice(0, 3).map(c => ({ id: c.id, name: c.name, measurements: c.measurements?.[0]?.lab, allProps: Object.keys(c) })));

            // Calculate deltaE for ALL valid colors - no processing limit for consistent results
            const maxToProcess = validColors.length;
            console.log('Will process ALL', maxToProcess, 'colors for consistent results');
            
            for (let i = 0; i < maxToProcess; i++) {
                const c = validColors[i];
                
                // Calculate LAB from spectral data using current measurement controls
                let compareColor = null;
                
                if (c.measurements && c.measurements.length > 0) {
                    // Use the selected mode from controls, fallback to M0, then first measurement
                    const selectedMode = controls?.mode || 'M0';
                    const measurement = c.measurements.find(m => m.mode === selectedMode) || 
                                       c.measurements.find(m => m.mode === 'M0') || 
                                       c.measurements[0];
                    
                    // Prefer spectral calculation when available and standards ready
                    if (measurement?.spectral_data && !astmLoading) {
                        const illuminantName = controls?.illuminant || 'D50';
                        const tableNumber = parseInt(controls?.table || '5', 10);
                        const observerName = controls?.observer || '2';
                        const sourceTables = (cachedAstmTables && cachedAstmTables.length) ? cachedAstmTables : standards.astmTables;
                        const weightingTable = sourceTables.filter(t => 
                            t.table_number === tableNumber && t.illuminant_name === illuminantName && String(t.observer) === String(observerName)
                        );
                        if (weightingTable.length > 0) {
                            try {
                                const lab = spectralToLabASTME308(measurement.spectral_data, weightingTable);
                                if (isFiniteLab(lab)) {
                                    compareColor = { L: lab.L, a: lab.a, b: lab.b };
                                }
                            } catch (error) {
                                console.error('Error calculating Lab from spectral for comparison:', error);
                            }
                        }
                    }
                    
                    // Fallback to stored Lab if spectral failed or unavailable
                    if (!compareColor && isFiniteLab(measurement?.lab)) {
                        compareColor = { L: toNum(measurement.lab.L), a: toNum(measurement.lab.a), b: toNum(measurement.lab.b) };
                    }
                }
                
                // Final fallback to top-level Lab fields
                if (!compareColor && Number.isFinite(toNum(c.lab_l)) && Number.isFinite(toNum(c.lab_a)) && Number.isFinite(toNum(c.lab_b))) {
                    compareColor = { L: toNum(c.lab_l), a: toNum(c.lab_a), b: toNum(c.lab_b) };
                }
                
                // Skip if no valid Lab found
                if (!compareColor) {
                    if (i < 5) {
                        console.log(`Skipping color ${c.name} - no valid Lab data`);
                    }
                    continue;
                }
                
                try {
                    const deltaE = calculateDeltaE(referenceColor, compareColor, deltaEType);
                    if (simDbg && (i < 5 || i % 200 === 0)) {
                        const dE76 = calculateDeltaE(referenceColor, compareColor, 'dE76');
                        sdebug.log(`dE compare [${i}]`, { name: c.name, id: c.id, dEType: deltaEType, dE00: deltaE, dE76, ref: referenceColor, cmp: compareColor });
                    }
                    
                    if (i < 5) { // Log first 5 calculations for debugging
                        console.log(`DeltaE calculation ${i}:`, {
                            colorName: c.name,
                            referenceColor,
                            compareColor,
                            deltaE,
                            deltaEType,
                            threshold: debouncedThreshold
                        });
                    }
                    
                    // Calculate D65-standardized hex color from Lab values for consistent display
                    let updatedHex = c.hex; // fallback to original hex
                    try {
                        const illuminantKey = normalizeIlluminantKey(controls?.illuminant);
                        updatedHex = labToHexD65(compareColor.L, compareColor.a, compareColor.b, illuminantKey);
                    } catch (hexError) {
                        console.error('Error converting Lab to D65 hex for color:', c.name, hexError);
                    }
                    
                    // Store ALL results for uncapped analysis (no pre-filtering)
                    results.push({
                        ...c,
                        deltaE: deltaE,
                        uniqueKey: `${c.id}-${deltaE}`,
                        // Add convenience LAB properties for display
                        lab_l: compareColor.L,
                        lab_a: compareColor.a,
                        lab_b: compareColor.b,
                        // Update hex with recalculated value
                        hex: updatedHex
                    });

                    // Early exit optimization: if we have enough results within threshold, we can stop
                    const validThreshold = Math.max(0.1, Number(debouncedThreshold) || 0.1);
                    const withinThreshold = results.filter(r => r.deltaE <= validThreshold);
                    if (withinThreshold.length >= MAX_RESULTS * 2) {
                        console.log(`Early exit: found ${withinThreshold.length} results within threshold after ${i + 1} colors`);
                        break;
                    }

                    // Log progress for debugging
                    if (i % 100 === 0 && i > 0) {
                        console.log(`Processed ${i}/${maxToProcess} colors, found ${results.length} candidates so far`);
                    }
                } catch (deltaEError) {
                    console.error('Error calculating deltaE for color:', c.name, deltaEError);
                }
            }

            console.log('Calculation complete, results:', results.length);

            // Sort by deltaE and cache non-empty results only
            results.sort((a, b) => a.deltaE - b.deltaE);
            if (results.length > 0) {
                cacheRef.current.set(cacheKey, results);
            }

            // Filter by threshold and limit results (unified logic for all deltaE methods)
            const validThreshold = Math.max(0.1, Number(debouncedThreshold) || 0.1);
            const filtered = results.filter(c => c.deltaE <= validThreshold).slice(0, MAX_RESULTS);
            
            console.log('Final filtered results:', filtered.length);
            if (simDbg && results.length) {
                const sorted = [...results];
                const n = sorted.length;
                const pick = (q) => sorted[Math.min(n - 1, Math.floor(n * q))]?.deltaE;
                const mean = sorted.reduce((s, r) => s + (r.deltaE || 0), 0) / n;
                const buckets = {
                    le1: sorted.filter(r => r.deltaE <= 1).length,
                    le2: sorted.filter(r => r.deltaE <= 2).length,
                    le5: sorted.filter(r => r.deltaE <= 5).length,
                    le10: sorted.filter(r => r.deltaE <= 10).length,
                    gt10: sorted.filter(r => r.deltaE > 10).length,
                };
                sdebug.log('Fresh ΔE stats', { n, min: sorted[0]?.deltaE, p25: pick(0.25), p50: pick(0.5), p75: pick(0.75), max: sorted[n-1]?.deltaE, mean, buckets, underThreshold: filtered.length });
                sdebug.log('Top results', sorted.slice(0, 5).map(r => ({ id: r.id, name: r.name, dE: r.deltaE })));
            }
            
            // Store all results for uncapped analysis
            if (runIdRef.current === currentRunId) {
                setAnalysisColors(results);
            }
            
            // Fallback: if nothing within threshold, show best matches anyway
            if (runIdRef.current === currentRunId) {
                if (filtered.length === 0 && results.length > 0) {
                    console.log('No results within threshold; showing top matches as fallback');
                    setSimilarColors(results.slice(0, MAX_RESULTS));
                } else {
                    setSimilarColors(filtered);
                }
            }
        } catch (error) {
            console.error('Error in calculation:', error);
            setSimilarColors([]);
        } finally {
            if (simDbg) {
                sdebug.timeEnd(`similar-calc-${currentRunId}`);
            }
            console.log('Setting calculatingColors to false');
            if (runIdRef.current === currentRunId) {
                setCalculatingColors(false);
            }
        }
    }, [color, colors, colorsWithMeasurements, deltaEType, debouncedThreshold, controls, standards]);

    // Generate cache key for current parameters
    const getCacheKey = useCallback(() => {
        const enrichedFlag = !!colorsWithMeasurements;
        const validCount = colors?.reduce((acc, c) => {
            if (c.id === color?.id) return acc;
            const hasMeas = Array.isArray(c.measurements) && c.measurements.length > 0;
            const hasLabTop = (c.lab_l !== null && c.lab_a !== null && c.lab_b !== null);
            if (hasMeas) {
                const m = c.measurements[0];
                if (m?.lab || m?.spectral_data) return acc + 1;
            } else if (hasLabTop) {
                return acc + 1;
            }
            return acc;
        }, 0) || 0;
        
        return `${color?.id}-${deltaEType}-${threshold}-${controls?.mode || 'M0'}-${controls?.illuminant || 'D50'}-${controls?.observer || '2'}-${controls?.table || '5'}-${colors?.length || 0}-${validCount}-${enrichedFlag ? 'E' : 'C'}-v7`;
    }, [color?.id, deltaEType, threshold, controls?.mode, controls?.illuminant, controls?.observer, controls?.table, colors?.length, colorsWithMeasurements]);

    // Allow free typing in threshold input and persist to localStorage
    const handleThresholdChange = useCallback((newThreshold) => {
        console.log('SimilarColorsTab - Threshold change:', { 
            from: threshold, 
            to: newThreshold,
            type: typeof newThreshold
        });
        
        // Allow any value for typing, validation happens at calculation time
        setThreshold(newThreshold);
        
        // Persist to localStorage if it's a valid number
        if (Number.isFinite(newThreshold)) {
            localStorage.setItem('similarColors_threshold', String(newThreshold));
        }
    }, [threshold]);

    // Immediate calculation trigger when debounced threshold changes
    const triggerCalculation = useCallback(() => {
        console.log('triggerCalculation called - checking cache first for debounced threshold:', debouncedThreshold);
        
        // Check cache before setting loading state using debounced threshold
        const cacheKey = `${color?.id}-${deltaEType}-${debouncedThreshold}-${controls?.mode || 'M0'}-${controls?.illuminant || 'D50'}-${controls?.observer || '2'}-${controls?.table || '5'}-${colors?.length || 0}-${colors?.reduce((acc, c) => {
            if (c.id === color?.id) return acc;
            const hasMeas = Array.isArray(c.measurements) && c.measurements.length > 0;
            const hasLabTop = (c.lab_l !== null && c.lab_a !== null && c.lab_b !== null);
            if (hasMeas) {
                const m = c.measurements[0];
                if (m?.lab || m?.spectral_data) return acc + 1;
            } else if (hasLabTop) {
                return acc + 1;
            }
            return acc;
        }, 0) || 0}-${!!colorsWithMeasurements ? 'E' : 'C'}-v7`;
        
        if (cacheRef.current.has(cacheKey)) {
            console.log('Cache hit during threshold calculation - applying immediately');
            const cached = cacheRef.current.get(cacheKey);
            const validThreshold = Math.max(0.1, Number(debouncedThreshold) || 0.1);
            const filtered = cached.filter(c => c.deltaE <= validThreshold).slice(0, MAX_RESULTS);
            setAnalysisColors(cached);
            setSimilarColors(filtered);
            return;
        }
        
        console.log('triggerCalculation - no cache hit, starting calculation');
        setCalculatingColors(true);
        setSimilarColors([]);
        setAnalysisColors([]);
        calculateSimilarColors();
    }, [calculateSimilarColors, debouncedThreshold, deltaEType, color?.id, controls, colors, colorsWithMeasurements]);

    // Primary effect for non-threshold changes (immediate calculation)
    useEffect(() => {
        console.log('SimilarColorsTab - primary effect triggered', {
            activeTab,
            controlsReady,
            colorsLength: colors?.length,
            deltaEType,
            standardsLoading: standards?.loading,
            loadingColorMeasurements
        });
        if (activeTab !== 'similar') return;
        if (!controlsReady) return;
        if (!colors || colors.length === 0) return;
        if (loadingColorMeasurements) return;
        
        // Immediate calculation for non-threshold changes
        calculateSimilarColors();
    }, [activeTab, controlsReady, colors, deltaEType, standards?.loading, loadingColorMeasurements, calculateSimilarColors, refTopLab, controls, refCurrentLab]);

    // Separate effect for debounced threshold changes
    useEffect(() => {
        console.log('SimilarColorsTab - threshold effect triggered', {
            debouncedThreshold,
            activeTab,
            controlsReady
        });
        if (activeTab !== 'similar') return;
        if (!controlsReady) return;
        if (!colors || colors.length === 0) return;
        if (loadingColorMeasurements) return;
        
        triggerCalculation();
    }, [debouncedThreshold, activeTab, controlsReady, colors, loadingColorMeasurements, triggerCalculation]);

    console.log('SimilarColorsTab - RENDER STATE:', {
        hasColor: !!color,
        hasColors: !!colors,
        colorsLength: colors?.length,
        loading,
        calculatingColors,
        similarColorsLength: similarColors?.length,
        deltaEType,
        threshold
    });

    // Add state change logging
    useEffect(() => {
        console.log('SimilarColorsTab - calculatingColors state changed to:', calculatingColors);
    }, [calculatingColors]);

    useEffect(() => {
        console.log('SimilarColorsTab - similarColors state changed:', {
            length: similarColors?.length,
            firstFew: similarColors?.slice(0, 3)?.map(c => ({ id: c.id, name: c.name, deltaE: c.deltaE }))
        });
    }, [similarColors]);

    if (!color) {
        console.log('SimilarColorsTab - No color data, returning error message');
        return <div>Color data not available.</div>;
    }

    console.log('SimilarColorsTab - About to render main UI');

    try {
        console.log('SimilarColorsTab - Starting render with props:', {
            deltaEType,
            threshold,
            calculatingColors: loading || calculatingColors,
            similarColorsLength: similarColors?.length
        });

    return (
        <Card className="h-full">
            <CardContent className="p-4 h-full">
                <div className="flex-grow flex gap-2 overflow-hidden h-full">
                      <AnimatePresence>
                <motion.div 
                  key="main-panel"
                  className="w-2/3 h-full flex min-h-0"
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2, ease: "easeInOut" }}
                >
                  {(() => {
                    console.log('SimilarColorsTab - Rendering main panel');
                    return (
                      <div className="h-full w-full min-h-0 flex overflow-hidden shadow-lg rounded-lg border bg-card">
                         <div className="w-1/4 flex-shrink-0">
                           {(() => {
                              console.log('SimilarColorsTab - Rendering SimilarReferencePanel');
                              return <SimilarReferencePanel color={color} controls={controls} standards={standards} activeDataMode={activeDataMode} onLabUpdate={handleReferenceLabUpdate} isCalculating={calculatingColors} />;
                            })()}
                        </div>
                        <div className="w-3/4 h-full flex flex-col min-h-0">
                          {(() => {
                            console.log('SimilarColorsTab - Rendering SimilarColorsList with props:', {
                              colorsLength: similarColors?.length,
                              deltaEType,
                              loading: loading || loadingColorMeasurements || calculatingColors,
                              threshold
                            });
                            return (
                               <SimilarColorsList 
                                 colors={filteredColors.length > 0 ? filteredColors : similarColors} 
                                 deltaEType={deltaEType} 
                                 loading={loading || loadingColorMeasurements || calculatingColors}
                                 setDeltaEType={handleDeltaEChange}
                                 threshold={threshold}
                                 setThreshold={handleThresholdChange}
                                 selectedSimilarId={selectedSimilarId}
                                 onSelectSimilar={handleSelectSimilar}
                                 selectedStatsRow={selectedStatsRow}
                                 onStatsRowProcessed={() => setSelectedStatsRow(null)}
                                 illuminantKey={normalizeIlluminantKey(controls?.illuminant)}
                               />
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
                <motion.div 
                  key="analysis-panel"
                  className="w-1/3 h-full flex-shrink-0"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4, ease: "easeInOut" }}
                >
                  {(() => {
                    console.log('SimilarColorsTab - Rendering SimilarAnalysisPanel');
                    return (
                       <SimilarAnalysisPanel 
                         masterColor={color} 
                         similarColors={similarColors}
                         deltaEType={deltaEType} 
                         referenceLab={referenceLab || (color?.measurements?.[0]?.lab ? { L: color.measurements[0].lab.L || 0, a: color.measurements[0].lab.a || 0, b: color.measurements[0].lab.b || 0 } : null)}
                         threshold={debouncedThreshold}
                         selectedSimilarId={selectedSimilarId}
                         onSelectSimilar={handleSelectSimilar}
                         illuminantKey={normalizeIlluminantKey(controls?.illuminant)}
                         loading={loading || loadingColorMeasurements || calculatingColors}
                         onFilteredColorsChange={handleFilteredColorsChange}
                         onStatsRowSelect={handleStatsRowSelect}
                       />
                    );
                  })()}
                </motion.div>
                      </AnimatePresence>
                    </div>
                </CardContent>
            </Card>
        );
    } catch (error) {
        console.error('SimilarColorsTab - Render error:', error);
        return <div>Error rendering similar colors: {error.message}</div>;
    }
};

const AnalysisSkeleton = () => (
    <div className="flex-grow flex p-1 gap-4 overflow-hidden h-[calc(100vh-250px)]">
        <div className="w-1/6"><Skeleton className="h-full w-full" /></div>
        <div className="w-1/2"><Skeleton className="h-full w-full" /></div>
        <div className="w-1/3"><Skeleton className="h-full w-full" /></div>
    </div>
);

export default SimilarColorsTab;