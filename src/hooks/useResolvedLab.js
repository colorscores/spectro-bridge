import { useMemo } from 'react';
import { useSpectralCalculations } from '@/hooks/useSpectralCalculations';
import { normalizeMode, getModeFromMeasurement } from '@/lib/utils/colorMeasurementSelection';

// Normalize various Lab shapes to { L, a, b } numbers
const normalizeLabObject = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  const L = Number(obj.L ?? obj.l);
  const a = Number(obj.a ?? obj.A);
  const b = Number(obj.b ?? obj.B);
  if ([L, a, b].every((v) => Number.isFinite(v))) return { L, a, b };
  return null;
};

const normalizeLabColumns = (cols) => {
  if (!cols) return null;
  const L = Number(cols.lab_l);
  const a = Number(cols.lab_a);
  const b = Number(cols.lab_b);
  if ([L, a, b].every((v) => Number.isFinite(v))) return { L, a, b };
  return null;
};

/**
 * useResolvedLab
 * A unified resolver that determines Lab from multiple potential sources with a consistent priority order.
 *
 * Options:
 * - spectralData: object map of wavelength->reflectance
 * - labObject: {L/a/b} or variations (l,A,B)
 * - labColumns: { lab_l, lab_a, lab_b }
 * - altLabObject: secondary Lab object (e.g., target or nested)
 * - priority: array in ['columns','object','altObject','spectral']
 * - illuminant, observer, tableNumber
 * - debugLabel: optional string for logging
 */
export const useResolvedLab = ({
  spectralData,
  labObject,
  labColumns,
  altLabObject,
  priority = ['spectral', 'object', 'columns', 'altObject'],
  illuminant = 'D50',
  observer = '2',
  tableNumber = '5',
  debugLabel,
} = {}) => {
  const { lab: spectralLab } = useSpectralCalculations(
    spectralData,
    illuminant,
    observer,
    tableNumber
  );

  const resolved = useMemo(() => {
    const candidates = {
      columns: normalizeLabColumns(labColumns),
      object: normalizeLabObject(labObject),
      altObject: normalizeLabObject(altLabObject),
      spectral: spectralLab && [spectralLab.L, spectralLab.a, spectralLab.b].every(Number.isFinite) ? spectralLab : null,
    };

    for (const key of priority) {
      const value = candidates[key];
      if (value) {
        if (import.meta.env.DEV && debugLabel) {
          console.debug(`[useResolvedLab] ${debugLabel} -> Resolved using:`, key, value);
        }
        return { lab: value, source: key, details: candidates };
      }
    }

    if (import.meta.env.DEV && debugLabel) {
      console.debug(`[useResolvedLab] ${debugLabel} -> No Lab resolved`, {
        hasSpectral: !!spectralData,
        candidatesTried: priority,
      });
    }
    return { lab: null, source: null, details: candidates };
  }, [labColumns, labObject, altLabObject, spectralLab, spectralData, priority, debugLabel]);

  return resolved;
};

// Helper: Find spectral data matching a specific mode without falling back to other modes
const findSpectralByMode = (measurementsArray, requiredMode) => {
  const targetMode = normalizeMode(requiredMode);
  if (!measurementsArray?.length || !targetMode) return null;
  
  const match = measurementsArray.find(m => 
    getModeFromMeasurement(m) === targetMode && 
    m?.spectral_data && 
    Object.keys(m.spectral_data || {}).length > 0
  );
  
  return match?.spectral_data || null;
};

// Convenience: Resolve Lab for a match "measurement" row
export const useResolvedLabFromMatchMeasurement = (measurement, opts = {}) => {
  const { requiredMode, ...restOpts } = opts;

  // Mode-aware spectral data selection - STRICT when requiredMode is specified
  let spectralData = null;
  if (requiredMode) {
    // Try to find measurements array in either location
    const measurementsArray = measurement?.measurements || 
                             measurement?.matched_color_data?.measurements;
    
    if (measurementsArray && Array.isArray(measurementsArray)) {
      spectralData = findSpectralByMode(measurementsArray, requiredMode);
      
      if (spectralData && import.meta.env.DEV) {
        console.log(`[useResolvedLabFromMatchMeasurement] ✅ Found spectral data for mode ${requiredMode}`, {
          source: measurement?.measurements ? 'measurement.measurements' : 'matched_color_data.measurements',
        });
      } else if (!spectralData && import.meta.env.DEV) {
        const availableModes = measurementsArray.map(m => getModeFromMeasurement(m)).filter(Boolean);
        console.warn(`[useResolvedLabFromMatchMeasurement] ⚠️ Mode ${requiredMode} not found - will not fall back to other modes`, {
          availableModes
        });
      }
    }
    // When requiredMode is specified but not found, do NOT fall back to generic spectral fields
  } else {
    // Only when no requiredMode: allow best-effort fallback
    spectralData =
      measurement?.matched_color_data?.spectralData ||
      measurement?.matched_color_data?.spectral_data ||
      measurement?.spectral_data ||
      measurement?.spectralData ||
      null;
  }

  const labColumns = measurement ? {
    lab_l: measurement.lab_l,
    lab_a: measurement.lab_a,
    lab_b: measurement.lab_b,
  } : null;
  const labObject = measurement?.matched_color_data?.lab || null;

  return useResolvedLab({
    spectralData: spectralData || null,
    labObject: labObject || null,
    labColumns: labColumns || null,
    altLabObject: null,
    priority: ['spectral', 'object', 'columns'],
    debugLabel: requiredMode ? `match-measurement (mode:${requiredMode})` : 'match-measurement',
    illuminant: restOpts.illuminant || 'D50',
    observer: restOpts.observer || '2',
    tableNumber: restOpts.tableNumber || '5',
  });
};

// Convenience: Resolve Lab for the reference color using measurement and color_measurements fallback
export const useResolvedLabFromReference = (measurement, colorMeasurements, opts = {}) => {
  const { requiredMode, ...restOpts } = opts;

  // 1) Prefer explicit reference columns or color columns
  const refCols = measurement ? {
    lab_l: measurement.reference_lab_l ?? measurement.colors?.lab_l,
    lab_a: measurement.reference_lab_a ?? measurement.colors?.lab_a,
    lab_b: measurement.reference_lab_b ?? measurement.colors?.lab_b,
  } : null;

  // 2) Next, check color_measurements for Lab object and spectral data - STRICT mode selection
  let labObject = null;
  let spectralData = null;
  if (Array.isArray(colorMeasurements) && colorMeasurements.length) {
    if (requiredMode) {
      // Strict mode-aware selection: only use spectral data if it matches the required mode
      spectralData = findSpectralByMode(colorMeasurements, requiredMode);
      
      if (spectralData && import.meta.env.DEV) {
        console.log(`[useResolvedLabFromReference] ✅ Found spectral data for mode ${requiredMode}`);
      } else if (!spectralData) {
        // Try to find Lab object for the required mode
        const targetMode = normalizeMode(requiredMode);
        const mWithLab = colorMeasurements.find(m => 
          getModeFromMeasurement(m) === targetMode && m?.lab
        );
        if (mWithLab?.lab) {
          labObject = mWithLab.lab;
          if (import.meta.env.DEV) {
            console.log(`[useResolvedLabFromReference] ✅ Found Lab object for mode ${requiredMode}`);
          }
        } else if (import.meta.env.DEV) {
          const availableModes = colorMeasurements.map(m => getModeFromMeasurement(m)).filter(Boolean);
          console.warn(`[useResolvedLabFromReference] ⚠️ Mode ${requiredMode} not found - will not fall back to other modes`, {
            availableModes
          });
        }
      }
      // When requiredMode is specified but not found, do NOT fall back to arbitrary modes
    } else {
      // Only when no requiredMode: allow best-effort fallback
      const mWithSpectral = colorMeasurements.find((m) => m?.spectral_data && Object.keys(m.spectral_data || {}).length > 0);
      if (mWithSpectral?.spectral_data) {
        spectralData = mWithSpectral.spectral_data;
      }
      
      const mWithLab = colorMeasurements.find((m) => m?.lab && (m.lab.L ?? m.lab.l) != null);
      if (mWithLab?.lab) labObject = mWithLab.lab;
    }
  }

  return useResolvedLab({
    spectralData: spectralData || null,
    labObject: labObject || null,
    labColumns: refCols || null,
    altLabObject: null,
    priority: ['spectral', 'object', 'columns'],
    debugLabel: requiredMode ? `reference (mode:${requiredMode})` : 'reference',
    illuminant: restOpts.illuminant || 'D50',
    observer: restOpts.observer || '2',
    tableNumber: restOpts.tableNumber || '5',
  });
};

// Convenience: Resolve Lab for MatchCard list item combining match row + selected measurement
export const useResolvedLabForMatchCard = (match, selectedMeasurement, controls = {}) => {
  const labColumns = match ? {
    lab_l: match.lab_l,
    lab_a: match.lab_a,
    lab_b: match.lab_b,
  } : null;

  const altLabObject = (Number.isFinite(match?.target_color_lab_l) && Number.isFinite(match?.target_color_lab_a) && Number.isFinite(match?.target_color_lab_b))
    ? { L: Number(match.target_color_lab_l), a: Number(match.target_color_lab_a), b: Number(match.target_color_lab_b) }
    : null;

  // Strict mode-aware spectral data selection
  let spectralData = null;
  if (controls?.mode) {
    const targetMode = normalizeMode(controls.mode);
    if (targetMode && match?.matched_color_data?.measurements && Array.isArray(match.matched_color_data.measurements)) {
      spectralData = findSpectralByMode(match.matched_color_data.measurements, controls.mode);
      
      if (spectralData && import.meta.env.DEV) {
        console.log(`[useResolvedLabForMatchCard] ✅ Found spectral data for mode ${controls.mode}`);
      } else if (import.meta.env.DEV) {
        const availableModes = match.matched_color_data.measurements.map(m => getModeFromMeasurement(m)).filter(Boolean);
        console.warn(`[useResolvedLabForMatchCard] ⚠️ Mode ${controls.mode} not found - will not fall back to other modes`, {
          availableModes
        });
      }
    }
    // When mode is specified but not found, do NOT fall back to first measurement
  } else {
    // Only when no mode specified: allow best-effort fallback
    spectralData =
      selectedMeasurement?.spectral_data ||
      selectedMeasurement?.spectralData ||
      match?.matched_color_data?.spectralData ||
      (Array.isArray(match?.matched_color_data?.measurements)
        ? (match.matched_color_data.measurements.find(m => m?.spectral_data || m?.spectralData)?.spectral_data ||
           match.matched_color_data.measurements.find(m => m?.spectralData)?.spectralData)
        : null) ||
      null;
  }

  return useResolvedLab({
    spectralData,
    labObject: null,
    labColumns,
    altLabObject,
    priority: ['spectral', 'altObject', 'columns'],
    illuminant: controls?.illuminant || 'D50',
    observer: controls?.observer || '2',
    tableNumber: controls?.tableNumber || controls?.table || '5',
    debugLabel: `match-card:${match?.id}`,
  });
};
