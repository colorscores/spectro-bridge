import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SubstrateConditionVisuals from '@/components/conditions/SubstrateConditionVisuals';
import SubstrateConditionInfo from '@/components/conditions/SubstrateConditionInfo';
import { generateSubstrateConditionName } from '@/lib/substrateConditionNaming';
import { normalizeTints } from '@/lib/tintsUtils';

const SubstrateConditionFormTab = ({ 
  condition = {}, 
  onConditionChange = () => {},
  canEdit = true, 
  isNew = true, 
  onNameChange = () => {}, 
  onPackTypeChange = () => {},
  onMeasurementControlsChange = () => {},
  measurementControls = {},
  standards = [],
  allSubstrates = [],
  parentSubstrate = {},
  constructionDetails = {},
  setConstructionDetails = () => {},
  setHasUnsavedChanges = () => {},
  onDataChange = () => {},
  onSubstrateConditionSaved
}) => {
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  
  // Independent edit states for each card
  const [editingStates, setEditingStates] = useState({
    info: false,
    construction: false,
    appearance: false
  });

  const [savingStates, setSavingStates] = useState({
    info: false,
    construction: false,
    appearance: false
  });

  // Auto-fill measurement data from 0% tint (prioritize Substrate background)
  useEffect(() => {
    if (condition?.spectral_data) return;

    console.debug('SubstrateConditionFormTab: Starting auto-fill effect', {
      hasConditionSpectral: !!condition?.spectral_data,
      parentSubstrate: {
        hasImportedMeasurements: !!parentSubstrate?.imported_measurements,
        hasImportedTints: !!parentSubstrate?.imported_tints,
        importedMeasurementsLength: Array.isArray(parentSubstrate?.imported_measurements) ? parentSubstrate.imported_measurements.length : 0,
        importedTintsLength: Array.isArray(parentSubstrate?.imported_tints) ? parentSubstrate.imported_tints.length : 0,
      },
      condition: {
        hasImportedTints: !!condition?.imported_tints,
        importedTintsLength: Array.isArray(condition?.imported_tints) ? condition.imported_tints.length : 0,
      }
    });

    const importedMeasurements = parentSubstrate?.imported_measurements;
    const importedTintsPS = normalizeTints(parentSubstrate?.imported_tints);
    const importedTintsCond = normalizeTints(condition?.imported_tints);

    const findZeroTintWithSubstrateBackground = (arr) => {
      if (!Array.isArray(arr)) return null;
      // First try to find 0% tint with "Substrate" background or measurementType = 'substrate'
      const substrateBg = arr.find(m => {
        const tintPct = m.tint_percentage ?? m.tintPercentage ?? m.tint;
        const isZeroTint = tintPct === 0 || String(tintPct) === '0';
        const hasSubstrateType = m.measurementType === 'substrate' || 
                                (m.background_type && m.background_type.toLowerCase().includes('substrate'));
        return isZeroTint && hasSubstrateType;
      });
      if (substrateBg) return substrateBg;
      
      // Fallback to any 0% tint
      return arr.find(m => {
        const tintPct = m.tint_percentage ?? m.tintPercentage ?? m.tint;
        return tintPct === 0 || String(tintPct) === '0';
      }) || null;
    };

    const findZeroTint = (arr) => {
      if (!Array.isArray(arr)) return null;
      return arr.find(m => {
        const tintPct = m.tint_percentage ?? m.tintPercentage ?? m.tint;
        return tintPct === 0 || String(tintPct) === '0';
      }) || null;
    };

    // Priority 1: imported_measurements with substrate background preference
    const zeroFromMeasurements = findZeroTintWithSubstrateBackground(importedMeasurements);
    // Priority 2: parent substrate imported_tints (normalized)
    const zeroFromParentTints = findZeroTint(importedTintsPS);
    // Priority 3: condition imported_tints (normalized)
    const zeroFromCondTints = findZeroTint(importedTintsCond);

    console.debug('SubstrateConditionFormTab: Auto-fill candidates found', {
      zeroFromMeasurements: zeroFromMeasurements ? {
        tintPct: zeroFromMeasurements.tint_percentage ?? zeroFromMeasurements.tintPercentage,
        backgroundType: zeroFromMeasurements.background_type,
        measurementType: zeroFromMeasurements.measurementType,
        hasSpectral: !!zeroFromMeasurements.spectral_data,
        hasLab: !!zeroFromMeasurements.lab
      } : null,
      zeroFromParentTints: zeroFromParentTints ? {
        tintPct: zeroFromParentTints.tint_percentage ?? zeroFromParentTints.tintPercentage ?? zeroFromParentTints.tint,
        hasSpectral: !!(zeroFromParentTints.spectral_data || zeroFromParentTints.spectralData),
        hasLab: !!(zeroFromParentTints.lab || zeroFromParentTints.LAB)
      } : null,
      zeroFromCondTints: zeroFromCondTints ? {
        tintPct: zeroFromCondTints.tint_percentage ?? zeroFromCondTints.tintPercentage ?? zeroFromCondTints.tint,
        hasSpectral: !!(zeroFromCondTints.spectral_data || zeroFromCondTints.spectralData),
        hasLab: !!(zeroFromCondTints.lab || zeroFromCondTints.LAB)
      } : null
    });

    const picked = zeroFromMeasurements || zeroFromParentTints || zeroFromCondTints;

    if (picked) {
      const autoFillData = {
        spectral_data: picked.spectral_data || picked.spectralData || null,
        lab: picked.lab || picked.LAB || null,
        color_hex: picked.color_hex || picked.hex || condition?.color_hex || '#FFFFFF'
      };

      if (autoFillData.spectral_data || autoFillData.lab) {
        console.debug('SubstrateConditionFormTab: Auto-filling from 0% tint source', {
          source: zeroFromMeasurements ? 'parentSubstrate.imported_measurements' : (zeroFromParentTints ? 'parentSubstrate.imported_tints' : 'condition.imported_tints'),
          hasSubstrateBackground: zeroFromMeasurements?.measurementType === 'substrate' || zeroFromMeasurements?.background_type?.toLowerCase().includes('substrate'),
          dataFound: { spectral: !!autoFillData.spectral_data, lab: !!autoFillData.lab, hex: !!autoFillData.color_hex }
        });
        onConditionChange?.(autoFillData);
        onConditionChange?.(autoFillData);
      }
    } else {
      console.debug('SubstrateConditionFormTab: No 0% tint source found for auto-fill');
    }
  }, [
    condition?.spectral_data,
    parentSubstrate?.imported_measurements,
    parentSubstrate?.imported_tints,
    condition?.imported_tints
  ]);

  // Handle card edit operations
  const handleCardEdit = (cardType) => {
    setEditingStates(prev => ({ ...prev, [cardType]: true }));
  };

  const handleCardSave = async (cardType) => {
    setSavingStates(prev => ({ ...prev, [cardType]: true }));
    try {
      if (isNew && onSubstrateConditionSaved) {
        // Create the substrate condition in the database using imported tints
        const savedCondition = await onSubstrateConditionSaved(condition);
        if (savedCondition) {
          setEditingStates(prev => ({ ...prev, [cardType]: false }));
          setHasUnsavedChanges(false);
        }
      } else {
        // For existing conditions, just update local state
        console.log(`Saving ${cardType} card with data:`, condition);
        setEditingStates(prev => ({ ...prev, [cardType]: false }));
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error(`Error saving ${cardType}:`, error);
    } finally {
      setSavingStates(prev => ({ ...prev, [cardType]: false }));
    }
  };

  const handleCardCancel = (cardType) => {
    setEditingStates(prev => ({ ...prev, [cardType]: false }));
  };

  // Notify parent of condition name changes
  const handleNameChange = (e) => {
    setNameManuallyEdited(true);
    if (onNameChange) {
      onNameChange(e);
    }
    if (onDataChange) {
      onDataChange({
        name: e.target.value
      });
    }
  };

  // Auto-name when relevant fields change (without overriding manual edits)
  useEffect(() => {
    const printSide = parentSubstrate?.printing_side;
    const useWhiteInk = (constructionDetails?.whiteUndercoat?.enabled ?? constructionDetails?.useWhiteInk ?? parentSubstrate?.use_white_ink ?? parentSubstrate?.useWhiteInk) || false;

    // Determine laminate (printedSubstrate) and varnish states similar to SubstrateConditionDetail
    const laminateLayer = constructionDetails?.printedSubstrate || constructionDetails?.Laminate;
    const laminateEnabled = !!laminateLayer?.enabled;
    let laminateSurfaceQuality = null;
    if (laminateEnabled && laminateLayer?.surfaceQuality) {
      if (typeof laminateLayer.surfaceQuality === 'string' && !laminateLayer.surfaceQuality.includes('-')) {
        laminateSurfaceQuality = laminateLayer.surfaceQuality;
      }
    }

    const varnishLayer = constructionDetails?.varnish;
    const varnishEnabled = !!varnishLayer?.enabled;
    let varnishSurfaceQuality = null;
    if (varnishEnabled && varnishLayer?.surfaceQuality) {
      if (typeof varnishLayer.surfaceQuality === 'string' && !varnishLayer.surfaceQuality.includes('-')) {
        varnishSurfaceQuality = varnishLayer.surfaceQuality;
      }
    }

    const version = condition?.version;

    const autoName = generateSubstrateConditionName({
      substrateName: parentSubstrate?.name,
      printSide,
      useWhiteInk,
      laminateEnabled,
      laminateSurfaceQuality,
      varnishEnabled,
      varnishSurfaceQuality,
      version
    });

    const currentName = (condition?.name || '').trim();
    if ((!nameManuallyEdited || !currentName) && autoName && autoName !== currentName) {
      if (onConditionChange) onConditionChange({ name: autoName });
      if (onDataChange) onDataChange({ name: autoName });
    }
  }, [
    parentSubstrate?.printing_side,
    parentSubstrate?.name,
    parentSubstrate?.use_white_ink,
    constructionDetails?.whiteUndercoat?.enabled,
    constructionDetails?.printedSubstrate?.enabled,
    constructionDetails?.printedSubstrate?.surfaceQuality,
    constructionDetails?.Laminate?.enabled,
    constructionDetails?.Laminate?.surfaceQuality,
    constructionDetails?.varnish?.enabled,
    constructionDetails?.varnish?.surfaceQuality,
    condition?.version,
    nameManuallyEdited
  ]);

  return (
    <div className="space-y-6">
      {/* General Info - with independent edit controls */}
      <SubstrateConditionInfo
        condition={condition}
        parentSubstrate={parentSubstrate}
        onNameChange={handleNameChange}
        onConditionChange={(field, value) => onConditionChange ? onConditionChange({ [field]: value }) : undefined}
        onPackTypeChange={onPackTypeChange}
        measurementControls={measurementControls}
        onMeasurementControlsChange={onMeasurementControlsChange}
        standards={standards}
        canEdit={editingStates.info || !editingStates.info}
        setHasUnsavedChanges={setHasUnsavedChanges}
        isNew={isNew}
        isEditMode={editingStates.info}
        onEdit={() => handleCardEdit('info')}
        onSave={() => handleCardSave('info')}
        onCancel={() => handleCardCancel('info')}
        showEditControls={true}
        autoGeneratedName={true}
      />

      {/* Visuals and Construction - with independent edit controls */}
      <SubstrateConditionVisuals
        condition={condition}
        onConditionChange={onConditionChange}
        canEdit={editingStates.construction || !editingStates.construction}
        isNew={isNew}
        onNameChange={handleNameChange}
        onPackTypeChange={onPackTypeChange}
        onMeasurementControlsChange={onMeasurementControlsChange}
        measurementControls={measurementControls}
        standards={standards}
        allSubstrates={allSubstrates}
        parentSubstrate={parentSubstrate}
        constructionDetails={constructionDetails}
        onConstructionDetailsChange={setConstructionDetails}
        setHasUnsavedChanges={setHasUnsavedChanges}
        lockWhiteUndercoat={true}
        isEditMode={editingStates.construction}
        onEdit={() => handleCardEdit('construction')}
        onSave={() => handleCardSave('construction')}
        onCancel={() => handleCardCancel('construction')}
        showEditControls={true}
      />
    </div>
  );
};

export default SubstrateConditionFormTab;