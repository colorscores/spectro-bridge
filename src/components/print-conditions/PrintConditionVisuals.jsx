import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SpectralPlot from '@/components/conditions/SpectralPlot';
import ColorInfoPanel from '@/components/conditions/ColorInfoPanel';
import PrintConditionConstructionPanel from './PrintConditionConstructionPanel';
import { useSpectralCalculations } from '@/hooks/useSpectralCalculations';
import { labToHexD65 } from '@/lib/colorUtils';
import { useProfile } from '@/context/ProfileContext';
const PrintConditionVisuals = ({ condition, measurementControls, constructionDetails, onConstructionDetailsChange, onConditionChange, canEdit, setHasUnsavedChanges, isNew, organization }) => {
  
  // Calculate Lab and CH values from spectral data using measurement controls and org defaults
  const spectralCalculations = useSpectralCalculations(
    condition?.spectral_data,
    measurementControls?.illuminant || 'D50',
    measurementControls?.observer || '2',
    measurementControls?.table || '5'
  );
  
  // Use calculated values if condition doesn't have them, otherwise use condition values
  const labValues = condition?.lab || spectralCalculations.lab;
  const chValues = condition?.ch || spectralCalculations.ch;
  
  // Update condition with calculated values when they're available or when measurement controls change
  useEffect(() => {
    if (spectralCalculations.lab && onConditionChange) {
      // Always update when spectral calculations change (e.g., when measurement controls change)
      const hasSpectralData = condition?.spectral_data && Object.keys(condition.spectral_data).length > 0;
      if (hasSpectralData) {
        onConditionChange(prev => ({
          ...prev,
          lab: spectralCalculations.lab,
          ch: spectralCalculations.ch
        }));
      }
    }
  }, [spectralCalculations, measurementControls, onConditionChange]);

  // Get organization defaults for accurate color conversion
  const { orgDefaults } = useProfile();
  
  // Derive hex for appearance from Lab; keep previous to avoid flashes
  const appearanceHex = useMemo(() => {
    if (labValues?.L != null && labValues?.a != null && labValues?.b != null) {
      try {
        return labToHexD65(labValues.L, labValues.a, labValues.b, orgDefaults, measurementControls?.illuminant);
      } catch (e) {
        console.warn('Failed to compute appearance hex from Lab:', e);
        return null;
      }
    }
    return null;
  }, [labValues, orgDefaults, measurementControls]);
  const lastHexRef = useRef(null);
  useEffect(() => {
    if (appearanceHex) lastHexRef.current = appearanceHex;
  }, [appearanceHex]);

  // Parse spectral string if needed
  const parseSpectralString = (spectralString) => {
    if (!spectralString || typeof spectralString !== 'string') return null;
    try {
      return JSON.parse(spectralString);
    } catch (e) {
      console.warn('Failed to parse spectral_string:', e);
      return null;
    }
  };

  // Get spectral data from either source
  const spectralData = useMemo(() => {
    if (condition?.spectral_data && Object.keys(condition.spectral_data).length > 0) {
      return condition.spectral_data;
    }
    if (condition?.spectral_string) {
      const parsed = parseSpectralString(condition.spectral_string);
      if (parsed && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
    return null;
  }, [condition?.spectral_data, condition?.spectral_string]);

  // Check if we have measurement data to show the visual cards
  const hasSpectralData = spectralData && Object.keys(spectralData).length > 0;
  const shouldShowVisuals = hasSpectralData || !isNew;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-stretch">
      {shouldShowVisuals && (
        <>
          <div className="w-1/5 flex-shrink-0">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3 h-16"><CardTitle className="text-lg">Appearance</CardTitle></CardHeader>
              <CardContent className="flex-grow flex items-center justify-center p-4">
                <div className="w-full aspect-square bg-black rounded-md p-2.5 flex justify-center items-center">
                  <div 
                    className="w-full h-full rounded-sm border border-gray-300"
                    style={{ backgroundColor: appearanceHex || lastHexRef.current || 'transparent' }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex-1">
            <SpectralPlot 
              title="Spectral Plot"
              data={spectralData}
            />
          </div>

          <div className="w-1/6 flex-shrink-0 max-w-[260px]">
            <ColorInfoPanel 
              lab={labValues}
              ch={chValues}
            />
          </div>
        </>
      )}
      
      {!shouldShowVisuals && (
        <div className="w-full">
          <Card className="h-32">
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="text-lg font-medium mb-2">Import measurement data to see visual analysis</p>
                <p className="text-sm">Upload a CxF file or import spectral data to view appearance, spectral plot, and color information.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PrintConditionVisuals;