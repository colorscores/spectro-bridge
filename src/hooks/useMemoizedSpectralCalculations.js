import { useMemo, useRef } from 'react';
import { spectralToLabASTME308 } from '@/lib/colorUtils/colorConversion';
import { sdebug, isSimilarDebugEnabled } from '@/lib/similarDebug';

// Global computation cache with LRU eviction
const computationCache = new Map();
const MAX_CACHE_SIZE = 1000;

// Formula version - increment when E308 calculations change to invalidate cache
const FORMULA_VERSION = 'v2.0.3';

/**
 * LRU cache implementation for expensive spectral calculations
 */
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    if (this.cache.has(key)) {
      this.hits++;
      // Move to end (most recently used)
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    this.misses++;
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

const spectralCache = new LRUCache(MAX_CACHE_SIZE);

// Clear cache immediately to ensure fresh calculations with corrected formulas
spectralCache.clear();

/**
 * Memoized spectral to Lab conversion with aggressive caching
 */
export const useMemoizedSpectralToLab = (spectralData, illuminant, weightingTable) => {
  return useMemo(() => {
    if (!spectralData || !illuminant || !weightingTable) {
      return { L: 0, a: 0, b: 0 };
    }

    // Create cache key from spectral data and settings (include formula version)
    const spectralKey = JSON.stringify(spectralData);
    const settingsKey = `${illuminant.name}_${weightingTable.length}_${illuminant.white_point?.X}_${illuminant.white_point?.Y}_${illuminant.white_point?.Z}`;
    const cacheKey = `${FORMULA_VERSION}_${spectralKey}_${settingsKey}`;

    // Check cache first
    const cached = spectralCache.get(cacheKey);
    if (cached) {
      if (isSimilarDebugEnabled()) {
        sdebug.info('Cache HIT for spectral->Lab calculation');
      }
      return cached;
    }

    if (isSimilarDebugEnabled()) {
      sdebug.info('Cache MISS for spectral->Lab calculation - computing fresh');
    }

    // Compute and cache result
    try {
      const result = spectralToLabASTME308(spectralData, weightingTable);
      spectralCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.warn('Spectral calculation failed:', error);
      return { L: 0, a: 0, b: 0 };
    }
  }, [spectralData, illuminant, weightingTable]);
};

/**
 * Batch spectral calculations for multiple colors
 * More efficient than individual calculations
 */
export const useBatchSpectralCalculations = (colorsWithSpectral, illuminant, weightingTable) => {
  return useMemo(() => {
    if (!colorsWithSpectral || !illuminant || !weightingTable) {
      return [];
    }

    const results = [];
    const settingsKey = `${illuminant.name}_${weightingTable.length}`;

    for (const color of colorsWithSpectral) {
      if (!color.spectralData) {
        results.push({ ...color, lab: { L: 0, a: 0, b: 0 } });
        continue;
      }

      const spectralKey = JSON.stringify(color.spectralData);
      const cacheKey = `${FORMULA_VERSION}_${spectralKey}_${settingsKey}`;

      // Check cache
      let lab = spectralCache.get(cacheKey);
      
      if (!lab) {
        try {
          lab = spectralToLabASTME308(color.spectralData, weightingTable);
          spectralCache.set(cacheKey, lab);
        } catch (error) {
          lab = { L: 0, a: 0, b: 0 };
        }
      }

      results.push({ ...color, lab });
    }

    return results;
  }, [colorsWithSpectral, illuminant, weightingTable]);
};

/**
 * Clear spectral computation cache
 */
export const clearSpectralCache = () => {
  spectralCache.clear();
};

/**
 * Get cache statistics for debugging
 */
export const getSpectralCacheStats = () => {
  return {
    size: spectralCache.cache.size,
    maxSize: spectralCache.maxSize,
    hitRatio: spectralCache.hits / (spectralCache.hits + spectralCache.misses) || 0,
  };
};