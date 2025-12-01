import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import SeparationsOptionsCard from './SeparationsOptionsCard';
import BlackGenerationCard from './BlackGenerationCard';
import ExtendedColorGenerationCard from './ExtendedColorGenerationCard';
import SpotColorSeparationCard from './SpotColorSeparationCard';

const SeparationsFlyout = ({ separation, onClose }) => {
  const [options, setOptions] = useState({
    keepCMYKImages: true,
    preserveSpotColors: false,
    minimizeColorChannels: false,
    deThreshold: 2.0,
    adaptToPaperGray: 50,
    expandImageGamut: 25,
    blackPointCompensation: true,
  });

  const [blackGeneration, setBlackGeneration] = useState({
    blackStart: 20,
    maxBlack: 95,
    blackCurve: 'medium',
    blackWidth: 100,
  });

  const [extendedColorGeneration, setExtendedColorGeneration] = useState({
    inkCurve: 'linear',
    saturationStart: 30,
    hueWidth: 60,
    mode: 'all', // 'all' or 'individual'
    selectedInk: 'orange',
  });

  // Check if this separation has extended inks
  const hasExtendedInks = separation.extendedInks;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>{separation.name} - Configuration</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6 overflow-y-auto">
        <SeparationsOptionsCard
          options={options}
          onOptionsChange={setOptions}
        />
        
        <BlackGenerationCard
          blackGeneration={blackGeneration}
          onBlackGenerationChange={setBlackGeneration}
        />
        
        {options.spotColorHandling === 'separate' && (
          <SpotColorSeparationCard 
            options={options}
            onOptionsChange={setOptions}
          />
        )}
        
        {hasExtendedInks && (
          <ExtendedColorGenerationCard
            extendedColorGeneration={extendedColorGeneration}
            onExtendedColorGenerationChange={setExtendedColorGeneration}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default SeparationsFlyout;