/**
 * Auto-naming utility for ink conditions
 * Format: [Substrate Condition Name], [Curve Display Name] Curve, Version [version]
 */

export const generateInkConditionName = (params) => {
  const {
    substrateName = '',
    substrateConditionName,
    inkCurve = 'as_measured',
    version
  } = params;

  

  if (!substrateConditionName) {
    return '';
  }

  // Handle curve display names
  const curveDisplayName = (() => {
    switch (inkCurve) {
      case 'as_measured': return 'As Measured';
      case 'linearized': return 'Linearized';
      case 'optimized': return 'Optimized';
      default: return inkCurve || 'As Measured';
    }
  })();

  // Build name: [Substrate name] - [Substrate Condition Name], [Curve name]
  let nameParts = [];
  
  if (substrateName && substrateName.trim()) {
    nameParts.push(`${substrateName.trim()} - ${substrateConditionName}`);
  } else {
    nameParts.push(substrateConditionName);
  }
  
  nameParts.push(`${curveDisplayName} Curve`);

  // Add version if provided
  if (version != null && String(version).trim()) {
    nameParts.push(`Version ${String(version).trim()}`);
  }

  const finalName = nameParts.join(', ');
  
  return finalName;
};

/**
 * Helper function to determine if an ink condition should use auto-generated name
 */
export const shouldUseAutoNameForInkCondition = (condition, substrateConditionName, substrateName = '') => {
  // If no substrate condition name, can't auto-generate
  if (!substrateConditionName) return false;
  
  
  // Check if name follows new format: [Substrate name] - [Substrate Condition Name]
  const expectedPrefix = substrateName && substrateName.trim() ? 
    `${substrateName.trim()} - ${substrateConditionName}` : 
    substrateConditionName;
  
  // Always auto-generate if the name doesn't start with the expected prefix
  if (!condition.name.includes(expectedPrefix)) return true;
  
  // If has version but name doesn't include it, needs auto-naming
  if (condition.version && !condition.name.includes(condition.version)) return true;
  
  // If has curve setting but name doesn't reflect it, needs auto-naming
  if (condition.ink_curve && condition.ink_curve !== 'as_measured') {
    const curveDisplayName = condition.ink_curve.charAt(0).toUpperCase() + condition.ink_curve.slice(1);
    if (!condition.name.toLowerCase().includes(curveDisplayName.toLowerCase())) return true;
  }
  
  return false;
};