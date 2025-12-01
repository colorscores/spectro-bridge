/**
 * Normalizes color data from various sources into a consistent format
 * Expected output format: { id, name, hex, lab_l?, lab_a?, lab_b? }
 */
export const normalizeColors = (colors) => {
  if (!colors || !Array.isArray(colors)) {
    return [];
  }

  return colors.map(color => {
    // Handle different color object structures
    if (typeof color === 'string') {
      // If it's just a hex string
      return {
        id: color,
        name: color,
        hex: color.startsWith('#') ? color : `#${color}`
      };
    }

    // Standard color object normalization
    const normalizedColor = {
      id: color.id || color.color_id || color.hex || Math.random().toString(36).substr(2, 9),
      name: color.name || color.color_name || color.hex || 'Unnamed Color',
      hex: color.hex || color.color_hex || '#000000',
      // Preserve is_routed flag for filtering
      is_routed: color.is_routed === true
    };

    // Ensure hex starts with #
    if (!normalizedColor.hex.startsWith('#')) {
      normalizedColor.hex = `#${normalizedColor.hex}`;
    }

    // Add LAB values if available
    if (color.lab_l !== undefined) normalizedColor.lab_l = color.lab_l;
    if (color.lab_a !== undefined) normalizedColor.lab_a = color.lab_a;
    if (color.lab_b !== undefined) normalizedColor.lab_b = color.lab_b;

    return normalizedColor;
  });
};

/**
 * Normalizes a single color object for consistent UI consumption
 * Ensures spectral components can find the data they expect
 */
export const normalizeColorForUI = (colorRow, measurements = []) => {
  if (!colorRow) return null;

  const normalized = {
    ...colorRow,
    // Ensure consistent field naming for UI components
    color_hex: colorRow.color_hex || colorRow.hex,
    hex: colorRow.hex || colorRow.color_hex,
  };

  // Create lab object from separate fields if needed
  if (colorRow.lab_l !== undefined && colorRow.lab_a !== undefined && colorRow.lab_b !== undefined) {
    normalized.lab = {
      L: colorRow.lab_l,
      a: colorRow.lab_a,
      b: colorRow.lab_b
    };
  }

  // Preserve existing lab object if it exists
  if (colorRow.lab && typeof colorRow.lab === 'object') {
    normalized.lab = colorRow.lab;
  }

  // Ensure measurements are preserved
  if (measurements.length > 0) {
    normalized.measurements = measurements;
  }

  return normalized;
};

/**
 * Safely applies a delta update to a normalized color object
 * Preserves measurements, spectral data, and other derived fields
 */
export const applyColorDeltaForUI = (currentColor, delta) => {
  if (!currentColor || !delta) return currentColor;

  const updated = { ...currentColor };

  // Safe fields that can be directly merged
  const safeFields = ['name', 'hex', 'lab_l', 'lab_a', 'lab_b', 'lab_illuminant', 'lab_observer', 'lab_table', 'status', 'tags'];
  
  safeFields.forEach(field => {
    if (delta[field] !== undefined) {
      updated[field] = delta[field];
    }
  });

  // Update derived fields
  if (delta.hex) {
    updated.color_hex = delta.hex;
  }

  // Update lab object if individual lab fields changed
  if (delta.lab_l !== undefined || delta.lab_a !== undefined || delta.lab_b !== undefined) {
    updated.lab = {
      L: delta.lab_l !== undefined ? delta.lab_l : (updated.lab?.L || 0),
      a: delta.lab_a !== undefined ? delta.lab_a : (updated.lab?.a || 0),
      b: delta.lab_b !== undefined ? delta.lab_b : (updated.lab?.b || 0)
    };
  }

  return updated;
};