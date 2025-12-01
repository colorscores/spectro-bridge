import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

const SubstrateMismatchCard = ({ 
  showSubstrateOptions, 
  substrateAdaptationMode, 
  onSubstrateAdaptationChange,
  onSave,
  substrateNameFilled = false,
  substrateConditionNameFilled = false,
  context = "from-import",
  isPrintConditionComplete = false,
  saving = false,
  deltaE = null,
  disableCreateOption = false, // NEW: Disable "Create New" option for certain contexts
}) => {
  if (!showSubstrateOptions) {
    return null;
  }

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-red-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Substrate Mismatch!
            {deltaE && (
              <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                ΔE {deltaE.toFixed(1)}
              </span>
            )}
          </div>
          {onSave && (
            <Button 
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave(substrateAdaptationMode); }}
              variant="destructive"
              size="sm"
              className="text-xs"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <p className="text-sm text-red-700">
            {context === "from-ink" 
              ? "The ink substrate differs from the selected print condition substrate. Choose how to handle this:"
              : "The imported substrate differs from your current substrate condition. Choose how to handle this:"
            }
          </p>
          <RadioGroup 
            value={substrateAdaptationMode} 
              onValueChange={(value) => {
              onSubstrateAdaptationChange(value);
            }}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="create" id="create-substrate" className="mt-0.5" disabled={disableCreateOption} />
              <div className="space-y-1">
                <Label htmlFor="create-substrate" className="text-sm font-medium">
                  {context === "from-ink" 
                    ? "Create new Print Condition"
                    : "Create new Substrate & Condition"
                  }
                </Label>
                <p className="text-xs text-gray-600">
                  {context === "from-ink"
                    ? "Create a new print condition with the ink's substrate information"
                    : "Save the imported substrate as a new substrate and condition, keeping original measurements"
                  }
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="adapt" id="adapt-measurements" className="mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="adapt-measurements" className="text-sm font-medium">
                  {context === "from-ink"
                    ? "Adapt measurements to selected Print Condition"
                    : "Adapt measurements to current Substrate Condition"
                  }
                </Label>
                <p className="text-xs text-gray-600">
                  {context === "from-ink"
                    ? "Adjust the measurements to match the selected print condition's substrate"
                    : "Adjust the measurements to match your current substrate condition"
                  }
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubstrateMismatchCard;