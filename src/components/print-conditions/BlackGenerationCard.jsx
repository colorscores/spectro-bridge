import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const BlackGenerationCard = ({ blackGeneration, onBlackGenerationChange }) => {
  const handleValueChange = (key, value) => {
    onBlackGenerationChange(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const curveOptions = [
    { value: 'light', label: 'Light' },
    { value: 'medium', label: 'Medium' },
    { value: 'heavy', label: 'Heavy' },
    { value: 'maximum', label: 'Maximum' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Black Generation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Black start: {blackGeneration.blackStart}%</Label>
          <Slider
            value={[blackGeneration.blackStart]}
            onValueChange={(value) => handleValueChange('blackStart', value[0])}
            max={100}
            min={0}
            step={1}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label>Max Black: {blackGeneration.maxBlack}%</Label>
          <Slider
            value={[blackGeneration.maxBlack]}
            onValueChange={(value) => handleValueChange('maxBlack', value[0])}
            max={100}
            min={0}
            step={1}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label>Black curve</Label>
          <Select
            value={blackGeneration.blackCurve}
            onValueChange={(value) => handleValueChange('blackCurve', value)}
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
          <Label>Black width: {blackGeneration.blackWidth}%</Label>
          <Slider
            value={[blackGeneration.blackWidth]}
            onValueChange={(value) => handleValueChange('blackWidth', value[0])}
            max={100}
            min={0}
            step={1}
            className="w-full"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default BlackGenerationCard;