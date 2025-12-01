import { loadOfficialAstmData } from './loadOfficialAstmData';
import { clearCachesForNewAstm } from '../utils/clearCachesForNewAstm';

/**
 * Execute the complete ASTM data update process
 */
export const executeAstmUpdate = async () => {
  try {
    console.log('[ASTM-UPDATE] Starting complete ASTM data update process...');
    
    // Step 1: Load the official ASTM data
    console.log('[ASTM-UPDATE] Step 1: Loading official ASTM E308 data...');
    const importResult = await loadOfficialAstmData();
    
    if (!importResult.success) {
      throw new Error('Failed to import ASTM data');
    }
    
    console.log('[ASTM-UPDATE] Import successful:', importResult);
    
    // Step 2: Clear all caches and reload
    console.log('[ASTM-UPDATE] Step 2: Clearing all caches and reloading...');
    const cacheResult = await clearCachesForNewAstm();
    
    if (!cacheResult) {
      console.warn('[ASTM-UPDATE] Cache clear may have failed, but continuing...');
    }
    
    console.log('[ASTM-UPDATE] ✅ ASTM data update process completed successfully!');
    
    return {
      success: true,
      import: importResult,
      cacheCleared: cacheResult
    };
    
  } catch (error) {
    console.error('[ASTM-UPDATE] ❌ Failed to execute ASTM update:', error);
    throw error;
  }
};

// Auto-execute if called directly
if (typeof window !== 'undefined' && window.location?.search?.includes('executeAstmUpdate=1')) {
  executeAstmUpdate().then(result => {
    console.log('[ASTM-UPDATE] Auto-execution completed:', result);
  }).catch(error => {
    console.error('[ASTM-UPDATE] Auto-execution failed:', error);
  });
}