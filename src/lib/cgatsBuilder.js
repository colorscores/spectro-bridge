// CGATS (Committee for Graphic Arts Technologies Standards) format builder
// Builds CGATS files with spectral and Lab data for color management workflows

export function buildCGATS({ references = [], measurementsByColorId = {}, filename = '', options = {}, orgDefaults = {} }) {
  console.log(`[CGATS Builder] Building CGATS file with ${references.length} references`);
  
  const { includeSpectral = true, includeLab = true, includeDeviceInfo = false } = options;
  const defaultMode = orgDefaults?.default_measurement_mode || 'M1';
  const defaultIlluminant = orgDefaults?.default_illuminant || 'D50';
  const defaultObserver = orgDefaults?.default_observer || '2';
  
  let exportedCount = 0;
  let skippedCount = 0;
  const validationWarnings = [];
  
  // Collect valid color data
  const validColors = [];
  const spectralWavelengths = new Set();
  let hasAnySpectral = false;
  let hasAnyLab = false;
  
  references.forEach((ref, idx) => {
    const colorId = ref.color_id;
    const name = ref.name || `Color_${idx + 1}`;
    
    let colorData = {
      sampleName: sanitizeSampleName(name),
      lab: null,
      spectral: null,
      mode: defaultMode
    };
    
    // Get measurement data
    const measData = measurementsByColorId[colorId];
    if (measData && typeof measData === 'object') {
      // Handle per-mode format
      const modeKeys = Object.keys(measData).filter(key => /^[Mm][0-3]$/.test(key));
      if (modeKeys.length > 0) {
        // Use first available mode with data
        for (const key of modeKeys) {
          const meas = measData[key];
          if (meas && (meas.spectral_data || meas.lab)) {
            colorData.mode = key.toUpperCase();
            
            if (includeSpectral && meas.spectral_data && typeof meas.spectral_data === 'object') {
              colorData.spectral = meas.spectral_data;
              Object.keys(meas.spectral_data).forEach(wl => spectralWavelengths.add(parseInt(wl)));
              hasAnySpectral = true;
            }
            
            if (includeLab && meas.lab && validateLabValues(meas.lab)) {
              colorData.lab = meas.lab;
              hasAnyLab = true;
            }
            break;
          }
        }
      } else {
        // Single measurement format
        colorData.mode = (measData.mode || defaultMode).toUpperCase();
        
        if (includeSpectral && measData.spectral_data && typeof measData.spectral_data === 'object') {
          colorData.spectral = measData.spectral_data;
          Object.keys(measData.spectral_data).forEach(wl => spectralWavelengths.add(parseInt(wl)));
          hasAnySpectral = true;
        }
        
        if (includeLab && measData.lab && validateLabValues(measData.lab)) {
          colorData.lab = measData.lab;
          hasAnyLab = true;
        }
      }
    }
    
    // Fall back to reference Lab if no measurement Lab
    if (includeLab && !colorData.lab) {
      const refLab = ref.reference_lab || ref.lab;
      if (refLab && validateLabValues(refLab)) {
        colorData.lab = refLab;
        hasAnyLab = true;
      }
    }
    
    // Check if we have any valid data
    if (colorData.spectral || colorData.lab) {
      validColors.push(colorData);
      exportedCount++;
    } else {
      validationWarnings.push(`Color "${name}" skipped: No valid spectral or Lab data found`);
      skippedCount++;
    }
  });
  
  if (validColors.length === 0) {
    return {
      data: '',
      exportedCount: 0,
      skippedCount,
      validationWarnings: ['No colors with valid data found for CGATS export']
    };
  }
  
  // Sort wavelengths for consistent output
  const sortedWavelengths = Array.from(spectralWavelengths).sort((a, b) => a - b);
  
  // Build CGATS file content
  const lines = [];
  
  // Header
  lines.push('CGATS.17');
  lines.push('');
  lines.push('# CGATS file exported from Kontrol');
  lines.push(`# Created: ${new Date().toISOString()}`);
  lines.push(`# Colors: ${exportedCount}`);
  if (hasAnySpectral) {
    lines.push(`# Illuminant: ${defaultIlluminant}`);
    lines.push(`# Observer: ${defaultObserver}°`);
    lines.push(`# Measurement condition: ${defaultMode}`);
  }
  lines.push('');
  
  // Keywords
  lines.push('KEYWORD "ORIGINATOR"');
  lines.push('"Kontrol Color Management System"');
  lines.push('');
  
  if (filename) {
    lines.push('KEYWORD "FILE_DESCRIPTOR"');
    lines.push(`"${filename}"`);
    lines.push('');
  }
  
  if (hasAnySpectral) {
    lines.push('KEYWORD "INSTRUMENTATION"');
    lines.push('"Unknown"');
    lines.push('');
    
    lines.push('KEYWORD "MEASUREMENT_SOURCE"');
    lines.push('"Illumination=Unknown:ObserverAngle=Unknown:WhiteBase=Automatic:Filter=Unknown"');
    lines.push('');
  }
  
  // Data format
  lines.push('BEGIN_DATA_FORMAT');
  
  const fields = ['SAMPLE_NAME'];
  
  if (hasAnyLab) {
    fields.push('LAB_L', 'LAB_A', 'LAB_B');
  }
  
  if (hasAnySpectral && sortedWavelengths.length > 0) {
    sortedWavelengths.forEach(wl => {
      fields.push(`SPECTRAL_${wl}`);
    });
  }
  
  if (includeDeviceInfo) {
    fields.push('MEASUREMENT_MODE');
  }
  
  lines.push(fields.join(' '));
  lines.push('END_DATA_FORMAT');
  lines.push('');
  
  // Number of data sets
  lines.push('BEGIN_DATA');
  lines.push(`${validColors.length}`);
  
  // Data rows
  validColors.forEach(colorData => {
    const row = [colorData.sampleName];
    
    if (hasAnyLab) {
      if (colorData.lab) {
        row.push(
          formatNumber(colorData.lab.L),
          formatNumber(colorData.lab.a),
          formatNumber(colorData.lab.b)
        );
      } else {
        row.push('-', '-', '-'); // Missing Lab data
      }
    }
    
    if (hasAnySpectral && sortedWavelengths.length > 0) {
      sortedWavelengths.forEach(wl => {
        if (colorData.spectral && colorData.spectral[wl] !== undefined) {
          row.push(formatNumber(colorData.spectral[wl]));
        } else {
          row.push('-'); // Missing spectral data point
        }
      });
    }
    
    if (includeDeviceInfo) {
      row.push(colorData.mode);
    }
    
    lines.push(row.join(' '));
  });
  
  lines.push('END_DATA');
  
  const content = lines.join('\n');
  
  console.log(`[CGATS Builder] Successfully built CGATS file: ${exportedCount} colors exported, ${skippedCount} skipped`);
  
  return {
    data: content,
    exportedCount,
    skippedCount,
    validationWarnings
  };
}

function validateLabValues(lab) {
  return lab && 
         typeof lab.L === 'number' && !isNaN(lab.L) && lab.L >= 0 && lab.L <= 100 &&
         typeof lab.a === 'number' && !isNaN(lab.a) && lab.a >= -128 && lab.a <= 127 &&
         typeof lab.b === 'number' && !isNaN(lab.b) && lab.b >= -128 && lab.b <= 127;
}

function sanitizeSampleName(name) {
  // Remove or replace characters that might cause issues in CGATS format
  return name.replace(/[\s"]/g, '_').substring(0, 50);
}

function formatNumber(value, precision = 4) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '-';
  }
  return value.toFixed(precision);
}

export function downloadCGATS(data, filename) {
  const blob = new Blob([data], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}