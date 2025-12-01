// Utility function to convert Lab values to RGB hex color using D50/2 illuminant
export const labToHex = (l, a, b) => {
  // Convert Lab to XYZ using D50 illuminant
  let y = (l + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  // Apply inverse f function
  const fx = x > 0.206893034 ? Math.pow(x, 3) : (x - 16/116) / 7.787;
  const fy = y > 0.206893034 ? Math.pow(y, 3) : (y - 16/116) / 7.787;
  const fz = z > 0.206893034 ? Math.pow(z, 3) : (z - 16/116) / 7.787;

  // D50 illuminant values
  const xn = 0.96422;
  const yn = 1.00000;
  const zn = 0.82521;

  x = fx * xn;
  y = fy * yn;
  z = fz * zn;

  // Convert XYZ to sRGB
  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let bVal = x * 0.0557 + y * -0.2040 + z * 1.0570;

  // Apply gamma correction
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1/2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1/2.4) - 0.055 : 12.92 * g;
  bVal = bVal > 0.0031308 ? 1.055 * Math.pow(bVal, 1/2.4) - 0.055 : 12.92 * bVal;

  // Clamp to 0-255 range
  r = Math.max(0, Math.min(255, Math.round(r * 255)));
  g = Math.max(0, Math.min(255, Math.round(g * 255)));
  bVal = Math.max(0, Math.min(255, Math.round(bVal * 255)));

  // Convert to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bVal.toString(16).padStart(2, '0')}`;
};

// Get substrate color for a condition based on pack type (mock data)
export const getSubstrateColor = (condition) => {
  // Mock substrate Lab values based on pack type
  // In production, these would come from the actual substrate condition data
  const substrateLabValues = {
    'Flexible': { l: 95.2, a: -0.8, b: 2.1 },
    'Rigid': { l: 92.1, a: 1.2, b: -1.5 },
    'Standard': { l: 94.0, a: 0.1, b: 0.8 },
    'Photo Paper': { l: 96.5, a: -1.0, b: 3.2 },
    'Plain Paper': { l: 93.8, a: 0.5, b: 1.8 },
  };
  
  const labValues = substrateLabValues[condition.pack_type] || { l: 95, a: 0, b: 0 };
  return labToHex(labValues.l, labValues.a, labValues.b);
};