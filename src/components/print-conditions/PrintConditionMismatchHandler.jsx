import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Beaker, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const PrintConditionMismatchHandler = ({
  isOpen,
  onClose,
  mismatchData, // { deltaE, importedSubstrate, printCondition }
  onAdapt,
  onCreateNew,
  canEdit = true
}) => {
  const [selectedOption, setSelectedOption] = useState('adapt');
  const [newConditionName, setNewConditionName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSave = async () => {
    if (!mismatchData || isProcessing) {
      console.log('PrintConditionMismatchHandler.handleSave - early exit', { hasMismatch: !!mismatchData, isProcessing });
      return;
    }

    setIsProcessing(true);

    try {
      console.log('PrintConditionMismatchHandler.handleSave - selectedOption:', selectedOption);
      if (selectedOption === 'adapt') {
        console.log('PrintConditionMismatchHandler - calling onAdapt');
        await onAdapt?.();
      } else if (selectedOption === 'create') {
        // Allow creation without a name; default to "Print Condition" and let the form require it later
        const name = newConditionName.trim() || 'Print Condition';
        console.log('PrintConditionMismatchHandler - onCreateNew called with name:', name, { mismatchData });
        await onCreateNew?.(name, mismatchData);
      }
      onClose?.();
    } catch (error) {
      console.error('Error handling substrate mismatch:', error);
      alert('Error processing substrate mismatch. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mismatchData || !isOpen) return null;

  const { deltaE, importedSubstrate, printCondition } = mismatchData;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Substrate Mismatch Detected
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-amber-800 mb-1">
                  Substrate Color Difference Detected
                </h4>
                <p className="text-xs text-amber-700">
                  The imported substrate color differs from the selected print condition's substrate by 
                  <Badge variant="destructive" className="mx-1 text-xs">
                    ΔE: {deltaE.toFixed(1)}
                  </Badge>
                  units. Please choose how to handle this difference.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Imported Substrate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div 
                  className="w-full h-12 rounded border border-gray-300"
                  style={{ backgroundColor: importedSubstrate.colorHex || '#f3f4f6' }}
                  title={importedSubstrate.colorHex || 'No color data'}
                />
                {importedSubstrate.lab && (
                  <div className="text-xs font-mono text-muted-foreground">
                    L:{importedSubstrate.lab.L?.toFixed(1)} 
                    a:{importedSubstrate.lab.a?.toFixed(1)} 
                    b:{importedSubstrate.lab.b?.toFixed(1)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Print Condition Substrate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div 
                  className="w-full h-12 rounded border border-gray-300"
                  style={{ backgroundColor: printCondition.color_hex || '#f3f4f6' }}
                  title={printCondition.color_hex || 'No color data'}
                />
                {printCondition.lab && (
                  <div className="text-xs font-mono text-muted-foreground">
                    L:{printCondition.lab.L?.toFixed(1)} 
                    a:{printCondition.lab.a?.toFixed(1)} 
                    b:{printCondition.lab.b?.toFixed(1)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-semibold">Resolution Options</Label>
            <RadioGroup value={selectedOption} onValueChange={setSelectedOption}>
              
              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="adapt" id="adapt-option" className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Beaker className="w-4 h-4" />
                    <Label htmlFor="adapt-option" className="cursor-pointer font-medium">
                      Adapt to Print Condition Substrate
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use the print condition's substrate and adapt the imported ink measurements accordingly. 
                    This maintains consistency with your existing print condition.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="create" id="create-option" className="mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    <Label htmlFor="create-option" className="cursor-pointer font-medium">
                      Create New Print Condition
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Create a new print condition using the imported substrate data. 
                    This preserves the exact imported measurements.
                  </p>
                  {selectedOption === 'create' && (
                    <Input
                      placeholder="Enter name for new print condition..."
                      value={newConditionName}
                      onChange={(e) => setNewConditionName(e.target.value)}
                      className="mt-2"
                      disabled={!canEdit}
                    />
                  )}
                </div>
              </div>
              
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing} type="button">
            Cancel
          </Button>
          <Button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSave(); }} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 
              selectedOption === 'adapt' ? 'Adapt Substrate' : 'Create New Print Condition'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrintConditionMismatchHandler;