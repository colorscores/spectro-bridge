/**
 * Data Quality Utilities
 * 
 * This module provides utilities for assessing and validating color data quality
 * to ensure only authentic colorimetric data is used for color matching and quality assessment.
 * 
 * The system enforces the following data quality hierarchy:
 * 1. Spectral data (highest accuracy) - suitable for all operations
 * 2. Direct Lab measurements (good accuracy) - suitable for most operations
 * 3. Hex/RGB values (display only) - NOT suitable for precise color matching
 * 
 * IMPORTANT: hex-to-Lab conversion has been removed system-wide to prevent
 * inaccurate quality assessments and Delta E calculations.
 */

/**
 * Assess the quality level of color data
 */
export const assessColorDataQuality = (color) => {
  const hasSpectral = !!(color.spectral_data || 
    (color.measurements && Array.isArray(color.measurements) && 
     color.measurements.some(m => m.spectral_data)));

  const hasValidLab = !!(color.lab && 
    typeof color.lab.L === 'number' && 
    typeof color.lab.a === 'number' && 
    typeof color.lab.b === 'number' && 
    !(color.lab.L === 50 && color.lab.a === 0 && color.lab.b === 0)); // Exclude placeholder Lab

  const hasMeasurementLab = !!(color.measurements && Array.isArray(color.measurements) && 
    color.measurements.some(m => m.lab && 
      typeof m.lab.L === 'number' && 
      typeof m.lab.a === 'number' && 
      typeof m.lab.b === 'number' &&
      !(m.lab.L === 50 && m.lab.a === 0 && m.lab.b === 0)));

  const hasDirectLab = !!(color.lab_l != null && color.lab_a != null && color.lab_b != null);

  if (hasSpectral) {
    return {
      level: 'excellent',
      description: 'Spectral data available - highest accuracy for all operations',
      canUseForQuality: true,
      canUseForMatching: true
    };
  } else if (hasValidLab || hasMeasurementLab || hasDirectLab) {
    return {
      level: 'good',
      description: 'Lab data available - suitable for color matching and quality assessment',
      canUseForQuality: true,
      canUseForMatching: true
    };
  } else if (color.hex || color.colorHex) {
    return {
      level: 'limited',
      description: 'Display color only - not suitable for precise color operations',
      canUseForQuality: false,
      canUseForMatching: false
    };
  } else {
    return {
      level: 'poor',
      description: 'No colorimetric data available',
      canUseForQuality: false,
      canUseForMatching: false
    };
  }
};

/**
 * Check if a color has sufficient data quality for quality assessment
 */
export const canUseForQualityAssessment = (color) => {
  const quality = assessColorDataQuality(color);
  return quality.canUseForQuality;
};

/**
 * Check if a color has sufficient data quality for color matching
 */
export const canUseForColorMatching = (color) => {
  const quality = assessColorDataQuality(color);
  return quality.canUseForMatching;
};

/**
 * Get a list of colors that lack sufficient data quality for operations
 */
export const findLowQualityColors = (colors) => {
  return colors.filter(color => {
    const quality = assessColorDataQuality(color);
    return quality.level === 'limited' || quality.level === 'poor';
  });
};