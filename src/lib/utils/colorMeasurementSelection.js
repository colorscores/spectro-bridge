/**
 * Utility functions for selecting measurements from basic colors (non-ink-based)
 * This is mode-based selection without tint logic, suitable for regular color measurements
 */

/**
 * Helper to normalize mode strings for comparison
 * Handles numeric (0,1,2,3), digit strings ('0','1','2','3'), and various formats ('M0', 'm3', 'M-3', etc.)
 * @param {string|number} modeValue - The mode value to normalize
 * @returns {string|null} Normalized mode string (e.g., 'M0', 'M1', 'M2', 'M3')
 */
export const normalizeMode = (modeValue) => {
  if (modeValue === null || modeValue === undefined) return null;
  
  // Handle numeric modes directly (0, 1, 2, 3)
  if (typeof modeValue === 'number') {
    if (modeValue >= 0 && modeValue <= 3) return `M${modeValue}`;
    return null;
  }
  
  // Convert to string and normalize
  const str = String(modeValue).trim().toUpperCase();
  
  // Handle direct digit strings ('0', '1', '2', '3')
  if (/^[0-3]$/.test(str)) return `M${str}`;
  
  // Handle already normalized ('M0', 'M1', 'M2', 'M3')
  if (/^M[0-3]$/.test(str)) return str;
  
  // Handle sloppy formats: 'M 3', 'M-3', 'MODE M3', etc.
  const match = str.match(/M\s*-?\s*([0-3])/);
  if (match) return `M${match[1]}`;
  
  return null;
};

/**
 * Helper to get mode from measurement object
 * @param {Object} m - The measurement object
 * @returns {string|null} The normalized mode string
 */
export const getModeFromMeasurement = (m) => {
  return normalizeMode(m?.mode || m?.assignedMode || m?.measurement_mode || m?.measurementMode);
};

/**
 * Find measurement by mode for basic colors (no tint logic)
 * Prioritizes:
 * 1. Exact mode match with spectral data
 * 2. Exact mode match with Lab data
 * 3. Any measurement with spectral data
 * 4. Any measurement with Lab data
 * 
 * @param {Array} measurements - Array of measurement objects
 * @param {string} preferredMode - The preferred measurement mode (e.g., 'M0', 'M1', etc.)
 * @returns {Object|null} The selected measurement or null if none found
 */
export const getMeasurementByMode = (measurements, preferredMode) => {
  if (!measurements?.length) return null;
  
  const normalizedPreferredMode = normalizeMode(preferredMode);
  const hasSpectral = m => {
    const sd = m?.spectral_data || m?.spectralData;
    return sd && typeof sd === 'object' && Object.keys(sd).length > 0;
  };
  const hasLab = m => m?.lab && typeof m.lab.L === 'number' && typeof m.lab.a === 'number' && typeof m.lab.b === 'number';
  
  // Priority 1: Exact mode match with spectral data
  if (normalizedPreferredMode) {
    const exactModeSpectral = measurements.find(m => 
      getModeFromMeasurement(m) === normalizedPreferredMode && hasSpectral(m)
    );
    if (exactModeSpectral) {
      console.info('[getMeasurementByMode] Found exact mode match with spectral:', {
        id: exactModeSpectral.id,
        mode: getModeFromMeasurement(exactModeSpectral)
      });
      return exactModeSpectral;
    }
  }
  
  // Priority 2: Exact mode match with Lab data
  if (normalizedPreferredMode) {
    const exactModeLab = measurements.find(m => 
      getModeFromMeasurement(m) === normalizedPreferredMode && hasLab(m)
    );
    if (exactModeLab) {
      console.info('[getMeasurementByMode] Found exact mode match with Lab:', {
        id: exactModeLab.id,
        mode: getModeFromMeasurement(exactModeLab)
      });
      return exactModeLab;
    }
  }
  
  // Priority 3: Any measurement with spectral data
  const anySpectral = measurements.find(hasSpectral);
  if (anySpectral) {
    console.info('[getMeasurementByMode] Using fallback spectral measurement:', {
      id: anySpectral.id,
      mode: getModeFromMeasurement(anySpectral)
    });
    return anySpectral;
  }
  
  // Priority 4: Any measurement with Lab data
  const anyLab = measurements.find(hasLab);
  if (anyLab) {
    console.info('[getMeasurementByMode] Using fallback Lab measurement:', {
      id: anyLab.id,
      mode: getModeFromMeasurement(anyLab)
    });
    return anyLab;
  }
  
  return null;
};
