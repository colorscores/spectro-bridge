import { computeDefaultDisplayColor } from './colorUtils/colorConversion';
import { getSolidSpectralData } from './colorUtils/spectralDataHelpers';
import { normalizeTints as normalizeInkTints, getTintPercentage, safeSpectralData } from './tintsUtils';

/**
 * Calculate hex color for regular colors using organization defaults.
 * Uses the organization's default measurement settings (illuminant, observer, table).
 * 
 * @param {Object} color - The color object
 * @param {Object} orgDefaults - Organization defaults
 * @param {Array} astmTables - ASTM E308 weighting tables
 * @returns {string} Hex color string (backward compatible - returns just hex)
 */
export function computeColorHex(color, orgDefaults, astmTables) {
  if (!color) return '#E5E7EB';
  
  // For ink-based colors, delegate to ink condition if available
  if (color.from_ink_condition_id && color.inkCondition) {
    const activeDataMode = color.inkCondition.ui_state?.active_data_mode || 'imported';
    const result = computeInkConditionHex(color.inkCondition, orgDefaults, astmTables, activeDataMode);
    return typeof result === 'string' ? result : result.hex;
  }
  
  // For regular colors, use standard computation
  const result = computeDefaultDisplayColor(color, orgDefaults, astmTables);
  return typeof result === 'string' ? result : result.hex;
}

/**
 * Calculate hex color for display using dynamic user-selected measurement controls.
 * This function allows the appearance box to reflect user-selected settings
 * instead of organization defaults.
 * 
 * @param {Object} color - The color object  
 * @param {Object} orgDefaults - Organization defaults (used as fallback)
 * @param {Array} astmTables - ASTM E308 weighting tables
 * @param {Object} measurementControls - User-selected measurement settings {mode, illuminant, observer, table}
 * @param {string} activeDataMode - For ink-based colors: 'imported' or 'adapted'
 * @param {Object} spectralDataOverride - Optional spectral data to use instead of extracting from color object
 * @returns {Object} Object with hex color string and lab values: { hex: string, lab: { L, a, b } | null }
 */
export function computeDynamicDisplayColor(color, orgDefaults, astmTables, measurementControls = {}, activeDataMode = 'imported', spectralDataOverride = null) {
  if (!color) return { hex: '#E5E7EB', lab: null };
  
  // If spectral data is provided directly, use it (for match measurements)
  if (spectralDataOverride) {
    console.log('computeDynamicDisplayColor (spectral override):', {
      colorId: color?.id,
      hasSpectralData: !!spectralDataOverride,
      measurementControls
    });
    
    return computeDefaultDisplayColor(
      color, 
      orgDefaults, 
      astmTables, 
      activeDataMode,
      spectralDataOverride,
      measurementControls
    );
  }
  
  // Determine ink and substrate classification robustly
  const isInkBased = !!color?.from_ink_condition_id || !!color?.inkCondition;
  const importedNorm = normalizeInkTints(color?.imported_tints || []);
  const hasImportedTints = importedNorm.length > 0;
  const zeros = importedNorm.filter(t => getTintPercentage(t) === 0).length;
  const nonZeros = importedNorm.filter(t => getTintPercentage(t) > 0).length;
  const isSubstrate = !isInkBased && hasImportedTints && zeros > 0 && nonZeros === 0;
  
  console.log('computeDynamicDisplayColor:', {
    colorId: color?.id,
    measurementControls,
    activeDataMode,
    isInkBased,
    isSubstrate,
    tintStats: { zeros, nonZeros, total: importedNorm.length }
  });
  
  // SUBSTRATE: Extract spectral data from 0% tint entry
  if (isSubstrate) {
    const zeroTint = importedNorm.find(t => getTintPercentage(t) === 0);
    const spectralDataOverride = zeroTint ? safeSpectralData(zeroTint) : null;

    console.log('computeDynamicDisplayColor (substrate):', {
      classification: 'substrate',
      reason: 'zero-only',
      conditionId: color?.id,
      hasSpectralData: !!spectralDataOverride
    });

    if (spectralDataOverride) {
      return computeDefaultDisplayColor(
        color, 
        orgDefaults, 
        astmTables, 
        'imported',
        spectralDataOverride,
        measurementControls
      );
    }
  }
  
  // For ink-based colors, use getSolidSpectralData to get the correct spectral data
  if (color.from_ink_condition_id && color.inkCondition) {
    // 🎯 Phase 2: Use correct tints based on activeDataMode
    const tintsToUse = activeDataMode === 'adapted'
      ? (color.inkCondition?.adapted_tints || [])
      : (color.inkCondition?.imported_tints || []);
    
    const spectralResult = getSolidSpectralData(
      color.inkCondition,
      activeDataMode,
      tintsToUse,
      null,
      { mode: measurementControls?.mode, strictAdapted: false }
    );
    
    console.log('computeDynamicDisplayColor (ink condition):', {
      conditionId: color.inkCondition?.id,
      spectralSource: spectralResult?.source,
      hasSpectralData: !!spectralResult?.spectralData,
      activeDataMode
    });
    
    return computeDefaultDisplayColor(
      color.inkCondition, 
      orgDefaults, 
      astmTables, 
      activeDataMode,
      spectralResult?.spectralData || null,
      measurementControls
    );
  }
  
  // Check if this is a standalone ink condition (has imported_tints or adapted_tints but not substrate)
  const hasAdaptedTints = Array.isArray(color?.adapted_tints) && color.adapted_tints.length > 0;
  const isInkCondition = !isSubstrate && (hasImportedTints || hasAdaptedTints);
  
  if (isInkCondition) {
    // 🎯 Phase 2: Use correct tints based on activeDataMode
    const tintsToUse = activeDataMode === 'adapted'
      ? (color?.adapted_tints || [])
      : (color?.imported_tints || []);
    
    const spectralResult = getSolidSpectralData(
      color,
      activeDataMode,
      tintsToUse,
      null,
      { mode: measurementControls?.mode, strictAdapted: false }
    );
    
    console.log('computeDynamicDisplayColor (standalone ink condition):', {
      colorId: color?.id,
      spectralSource: spectralResult?.source,
      hasSpectralData: !!spectralResult?.spectralData,
      activeDataMode
    });
    
    return computeDefaultDisplayColor(
      color, 
      orgDefaults, 
      astmTables, 
      activeDataMode,
      spectralResult?.spectralData || null,
      measurementControls
    );
  }
  
  // For regular colors, use measurement controls
  return computeDefaultDisplayColor(color, orgDefaults, astmTables, activeDataMode, null, measurementControls);
}

/**
 * Calculate hex color for ink conditions (handles imported vs adapted modes)
 * @returns {string} Hex color string (backward compatible - returns just hex)
 */
export function computeInkConditionHex(inkCondition, orgDefaults, astmTables, activeDataMode = 'imported') {
  if (!inkCondition) return '#E5E7EB';
  
  console.log('computeInkConditionHex:', {
    name: inkCondition.name,
    activeDataMode,
    hasImported: !!inkCondition.imported_tints,
    hasAdapted: !!inkCondition.adapted_tints,
    hasSpectral: !!inkCondition.spectral_data
  });
  
  const result = computeDefaultDisplayColor(inkCondition, orgDefaults, astmTables, activeDataMode);
  return typeof result === 'string' ? result : result.hex;
}

/**
 * Calculate hex color for substrate conditions
 * @returns {string} Hex color string (backward compatible - returns just hex)
 */
export function computeSubstrateConditionHex(substrateCondition, orgDefaults, astmTables) {
  if (!substrateCondition) return '#E5E7EB';
  
  console.log('computeSubstrateConditionHex:', {
    name: substrateCondition.name,
    hasSpectral: !!substrateCondition.spectral_data,
    hasLab: !!substrateCondition.lab,
    hasImportedTints: !!substrateCondition.imported_tints,
    labStructure: substrateCondition.lab ? Object.keys(substrateCondition.lab) : 'none'
  });
  
  // For substrate conditions, extract spectral data from 0% tint if available
  let spectralDataOverride = null;
  if (substrateCondition.imported_tints && Array.isArray(substrateCondition.imported_tints)) {
    const zeroTint = substrateCondition.imported_tints.find(t => {
      const pct = t.tint_percentage ?? t.tintPercentage ?? t.percentage ?? t.tint;
      const pctNum = typeof pct === 'string' ? parseFloat(pct.replace('%', '')) : pct;
      return pctNum === 0;
    });
    
    if (zeroTint?.spectral_data || zeroTint?.spectralData) {
      spectralDataOverride = zeroTint.spectral_data || zeroTint.spectralData;
      console.log('computeSubstrateConditionHex: Using 0% tint spectral data', {
        hasSpectralData: !!spectralDataOverride
      });
    }
  }
  
  const result = computeDefaultDisplayColor(substrateCondition, orgDefaults, astmTables, 'imported', spectralDataOverride);
  return typeof result === 'string' ? result : result.hex;
}

/**
 * Calculate hex color for print conditions
 * @returns {string} Hex color string (backward compatible - returns just hex)
 */
export function computePrintConditionHex(printCondition, orgDefaults, astmTables) {
  if (!printCondition) return '#E5E7EB';
  
  console.log('computePrintConditionHex:', {
    name: printCondition.name,
    hasSpectral: !!printCondition.spectral_data,
    hasLab: !!printCondition.lab
  });
  
  const result = computeDefaultDisplayColor(printCondition, orgDefaults, astmTables);
  return typeof result === 'string' ? result : result.hex;
}