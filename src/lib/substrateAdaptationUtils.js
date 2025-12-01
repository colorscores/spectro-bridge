import { spectralToLabASTME308 } from './colorUtils/colorConversion';
import { calculateDeltaE } from './deltaE';
import { getTintPercentage, safeSpectralData } from './tintsUtils';
import { debug } from './debugUtils';

/**
 * Extract imported substrate spectral data (0% tint) from imported tints
 * @param {Array} importedTints - Array of imported tint objects
 * @returns {Object|null} - Spectral data object or null if not found
 */
export const extractImportedSubstrateSpectral = (importedTints) => {
  if (!importedTints || !Array.isArray(importedTints)) {
    return null;
  }

  // Find the 0% tint (substrate)
  const substrateTint = importedTints.find(tint => getTintPercentage(tint) === 0);
  if (!substrateTint) {
    return null;
  }

  // Extract spectral data using safe helper
  return safeSpectralData(substrateTint);
};

/**
 * Calculate Delta E between imported substrate and target substrate spectral data
 * @param {Array} importedTints - Array of imported tint objects
 * @param {Object} targetSubstrateSpectral - Target substrate spectral data
 * @param {Array} astmTables - ASTM weighting tables
 * @param {Object} orgDefaults - Organization defaults for measurement settings
 * @returns {number|null} - Delta E value or null if calculation fails
 */
export const calculateSubstrateDeltaE = (importedTints, targetSubstrateSpectral, astmTables, orgDefaults) => {
  if (!importedTints || !targetSubstrateSpectral || !astmTables?.length || !orgDefaults) {
    debug.log('[DEBUG] calculateSubstrateDeltaE: Missing required parameters', {
      hasImportedTints: !!importedTints,
      hasTargetSubstrate: !!targetSubstrateSpectral,
      astmTablesCount: astmTables?.length,
      hasOrgDefaults: !!orgDefaults
    });
    return 0; // Return 0 instead of null to prevent race conditions
  }

  try {
    // Extract imported substrate spectral data
    const importedSubstrateSpectral = extractImportedSubstrateSpectral(importedTints);
    if (!importedSubstrateSpectral) {
      debug.log('[DEBUG] calculateSubstrateDeltaE: No imported substrate spectral found');
      return null;
    }

    // Find appropriate ASTM weighting table rows (need to group by illuminant/observer/table)
    const weightingTableRows = astmTables.filter(table => 
      table.illuminant_name === orgDefaults.illuminant &&
      String(table.observer) === String(orgDefaults.observer) &&
      String(table.table_number) === String(orgDefaults.astmTable)
    );

    let tableRowsToUse = weightingTableRows;
    
    if (!weightingTableRows.length) {
      // Use fallback table rows for D50/2/5
      const fallbackTableRows = astmTables.filter(table => 
        table.illuminant_name === 'D50' &&
        String(table.observer) === '2' &&
        String(table.table_number) === '5'
      );
      
      if (!fallbackTableRows.length) {
        debug.log('[DEBUG] calculateSubstrateDeltaE: No ASTM table rows found');
        return 0;
      }
      
      tableRowsToUse = fallbackTableRows;
    }

    // Convert both spectral data to Lab
    debug.log('[DEBUG] calculateSubstrateDeltaE: Converting spectral to Lab', {
      importedSpectralKeys: Object.keys(importedSubstrateSpectral || {}),
      targetSpectralKeys: Object.keys(targetSubstrateSpectral || {}),
      importedSpectralSample: importedSubstrateSpectral ? Object.entries(importedSubstrateSpectral).slice(0, 3) : 'null',
      targetSpectralSample: targetSubstrateSpectral ? Object.entries(targetSubstrateSpectral).slice(0, 3) : 'null',
      tableIlluminant: tableRowsToUse[0]?.illuminant_name,
      tableObserver: tableRowsToUse[0]?.observer,
      tableNumber: tableRowsToUse[0]?.table_number,
      weightingTableLength: tableRowsToUse.length,
      tableHasWhitePoint: !!(tableRowsToUse[0]?.white_point_x)
    });
    
    const importedLab = spectralToLabASTME308(importedSubstrateSpectral, tableRowsToUse);
    const targetLab = spectralToLabASTME308(targetSubstrateSpectral, tableRowsToUse);

    if (!importedLab || !targetLab || 
        (importedLab.L === 0 && importedLab.a === 0 && importedLab.b === 0) ||
        (targetLab.L === 0 && targetLab.a === 0 && targetLab.b === 0)) {
      debug.log('[DEBUG] calculateSubstrateDeltaE: Invalid Lab conversion', {
        importedLab,
        targetLab,
        hasImportedSpectral: !!importedSubstrateSpectral,
        hasTargetSpectral: !!targetSubstrateSpectral
      });
      return 0; // Return 0 instead of null for consistency
    }

    // Calculate Delta E using organization's preferred method
    const deltaEMethod = orgDefaults.deltaEMethod || 'dE76';
    const deltaE = calculateDeltaE(importedLab, targetLab, deltaEMethod);
    
    debug.log('[DEBUG] calculateSubstrateDeltaE: Result', {
      deltaE,
      importedLab,
      targetLab,
      deltaEMethod
    });
    
    return deltaE;

  } catch (error) {
    debug.error('Failed to calculate substrate Delta E:', error);
    return null;
  }
};

/**
 * Determine if adapted mode should be used based on Delta E and substrate condition selection
 * @param {number|null} deltaE - Delta E value between imported and target substrates
 * @param {boolean} isExistingCondition - Whether an existing substrate condition is selected (not "create-new")
 * @returns {boolean} - True if adapted mode should be used
 */
export const shouldUseAdaptedMode = (deltaE, isExistingCondition) => {
  return deltaE !== null && deltaE > 1 && isExistingCondition;
};

/**
 * Get the effective data mode based on Delta E calculation and substrate condition selection
 * @param {Array} importedTints - Array of imported tint objects
 * @param {Object} selectedSubstrateCondition - Selected substrate condition object
 * @param {string} assignedSubstrateCondition - Assigned substrate condition ID or "create-new"
 * @param {Array} astmTables - ASTM weighting tables
 * @param {Object} orgDefaults - Organization defaults
 * @returns {string} - 'adapted' or 'imported'
 */
export const getEffectiveDataMode = (
  importedTints, 
  selectedSubstrateCondition, 
  assignedSubstrateCondition, 
  astmTables, 
  orgDefaults
) => {
  // Default to imported mode
  if (!importedTints || 
      !selectedSubstrateCondition?.spectral_data || 
      assignedSubstrateCondition === 'create-new' ||
      !astmTables?.length ||
      !orgDefaults) {
    return 'imported';
  }

  // Calculate Delta E between imported substrate and target substrate
  const deltaE = calculateSubstrateDeltaE(
    importedTints, 
    selectedSubstrateCondition.spectral_data, 
    astmTables, 
    orgDefaults
  );

  // Use adapted mode only if Delta E > 1 and existing condition is selected
  const isExistingCondition = assignedSubstrateCondition !== 'create-new';
  const decision = shouldUseAdaptedMode(deltaE, isExistingCondition) ? 'adapted' : 'imported';
  debug.log('[DEBUG] getEffectiveDataMode decision', { deltaE, isExistingCondition, decision });
  return decision;
};