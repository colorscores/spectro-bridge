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
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useCxfInkWizard } from '@/hooks/useCxfInkWizard';
import CxfWizardStepper from './CxfWizardStepper';
import SelectSubstrateStep from './steps/SelectSubstrateStep';
import SubstrateDetailsStep from './steps/SubstrateDetailsStep';
import SubstrateConditionStep from './steps/SubstrateConditionStep';
import InkDetailsStep from './steps/InkDetailsStep';
import SummaryStep from './steps/SummaryStep';

const stepTitles = {
  1: 'Select Substrate & Condition',
  2: 'Substrate Details', 
  3: 'Substrate Condition Details',
  4: 'Ink Details',
  5: 'Summary'
};

const CxfInkImportWizard = ({ 
  isOpen, 
  onClose, 
  cxfColors = [], 
  onSuccess 
}) => {
  const wizard = useCxfInkWizard({
    cxfColors,
    isOpen,
    onSuccess,
    onClose
  });

  // Reset and normalize form when dialog opens
  useEffect(() => {
    if (isOpen) {
      wizard.resetForm();
    }
  }, [isOpen, wizard.resetForm]);

  const renderStepContent = () => {
    switch (wizard.currentStep) {
      case 1:
        return (
          <SelectSubstrateStep
            formData={wizard.formData}
            updateFormData={wizard.updateFormData}
            cxfColors={wizard.processedColors}
            isSingleColorImport={wizard.hasSingleColorImport || wizard.isSingleColorImport}
          />
        );
      
      case 2:
        return (
          <SubstrateDetailsStep
            formData={wizard.formData}
            updateFormData={wizard.updateFormData}
            cxfColors={wizard.processedColors}
            activeSteps={wizard.activeSteps}
            currentStep={wizard.currentStep}
          />
        );
      
      case 3:
        return (
          <SubstrateConditionStep
            formData={wizard.formData}
            updateFormData={wizard.updateFormData}
            resolvedNames={wizard.resolvedNames}
          />
        );
      
      case 4:
        return (
          <InkDetailsStep
            formData={wizard.formData}
            updateFormData={wizard.updateFormData}
            resolvedNames={wizard.resolvedNames}
          />
        );
      
      case 5:
        return (
          <SummaryStep
            formData={wizard.formData}
            resolvedNames={wizard.resolvedNames}
            processedColors={wizard.processedColors}
            cxfColors={cxfColors}
          />
        );
      
      default:
        return null;
    }
  };

  const progressValue = ((wizard.currentStepIndex + 1) / wizard.activeSteps.length) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {wizard.currentStep === 2 && wizard.formData.assignedSubstrate === 'create-new' 
              ? 'Please specify the details of the new Substrate'
              : wizard.currentStep === 3 && wizard.formData.assignedSubstrateCondition === 'create-new'
              ? 'Please specify the details of the new Substrate Condition'
              : wizard.isSingleColorImport
              ? 'Select Ink and Substrate for Single Color Import'
              : 'Select Ink and Substrate for this Import'
            }
          </DialogTitle>
        </DialogHeader>
        
        {/* Wizard Stepper */}
        <CxfWizardStepper 
          activeSteps={wizard.activeSteps} 
          currentStep={wizard.currentStep} 
        />

        <div className="flex-1 overflow-y-auto min-h-0">
          {renderStepContent()}
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
            
            {!wizard.isFirstStep && (
              <Button
                variant="outline"
                onClick={wizard.handleBack}
                disabled={wizard.isSubmitting}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
          </div>

          <div>
            {wizard.isLastStep ? (
              <Button
                onClick={wizard.handleCreateAssets}
                disabled={!wizard.canProceed || wizard.isSubmitting}
              >
                {wizard.isSubmitting ? (
                  'Creating...'
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Create Assets
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={wizard.handleNext}
                disabled={!wizard.canProceed}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CxfInkImportWizard;