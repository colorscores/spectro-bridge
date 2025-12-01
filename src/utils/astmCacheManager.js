import { clearAstmCache, forceReloadAstmData } from '@/hooks/useAstmTablesCache';

// Utility to clear and reload ASTM cache
export const clearAndReloadAstmCache = async () => {
  try {
    console.log('[ASTM-CACHE] Clearing ASTM cache and reloading from database...');
    
    // Clear all caches
    clearAstmCache();
    
    // Force reload from the new database
    await forceReloadAstmData();
    
    console.log('[ASTM-CACHE] Successfully reloaded ASTM data from reconstructed database');
    
    // Clear any spectral calculation caches too
    if (typeof window !== 'undefined') {
      localStorage.removeItem('spectralCalcCache');
      localStorage.removeItem('spectralCacheStats');
    }
    
    return true;
  } catch (error) {
    console.error('[ASTM-CACHE] Failed to reload ASTM data:', error);
    return false;
  }
};
