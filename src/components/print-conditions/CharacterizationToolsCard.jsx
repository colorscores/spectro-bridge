import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import CurveChart from './CurveChart';

const CharacterizationToolsCard = ({ 
  toolMode, 
  onToolModeChange, 
  selectedInks, 
  onInkSelection, 
  curves, 
  onCurveChange,
  cornerValues,
  onCornerValueChange 
}) => {
  const [modifyMode, setModifyMode] = useState(false);

  const inkOptions = ['Yellow', 'Magenta', 'Cyan', 'Black'];
  
  const getCurveOptions = () => {
    const baseOptions = ['ISO A', 'ISO B', 'ISO C', 'ISO D'];
    
    // If all CMYK are selected, add G7 options
    if (selectedInks.length === 4 && 
        inkOptions.every(ink => selectedInks.includes(ink))) {
      return [...baseOptions, 'G7', 'G7+'];
    }
    
    // If only one ink selected, add custom option
    if (selectedInks.length === 1) {
      return [...baseOptions, 'Custom'];
    }
    
    return baseOptions;
  };

  const calculateDeltaE = (original, modified) => {
    const deltaL = modified.L - original.L;
    const deltaA = modified.a - original.a;
    const deltaB = modified.b - original.b;
    return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB).toFixed(2);
  };

  const renderCurvesTab = () => (
    <div className="space-y-6">
      {/* Ink Selection */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Select Inks</Label>
        <div className="grid grid-cols-2 gap-2">
          {inkOptions.map(ink => (
            <div key={ink} className="flex items-center space-x-2">
              <Checkbox
                id={ink}
                checked={selectedInks.includes(ink)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onInkSelection([...selectedInks, ink]);
                  } else {
                    onInkSelection(selectedInks.filter(i => i !== ink));
                  }
                }}
              />
              <Label htmlFor={ink} className="text-sm">{ink}</Label>
            </div>
          ))}
        </div>
      </div>

      {/* Curve Chart */}
      {selectedInks.length > 0 && (
        <div>
          <CurveChart selectedInks={selectedInks} curves={curves} />
        </div>
      )}

      {/* Modify Curves Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Modify Selected Curves</Label>
          <Button
            variant={modifyMode ? "secondary" : "outline"}
            size="sm"
            onClick={() => setModifyMode(!modifyMode)}
          >
            {modifyMode ? 'Done' : 'Modify Curves'}
          </Button>
        </div>

        {modifyMode && selectedInks.length > 0 && (
          <div className="space-y-3">
            {selectedInks.map(ink => (
              <div key={ink} className="flex items-center gap-3">
                <span className="text-sm w-16">{ink}:</span>
                <Select
                  value={curves[ink]}
                  onValueChange={(value) => onCurveChange(ink, value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getCurveOptions().map(option => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderCornersTab = () => {
    const patchGroups = {
      'Primaries': ['Yellow', 'Magenta', 'Cyan', 'Black'],
      'Secondaries': ['Red', 'Green', 'Blue'],
      'Grays': ['3C_25', '3C_50', '3C_75']
    };

    const originalValues = {
      Yellow: { L: 89.2, a: -5.1, b: 93.4 },
      Magenta: { L: 54.7, a: 76.9, b: -3.1 },
      Cyan: { L: 56.3, a: -37.2, b: -50.1 },
      Black: { L: 16.1, a: 0.9, b: -0.4 },
      Red: { L: 47.8, a: 68.2, b: 48.1 },
      Green: { L: 51.2, a: -67.8, b: 48.9 },
      Blue: { L: 25.4, a: 19.2, b: -46.3 },
      '3C_25': { L: 75.2, a: 0.1, b: -1.2 },
      '3C_50': { L: 50.8, a: 0.3, b: -2.1 },
      '3C_75': { L: 25.1, a: 0.2, b: -1.8 }
    };

    const formatPatchName = (name) => {
      if (name.startsWith('3C_')) {
        return `3C ${name.split('_')[1]}%`;
      }
      return name;
    };

    return (
      <div className="space-y-6">
        {Object.entries(patchGroups).map(([groupName, patches]) => (
          <div key={groupName}>
            <h4 className="text-sm font-medium mb-3">{groupName}</h4>
            <div className="space-y-2">
              {patches.map(patch => (
                <div key={patch} className="grid grid-cols-5 gap-2 items-center py-2 border-b border-gray-100">
                  <span className="text-sm">{formatPatchName(patch)}</span>
                  
                  {/* L */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">L</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={cornerValues[patch]?.L || originalValues[patch].L}
                      onChange={(e) => onCornerValueChange(patch, {
                        ...cornerValues[patch],
                        L: parseFloat(e.target.value) || 0
                      })}
                      className="h-7 text-xs"
                    />
                  </div>
                  
                  {/* a */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">a</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={cornerValues[patch]?.a || originalValues[patch].a}
                      onChange={(e) => onCornerValueChange(patch, {
                        ...cornerValues[patch],
                        a: parseFloat(e.target.value) || 0
                      })}
                      className="h-7 text-xs"
                    />
                  </div>
                  
                  {/* b */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">b</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={cornerValues[patch]?.b || originalValues[patch].b}
                      onChange={(e) => onCornerValueChange(patch, {
                        ...cornerValues[patch],
                        b: parseFloat(e.target.value) || 0
                      })}
                      className="h-7 text-xs"
                    />
                  </div>
                  
                  {/* Delta E */}
                  <div className="text-center">
                    <Label className="text-xs text-muted-foreground block">dE</Label>
                    <span className="text-xs font-mono">
                      {calculateDeltaE(originalValues[patch], cornerValues[patch] || originalValues[patch])}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tools</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={toolMode} onValueChange={onToolModeChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="Curves">Curves</TabsTrigger>
            <TabsTrigger value="Corners">Corners</TabsTrigger>
          </TabsList>
          
          <TabsContent value="Curves">
            {renderCurvesTab()}
          </TabsContent>
          
          <TabsContent value="Corners">
            {renderCornersTab()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CharacterizationToolsCard;