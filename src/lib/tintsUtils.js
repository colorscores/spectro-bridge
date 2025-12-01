// Utility functions for handling tints data normalization

/**
 * LEGACY COMPATIBILITY: Normalize imported_tints data structure to always return an array
 * Handles legacy object format: { tints: [...] } or { "0": {...}, "100": {...} }
 * NOTE: All new writes should be arrays. This function exists only for reading legacy data.
 * @param {any} importedTints - The imported_tints data (could be array, object with tints property, or null)
 * @returns {Array} - Normalized array of tints
 */
export const normalizeTints = (importedTints) => {
  if (!importedTints) return [];

  // If it's a JSON string from DB, try to parse it first
  if (typeof importedTints === 'string') {
    try {
      importedTints = JSON.parse(importedTints);
    } catch (e) {
      console.warn('normalizeTints: failed to parse string imported_tints');
      return [];
    }
  }

  // Helper to detect if an object looks like a tint entry
  const isTintLike = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    const hasPct = obj.tintPercentage != null || obj.tint_percentage != null || obj.percentage != null || obj.pct != null || obj.tint != null || obj.percent != null || obj.coverage != null || obj.coverage_pct != null || obj.coveragePercent != null || obj.coverage_percentage != null;
    const hasSpectral = !!(obj.spectralData || obj.spectral_data || obj.spectral || obj.spectrum || obj.spectral_string);
    const hasLab = (obj.lab && (obj.lab.L != null || obj.lab.l != null)) || (obj.lab_l != null && obj.lab_a != null && obj.lab_b != null);
    const hasColor = !!(obj.colorHex || obj.hex || obj.color);
    const hasMeasurements = !!(obj.measurements && Array.isArray(obj.measurements));
    return Boolean(hasPct || hasSpectral || hasLab || hasColor || hasMeasurements);
  };

  // Helper to clean a tint by removing redundant top-level spectral data when measurements exist
  const cleanTint = (tint) => {
    if (!tint || typeof tint !== 'object') return tint;
    
    // If tint has measurements array with spectral data, remove redundant top-level spectral fields
    if (tint.measurements && Array.isArray(tint.measurements) && tint.measurements.length > 0) {
      const hasSpectralInMeasurements = tint.measurements.some(m => m?.spectral_data || m?.spectralData || m?.spectral || m?.spectrum);
      if (hasSpectralInMeasurements) {
        const { spectralData, spectral_data, spectral, spectrum, spectral_string, ...cleanedTint } = tint;
        return cleanedTint;
      }
    }
    
    return tint;
  };

  // Already an array: flatten once to handle any nested arrays
  if (Array.isArray(importedTints)) {
    const flat = importedTints.flatMap((v) => (Array.isArray(v) ? v : [v])).filter(Boolean);
    // If the array contains wrapper objects like { tints: [...] }, flatten those too
    const expanded = flat.flatMap((v) => (v && Array.isArray(v.tints) ? v.tints : v));
    const tints = expanded.filter((v) => v && typeof v === 'object' && isTintLike(v));
    return deduplicateTints(tints.map(cleanTint));
  }

  if (typeof importedTints === 'object') {
    // Common shape: { tints: [...] } or { tints: { '0': {..}, '100': {..} } }
    if (importedTints.tints) {
      if (Array.isArray(importedTints.tints)) {
        const tints = importedTints.tints.filter((v) => v && typeof v === 'object' && isTintLike(v));
        return deduplicateTints(tints.map(cleanTint));
      }
      if (typeof importedTints.tints === 'object') {
        const tints = Object.values(importedTints.tints).filter((v) => v && typeof v === 'object' && isTintLike(v));
        return deduplicateTints(tints.map(cleanTint));
      }
    }

    // Some imports store tints keyed directly by percentage - this is the main structure we expect
    const possibleTintValues = Object.entries(importedTints)
      .filter(([key]) => !['measurement_settings', 'ui_state', 'meta', 'metadata', '$schema', 'schema', '_meta'].includes(key))
      .map(([, v]) => v);

    // For the direct key-value structure, don't flatten - each value should be a complete tint
    const directTints = possibleTintValues.filter((v) => v && typeof v === 'object' && isTintLike(v));
    if (directTints.length > 0) {
      return deduplicateTints(directTints.map(cleanTint));
    }

    // Fallback: flatten one level and collect object-ish entries
    const flattened = possibleTintValues.flatMap((v) => (Array.isArray(v) ? v : [v]))
      .filter((v) => v && typeof v === 'object');

    // If any look like tint objects, return only those
    const tintCandidates = flattened.filter(isTintLike);
    if (tintCandidates.length > 0) {
      return deduplicateTints(tintCandidates.map(cleanTint));
    }

    // Fallback: if object contains a single nested object that itself has tints, dig one more level
    if (flattened.length === 1 && flattened[0] && typeof flattened[0] === 'object') {
      const inner = flattened[0];
      if (Array.isArray(inner.tints)) {
        const tints = inner.tints.filter(isTintLike);
        return deduplicateTints(tints.map(cleanTint));
      }
      if (inner.tints && typeof inner.tints === 'object') {
        const tints = Object.values(inner.tints).filter(isTintLike);
        return deduplicateTints(tints.map(cleanTint));
      }
    }
  }

  return [];
};

/**
 * Deduplicate tints by percentage AND background, keeping the most complete entry
 * @param {Array} tints - Array of tint objects
 * @returns {Array} - Deduplicated array of tints
 */
const deduplicateTints = (tints) => {
  if (!Array.isArray(tints) || tints.length === 0) return tints;
  
  const tintMap = new Map();
  
  tints.forEach(tint => {
    const percentage = getTintPercentage(tint);
    const background = getTintBackground(tint);
    // Create composite key: percentage + background to preserve distinct backgrounds
    const key = `${percentage}|${background}`;
    const existing = tintMap.get(key);
    
    if (!existing) {
      tintMap.set(key, tint);
    } else {
      // Keep the most complete tint (one with measurements preferred)
      const currentScore = getTintCompletenessScore(tint);
      const existingScore = getTintCompletenessScore(existing);
      
      if (currentScore > existingScore) {
        tintMap.set(key, tint);
      }
    }
  });
  
  return Array.from(tintMap.values()).sort((a, b) => {
    const aPercentage = getTintPercentage(a);
    const bPercentage = getTintPercentage(b);
    if (aPercentage !== bPercentage) return aPercentage - bPercentage;
    // Secondary sort by background name for consistent ordering
    return getTintBackground(a).localeCompare(getTintBackground(b));
  });
};

/**
 * Calculate a completeness score for a tint to help with deduplication
 * @param {Object} tint - The tint object
 * @returns {number} - Completeness score
 */
const getTintCompletenessScore = (tint) => {
  if (!tint || typeof tint !== 'object') return 0;
  
  let score = 0;
  if (tint.measurements && Array.isArray(tint.measurements) && tint.measurements.length > 0) score += 10;
  if (tint.spectralData || tint.spectral_data) score += 5;
  if (tint.lab) score += 3;
  if (tint.colorHex || tint.hex || tint.color) score += 2;
  if (tint.backgroundName) score += 1;
  
  return score;
};

/**
 * Robust tint percentage getter that handles various formats and scales
 * @param {Object} tint - The tint object
 * @returns {number} - Normalized tint percentage (0-100 scale)
 */
/**
 * Extract background identifier from tint object
 * @param {Object} tint - The tint object
 * @returns {string} - Background identifier
 */
const getTintBackground = (tint) => {
  if (!tint || typeof tint !== 'object') return 'default';
  
  // Try multiple possible background field names
  const background = tint.backgroundName || tint.background_name || tint.background_key || tint.background || 'default';
  
  // Handle empty/null backgrounds
  if (!background || background === '' || background === null || background === undefined) {
    return 'default';
  }
  
  return String(background);
};

export const getTintPercentage = (tint) => {
  if (!tint) return 0;
  
  // Try multiple possible field names
  let value = tint.tintPercentage ?? tint.tint_percentage ?? tint.percentage ?? tint.pct ?? tint.tint ?? tint.percent ?? tint.coverage ?? tint.coverage_pct ?? tint.coveragePercent ?? tint.coverage_percentage ?? 0;
  
  // Convert string to number if needed (strip % if present)
  if (typeof value === 'string') {
    const cleaned = value.trim().replace('%', '');
    value = parseFloat(cleaned);
  }
  
  // If not a valid number, default to 0
  if (isNaN(value) || value < 0) {
    return 0;
  }
  
  // Auto-detect scale and normalize to 0-100
  if (value <= 1) {
    return value * 100;
  }
  
  // Cap at 100 for safety
  return Math.min(value, 100);
};

/**
 * LEGACY READ COMPATIBILITY: Ensures tints are always an array when reading from database
 * Handles legacy object format: { tints: [...] } or { "0": {...}, "100": {...} }
 * 
 * ⚠️ WARNING: DO NOT USE FOR WRITING NEW DATA TO DATABASE
 * For writes, use dbSafeTints() which preserves array structure without normalization
 * 
 * @param {*} tints - Input tints in any format (for reading legacy data)
 * @returns {Array} - Array of normalized tint objects
 */
export function ensureTintsArrayForDB(tints) {
  if (!tints) return [];
  
  // Use normalizeTints to get a real array
  const normalized = normalizeTints(tints);
  
  // Ensure we return an array
  if (!Array.isArray(normalized)) {
    console.warn('[ensureTintsArrayForDB] normalizeTints did not return array:', typeof normalized);
    return [];
  }
  
  return normalized;
}

/**
 * Safe access to spectral data with null checks and spectral_string parsing
 * @param {Object} tint - The tint object
 * @returns {Object} - Safe spectral data object
 */
export const safeSpectralData = (tint) => {
  if (!tint || typeof tint !== 'object') {
    console.log('[safeSpectralData] No tint provided or not an object');
    return {};
  }

  // Verbose logging disabled - enable for debugging only
  // console.log('[safeSpectralData] Checking tint:', {
  //   hasSpectralData: !!tint.spectralData,
  //   hasSpectral_data: !!tint.spectral_data,
  //   hasSpectral: !!tint.spectral,
  //   hasSpectrum: !!tint.spectrum,
  //   hasSpectral_string: !!tint.spectral_string,
  //   hasMeasurements: !!tint.measurements,
  //   measurementsLength: tint.measurements?.length || 0
  // });
  
  // Check for existing object-based spectral data first
  const candidates = [tint.spectralData, tint.spectral_data, tint.spectral, tint.spectrum];
  for (const c of candidates) {
    if (c && typeof c === 'object' && Object.keys(c).length > 0) {
      // console.log('[safeSpectralData] Found spectral data at top level');
      return c;
    }
  }
  
  // Check measurements arrays for spectral data
  if (tint.measurements && Array.isArray(tint.measurements) && tint.measurements.length > 0) {
    console.log('[safeSpectralData] Checking measurements array for spectral data');
    
    for (const measurement of tint.measurements) {
      if (measurement && typeof measurement === 'object') {
        const measurementCandidates = [measurement.spectralData, measurement.spectral_data, measurement.spectral, measurement.spectrum];
        for (const c of measurementCandidates) {
          if (c && typeof c === 'object' && Object.keys(c).length > 0) {
            console.log('[safeSpectralData] Found spectral data in measurements');
            return c;
          }
        }
      }
    }
  }
  
  // Try to parse spectral_string if present (common for 100% tints)
  if (tint.spectral_string && typeof tint.spectral_string === 'string') {
    console.log('[safeSpectralData] Attempting to parse spectral_string');
    try {
      // First try JSON parsing (most common format)
      const parsed = JSON.parse(tint.spectral_string);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        console.log('[safeSpectralData] Successfully parsed spectral_string as JSON');
        return parsed;
      }
    } catch (e) {
      // If JSON fails, try simple CSV-like parsing for wavelength:value pairs
      try {
        const lines = tint.spectral_string.trim().split(/[\n,]/).filter(Boolean);
        const spectralObj = {};
        for (const line of lines) {
          const parts = line.trim().split(/[:\t\s]+/);
          if (parts.length >= 2) {
            const wavelength = parseFloat(parts[0]);
            const value = parseFloat(parts[1]);
            if (!isNaN(wavelength) && !isNaN(value)) {
              spectralObj[wavelength] = value;
            }
          }
        }
        if (Object.keys(spectralObj).length > 0) {
          console.log('[safeSpectralData] Successfully parsed spectral_string as CSV');
          return spectralObj;
        }
      } catch (parseError) {
        console.warn('safeSpectralData: failed to parse spectral_string', parseError);
      }
    }
  }
  
  console.log('[safeSpectralData] No spectral data found anywhere');
  return {};
};