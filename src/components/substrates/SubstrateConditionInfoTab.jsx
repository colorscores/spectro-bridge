import React from 'react';
import SubstrateConditionInfo from '@/components/conditions/SubstrateConditionInfo';
import SubstrateConditionVisuals from '@/components/conditions/SubstrateConditionVisuals';

const SubstrateConditionInfoTab = ({ 
  condition, 
  onConditionChange, 
  canEdit, 
  isNew, 
  onNameChange, 
  onPackTypeChange,
  onMeasurementControlsChange,
  measurementControls,
  standards = [],
  allSubstrates,
  parentSubstrate,
  constructionDetails,
  setConstructionDetails,
  setHasUnsavedChanges,
  hasUnsavedChanges = false,
  infoCardEditMode,
  onInfoEdit,
  onInfoSave,
  onInfoCancel,
  constructionCardEditMode,
  onConstructionEdit,
  onConstructionSave,
  onConstructionCancel
}) => {
  return (
    <div className="space-y-6">
      <SubstrateConditionInfo
        condition={condition}
        parentSubstrate={parentSubstrate}
        onNameChange={onNameChange}
        onConditionChange={onConditionChange}
        measurementControls={measurementControls}
        onMeasurementControlsChange={onMeasurementControlsChange}
        canEdit={canEdit}
        setHasUnsavedChanges={setHasUnsavedChanges}
        isNew={isNew}
        onPackTypeChange={onPackTypeChange}
        isEditing={infoCardEditMode}
        onEdit={onInfoEdit}
        onSave={onInfoSave}
        onCancel={onInfoCancel}
      />
      <SubstrateConditionVisuals
        condition={condition}
        onConditionChange={onConditionChange}
        canEdit={canEdit}
        isNew={isNew}
        onNameChange={onNameChange}
        onPackTypeChange={onPackTypeChange}
        onMeasurementControlsChange={onMeasurementControlsChange}
        measurementControls={measurementControls}
        standards={standards}
        allSubstrates={allSubstrates}
        parentSubstrate={parentSubstrate}
        constructionDetails={constructionDetails}
        onConstructionDetailsChange={setConstructionDetails}
        setHasUnsavedChanges={setHasUnsavedChanges}
        isEditing={constructionCardEditMode}
        onEdit={onConstructionEdit}
        onSave={onConstructionSave}
        onCancel={onConstructionCancel}
      />
    </div>
  );
};

export default SubstrateConditionInfoTab;