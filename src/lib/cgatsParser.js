import { labToHex } from '@/lib/colorUtils';

export const parseCgats = (fileContent) => {
  const lines = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  
  let dataFormatIndex = -1;
  let dataIndex = -1;
  let fields = [];
  let sampleNameIndex = -1;

  for(let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toUpperCase();
    if (line.startsWith('BEGIN_DATA_FORMAT')) {
      dataFormatIndex = i + 1;
    } else if (line.startsWith('END_DATA_FORMAT') && dataFormatIndex !== -1) {
      const formatLines = lines.slice(dataFormatIndex, i).map(l => l.trim());
      fields = formatLines.join(' ').split(/\s+/).filter(f => f);
      const upperCaseFields = fields.map(f => f.toUpperCase());
      sampleNameIndex = upperCaseFields.findIndex(f => 
        f.startsWith('SAMPLE_NAM') || f === 'SAMPLEID' || f === 'SAMPLE_ID'
      );
    } else if (line.startsWith('BEGIN_DATA')) {
      dataIndex = i + 1;
    } else if (line.startsWith('END_DATA')) {
      break;
    }
  }

  if (dataIndex === -1 || fields.length === 0 || sampleNameIndex === -1) {
    throw new Error('CGATS file format is invalid. Could not find required keywords, data format, or SAMPLE_NAME field.');
  }
  
  const endDataLineIndex = lines.findIndex((l, i) => i >= dataIndex && l.trim().toUpperCase().startsWith('END_DATA'));
  const rawDataLines = lines.slice(dataIndex, endDataLineIndex !== -1 ? endDataLineIndex : lines.length);

  const colors = [];
  const upperCaseFields = fields.map(f => f.toUpperCase());
  
  // Check for spectral data
  const spectralFieldIndices = [];
  const spectralWavelengths = [];
  upperCaseFields.forEach((field, index) => {
    if (field.startsWith('SPECTRAL_')) {
      const wl = parseInt(field.split('_')[1]);
      if (!isNaN(wl)) {
        spectralFieldIndices.push(index);
        spectralWavelengths.push(wl);
      }
    }
  });

  // Check for CMYK data
  const cmykIndices = {
    c: upperCaseFields.findIndex(f => f === 'CMYK_C' || f === 'C'),
    m: upperCaseFields.findIndex(f => f === 'CMYK_M' || f === 'M'),
    y: upperCaseFields.findIndex(f => f === 'CMYK_Y' || f === 'Y'),
    k: upperCaseFields.findIndex(f => f === 'CMYK_K' || f === 'K')
  };

  // Check for multi-color data (4CLR, 5CLR, 6CLR, 7CLR, etc.)
  const colorChannelIndices = [];
  const colorChannelNames = [];
  let colorChannelCount = 0;
  
  // Look for patterns like 7CLR_1, 7CLR_2, etc.
  for (let i = 1; i <= 20; i++) { // Check up to 20 colors
    for (let clrCount = 3; clrCount <= 20; clrCount++) {
      const pattern = `${clrCount}CLR_${i}`;
      const index = upperCaseFields.findIndex(f => f === pattern);
      if (index !== -1) {
        colorChannelIndices.push(index);
        colorChannelNames.push(pattern);
        colorChannelCount = Math.max(colorChannelCount, clrCount);
      }
    }
  }
  
  // Also check for simple numbered patterns like COLOR_1, COLOR_2
  for (let i = 1; i <= 20; i++) {
    const patterns = [`COLOR_${i}`, `INK_${i}`, `CHANNEL_${i}`];
    for (const pattern of patterns) {
      const index = upperCaseFields.findIndex(f => f === pattern);
      if (index !== -1) {
        colorChannelIndices.push(index);
        colorChannelNames.push(pattern);
        colorChannelCount = Math.max(colorChannelCount, i);
      }
    }
  }

  // Check for LAB data
  const labIndices = {
    l: upperCaseFields.findIndex(f => f === 'LAB_L' || f === 'L*' || f === 'L_STAR'),
    a: upperCaseFields.findIndex(f => f === 'LAB_A' || f === 'A*' || f === 'A_STAR'),
    b: upperCaseFields.findIndex(f => f === 'LAB_B' || f === 'B*' || f === 'B_STAR')
  };

  // Check for XYZ data
  const xyzIndices = {
    x: upperCaseFields.findIndex(f => f === 'XYZ_X' || f === 'X'),
    y: upperCaseFields.findIndex(f => f === 'XYZ_Y' || f === 'Y'),
    z: upperCaseFields.findIndex(f => f === 'XYZ_Z' || f === 'Z')
  };

  const hasSpectral = spectralFieldIndices.length > 0;
  const hasCMYK = cmykIndices.c !== -1 && cmykIndices.m !== -1 && cmykIndices.y !== -1 && cmykIndices.k !== -1;
  const hasLAB = labIndices.l !== -1 && labIndices.a !== -1 && labIndices.b !== -1;
  const hasXYZ = xyzIndices.x !== -1 && xyzIndices.y !== -1 && xyzIndices.z !== -1;
  const hasMultiColor = colorChannelIndices.length > 0;

  if (!hasSpectral && !hasCMYK && !hasLAB && !hasXYZ && !hasMultiColor) {
    throw new Error('No supported color data found. File must contain SPECTRAL, CMYK, LAB, XYZ, or multi-color channel data.');
  }
  
  const dataLines = [];
  let currentLine = [];
  for (const rawLine of rawDataLines) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) continue;

    const parts = trimmedLine.split(/\s+/);
    currentLine.push(...parts);
    
    // Check if we have enough data for a complete row
    if (currentLine.length >= fields.length) {
      dataLines.push(currentLine.slice(0, fields.length).join(' '));
      currentLine = currentLine.slice(fields.length);
    }
  }

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const values = line.split(/\s+/);
    if (values.length < fields.length) continue;

    const name = values[sampleNameIndex].replace(/"/g, '') || `Patch ${colors.length + 1}`;
    let lab = null;
    let hex = '#000000';
    let spectral = {};
    let cmyk = null;
    let multiColorChannels = null;

    // Extract CMYK if available
    if (hasCMYK) {
      cmyk = {
        c: parseFloat(values[cmykIndices.c]) || 0,
        m: parseFloat(values[cmykIndices.m]) || 0,
        y: parseFloat(values[cmykIndices.y]) || 0,
        k: parseFloat(values[cmykIndices.k]) || 0
      };
    }

    // Extract LAB if available
    if (hasLAB) {
      lab = {
        L: parseFloat(values[labIndices.l]) || 0,
        a: parseFloat(values[labIndices.a]) || 0,
        b: parseFloat(values[labIndices.b]) || 0
      };
    }

    // Extract multi-color channels if available
    if (hasMultiColor) {
      multiColorChannels = {};
      colorChannelIndices.forEach((fieldIndex, i) => {
        const channelName = colorChannelNames[i];
        const value = parseFloat(values[fieldIndex]) || 0;
        multiColorChannels[channelName] = value;
      });
    }

    // Extract spectral if available
    if (hasSpectral) {
      let isValidSpectral = true;
      spectralFieldIndices.forEach((fieldIndex, i) => {
        const val = parseFloat(values[fieldIndex]);
        if (isNaN(val)) {
          isValidSpectral = false;
        }
        spectral[spectralWavelengths[i]] = val;
      });

      if (isValidSpectral) {
        // NOTE: Don't create placeholder Lab - let display logic handle spectral computation
        // Spectral data will be used directly for color computation
      }
    }

    // Convert CMYK to approximate RGB/HEX if no LAB data
    if (!lab && cmyk) {
      // Simple CMYK to RGB conversion for visualization
      const r = Math.round(255 * (1 - cmyk.c/100) * (1 - cmyk.k/100));
      const g = Math.round(255 * (1 - cmyk.m/100) * (1 - cmyk.k/100));
      const b = Math.round(255 * (1 - cmyk.y/100) * (1 - cmyk.k/100));
      hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    } else if (lab) {
      hex = labToHex(lab.L, lab.a, lab.b);
    }

    const colorData = {
      name,
      hex,
      ...(lab && { lab }),
      ...(cmyk && { cmyk }),
      ...(multiColorChannels && { multiColorChannels }),
      ...(hasSpectral && Object.keys(spectral).length > 0 && { spectral }),
      ...(colorChannelCount > 0 && { channelCount: colorChannelCount })
    };

    colors.push(colorData);
  }

  if (colors.length === 0) {
    throw new Error('No valid color data found in the file. Please check the file format and content.');
  }

  return colors;
};