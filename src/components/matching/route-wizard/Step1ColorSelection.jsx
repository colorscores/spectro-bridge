import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { getColorMatchStatusForOrg } from '@/lib/matchStatusUtils.jsx';
import { useProfile } from '@/context/ProfileContext';

const Step1ColorSelection = ({ matchRequest, selectedColorIds, onSelectionChange }) => {
  const { profile } = useProfile();
  const colors = matchRequest?.colors || [];
  
  // Normalize color ID accessor to handle different data shapes
  const getColorId = (c) => c?.id ?? c?.color_id ?? c?.match_measurement?.color_id;

  const handleColorToggle = (colorId, checked) => {
    if (checked) {
      onSelectionChange([...selectedColorIds, colorId]);
    } else {
      onSelectionChange(selectedColorIds.filter(id => id !== colorId));
    }
  };

  const handleSelectAll = () => {
    if (selectedColorIds.length === colors.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(Array.from(new Set(colors.map(getColorId).filter(Boolean))));
    }
  };

  const allSelected = selectedColorIds.length === colors.length;
  const someSelected = selectedColorIds.length > 0 && selectedColorIds.length < colors.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Select Colors to Route</h3>
          <p className="text-sm text-muted-foreground">
            Choose which colors you want to route to the ink supplier
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="select-all"
            checked={someSelected ? "indeterminate" : allSelected}
            onCheckedChange={handleSelectAll}
          />
          <label htmlFor="select-all" className="text-sm font-medium">
            Select All ({selectedColorIds.length}/{colors.length})
          </label>
        </div>
      </div>

      <div className="grid gap-3 max-h-96 overflow-y-auto">
        {colors.map((color) => {
          const colorId = getColorId(color);
          const isSelected = selectedColorIds.includes(colorId);
          const statusInfo = getColorMatchStatusForOrg(
            color.match_measurement?.match_measurement_state || 'empty',
            matchRequest, 
            profile?.organization_id,
            color.match_measurement
          );

          return (
            <Card key={colorId} className={`cursor-pointer transition-colors ${isSelected ? 'ring-2 ring-primary' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => handleColorToggle(colorId, checked)}
                  />
                  
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="flex">
                      <div 
                        className="w-8 h-8 rounded-l border" 
                        style={{ backgroundColor: color.hex }}
                      />
                      <div 
                        className="w-8 h-8 rounded-r border border-l-0" 
                        style={{ backgroundColor: color.matched_hex || '#E5E7EB' }}
                      />
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{color.name}</h4>
                      <p className="text-xs text-muted-foreground">{color.hex}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedColorIds.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Please select at least one color to continue
        </p>
      )}
    </div>
  );
};

export default Step1ColorSelection;