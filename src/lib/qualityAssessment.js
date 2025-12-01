import { calculateDeltaE } from './deltaE';
import { debug } from './debugUtils';

/**
 * Normalize metric keys for consistent matching across quality rules and display
 * @param {string} metricKey - Original metric key
 * @returns {string} Normalized metric key
 */
export function normalizeMetricKey(metricKey) {
  if (!metricKey) return '';
  
  console.log('🔍 DEBUG normalizeMetricKey - Input:', metricKey);
  
  // Pre-process: replace delta symbols with 'd' before cleaning
  let processed = metricKey
    .replace(/[∆Δ]/g, 'd')  // Replace delta symbols with 'd'
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  
  console.log('🔍 DEBUG normalizeMetricKey - After initial processing:', processed);
  
  // Handle cases where delta symbol was missing (e.g., "E 2000" -> "e2000")
  if (processed.match(/^e\d/)) {
    processed = 'd' + processed;
  }
  
  // Handle more Delta E synonyms
  const mappings = {
    'de00': 'de2000',
    'decmc21': 'decmc',
    'decmc11': 'decmc',
    'deltae2000': 'de2000',
    'deltae76': 'de76',
    'deltaecmc': 'decmc',
    'deltae00': 'de2000',
    'ciede2000': 'de2000',  // CIE Delta E 2000
    'ciede76': 'de76',      // CIE Delta E 76
    'ciedecmc': 'decmc',    // CIE Delta E CMC
    'cielab': 'de76',       // CIE Lab (defaults to dE76)
    'cie2000': 'de2000',    // CIE 2000
    'cie76': 'de76',        // CIE 76
    'ciecmc': 'decmc',      // CIE CMC
    // E-only variants
    'e2000': 'de2000',
    'e76': 'de76',
    'ecmc': 'decmc',
    'e00': 'de2000',  // Map dE00 to dE2000 for consistency
    // CRITICAL: Generic Delta E mappings
    'de': 'de2000',         // Generic "dE" -> default to dE2000
    'deltae': 'de2000',     // Generic "Delta E" -> default to dE2000
    // Additional component synonyms
    'l': 'dl',
    'lstar': 'dl',
    'a': 'da',
    'astar': 'da', 
    'b': 'db',
    'bstar': 'db',
    'c': 'dc',
    'cstar': 'dc',
    'h': 'dh',
    'hstar': 'dh'
  };
  
  const result = mappings[processed] || processed;
  console.log('🔍 DEBUG normalizeMetricKey - Final result:', result);
  return result;
}

/**
 * Calculate all standard color difference metrics between two Lab colors
 * @param {Object} referenceLab - Reference Lab color {L, a, b}
 * @param {Object} matchLab - Match Lab color {L, a, b}
 * @returns {Object} All calculated metrics
 */
export function calculateAllColorMetrics(referenceLab, matchLab) {
  debug.log('calculateAllColorMetrics - Input Lab values:', {
    referenceLab,
    matchLab
  });

  const metrics = {};
  
  // Ensure Lab values are properly formatted numbers
  const refLab = {
    L: Number(referenceLab.L),
    a: Number(referenceLab.a), 
    b: Number(referenceLab.b)
  };
  
  const mtchLab = {
    L: Number(matchLab.L),
    a: Number(matchLab.a),
    b: Number(matchLab.b)
  };

  debug.log('calculateAllColorMetrics - Normalized Lab values:', { refLab, mtchLab });
  
  // Delta E calculations - RAW values BEFORE rounding
  const rawDeltaE2000 = calculateDeltaE(refLab, mtchLab, 'dE00');
  const rawDeltaE76 = calculateDeltaE(refLab, mtchLab, 'dE76');
  const rawDeltaECMC = calculateDeltaE(refLab, mtchLab, 'dECMC2:1');
  
  // Store rounded values using consistent strategy: Number(value.toFixed(2))
  metrics.dE2000 = rawDeltaE2000 !== null ? Number(rawDeltaE2000.toFixed(2)) : null;
  metrics.dE76 = rawDeltaE76 !== null ? Number(rawDeltaE76.toFixed(2)) : null;
  metrics.dECMC = rawDeltaECMC !== null ? Number(rawDeltaECMC.toFixed(2)) : null;
  
  console.log('🟢 [calculateAllColorMetrics] DELTA E DEBUG:', {
    refLab,
    mtchLab,
    rawDeltaE2000,
    rawDeltaE76,
    rawDeltaECMC,
    roundedDeltaE2000: metrics.dE2000,
    roundedDeltaE76: metrics.dE76,
    roundedDeltaECMC: metrics.dECMC
  });
  
  debug.log('calculateAllColorMetrics - Delta E calculated');
  
  // Component differences  
  metrics.dL = mtchLab.L - refLab.L;
  metrics.da = mtchLab.a - refLab.a;
  metrics.db = mtchLab.b - refLab.b;
  
  // Chroma calculations
  const matchChroma = Math.sqrt(mtchLab.a * mtchLab.a + mtchLab.b * mtchLab.b);
  const refChroma = Math.sqrt(refLab.a * refLab.a + refLab.b * refLab.b);
  metrics.dC = matchChroma - refChroma;
  
  // Hue difference calculation
  const deltaE76 = metrics.dE76;
  const deltaL = metrics.dL;
  const deltaC = metrics.dC;
  metrics.dH = Math.sqrt(Math.max(0, deltaE76 * deltaE76 - deltaL * deltaL - deltaC * deltaC));
  
  debug.log('calculateAllColorMetrics - Final calculated metrics');
  
  return metrics;
}

/**
 * Calculate quality assessment for a match measurement based on its associated quality set
 * @param {Object} matchMeasurement - The match measurement with Lab values
 * @param {Object} referenceColor - The reference color with Lab values 
 * @param {Object} qualitySet - The quality set with rules and levels
 * @returns {Object} Quality assessment results including all metrics
 */
export function calculateQualityAssessment(matchMeasurement, referenceColor, qualitySet) {
  console.log('🔍 DEBUG calculateQualityAssessment - START');
  console.log('🔍 DEBUG calculateQualityAssessment - Inputs:', {
    matchMeasurement: matchMeasurement,
    referenceColor: referenceColor,
    qualitySet: qualitySet,
    hasQualitySetRules: qualitySet?.rules?.length || 0,
    qualitySetName: qualitySet?.name
  });

  if (!matchMeasurement || !referenceColor) {
    console.log('🔍 DEBUG calculateQualityAssessment - EARLY EXIT: Missing matchMeasurement or referenceColor');
    const normalizedRuleMetrics = qualitySet?.measurement_settings?.deltaE
      ? [normalizeMetricKey(qualitySet.measurement_settings.deltaE)]
      : [];
    return {
      overallStatus: 'unknown',
      results: [],
      allMetrics: {},
      ruleMetricsNormalized: normalizedRuleMetrics,
      qualitySetName: qualitySet?.name || 'N/A',
      qualitySetMeasurementSettings: qualitySet?.measurement_settings || null,
    };
  }

  const matchLab = {
    L: Number(matchMeasurement.lab_l),
    a: Number(matchMeasurement.lab_a), 
    b: Number(matchMeasurement.lab_b)
  };

  const referenceLab = referenceColor.lab || {
    L: Number(referenceColor.lab_l),
    a: Number(referenceColor.lab_a),
    b: Number(referenceColor.lab_b)
  };

  console.log('🔍 DEBUG calculateQualityAssessment - Lab values extracted:', {
    matchLab,
    referenceLab
  });


  // STEP 3: More robust validation - treat NaN as missing but allow valid finite numbers
  const hasValidMatchLab = isFinite(matchLab.L) && isFinite(matchLab.a) && isFinite(matchLab.b);
  const hasValidReferenceLab = isFinite(referenceLab.L) && isFinite(referenceLab.a) && isFinite(referenceLab.b);
  const isZeroColor = (matchLab.L === 0 && matchLab.a === 0 && matchLab.b === 0);
  
  if (!hasValidMatchLab || !hasValidReferenceLab || isZeroColor) {
    console.log('🔍 DEBUG calculateQualityAssessment - EARLY EXIT: Invalid Lab values', {
      hasValidMatchLab,
      hasValidReferenceLab,
      isZeroColor,
      matchLab,
      referenceLab
    });
    const normalizedRuleMetrics = qualitySet?.measurement_settings?.deltaE
      ? [normalizeMetricKey(qualitySet.measurement_settings.deltaE)]
      : [];
    return {
      overallStatus: 'unknown',
      results: [],
      allMetrics: {},
      ruleMetricsNormalized: normalizedRuleMetrics,
      qualitySetName: qualitySet?.name || 'N/A',
      qualitySetMeasurementSettings: qualitySet?.measurement_settings || null,
    };
  }

  // Calculate ALL standard color metrics
  const allMetrics = calculateAllColorMetrics(referenceLab, matchLab);
  console.log('🔍 DEBUG calculateQualityAssessment - All metrics calculated:', allMetrics);

  const results = [];
  const ruleMetricsNormalized = new Set();
  let overallStatus = 'pass';

  // Process quality rules if quality set exists
  if (qualitySet?.rules) {
    console.log('🔍 DEBUG calculateQualityAssessment - Processing rules. Rule count:', qualitySet.rules.length);
    
    // Get the deltaE method from quality set measurement settings
    const deltaEMethod = qualitySet.measurement_settings?.deltaE || 'dE76';
    const normalizedMetric = normalizeMetricKey(deltaEMethod);
    ruleMetricsNormalized.add(normalizedMetric);
    
    console.log(`🔍 DEBUG calculateQualityAssessment - Using quality set deltaE method: ${deltaEMethod} -> normalized: ${normalizedMetric}`);
    
    // Determine which metric value to use for all rules
    let calculatedValue;
    switch (normalizedMetric) {
      case 'de2000':
        calculatedValue = allMetrics.dE2000;
        break;
      case 'de76':
        calculatedValue = allMetrics.dE76;
        break;
      case 'decmc':
        calculatedValue = allMetrics.dECMC;
        break;
      case 'dl':
        calculatedValue = Math.abs(allMetrics.dL);
        break;
      case 'da':
        calculatedValue = Math.abs(allMetrics.da);
        break;
      case 'db':
        calculatedValue = Math.abs(allMetrics.db);
        break;
      case 'dh':
        calculatedValue = allMetrics.dH;
        break;
      case 'dc':
        calculatedValue = Math.abs(allMetrics.dC);
        break;
      default:
        debug.warn(`Unknown metric: ${deltaEMethod}`);
        calculatedValue = null;
    }
    
    console.log(`🔍 DEBUG calculateQualityAssessment - Calculated value for ${deltaEMethod}: ${calculatedValue}`);

    for (const rule of qualitySet.rules) {
      console.log(`🔍 DEBUG calculateQualityAssessment - Processing rule: ${rule.reference}`);
      console.log(`🔍 DEBUG calculateQualityAssessment - Rule object:`, rule);

      if (calculatedValue !== null && Number.isFinite(calculatedValue)) {
        // Find the appropriate quality level for this value
        const levels = (rule.quality_levels || rule.levels || []).sort((a, b) => a.range_from - b.range_from);
        let status = 'unknown';
        let action = 'unknown';
        let levelName = 'Unknown';
        
        console.log(`🔍 DEBUG calculateQualityAssessment - Quality levels for ${rule.reference}:`, levels);
        console.log(`🔍 DEBUG calculateQualityAssessment - Looking for level that contains value: ${calculatedValue}`);
        
        for (const level of levels) {
          const inRange = calculatedValue >= level.range_from && 
                         (level.range_to === null || calculatedValue <= level.range_to);
          
          if (inRange) {
            // Improve status derivation from level action/name
            if (level.action) {
              status = level.action.toLowerCase() === 'pass' ? 'pass' : 
                      level.action.toLowerCase() === 'fail' ? 'fail' : 'warn';
            } else if (level.name) {
              const lowerName = level.name.toLowerCase();
              status = lowerName.includes('pass') || lowerName.includes('good') ? 'pass' :
                      lowerName.includes('fail') || lowerName.includes('reject') ? 'fail' : 'warn';
            }
            action = level.action || status;
            levelName = level.name;
            console.log(`🔍 DEBUG calculateQualityAssessment - Found matching level: ${levelName} (${status})`);
            break;
          }
        }
        
        // If no level matched, check if we exceed all ranges (fail case)
        if (status === 'unknown' && levels.length > 0) {
          const maxLevel = levels[levels.length - 1];
          if (maxLevel.range_to !== null && calculatedValue > maxLevel.range_to) {
            status = 'fail';
            action = 'Fail';
            levelName = 'Out of Range';
            console.log(`🔍 DEBUG calculateQualityAssessment - Value exceeds range, setting to: ${levelName} (${status})`);
          }
        }

        // Store result with quality set's metric (not per-rule metric)
        const result = {
          ruleName: (rule.reference || rule.name),
          metric: deltaEMethod,
          normalizedMetric: normalizedMetric,
          value: calculatedValue,
          formattedValue: formatMetricValue(calculatedValue, deltaEMethod),
          status: status,
          action: action,
          levelName: levelName,
          displayColor: levels.find(l => 
            calculatedValue >= l.range_from && 
            (l.range_to === null || calculatedValue <= l.range_to)
          )?.display_color || '#6B7280'
        };
        
        console.log(`🔍 DEBUG calculateQualityAssessment - Generated result:`, result);
        results.push(result);

        // Update overall status - if any rule fails, overall fails
        if (status === 'fail') {
          overallStatus = 'fail';
        } else if (status === 'warn' && overallStatus === 'pass') {
          overallStatus = 'warn';
        }
      } else {
        console.log(`🔍 DEBUG calculateQualityAssessment - Skipping rule ${rule.reference}: calculatedValue is null or not finite`);
      }
    }
  } else {
    console.log('🔍 DEBUG calculateQualityAssessment - NO RULES FOUND in qualitySet');
  }

  console.log('🔍 DEBUG calculateQualityAssessment - Final results array:', results);
  console.log('🔍 DEBUG calculateQualityAssessment - Final overallStatus:', overallStatus);
  console.log('🔍 DEBUG calculateQualityAssessment - Final ruleMetricsNormalized:', Array.from(ruleMetricsNormalized));

  const finalResult = {
    overallStatus,
    results,
    allMetrics,
    ruleMetricsNormalized: Array.from(ruleMetricsNormalized),
    qualitySetName: qualitySet?.name || 'N/A',
    qualitySetMeasurementSettings: qualitySet?.measurement_settings
  };

  console.log('🔍 DEBUG calculateQualityAssessment - FINAL RETURN VALUE:', finalResult);
  return finalResult;
}

/**
 * Format metric value for display
 */
function formatMetricValue(value, metric) {
  if (value === null || value === undefined) return 'N/A';
  
  const formatted = Number(value).toFixed(2);
  
  switch (metric) {
    case 'dE2000':
    case 'dE00':
      return `${formatted} dE00`;
    case 'dE76':
      return `${formatted} dE76`;
    case 'dECMC':
      return `${formatted} dECMC`;
    case 'dL':
      return `${formatted} dL`;
    case 'da':
      return `${formatted} da`;
    case 'db':
      return `${formatted} db`;
    case 'dH':
      return `${formatted} dH`;
    case 'dC':
      return `${formatted} dC`;
    default:
      return formatted;
  }
}

/**
 * Get the primary quality result for display in match cards
 */
export function getPrimaryQualityResult(qualityResults) {
  if (!qualityResults || !qualityResults.results || qualityResults.results.length === 0) {
    return {
      displayText: 'N/A',
      status: 'unknown',
      levelName: 'Unknown',
      displayColor: '#6B7280'
    };
  }

  // Find the first dE2000 or dE76 result, or just use the first result
  const primaryResult = qualityResults.results.find(r => 
    r.metric === 'dE2000' || r.metric === 'dE00' || r.metric === 'dE76'
  ) || qualityResults.results[0];

  const statusText = primaryResult.status === 'pass' ? 'Pass' : 
                    primaryResult.status === 'fail' ? 'Fail' : 'Warn';

  return {
    displayText: `${primaryResult.ruleName}: ${statusText} (${primaryResult.formattedValue})`,
    status: primaryResult.status,
    levelName: primaryResult.levelName || statusText,
    displayColor: primaryResult.displayColor || '#6B7280',
    qualitySetName: qualityResults.qualitySetName
  };
}