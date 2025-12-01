import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const CalibrationMethodCard = ({ 
  methods = {
    solids: false,
    overPrints: false,
    curves: false,
    substrate: false
  }, 
  allowInkDensityAdjustment = false,
  onMethodsChange,
  onInkDensityChange,
  canEdit = false 
}) => {
  const handleMethodChange = (method, checked) => {
    if (canEdit && onMethodsChange) {
      onMethodsChange({
        ...methods,
        [method]: checked
      });
    }
  };

  const handleInkDensityChange = (checked) => {
    if (canEdit && onInkDensityChange) {
      onInkDensityChange(checked);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calibration Method</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="solids"
              checked={methods.solids}
              onCheckedChange={(checked) => handleMethodChange('solids', checked)}
              disabled={!canEdit}
            />
            <Label htmlFor="solids">Solids</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="overprints"
              checked={methods.overPrints}
              onCheckedChange={(checked) => handleMethodChange('overPrints', checked)}
              disabled={!canEdit}
            />
            <Label htmlFor="overprints">OverPrints</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="curves"
              checked={methods.curves}
              onCheckedChange={(checked) => handleMethodChange('curves', checked)}
              disabled={!canEdit}
            />
            <Label htmlFor="curves">Curves</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="substrate"
              checked={methods.substrate}
              onCheckedChange={(checked) => handleMethodChange('substrate', checked)}
              disabled={!canEdit}
            />
            <Label htmlFor="substrate">Substrate</Label>
          </div>
        </div>
        
        <div className="pt-2 border-t border-border">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="ink-density"
              checked={allowInkDensityAdjustment}
              onCheckedChange={handleInkDensityChange}
              disabled={!canEdit}
            />
            <Label htmlFor="ink-density">Allow Ink density adjustment</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CalibrationMethodCard;