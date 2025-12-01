import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import RouteStep1ColorSelection from './route-wizard/RouteStep1ColorSelection';
import RouteStep2PrinterDetails from './route-wizard/RouteStep2PrinterDetails';
import RouteStep3RouteConfirmation from './route-wizard/RouteStep3RouteConfirmation';
import Stepper from '../match-request-wizard/Stepper';

const RouteMatchesWizard = ({ open, onOpenChange, matchRequest, onRouted }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedColorIds, setSelectedColorIds] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after animation completes
    setTimeout(() => {
      setCurrentStep(1);
      setSelectedColorIds([]);
      setSelectedPartnerId('');
      setNotes('');
      setIsSubmitting(false);
    }, 300);
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceedFromStep1 = selectedColorIds.length > 0;
  const canProceedFromStep2 = selectedPartnerId !== '';
  const canProceedFromStep3 = selectedPartnerId !== '';

  const pageVariants = {
    initial: { opacity: 0, x: 50 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: -50 },
  };

  const pageTransition = {
    type: 'tween',
    ease: 'anticipate',
    duration: 0.4,
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <RouteStep1ColorSelection
            matchRequest={matchRequest}
            selectedColorIds={selectedColorIds}
            onSelectionChange={setSelectedColorIds}
          />
        );
      case 2:
        return (
          <RouteStep2PrinterDetails
            matchRequest={matchRequest}
            selectedColorIds={selectedColorIds}
            selectedPartnerId={selectedPartnerId}
            onPartnerChange={setSelectedPartnerId}
          />
        );
      case 3:
        return (
          <RouteStep3RouteConfirmation
            matchRequest={matchRequest}
            selectedColorIds={selectedColorIds}
            selectedPartnerId={selectedPartnerId}
            notes={notes}
            onNotesChange={setNotes}
            isSubmitting={isSubmitting}
            onSubmit={({ partnerId, notes: submitNotes }) => {
              setIsSubmitting(true);
              onRouted({ 
                partnerId, 
                notes: submitNotes,
                selectedColorIds,
              });
            }}
            onRouteClick={(submitHandler) => {
              // Store the submit handler so we can call it from the footer button
              window.routeSubmitHandler = submitHandler;
            }}
          />
        );
      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return canProceedFromStep1;
      case 2:
        return canProceedFromStep2;
      case 3:
        return canProceedFromStep3;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-md md:max-w-lg h-[85vh] max-h-[700px] flex flex-col p-6">
        <DialogHeader className="pb-4 flex-shrink-0">
          <DialogTitle className="text-center text-lg font-bold">Route Matches Wizard</DialogTitle>
          <p className="text-center text-muted-foreground text-xs">Route selected colors to an ink supplier partner for specialized matching services</p>
        </DialogHeader>
        
        <div className="pb-4 flex-shrink-0">
          <Stepper currentStep={currentStep} steps={['Color Details', 'Printer Details', 'Route Details']} />
        </div>
        
        <div className="flex-1 overflow-y-auto min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
              className="h-full flex flex-col"
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-between items-center pt-3 mt-3 h-12">
          <div>
            {currentStep > 1 && (
              <Button variant="outline" onClick={handleBack} disabled={isSubmitting} size="sm">
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {currentStep < 3 ? (
              <Button onClick={handleNext} disabled={!canProceed()} size="sm">
                Continue
              </Button>
            ) : (
              <Button 
                onClick={() => {
                  if (window.routeSubmitHandler) {
                    window.routeSubmitHandler();
                  }
                }} 
                disabled={isSubmitting || !selectedPartnerId}
                className="min-w-[160px]"
                size="sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Routing...
                  </>
                ) : (
                  `Route ${selectedColorIds.length} Match${selectedColorIds.length !== 1 ? 'es' : ''}`
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteMatchesWizard;