import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CharacterizationViewCard from './CharacterizationViewCard';
import CharacterizationToolsCard from './CharacterizationToolsCard';

const PrinterCharacterizationTab = ({ condition }) => {
  const [selectedInks, setSelectedInks] = useState(['Yellow']);
  const [toolMode, setToolMode] = useState('Curves');
  const [curves, setCurves] = useState({
    Yellow: 'ISO A',
    Magenta: 'ISO A', 
    Cyan: 'ISO A',
    Black: 'ISO A'
  });
  const [cornerValues, setCornerValues] = useState({
    // Primary colors
    Yellow: { L: 89.2, a: -5.1, b: 93.4 },
    Magenta: { L: 54.7, a: 76.9, b: -3.1 },
    Cyan: { L: 56.3, a: -37.2, b: -50.1 },
    Black: { L: 16.1, a: 0.9, b: -0.4 },
    // Secondary colors
    Red: { L: 47.8, a: 68.2, b: 48.1 },
    Green: { L: 51.2, a: -67.8, b: 48.9 },
    Blue: { L: 25.4, a: 19.2, b: -46.3 },
    // 3-color grays
    '3C_25': { L: 75.2, a: 0.1, b: -1.2 },
    '3C_50': { L: 50.8, a: 0.3, b: -2.1 },
    '3C_75': { L: 25.1, a: 0.2, b: -1.8 }
  });

  const handleInkSelection = (inks) => {
    setSelectedInks(inks);
  };

  const handleCurveChange = (ink, curveType) => {
    setCurves(prev => ({
      ...prev,
      [ink]: curveType
    }));
  };

  const handleCornerValueChange = (patch, lab) => {
    setCornerValues(prev => ({
      ...prev,
      [patch]: lab
    }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
      <CharacterizationViewCard 
        selectedInks={selectedInks}
        curves={curves}
        cornerValues={cornerValues}
      />
      
      <CharacterizationToolsCard 
        toolMode={toolMode}
        onToolModeChange={setToolMode}
        selectedInks={selectedInks}
        onInkSelection={handleInkSelection}
        curves={curves}
        onCurveChange={handleCurveChange}
        cornerValues={cornerValues}
        onCornerValueChange={handleCornerValueChange}
      />
    </div>
  );
};

export default PrinterCharacterizationTab;