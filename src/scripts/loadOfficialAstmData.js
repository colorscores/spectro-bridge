import { importAstmWeights } from '@/utils/importAstmWeights';

/**
 * ASTM E308 data import - accepts user-provided data
 * Data will be imported exactly as provided without validation
 */

// Default placeholder data (will be replaced by user input)
let astmData = [];

// Function to set ASTM data from user input
export const setAstmData = (userData) => {
  astmData = userData;
};

/**
 * Load ASTM E308 data into the database
 */
export const loadOfficialAstmData = async () => {
  try {
    console.log('[ASTM-LOAD] Starting import of ASTM E308 data...');
    
    if (astmData.length === 0) {
      throw new Error('No ASTM data provided. Use setAstmData() first.');
    }
    
    const result = await importAstmWeights(astmData);
    
    if (result.success) {
      console.log('[ASTM-LOAD] Import successful!');
      return result;
    }
    
    throw new Error('Import failed');
  } catch (error) {
    console.error('[ASTM-LOAD] Failed to load ASTM data:', error);
    throw error;
  }
};


// Auto-load if called directly
if (typeof window !== 'undefined' && window.location?.search?.includes('loadAstm=1')) {
  loadOfficialAstmData().then(() => {
    console.log('[ASTM-LOAD] Official ASTM data loaded successfully!');
  }).catch(error => {
    console.error('[ASTM-LOAD] Failed to auto-load:', error);
  });
}