import { safeSpectralData, getTintPercentage } from '../tintsUtils';
import { 
  computeTwoStepSubstrateAdaptation,
  calculateAdditionalInkLayer,
  applyAdditionalInkLayer
} from '../inkSubstrateAdaptation';

/**
 * Adapt tint measurements to a different substrate - SPECTRAL DATA ONLY
 * This function performs physics-based spectral adaptation without computing display colors.
 * Display colors should be computed separately at view time using displayColorComputation utilities.
 * 
 * @param {Array} importedTints - Array of tint objects with spectral data
 * @param {Object} importedSubstrateSpectralByBackground - Map of spectral data by background name (e.g., { 'Substrate': {...}, 'Process_Grey': {...} })
 * @param {Object} targetSubstrateSpectral - Spectral data of the target substrate
 * @param {Object} options - Configuration options (currently unused, kept for backward compatibility)
 * @returns {Array|null} - Array of adapted tint objects with spectral data only, or null if adaptation fails
 */
export const adaptTintsToSubstrate = (
  importedTints, 
  importedSubstrateSpectralByBackground, 
  targetSubstrateSpectral, 
  options = {}
) => {
  const DEBUG = true; // TEMPORARILY ENABLE for diagnosis
  
  if (!importedTints || !importedSubstrateSpectralByBackground || !targetSubstrateSpectral) {
    DEBUG && console.warn('🔧 [adaptTintsToSubstrate] Missing required inputs - returning null');
    return null;
  }

  // Normalize substrate input: accept map or single spectral object
  const isSpectralObject = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    const keys = Object.keys(obj);
    if (!keys.length) return false;
    const numericKeys = keys.filter((k) => !isNaN(Number(k)));
    return numericKeys.length / keys.length > 0.5;
  };

  let substrateMap = importedSubstrateSpectralByBackground;
  if (isSpectralObject(substrateMap)) {
    DEBUG && console.log('🔧 [adaptTintsToSubstrate] Normalized single spectral substrate input into map');
    substrateMap = { Substrate: substrateMap };
  }

  DEBUG && console.log('🔧 [adaptTintsToSubstrate] Starting background-aware spectral adaptation', {
    importedTintsCount: importedTints?.length || 0,
    availableBackgrounds: Object.keys(substrateMap),
    hasTargetSubstrateSpectral: !!targetSubstrateSpectral
  });

  // Step 1: Identify base "Substrate" background's spectral data
  const baseSubstrateSpectral = substrateMap['Substrate'] 
    || substrateMap['substrate']
    || Object.values(substrateMap)[0];

  if (!baseSubstrateSpectral || !isSpectralObject(baseSubstrateSpectral)) {
    DEBUG && console.warn('🔧 [adaptTintsToSubstrate] No valid base substrate spectral found');
    return null;
  }

  // Step 2: Calculate additional ink layers for non-Substrate backgrounds
  // Each non-Substrate background (Gray, Black, etc.) has an additional ink layer
  // that makes it darker than the pure substrate
  const additionalInkLayerByBackground = {};
  
Object.keys(substrateMap).forEach((backgroundName) => {
    if (backgroundName === 'Substrate' || backgroundName === 'substrate') {
      additionalInkLayerByBackground[backgroundName] = null; // No additional layer for pure substrate
    } else {
      const layeredSpectral = substrateMap[backgroundName];
      if (layeredSpectral) {
        additionalInkLayerByBackground[backgroundName] = calculateAdditionalInkLayer(
          baseSubstrateSpectral,
          layeredSpectral
        );
        DEBUG && console.log(`🔧 [adaptTintsToSubstrate] Calculated additional ink layer for background: ${backgroundName}`);
      }
    }
  });

  const adaptedTints = importedTints.map((tint, index) => {
    // Normalize percentage once
    const tintPercentage = getTintPercentage(tint);

    DEBUG && console.log(`🔧 [adaptTintsToSubstrate] Processing tint ${index + 1}/${importedTints.length}: ${tintPercentage}%`);

    // If measurements (per-mode) exist, adapt each mode's spectral data separately
    let adaptedMeasurements = null;
    if (Array.isArray(tint.measurements) && tint.measurements.length > 0) {
      adaptedMeasurements = tint.measurements
        .map((measurement) => {
          const mode = measurement.assignedMode || measurement.mode || measurement.measurementMode || measurement.measurement_mode;
          const mSpectral = measurement.spectral_data || measurement.spectralData || null;
          if (!mSpectral || Object.keys(mSpectral).length === 0) return null;

          // Step 3a: Always use base "Substrate" for adaptation (not background-specific)
          const backgroundName =
            measurement.backgroundName ||
            measurement.background_name ||
            measurement.background ||
            tint.backgroundName ||
            tint.background_name ||
            tint.background ||
            'Substrate';
          
          DEBUG && console.log(`🔧 Adapting ${mode} for background: ${backgroundName} using base substrate`);
          
          // Adapt using base substrate (this correctly maps the substrate change)
          let adaptedSpectralM = computeTwoStepSubstrateAdaptation(
            baseSubstrateSpectral,  // Always use base substrate, not background-specific
            mSpectral,
            targetSubstrateSpectral,
            tintPercentage,
            { enableLogging: false }
          );

          // Step 3b: Re-apply additional ink layer for non-Substrate backgrounds
          const additionalLayer = additionalInkLayerByBackground[backgroundName];
          if (additionalLayer) {
            adaptedSpectralM = applyAdditionalInkLayer(adaptedSpectralM, additionalLayer);
            DEBUG && console.log(`🔧 Applied additional ink layer for background: ${backgroundName}`);
          }

          return {
            mode,
            spectral_data: adaptedSpectralM,
            // Preserve background metadata
            backgroundName: measurement.backgroundName || tint.backgroundName,
            background_name: measurement.background_name || tint.background_name,
            background_key: measurement.background_key || tint.background_key
          };
        })
        .filter(Boolean);
    }

    // Fallback: adapt single spectral at tint level when no per-mode data
    let adaptedSpectralData = null;
    if (!adaptedMeasurements || adaptedMeasurements.length === 0) {
      const tintSpectralData = safeSpectralData(tint);
      if (!tintSpectralData || Object.keys(tintSpectralData).length === 0) {
        DEBUG && console.warn(`🔧 [adaptTintsToSubstrate] Skipping tint - no spectral data`);
        return null;
      }
      
      // Step 3a: Always use base "Substrate" for adaptation (not background-specific)
      const backgroundName = tint.backgroundName || tint.background_name || tint.background || 'Substrate';
      
      DEBUG && console.log(`🔧 Adapting tint-level spectral for background: ${backgroundName} using base substrate`);
      
      // Adapt using base substrate (this correctly maps the substrate change)
      adaptedSpectralData = computeTwoStepSubstrateAdaptation(
        baseSubstrateSpectral,  // Always use base substrate, not background-specific
        tintSpectralData,
        targetSubstrateSpectral,
        tintPercentage,
        { enableLogging: false }
      );

      // Step 3b: Re-apply additional ink layer for non-Substrate backgrounds
      const additionalLayer = additionalInkLayerByBackground[backgroundName];
      if (additionalLayer) {
        adaptedSpectralData = applyAdditionalInkLayer(adaptedSpectralData, additionalLayer);
        DEBUG && console.log(`🔧 Applied additional ink layer for background: ${backgroundName}`);
      }
    }

    // Determine which spectral data to use for top-level (prefer first measurement mode if available)
    let finalSpectralForTopLevel = adaptedSpectralData;
    if (adaptedMeasurements && adaptedMeasurements.length > 0) {
      finalSpectralForTopLevel = adaptedMeasurements[0]?.spectral_data || adaptedSpectralData;
    }

    // Return adapted tint with ONLY spectral data - no color computation
    const adaptedTint = {
      // Preserve original tint metadata
      id: tint.id,
      name: tint.name,
      backgroundName: tint.backgroundName,
      background_name: tint.background_name,
      background_key: tint.background_key,
      background_type: tint.background_type,
      backgroundType: tint.backgroundType,
      background: tint.background,
      
      // Adapted spectral data
      spectralData: finalSpectralForTopLevel,
      spectral_data: finalSpectralForTopLevel,
      tintPercentage: tintPercentage,
      
      // Metadata flags
      isAdapted: true,
      mode: 'adapted',
      
      // Measurements with adapted spectral data (if present)
      measurements: adaptedMeasurements && adaptedMeasurements.length > 0 ? adaptedMeasurements : undefined
    };

    DEBUG && console.log(`🔧 [adaptTintsToSubstrate] Successfully adapted spectral for tint ${tintPercentage}%`);

    return adaptedTint;
  }).filter(Boolean);

  DEBUG && console.log('🔧 [adaptTintsToSubstrate] Spectral adaptation completed:', {
    originalCount: importedTints.length,
    adaptedCount: adaptedTints.length
  });

  // Ensure there's always a 100% solid tint in the adapted tints
  const hasSolidColor = adaptedTints.some(tint => tint.tintPercentage === 100);
  if (!hasSolidColor && adaptedTints.length > 0) {
    const highestTint = adaptedTints.reduce((max, tint) => 
      (tint.tintPercentage || 0) > (max.tintPercentage || 0) ? tint : max
    );
    adaptedTints.push({
      ...highestTint,
      tintPercentage: 100,
      name: `${highestTint.name} 100%`
    });
  }

  return adaptedTints;
};