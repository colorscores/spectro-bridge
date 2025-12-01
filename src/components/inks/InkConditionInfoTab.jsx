import React from 'react';
import InkConditionVisuals from './InkConditionVisuals';
import { Card, CardContent } from '@/components/ui/card';

// SEO: add basic metadata for the Info tab
import { Helmet } from 'react-helmet-async';

const InkConditionInfoTab = React.memo(({
  condition,
  onConditionChange,
  canEdit,
  showEditControls,
  isNew,
  onNameChange, 
  onPackTypeChange,
  onMeasurementControlsChange,
  measurementControls,
  standards,
  importedTints,
  onTintSelect,
  onClearTints,
  onCreateTestTint,
  onFileChange,
  substrateMismatchChoice,
  onSubstrateMismatchChoice,
  substrateNameFilled,
  substrateConditionNameFilled,
  mismatchResolved,
  onResolveMismatch,
  selectedWedge,
  onWedgeSelect,
  onWedgeDataChange,
  onAvailableModesChange,
  activeDataMode,
  onActiveDataModeChange,
  // Edit control props
  isEditMode,
  onEdit,
  onSave,
  onCancel,
  saving,
  isComputingAdaptedTints
}) => {
  return (
    <>
      <Helmet>
        <title>Ink Condition Info | PrintColorOS</title>
        <meta name="description" content="Ink condition info, substrate, and measurement settings." />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : ''} />
      </Helmet>
      
      {/* Gate rendering until activeDataMode is resolved */}
      {activeDataMode === null ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          </CardContent>
        </Card>
      ) : isComputingAdaptedTints ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Computing adapted data...</div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <InkConditionVisuals
              condition={condition}
              onConditionChange={onConditionChange}
              canEdit={canEdit}
              showEditControls={showEditControls}
              isNew={isNew}
              onNameChange={onNameChange}
              onPackTypeChange={onPackTypeChange}
              onMeasurementControlsChange={onMeasurementControlsChange}
              measurementControls={measurementControls}
              standards={standards}
              importedTints={importedTints}
              onTintSelect={onTintSelect}
              onClearTints={onClearTints}
              onCreateTestTint={onCreateTestTint}
              onFileChange={onFileChange}
              substrateMismatchChoice={substrateMismatchChoice}
              onSubstrateMismatchChoice={onSubstrateMismatchChoice}
              substrateNameFilled={substrateNameFilled}
              substrateConditionNameFilled={substrateConditionNameFilled}
              mismatchResolved={mismatchResolved}
              onResolveMismatch={onResolveMismatch}
              selectedWedge={selectedWedge}
              onWedgeSelect={onWedgeSelect}
              onWedgeDataChange={onWedgeDataChange}
              onAvailableModesChange={onAvailableModesChange}
              activeDataMode={activeDataMode}
              onActiveDataModeChange={onActiveDataModeChange}
              // Disable print conditions for ink conditions - only show substrate conditions
              usePrintConditions={false}
              // Edit control props
              isEditMode={isEditMode}
              onEdit={onEdit}
              onSave={onSave}
              onCancel={onCancel}
              saving={saving}
              isComputingAdaptedTints={isComputingAdaptedTints}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
});

export default InkConditionInfoTab;