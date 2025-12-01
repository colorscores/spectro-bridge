/**
 * Utility functions for transferring imported substrate data across navigation
 */

/**
 * Store imported substrate data in session storage for transfer across pages
 * @param {Object} data - The substrate data to store
 * @param {string} data.name - Name of the substrate/condition
 * @param {Object} data.spectral_data - Spectral measurement data
 * @param {Object} data.lab - LAB color values
 * @param {string} data.color_hex - Hex color value
 * @param {Object} data.ch - Chroma and hue values
 */
export const storeImportedSubstrateData = (data) => {
  if (!data || !data.spectral_data) return;
  
  const dataToStore = {
    ...data,
    importedAt: Date.now()
  };
  
  sessionStorage.setItem('importedSubstrateData', JSON.stringify(dataToStore));
  console.log('Stored imported substrate data for transfer:', dataToStore);
};

/**
 * Retrieve and clear imported substrate data from session storage
 * @param {number} maxAge - Maximum age in milliseconds (default: 5 minutes)
 * @returns {Object|null} - The stored data or null if not found/expired
 */
export const retrieveImportedSubstrateData = (maxAge = 5 * 60 * 1000) => {
  const stored = sessionStorage.getItem('importedSubstrateData');
  if (!stored) return null;
  
  try {
    const data = JSON.parse(stored);
    const dataAge = Date.now() - (data.importedAt || 0);
    
    if (dataAge > maxAge) {
      console.log('Imported substrate data expired, cleaning up');
      sessionStorage.removeItem('importedSubstrateData');
      return null;
    }
    
    console.log('Retrieved imported substrate data:', data);
    return data;
  } catch (error) {
    console.error('Error parsing imported substrate data:', error);
    sessionStorage.removeItem('importedSubstrateData');
    return null;
  }
};

/**
 * Clear imported substrate data from session storage
 */
export const clearImportedSubstrateData = () => {
  sessionStorage.removeItem('importedSubstrateData');
  console.log('Cleared imported substrate data');
};

/**
 * Navigate to create new substrate condition with imported data
 * @param {string} substrateId - The substrate ID to create condition for
 * @param {Object} importedData - The imported substrate data
 */
export const navigateToSubstrateConditionWithData = (substrateId, importedData) => {
  if (importedData) {
    storeImportedSubstrateData(importedData);
  }
  
  const url = `/assets/substrates/${substrateId}/conditions/new`;
  window.open(url, '_blank');
};

/**
 * Navigate to create new print condition with imported substrate data
 * @param {Object} importedData - The imported substrate data
 */
export const navigateToPrintConditionWithData = (importedData) => {
  if (importedData) {
    storeImportedSubstrateData(importedData);
  }
  
  window.open('/print-conditions/new?fromImportedSubstrate=true', '_blank');
};