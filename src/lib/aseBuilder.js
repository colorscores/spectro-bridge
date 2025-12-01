// Adobe Swatch Exchange (ASE) file builder
// Builds binary ASE files according to Adobe's specification
// All colors are set to colortype=Spot and ColorMode=Lab as requested

export function buildASE({ references = [], measurementsByColorId = {}, filename = '', title = '' }) {
  console.log(`[ASE Builder] Building ASE file with ${references.length} references`);
  console.log(`[ASE Builder] measurementsByColorId keys:`, Object.keys(measurementsByColorId));
  console.log(`[ASE Builder] Sample references:`, references.slice(0, 3));
  
  let exportedCount = 0;
  let skippedCount = 0;
  const validationWarnings = [];
  
  // ASE file structure constants
  const ASE_SIGNATURE = 'ASEF';
  const ASE_VERSION_MAJOR = 1;
  const ASE_VERSION_MINOR = 0;
  const BLOCK_TYPE_GROUP_START = 0xC001;
  const BLOCK_TYPE_GROUP_END = 0xC002;
  const BLOCK_TYPE_COLOR = 0x0001;
  const COLOR_MODE_LAB = 'LAB ';
  const COLOR_TYPE_SPOT = 1;
  
  // Collect valid colors with Lab values
  const validColors = [];
  
  references.forEach((ref, idx) => {
    const colorId = ref.color_id;
    const name = ref.name || `Color ${idx + 1}`;
    
    console.log(`[ASE Builder] Processing color ${idx + 1}:`, {
      colorId,
      name,
      hasRefLab: !!ref.reference_lab,
      hasLab: !!ref.lab,
      refLabValue: ref.reference_lab,
      labValue: ref.lab,
      hasMeasData: !!measurementsByColorId[colorId]
    });
    
    // Try to get Lab values from multiple sources
    let lab = null;
    let labSource = 'none';
    
    // 1. Check measurement data first
    const measData = measurementsByColorId[colorId];
    if (measData && typeof measData === 'object') {
      console.log(`[ASE Builder] Checking measurement data for ${name}:`, measData);
      // Handle per-mode format
      const modeKeys = Object.keys(measData).filter(key => /^[Mm][0-3]$/.test(key));
      if (modeKeys.length > 0) {
        // Find first mode with Lab data
        for (const key of modeKeys) {
          const meas = measData[key];
          if (meas?.lab && typeof meas.lab.L === 'number' && typeof meas.lab.a === 'number' && typeof meas.lab.b === 'number') {
            lab = meas.lab;
            labSource = `measurement-${key}`;
            break;
          }
        }
      } else if (measData.lab && typeof measData.lab.L === 'number' && typeof measData.lab.a === 'number' && typeof measData.lab.b === 'number') {
        // Single measurement format
        lab = measData.lab;
        labSource = 'measurement-single';
      }
    }
    
    // 2. Fall back to reference Lab
    if (!lab && ref.reference_lab && typeof ref.reference_lab.L === 'number' && typeof ref.reference_lab.a === 'number' && typeof ref.reference_lab.b === 'number') {
      lab = ref.reference_lab;
      labSource = 'reference_lab';
    }
    
    // 3. Fall back to color Lab
    if (!lab && ref.lab && typeof ref.lab.L === 'number' && typeof ref.lab.a === 'number' && typeof ref.lab.b === 'number') {
      lab = ref.lab;
      labSource = 'color_lab';
    }
    
    console.log(`[ASE Builder] Lab analysis for ${name}:`, {
      foundLab: !!lab,
      labSource,
      labValues: lab,
      isValid: lab ? validateLabValues(lab) : false
    });
    
    if (lab && validateLabValues(lab)) {
      validColors.push({ name, lab });
      exportedCount++;
      console.log(`[ASE Builder] ✅ Color "${name}" added to export (source: ${labSource})`);
    } else {
      const reason = !lab ? 'No Lab values found' : 'Lab validation failed';
      validationWarnings.push(`Color "${name}" skipped: ${reason} (${labSource})`);
      skippedCount++;
      console.log(`[ASE Builder] ❌ Color "${name}" skipped: ${reason}`);
    }
  });
  
  if (validColors.length === 0) {
    return { 
      data: null, 
      exportedCount: 0, 
      skippedCount, 
      validationWarnings: ['No colors with valid Lab values found for ASE export'] 
    };
  }
  
  // Calculate total file size
  // Header: signature(4) + version(2) + version(2) + numBlocks(4) = 12 bytes
  let totalSize = 12;
  
  // Group block sizes
  const groupName = title || filename.replace(/\.[^/.]+$/, '') || 'Exported Colors';
  const groupNameCharCount = (groupName?.length || 0) + 1; // include null terminator
  const groupNameBytes = groupNameCharCount * 2; // UTF-16BE bytes including null
  // Block header(6) + [nameLen(2) + nameBytes]
  totalSize += 6 + (2 + groupNameBytes); // Group start block
  totalSize += 6; // Group end block (no payload)
  
  // Color block sizes
  validColors.forEach(color => {
    const nameCharCount = (color.name?.length || 0) + 1; // include null terminator
    const nameBytes = nameCharCount * 2; // UTF-16BE bytes including null
    // Block header(6) + [nameLen(2) + nameBytes] + mode(4) + LAB(12) + type(2)
    totalSize += 6 + (2 + nameBytes) + 4 + 12 + 2;
  });
  
  // Create binary buffer
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const uint8View = new Uint8Array(buffer);
  
  let offset = 0;
  
  // Write ASE header
  writeString(uint8View, offset, ASE_SIGNATURE, 'ascii');
  offset += 4;
  view.setUint16(offset, ASE_VERSION_MAJOR, false); // Big endian
  offset += 2;
  view.setUint16(offset, ASE_VERSION_MINOR, false);
  offset += 2;
  
  const numBlocks = 2 + validColors.length; // Group start + colors + group end
  view.setUint32(offset, numBlocks, false);
  offset += 4;
  
  // Write group start block
  view.setUint16(offset, BLOCK_TYPE_GROUP_START, false);
  offset += 2;
  const groupNameCharCountAtWrite = (groupName?.length || 0) + 1; // include null
  const groupBlockSize = 2 + groupNameCharCountAtWrite * 2;
  view.setUint32(offset, groupBlockSize, false);
  offset += 4;
  view.setUint16(offset, groupNameCharCountAtWrite, false);
  offset += 2;
  // Name (UTF-16BE) + null terminator
  writeString(uint8View, offset, groupName, 'utf16be');
  offset += (groupName?.length || 0) * 2;
  uint8View[offset] = 0; uint8View[offset + 1] = 0;
  offset += 2;
  
  // Write color blocks
  validColors.forEach(color => {
    view.setUint16(offset, BLOCK_TYPE_COLOR, false);
    offset += 2;
    
    const nameCharCount = (color.name?.length || 0) + 1; // include null
    const colorBlockSize = 2 + (nameCharCount * 2) + 4 + 12 + 2;
    view.setUint32(offset, colorBlockSize, false);
    offset += 4;
    
    // Color name (UTF-16BE) + null terminator
    view.setUint16(offset, nameCharCount, false);
    offset += 2;
    writeString(uint8View, offset, color.name, 'utf16be');
    offset += (color.name?.length || 0) * 2;
    uint8View[offset] = 0; uint8View[offset + 1] = 0;
    offset += 2;
    
    // Color mode (LAB)
    writeString(uint8View, offset, COLOR_MODE_LAB, 'ascii');
    offset += 4;
    
    // Lab values (4 bytes each, big endian) - Adobe expects L* normalized to 0-1, a*b* in native ranges
    const normalizedL = color.lab.L / 100; // Normalize L* from 0-100 to 0-1 for Adobe
    console.log(`[ASE Builder] Color "${color.name}": L=${color.lab.L} -> ${normalizedL}, a=${color.lab.a}, b=${color.lab.b}`);
    view.setFloat32(offset, normalizedL, false);
    offset += 4;
    view.setFloat32(offset, color.lab.a, false); // a* stays in native range
    offset += 4;
    view.setFloat32(offset, color.lab.b, false); // b* stays in native range
    offset += 4;
    
    // Color type (Spot = 1)
    view.setUint16(offset, COLOR_TYPE_SPOT, false);
    offset += 2;
  });
  
  // Write group end block
  view.setUint16(offset, BLOCK_TYPE_GROUP_END, false);
  offset += 2;
  view.setUint32(offset, 0, false); // No data for group end
  offset += 4;
  
  console.log(`[ASE Builder] Bytes written: ${offset}/${totalSize}`);
  console.log(`[ASE Builder] Successfully built ASE file: ${exportedCount} colors exported, ${skippedCount} skipped`);
  
  return {
    data: uint8View,
    exportedCount,
    skippedCount,
    validationWarnings
  };
}

function validateLabValues(lab) {
  if (!lab) {
    console.log('[ASE Builder] Lab validation failed: lab is null/undefined');
    return false;
  }
  
  const isValid = lab && 
         typeof lab.L === 'number' && !isNaN(lab.L) && lab.L >= 0 && lab.L <= 100 &&
         typeof lab.a === 'number' && !isNaN(lab.a) && lab.a >= -128 && lab.a <= 127 &&
         typeof lab.b === 'number' && !isNaN(lab.b) && lab.b >= -128 && lab.b <= 127;
  
  if (!isValid) {
    console.log('[ASE Builder] Lab validation failed:', {
      lab,
      LType: typeof lab.L,
      LValue: lab.L,
      LValid: typeof lab.L === 'number' && !isNaN(lab.L) && lab.L >= 0 && lab.L <= 100,
      aType: typeof lab.a,
      aValue: lab.a,
      aValid: typeof lab.a === 'number' && !isNaN(lab.a) && lab.a >= -128 && lab.a <= 127,
      bType: typeof lab.b,
      bValue: lab.b,
      bValid: typeof lab.b === 'number' && !isNaN(lab.b) && lab.b >= -128 && lab.b <= 127
    });
  }
  
  return isValid;
}

function writeString(uint8View, offset, str, encoding) {
  if (encoding === 'ascii') {
    for (let i = 0; i < str.length; i++) {
      uint8View[offset + i] = str.charCodeAt(i);
    }
  } else if (encoding === 'utf16be') {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      uint8View[offset + i * 2] = (code >> 8) & 0xFF;
      uint8View[offset + i * 2 + 1] = code & 0xFF;
    }
  }
}

export function downloadASE(data, filename) {
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.ase') ? filename : `${filename}.ase`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}