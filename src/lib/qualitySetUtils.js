/**
 * Utility functions for extracting measurement settings from quality sets
 */

import { isValidDeltaEMethod, DEFAULT_DELTA_E_METHOD } from './constants/deltaEMethods';

/**
 * Extract measurement settings from quality rules when measurement_settings is null
 * @param {Object} qualitySet - Quality set with rules array
 * @returns {Object|null} Extracted measurement settings or null
 */
export function extractMeasurementSettingsFromRules(qualitySet) {
  if (!qualitySet?.rules || !Array.isArray(qualitySet.rules) || qualitySet.rules.length === 0) {
    return null;
  }

  console.log('🔍 Extracting measurement settings from quality rules:', qualitySet.rules);

  // Extract unique Delta E methods from measurement settings
  const deltaEMethods = (qualitySet.measurement_settings?.deltaE 
    ? [qualitySet.measurement_settings.deltaE]
    : [])
    .map(metric => normalizeDeltaEMetric(metric))
    .filter(Boolean);

  console.log('🔍 Found Delta E methods in rules:', deltaEMethods);

  if (deltaEMethods.length === 0) {
    return null;
  }

  // Use the most common Delta E method, with preference for dE2000
  const deltaEMethod = getMostPreferredDeltaE(deltaEMethods);
  
  // Infer standard measurement conditions for the Delta E method
  const measurementSettings = {
    mode: null, // DO NOT set a default mode - only use explicit quality set requirements
    illuminant: 'D50', // Standard illuminant for print color matching
    observer: '2', // Standard observer
    table: '5', // Default ASTM table
    deltaE: deltaEMethod
  };

  console.log('🔍 Extracted measurement settings from quality rules:', measurementSettings);
  return measurementSettings;
}

/**
 * Normalize quality rule metric to ColorSettingsBox deltaE format
 * @param {string} metric - Quality rule metric (e.g. 'de2000', 'dh', 'de76')
 * @returns {string|null} Normalized deltaE method or null
 */
function normalizeDeltaEMetric(metric) {
  if (!metric || typeof metric !== 'string') {
    return null;
  }

  const normalized = metric.toLowerCase().trim();
  
  // Map quality rule metrics to standard deltaE formats used across the app
  const mappings = {
    'de2000': 'dE00',
    'de00': 'dE00', 
    'ciede2000': 'dE00',
    'deltae2000': 'dE00',
    'de76': 'dE76',
    'deltae76': 'dE76',
    'cielab': 'dE76',
    'de94': 'dE94',
    'deltae94': 'dE94',
    'decmc': 'dECMC2:1',
    'decmc21': 'dECMC2:1',
    'decmc11': 'dECMC1:1',
    'cmc': 'dECMC2:1',
    'cmc21': 'dECMC2:1',
    'cmc11': 'dECMC1:1'
  };

  const mapped = mappings[normalized] || metric;
  return isValidDeltaEMethod(mapped) ? mapped : null;
}

/**
 * Select the most preferred Delta E method from available options
 * @param {string[]} deltaEMethods - Array of normalized deltaE methods
 * @returns {string} Most preferred deltaE method
 */
function getMostPreferredDeltaE(deltaEMethods) {
  // Remove duplicates
  const uniqueMethods = [...new Set(deltaEMethods)];
  
  console.log('🔍 Unique Delta E methods:', uniqueMethods);

  // Priority order: dE00 > dECMC2:1 > dE76 > others (updated to match standard format)
  const priority = ['dE00', 'dECMC2:1', 'dECMC1:1', 'dE76'];
  
  for (const method of priority) {
    if (uniqueMethods.includes(method)) {
      console.log('🔍 Selected preferred Delta E method:', method);
      return method;
    }
  }
  
  // Fallback to first available method or default
  const fallback = uniqueMethods[0] || DEFAULT_DELTA_E_METHOD;
  console.log('🔍 Using fallback Delta E method:', fallback);
  return fallback;
}