import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const SpotColorSeparationCard = ({ options, onOptionsChange }) => {
  const handleOptionChange = (key, value) => {
    onOptionsChange(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spot Color Separation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Label className="text-sm font-medium">Channel Configuration</Label>
          <RadioGroup
            value={options.spotChannelMode || 'dynamic'}
            onValueChange={(value) => handleOptionChange('spotChannelMode', value)}
          >
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dynamic" id="dynamic-channels" />
                <Label htmlFor="dynamic-channels">Dynamic minimum channels</Label>
              </div>
              {options.spotChannelMode === 'dynamic' && (
                <div className="ml-6 flex items-center space-x-2">
                  <Label htmlFor="spotDeThreshold" className="text-sm">dE threshold:</Label>
                  <Input
                    id="spotDeThreshold"
                    type="number"
                    value={options.spotDeThreshold || 1.0}
                    onChange={(e) => handleOptionChange('spotDeThreshold', parseFloat(e.target.value) || 0)}
                    className="w-20"
                    step="0.1"
                    min="0"
                    max="10"
                  />
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="max" id="max-channels" />
                <Label htmlFor="max-channels">Max number of channels</Label>
              </div>
              {options.spotChannelMode === 'max' && (
                <div className="ml-6 flex items-center space-x-2">
                  <Label htmlFor="maxChannels" className="text-sm">Channels:</Label>
                  <Input
                    id="maxChannels"
                    type="number"
                    value={options.maxChannels || 6}
                    onChange={(e) => handleOptionChange('maxChannels', parseInt(e.target.value) || 1)}
                    className="w-20"
                    min="1"
                    max="12"
                  />
                </div>
              )}
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
};

export default SpotColorSeparationCard;