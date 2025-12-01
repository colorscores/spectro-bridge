import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

const ImportSettingsCollapsible = ({
  // Import mode controls
  importMode,
  onImportModeChange,
  showImportModeSelection,
  
  // Measurement mode controls
  hasSpectralWithoutMode,
  defaultMeasurementMode,
  onDefaultMeasurementModeChange,
  
  // Standard type controls (color mode only) - kept for compatibility
  standardType,
  onStandardTypeChange,
  showStandardTypeControls,
  
  // Print condition controls - kept for compatibility
  enablePrintCondition,
  onEnablePrintConditionChange,
  selectedPrintCondition,
  onSelectedPrintConditionChange,
  printConditions,
  showPrintConditionControls
}) => {
  return (
    <div className="space-y-4 mb-4">
      {/* Spectral Colors Warning - Always Visible at Top When Present */}
      {hasSpectralWithoutMode && (
        <div className="bg-destructive/15 border border-destructive/50 rounded-lg p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-destructive">
                  Measurement Mode Required
                </div>
                <div className="text-xs text-destructive/80 mt-1">
                  Some spectral colors don't have measurement modes. Choose a default to apply to those colors.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Label className="text-xs text-destructive whitespace-nowrap">
                Default Measurement Mode:
              </Label>
              <Select value={defaultMeasurementMode || ""} onValueChange={onDefaultMeasurementModeChange}>
                <SelectTrigger className="w-40 h-8 text-xs border-destructive/30">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M0">M0 - No Filter</SelectItem>
                  <SelectItem value="M1">M1 - UV Included</SelectItem>
                  <SelectItem value="M2">M2 - UV Excluded</SelectItem>
                  <SelectItem value="M3">M3 - Polarized</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Import Type - Always Visible */}
      {showImportModeSelection && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Import Type</Label>
          <RadioGroup value={importMode} onValueChange={onImportModeChange} className="grid grid-cols-2 gap-4">
            {/* Color Card */}
            <Card 
              className={`cursor-pointer transition-all ${importMode === 'color' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
              onClick={() => onImportModeChange('color')}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="color" id="color" className="h-[18px] w-[18px] p-0 flex-shrink-0" />
                  <div className="flex-1">
                    <Label htmlFor="color" className="text-sm font-medium cursor-pointer">
                      Import as Color
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Import solid color only (traditional color library entry)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Ink-based Color Card */}
            <Card 
              className={`cursor-pointer transition-all ${importMode === 'ink-based-color' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
              onClick={() => onImportModeChange('ink-based-color')}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="ink-based-color" id="ink-based-color" className="h-[18px] w-[18px] p-0 flex-shrink-0" />
                  <div className="flex-1">
                    <Label htmlFor="ink-based-color" className="text-sm font-medium cursor-pointer">
                      Import as Ink-based Color
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Import with full tint characterization data and substrate
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </RadioGroup>
        </div>
      )}
    </div>
  );
};

export default ImportSettingsCollapsible;