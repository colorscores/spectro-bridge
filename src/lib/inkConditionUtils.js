/**
 * Utility functions for ink condition color calculation and display
 */
import { normalizeTints, getTintPercentage as getPct } from './tintsUtils';
import { labToHex } from './colorUtils';
import { resolveActiveDataMode } from './colorUtils/resolveActiveDataMode';

/**
 * Get the display color for an ink condition, respecting active data mode and various hex field names
 * @param {Object} condition - The ink condition object
 * @returns {string} - Hex color string
 */
export const getInkConditionDisplayColor = (condition) => {
  if (!condition) return '#f3f4f6';

  // Helper to sanitize hex values
  const sanitizeHex = (raw) => {
    if (!raw) return null;
    const str = String(raw).trim();
    if (/^[0-9a-fA-F]{6}$/.test(str)) return `#${str.toUpperCase()}`;
    if (/^#[0-9a-fA-F]{6}$/.test(str)) return str.toUpperCase();
    return null;
  };

  // Primary strategy: use pre-computed stored color_hex
  const storedHex = sanitizeHex(condition?.display_hex || condition?.color_hex || condition?.hex);
  if (storedHex) {
    return storedHex;
  }

  // Fallback strategy: calculate from tints if stored hex is missing
  const getTintHex = (tint) => sanitizeHex(
    tint?.displayHex || tint?.processedHex || 
    tint?.colorHex || tint?.color_hex || 
    tint?.hex || tint?.color
  );

  const findBestTint = (tintsInput) => {
    const tints = normalizeTints(tintsInput);
    if (!Array.isArray(tints) || tints.length === 0) return null;

    let solid = tints.find((t) => getPct(t) >= 99);
    if (!solid) {
      const candidates = tints.filter((t) => getPct(t) > 0 && getTintHex(t));
      solid = candidates.sort((a, b) => getPct(b) - getPct(a))[0];
    }
    return solid && getTintHex(solid) ? solid : null;
  };

  // Resolve active data mode using centralized utility
  const activeMode = resolveActiveDataMode(condition);

  const resolveFromTints = () => {
    const tryOrder = activeMode === 'adapted'
      ? ['adapted', 'imported']
      : ['imported', 'adapted'];

    for (const mode of tryOrder) {
      const tints = mode === 'adapted' ? condition?.adapted_tints : condition?.imported_tints;
      const best = findBestTint(tints);
      if (best) {
        const hex = getTintHex(best);
        if (hex) return hex;
      }
    }
    return null;
  };

  const fromTints = resolveFromTints();
  if (fromTints) return fromTints;

  // Fallback to Lab -> Hex conversion if Lab present
  const labObj = condition?.lab || (condition?.lab_l != null && condition?.lab_a != null && condition?.lab_b != null
    ? { L: Number(condition.lab_l), a: Number(condition.lab_a), b: Number(condition.lab_b) }
    : null);
  if (labObj && typeof labToHex === 'function') {
    try {
      const hex = labToHex({ L: Number(labObj.L), a: Number(labObj.a), b: Number(labObj.b) });
      if (sanitizeHex(hex)) return sanitizeHex(hex);
    } catch { /* ignore */ }
  }

  // Final fallback to neutral gray
  return '#f3f4f6';
};

/**
 * Check if an ink condition has sufficient data to render without loading state
 * @param {Object} condition - The ink condition object
 * @returns {boolean} - True if the condition has sufficient data
 */
export const hasCompleteConditionData = (condition) => {
  if (!condition) return false;
  
  // Check if we have either adapted_tints or imported_tints for color calculation
  const hasAdaptedTints = condition.adapted_tints && condition.adapted_tints.length > 0;
  const hasImportedTints = condition.imported_tints && condition.imported_tints.length > 0;
  const hasStoredColor = condition.color_hex;
  
  return hasAdaptedTints || hasImportedTints || hasStoredColor;
};

/**
 * Get expected tint count for an adapted condition to check if data is complete
 * @param {Object} condition - The ink condition object
 * @returns {boolean} - True if adapted condition has expected tint data
 */
export const hasExpectedAdaptedData = (condition) => {
  if (condition?.measurement_settings?.preferred_data_mode !== 'adapted') return true;
  // For adapted conditions, we expect adapted_tints to be present if the mode is adapted
  return !!(condition.adapted_tints && condition.adapted_tints.length > 0);
};