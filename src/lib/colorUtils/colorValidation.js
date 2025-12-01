/**
 * Color validation utilities for CXF import
 */

/**
 * Common fallback/gray colors that indicate missing or invalid color data
 */
const FALLBACK_COLORS = new Set([
  '#f3f4f6',  // Gray-100
  '#E5E7EB',  // Gray-200  
  '#9CA3AF',  // Gray-400
  '#6B7280',  // Gray-500
  '#4B5563',  // Gray-600
  '#374151',  // Gray-700
  '#1F2937',  // Gray-800
  '#111827',  // Gray-900
  '#000000',  // Black
  '#FFFFFF',  // White
]);

/**
 * Check if a hex color is valid and not a fallback color
 * @param {string} hex - Hex color string
 * @returns {boolean} - True if valid and not a fallback
 */
export const isValidDisplayColor = (hex) => {
  if (!hex || typeof hex !== 'string') return false;
  
  // Normalize hex format
  const normalizedHex = hex.toUpperCase().startsWith('#') ? hex.toUpperCase() : `#${hex.toUpperCase()}`;
  
  // Check if it's a valid hex format
  const hexRegex = /^#[0-9A-F]{6}$/i;
  if (!hexRegex.test(normalizedHex)) return false;
  
  // Check if it's not a fallback color
  return !FALLBACK_COLORS.has(normalizedHex);
};

/**
 * Detect if a color carries the known placeholder Lab used when ASTM tables are unavailable
 * and spectral data exists (L=50, a=0, b=0).
 * @param {Object} color
 * @returns {boolean}
 */
export const isPlaceholderLab = (color) => {
  if (!color) return false;
  const lab = color.lab || (('lab_l' in (color || {})) ? { L: color.lab_l, a: color.lab_a, b: color.lab_b } : null);
  if (!lab) return false;

  const L = Number(lab.L);
  const a = Number(lab.a);
  const b = Number(lab.b);
  if (!(Number.isFinite(L) && Number.isFinite(a) && Number.isFinite(b))) return false;

  const hasSpectral = Boolean(
    color.spectral_data ||
    color.spectralData ||
    (Array.isArray(color.measurements) && color.measurements.some(m => m && m.spectral_data))
  );

  return hasSpectral && L === 50 && a === 0 && b === 0;
};

/**
 * Get the best available color hex value from parsed color data
 * @param {Object} color - Parsed color object
 * @returns {string|null} - Best hex value or null if none found
 */
export const getBestColorHex = (color) => {
  // If parser produced a placeholder Lab alongside spectral, force recomputation
  if (isPlaceholderLab(color)) return null;

  // Priority order: colorHex from parser (if valid) > hex from parser (if valid) > null
  if (isValidDisplayColor(color?.colorHex)) {
    return color.colorHex;
  }
  
  if (isValidDisplayColor(color?.hex)) {
    return color.hex;
  }
  
  return null;
};