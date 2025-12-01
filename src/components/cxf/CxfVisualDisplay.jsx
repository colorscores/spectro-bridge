import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import UnifiedCxfTable from '@/components/colors/UnifiedCxfTable';

const CxfVisualDisplay = ({ 
  cxfColors = [], 
  processedColors = [], 
  title = "Color Preview",
  showToggle = false,
  mode = 'color',
  selectedIds = new Set(),
  onSelectItem = () => {},
  onSelectAll = () => {},
  allSelected = false,
  isIndeterminate = false,
  orgDefaults = {}
}) => {
  const [showOriginal, setShowOriginal] = useState(false);

  // Use processed colors by default, fall back to original if not available
  const displayColors = showOriginal ? cxfColors : (processedColors.length > 0 ? processedColors : cxfColors);

  if (!displayColors.length) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No colors to display
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          {showToggle && processedColors.length > 0 && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-original"
                checked={showOriginal}
                onCheckedChange={setShowOriginal}
              />
              <label 
                htmlFor="show-original" 
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Show Imported Colors
              </label>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="max-h-96 overflow-y-auto">
          <UnifiedCxfTable
            mode={mode}
            data={displayColors}
            selectedIds={selectedIds}
            onSelectItem={onSelectItem}
            onSelectAll={onSelectAll}
            allSelected={allSelected}
            isIndeterminate={isIndeterminate}
            defaultMeasurementMode=""
            orgDefaults={orgDefaults}
          />
        </div>

        {/* Summary info */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>{displayColors.length} color{displayColors.length !== 1 ? 's' : ''}</span>
            {showToggle && (
              <span>
                {showOriginal ? 'Original CxF colors' : 'Adapted with org defaults'}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CxfVisualDisplay;