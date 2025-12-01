import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import SelectSubstrateStep from '@/components/cxf/steps/SelectSubstrateStep';
import useAdaptInkWizardV2 from '@/hooks/useAdaptInkWizardV2';
import { useInksData } from '@/context/InkContext';

const AdaptInkConditionWizardV2 = ({ isOpen, onClose, sourceInkCondition, onSuccess }) => {
  const { loadConditionDetails } = useInksData();
  const [detailedCondition, setDetailedCondition] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Load full ink condition with imported_tints when wizard opens
  useEffect(() => {
    if (!isOpen || !sourceInkCondition?.id) {
      setDetailedCondition(null);
      return;
    }

    // Check if we need to load details
    const hasImportedTints = sourceInkCondition.imported_tints && 
                            Array.isArray(sourceInkCondition.imported_tints) && 
                            sourceInkCondition.imported_tints.length > 0;
    
    console.info('[AdaptWizard] Source condition check', {
      id: sourceInkCondition.id,
      hasImportedTints,
      importedTintsCount: sourceInkCondition.imported_tints?.length || 0
    });

    if (hasImportedTints) {
      // Already have the data we need
      setDetailedCondition(sourceInkCondition);
      console.info('[AdaptWizard] Using provided condition with imported_tints');
      return;
    }

    // Load detailed condition
    const loadDetails = async () => {
      setLoadingDetails(true);
      try {
        console.info('[AdaptWizard] Loading detailed condition:', sourceInkCondition.id);
        const detailed = await loadConditionDetails(sourceInkCondition.id);
        
        console.info('[AdaptWizard] Loaded detailed condition', {
          id: detailed?.id,
          hasImportedTints: !!detailed?.imported_tints,
          importedTintsCount: detailed?.imported_tints?.length || 0
        });
        
        setDetailedCondition(detailed);
      } catch (error) {
        console.error('[AdaptWizard] Failed to load detailed condition:', error);
        // Fallback to provided condition
        setDetailedCondition(sourceInkCondition);
      } finally {
        setLoadingDetails(false);
      }
    };

    loadDetails();
  }, [isOpen, sourceInkCondition, loadConditionDetails]);

  // Use detailed condition if available, otherwise use source
  const resolvedCondition = detailedCondition || sourceInkCondition;
  
  const wizard = useAdaptInkWizardV2(isOpen, resolvedCondition);

  useEffect(() => {
    if (!isOpen) {
      wizard.resetForm();
    }
  }, [isOpen]);

  const handleCreateAssets = async () => {
    const success = await wizard.handleCreateAssets();
    if (success) {
      onSuccess?.();
      onClose();
    }
  };

  const renderStepContent = () => {
    // Show loading state while fetching detailed condition
    if (loadingDetails) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading ink condition details...</div>
        </div>
      );
    }

    return (
      <SelectSubstrateStep
        formData={wizard.formData}
        updateFormData={wizard.updateFormData}
        cxfColors={wizard.processedColors}
        sourceInkCondition={resolvedCondition}
        hideAdaptationWarning={true}
        hideCreateNew={true}
        isSingleColorImport={false}
      />
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">
            Adapt Ink Condition to New Substrate
          </DialogTitle>
        </DialogHeader>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <DialogFooter className="flex justify-between sm:justify-between border-t pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={wizard.isSubmitting}
          >
            Cancel
          </Button>

          <Button
            onClick={handleCreateAssets}
            disabled={!wizard.canProceed || wizard.isSubmitting || loadingDetails}
          >
            {wizard.isSubmitting ? 'Creating...' : 'Create Adapted Condition'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdaptInkConditionWizardV2;
