import React, { useState } from 'react';
import CxfAddColorDialog from '@/components/colors/CxfAddColorDialog';
import CxfImportDialog from '@/components/CxfImportDialog';
import CxfObjectSelectionDialog from '@/components/CxfObjectSelectionDialog';
import CxfInkImportDialog from '@/components/inks/CxfInkImportDialog';
import CxfInkImportWizard from './CxfInkImportWizard';

/**
 * Wrapper component that renders the appropriate CxF import dialog
 * based on the import context and requirements
 */
const CxfImportDialogWrapper = ({
  isOpen,
  onClose,
  colors,
  context, // 'colors', 'matching', 'substrate-condition', 'print-condition'
  onImport,
  onColorSelect,
  title,
  diagnostics,
  directInkImport = false,
  ...props
}) => {
  // For ink-condition context, manage two-stage flow
  const [selectedInkObjects, setSelectedInkObjects] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  // For color library imports - multiple selection
  if (context === 'colors') {
    return (
      <CxfObjectSelectionDialog
        isOpen={isOpen}
        onClose={onClose}
        objects={colors}
        onImport={onImport}
        importContext="colors"
        title={title || 'Import Colors from CxF'}
        {...props}
      />
    );
  }

  // For matching - single selection with match name
  if (context === 'matching') {
    return (
      <CxfImportDialog
        isOpen={isOpen}
        setIsOpen={onClose}
        cxfColors={colors}
        onColorSelect={onColorSelect}
        {...props}
      />
    );
  }

  // For substrate/print/ink conditions - single selection with context
  if (context === 'substrate-condition' || context === 'print-condition') {
    return (
      <CxfObjectSelectionDialog
        isOpen={isOpen}
        onClose={onClose}
        objects={colors}
        onImport={onImport}
        importContext={context}
        title={title || `Select CxF Object for ${
          context === 'substrate-condition' ? 'Substrate' : 
          'Print'
        } Condition`}
        {...props}
      />
    );
  }

  // Two-stage flow for ink conditions: CxF selection -> wizard (unless directInkImport)
  if (context === 'ink-condition') {
    console.log('🧙 CxfImportDialogWrapper: ink-condition context', { 
      isOpen, 
      colorsCount: colors?.length, 
      showWizard, 
      selectedInkObjects: selectedInkObjects?.length,
      directInkImport
    });

    // Direct import path: bypass wizard and close dialog after import
    if (directInkImport) {
      return (
        <CxfObjectSelectionDialog
          isOpen={isOpen}
          onClose={onClose}
          objects={colors}
          onImport={onImport}
          importContext="ink-condition"
          title={title || 'Select CxF Object for Ink Condition'}
          twoStageInk={false}
          {...props}
        />
      );
    }
    
    const handleInkSelection = (selectedObjects) => {
      console.log('🎯 Ink selection made:', selectedObjects);
      setSelectedInkObjects(selectedObjects);
      setShowWizard(true);
    };

    const handleWizardClose = () => {
      console.log('🚪 Wizard closing');
      setShowWizard(false);
      setSelectedInkObjects(null);
      onClose();
    };

    const handleWizardSuccess = (inkId, inkConditionId) => {
      console.log('✅ Wizard success:', { inkId, inkConditionId });
      setShowWizard(false);
      setSelectedInkObjects(null);
      onImport?.(inkId, inkConditionId);
    };

    if (showWizard && selectedInkObjects) {
      return (
        <CxfInkImportWizard
          isOpen={true}
          onClose={handleWizardClose}
          cxfColors={selectedInkObjects}
          onSuccess={handleWizardSuccess}
          {...props}
        />
      );
    }

    return (
      <CxfObjectSelectionDialog
        isOpen={isOpen}
        onClose={onClose}
        objects={colors}
        onImport={handleInkSelection}
        importContext="ink-condition"
        title="Select CxF Object for Ink Condition"
        {...props}
      />
    );
  }

  // Default to object selection dialog
  return (
    <CxfObjectSelectionDialog
      isOpen={isOpen}
      onClose={onClose}
      objects={colors}
      onImport={onImport}
      importContext={context}
      title={title || "Select CxF Objects to Import"}
      {...props}
    />
  );
};

export default CxfImportDialogWrapper;