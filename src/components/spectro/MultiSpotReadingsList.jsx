import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const MultiSpotReadingsList = ({ readings, onRemove }) => {
  if (!readings || readings.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No readings yet. Take measurements to accumulate colors.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      <div className="text-sm font-medium text-muted-foreground">
        {readings.length} reading{readings.length !== 1 ? 's' : ''} collected
      </div>
      <div className="grid grid-cols-4 gap-2">
        {readings.map((reading, index) => (
          <div
            key={reading.id || index}
            className="relative group"
            title={`L: ${reading.lab?.L?.toFixed(1)} a: ${reading.lab?.a?.toFixed(1)} b: ${reading.lab?.b?.toFixed(1)}`}
          >
            <div
              className="w-12 h-12 rounded border border-border shadow-sm"
              style={{ backgroundColor: reading.hex || '#888' }}
            />
            <span className="absolute bottom-0 left-0 text-[10px] bg-background/80 px-1 rounded-tr">
              {index + 1}
            </span>
            {onRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-1 -right-1 h-5 w-5 opacity-0 group-hover:opacity-100 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => onRemove(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultiSpotReadingsList;
