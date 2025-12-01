import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, GitBranch } from 'lucide-react';
import { useAdaptInkWizard } from '@/hooks/useAdaptInkWizard';
import SelectSubstrateStep from '@/components/cxf/steps/SelectSubstrateStep';

const AdaptInkConditionWizard = ({ 
  isOpen, 
  onClose, 
  sourceInkCondition,
  onSuccess 
}) => {
  const wizard = useAdaptInkWizard({
    sourceInkCondition,
    isOpen,
    onSuccess,
    onClose
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      wizard.resetForm();
    }
  }, [isOpen, wizard.resetForm]);

  if (!sourceInkCondition) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Adapt Ink Condition to New Substrate
          </DialogTitle>
          <DialogDescription>
            Adapt "{sourceInkCondition.name}" to a different substrate while preserving all ink characteristics and measurements.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto min-h-0">
          <SelectSubstrateStep
            formData={wizard.formData}
            updateFormData={wizard.updateFormData}
            cxfColors={wizard.processedColors}
            hideAdaptationWarning={true}
            sourceInkCondition={sourceInkCondition}
          />
        </div>

        <DialogFooter className="flex justify-between sm:justify-between border-t pt-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={wizard.isSubmitting}
            >
              Cancel
            </Button>
          </div>

          <div>
            <Button
              onClick={wizard.handleCreateAssets}
              disabled={!wizard.canProceed || wizard.isSubmitting}
            >
              {wizard.isSubmitting ? (
                'Creating...'
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Create Adapted Condition
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdaptInkConditionWizard;