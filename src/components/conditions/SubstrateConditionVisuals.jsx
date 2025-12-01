import React, { useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader as UICardHeader, CardTitle } from '@/components/ui/card';
import SpectralPlotContent from '@/components/conditions/SpectralPlotContent';
import ColorInfoPanel from '@/components/conditions/ColorInfoPanel';
import ConstructionPanel from '@/components/conditions/ConstructionPanel';
import CardHeader from '@/components/admin/my-company/CardHeader';
import { useSpectralCalculations } from '@/hooks/useSpectralCalculations';
import { labToChromaHue, labToHexD65 } from '@/lib/colorUtils';

const SubstrateConditionVisuals = ({ 
  condition, 
  parentSubstrate, 
  allSubstrates, 
  constructionDetails, 
  onConstructionDetailsChange, 
  onConditionChange, 
  canEdit, 
  setHasUnsavedChanges, 
  isNew, 
  lockWhiteUndercoat = false,
  measurementControls,
  isEditing,
  onEdit,
  onSave,
  onCancel
}) => {
  const spectralCalculations = useSpectralCalculations(
    condition?.spectral_data,
    measurementControls?.illuminant,
    measurementControls?.observer,
    measurementControls?.table
  );
  
  // Prefer dynamic spectral calculations (responsive to measurementControls), then stored Lab
  const labValues = spectralCalculations.lab || condition?.lab;
  const chValues = spectralCalculations.ch || (labValues ? labToChromaHue(labValues.L, labValues.a, labValues.b) : condition?.ch);
  
  // Update condition with calculated values when they're available
  useEffect(() => {
    if (!condition?.lab && spectralCalculations.lab && onConditionChange) {
      onConditionChange(prev => ({
        ...prev,
        lab: spectralCalculations.lab,
        ch: spectralCalculations.ch
      }));
    }
  }, [spectralCalculations, condition?.lab, onConditionChange]);

  // Compute appearance hex from current Lab (spectral or stored), fallback to condition.color_hex
  const appearanceHex = labValues ? labToHexD65(labValues.L, labValues.a, labValues.b) : condition?.color_hex;
  
  const lastHexRef = useRef(null);
  useEffect(() => {
    if (appearanceHex) lastHexRef.current = appearanceHex;
  }, [appearanceHex]);

  // Debug: track responsiveness to ColorSettingsBox changes
  console.debug('SubstrateConditionVisuals debug', {
    measurementControls,
    spectralLab: spectralCalculations?.lab,
    spectralCh: spectralCalculations?.ch,
    usedLab: labValues,
    usedCh: chValues,
    appearanceHex: appearanceHex || lastHexRef.current || condition?.color_hex,
  });

  return (
    <div className="space-y-6">
      {/* Construction panel - now manages its own card */}
      <ConstructionPanel
        construction={{ hex: appearanceHex || lastHexRef.current || condition.color_hex }}
        parentSubstrate={parentSubstrate}
        allSubstrates={allSubstrates}
        constructionDetails={constructionDetails}
        onConstructionDetailsChange={onConstructionDetailsChange}
        condition={condition}
        onConditionChange={onConditionChange}
        canEdit={canEdit}
        setHasUnsavedChanges={setHasUnsavedChanges}
        isNew={isNew}
        lockWhiteUndercoat={lockWhiteUndercoat}
        isEditing={isEditing}
        onEdit={onEdit}
        onSave={onSave}
        onCancel={onCancel}
      />
      
      {/* Appearance, Spectral Data, and Color Info cards - view only, no edit controls */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        <div className="w-1/5 flex-shrink-0">
          <Card className="h-full flex flex-col">
            <UICardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 h-16">
              <CardTitle className="text-lg">Appearance</CardTitle>
              <div className="w-40"></div>
            </UICardHeader>
            <CardContent className="flex-grow flex items-center justify-center p-4 -mt-4">
              <div className="w-full aspect-square bg-black rounded-md p-2.5 flex justify-center items-center">
                {(appearanceHex || lastHexRef.current) ? (
                  <div
                    className="w-full h-full rounded-sm border border-gray-300"
                    style={{ backgroundColor: appearanceHex || lastHexRef.current }}
                  />
                ) : (
                  <div className="w-full h-full rounded-sm border-2 border-dashed border-gray-400 flex items-center justify-center">
                    <span className="text-gray-400 text-xs text-center">No data<br/>Import to view</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex-1">
          <Card className="h-full">
            <SpectralPlotContent 
              data={condition?.spectral_data} 
              measurementControls={measurementControls}
            />
          </Card>
        </div>
        <div className="w-1/6 flex-shrink-0 max-w-[260px]">
          <ColorInfoPanel 
            lab={labValues}
            ch={chValues}
          />
        </div>
      </div>
    </div>
  );
};

export default SubstrateConditionVisuals;