
import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import CompatibilityIcon from './CompatibilityIcon';
import { validateColorQualitySetCompatibility } from '@/lib/colorQualitySetCompatibility';

const Step1ColorDetails = ({ formData, setFormData, selectedColors, qualitySets, colorsWithMeasurements = {}, inkConditionsData = {} }) => {
  const handleQualitySetModeChange = (value) => {
    setFormData(prev => ({ ...prev, qualitySetMode: value }));
  };

  const handleAllColorsQualitySetChange = (value) => {
    setFormData(prev => ({ ...prev, allColorsQualitySet: value }));
  };

  const handleIndividualQualitySetChange = (colorId, value) => {
    setFormData(prev => ({
      ...prev,
      individualQualitySets: {
        ...prev.individualQualitySets,
        [colorId]: value,
      },
    }));
  };

  // Get compatibility status for a color with the selected quality set
  const getCompatibilityStatus = (color, qualitySetId) => {
    if (!qualitySetId) return null;
    
    const qualitySet = qualitySets.find(qs => qs.id === qualitySetId);
    const colorMeasurements = colorsWithMeasurements[color.id] || [];
    const inkConditionData = inkConditionsData[color.id];
    
    if (!qualitySet) return null;
    
    return validateColorQualitySetCompatibility(color, colorMeasurements, qualitySet, inkConditionData);
  };

  if (!selectedColors || selectedColors.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No colors selected. Please go back and select colors to request a match.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RadioGroup value={formData.qualitySetMode} onValueChange={handleQualitySetModeChange}>
        <div className="grid grid-cols-[auto_1fr_200px] items-center gap-4 pl-3">
          <RadioGroupItem value="all" id="all" />
          <Label htmlFor="all">set quality set for all colors</Label>
          <Select disabled={formData.qualitySetMode !== 'all'} value={formData.allColorsQualitySet} onValueChange={handleAllColorsQualitySetChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select quality set" />
            </SelectTrigger>
            <SelectContent className="z-50">
              {qualitySets.map(qs => (
                <SelectItem key={qs.id} value={qs.id} className="pl-2 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer transition-colors">
                  {qs.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-[auto_1fr_200px] items-center gap-4 pl-3">
          <RadioGroupItem value="separate" id="separate" />
          <Label htmlFor="separate">set quality set for each color seperately</Label>
          <div></div>
        </div>
      </RadioGroup>
      <hr/>
      <div className="space-y-2">
        {selectedColors.map(color => {
          // Get the quality set ID for this color based on mode
          const qualitySetId = formData.qualitySetMode === 'all' 
            ? formData.allColorsQualitySet 
            : formData.individualQualitySets[color.id];
          
          const compatibility = getCompatibilityStatus(color, qualitySetId);
          
          return (
            <div key={color.id} className="grid grid-cols-[32px_1fr_200px_24px] items-center gap-4 py-2 pl-3">
              <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: color.hex }}></div>
              <div className="min-w-0">
                <span className="text-sm leading-tight break-words">{color.name}</span>
              </div>
              <Select 
                disabled={formData.qualitySetMode !== 'separate'} 
                value={formData.individualQualitySets[color.id] || ''}
                onValueChange={(value) => handleIndividualQualitySetChange(color.id, value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select quality set" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {qualitySets.map(qs => (
                    <SelectItem key={qs.id} value={qs.id} className="pl-2 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer transition-colors">
                      {qs.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <CompatibilityIcon 
                status={compatibility?.status} 
                message={compatibility?.message} 
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Step1ColorDetails;
