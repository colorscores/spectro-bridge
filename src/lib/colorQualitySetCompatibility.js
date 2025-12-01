/**
 * Color and Quality Set Compatibility Validation
 */

import { extractMeasurementSettingsFromRules } from './qualitySetUtils';
import { debug } from './debugUtils';

/**
 * Compatibility status types
 */
export const COMPATIBILITY_STATUS = {
  COMPATIBLE: 'compatible',
  WARNING: 'warning', 
  INCOMPATIBLE: 'incompatible'
};

/**
 * Validate compatibility between a color and quality set
 * @param {Object} color - Color object with lab_illuminant, lab_observer, etc.
 * @param {Array} colorMeasurements - Array of color measurements with mode and spectral_data
 * @param {Object} qualitySet - Quality set object with measurement_settings or rules
 * @param {Object} inkConditionData - Optional ink condition data for ink-based colors
 * @returns {Object} { status, message }
 */
export function validateColorQualitySetCompatibility(color, colorMeasurements, qualitySet, inkConditionData = null) {
  // Extract quality set measurement requirements
  const qualitySetSettings = getQualitySetMeasurementSettings(qualitySet);
  
  debug.log('🔍 [Compatibility] Quality Set Analysis:', {
    qualitySetId: qualitySet?.id,
    qualitySetName: qualitySet?.name,
    hasExplicitSettings: !!qualitySet?.measurement_settings,
    extractedSettings: qualitySetSettings,
    colorId: color?.id,
    colorName: color?.name
  });
  
  if (!qualitySetSettings) {
    debug.log('✅ [Compatibility] No requirements - COMPATIBLE');
    // If no specific requirements, any color is compatible
    return {
      status: COMPATIBILITY_STATUS.COMPATIBLE,
      message: 'Color measurements are compatible with quality set requirements'
    };
  }

  const requiredMode = qualitySetSettings.mode;
  const requiredIlluminant = qualitySetSettings.illuminant;
  const requiredObserver = qualitySetSettings.observer;
  
  debug.log('📋 [Compatibility] Requirements:', {
    requiredMode: requiredMode || 'ANY',
    requiredIlluminant,
    requiredObserver
  });

  // Get all available modes from measurements
  const availableModes = getColorMeasurementModes(colorMeasurements, inkConditionData);
  const hasAnySpectral = availableModes.length > 0;
  
  debug.log('📊 [Compatibility] Available Data:', {
    availableModes,
    hasAnySpectral,
    measurementCount: colorMeasurements?.length || 0,
    hasInkConditionData: !!inkConditionData
  });

  // If quality set has NO mode requirement, any spectral data is OK
  if (!requiredMode && hasAnySpectral) {
    debug.log('✅ [Compatibility] No mode required + has spectral - COMPATIBLE');
    return {
      status: COMPATIBILITY_STATUS.COMPATIBLE,
      message: `Color has spectral data (${availableModes.join(', ')}). Quality set accepts any measurement mode.`
    };
  }

  // If quality set DOES require a specific mode
  if (requiredMode) {
    debug.log('🎯 [Compatibility] Checking specific mode requirement:', requiredMode);
    
    // Check if color has spectral data in the required mode
    const hasSpectralInRequiredMode = hasSpectralDataForMode(colorMeasurements, requiredMode, inkConditionData);
    
    debug.log('🔍 [Compatibility] Mode match result:', {
      hasSpectralInRequiredMode,
      requiredMode,
      availableModes
    });
    
    if (hasSpectralInRequiredMode) {
      debug.log('✅ [Compatibility] Has required mode - COMPATIBLE');
      // Has required mode (may also have other modes - that's OK)
      return {
        status: COMPATIBILITY_STATUS.COMPATIBLE,
        message: `Color has spectral data in required ${requiredMode} mode${availableModes.length > 1 ? ` (also available: ${availableModes.filter(m => m !== requiredMode).join(', ')})` : ''}`
      };
    }
    
    // Has spectral data but NOT in the required mode - incompatible
    if (hasAnySpectral) {
      debug.log('❌ [Compatibility] Wrong mode - INCOMPATIBLE');
      return {
        status: COMPATIBILITY_STATUS.INCOMPATIBLE,
        message: `Quality set requires ${requiredMode} measurements, but color only has ${availableModes.join(', ')} data`
      };
    }
  }

  // Check if it's an ink-based color with no regular measurements but has ink condition data
  if (color.from_ink_condition_id && inkConditionData) {
    const inkSettings = getInkConditionMeasurementSettings(inkConditionData);
    if (inkSettings) {
      // If ink condition has measurement mode but doesn't match required mode
      if (requiredMode && inkSettings.mode && inkSettings.mode !== requiredMode) {
        return {
          status: COMPATIBILITY_STATUS.INCOMPATIBLE,
          message: `Quality set requires ${requiredMode} measurements, but color's ink condition is ${inkSettings.mode}`
        };
      }
      
      // If ink condition has spectral data or compatible settings
      if (inkConditionData.spectral_data || !requiredMode || inkSettings.mode === requiredMode) {
        return {
          status: COMPATIBILITY_STATUS.COMPATIBLE,
          message: 'Color has spectral data from ink condition'
        };
      }
    }
  }

  // Color is lab-only - check if it has measurement mode info
  const colorLabSettings = getColorLabSettings(color);
  
  if (!colorLabSettings.mode) {
    // Lab-only without mode - warning
    return {
      status: COMPATIBILITY_STATUS.WARNING,
      message: 'Warning: This color is Lab-only and has no measurement mode. The system will assume the measurement mode of the quality set.'
    };
  }

  // Lab-only with mode - check compatibility
  if (requiredMode && colorLabSettings.mode !== requiredMode) {
    return {
      status: COMPATIBILITY_STATUS.INCOMPATIBLE,
      message: `Quality set requires ${requiredMode} measurements, but color is ${colorLabSettings.mode}-only`
    };
  }

  // Check illuminant compatibility for lab-only colors
  if (requiredIlluminant && colorLabSettings.illuminant !== requiredIlluminant) {
    return {
      status: COMPATIBILITY_STATUS.INCOMPATIBLE,
      message: `Quality set requires ${requiredIlluminant} illuminant, but color has ${colorLabSettings.illuminant} lab data`
    };
  }

  // Check observer compatibility for lab-only colors
  if (requiredObserver && colorLabSettings.observer !== requiredObserver) {
    return {
      status: COMPATIBILITY_STATUS.INCOMPATIBLE,
      message: `Quality set requires ${requiredObserver}° observer, but color has ${colorLabSettings.observer}° lab data`
    };
  }

  return {
    status: COMPATIBILITY_STATUS.COMPATIBLE,
    message: 'Color measurements are compatible with quality set requirements'
  };
}

/**
 * Get measurement settings from quality set (from measurement_settings or extracted from rules)
 * @param {Object} qualitySet - Quality set object
 * @returns {Object|null} Measurement settings
 */
function getQualitySetMeasurementSettings(qualitySet) {
  if (qualitySet?.measurement_settings) {
    return qualitySet.measurement_settings;
  }
  
  return extractMeasurementSettingsFromRules(qualitySet);
}

// Helper to extract mode from various possible locations
const getMode = (m) => m?.mode || m?.measurement_mode || m?.measurementMode || m?.assignedMode;

/**
 * Get available measurement modes from color measurements and ink condition data
 * @param {Array} colorMeasurements - Array of color measurements
 * @param {Object} inkConditionData - Optional ink condition data
 * @returns {Array} Array of unique measurement modes
 */
export function getColorMeasurementModes(colorMeasurements, inkConditionData = null) {
  const modes = [];
  
  // Get modes from color measurements
  if (colorMeasurements && Array.isArray(colorMeasurements)) {
    modes.push(...colorMeasurements
      .filter(m => getMode(m))
      .map(m => String(getMode(m)).toUpperCase())
    );
  }
  
  // Get mode from ink condition if available
  if (inkConditionData) {
    const inkSettings = getInkConditionMeasurementSettings(inkConditionData);
    if (inkSettings?.mode) {
      modes.push(String(inkSettings.mode).toUpperCase());
    }
  }
  
  return [...new Set(modes)];
}

/**
 * Check if color has spectral data for a specific measurement mode
 * @param {Array} colorMeasurements - Array of color measurements
 * @param {string} mode - Required measurement mode (M0, M1, M2, M3)
 * @param {Object} inkConditionData - Optional ink condition data
 * @returns {boolean} True if spectral data exists for the mode
 */
export function hasSpectralDataForMode(colorMeasurements, mode, inkConditionData = null) {
  if (!mode) {
    return false;
  }
  
  // Helper to extract spectral data from various key formats
  const getSpectral = (m) => m?.spectral_data || m?.spectralData || m?.spectral || m?.spectrum;
  
  // Check color measurements first
  if (colorMeasurements && Array.isArray(colorMeasurements)) {
    const hasFromMeasurements = colorMeasurements.some(measurement => {
      const spectral = getSpectral(measurement);
      const mMode = getMode(measurement);
      const modesMatch = mMode && String(mMode).toUpperCase() === String(mode).toUpperCase();
      
      console.log('[hasSpectralDataForMode] Checking measurement', {
        measurementMode: mMode,
        requiredMode: mode,
        modesMatch,
        hasSpectral: !!spectral,
        spectralKeys: spectral ? Object.keys(spectral).length : 0
      });
      
      return modesMatch && spectral && typeof spectral === 'object';
    });
    if (hasFromMeasurements) return true;
  }
  
  // Check ink condition data
  if (inkConditionData) {
    const inkSettings = getInkConditionMeasurementSettings(inkConditionData);
    const spectral = getSpectral(inkConditionData);
    const inkMode = getMode(inkSettings) || inkSettings?.mode;
    const modesMatch = inkMode && String(inkMode).toUpperCase() === String(mode).toUpperCase();
    
    console.log('[hasSpectralDataForMode] Checking ink condition', {
      inkMode,
      requiredMode: mode,
      modesMatch,
      hasSpectral: !!spectral
    });
    
    return modesMatch && spectral && typeof spectral === 'object';
  }
  
  return false;
}

/**
 * Get lab settings from color object
 * @param {Object} color - Color object
 * @returns {Object} Lab settings { illuminant, observer, mode }
 */
export function getColorLabSettings(color) {
  if (!color) {
    return {};
  }
  
  return {
    illuminant: color.lab_illuminant,
    observer: color.lab_observer,
    mode: null // Lab-only colors don't have measurement mode in the color table
  };
}

/**
 * Get measurement settings from ink condition data
 * @param {Object} inkConditionData - Ink condition object
 * @returns {Object|null} Measurement settings { mode, illuminant, observer }
 */
export function getInkConditionMeasurementSettings(inkConditionData) {
  if (!inkConditionData) {
    return null;
  }
  
  // Try measurement_settings first
  if (inkConditionData.measurement_settings) {
    return inkConditionData.measurement_settings;
  }
  
  // Don't assume a default mode - return null if not explicitly set
  return {
    mode: null,
    illuminant: 'D50',
    observer: '2'
  };
}