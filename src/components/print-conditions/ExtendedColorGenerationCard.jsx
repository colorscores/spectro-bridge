import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const ExtendedColorGenerationCard = ({ extendedColorGeneration, onExtendedColorGenerationChange }) => {
  const handleValueChange = (key, value) => {
    onExtendedColorGenerationChange(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const curveOptions = [
    { value: 'linear', label: 'Linear' },
    { value: 'smooth', label: 'Smooth' },
    { value: 'aggressive', label: 'Aggressive' },
    { value: 'custom', label: 'Custom' },
  ];

  const extendedInkOptions = [
    { value: 'orange', label: 'Orange' },
    { value: 'green', label: 'Green' },
    { value: 'violet', label: 'Violet' },
    { value: 'red', label: 'Red' },
    { value: 'blue', label: 'Blue' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Extended Color Generation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Ink curve</Label>
          <Select
            value={extendedColorGeneration.inkCurve}
            onValueChange={(value) => handleValueChange('inkCurve', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {curveOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Saturation start: {extendedColorGeneration.saturationStart}%</Label>
          <Slider
            value={[extendedColorGeneration.saturationStart]}
            onValueChange={(value) => handleValueChange('saturationStart', value[0])}
            max={100}
            min={0}
            step={1}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label>Hue width: {extendedColorGeneration.hueWidth}°</Label>
          <Slider
            value={[extendedColorGeneration.hueWidth]}
            onValueChange={(value) => handleValueChange('hueWidth', value[0])}
            max={360}
            min={0}
            step={1}
            className="w-full"
          />
        </div>

        <div className="space-y-3">
          <Label>Settings Mode</Label>
          <RadioGroup
            value={extendedColorGeneration.mode}
            onValueChange={(value) => handleValueChange('mode', value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all-extended" />
              <Label htmlFor="all-extended">All extended inks</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="individual" id="individual-extended" />
              <Label htmlFor="individual-extended">Individual settings</Label>
            </div>
          </RadioGroup>
        </div>

        {extendedColorGeneration.mode === 'individual' && (
          <div className="space-y-2">
            <Label>Extended ink channel</Label>
            <Select
              value={extendedColorGeneration.selectedInk}
              onValueChange={(value) => handleValueChange('selectedInk', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {extendedInkOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExtendedColorGenerationCard;