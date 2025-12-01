import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import SpectralPlotContent from '@/components/conditions/SpectralPlotContent';
import ColorInfoPanel from '@/components/conditions/ColorInfoPanel';
import ConstructionPanel from '@/components/conditions/ConstructionPanel';

const SubstrateConditionDisplay = ({ 
  substrateCondition, 
  parentSubstrate, 
  allSubstrates, 
  constructionDetails, 
  packTypes 
}) => {
  if (!substrateCondition) {
    return (
      <div className="space-y-6">
        {/* Basic Information Card - matches SubstrateConditionInfo */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-900">
                  Substrate Condition Name
                </Label>
                <div className="text-base text-muted-foreground">No substrate condition available</div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-900">
                  Pack Type
                </Label>
                <div className="text-base text-muted-foreground">Not specified</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visual Data Card */}
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="text-center text-muted-foreground">
              No substrate condition information available
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get pack type name
  const packType = packTypes?.find(pt => pt.name === substrateCondition.pack_type);

  return (
    <div className="space-y-6">
      {/* Basic Information Card - matches SubstrateConditionInfo exactly */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-900">
                Substrate Condition Name
              </Label>
              <div className="text-base">{substrateCondition.name}</div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-900">
                Pack Type
              </Label>
              <div className="text-base">{packType?.name || substrateCondition.pack_type || 'Not specified'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Data Card - matches SubstrateConditionVisuals exactly */}
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            <div className="flex-grow-[4] basis-0">
              <Card className="h-full flex flex-col">
                <CardHeader><CardTitle className="text-lg">Appearance</CardTitle></CardHeader>
                <CardContent className="flex-grow flex items-center justify-center p-4">
                  <div className="w-full aspect-square bg-black rounded-md p-2.5 flex justify-center items-center">
                    <div
                      className="w-full h-full rounded-sm"
                      style={{ backgroundColor: substrateCondition.color_hex || '#ffffff' }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="flex-grow-[12] basis-0">
              <Card className="h-full">
                <SpectralPlotContent data={substrateCondition.spectral_data} />
              </Card>
            </div>
            <div className="flex-grow-[3] basis-0">
              <ColorInfoPanel lab={substrateCondition.lab} ch={substrateCondition.ch} />
            </div>
          </div>
          
          {/* Construction Panel */}
          <ConstructionPanel
            construction={{ hex: substrateCondition.color_hex }}
            parentSubstrate={parentSubstrate}
            allSubstrates={allSubstrates}
            constructionDetails={constructionDetails}
            condition={substrateCondition}
            canEdit={false}
            isNew={false}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default SubstrateConditionDisplay;