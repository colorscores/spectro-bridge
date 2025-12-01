// Utility functions for extracting wavelength range information from spectral data

/**
 * Extract wavelength range from spectral data object
 * @param {Object} spectralData - Object with wavelength keys and reflectance values
 * @returns {string} - Formatted range like "380-730nm" or "Unknown range" if invalid
 */
export const getWavelengthRange = (spectralData) => {
  if (!spectralData || Object.keys(spectralData).length === 0) {
    return 'Unknown range';
  }
  
  const wavelengths = Object.keys(spectralData)
    .map(w => parseInt(w))
    .filter(w => !isNaN(w));
    
  if (wavelengths.length === 0) {
    return 'Unknown range';
  }
  
  wavelengths.sort((a, b) => a - b);
  const min = wavelengths[0];
  const max = wavelengths[wavelengths.length - 1];
  
  return `${min}-${max}nm`;
};

/**
 * Get spectral data info including count and range
 * @param {Object} spectralData - Object with wavelength keys and reflectance values
 * @returns {Object} - Object with count, range, and formatted display string
 */
export const getSpectralDataInfo = (spectralData) => {
  const count = spectralData ? Object.keys(spectralData).length : 0;
  const range = getWavelengthRange(spectralData);
  
  if (count === 0) {
    return {
      count: 0,
      range: 'No data',
      display: 'No spectral data'
    };
  }
  
  const displayRange = range === 'Unknown range' ? '' : ` (${range})`;
  
  return {
    count,
    range,
    display: `${count} points${displayRange}`
  };
};