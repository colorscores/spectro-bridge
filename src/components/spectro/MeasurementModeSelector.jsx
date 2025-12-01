import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Target, LayoutList, Layers } from 'lucide-react';

const MEASUREMENT_MODES = [
  {
    value: 'spot',
    label: 'Spot',
    description: 'Single measurement',
    icon: Target,
  },
  {
    value: 'multi-spot',
    label: 'Multi-Spot',
    description: 'Accumulate readings',
    icon: Layers,
  },
  // Strip mode will be added later when chartread is implemented
  // {
  //   value: 'strip',
  //   label: 'Strip',
  //   description: 'Scan patch row',
  //   icon: LayoutList,
  // },
];

const MeasurementModeSelector = ({ value, onChange, disabled }) => {
  const selectedMode = MEASUREMENT_MODES.find(m => m.value === value) || MEASUREMENT_MODES[0];

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Measurement Mode</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue>
            <div className="flex items-center gap-2">
              <selectedMode.icon className="h-4 w-4" />
              <span>{selectedMode.label}</span>
              <span className="text-muted-foreground text-xs">
                ({selectedMode.description})
              </span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MEASUREMENT_MODES.map((mode) => (
            <SelectItem key={mode.value} value={mode.value}>
              <div className="flex items-center gap-2">
                <mode.icon className="h-4 w-4" />
                <span>{mode.label}</span>
                <span className="text-muted-foreground text-xs ml-1">
                  - {mode.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default MeasurementModeSelector;
