import React from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const SubstrateDifferenceDialog = ({ isOpen, onClose, deltaEValue, deltaEMethod }) => {
  // Map table numbers and method keys to proper delta E method names
  const getDeltaEMethodName = (method) => {
    const methodMap = {
      '1': 'dE76',
      '2': 'dE94',
      '3': 'dE00',
      '5': 'dE00', // Default for table 5
      '6': 'dE00',
      'dE76': 'dE76',
      'dE94': 'dE94', 
      'dE00': 'dE00',
      'dECMC2:1': 'dECMC2:1',
      'dECMC1:1': 'dECMC1:1'
    };
    return methodMap[method] || 'dE00';
  };

  const methodName = getDeltaEMethodName(deltaEMethod);

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Substrate Mismatch</AlertDialogTitle>
          <AlertDialogDescription>
            <div>
              There is a difference greater than 1 Δ{methodName} (current: {deltaEValue?.toFixed(2)}). 
              You will need to choose to either create a new <strong>Substrate and Condition</strong>, or to <strong>adapt 
              the imported data</strong> to the current Substrate Condition.
            </div>
            <hr className="my-3" />
            <div>
              If you choose 'Create new Substrate', complete the 2 additional tabs for Substrate and Substrate Condition. 
              Please note that the adapted ink values will have different spectra and color, compared to the import data.
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SubstrateDifferenceDialog;
