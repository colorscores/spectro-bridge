// Helper functions for consistent spectral data handling across components
import { safeSpectralData, getTintPercentage } from '../tintsUtils';

/**
 * Get solid (100%) spectral data from various sources with priority order
 * @param {Object} color - Color object with measurements
 * @param {string} activeDataMode - 'imported' or 'adapted'
 * @param {Array} importedTints - Imported tints array
 * @param {Object} inkSolidTint - Ink solid tint object
 * @returns {Object} Spectral data object or null
 */
export const getSolidSpectralData = (color, activeDataMode, importedTints = [], inkSolidTint = null, options = {}) => {
  const { mode, strictAdapted } = options || {};
  
  console.log('🎯 Phase 2 - getSolidSpectralData called:', {
    activeDataMode,
    hasImportedTints: Array.isArray(importedTints)
      ? importedTints.length > 0
      : (importedTints && typeof importedTints === 'object'
          ? Object.keys(importedTints).length > 0
          : false),
    hasAdaptedTints: color?.adapted_tints && (Array.isArray(color.adapted_tints) ? color.adapted_tints.length > 0 : Object.keys(color.adapted_tints).length > 0),
    colorId: color?.id?.slice(0, 8)
  });
  
  // Defensive: ensure importedTints is always an array (support objects too)
  const normalizedImportedTints = Array.isArray(importedTints)
    ? importedTints
    : (importedTints && typeof importedTints === 'object' ? Object.values(importedTints) : []);
  
  // Detect presence of a valid 100% adapted tint with spectral data (to prioritize it)
  // Use safeSpectralData to check nested measurements array
  const adaptedTintsArr = Array.isArray(color?.adapted_tints)
    ? color.adapted_tints
    : (color?.adapted_tints && typeof color.adapted_tints === 'object' ? Object.values(color.adapted_tints) : []);
  const hasSolidAdaptedTint = adaptedTintsArr.some(t => {
    const pct = getTintPercentage(t);
    const spectral = safeSpectralData(t);
    return pct === 100 && spectral && Object.keys(spectral).length > 0;
  });
  
  // Priority 1: For ink conditions with adapted spectral data at condition level
  // Only use this if there is no explicit 100% adapted tint spectral available
  if (
    activeDataMode === 'adapted' &&
    !hasSolidAdaptedTint &&
    color?.spectral_data && Object.keys(color.spectral_data).length > 0
  ) {
    console.log('getSolidSpectralData: Using condition.spectral_data for adapted mode', {
      conditionId: color.id,
      spectralDataPoints: Object.keys(color.spectral_data).length
    });
    return {
      spectralData: color.spectral_data,
      source: 'condition-adapted-spectral',
      lab: color.lab
    };
  }
  
  if (activeDataMode === 'adapted' && adaptedTintsArr.length) {
    console.log('getSolidSpectralData: Searching adapted_tints collection', {
      colorId: color.id,
      tintsCount: adaptedTintsArr.length,
      availableTints: adaptedTintsArr.map(t => {
        const spectral = safeSpectralData(t);
        return {
          tintPercentage: t.tintPercentage ?? t.tint_percentage ?? t.percentage ?? t.tint,
          hasSpectralData: !!(spectral && Object.keys(spectral).length > 0),
          hasMeasurements: Array.isArray(t.measurements) && t.measurements.length > 0,
          measurementModes: Array.isArray(t.measurements) ? t.measurements.map(m => m.mode || m.measurement_mode) : []
        };
      })
    });
    
    let solidAdaptedTint = null;
    let resolvedSpectral = null;
    let resolvedMode = null;
    
    // Find 100% tint
    const hundredPercentTint = adaptedTintsArr.find(t => getTintPercentage(t) === 100);
    
    if (hundredPercentTint) {
      solidAdaptedTint = hundredPercentTint;
      
      // Extract spectral from measurements array, prefer mode match if provided
      if (mode && Array.isArray(solidAdaptedTint.measurements) && solidAdaptedTint.measurements.length > 0) {
        const modeMatch = solidAdaptedTint.measurements.find(m => {
          const mMode = m.mode || m.measurement_mode;
          const spec = m.spectral_data;
          return mMode && String(mMode).toUpperCase() === String(mode).toUpperCase() && spec && Object.keys(spec).length > 0;
        });
        
        if (modeMatch) {
          resolvedSpectral = modeMatch.spectral_data;
          resolvedMode = modeMatch.mode || modeMatch.measurement_mode;
          console.log('🎯 Phase 4: Mode-specific measurement match in adapted_tints', {
            requestedMode: mode,
            foundMode: resolvedMode
          });
        }
      }
      
      // Fallback to safeSpectralData if no mode match
      if (!resolvedSpectral) {
        resolvedSpectral = safeSpectralData(solidAdaptedTint);
        // Try to extract mode from first measurement
        if (Array.isArray(solidAdaptedTint.measurements) && solidAdaptedTint.measurements[0]) {
          resolvedMode = solidAdaptedTint.measurements[0].mode || solidAdaptedTint.measurements[0].measurement_mode;
        }
        console.log('🎯 Phase 4: General adapted_tints fallback using safeSpectralData', {
          found: !!(resolvedSpectral && Object.keys(resolvedSpectral).length > 0),
          foundMode: resolvedMode
        });
      }
    }
    
    if (resolvedSpectral && Object.keys(resolvedSpectral).length > 0) {
      console.log('🎯 Phase 4: Found 100% adapted tint with spectral:', {
        tintPercentage: solidAdaptedTint.tintPercentage,
        mode: resolvedMode,
        spectralDataPoints: Object.keys(resolvedSpectral).length
      });
      return {
        spectralData: resolvedSpectral,
        source: resolvedMode ? `adapted-tints-100%-${resolvedMode}` : 'adapted-tints-100%',
        lab: solidAdaptedTint.lab,
        mode: resolvedMode
      };
    } else {
      console.log('🎯 Phase 4: No valid 100% tint found in adapted_tints');
    }
  }
  
  // Priority 2: When activeDataMode is 'adapted', use DB measurements (prefer matching mode)
  if (activeDataMode === 'adapted' && color?.measurements) {
    console.log('getSolidSpectralData: Searching for adapted measurements', {
      colorId: color.id,
      measurementsCount: color.measurements.length,
      measurements: color.measurements.map(m => ({
        id: m.id,
        tintPercentage: m.tint_percentage,
        hasSpectralData: !!(m.spectral_data && Object.keys(m.spectral_data).length > 0),
        spectralDataKeys: m.spectral_data ? Object.keys(m.spectral_data).length : 0,
        mode: m.mode
      }))
    });
    
    let solidAdaptedMeasurement = null;

    // Try exact mode match first if provided - NO LONGER REQUIRING tint_percentage === 100
    if (mode) {
      solidAdaptedMeasurement = color.measurements.find(m =>
        m.spectral_data && Object.keys(m.spectral_data).length > 0 &&
        (m.mode ? String(m.mode).toUpperCase() === String(mode).toUpperCase() : true)
      );
      
      console.log('🎯 Phase 4: Mode-specific measurement search', {
        requestedMode: mode,
        found: !!solidAdaptedMeasurement,
        foundMode: solidAdaptedMeasurement?.mode,
        tintPercentage: solidAdaptedMeasurement?.tint_percentage
      });
    }

    // Fallback to any adapted measurement with spectral data
    if (!solidAdaptedMeasurement) {
      solidAdaptedMeasurement = color.measurements.find(m =>
        m.spectral_data && Object.keys(m.spectral_data).length > 0
      );
      
      console.log('🎯 Phase 4: General measurement fallback search', {
        found: !!solidAdaptedMeasurement,
        foundMode: solidAdaptedMeasurement?.mode,
        tintPercentage: solidAdaptedMeasurement?.tint_percentage
      });
    }
    
    if (solidAdaptedMeasurement?.spectral_data) {
      console.log('🎯 Phase 4: Found adapted measurement with mode:', {
        measurementId: solidAdaptedMeasurement.id,
        mode: solidAdaptedMeasurement.mode,
        tintPercentage: solidAdaptedMeasurement.tint_percentage,
        spectralDataPoints: Object.keys(solidAdaptedMeasurement.spectral_data).length,
        firstFewPoints: Object.entries(solidAdaptedMeasurement.spectral_data).slice(0, 3)
      });
      return {
        spectralData: solidAdaptedMeasurement.spectral_data,
        source: mode ? `measurements-${solidAdaptedMeasurement.mode || 'unknown'}` : 'measurements',
        lab: solidAdaptedMeasurement.lab,
        mode: solidAdaptedMeasurement.mode || null // 🎯 Phase 4: Propagate mode from measurement
      };
    } else {
      console.log('🎯 Phase 4: No valid adapted measurement found');
    }
  }
  
  // If adapted mode is requested but no adapted solid spectral was found
  // Respect strictAdapted flag: only stop if strictAdapted=true; otherwise fall back to imported sources
  if (activeDataMode === 'adapted' && strictAdapted) {
    console.warn('⚠️ getSolidSpectralData: Adapted mode requested but no adapted spectral data found (strictAdapted=true)', {
      colorId: color?.id,
      hasSpectralData: !!(color?.spectral_data && Object.keys(color.spectral_data).length > 0),
      hasAdaptedTints: !!(color?.adapted_tints?.length),
      hasMeasurements: !!(color?.measurements?.length)
    });
    return null;
  } else if (activeDataMode === 'adapted') {
    console.warn('⚠️ getSolidSpectralData: Adapted mode requested but no adapted spectral data found, falling back to imported sources', {
      colorId: color?.id
    });
  }
  
  // Priority 2: Use ink solid tint (imported data)
  if (inkSolidTint?.spectralData && Object.keys(inkSolidTint.spectralData).length > 0) {
    return {
      spectralData: inkSolidTint.spectralData,
      source: 'ink-solid-tint',
      lab: inkSolidTint.lab
    };
  }
  
  // Priority 3: Use imported tints 100% solid
  const solidTint = normalizedImportedTints.find(tint => getTintPercentage(tint) === 100);
  if (solidTint) {
    // Check for spectral data in both camelCase and underscore formats
    const spectralData = solidTint.spectralData || solidTint.spectral_data;
    if (spectralData && Object.keys(spectralData).length > 0) {
      return {
        spectralData: spectralData,
        source: 'imported-100%',
        lab: solidTint.lab
      };
    }
  }
  
  return null;
};

/**
 * Create spectral fingerprint for debugging
 * @param {Object} spectralData - Spectral data object
 * @returns {Object} Fingerprint with key stats
 */
export const createSpectralFingerprint = (spectralData) => {
  if (!spectralData || Object.keys(spectralData).length === 0) {
    return { keyCount: 0, range: 'none', checksum: '0.000' };
  }
  
  const keys = Object.keys(spectralData).map(Number).filter(n => !isNaN(n));
  const values = keys.map(k => spectralData[k] || 0);
  
  return {
    keyCount: keys.length,
    range: keys.length > 0 ? `${Math.min(...keys)}-${Math.max(...keys)}` : 'none',
    checksum: values.reduce((sum, v) => sum + v, 0).toFixed(3)
  };
};

/**
 * Log spectral data diagnostics
 * @param {string} context - Context identifier
 * @param {Object} spectralData - Spectral data object
 * @param {Object} options - Additional options
 */
export const logSpectralDiagnostics = (context, spectralData, options = {}) => {
  const fingerprint = createSpectralFingerprint(spectralData);
  
  console.log(`🔬 ${context}: Spectral data diagnostics`, {
    tab: options.tab || 'unknown',
    tintPercentage: options.tintPercentage || 'unknown',
    spectralFingerprint: fingerprint,
    astmTuple: options.astmTuple || 'unknown',
    source: options.source || 'unknown',
    activeDataMode: options.activeDataMode || 'unknown',
    value380nm: spectralData && spectralData['380'] !== undefined ? spectralData['380'] : 'N/A'
  });
};