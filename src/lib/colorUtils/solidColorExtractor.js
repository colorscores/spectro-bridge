import { calculateInkConditionColorHex } from './inkConditionColorHex';
import { normalizeTints, getTintPercentage } from '../tintsUtils';
// Legacy function for backward compatibility - now primarily uses stored color_hex
export const getSolidColorHex = (condition, activeDataMode = null, orgDefaults = null, astmTables = null) => {
  console.info('🎨 getSolidColorHex called with:', { 
    activeDataMode, 
    hasCondition: !!condition,
    hasAdaptedTints: !!condition?.adapted_tints,
    adaptedTintsLength: condition?.adapted_tints?.length,
    hasColorHex: !!condition?.color_hex 
  });
  if (!condition) return '#f3f4f6';

  // If caller requests 'imported' data, derive from imported tints/spectral data
  // Do NOT use stored condition.color_hex here because it commonly reflects adapted data
  if (activeDataMode === 'imported') {
    try {
      // Prefer explicit imported tint hex for the solid (100%) swatch
      const tints = normalizeTints(condition?.imported_tints);
      if (Array.isArray(tints) && tints.length > 0) {
        const sanitizeHex = (raw) => {
          if (!raw) return null;
          const str = String(raw).trim();
          if (/^[0-9a-fA-F]{6}$/.test(str)) return `#${str.toUpperCase()}`;
          if (/^#[0-9a-fA-F]{6}$/.test(str)) return str.toUpperCase();
          return null;
        };
        const getHexFromTint = (t) => sanitizeHex(t?.color_hex || t?.colorHex || t?.color || t?.hex);

        let solid = tints.find((t) => getTintPercentage(t) === 100);
        if (!solid) {
          const candidates = tints.filter((t) => getTintPercentage(t) > 0);
          solid = candidates.sort((a, b) => getTintPercentage(b) - getTintPercentage(a))[0];
        }
        const hex = solid ? getHexFromTint(solid) : null;
        if (hex) return hex;
      }

      // As a secondary option, if we have the necessary context, compute from spectral data
      if (orgDefaults && Array.isArray(astmTables) && astmTables.length > 0) {
        const hex = calculateInkConditionColorHex(condition, 'imported', orgDefaults, astmTables);
        if (hex) return hex;
      }
    } catch (e) {
      console.warn('getSolidColorHex(imported): calculation failed, falling back to default', e);
    }
    return '#f3f4f6';
  }

  // If caller requests 'adapted' data, derive from adapted tints/spectral data
  if (activeDataMode === 'adapted') {
    try {
      // Prefer explicit adapted tint hex for the solid (100%) swatch
      const tints = normalizeTints(condition?.adapted_tints);
      if (Array.isArray(tints) && tints.length > 0) {
        const sanitizeHex = (raw) => {
          if (!raw) return null;
          const str = String(raw).trim();
          if (/^[0-9a-fA-F]{6}$/.test(str)) return `#${str.toUpperCase()}`;
          if (/^#[0-9a-fA-F]{6}$/.test(str)) return str.toUpperCase();
          return null;
        };
        const getHexFromTint = (t) => sanitizeHex(t?.color_hex || t?.colorHex || t?.color || t?.hex);

        let solid = tints.find((t) => getTintPercentage(t) === 100);
        if (!solid) {
          const candidates = tints.filter((t) => getTintPercentage(t) > 0);
          solid = candidates.sort((a, b) => getTintPercentage(b) - getTintPercentage(a))[0];
        }
        const hex = solid ? getHexFromTint(solid) : null;
        if (hex) return hex;
      }

      // As a secondary option, if we have the necessary context, compute from spectral data
      if (orgDefaults && Array.isArray(astmTables) && astmTables.length > 0) {
        const hex = calculateInkConditionColorHex(condition, 'adapted', orgDefaults, astmTables);
        if (hex) return hex;
      }
    } catch (e) {
      console.warn('getSolidColorHex(adapted): calculation failed, falling back to default', e);
    }
    return '#f3f4f6';
  }
  
  // Default path: prefer stored hex (typically adapted) if available
  if (condition?.color_hex) {
    return condition.color_hex;
  }
  
  // Fallback: calculate it (for cases where color_hex might not be set)
  console.warn('🎨 Using fallback color calculation - color_hex should be pre-calculated and stored');
  return calculateInkConditionColorHex(condition, activeDataMode, orgDefaults, astmTables);
};

// Extract solid color from multiple conditions (for ink thumbnails)
export const getSolidColorHexFromConditions = (conditions, activeDataMode = null, orgDefaults = null, astmTables = null) => {
  if (!conditions || conditions.length === 0) return '#f3f4f6';
  
  // Try each condition until we find a solid color
  for (const condition of conditions) {
    const solidColor = getSolidColorHex(condition, activeDataMode, orgDefaults, astmTables);
    if (solidColor !== '#f3f4f6') return solidColor;
  }
  
  return '#f3f4f6';
};