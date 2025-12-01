import { supabase } from '@/lib/customSupabaseClient';

/**
 * Import ASTM E308 weighting tables from CSV/JSON data
 * @param {Array} rows - Array of row objects with required fields
 * @returns {Promise<Object>} Import result with verification sums
 */
export const importAstmWeights = async (rows) => {
  try {
    console.log(`[ASTM-IMPORT] Starting direct import of ${rows.length} rows (no modification)...`);
    
    // Validate data structure
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('No valid rows provided for import');
    }

    // Log data being sent for verification
    console.log('[ASTM-IMPORT] Sample row:', rows[0]);
    console.log('[ASTM-IMPORT] Wavelength range:', `${Math.min(...rows.map(r => r.wavelength))}-${Math.max(...rows.map(r => r.wavelength))}nm`);

    // Call the edge function for direct import (no RPC, no modification)
    const { data, error } = await supabase.functions.invoke('import-astm-weights', {
      body: { rows }
    });

    if (error) {
      console.error('[ASTM-IMPORT] Edge function error:', error);
      throw error;
    }

    console.log('[ASTM-IMPORT] Direct import completed successfully');
    console.log('[ASTM-IMPORT] Processed rows:', data.processed_rows);
    console.log('[ASTM-IMPORT] Combinations processed:', data.combinations);

    return data;
  } catch (error) {
    console.error('[ASTM-IMPORT] Failed to import ASTM weights:', error);
    throw error;
  }
};

/**
 * Parse CSV text into ASTM weight rows
 * Supports both vertical format (illuminant_name,observer,table_number,wavelength,x_factor,y_factor,z_factor)
 * and horizontal format (wavelengths as columns with X, Y, Z as rows)
 */
export const parseAstmCsv = (csvText, illuminant = 'D50', observer = '2', table = '5') => {
  const lines = csvText.trim().split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(/[,\t]/).map(h => h.trim());
  
  // Check if this is horizontal format (wavelengths as columns)
  const isHorizontalFormat = headers.some(h => {
    const num = parseInt(h);
    return !isNaN(num) && num >= 300 && num <= 800; // Wavelength range
  });
  
  if (isHorizontalFormat) {
    console.log('[ASTM-PARSE] Detected horizontal format, converting...');
    return parseHorizontalFormat(lines, illuminant, observer, table);
  } else {
    console.log('[ASTM-PARSE] Detected vertical format, parsing...');
    return parseVerticalFormat(lines);
  }
};

/**
 * Parse horizontal format where wavelengths are columns and X, Y, Z are rows
 */
const parseHorizontalFormat = (lines, illuminant = 'D50', observer = '2', table = '5') => {
  const rows = [];
  const headers = lines[0].split(/[,\t]/).map(h => h.trim());
  
  // Find wavelength columns (scan from index 0 to include 360nm)
  const wavelengthIndices = [];
  const wavelengths = [];
  
  for (let i = 0; i < headers.length; i++) {
    const wavelength = parseInt(headers[i]);
    if (!isNaN(wavelength) && wavelength >= 360 && wavelength <= 780) {
      wavelengthIndices.push(i);
      wavelengths.push(wavelength);
    }
  }
  
  // Find X, Y, Z rows
  let xRow = null, yRow = null, zRow = null;
  let whitePointX = null, whitePointY = null, whitePointZ = null;
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/[,\t]/).map(v => v.trim());
    const firstCol = values[0].toLowerCase();
    
    if (firstCol === 'x') {
      xRow = values;
    } else if (firstCol === 'y') {
      yRow = values;
    } else if (firstCol === 'z') {
      zRow = values;
    }
  }
  
  if (!xRow || !yRow || !zRow) {
    throw new Error('Could not find X, Y, Z rows in horizontal format');
  }
  
  // Extract white point from WP column in headers (case-insensitive)
  const wpHeaderIndex = headers.findIndex(h => h.toLowerCase().trim() === 'wp');
  
  console.log('[ASTM-PARSE] Looking for WP column in headers:', headers);
  console.log('[ASTM-PARSE] WP header index found:', wpHeaderIndex);
  
  if (wpHeaderIndex >= 0) {
    whitePointX = parseFloat(xRow[wpHeaderIndex]);
    whitePointY = parseFloat(yRow[wpHeaderIndex]);
    whitePointZ = parseFloat(zRow[wpHeaderIndex]);
    console.log('[ASTM-PARSE] Extracted white points from WP column:', { whitePointX, whitePointY, whitePointZ });
  } else {
    throw new Error('WP (White Point) column not found in CSV headers. Please ensure your CSV includes a "WP" column with white point values.');
  }
  
  // Convert to rows format
  for (let i = 0; i < wavelengths.length; i++) {
    const wavelength = wavelengths[i];
    const colIndex = wavelengthIndices[i];
    
    const x_factor = parseFloat(xRow[colIndex]) || 0;
    const y_factor = parseFloat(yRow[colIndex]) || 0;
    const z_factor = parseFloat(zRow[colIndex]) || 0;
    
    rows.push({
      illuminant_name: illuminant,
      observer: observer,
      table_number: parseInt(table),
      wavelength: wavelength,
      x_factor: x_factor,
      y_factor: y_factor,
      z_factor: z_factor,
      white_point_x: whitePointX,
      white_point_y: whitePointY,
      white_point_z: whitePointZ,
    });
  }
  
  return rows;
};

/**
 * Parse vertical format (traditional CSV)
 */
const parseVerticalFormat = (lines) => {
  const headers = lines[0].split(/[,\t]/).map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/[,\t]/).map(v => v.trim());
    if (values.length < 7) continue; // Skip incomplete rows
    
    const row = {
      illuminant_name: values[0],
      observer: values[1],
      table_number: parseInt(values[2]),
      wavelength: parseInt(values[3]),
      x_factor: parseFloat(values[4]),
      y_factor: parseFloat(values[5]),
      z_factor: parseFloat(values[6]),
    };

    // Optional white point data
    if (values.length >= 10) {
      row.white_point_x = values[7] ? parseFloat(values[7]) : null;
      row.white_point_y = values[8] ? parseFloat(values[8]) : null;
      row.white_point_z = values[9] ? parseFloat(values[9]) : null;
    }

    rows.push(row);
  }
  
  return rows;
};

// Validation function removed - data imported as-is without validation