import { normalizeTints, getTintPercentage, safeSpectralData } from '../tintsUtils';
import { computeDefaultDisplayColor, spectralToLabASTME308, labToHexD65, labChromaticAdaptation } from './colorConversion';
import { getSolidSpectralData } from './spectralDataHelpers';
import { computeAdaptedSpectralRatio } from '../spectralAdaptation';
import { computeTwoStepSubstrateAdaptation } from '../inkSubstrateAdaptation';

/**
 * Calculate the proper display hex color for an ink condition based on data mode
 * Now uses the unified computeDefaultDisplayColor approach for consistency
 */
export const calculateInkConditionColorHex = (condition, activeDataMode = null, orgDefaults = null, astmTables = null, substrateSpectralData = null) => {
  if (!condition) return '#f3f4f6';

  // Step 1: Determine effective data mode - prioritize ui_state.active_data_mode, then measurement_settings.preferred_data_mode
  const effectiveDataMode = activeDataMode || 
                           condition?.ui_state?.active_data_mode || 
                           condition?.measurement_settings?.preferred_data_mode || 
                           condition?.preferred_data_mode || 
                           // Smart default: if adapted_tints exist, prefer adapted, otherwise imported
                           (condition?.adapted_tints && Object.keys(condition.adapted_tints).length > 0 ? 'adapted' : 'imported');

  console.log('🎨 calculateInkConditionColorHex (unified):', {
    conditionId: condition.id,
    conditionName: condition.name,
    effectiveDataMode,
    activeDataMode,
    hasOrgDefaults: !!orgDefaults,
    hasAstmTables: !!astmTables,
    astmTablesCount: astmTables?.length || 0,
    hasImportedTints: condition?.imported_tints?.length || 0,
    hasLab: !!condition?.lab
  });

  // Use the unified computeDefaultDisplayColor approach for consistency with regular colors
  if (astmTables && astmTables.length > 0 && orgDefaults) {
    try {
      const result = computeDefaultDisplayColor(condition, orgDefaults, astmTables, effectiveDataMode);
      // Extract hex string from result (could be string or object with .hex property)
      const hex = typeof result === 'string' ? result : result?.hex;
      if (hex && hex !== '#f3f4f6' && hex !== '#808080') {
        // Normalize and validate hex format
        const normalized = hex.startsWith('#') ? hex.toUpperCase() : `#${hex.toUpperCase()}`;
        if (/^#[0-9A-F]{6}$/i.test(normalized)) {
          console.debug('🎨 Calculated hex using unified approach:', normalized);
          return normalized;
        }
      }
    } catch (error) {
      console.warn('Failed to calculate hex using unified approach:', error);
    }
  }

  // Fallback to legacy calculation for edge cases
  if (astmTables && astmTables.length > 0 && orgDefaults) {
    try {
      const result = calculateFromSpectralData(condition, effectiveDataMode, orgDefaults, astmTables);
      if (result) {
        console.debug('🎨 Calculated hex from legacy spectral method:', result);
        return result;
      }
    } catch (error) {
      console.warn('Failed to calculate hex from spectral data:', error);
    }
  }

  // Step 3: Use existing Lab data with chromatic adaptation (fallback)
  const labResult = calculateFromExistingLab(condition, effectiveDataMode, orgDefaults);
  if (labResult) {
    console.debug('🎨 Calculated hex from existing Lab:', labResult);
    return labResult;
  }

  // Step 4: Extract from tints based on effective mode
  const fromTints = extractFromTints(condition, effectiveDataMode);
  if (fromTints) {
    console.debug('🎨 Extracted hex from tints:', fromTints);
    return fromTints;
  }

  // Step 5: Use existing color_hex if available
  if (condition?.color_hex) {
    console.debug('🎨 Using existing color_hex:', condition.color_hex);
    return condition.color_hex;
  }

  // Final fallback
  console.debug('🎨 Using fallback color');
  return '#f3f4f6';
};

/**
 * Calculate hex from spectral data using the proper physics-based pipeline
 * Step 2-3: Get spectral data from correct source and configure defaults
 */
const calculateFromSpectralData = (condition, effectiveDataMode, orgDefaults, astmTables) => {
  // Step 3a: Get correct spectral data based on mode
  let spectralData = null;
  let source = 'unknown';

  if (effectiveDataMode === 'adapted') {
    // For adapted mode: prioritize adapted_tints 100% spectral data
    if (condition?.adapted_tints && Array.isArray(condition.adapted_tints)) {
      const adaptedSolidTint = condition.adapted_tints.find(tint => 
        (tint.tint_percentage || tint.tintPercentage || tint.tint) === 100
      );
      if (adaptedSolidTint?.spectral_data && Object.keys(adaptedSolidTint.spectral_data).length > 0) {
        spectralData = adaptedSolidTint.spectral_data;
        source = 'adapted_tints_100%';
      }
    }
    
    // Fallback to condition's direct spectral_data for adapted mode
    if (!spectralData && condition?.spectral_data && Object.keys(condition.spectral_data).length > 0) {
      spectralData = condition.spectral_data;
      source = 'condition_spectral_data';
    }
  } else {
    // For imported mode: use imported_tints 100% spectral data
    if (condition?.imported_tints && Array.isArray(condition.imported_tints)) {
      const normalizedTints = normalizeTints(condition.imported_tints);
      const importedSolidTint = normalizedTints.find(tint => 
        (tint.tint_percentage || tint.tintPercentage || tint.tint) === 100
      );
      if (importedSolidTint?.spectral_data && Object.keys(importedSolidTint.spectral_data).length > 0) {
        spectralData = importedSolidTint.spectral_data;
        source = 'imported_tints_100%';
      }
    }
  }

  if (!spectralData) {
    console.debug('🎨 No spectral data found for mode:', effectiveDataMode);
    return null;
  }

  console.debug('🎨 Using spectral data from:', source, 'for mode:', effectiveDataMode);

  // Step 4: Select correct ASTM table based on org defaults
  const weightingTable = getWeightingTable(astmTables, orgDefaults);
  if (!weightingTable) {
    console.debug('🎨 No appropriate weighting table found');
    return null;
  }

  // Step 4: Process spectral → Lab using ASTM E308
  const lab = spectralToLabASTME308(spectralData, weightingTable);
  if (!lab || typeof lab.L !== 'number') {
    console.debug('🎨 Failed to convert spectral to Lab');
    return null;
  }

  // Step 5: Determine source illuminant from org defaults
  const sourceIlluminant = orgDefaults.default_illuminant || 'D50';
  
  // Step 5: If org defaults are non-D65, adapt the Lab to D65 before creating hex
  // Otherwise, for D65 defaults, create hex without extra adaptation
  if (sourceIlluminant !== 'D65') {
    console.debug('🎨 Adapting from', sourceIlluminant, 'to D65');
    const adaptedLab = labChromaticAdaptation(lab.L, lab.a, lab.b, sourceIlluminant, 'D65');
    return labToHexD65(adaptedLab.L, adaptedLab.a, adaptedLab.b, 'D65');
  } else {
    console.debug('🎨 Using D65 Lab directly for hex conversion');
    return labToHexD65(lab.L, lab.a, lab.b, 'D65');
  }
};

/**
 * Calculate hex from existing Lab data with chromatic adaptation
 */
const calculateFromExistingLab = (condition, effectiveDataMode, orgDefaults) => {
  let lab = null;

  // For adapted mode, prefer adapted Lab data
  if (effectiveDataMode === 'adapted' && condition?.lab) {
    lab = condition.lab;
  } else if (condition?.lab) {
    lab = condition.lab;
  }

  if (!lab || typeof lab.L !== 'number' || typeof lab.a !== 'number' || typeof lab.b !== 'number') {
    return null;
  }

  try {
    // Determine source illuminant
    const sourceIlluminant = orgDefaults?.default_illuminant || 'D50';
    
    // Chromatically adapt to D65 if needed
    if (sourceIlluminant !== 'D65') {
      const adaptedLab = labChromaticAdaptation(lab.L, lab.a, lab.b, sourceIlluminant, 'D65');
      return labToHexD65(adaptedLab.L, adaptedLab.a, adaptedLab.b, 'D65');
    } else {
      return labToHexD65(lab.L, lab.a, lab.b, 'D65');
    }
  } catch (error) {
    console.debug('Failed to convert existing Lab to hex:', error);
    return null;
  }
};

/**
 * Extract hex color from tints based on effective mode
 */
const extractFromTints = (condition, effectiveDataMode) => {
  const getHexFromTint = (tint) => {
    // Include more hex field variations including displayHex and processedHex
    const raw = (tint && (
      tint.displayHex || tint.processedHex || 
      tint.color_hex || tint.colorHex || 
      tint.color || tint.hex
    )) || null;
    if (!raw) return null;
    const str = String(raw).trim();
    if (/^[0-9a-fA-F]{6}$/.test(str)) return `#${str.toUpperCase()}`;
    if (/^#[0-9a-fA-F]{6}$/.test(str)) return str.toUpperCase();
    return str;
  };

  // Check adapted_tints for adapted mode
  if (effectiveDataMode === 'adapted' && condition?.adapted_tints && Array.isArray(condition.adapted_tints)) {
    const adaptedSolidTint = condition.adapted_tints.find(tint => 
      (tint.tint_percentage || tint.tintPercentage || tint.tint) === 100
    );
    if (adaptedSolidTint) {
      const hexColor = getHexFromTint(adaptedSolidTint);
      if (hexColor) return hexColor;
    }
  }

  // Check imported_tints
  if (condition?.imported_tints && Array.isArray(condition.imported_tints)) {
    const normalizedTints = normalizeTints(condition.imported_tints);
    const importedSolidTint = normalizedTints.find(tint => 
      (tint.tint_percentage || tint.tintPercentage || tint.tint) === 100
    );
    if (importedSolidTint) {
      const hexColor = getHexFromTint(importedSolidTint);
      if (hexColor) return hexColor;
    }

    // Fallback to highest percentage > 0%
    const validTints = normalizedTints.filter(tint => (tint.tint_percentage || tint.tintPercentage || tint.tint) > 0);
    if (validTints.length > 0) {
      const highestTint = [...validTints].sort((a, b) => getTintPercentage(b) - getTintPercentage(a))[0];
      if (highestTint) {
        const hexColor = getHexFromTint(highestTint);
        if (hexColor) return hexColor;
      }
    }
  }

  return null;
};

/**
 * Get the appropriate ASTM weighting table based on org defaults
 */
const getWeightingTable = (astmTables, orgDefaults) => {
  if (!astmTables || !orgDefaults) return null;

  const illuminant = orgDefaults.default_illuminant || 'D50';
  let observer = orgDefaults.default_observer || '2';
  const tableNumber = orgDefaults.default_astm_table || '5';

  // Normalize observer format: handle '2°' → '2' conversion
  observer = String(observer).replace('°', '');

  // Find matching table
  const matchingTables = astmTables.filter(row => 
    row.illuminant_name === illuminant && 
    String(row.observer) === String(observer) && 
    String(row.table_number) === String(tableNumber)
  );

  if (matchingTables.length === 0) {
    console.warn('No matching ASTM tables found, using D50/2°/Table 5 fallback');
    const fallbackTables = astmTables.filter(row => 
      row.illuminant_name === 'D50' && 
      String(row.observer) === '2' && 
      String(row.table_number) === '5'
    );
    return fallbackTables.length > 0 ? normalizeTables(fallbackTables) : null;
  }

  return normalizeTables(matchingTables);
};

/**
 * Normalize ASTM table data for spectral calculations
 */
const normalizeTables = (tables) => {
  return tables.map(r => ({
    ...r,
    white_point_x: r.white_point_x ?? r.xn,
    white_point_y: r.white_point_y ?? r.yn,
    white_point_z: r.white_point_z ?? r.zn,
    wavelength: r.wavelength ?? r.lambda ?? r.wl,
    x_factor: r.x_factor ?? r.xbar ?? r.Sx ?? r.x,
    y_factor: r.y_factor ?? r.ybar ?? r.Sy ?? r.y,
    z_factor: r.z_factor ?? r.zbar ?? r.Sz ?? r.z,
  }));
};

/**
 * Update ink condition's color_hex in the database
 */
export const updateInkConditionColorHex = async (supabase, conditionId, condition, activeDataMode = null, orgDefaults = null, astmTables = null, substrateSpectralData = null) => {
  const newColorHex = calculateInkConditionColorHex(condition, activeDataMode, orgDefaults, astmTables, substrateSpectralData);
  
  const { error } = await supabase
    .from('ink_conditions')
    .update({ 
      color_hex: newColorHex,
      updated_at: new Date().toISOString()
    })
    .eq('id', conditionId);

  if (error) {
    console.error('Failed to update ink condition color_hex:', error);
    throw error;
  }

  return newColorHex;
};

/**
 * Bulk recalculate color_hex for multiple ink conditions
 */
export const bulkRecalculateInkConditionColorHex = async (supabase, conditions, activeDataMode = null, orgDefaults = null, astmTables = null, getSubstrateSpectralData = null) => {
  const updates = conditions.map(condition => {
    const substrateSpectralData = getSubstrateSpectralData ? getSubstrateSpectralData(condition) : null;
    const newColorHex = calculateInkConditionColorHex(condition, activeDataMode, orgDefaults, astmTables, substrateSpectralData);
    return {
      id: condition.id,
      color_hex: newColorHex,
      updated_at: new Date().toISOString()
    };
  });

  const { error } = await supabase
    .from('ink_conditions')
    .upsert(updates, { onConflict: 'id' });

  if (error) {
    console.error('Failed to bulk update ink condition color_hex:', error);
    throw error;
  }

  return updates;
};