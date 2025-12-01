import { cn, getContrastColor, getSubstrateIconColor, hexToRgb, generateRandomSpectralData, spectralLibrariesData, extractSpectralData } from './colorUtils/common';
import { spectralToLabASTME308, labToHex, hexToLab, labToChromaHue, getDisplayHex, getDisplayHexWithOrgDefaults, labChromaticAdaptation, labToHexD65, computeDefaultDisplayColor } from './colorUtils/colorConversion';
import { extractColorsFromImage } from './colorUtils/imageColorExtractor';
import { isValidDisplayColor, getBestColorHex } from './colorUtils/colorValidation';
import { adaptTintsToSubstrate } from './colorUtils/tintAdaptation';
import { getEffectiveDataMode, calculateSubstrateDeltaE, shouldUseAdaptedMode } from './substrateAdaptationUtils';
import { computeDisplayColorFromSpectral, computeDisplayColorWithOrgDefaults } from './colorUtils/displayColorComputation';

// Re-export all utilities
export {
  // Common utilities
  cn,
  getContrastColor,
  getSubstrateIconColor,
  hexToRgb,
  generateRandomSpectralData,
  spectralLibrariesData,
  extractSpectralData,
  
  // Color conversion utilities
  spectralToLabASTME308,
  labToHex,
  hexToLab,
  labToChromaHue,
  getDisplayHex,
  getDisplayHexWithOrgDefaults,
  labChromaticAdaptation,
  labToHexD65,
  computeDefaultDisplayColor,
  
  // Image utilities
  extractColorsFromImage,
  
  // Color validation utilities
  isValidDisplayColor,
  getBestColorHex,
  
  // Tint adaptation utilities
  adaptTintsToSubstrate,
  
  // Substrate adaptation utilities
  getEffectiveDataMode,
  calculateSubstrateDeltaE,
  shouldUseAdaptedMode,
  
  // Display color computation
  computeDisplayColorFromSpectral,
  computeDisplayColorWithOrgDefaults,
};