/**
 * Centralized Delta E methods configuration
 * Used across all components to ensure consistency
 */

export const DELTA_E_METHODS = [
  { value: 'dE76', label: 'dE76' },
  { value: 'dE94', label: 'dE94' },
  { value: 'dE00', label: 'dE00' },
  { value: 'dECMC1:1', label: 'dECMC 1:1' },
  { value: 'dECMC2:1', label: 'dECMC 2:1' },
];

export const DEFAULT_DELTA_E_METHOD = 'dE76';

/**
 * Get Delta E method options for use in select components
 * @returns {Array} Array of {value, label} objects
 */
export function getDeltaEOptions() {
  return DELTA_E_METHODS;
}

/**
 * Validate if a Delta E method is supported
 * @param {string} method - The Delta E method to validate
 * @returns {boolean} True if the method is supported
 */
export function isValidDeltaEMethod(method) {
  return DELTA_E_METHODS.some(m => m.value === method);
}