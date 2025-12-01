import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { normalizeTints, getTintPercentage, safeSpectralData } from '@/lib/tintsUtils';
import { computeAdaptedSpectralRatio } from '@/lib/spectralAdaptation';
import { computeTwoStepSubstrateAdaptation } from '@/lib/inkSubstrateAdaptation';
import { pickBestMeasurement } from '@/lib/measurementSelection';
import { normalizeMode, getModeFromMeasurement, getMeasurementByMode } from '@/lib/utils/colorMeasurementSelection';

/**
 * Hook to determine and fetch the correct spectral data source for a color
 * Handles the logic for ink-based vs regular colors
 * @param {Object} color - The color object
 * @param {string} activeDataMode - 'imported' or 'adapted' for ink-based colors
 * @param {Object} printConditionSubstrateSpectral - Substrate spectral data for adaptation
 * @param {string} measurementMode - The measurement mode (M0, M1, M2, etc.) to filter by
 */
export const useColorSpectralData = (color, activeDataMode, printConditionSubstrateSpectral, measurementMode = null, skipInkFetch = false) => {
  // Determine if this color should use ink condition data
  const isInkBased = !!color?.from_ink_condition_id;
  // Local state-based fetch to avoid requiring React Query context
  const [inkConditionData, setInkConditionData] = useState(null);
  const [inkConditionLoading, setInkConditionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Skip ink fetch if requested (e.g., from Color Info tab)
      if (skipInkFetch) {
        setInkConditionData(null);
        setInkConditionLoading(false);
        return;
      }
      
      if (!color?.from_ink_condition_id) {
        setInkConditionData(null);
        setInkConditionLoading(false);
        return;
      }
      setInkConditionLoading(true);
      try {
        const { data, error } = await supabase
          .from('ink_conditions')
          .select('*')
          .eq('id', color.from_ink_condition_id)
          .maybeSingle();
        if (!cancelled) {
          if (error) {
            console.error('Error fetching ink condition:', error);
            setInkConditionData(null);
          } else {
            setInkConditionData(data);
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Error fetching ink condition:', e);
          setInkConditionData(null);
        }
      } finally {
        if (!cancelled) setInkConditionLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [color?.from_ink_condition_id, skipInkFetch]);

  // Helper function to find 100% solid measurement - STRICT 100% only
  // Now filters by measurement mode if provided
const findSolidMeasurement = (measurements, preferredMode = null) => {
  if (!measurements?.length) return null;

  // Start with all candidates; narrow to preferred mode if available
  let candidates = measurements;
  if (preferredMode) {
    const modeMatched = measurements.filter((m) => {
      const mode = (typeof getModeFromMeasurement === 'function' ? getModeFromMeasurement(m) : m.mode);
      return mode === preferredMode;
    });
    if (modeMatched.length > 0) {
      console.debug('findSolidMeasurement: using preferredMode subset', { preferredMode, count: modeMatched.length });
      candidates = modeMatched;
    } else {
      console.debug('findSolidMeasurement: no matches for preferredMode, keeping full set', { preferredMode, total: measurements.length });
    }
  }

  // Annotate candidates with normalized pct and data availability
  const annotated = candidates.map((m) => {
    const pct = getTintPercentage(m);
    const spectral = safeSpectralData(m);
    const hasSpectral = spectral && Object.keys(spectral).length > 0;
    const hasLab = !!m.lab || (m.lab_l != null && m.lab_a != null && m.lab_b != null);
    console.debug('findSolidMeasurement: candidate', { id: m.id, pct, hasSpectral, hasLab, mode: m.mode });
    return { m, pct, hasSpectral, hasLab };
  });

  // Priority 1: explicit 100% with spectral
  const solid100Spectral = annotated.find((a) => a.pct === 100 && a.hasSpectral)?.m;
  if (solid100Spectral) {
    console.debug('findSolidMeasurement: selected 100% with spectral', { id: solid100Spectral.id });
    return solid100Spectral;
  }

  // Priority 2: explicit 100% with LAB
  const solid100Lab = annotated.find((a) => a.pct === 100 && a.hasLab)?.m;
  if (solid100Lab) {
    console.debug('findSolidMeasurement: selected 100% with lab', { id: solid100Lab.id });
    return solid100Lab;
  }

  // Priority 3: highest non-zero with spectral
  const nonZeroSpectral = annotated.filter((a) => a.pct > 0 && a.hasSpectral);
  if (nonZeroSpectral.length > 0) {
    const best = nonZeroSpectral.reduce((max, a) => (a.pct > max.pct ? a : max)).m;
    console.debug('findSolidMeasurement: selected highest non-zero with spectral', { id: best.id });
    return best;
  }

  // Priority 4: highest non-zero with LAB
  const nonZeroLab = annotated.filter((a) => a.pct > 0 && a.hasLab);
  if (nonZeroLab.length > 0) {
    const best = nonZeroLab.reduce((max, a) => (a.pct > max.pct ? a : max)).m;
    console.debug('findSolidMeasurement: selected highest non-zero with lab', { id: best.id });
    return best;
  }

  console.debug('findSolidMeasurement: no usable solid found');
  return null;
};

  // Note: normalizeMode, getModeFromMeasurement, and getMeasurementByMode are now imported from colorMeasurementSelection.js

  // Determine the current data source
  const spectralDataSource = useMemo(() => {
    if (!color) return { source: 'none', data: null, isLoading: false };
    
    // For non-ink-based colors, activeDataMode does not apply; proceed.
    
    // For ink-based colors, fetch the appropriate dataset first, then filter for 100% solid
    if (isInkBased) {
      if (activeDataMode === 'adapted') {
        console.log('useColorSpectralData: Looking for adapted 100% solid in measurements', {
          colorName: color.name,
          hasAdaptedData: color.hasAdaptedData,
          measurementCount: color.measurements?.length || 0,
          tintPercentages: color.measurements?.map(m => m.tint_percentage) || [],
          modes: color.measurements?.map(m => m.mode) || []
        });
        
        // First try to find 100% solid in adapted measurements (color.measurements)
        // Filter by measurement mode if provided
        const adaptedSolid = findSolidMeasurement(color.measurements, measurementMode);
        
        if (adaptedSolid) {
          console.log('useColorSpectralData: Using adapted solid (100%) measurement');
          return {
            source: 'color_measurements',
            data: {
              spectral_data: adaptedSolid.spectral_data,
              lab: adaptedSolid.lab,
              ch: null
            },
            isLoading: false
          };
        }
        
        // STRICT ADAPTED MODE: If no adapted solid found, don't compute from imported
        // Return null data to indicate adapted data is not available
        if (inkConditionLoading || !inkConditionData) {
          return { source: 'adapted_pending', data: null, isLoading: true };
        }

        // Only compute adapted data if we have the necessary substrate data
        if (inkConditionData?.imported_tints && printConditionSubstrateSpectral && Object.keys(printConditionSubstrateSpectral || {}).length > 0) {
          const normalizedTints = normalizeTints(inkConditionData.imported_tints);
          const importedSolid = findSolidMeasurement(normalizedTints, measurementMode);
          
          if (importedSolid) {
            console.log('useColorSpectralData: Computing adapted spectral using print condition substrate');
const importedZero = normalizedTints.find(t => (t.tintPercentage ?? t.tint_percentage) === 0);
const importedSubstrateSpectralObj = importedZero ? safeSpectralData(importedZero) : {};
const importedSpectral = safeSpectralData(importedSolid);
let adaptedSpectralData;
if (importedZero && Object.keys(importedSubstrateSpectralObj).length > 0) {
  adaptedSpectralData = computeTwoStepSubstrateAdaptation(
    importedSubstrateSpectralObj,
    importedSpectral,
    printConditionSubstrateSpectral,
    100,
    { enableLogging: true }
  );
} else {
  console.warn('useColorSpectralData: No 0% imported substrate found, falling back to single-step adaptation');
  adaptedSpectralData = computeAdaptedSpectralRatio(
    printConditionSubstrateSpectral,
    importedSpectral,
    100
  );
}
            
            return {
              source: 'computed_adapted',
              data: {
                spectral_data: adaptedSpectralData,
                lab: null, // Will be calculated by consuming component
                ch: null
              },
              isLoading: false
            };
          }
        }
        
        // STRICT: In adapted mode, if we can't compute adapted data, return null - no fallback to imported
        console.log('useColorSpectralData: Adapted mode but cannot compute adapted data (missing substrate or solid tint)');
        return { source: 'adapted_unavailable', data: null, isLoading: false };
      }

      if (activeDataMode === 'imported') {
        // If still loading ink condition data, return pending state
        if (inkConditionLoading || !inkConditionData) {
          return { source: 'imported_pending', data: null, isLoading: true };
        }
        
        console.log('useColorSpectralData: Looking for imported 100% solid in ink condition', {
          hasInkCondition: !!inkConditionData,
          inkConditionId: color.from_ink_condition_id
        });
        
        // For imported mode, look for 100% solid in ink condition imported_tints
        if (inkConditionData?.imported_tints) {
          const normalizedTints = normalizeTints(inkConditionData.imported_tints);
          console.log('useColorSpectralData: Normalized imported tints', {
            originalCount: inkConditionData.imported_tints?.length || 0,
            normalizedCount: normalizedTints.length,
            tintPercentages: normalizedTints.map(t => t.tintPercentage || t.tint_percentage)
          });
          
          if (normalizedTints.length > 0) {
            const importedSolid = findSolidMeasurement(normalizedTints, measurementMode);
            
            if (importedSolid) {
              console.log('useColorSpectralData: Using imported solid (100%) measurement from normalized tints');
              return {
                source: 'ink_condition_tints',
                data: {
                  spectral_data: safeSpectralData(importedSolid),
                  lab: importedSolid.lab,
                  ch: null
                },
                isLoading: inkConditionLoading
              };
            }
          }
        }
        
        // No substrate fallback - if we can't find 100% solid, return no data
        console.warn('useColorSpectralData: No 100% solid found in imported tints');
        return { source: 'imported_unavailable', data: null, isLoading: false };
        
        console.log('useColorSpectralData: No imported data found, returning imported_pending');
        return { source: 'imported_pending', data: null, isLoading: true };
      }
    }

    // Regular color - use mode-based selection (no tint logic)
    if (!isInkBased && color.measurements?.length > 0) {
      const measurement = getMeasurementByMode(color.measurements, measurementMode);
      
      if (measurement) {
        console.info('[useColorSpectralData] Selected measurement for basic color:', {
          colorName: color.name,
          measurementId: measurement.id,
          selectedMode: getModeFromMeasurement(measurement),
          requestedMode: measurementMode,
          hasSpectral: !!measurement.spectral_data,
          hasLab: !!measurement.lab
        });
        
        return {
          source: 'color_measurements',
          data: {
            spectral_data: measurement.spectral_data || null,
            lab: measurement.lab || null,
            ch: null,
            selected_mode: getModeFromMeasurement(measurement)
          },
          isLoading: false
        };
      }
      
      console.warn('[useColorSpectralData] No valid measurement found for basic color:', {
        colorName: color.name,
        requestedMode: measurementMode,
        measurementCount: color.measurements.length
      });
    }

    return { source: 'none', data: null, isLoading: inkConditionLoading };
  }, [color, isInkBased, activeDataMode, inkConditionData, inkConditionLoading, printConditionSubstrateSpectral, measurementMode]);

  // Determine available data sources for this color
  const availableDataSources = useMemo(() => {
    const sources = [];
    
    if (isInkBased) {
      // For ink-based colors, check both adapted and imported data sources
      
      // Check if imported data is available (ink condition with imported_tints or substrate)
      const normalizedTints = inkConditionData?.imported_tints ? normalizeTints(inkConditionData.imported_tints) : [];
      const hasImportedData = !!inkConditionData && (
        (normalizedTints.length > 0) || 
        (inkConditionData.spectral_data && Object.keys(inkConditionData.spectral_data).length > 0)
      );
      
      if (hasImportedData) {
        sources.push({ id: 'imported', label: 'Imported Data', available: true });
      }
      
      // Check if adapted data is available (measurements on the color with non-zero tints OR is_adapted flag OR can compute from imported + substrate)
      const hasAdaptedMeasurements = color?.measurements?.some(m => {
        const tintPercent = typeof m.tint_percentage === 'string' 
          ? parseFloat(m.tint_percentage)
          : m.tint_percentage;
        const hasSpectral = m.spectral_data && Object.keys(m.spectral_data).length > 0;
        const isNonZeroTint = tintPercent > 0;
        
        return (m.mode === 'adapted' || hasSpectral) && isNonZeroTint;
      });
      const hasAdaptedFlag = !!color?.hasAdaptedData;
      const canComputeAdapted = hasImportedData && printConditionSubstrateSpectral && Object.keys(printConditionSubstrateSpectral || {}).length > 0;
      
      const hasAdaptedData = hasAdaptedMeasurements || hasAdaptedFlag || canComputeAdapted;
      
      if (hasAdaptedData) {
        sources.push({ id: 'adapted', label: 'Adapted Data', available: true });
      }
      
      console.log('[useColorSpectralData] Available data sources for ink-based color:', {
        colorName: color?.name,
        hasImportedData,
        hasAdaptedMeasurements,
        hasAdaptedFlag,
        canComputeAdapted,
        hasAdaptedData,
        sources: sources.map(s => s.id)
      });
    } else {
      // For regular colors, only measurements are available
      if (color?.measurements?.length > 0) {
        sources.push({ id: 'imported', label: 'Measured Data', available: true });
      }
    }
    
    return sources;
  }, [color?.measurements, color?.hasAdaptedData, isInkBased, inkConditionData, inkConditionLoading, printConditionSubstrateSpectral]);

  return {
    spectralDataSource,
    availableDataSources,
    isInkBased,
    canSwitchDataSource: availableDataSources.length > 1
  };
};