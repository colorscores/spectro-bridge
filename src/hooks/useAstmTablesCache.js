import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

// Global cache for ASTM E308 weighting tables ONLY - shared across all components
let globalAstmCache = null;
// DEPRECATED: No more CMF/illuminants/observers cache
let cachePromise = null;

// Embedded fallback ASTM E308 data for D50/2°/Table 5 (minimal set for public routes)
// This ensures mobile approval pages can render colors immediately without auth
const FALLBACK_ASTM_D50_2_5 = [
  { wavelength: 380, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0004, y_factor: 0.0001, z_factor: 0.0018, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 390, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0024, y_factor: 0.0006, z_factor: 0.0116, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 400, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0098, y_factor: 0.0026, z_factor: 0.0470, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 410, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0291, y_factor: 0.0076, z_factor: 0.1398, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 420, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0656, y_factor: 0.0171, z_factor: 0.3146, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 430, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.1223, y_factor: 0.0318, z_factor: 0.5865, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 440, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.1953, y_factor: 0.0505, z_factor: 0.9369, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 450, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.2835, y_factor: 0.0732, z_factor: 1.3561, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 460, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.3803, y_factor: 0.0983, z_factor: 1.8195, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 470, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.4748, y_factor: 0.1231, z_factor: 2.2683, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 480, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.5569, y_factor: 0.1475, z_factor: 2.6564, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 490, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.6190, y_factor: 0.1799, z_factor: 2.9538, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 500, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.6535, y_factor: 0.2247, z_factor: 3.1091, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 510, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.6576, y_factor: 0.2896, z_factor: 3.1153, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 520, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.6304, y_factor: 0.3812, z_factor: 2.9574, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 530, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.5704, y_factor: 0.5028, z_factor: 2.6287, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 540, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.4815, y_factor: 0.6510, z_factor: 2.2099, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 550, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.3809, y_factor: 0.8118, z_factor: 1.7442, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 560, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.2832, y_factor: 0.9665, z_factor: 1.2948, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 570, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.1944, y_factor: 1.0992, z_factor: 0.8886, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 580, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.1183, y_factor: 1.1923, z_factor: 0.5408, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 590, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0606, y_factor: 1.2330, z_factor: 0.2775, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 600, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0254, y_factor: 1.2113, z_factor: 0.1163, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 610, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0086, y_factor: 1.1269, z_factor: 0.0394, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 620, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0024, y_factor: 1.0031, z_factor: 0.0109, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 630, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0006, y_factor: 0.8575, z_factor: 0.0027, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 640, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0002, y_factor: 0.7057, z_factor: 0.0009, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 650, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0001, y_factor: 0.5616, z_factor: 0.0004, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 660, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0000, y_factor: 0.4312, z_factor: 0.0002, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 670, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0000, y_factor: 0.3196, z_factor: 0.0001, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 680, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0000, y_factor: 0.2304, z_factor: 0.0000, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 690, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0000, y_factor: 0.1624, z_factor: 0.0000, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 700, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0000, y_factor: 0.1117, z_factor: 0.0000, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 710, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0000, y_factor: 0.0761, z_factor: 0.0000, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 720, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0000, y_factor: 0.0509, z_factor: 0.0000, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 },
  { wavelength: 730, table_number: 5, illuminant_name: 'D50', observer: '2', x_factor: 0.0000, y_factor: 0.0337, z_factor: 0.0000, white_point_x: 96.422, white_point_y: 100.0, white_point_z: 82.521 }
];

/**
 * Cached hook for ASTM E308 weighting tables ONLY
 * NO MORE CMF/illuminants/observers - ASTM tables only!
 */
export const useAstmTablesCache = () => {
  // Defensive check to ensure we're in a valid React context
  try {
    // Check for cache clearing parameter
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (urlParams?.get('clearCalcCaches') === '1') {
      clearAstmCache();
      console.log('[CACHE-CLEAR] ASTM tables cache cleared via URL parameter');
    }

    const [standards, setStandards] = useState({
      astmTables: globalAstmCache || FALLBACK_ASTM_D50_2_5,
      loading: !globalAstmCache,
    });

    useEffect(() => {
      // If we already have cached data, no need to fetch
      if (globalAstmCache) {
        setStandards({
          astmTables: globalAstmCache,
          loading: false,
        });
        return;
      }

      // If already fetching, wait for the existing promise
      if (cachePromise) {
        cachePromise.then(() => {
          setStandards({
            astmTables: globalAstmCache || FALLBACK_ASTM_D50_2_5,
            loading: false,
          });
        }).catch(() => {
          console.warn('[CACHE] Using fallback after fetch error');
          setStandards({ astmTables: FALLBACK_ASTM_D50_2_5, loading: false });
        });
        return;
      }

      // Try localStorage first
      try {
        const cachedAstm = localStorage.getItem('astm_tables_cache');
        
        if (cachedAstm) {
          globalAstmCache = JSON.parse(cachedAstm);
          console.log('[CACHE] Loaded from localStorage:', globalAstmCache.length, 'rows');
          
          setStandards({
            astmTables: globalAstmCache,
            loading: false,
          });
          
          // Still fetch in background to update cache if needed
          backgroundFetch();
          return;
        }
      } catch (error) {
        console.warn('[CACHE] Failed to load from localStorage:', error);
      }

      // No cache available - use embedded fallback immediately, then fetch in background
      console.log('[CACHE] Using embedded ASTM fallback (D50/2°/Table 5)');
      setStandards({
        astmTables: FALLBACK_ASTM_D50_2_5,
        loading: false,
      });
      
      // Fetch full tables in background with 2-second timeout
      fetchStandardsWithTimeout();

      async function fetchStandardsWithTimeout() {
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            console.log('[CACHE] 2s timeout - keeping fallback, continuing background fetch');
            resolve('timeout');
          }, 2000);
        });

        cachePromise = fetchAllStandards();
        
        const result = await Promise.race([cachePromise, timeoutPromise]);
        
        if (result === 'timeout') {
          // Timeout hit - keep using fallback, but continue fetch in background
          cachePromise.then(() => {
            if (globalAstmCache && globalAstmCache.length > 0) {
              console.log('[CACHE] Background fetch succeeded (rows:', globalAstmCache.length, ')');
              setStandards({ astmTables: globalAstmCache, loading: false });
            }
          }).catch((error) => {
            console.warn('[CACHE] Background fetch failed, using fallback:', error);
          }).finally(() => {
            cachePromise = null;
          });
        } else {
          // Fetch completed within 2s
          setStandards({
            astmTables: globalAstmCache || FALLBACK_ASTM_D50_2_5,
            loading: false,
          });
          cachePromise = null;
        }
      }

      async function backgroundFetch() {
        try {
          const { data, error } = await supabase.from('astm_e308_tables').select('*');
          if (error) throw error;
          globalAstmCache = data || [];
          console.log('[CACHE] Background fetch updated cache (rows:', globalAstmCache.length, ')');
          try {
            localStorage.setItem('astm_tables_cache', JSON.stringify(globalAstmCache));
          } catch {}
          setStandards({ astmTables: globalAstmCache, loading: false });
        } catch (e) {
          console.warn('[CACHE] Background ASTM fetch failed:', e);
        }
      }
    }, []);

    return standards;
  } catch (error) {
    console.error('Error in useAstmTablesCache:', error);
    // Return fallback data if hook fails
    return {
      astmTables: globalAstmCache || [],
      loading: false,
    };
  }
};

async function fetchAllStandards() {
  try {
    console.log('[CACHE] Fetching full ASTM tables from Supabase...');
    const { data, error } = await supabase.from('astm_e308_tables').select('*');

    if (error) {
      console.error('[CACHE] Supabase fetch error:', error);
      throw error;
    }

    // Cache globally
    globalAstmCache = data || [];
    console.log('[CACHE] Fetched', globalAstmCache.length, 'ASTM table rows');

    // Cache in localStorage for next session
    try {
      localStorage.setItem('astm_tables_cache', JSON.stringify(globalAstmCache));
    } catch (error) {
      console.warn('[CACHE] Failed to cache in localStorage:', error);
    }

    return {
      astmTables: globalAstmCache,
    };
  } catch (error) {
    console.error('[CACHE] Failed to fetch standards from database:', error);
    throw error;
  }
}

// Clear cache when needed (e.g., on logout or data updates)
export const clearAstmCache = () => {
  globalAstmCache = null;
  // NO MORE CMF caches - deprecating completely
  try {
    localStorage.removeItem('astm_tables_cache');
    // Clear deprecated CMF cache items
    localStorage.removeItem('illuminants_cache');
    localStorage.removeItem('observers_cache');
    console.log('[CACHE-CLEAR] ASTM cache cleared completely');
  } catch (error) {
    console.warn('Failed to clear localStorage cache:', error);
  }
};

// Force reload ASTM data
export const forceReloadAstmData = async () => {
  clearAstmCache();
  // Force a fresh fetch
  await fetchAllStandards();
  console.log('[CACHE-RELOAD] ASTM data reloaded from database');
};
