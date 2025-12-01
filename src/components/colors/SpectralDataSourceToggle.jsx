import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const SpectralDataSourceToggle = ({ 
  availableDataSources, 
  activeDataMode, 
  onDataModeChange,
  className = ""
}) => {
  // Don't render if only one source is available
  if (availableDataSources.length <= 1) {
    return null;
  }

  return (
    <Card className={`${className}`}>
      <CardContent className="p-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            Data Source
          </Label>
          <RadioGroup 
            value={activeDataMode} 
            onValueChange={onDataModeChange}
            className="space-y-1"
          >
            {availableDataSources.map((source) => (
              <div key={source.id} className="flex items-center space-x-2">
                <RadioGroupItem 
                  value={source.id} 
                  id={source.id}
                  disabled={!source.available}
                />
                <Label 
                  htmlFor={source.id} 
                  className={`text-sm ${source.available ? 'text-gray-900' : 'text-gray-400'}`}
                >
                  {source.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
};

export default SpectralDataSourceToggle;