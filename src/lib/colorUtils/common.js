import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function getContrastColor(hexColor) {
  if (!hexColor) return 'text-white';
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? 'text-black' : 'text-white';
}

export function getSubstrateIconColor(colorNameOrHex) {
  // If it's a hex color, use proper contrast calculation
  if (colorNameOrHex && colorNameOrHex.startsWith('#')) {
    return getContrastColor(colorNameOrHex);
  }
  
  // Color name mapping for legacy support
  const colorMap = {
    'Brown': '#8B4513',
    'White': '#FFFFFF',
    'Clear': '#F3F4F6',
    'Black': '#000000',
    'Gray': '#808080',
    'Grey': '#808080'
  };
  
  const hex = colorMap[colorNameOrHex];
  if (hex) {
    return getContrastColor(hex);
  }
  
  // Default fallback
  return 'text-gray-600';
}

export function hexToRgb(hex) {
    if (!hex) return { r: 0, g: 0, b: 0 };
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

export function generateRandomSpectralData() {
    const data = {};
    for (let i = 400; i <= 700; i += 10) {
        data[i] = (Math.random() * 0.6 + 0.2).toFixed(4);
    }
    return data;
}

/**
 * Extracts spectral data from an object, checking all possible locations
 * @param {Object} obj - Object that may contain spectral data
 * @param {string} context - Context for logging (optional)
 * @returns {Object|null} - Spectral data object or null if not found
 */
export function extractSpectralData(obj, context = '') {
    if (!obj) return null;
    
    // Check primary locations in order of preference
    const locations = [
        { key: 'spectral_data', path: 'spectral_data' },
        { key: 'spectralData', path: 'spectralData' },
        { key: 'spectral', path: 'spectral' },
        { key: 'measurements[0].spectral_data', path: 'measurements.0.spectral_data' }
    ];
    
    for (const location of locations) {
        let spectralData = null;
        
        if (location.key === 'measurements[0].spectral_data') {
            spectralData = obj.measurements?.[0]?.spectral_data;
        } else {
            spectralData = obj[location.key];
        }
        
        if (spectralData && typeof spectralData === 'object' && Object.keys(spectralData).length > 0) {
            if (context) {
                console.log(`[SpectralData] Found spectral data at ${location.path} for ${context}`);
            }
            return spectralData;
        }
    }
    
    if (context) {
        console.log(`[SpectralData] No spectral data found for ${context}`);
    }
    return null;
}

export const spectralLibrariesData = {
    'Pantone Solid Coated': [
        { name: 'PANTONE 185 C', hex: '#C8102E' },
        { name: 'PANTONE 286 C', hex: '#0033A0' },
        { name: 'PANTONE 354 C', hex: '#00B140' },
        { name: 'PANTONE Yellow C', hex: '#FEDD00' },
    ],
    'DIC Color Guide': [
        { name: 'DIC 156', hex: '#F6A900' },
        { name: 'DIC 221', hex: '#0068B7' },
        { name: 'DIC 584', hex: '#00A95C' },
        { name: 'DIC 564', hex: '#E60012' },
    ],
};