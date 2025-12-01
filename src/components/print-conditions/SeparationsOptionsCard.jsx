import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const SeparationsOptionsCard = ({ options, onOptionsChange }) => {
  const handleOptionChange = (key, value) => {
    onOptionsChange(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Options</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="keepCMYKImages"
            checked={options.keepCMYKImages}
            onCheckedChange={(checked) => handleOptionChange('keepCMYKImages', checked)}
          />
          <Label htmlFor="keepCMYKImages">Keep CMYK images as CMYK</Label>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Spot Colors</Label>
          <RadioGroup
            value={options.spotColorHandling || 'map'}
            onValueChange={(value) => handleOptionChange('spotColorHandling', value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="map" id="map-spot" />
              <Label htmlFor="map-spot">Map spot colors to spot inks</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="separate" id="separate-spot" />
              <Label htmlFor="separate-spot">Separate Spot colors</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="minimizeColorChannels"
              checked={options.minimizeColorChannels}
              onCheckedChange={(checked) => handleOptionChange('minimizeColorChannels', checked)}
            />
            <Label htmlFor="minimizeColorChannels">Minimize Color Channels</Label>
          </div>
          {options.minimizeColorChannels && (
            <div className="ml-6 flex items-center space-x-2">
              <Label htmlFor="deThreshold" className="text-sm">dE threshold:</Label>
              <Input
                id="deThreshold"
                type="number"
                value={options.deThreshold}
                onChange={(e) => handleOptionChange('deThreshold', parseFloat(e.target.value) || 0)}
                className="w-20"
                step="0.1"
                min="0"
                max="10"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Adapt-to-Paper Gray: {options.adaptToPaperGray}%</Label>
          <Slider
            value={[options.adaptToPaperGray]}
            onValueChange={(value) => handleOptionChange('adaptToPaperGray', value[0])}
            max={100}
            min={0}
            step={1}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label>Expand image gamut: {options.expandImageGamut}%</Label>
          <Slider
            value={[options.expandImageGamut]}
            onValueChange={(value) => handleOptionChange('expandImageGamut', value[0])}
            max={100}
            min={0}
            step={1}
            className="w-full"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="blackPointCompensation"
            checked={options.blackPointCompensation}
            onCheckedChange={(checked) => handleOptionChange('blackPointCompensation', checked)}
          />
          <Label htmlFor="blackPointCompensation">Black point compensation</Label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div className="space-y-2">
            <Label htmlFor="firstPrintingDot" className="text-sm font-medium">
              First Printing Dot
            </Label>
            <Input
              id="firstPrintingDot"
              type="number"
              min="0"
              max="100"
              value={options.firstPrintingDot || 0}
              onChange={(e) => handleOptionChange('firstPrintingDot', parseInt(e.target.value) || 0)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastPrintingDot" className="text-sm font-medium">
              Last Printing Dot
            </Label>
            <Input
              id="lastPrintingDot"
              type="number"
              min="0"
              max="100"
              value={options.lastPrintingDot || 100}
              onChange={(e) => handleOptionChange('lastPrintingDot', parseInt(e.target.value) || 0)}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="hardEdge"
            checked={options.hardEdge || false}
            onCheckedChange={(checked) => handleOptionChange('hardEdge', checked)}
          />
          <Label htmlFor="hardEdge">Hard edge</Label>
        </div>
      </CardContent>
    </Card>
  );
};

export default SeparationsOptionsCard;