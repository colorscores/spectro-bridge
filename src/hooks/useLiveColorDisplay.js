import { useMemo } from 'react';
import { spectralToLabASTME308, labToHex, labToChromaHue } from '@/lib/colorUtils';

/**
 * Hook to calculate live color values (Lab, Chroma/Hue, Hex) from spectral data and measurement controls
 * NOTE: This hook is deprecated - use useMemoizedSpectralCalculations for ASTM E308 calculations
 * Returns fallback values when spectral data is unavailable or calculation fails
 */
export const useLiveColorDisplay = (spectralData, measurementControls, fallbackValues = {}) => {
  const calculatedValues = useMemo(() => {
    // If no spectral data, return fallback values
    if (!spectralData || Object.keys(spectralData).length === 0) {
      return {
        lab: fallbackValues.lab || null,
        ch: fallbackValues.ch || null,
        hex: fallbackValues.hex || '#FFFFFF',
        source: 'fallback'
      };
    }

    // If no measurement controls, return fallback values
    if (!measurementControls) {
      return {
        lab: fallbackValues.lab || null,
        ch: fallbackValues.ch || null,
        hex: fallbackValues.hex || '#FFFFFF',
        source: 'fallback'
      };
    }

    try {
      let lab = null;

      // DEPRECATED: This hook no longer supports spectral calculations
      // Use useMemoizedSpectralCalculations with ASTM E308 tables instead
      console.warn('useLiveColorDisplay: spectral calculations deprecated, returning fallback values');
      
      return {
        lab: fallbackValues.lab || null,
        ch: fallbackValues.ch || null,
        hex: fallbackValues.hex || '#FFFFFF',
        source: 'fallback-deprecated'
      };

    } catch (error) {
      console.error('Error in useLiveColorDisplay:', error);
      return {
        lab: fallbackValues.lab || null,
        ch: fallbackValues.ch || null,
        hex: fallbackValues.hex || '#FFFFFF',
        source: 'fallback-error'
      };
    }
  }, [spectralData, measurementControls, fallbackValues]);

  return calculatedValues;
};