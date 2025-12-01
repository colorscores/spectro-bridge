import { clearAndReloadAstmCache } from './astmCacheManager';

/**
 * Clear all caches after ASTM database update
 */
export const clearCachesForNewAstm = async () => {
  try {
    console.log('[CACHE-CLEAR] Starting comprehensive cache clear for new ASTM data...');
    
    // Clear ASTM caches
    await clearAndReloadAstmCache();
    
    // Clear all spectral calculation caches
    if (typeof window !== 'undefined') {
      localStorage.removeItem('spectralCalcCache');
      localStorage.removeItem('spectralCacheStats');
      
      // Clear any other color calculation caches
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('cache') && (key.includes('color') || key.includes('spectral') || key.includes('lab'))) {
          localStorage.removeItem(key);
          console.log(`[CACHE-CLEAR] Removed cache: ${key}`);
        }
      });
    }
    
    console.log('[CACHE-CLEAR] All caches cleared for new ASTM data');
    return true;
  } catch (error) {
    console.error('[CACHE-CLEAR] Failed to clear caches:', error);
    return false;
  }
};

// Auto-clear if URL parameter is present
if (typeof window !== 'undefined' && window.location?.search?.includes('clearAstmCaches=1')) {
  clearCachesForNewAstm().then(success => {
    if (success) {
      console.log('[AUTO-CLEAR] Caches cleared successfully');
      
      // Remove the parameter from URL
      const url = new URL(window.location);
      url.searchParams.delete('clearAstmCaches');
      window.history.replaceState({}, '', url);
    }
  });
}