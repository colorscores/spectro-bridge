/**
 * Physics-based spectral adaptation utilities for ink-substrate mixing
 * Based on area coverage models and color science principles
 */

/**
 * Compute adapted spectral data using area coverage model
 * Substrate influence decreases with higher tint percentages (physically correct)
 * 
 * @param {Object} substrateSpectral - Substrate spectral data
 * @param {Object} inkSpectral - Ink spectral data  
 * @param {number} tintPercentage - Tint percentage (0-100)
 * @param {Object} options - Additional options
 * @returns {Object} Adapted spectral data
 */
export const computeAdaptedSpectralRatio = (substrateSpectral, inkSpectral, tintPercentage, options = {}) => {
  if (!substrateSpectral || !inkSpectral) {
    return inkSpectral || substrateSpectral;
  }
  
  const tintPercent = tintPercentage || 100;
  const { maxCoverage = 0.95, opticalGain = 1.1, enableLogging = false } = options;
  
  // Area coverage model: substrate influence decreases with higher tint
  // 0% tint = 0% coverage (pure substrate)
  // 100% tint = ~95% coverage (mostly ink with minimal substrate bleed)
  const nominalCoverage = (tintPercent / 100);
  const effectiveCoverage = Math.min(maxCoverage, nominalCoverage * opticalGain);
  const substrateInfluence = 1 - effectiveCoverage;
  
  const adaptedSpectralData = {};
  
  // Process all wavelengths from both datasets
  const allWavelengths = new Set([
    ...Object.keys(substrateSpectral),
    ...Object.keys(inkSpectral)
  ]);
  
  allWavelengths.forEach(wavelength => {
    const substrateValue = substrateSpectral[wavelength] || 0;
    const inkValue = inkSpectral[wavelength] || 0;
    
    // Area coverage mixing: higher tint = less substrate influence
    adaptedSpectralData[wavelength] = (substrateValue * substrateInfluence) + (inkValue * effectiveCoverage);
  });
  
  // Diagnostic logging disabled by default for performance
  if (enableLogging) {
    console.log(`🔬 Spectral Adaptation ${tintPercent}%:`, {
      effectiveCoverage: effectiveCoverage.toFixed(3),
      substrateInfluence: substrateInfluence.toFixed(3),
      substrate_580nm: substrateSpectral['580']?.toFixed(3) || 'N/A',
      ink_580nm: inkSpectral['580']?.toFixed(3) || 'N/A', 
      adapted_580nm: adaptedSpectralData['580']?.toFixed(3) || 'N/A'
    });
  }
  
  return adaptedSpectralData;
};

/**
 * Special case for 0% tint - should return pure substrate spectral data
 * @param {Object} substrateSpectral - Substrate spectral data
 * @returns {Object} Pure substrate spectral data
 */
export const getPureSubstrateSpectral = (substrateSpectral) => {
  return substrateSpectral || {};
};

/**
 * Validate spectral data has reasonable coverage
 * @param {Object} spectralData - Spectral data to validate
 * @returns {boolean} True if data appears valid
 */
export const validateSpectralData = (spectralData) => {
  if (!spectralData || typeof spectralData !== 'object') return false;
  
  const wavelengths = Object.keys(spectralData);
  if (wavelengths.length === 0) return false;
  
  // Check for reasonable reflectance values (0-100%)
  const values = Object.values(spectralData);
  return values.every(val => typeof val === 'number' && val >= 0 && val <= 100);
};