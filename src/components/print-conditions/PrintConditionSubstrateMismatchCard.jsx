import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

const PrintConditionSubstrateMismatchCard = ({
  showSubstrateOptions,
  substrateAdaptationMode,
  onSubstrateAdaptationChange,
  onSave,
  deltaE,
  importedSubstrate,
  printConditionSubstrate,
  isPrintConditionComplete = false
}) => {
  if (!showSubstrateOptions) return null;

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <AlertTriangle className="h-5 w-5" />
          Substrate Mismatch Detected
        </CardTitle>
        <div className="text-sm text-orange-700">
          The imported color's substrate (ΔE: {deltaE?.toFixed(1)}) differs from the selected print condition's substrate.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual comparison */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <div 
               className="w-12 h-12 rounded border-2 border-gray-300"
               style={{ backgroundColor: importedSubstrate?.colorHex || 'transparent' }}
             />
            <span className="text-xs text-muted-foreground">Imported</span>
          </div>
          <div className="text-muted-foreground">vs</div>
          <div className="flex flex-col items-center gap-2">
            <div 
               className="w-12 h-12 rounded border-2 border-gray-300"
               style={{ backgroundColor: printConditionSubstrate?.colorHex || 'transparent' }}
             />
            <span className="text-xs text-muted-foreground">Print Condition</span>
          </div>
        </div>

        <RadioGroup value={substrateAdaptationMode} onValueChange={onSubstrateAdaptationChange}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="adapt" id="adapt-print-condition" />
            <Label htmlFor="adapt-print-condition" className="cursor-pointer">
              Adapt to Print Condition Substrate
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="create" id="create-print-condition" />
            <Label htmlFor="create-print-condition" className="cursor-pointer">
              Create New Print Condition
            </Label>
          </div>
        </RadioGroup>

        {onSave && (
          <Button 
            onClick={onSave} 
            className="w-full"
            disabled={substrateAdaptationMode === 'create' && !isPrintConditionComplete}
          >
            {substrateAdaptationMode === 'adapt' ? 'Apply Changes' : 'Save'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default PrintConditionSubstrateMismatchCard;