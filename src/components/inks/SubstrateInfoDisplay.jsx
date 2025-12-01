import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const SubstrateInfoDisplay = ({ substrate, substrateTypes, substrateMaterials, surfaceQualities }) => {
  if (!substrate) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No substrate information available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get related data
  const substrateType = substrateTypes?.find(t => t.id === substrate.type);
  const substrateMaterial = substrateMaterials?.find(m => m.id === substrate.material);
  const surfaceQuality = surfaceQualities?.find(sq => sq.id === substrate.surface_quality);


  const checkboxLabel = substrate.printing_side === 'Reverse' ? 'Use white ink backing' : 'Use white ink base coat';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Substrate Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Column 1 - Matches SubstrateInfoColumn1 */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Substrate Name</Label>
              <div className="text-base">{substrate.name}</div>
            </div>
            
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="text-base">{substrateType?.name || 'Not specified'}</div>
            </div>
            
            <div className="space-y-2">
              <Label>Material</Label>
              <div className="text-base">{substrateMaterial?.name || 'Not specified'}</div>
            </div>
            
            <div className="space-y-2">
              <Label>Printing Side</Label>
              <div className="text-base capitalize">{substrate.printing_side || 'Surface'}</div>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border rounded flex items-center justify-center">
                {substrate.use_white_ink && <div className="w-2 h-2 bg-primary rounded-sm"></div>}
              </div>
              <Label className="cursor-pointer">{checkboxLabel}</Label>
            </div>
          </div>
          
          {/* Column 2 - Matches SubstrateInfoColumn2 */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Surface quality</Label>
              <div className="text-base">{surfaceQuality?.name || 'Not specified'}</div>
            </div>
            
            <div className="space-y-2">
              <Label>Contrast</Label>
              <div className="text-base capitalize">{substrate.contrast || 'Not specified'}</div>
            </div>
            
            <div className="space-y-2">
              <Label>Ink Adhesion</Label>
              <div className="text-base">{substrate.ink_adhesion || 'Not specified'}</div>
            </div>
            
            <div className="space-y-2">
              <Label>Notes</Label>
              <div className="text-base whitespace-pre-wrap min-h-[128px] border rounded-md p-3 bg-gray-50">
                {substrate.notes || 'Enter any relevant notes...'}
              </div>
            </div>
          </div>
          
          {/* Column 3 - Matches SubstrateThumbnail */}
          <div className="relative aspect-square w-full h-full flex items-center justify-center bg-gray-100 border border-dashed rounded-lg p-4">
            {substrateType && substrateMaterial ? (
              <>
                {substrateMaterial?.thumbnail_url ? (
                  <img
                    src={substrateMaterial.thumbnail_url}
                    className="max-w-full max-h-full object-contain"
                    alt={`Thumbnail for ${substrateMaterial.name} ${substrateType.name}`}
                  />
                ) : (
                  <img
                    className="max-w-full max-h-full object-contain"
                    alt={`Clipart of ${substrateMaterial.name} ${substrateType.name}`}
                    src="https://images.unsplash.com/photo-1659981358302-ffa186b4a815"
                  />
                )}
              </>
            ) : (
              <span className="text-muted-foreground text-center">Select type and material to see a preview</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubstrateInfoDisplay;