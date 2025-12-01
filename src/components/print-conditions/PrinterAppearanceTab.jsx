import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, Upload } from 'lucide-react';

const PrinterAppearanceTab = ({ condition, onConditionChange, canEdit = false, selectedInkBooks = [] }) => {
  const [appearanceSettings, setAppearanceSettings] = useState({
    dimToFitMedia: false,
    simulatePrintTexture: false,
    simulateMissingDots: false,
    useWhiteUndercoat: false,
    textureType: 'useNoise', // 'useNoise' or 'paperStructure'
    textureIntensity: 50,
    texturePattern: 'fine',
    missingDotsPercentage: 5,
    missingDotsPattern: 'random',
    coloredDotsEnabled: false,
    coloredDotsPercentage: 0,
    hasAdditionalInks: false, // This would be set based on ink setup
    whiteUndercoat: {
      opacity: 100,
      gradations: 'ISO A'
    },
    paperStructure: {
      file: null,
      fileName: '',
      simulationIntensity: 50,
      rotatePattern90: false,
      increaseContrastForCardboard: false
    },
    noiseSettings: {
      cyan: { intensity: 2.0, frequency: 18.0 },
      magenta: { intensity: 2.0, frequency: 18.0 },
      yellow: { intensity: 2.0, frequency: 18.0 },
      black: { intensity: 2.0, frequency: 18.0 }
    },
    inkMissingDots: {
      'Cyan': { amount: 0, reduceAtIndex: 0, stopAtIndex: 0, screenRuling: 150 },
      'Magenta': { amount: 0, reduceAtIndex: 0, stopAtIndex: 0, screenRuling: 150 },
      'Yellow': { amount: 0, reduceAtIndex: 0, stopAtIndex: 0, screenRuling: 150 },
      'Black': { amount: 0, reduceAtIndex: 0, stopAtIndex: 0, screenRuling: 150 },
      'Additional Inks': { amount: 0, reduceAtIndex: 0, stopAtIndex: 0, screenRuling: 150 }
    }
  });

  const updateSetting = (key, value) => {
    setAppearanceSettings(prev => {
      const next = { ...prev, [key]: value };
      onConditionChange?.((pc) => ({ ...pc, appearance_settings: next }));
      return next;
    });
  };

  const updateNoiseSetting = (color, property, value) => {
    setAppearanceSettings(prev => {
      const next = {
        ...prev,
        noiseSettings: {
          ...prev.noiseSettings,
          [color]: {
            ...prev.noiseSettings[color],
            [property]: value
          }
        }
      };
      onConditionChange?.((pc) => ({ ...pc, appearance_settings: next }));
      return next;
    });
  };

  const incrementValue = (color, property, step = 0.1) => {
    const currentValue = appearanceSettings.noiseSettings[color][property];
    const newValue = Math.round((currentValue + step) * 10) / 10;
    updateNoiseSetting(color, property, newValue);
  };

  const decrementValue = (color, property, step = 0.1) => {
    const currentValue = appearanceSettings.noiseSettings[color][property];
    const newValue = Math.max(0, Math.round((currentValue - step) * 10) / 10);
    updateNoiseSetting(color, property, newValue);
  };

  const updatePaperStructureSetting = (property, value) => {
    setAppearanceSettings(prev => {
      const next = {
        ...prev,
        paperStructure: {
          ...prev.paperStructure,
          [property]: value
        }
      };
      onConditionChange?.((pc) => ({ ...pc, appearance_settings: next }));
      return next;
    });
  };

  const updateInkMissingDotsSetting = (inkName, property, value) => {
    setAppearanceSettings(prev => {
      const next = {
        ...prev,
        inkMissingDots: {
          ...prev.inkMissingDots,
          [inkName]: {
            ...prev.inkMissingDots[inkName],
            [property]: value
          }
        }
      };
      onConditionChange?.((pc) => ({ ...pc, appearance_settings: next }));
      return next;
    });
  };

  const updateWhiteUndercoatSetting = (property, value) => {
    setAppearanceSettings(prev => {
      const next = {
        ...prev,
        whiteUndercoat: {
          ...prev.whiteUndercoat,
          [property]: value
        }
      };
      onConditionChange?.((pc) => ({ ...pc, appearance_settings: next }));
      return next;
    });
  };

  // Sync incoming condition.appearance_settings into local state
  useEffect(() => {
    if (condition?.appearance_settings) {
      setAppearanceSettings(prev => ({ ...prev, ...condition.appearance_settings }));
    }
  }, [condition?.appearance_settings]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      updatePaperStructureSetting('file', file);
      updatePaperStructureSetting('fileName', file.name);
    }
  };

  return (
    <div className="space-y-6">
          {/* General Settings Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-8">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dimToFitMedia"
                    checked={appearanceSettings.dimToFitMedia}
                    onCheckedChange={(checked) => updateSetting('dimToFitMedia', checked)}
                    disabled={!canEdit}
                  />
                  <Label htmlFor="dimToFitMedia" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Dim to fit media
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="simulatePrintTexture"
                    checked={appearanceSettings.simulatePrintTexture}
                    onCheckedChange={(checked) => updateSetting('simulatePrintTexture', checked)}
                    disabled={!canEdit}
                  />
                  <Label htmlFor="simulatePrintTexture" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Simulate print texture
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="simulateMissingDots"
                    checked={appearanceSettings.simulateMissingDots}
                    onCheckedChange={(checked) => updateSetting('simulateMissingDots', checked)}
                    disabled={!canEdit}
                  />
                  <Label htmlFor="simulateMissingDots" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Simulate missing dots
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useWhiteUndercoat"
                    checked={appearanceSettings.useWhiteUndercoat}
                    onCheckedChange={(checked) => updateSetting('useWhiteUndercoat', checked)}
                    disabled={!canEdit}
                  />
                  <Label htmlFor="useWhiteUndercoat" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Use white undercoat
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>


      {/* Print Texture Settings Card - Only shown when enabled */}
      {appearanceSettings.simulatePrintTexture && (
        <Card>
          <CardHeader>
            <CardTitle>Print Texture Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="text-sm font-medium">Texture Type</Label>
              <RadioGroup
                value={appearanceSettings.textureType}
                onValueChange={(value) => updateSetting('textureType', value)}
                disabled={!canEdit}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="useNoise" id="useNoise" />
                  <Label htmlFor="useNoise" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Use Noise
                  </Label>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="paperStructure" id="paperStructure" />
                    <Label htmlFor="paperStructure" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Simulate paper structure
                    </Label>
                  </div>
                  <div className="ml-4">
                    <input
                      type="file"
                      id="paperStructureFile"
                      accept=".jpg,.jpeg,.png,.tiff,.bmp"
                      onChange={handleFileUpload}
                      disabled={!canEdit || appearanceSettings.textureType !== 'paperStructure'}
                      className="hidden"
                    />
                    <Button
                      onClick={() => document.getElementById('paperStructureFile').click()}
                      variant="outline"
                      size="sm"
                      disabled={!canEdit || appearanceSettings.textureType !== 'paperStructure'}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Import Structure File
                    </Button>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Noise Controls - Only shown when "Use Noise" is selected */}
            {appearanceSettings.textureType === 'useNoise' && (
              <div className="space-y-4">
                <Separator />
                <div className="grid grid-cols-5 gap-4">
                  {/* Header Row */}
                  <div></div>
                  <div className="text-center text-sm font-medium text-muted-foreground">Cyan</div>
                  <div className="text-center text-sm font-medium text-muted-foreground">Magenta</div>
                  <div className="text-center text-sm font-medium text-muted-foreground">Yellow</div>
                  <div className="text-center text-sm font-medium text-muted-foreground">Black</div>

                  {/* Noise Intensity Row */}
                  <div className="text-sm font-medium text-muted-foreground">Intensity</div>
                  {['cyan', 'magenta', 'yellow', 'black'].map(color => (
                    <div key={`${color}-intensity`} className="relative">
                      <Input
                        type="number"
                        value={appearanceSettings.noiseSettings[color].intensity || 0}
                        onChange={(e) => updateNoiseSetting(color, 'intensity', parseFloat(e.target.value) || 0)}
                        disabled={!canEdit}
                        step="0.1"
                        min="0"
                        placeholder="0"
                        className="text-center pr-6"
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-gray-100"
                          onClick={() => incrementValue(color, 'intensity', 0.1)}
                          disabled={!canEdit}
                        >
                          <ChevronUp className="h-2 w-2" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Noise Frequency Row */}
                  <div className="text-sm font-medium text-muted-foreground">Frequency</div>
                  {['cyan', 'magenta', 'yellow', 'black'].map(color => (
                    <div key={`${color}-frequency`} className="relative">
                      <Input
                        type="number"
                        value={appearanceSettings.noiseSettings[color].frequency || 0}
                        onChange={(e) => updateNoiseSetting(color, 'frequency', parseFloat(e.target.value) || 0)}
                        disabled={!canEdit}
                        step="0.1"
                        min="0"
                        placeholder="0"
                        className="text-center pr-6"
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-gray-100"
                          onClick={() => incrementValue(color, 'frequency', 0.1)}
                          disabled={!canEdit}
                        >
                          <ChevronUp className="h-2 w-2" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Paper Structure Controls - Only shown when "Simulate paper structure" is selected */}
            {appearanceSettings.textureType === 'paperStructure' && (
              <div className="space-y-4">
                <Separator />
                
                {/* Single Row: All controls */}
                <div className="flex items-start gap-6">
                  {/* Left side - Controls compressed */}
                  <div className="flex-1 space-y-4">
                    {/* Paper Structure Name and Simulation Intensity in same row */}
                    <div className="flex items-end gap-4">
                      <div className="w-80">
                        <Label className="text-sm font-medium">Paper Structure Name</Label>
                        <Input
                          type="text"
                          value={appearanceSettings.paperStructure.fileName || ''}
                          placeholder="No file selected"
                          disabled={true}
                          className="mt-1"
                        />
                      </div>
                      
                      {/* Simulation Intensity */}
                      <div className="w-36">
                        <Label htmlFor="simulationIntensity" className="text-sm font-medium">
                          Simulation Intensity
                        </Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            id="simulationIntensity"
                            type="number"
                            min="1"
                            max="100"
                            value={appearanceSettings.paperStructure.simulationIntensity}
                            onChange={(e) => updatePaperStructureSetting('simulationIntensity', parseInt(e.target.value) || 1)}
                            disabled={!canEdit}
                            className="w-16"
                          />
                          <span className="text-xs text-muted-foreground">(1-100)</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Checkboxes in single row */}
                    <div className="flex items-center gap-6">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="rotatePattern90"
                          checked={appearanceSettings.paperStructure.rotatePattern90}
                          onCheckedChange={(checked) => updatePaperStructureSetting('rotatePattern90', checked)}
                          disabled={!canEdit}
                        />
                        <Label htmlFor="rotatePattern90" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Rotate pattern 90˚
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="increaseContrastForCardboard"
                          checked={appearanceSettings.paperStructure.increaseContrastForCardboard}
                          onCheckedChange={(checked) => updatePaperStructureSetting('increaseContrastForCardboard', checked)}
                          disabled={!canEdit}
                        />
                        <Label htmlFor="increaseContrastForCardboard" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Increase contract for cardboard
                        </Label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right side - Large Pattern Preview (50% larger) */}
                  <div className="flex-shrink-0">
                    <Label className="text-sm font-medium">Pattern Preview</Label>
                    <div className="mt-1 w-36 h-36 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center bg-gray-50">
                      {appearanceSettings.paperStructure.fileName ? (
                        <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 rounded pattern-preview"></div>
                      ) : (
                        <span className="text-xs text-muted-foreground text-center">No pattern<br/>imported</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Missing Dots Settings Card - Only shown when enabled */}
      {appearanceSettings.simulateMissingDots && (
        <Card>
          <CardHeader>
            <CardTitle>Missing Dots Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Colored Dots Checkbox */}
            <div className="flex items-center gap-4">
              <Checkbox
                id="coloredDots"
                checked={appearanceSettings.coloredDotsEnabled || false}
                onCheckedChange={(checked) => updateSetting('coloredDotsEnabled', checked)}
                disabled={!canEdit}
              />
              <Label htmlFor="coloredDots" className="text-sm font-medium">
                Colored Dots (in Percent)
              </Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={appearanceSettings.coloredDotsPercentage || 0}
                onChange={(e) => updateSetting('coloredDotsPercentage', parseInt(e.target.value) || 0)}
                disabled={!canEdit}
                className="w-20"
              />
            </div>

            {/* Ink Missing Dots Table */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Ink Missing Dots Configuration</Label>
              <div className="border rounded-lg overflow-hidden">
                 <table className="w-full">
                   <thead className="bg-muted">
                     <tr>
                       <th className="text-left p-3 text-sm font-medium w-32">Ink Name</th>
                       <th className="text-left p-3 text-sm font-medium w-48">Amount of Missing Dots (0-10)</th>
                       <th className="text-left p-3 text-sm font-medium w-48">Reduce Missing Dots at Index (%)</th>
                       <th className="text-left p-3 text-sm font-medium w-48">Stop Missing Dots at Index (%)</th>
                       <th className="text-left p-3 text-sm font-medium w-40">Screen Ruling (lpi)</th>
                     </tr>
                   </thead>
                  <tbody>
                    {/* Standard CMYK Inks */}
                    {['Cyan', 'Magenta', 'Yellow', 'Black'].map((inkName) => (
                      <tr key={inkName} className="border-t">
                        <td className="p-3 text-sm font-medium">{inkName}</td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={appearanceSettings.inkMissingDots?.[inkName]?.amount || 0}
                            onChange={(e) => updateInkMissingDotsSetting(inkName, 'amount', parseFloat(e.target.value) || 0)}
                            disabled={!canEdit}
                            className="w-20"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={appearanceSettings.inkMissingDots?.[inkName]?.reduceAtIndex || 0}
                            onChange={(e) => updateInkMissingDotsSetting(inkName, 'reduceAtIndex', parseInt(e.target.value) || 0)}
                            disabled={!canEdit}
                            className="w-20"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={appearanceSettings.inkMissingDots?.[inkName]?.stopAtIndex || 0}
                            onChange={(e) => updateInkMissingDotsSetting(inkName, 'stopAtIndex', parseInt(e.target.value) || 0)}
                            disabled={!canEdit}
                            className="w-20"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            value={appearanceSettings.inkMissingDots?.[inkName]?.screenRuling || 150}
                            onChange={(e) => updateInkMissingDotsSetting(inkName, 'screenRuling', parseInt(e.target.value) || 150)}
                            disabled={!canEdit}
                            className="w-20"
                          />
                        </td>
                      </tr>
                    ))}
                    
                     {/* Additional Inks Row - Show if ink books are selected */}
                     {selectedInkBooks.length > 0 && (
                      <tr className="border-t">
                        <td className="p-3 text-sm font-medium">Additional Inks</td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={appearanceSettings.inkMissingDots?.['Additional Inks']?.amount || 0}
                            onChange={(e) => updateInkMissingDotsSetting('Additional Inks', 'amount', parseFloat(e.target.value) || 0)}
                            disabled={!canEdit}
                            className="w-20"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={appearanceSettings.inkMissingDots?.['Additional Inks']?.reduceAtIndex || 0}
                            onChange={(e) => updateInkMissingDotsSetting('Additional Inks', 'reduceAtIndex', parseInt(e.target.value) || 0)}
                            disabled={!canEdit}
                            className="w-20"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={appearanceSettings.inkMissingDots?.['Additional Inks']?.stopAtIndex || 0}
                            onChange={(e) => updateInkMissingDotsSetting('Additional Inks', 'stopAtIndex', parseInt(e.target.value) || 0)}
                            disabled={!canEdit}
                            className="w-20"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            value={appearanceSettings.inkMissingDots?.['Additional Inks']?.screenRuling || 150}
                            onChange={(e) => updateInkMissingDotsSetting('Additional Inks', 'screenRuling', parseInt(e.target.value) || 150)}
                            disabled={!canEdit}
                            className="w-20"
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* White Undercoat Settings Card - Only shown when enabled */}
      {appearanceSettings.useWhiteUndercoat && (
        <Card>
          <CardHeader>
            <CardTitle>White Undercoat Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="whiteInkOpacity" className="text-sm font-medium">
                  White Ink Opacity
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="whiteInkOpacity"
                    type="number"
                    min="0"
                    max="100"
                    value={appearanceSettings.whiteUndercoat.opacity}
                    onChange={(e) => updateWhiteUndercoatSetting('opacity', parseInt(e.target.value) || 0)}
                    disabled={!canEdit}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whiteInkGradations" className="text-sm font-medium">
                  White Ink Gradations
                </Label>
                <Select
                  value={appearanceSettings.whiteUndercoat.gradations}
                  onValueChange={(value) => updateWhiteUndercoatSetting('gradations', value)}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select curve type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ISO A">ISO A</SelectItem>
                    <SelectItem value="ISO B">ISO B</SelectItem>
                    <SelectItem value="ISO C">ISO C</SelectItem>
                    <SelectItem value="ISO D">ISO D</SelectItem>
                    <SelectItem value="G7">G7</SelectItem>
                    <SelectItem value="G7+">G7+</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PrinterAppearanceTab;