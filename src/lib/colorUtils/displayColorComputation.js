import { spectralToLabASTME308, labToHex, labToChromaHue } from './colorConversion';

/**
 * Centralized utility for computing display colors from spectral data
 * This is the ONLY place where spectral->Lab->Hex conversion should happen for display
 * 
 * @param {Object} spectralData - Spectral reflectance data (wavelength: value pairs)
 * @param {string} illuminant - Illuminant (D50, D65, etc.)
 * @param {string} observer - Observer angle (2 or 10)
 * @param {string} table - ASTM table number (5, 10, 20)
 * @param {Array} astmTables - ASTM weighting tables from database
 * @returns {Object} { hex, lab, ch } or null if computation fails
 */
export const computeDisplayColorFromSpectral = (
  spectralData,
  illuminant = 'D50',
  observer = '2',
  table = '5',
  astmTables = []
) => {
  if (!spectralData || typeof spectralData !== 'object' || Object.keys(spectralData).length === 0) {
    return null;
  }

  if (!astmTables || astmTables.length === 0) {
    console.warn('[displayColorComputation] No ASTM tables provided');
    return null;
  }

  try {
    // Find appropriate weighting table rows
    let weightingTable = astmTables.filter(row =>
      row.illuminant_name === illuminant &&
      String(row.observer) === String(observer).replace('°', '') &&
      String(row.table_number) === String(table)
    );

    // Fallback to D50/2/5 if requested combination not found
    if (!weightingTable.length) {
      weightingTable = astmTables.filter(row =>
        row.illuminant_name === 'D50' &&
        String(row.observer) === '2' &&
        String(row.table_number) === '5'
      );
    }

    if (!weightingTable.length) {
      console.warn('[displayColorComputation] No weighting table found');
      return null;
    }

    // Compute Lab values from spectral data
    const lab = spectralToLabASTME308(spectralData, weightingTable);
    if (!lab) return null;

    // Compute chroma and hue
    const ch = labToChromaHue(lab.L, lab.a, lab.b);

    // Compute hex color
    const hex = labToHex(lab.L, lab.a, lab.b, illuminant);

    return { hex, lab, ch };
  } catch (error) {
    console.error('[displayColorComputation] Failed to compute display color:', error);
    return null;
  }
};

/**
 * Compute display color using organization defaults
 * @param {Object} spectralDataOrObject - Either spectral data object or object with spectral_data property
 * @param {Object} orgDefaults - Organization defaults { default_illuminant, default_observer, default_astm_table }
 * @param {Array} astmTables - ASTM weighting tables
 * @returns {string|null} Hex color or null
 */
export const computeDisplayColorWithOrgDefaults = (
  spectralDataOrObject,
  orgDefaults = {},
  astmTables = []
) => {
  const spectralData = spectralDataOrObject?.spectral_data || spectralDataOrObject;
  
  const illuminant = orgDefaults.default_illuminant || 'D50';
  const observer = orgDefaults.default_observer || '2';
  const table = orgDefaults.default_astm_table || '5';

  const result = computeDisplayColorFromSpectral(spectralData, illuminant, observer, table, astmTables);
  return result?.hex || null;
};
