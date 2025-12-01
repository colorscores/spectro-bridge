// White point constants for Lab/Hex conversions - Updated with complete ASTM E308 data
export const WHITE_POINTS = {
  // 2° Observer white points
  'A': { X: 109.850, Y: 100.000, Z: 35.585 },
  'C': { X: 98.074, Y: 100.000, Z: 118.232 },
  'D50': { X: 96.422, Y: 100.000, Z: 82.521 },
  'D65': { X: 95.047, Y: 100.000, Z: 108.883 },
  'F2': { X: 99.187, Y: 100.000, Z: 67.395 },
  'F7': { X: 95.044, Y: 100.000, Z: 108.755 },
  'F11': { X: 100.966, Y: 100.000, Z: 64.370 },
  
  // 10° Observer white points
  'A_10': { X: 111.140, Y: 100.000, Z: 35.200 },
  'C_10': { X: 97.286, Y: 100.000, Z: 116.144 },
  'D50_10': { X: 96.720, Y: 100.000, Z: 81.427 },
  'D65_10': { X: 94.811, Y: 100.000, Z: 107.304 },
  'F2_10': { X: 103.281, Y: 100.000, Z: 69.030 },
  'F7_10': { X: 95.791, Y: 100.000, Z: 107.689 },
  'F11_10': { X: 103.869, Y: 100.000, Z: 65.609 },
};

export const ILLUMINANT_NAMES = {
  'A': 'A (Incandescent)',
  'C': 'C (Average Daylight)',
  'D50': 'D50 (Daylight 5000K)', 
  'D65': 'D65 (Daylight 6500K)',
  'F2': 'F2 (Fluorescent)',
  'F7': 'F7 (Broad-band Fluorescent)',
  'F11': 'F11 (Narrow-band Fluorescent)',
};

export const OBSERVER_NAMES = {
  '2': 'CIE 1931 2° Standard Observer',
  '10': 'CIE 1964 10° Standard Observer',
};