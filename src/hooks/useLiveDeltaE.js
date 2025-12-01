import { useMemo } from 'react';
import { calculateDeltaE } from '@/lib/deltaE';
import { spectralToLabASTME308 } from '@/lib/colorUtils/colorConversion';
import { useAstmTablesCache } from './useAstmTablesCache';
import { debug } from '@/lib/debugUtils';

/**
 * Utility: parse various Lab representations (string, array, object) into {L,a,b}
 */
function parseLabAny(lab) {
  if (!lab) return null;
  // Object form
  if (typeof lab === 'object' && !Array.isArray(lab)) {
    const L = lab.L ?? lab.l;
    const a = lab.a ?? lab.A;
    const b = lab.b ?? lab.B;
    if ([L, a, b].every(v => v != null && !isNaN(Number(v)))) {
      return { L: Number(L), a: Number(a), b: Number(b) };
    }
    return null;
  }
  // Array form [L,a,b]
  if (Array.isArray(lab)) {
    const [L, a, b] = lab;
    if ([L, a, b].every(v => v != null && !isNaN(Number(v)))) {
      return { L: Number(L), a: Number(a), b: Number(b) };
    }
    return null;
  }
  // String form like "L: 50, a: 10, b: -5" or "50 10 -5"
  if (typeof lab === 'string') {
    const nums = lab.match(/-?\d+(?:\.\d+)?/g);
    if (nums && nums.length >= 3) {
      const [L, a, b] = nums.slice(0, 3).map(Number);
      if ([L, a, b].every(v => !isNaN(v))) {
        return { L, a, b };
      }
    }
    return null;
  }
  return null;
}

/**
 * Hook for live Delta E calculation based on measurement data
 * @param {Object} referenceColor - Reference color with measurements
 * @param {Object} matchedColor - Matched color with Lab values
 * @param {Object} settings - Measurement settings {mode, illuminant, observer}
 */
export function useLiveDeltaE(referenceColor, matchedColor, settings = {}) {
  const { illuminant = 'D50', observer = '2', mode, table = '5', deltaE: deltaEMethod = 'dE00' } = settings;
  const { astmTables } = useAstmTablesCache();

  return useMemo(() => {
    if (!referenceColor || !matchedColor) {
      return { deltaE: null, referenceLab: null, matchedLab: null, source: 'no-data' };
    }

    console.log('useLiveDeltaE - Input data:', {
      referenceColor: referenceColor?.name || 'unnamed',
      matchedColor: matchedColor?.name || 'unnamed',
      settings,
      refMeasurements: referenceColor?.measurements?.length || 0,
      matchMeasurements: matchedColor?.measurements?.length || 0
    });

    // Get reference Lab values
    let referenceLab = null;
    let source = 'unknown';

    // Priority 1: Use measurement data with preferred settings (responsive to controls)
    if (referenceColor.measurements && referenceColor.measurements.length > 0) {
      console.debug('useLiveDeltaE - Scanning reference measurements for usable data');
      
      // Helper function to extract Lab from a measurement
      const extractLabFromMeasurement = (measurement) => {
        let lab = null;
        let extractionSource = null;
        
        // Try spectral data first (more responsive to settings)
        if (measurement.spectral_data && astmTables.length > 0) {
          try {
            const weightingTable = astmTables.filter(t => 
              t.illuminant_name === illuminant && 
              t.observer === observer &&
              t.table_number.toString() === table
            );
            
            if (weightingTable.length > 0) {
              lab = spectralToLabASTME308(
                measurement.spectral_data,
                weightingTable
              );
              extractionSource = 'spectral-derived';
            }
          } catch (error) {
            debug.warn('Failed to derive Lab from spectral data:', error);
          }
        }
        
        // Fallback to stored Lab values if spectral derivation failed
        if (!lab && measurement.lab) {
          const parsed = parseLabAny(measurement.lab);
          if (parsed) {
            lab = parsed;
            extractionSource = 'measurement-lab';
          }
        }
        
        return { lab, source: extractionSource };
      };
      
      // Search strategy: prioritize mode match, then illuminant/observer match, then any measurement
      const searchOrder = [
        // 1. Mode matches
        referenceColor.measurements.filter(m => 
          (m.mode || m.measurement_condition || m.condition)?.toUpperCase() === settings.mode?.toUpperCase()
        ),
        // 2. Illuminant/observer matches
        referenceColor.measurements.filter(m => 
          m.illuminant === illuminant && m.observer === observer
        ),
        // 3. All measurements
        referenceColor.measurements
      ];
      
      for (const measurementGroup of searchOrder) {
        for (const measurement of measurementGroup) {
          const { lab, source: extractionSource } = extractLabFromMeasurement(measurement);
          if (lab) {
            referenceLab = lab;
            source = extractionSource;
            console.debug('useLiveDeltaE - Reference Lab extracted:', { source: extractionSource, measurementId: measurement.id });
            break;
          }
        }
        if (referenceLab) break;
      }
    }
    // Priority 2: Fallback to static Lab values from colors table 
    else if (referenceColor.lab_l != null && !isNaN(referenceColor.lab_l) && 
             referenceColor.lab_a != null && !isNaN(referenceColor.lab_a) && 
             referenceColor.lab_b != null && !isNaN(referenceColor.lab_b)) {
      referenceLab = {
        L: Number(referenceColor.lab_l),
        a: Number(referenceColor.lab_a),
        b: Number(referenceColor.lab_b)
      };
      source = 'color-lab';
    }
    // Priority 3: Fallback to a generic lab field (string/object/array)
    else if (referenceColor.lab) {
      const parsed = parseLabAny(referenceColor.lab);
      if (parsed) {
        referenceLab = parsed;
        source = 'color-lab';
      }
    }

    // Get matched Lab values
    let matchedLab = null;
    
    console.log('useLiveDeltaE - Matched color structure:', {
      hasDirectLab: !!(matchedColor.lab_l != null && matchedColor.lab_a != null && matchedColor.lab_b != null),
      hasLabObject: !!(matchedColor.lab && typeof matchedColor.lab === 'object'),
      measurementsCount: matchedColor.measurements?.length || 0,
      measurementStructure: matchedColor.measurements?.[0] && Object.keys(matchedColor.measurements[0])
    });
    
    // Priority 1: Use measurement data with preferred settings (responsive to controls) 
    if (matchedColor.measurements && matchedColor.measurements.length > 0) {
      console.debug('useLiveDeltaE - Scanning matched measurements for usable data');
      
      // Helper function to extract Lab from a measurement
      const extractLabFromMeasurement = (measurement) => {
        let lab = null;
        let extractionSource = null;
        
        // Try spectral data first (more responsive to settings)
        if (measurement.spectral_data && astmTables.length > 0) {
          try {
            const weightingTable = astmTables.filter(t => 
              t.illuminant_name === illuminant && 
              t.observer === observer &&
              t.table_number.toString() === table
            );
            
            if (weightingTable.length > 0) {
              lab = spectralToLabASTME308(
                measurement.spectral_data,
                weightingTable
              );
              extractionSource = 'spectral-derived';
            }
          } catch (error) {
            debug.warn('Failed to derive Lab from spectral data:', error);
          }
        }
        
        // Fallback to stored Lab values if spectral derivation failed
        if (!lab && measurement.lab) {
          const parsed = parseLabAny(measurement.lab);
          if (parsed) {
            lab = parsed;
            extractionSource = 'measurement-lab';
          }
        }
        
        return { lab, source: extractionSource };
      };
      
      // Search strategy: prioritize mode match, then illuminant/observer match, then any measurement
      const searchOrder = [
        // 1. Mode matches
        matchedColor.measurements.filter(m => 
          (m.mode || m.measurement_condition || m.condition)?.toUpperCase() === settings.mode?.toUpperCase()
        ),
        // 2. Illuminant/observer matches
        matchedColor.measurements.filter(m => 
          m.illuminant === illuminant && m.observer === observer
        ),
        // 3. All measurements
        matchedColor.measurements
      ];
      
      for (const measurementGroup of searchOrder) {
        for (const measurement of measurementGroup) {
          const { lab, source: extractionSource } = extractLabFromMeasurement(measurement);
          if (lab) {
            matchedLab = lab;
            console.debug('useLiveDeltaE - Matched Lab extracted:', { source: extractionSource, measurementId: measurement.id });
            break;
          }
        }
        if (matchedLab) break;
      }
    }
    // Priority 2: Direct lab_l, lab_a, lab_b fields
    else if (matchedColor.lab_l != null && !isNaN(matchedColor.lab_l) && 
             matchedColor.lab_a != null && !isNaN(matchedColor.lab_a) && 
             matchedColor.lab_b != null && !isNaN(matchedColor.lab_b)) {
      matchedLab = {
        L: Number(matchedColor.lab_l),
        a: Number(matchedColor.lab_a),
        b: Number(matchedColor.lab_b)
      };
    }
    // Priority 3: Generic lab field (string/object/array)
    else if (matchedColor.lab) {
      const parsed = parseLabAny(matchedColor.lab);
      if (parsed) {
        matchedLab = parsed;
      }
    }

    // Calculate Delta E if both Lab values are available
    let deltaE = null;
    if (referenceLab && matchedLab) {
      try {
        deltaE = calculateDeltaE(referenceLab, matchedLab, deltaEMethod);
        console.log('useLiveDeltaE - Calculated deltaE:', {
          deltaE,
          deltaEMethod,
          referenceLab,
          matchedLab
        });
      } catch (error) {
        debug.warn('Delta E calculation failed:', error);
      }
    } else {
      console.log('useLiveDeltaE - Missing Lab values:', { referenceLab, matchedLab });
    }

    return {
      deltaE: Number.isFinite(deltaE) ? Number(deltaE.toFixed(2)) : null,
      referenceLab,
      matchedLab,
      source,
      measurementSettings: { illuminant, observer, mode, deltaE: deltaEMethod }
    };
  }, [referenceColor, matchedColor, illuminant, observer, settings.mode, table, deltaEMethod, astmTables]);
}

/**
 * Hook for calculating multiple color difference metrics
 */
export function useLiveColorMetrics(referenceColor, matchedColor, settings = {}) {
  const { deltaE, referenceLab, matchedLab, source } = useLiveDeltaE(referenceColor, matchedColor, settings);

  const metrics = useMemo(() => {
    if (!referenceLab || !matchedLab) {
      return null;
    }

    const dL = matchedLab.L - referenceLab.L;
    const dA = matchedLab.a - referenceLab.a;
    const dB = matchedLab.b - referenceLab.b;
    
    // Calculate chroma and hue differences
    const refChroma = Math.sqrt(referenceLab.a ** 2 + referenceLab.b ** 2);
    const matchChroma = Math.sqrt(matchedLab.a ** 2 + matchedLab.b ** 2);
    const dC = matchChroma - refChroma;
    
    const refHue = Math.atan2(referenceLab.b, referenceLab.a) * 180 / Math.PI;
    const matchHue = Math.atan2(matchedLab.b, matchedLab.a) * 180 / Math.PI;
    let dH = matchHue - refHue;
    if (dH > 180) dH -= 360;
    if (dH < -180) dH += 360;

    return {
      dE: deltaE,
      dL: Number(dL.toFixed(2)),
      dA: Number(dA.toFixed(2)),
      dB: Number(dB.toFixed(2)),
      dC: Number(dC.toFixed(2)),
      dH: Number(dH.toFixed(2)),
      source
    };
  }, [deltaE, referenceLab, matchedLab, source]);

  return metrics;
}