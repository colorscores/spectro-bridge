
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useProfile } from '@/context/ProfileContext';

const RouteStep1ColorSelection = ({ matchRequest, selectedColorIds, onSelectionChange }) => {
  const { profile } = useProfile();
  const allColors = matchRequest?.colors || [];
  
  // Normalize color ID accessor to handle different data shapes
  const getColorId = (c) => c?.id ?? c?.color_id ?? c?.match_measurement?.color_id;
  
  // Filter out colors that are already routed using the is_routed field from database
  const availableColors = allColors.filter(color => {
    return !color.match_measurement?.is_routed && !color.is_routed;
  });
  
  const colors = availableColors;

  console.log('[RouteStep1] Render:', {
    colorsCount: colors.length,
    colorIdsSample: colors.slice(0, 3).map(c => ({ id: getColorId(c), name: c.name })),
    selectedCount: selectedColorIds.length,
    selectedIds: selectedColorIds
  });

  const handleColorToggle = (colorId, checked) => {
    console.log('[RouteStep1] handleColorToggle called:', { colorId, checked, type: typeof checked });
    if (checked) {
      const newSelection = [...selectedColorIds, colorId];
      console.log('[RouteStep1] Adding color:', { from: selectedColorIds, to: newSelection });
      onSelectionChange(newSelection);
    } else {
      const newSelection = selectedColorIds.filter(id => id !== colorId);
      console.log('[RouteStep1] Removing color:', { from: selectedColorIds, to: newSelection });
      onSelectionChange(newSelection);
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

  if (!availableColors || availableColors.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        {allColors.length === 0 
          ? 'No colors available to route. Please go back and select a match request with colors.'
          : 'All colors in this match request have already been routed.'
        }
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold">Select Colors to Route</h3>
        <p className="text-sm text-muted-foreground">
          Choose which colors you want to route to the ink supplier
        </p>
      </div>

      <div className="border rounded-md flex flex-col overflow-hidden max-h-[400px]">
        {/* Fixed table header */}
        <div className="bg-muted/50 px-3 py-2 flex-shrink-0 border-b">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={someSelected ? "indeterminate" : allSelected}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm font-medium">Select All ({selectedColorIds.length}/{colors.length})</span>
            </div>
          </div>
        </div>

        {/* Scrollable color list */}
        <div className="overflow-y-auto flex-1 p-3">
          <div className="space-y-2">
            {colors.map(color => {
              const colorId = getColorId(color);
              return (
                <div key={colorId} className="flex items-center gap-4 py-2">
                  <div className="flex-shrink-0">
                    <Checkbox
                      checked={selectedColorIds.includes(colorId)}
                      onCheckedChange={(checked) => handleColorToggle(colorId, checked)}
                    />
                  </div>
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: color.hex }}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm leading-tight break-words font-medium block">{color.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteStep1ColorSelection;
