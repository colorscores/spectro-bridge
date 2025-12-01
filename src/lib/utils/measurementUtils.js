/**
 * Utility functions for measurement mode handling
 */

const MEASUREMENT_MODE_ORDER = { M0: 0, M1: 1, M2: 2, M3: 3 };

export const normalizeMode = (mode) => {
  if (typeof mode === 'string') return mode.trim().toUpperCase();
  if (mode && typeof mode === 'object' && 'value' in mode) return String(mode.value).trim().toUpperCase();
  return '';
};

/**
 * Sorts measurement modes in ascending order (M0, M1, M2, M3)
 * - Accepts strings or objects with a `value` field
 * - Dedupes values and preserves unknowns after known ones
 * @param {Array<string|{value:string,label?:string}>} modes
 * @returns {string[]} Sorted array of normalized mode strings
 */
export const sortMeasurementModes = (modes = []) => {
  const normalized = (Array.isArray(modes) ? modes : [])
    .map(normalizeMode)
    .filter(Boolean);
  const unique = Array.from(new Set(normalized));
  return unique.sort((a, b) => (MEASUREMENT_MODE_ORDER[a] ?? 999) - (MEASUREMENT_MODE_ORDER[b] ?? 999));
};

