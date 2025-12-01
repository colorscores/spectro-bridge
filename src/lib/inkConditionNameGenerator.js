/**
 * Shared utility for generating ink condition names
 * This extracts the logic from InkConditionInfoPanel to be reusable
 */

/**
 * Generate ink condition name based on substrate condition, ink curve, and version
 * @param {string} substrateConditionId - The substrate condition ID
 * @param {string} inkCurve - The ink curve setting
 * @param {string} version - The version string
 * @param {Array} substrates - Array of substrate data for lookups
 * @returns {string} - Generated condition name
 */
export const generateInkConditionName = (substrateConditionId, inkCurve = 'as_measured', version = '', substrates = []) => {
  console.log('🏷️ generateInkConditionName called with:', {
    substrateConditionId,
    inkCurve,
    version,
    substratesCount: substrates.length
  });

  if (!substrateConditionId) {
    console.log('⚠️ No substrate condition ID provided');
    return '';
  }

  // Find the substrate condition in the provided data
  let display = '';
  for (const substrate of substrates) {
    if (!substrate?.conditions) continue;
    
    const match = substrate.conditions.find(c => c.id === substrateConditionId);
    if (match) {
      const conditionFormatted = match.condition 
        ? match.condition.replace(' - ', ', ')
        : '';
      display = match.name
        ? (conditionFormatted ? `${match.name} - ${conditionFormatted}` : match.name)
        : match.displayName || '';
      break;
    }
  }
  
  if (!display) {
    console.log('⚠️ Could not find substrate condition display name for ID:', substrateConditionId);
    return '';
  }
  
  // Map ink curve values to display names
  const inkCurveLabel = {
    'as_measured': 'As Measured',
    'iso_12647': 'ISO 12647-2',
    'custom_curve': 'Custom Curve'
  }[inkCurve] || inkCurve;
  
  let generatedName = `${display} - ${inkCurveLabel} Curve`;
  
  // Append version if provided
  if (version != null && String(version).trim() !== '') {
    generatedName += ` - Version ${String(version).trim()}`;
  }
  
  console.log('🏷️ Generated ink condition name:', generatedName);
  return generatedName;
};

/**
 * Generate ink condition name using substrate condition data directly
 * Used when substrate condition data is available without full substrate array
 * @param {Object} substrateConditionData - Direct substrate condition data
 * @param {string} inkCurve - The ink curve setting
 * @param {string} version - The version string
 * @returns {string} - Generated condition name
 */
export const generateInkConditionNameFromData = (substrateConditionData, inkCurve = 'as_measured', version = '') => {
  console.log('🏷️ generateInkConditionNameFromData called with:', {
    substrateConditionData,
    inkCurve,
    version
  });

  if (!substrateConditionData?.name) {
    console.log('⚠️ No substrate condition data or name provided');
    return '';
  }

  // Map ink curve values to display names
  const inkCurveLabel = {
    'as_measured': 'As Measured',
    'iso_12647': 'ISO 12647-2', 
    'custom_curve': 'Custom Curve'
  }[inkCurve] || inkCurve;
  
  let generatedName = `${substrateConditionData.name} - ${inkCurveLabel} Curve`;
  
  // Append version if provided
  if (version != null && String(version).trim() !== '') {
    generatedName += ` - Version ${String(version).trim()}`;
  }
  
  console.log('🏷️ Generated ink condition name from data:', generatedName);
  return generatedName;
};