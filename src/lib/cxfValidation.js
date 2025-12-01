// CxF3/CxF-X4 validation utilities for schema compliance

export function validateCxfExportData(references, measurementsByColorId, options = {}) {
  const warnings = [];
  const errors = [];
  let exportableCount = 0;
  
  // Extract export options
  const { includeSpectral = true, includeLab = true, selectedLabMode = null } = options;

  references.forEach((ref, idx) => {
    const colorName = ref.name || `Color ${idx + 1}`;
    const measData = measurementsByColorId[ref.color_id];
    const lab = ref.reference_lab || ref.lab;

    let hasValidData = false;
    let modesFound = [];
    let spectralModes = [];

    // Normalize measurements into consistent per-mode format (same logic as cxfBuilder)
    if (measData && typeof measData === 'object') {
      // Detect per-mode format (has mode keys like M1, M2, m1, m2, etc.)
      const modeKeys = Object.keys(measData).filter(key => /^[Mm][0-3]$/.test(key));
      const isPerModeFormat = modeKeys.length > 0;
      
      if (isPerModeFormat) {
        // New per-mode format: { M1: { spectral_data, lab, ... }, M2: { ... } }
        modeKeys.forEach(key => {
          const normalizedMode = key.toUpperCase(); // Normalize m1 -> M1
          const meas = measData[key];
          const modeColorName = `${colorName} (${normalizedMode})`;
          modesFound.push(normalizedMode);
          
          // Check spectral data for this mode (only if includeSpectral is true)
          if (includeSpectral && meas?.spectral_data && typeof meas.spectral_data === 'object' && Object.keys(meas.spectral_data).length > 0) {
            spectralModes.push(normalizedMode);
            const spectralValidation = validateSpectralData(meas.spectral_data, modeColorName);
            warnings.push(...spectralValidation.warnings);
            errors.push(...spectralValidation.errors);
            
            if (spectralValidation.isValid) {
              hasValidData = true;
            }
          }

          // Check Lab data for this mode (only if includeLab is true)
          if (includeLab && meas?.lab && typeof meas.lab.L === 'number' && typeof meas.lab.a === 'number' && typeof meas.lab.b === 'number') {
            const labValidation = validateLabData(meas.lab, modeColorName);
            warnings.push(...labValidation.warnings);
            errors.push(...labValidation.errors);
            
            if (labValidation.isValid) {
              hasValidData = true;
            }
          }
        });
      } else {
        // Old single measurement format: { spectral_data, lab, mode?, ... }
        const meas = measData;
        const mode = (meas.mode || 'M1').toUpperCase();
        modesFound.push(mode);
        
        // Check spectral data (only if includeSpectral is true)
        if (includeSpectral && meas?.spectral_data && typeof meas.spectral_data === 'object' && Object.keys(meas.spectral_data).length > 0) {
          spectralModes.push(mode);
          const spectralValidation = validateSpectralData(meas.spectral_data, colorName);
          warnings.push(...spectralValidation.warnings);
          errors.push(...spectralValidation.errors);
          
          if (spectralValidation.isValid) {
            hasValidData = true;
          }
        }

        // Check Lab data from measurement (only if includeLab is true)
        if (includeLab && meas?.lab && typeof meas.lab.L === 'number' && typeof meas.lab.a === 'number' && typeof meas.lab.b === 'number') {
          const labValidation = validateLabData(meas.lab, colorName);
          warnings.push(...labValidation.warnings);
          errors.push(...labValidation.errors);
          
          if (labValidation.isValid) {
            hasValidData = true;
          }
        }
      }
    }

    // Check Lab data from reference (fallback, only if includeLab is true)
    if (!hasValidData && includeLab && lab && typeof lab.L === 'number' && typeof lab.a === 'number' && typeof lab.b === 'number') {
      const labValidation = validateLabData(lab, colorName);
      warnings.push(...labValidation.warnings);
      errors.push(...labValidation.errors);
      
      if (labValidation.isValid) {
        hasValidData = true;
      }
    }

    if (hasValidData) {
      exportableCount++;
      // Log debug info to console instead of showing as warnings
      if (modesFound.length > 0) {
        const debugInfo = `modes: [${modesFound.join(', ')}], spectral: [${spectralModes.join(', ')}]${selectedLabMode ? `, labMode: ${selectedLabMode}` : ''}`;
        console.log(`[CxF Validation] ${colorName}: ${debugInfo}`);
      }
    } else {
      const dataTypes = [];
      if (includeSpectral) dataTypes.push('spectral');
      if (includeLab) dataTypes.push('Lab');
      errors.push(`${colorName}: No valid ${dataTypes.join(' or ')} data available for export`);
    }
  });

  return {
    isValid: errors.length === 0 && exportableCount > 0,
    exportableCount,
    totalColors: references.length,
    warnings,
    errors
  };
}

export function validateSpectralData(spectralData, colorName = 'Color') {
  const warnings = [];
  const errors = [];

  if (!spectralData || typeof spectralData !== 'object') {
    errors.push(`${colorName}: Invalid spectral data format`);
    return { isValid: false, warnings, errors };
  }

  const wavelengths = Object.keys(spectralData).map(Number).filter(wl => !isNaN(wl));
  
  if (wavelengths.length === 0) {
    errors.push(`${colorName}: No valid wavelength data found`);
    return { isValid: false, warnings, errors };
  }

  const sortedWls = wavelengths.sort((a, b) => a - b);
  const startWL = sortedWls[0];
  const increment = sortedWls.length > 1 ? (sortedWls[1] - sortedWls[0]) : 10;

  // Validate wavelength range per CxF3 schema
  if (startWL < 360 || startWL > 400) {
    warnings.push(`${colorName}: StartWL ${startWL}nm outside recommended range (360-400nm)`);
  }

  // Validate increment
  const validIncrements = [1, 2, 5, 10, 20];
  if (!validIncrements.includes(increment)) {
    warnings.push(`${colorName}: Increment ${increment}nm not standard (recommended: 1,2,5,10,20nm)`);
  }

  // Check for consistent increment
  const inconsistentIncrements = sortedWls.slice(1).some((wl, idx) => {
    return Math.abs((wl - sortedWls[idx]) - increment) > 0.1;
  });

  if (inconsistentIncrements) {
    warnings.push(`${colorName}: Inconsistent wavelength increments detected`);
  }

  // Validate and normalize reflectance values
  const maxValue = Math.max(...wavelengths.map(wl => spectralData[wl]));
  const needsNormalization = maxValue > 1.1; // Allow small tolerance for noise
  
  if (needsNormalization) {
    warnings.push(`${colorName}: Reflectance values appear to be on 0-100 scale (max: ${maxValue.toFixed(2)}), will auto-normalize to 0-1 scale`);
    
    // Normalize in-place
    wavelengths.forEach(wl => {
      spectralData[wl] = spectralData[wl] / 100;
    });
  }

  // Check for invalid values after normalization
  const invalidValues = wavelengths.filter(wl => {
    const value = spectralData[wl];
    return typeof value !== 'number' || !isFinite(value) || value < 0 || value > 1.1;
  });

  if (invalidValues.length > 0) {
    errors.push(`${colorName}: Invalid reflectance values at wavelengths: ${invalidValues.join(', ')}nm (must be 0-1 after normalization)`);
  }

  // Check wavelength coverage
  const coverage = sortedWls[sortedWls.length - 1] - sortedWls[0];
  if (coverage < 300) {
    warnings.push(`${colorName}: Limited spectral coverage (${coverage}nm). Consider 380-730nm for better compatibility`);
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    startWL,
    increment,
    wavelengthCount: sortedWls.length
  };
}

export function validateLabData(lab, colorName = 'Color') {
  const warnings = [];
  const errors = [];

  if (!lab || typeof lab !== 'object') {
    errors.push(`${colorName}: Invalid Lab data format`);
    return { isValid: false, warnings, errors };
  }

  const { L, a, b } = lab;

  // Check data types
  if (typeof L !== 'number' || typeof a !== 'number' || typeof b !== 'number') {
    errors.push(`${colorName}: Lab values must be numbers (L=${L}, a=${a}, b=${b})`);
    return { isValid: false, warnings, errors };
  }

  // Check for NaN or Infinity
  if (!isFinite(L) || !isFinite(a) || !isFinite(b)) {
    errors.push(`${colorName}: Lab values must be finite numbers`);
    return { isValid: false, warnings, errors };
  }

  // CxF3 schema requirement: L >= 0
  if (L < 0) {
    errors.push(`${colorName}: Lab L* value must be ≥ 0 (current: ${L})`);
  }

  // Reasonable range warnings
  if (L > 100) {
    warnings.push(`${colorName}: Lab L* value ${L.toFixed(2)} exceeds typical range (0-100)`);
  }

  if (Math.abs(a) > 150) {
    warnings.push(`${colorName}: Lab a* value ${a.toFixed(2)} exceeds typical range (-150 to +150)`);
  }

  if (Math.abs(b) > 150) {
    warnings.push(`${colorName}: Lab b* value ${b.toFixed(2)} exceeds typical range (-150 to +150)`);
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
}

export function validateInkConditionData(inkCondition, colorName = 'Ink') {
  const warnings = [];
  const errors = [];

  if (!inkCondition?.imported_tints || !Array.isArray(inkCondition.imported_tints)) {
    errors.push(`${colorName}: No tint data available for CxF/X-4 export`);
    return { isValid: false, warnings, errors };
  }

  const tints = inkCondition.imported_tints;
  
  if (tints.length === 0) {
    errors.push(`${colorName}: Empty tint data`);
    return { isValid: false, warnings, errors };
  }

  // Check for substrate measurement (0% tint)
  const hasSubstrate = tints.some(t => t.tintPercentage === 0 || t.measurementType === 'substrate');
  if (!hasSubstrate) {
    warnings.push(`${colorName}: No substrate measurement (0% tint) found`);
  }

  // Check for solid measurement (100% tint)
  const hasSolid = tints.some(t => t.tintPercentage === 100);
  if (!hasSolid) {
    warnings.push(`${colorName}: No solid measurement (100% tint) found`);
  }

  // Validate individual tints
  tints.forEach((tint, idx) => {
    const tintName = `${colorName} ${tint.tintPercentage}%`;
    
    // Check tint percentage
    if (typeof tint.tintPercentage !== 'number' || tint.tintPercentage < 0 || tint.tintPercentage > 100) {
      errors.push(`${tintName}: Invalid tint percentage (${tint.tintPercentage})`);
    }

    // Validate spectral data if present
    if (tint.spectralData) {
      const spectralValidation = validateSpectralData(tint.spectralData, tintName);
      warnings.push(...spectralValidation.warnings);
      errors.push(...spectralValidation.errors);
    }

    // Validate Lab data if present
    if (tint.lab) {
      const labValidation = validateLabData(tint.lab, tintName);
      warnings.push(...labValidation.warnings);
      errors.push(...labValidation.errors);
    }

    // Check that tint has some color data
    if (!tint.spectralData && !tint.lab) {
      errors.push(`${tintName}: No spectral or Lab data available`);
    }
  });

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    tintCount: tints.length
  };
}

export function generateExportSummary(validation, format = 'CxF3') {
  const { exportableCount, totalColors, warnings, errors } = validation;
  
  let summary = `${format} Export Summary:\n`;
  summary += `• ${exportableCount}/${totalColors} colors can be exported\n`;
  
  if (warnings.length > 0) {
    summary += `• ${warnings.length} warnings\n`;
  }
  
  if (errors.length > 0) {
    summary += `• ${errors.length} errors preventing export\n`;
  }

  if (warnings.length > 0 || errors.length > 0) {
    summary += '\nDetails:\n';
    
    errors.forEach(error => {
      summary += `❌ ${error}\n`;
    });
    
    warnings.forEach(warning => {
      summary += `⚠️  ${warning}\n`;
    });
  }

  return summary;
}