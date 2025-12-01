import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSubstratesData } from '@/context/SubstrateContext';
import CardHeader from '@/components/admin/my-company/CardHeader';
import { generateInkConditionName } from '@/lib/inkConditionNameGenerator';
import { supabase } from '@/integrations/supabase/client';

const InkConditionInfoPanel = ({
  condition,
  onConditionChange,
  canEdit,
  showEditControls,
  isNew,
  substrateMismatchChoice, 
  substrateNameFilled, 
  substrateConditionNameFilled,
  // Edit control props
  isEditMode = false,
  onEdit = null,
  onSave = null,
  onCancel = null,
  saving = false,
  // Creation mode and tab switching props
  onCreationModeChange = null,
  onRequestActiveTab = null,
  onValidationChange = null,
  creatingNewSubstrate = false,
  creatingNewSubstrateCondition = false
}) => {

  const { substrates, loading: substratesLoading } = useSubstratesData();



  // Local state for debounced input
  const [localName, setLocalName] = useState(condition?.name || '');
  const [isManuallyEdited, setIsManuallyEdited] = useState(false);
  
  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState({
    name: condition?.name || '',
    version: condition?.version || '',
    substrate_condition: condition?.substrate_condition || '',
    ink_curve: condition?.ink_curve || 'as_measured'
  });

  // Update local state when condition prop changes (e.g., when loading data)
  useEffect(() => {
    setLocalName(condition?.name || '');
    // Reset manual edit flag for new conditions or when name is empty
    if (!condition?.name || condition?.name === '') {
      setIsManuallyEdited(false);
    }
    
    // Update original values when condition changes (new data loaded)
    if (condition && !isEditMode) {
      setOriginalValues({
        name: condition.name || '',
        version: condition.version || '',
        substrate_condition: condition.substrate_condition || '',
        ink_curve: condition.ink_curve || 'as_measured'
      });
    }
  }, [condition?.name, condition?.version, condition?.substrate_condition, condition?.ink_curve, isEditMode]);

  // Use shared name generation utility - build substrate array directly from substrates
  const buildSubstratesArray = () => {
    if (!Array.isArray(substrates)) return [];
    return substrates.map(s => ({
      id: s.id,
      name: s.name,
      conditions: (s.conditions || []).map(c => ({
        id: c.id,
        // match.name should be substrate name; match.condition should be condition name
        name: s.name,
        condition: c.name,
        displayName: `${s.name} - ${c.name}`
      }))
    }));
  };
  // Auto-generate name when substrate condition, ink curve, or version changes (field is always read-only)
  useEffect(() => {
    if (Array.isArray(substrates) && substrates.length > 0) {
      const substratesArray = buildSubstratesArray();
      const generatedName = generateInkConditionName(
        condition?.substrate_condition, 
        condition?.ink_curve || 'as_measured',
        condition?.version,
        substratesArray
      );
      if (generatedName && generatedName !== localName) {
        setLocalName(generatedName);
      }
    }
  }, [condition?.substrate_condition, condition?.ink_curve, condition?.version, substrates, localName]);

  // Debounce the updates to the main state
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localName !== (condition?.name || '')) {
        onConditionChange('name', localName);
      }
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [localName, condition?.name, onConditionChange]);

  // Create substrate/condition combinations from real data
  const substrateOptions = React.useMemo(() => {
    
    const options = [];
    substrates.forEach(substrate => {
      if (substrate.conditions && substrate.conditions.length > 0) {
        substrate.conditions.forEach(substrateCondition => {
          options.push({
            id: `${substrate.id}_${substrateCondition.id}`,
            substrateId: substrate.id,
            conditionId: substrateCondition.id,
            name: substrate.name,
            condition: substrateCondition.name,
            displayName: `${substrate.name} - ${substrateCondition.name}`
          });
        });
      } else {
        // If substrate has no conditions, show it without condition
        options.push({
          id: substrate.id,
          substrateId: substrate.id,
          conditionId: null,
          name: substrate.name,
          condition: null,
          displayName: substrate.name
        });
      }
    });
    
    return options;
  }, [substrates, substratesLoading]);

  // Local selection state for splitting Substrate and Substrate Condition
  // Initialize with empty state and let useEffect handle proper initialization
  const [selectedSubstrateId, setSelectedSubstrateId] = useState('');
  const [localSubstrateConditionId, setLocalSubstrateConditionId] = useState('');
  // Fallback conditions fetched directly if context lacks them
  const [fetchedSubstrateConditions, setFetchedSubstrateConditions] = useState([]);
  
  // Track explicit "Create new" selections for stickiness
  const [hasSelectedCreateNewSubstrate, setHasSelectedCreateNewSubstrate] = useState(false);
  const [hasSelectedCreateNewSubstrateCondition, setHasSelectedCreateNewSubstrateCondition] = useState(false);
  
  // Auto-set substrate condition to "create_new" when substrate is "create_new"
  useEffect(() => {
    if (selectedSubstrateId === 'create_new' && localSubstrateConditionId !== 'create_new') {
      setLocalSubstrateConditionId('create_new');
    }
  }, [selectedSubstrateId, localSubstrateConditionId]);
  
  // Determine if we should hide the substrate condition field entirely
  const hideSubstrateConditionField = selectedSubstrateId === 'create_new';

  // Debug visibility
  useEffect(() => {
    console.log('[InkConditionInfoPanel] visibility', { selectedSubstrateId, hideSubstrateConditionField });
  }, [selectedSubstrateId, hideSubstrateConditionField]);

  // Initialize/update selected substrate from current condition data
  useEffect(() => {
    // Handle creation mode flags first
    if (condition?._creatingNewSubstrate || creatingNewSubstrate) {
      setSelectedSubstrateId('create_new');
      setHasSelectedCreateNewSubstrate(true);
      return;
    }
    
    // For existing conditions, initialize from substrate_id if available
    if (condition?.substrate_id && !hasSelectedCreateNewSubstrate) {
      console.log('🔄 Setting selectedSubstrateId from condition.substrate_id:', condition.substrate_id);
      setSelectedSubstrateId(condition.substrate_id);
      return;
    }
    
    // Fallback: find substrate from substrate_condition if substrate_id is missing and substrates are loaded
    if (condition?.substrate_condition && substrates?.length && !hasSelectedCreateNewSubstrate) {
      const containingSubstrate = substrates.find(s => 
        (s.conditions || []).some(c => String(c.id) === String(condition.substrate_condition))
      );
      if (containingSubstrate) {
        console.log('🔄 Setting selectedSubstrateId from substrate_condition lookup:', containingSubstrate.id);
        setSelectedSubstrateId(containingSubstrate.id);
      }
    }
  }, [condition?.substrate_id, condition?.substrate_condition, condition?._creatingNewSubstrate, creatingNewSubstrate, substrates, hasSelectedCreateNewSubstrate]);

  // Sync local substrate condition when prop changes
  useEffect(() => {
    // Handle creation mode flags first
    if (condition?._creatingNewSubstrateCondition || creatingNewSubstrateCondition) {
      setLocalSubstrateConditionId('create_new');
      setHasSelectedCreateNewSubstrateCondition(true);
      return;
    }
    
    // For existing conditions, initialize from substrate_condition
    if (condition?.substrate_condition && !hasSelectedCreateNewSubstrateCondition) {
      console.log('🔄 Setting localSubstrateConditionId from condition.substrate_condition:', condition.substrate_condition);
      setLocalSubstrateConditionId(String(condition.substrate_condition));
    }
  }, [condition?.substrate_condition, condition?._creatingNewSubstrateCondition, creatingNewSubstrateCondition, hasSelectedCreateNewSubstrateCondition]);


  // Reset sticky flags when creation mode flags are cleared (after successful save)
  useEffect(() => {
    if (!condition?._creatingNewSubstrate && !creatingNewSubstrate && hasSelectedCreateNewSubstrate) {
      setHasSelectedCreateNewSubstrate(false);
    }
    if (!condition?._creatingNewSubstrateCondition && !creatingNewSubstrateCondition && hasSelectedCreateNewSubstrateCondition) {
      setHasSelectedCreateNewSubstrateCondition(false);
    }
  }, [condition?._creatingNewSubstrate, condition?._creatingNewSubstrateCondition, creatingNewSubstrate, creatingNewSubstrateCondition, hasSelectedCreateNewSubstrate, hasSelectedCreateNewSubstrateCondition]);

  // Track validation state and notify parent
  useEffect(() => {
    // Consider both actual selections and "create_new" as valid, empty as invalid
    const isValid = (selectedSubstrateId && selectedSubstrateId !== '') && 
                   (localSubstrateConditionId && localSubstrateConditionId !== '');
    if (onValidationChange) {
      onValidationChange(isValid);
    }
  }, [selectedSubstrateId, localSubstrateConditionId, onValidationChange]);

  // Substrate list for the first dropdown
  const substrateList = React.useMemo(() => {
    const options = [
      { id: 'create_new', name: 'Create new', isCreateNew: true }
    ];
    options.push(...substrates.map(s => ({ id: s.id, name: s.name })));
    return options;
  }, [substrates]);

  // Ensure conditions are available even if context didn't include nested rows
  useEffect(() => {
    const loadConditions = async () => {
      setFetchedSubstrateConditions([]);
      if (!selectedSubstrateId || selectedSubstrateId === 'create_new') return;
      const s = substrates.find(s => String(s.id) === String(selectedSubstrateId));
      if (s?.conditions && s.conditions.length > 0) {
        setFetchedSubstrateConditions(s.conditions);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('substrate_conditions')
          .select('id, name, substrate_id')
          .eq('substrate_id', selectedSubstrateId)
          .order('name');
        if (!error && Array.isArray(data)) {
          setFetchedSubstrateConditions(
            data.map(c => ({ id: c.id, name: c.name, displayName: c.name }))
          );
        } else if (error) {
          console.warn('Failed to load substrate conditions for substrate', selectedSubstrateId, error);
        }
      } catch (e) {
        console.warn('Exception loading substrate conditions', e);
      }
    };
    loadConditions();
  }, [selectedSubstrateId, substrates]);

  // Substrate condition list for the selected substrate
  const substrateConditionList = React.useMemo(() => {
    console.log('🔍 [SubstrateConditionList] Computing list:', {
      selectedSubstrateId,
      substratesLength: substrates?.length || 0,
      substrates: substrates?.map(s => ({ id: s.id, name: s.name, conditionsCount: s.conditions?.length || 0 }))
    });

    const options = [
      { id: 'create_new', name: 'Create new', displayName: 'Create new', isCreateNew: true }
    ];
    
    // If substrate is "Create new", only show "Create new" option for condition
    if (selectedSubstrateId === 'create_new') {
      console.log('🔍 [SubstrateConditionList] Create new selected, returning only create option');
      return options;
    }
    
    // For existing substrates, add their conditions
    if (selectedSubstrateId) {
      const s = substrates.find(s => s.id === selectedSubstrateId);
      console.log('🔍 [SubstrateConditionList] Found substrate:', {
        selectedSubstrateId,
        foundSubstrate: s ? { id: s.id, name: s.name, conditionsCount: s.conditions?.length || 0 } : null,
        conditions: s?.conditions?.map(c => ({ id: c.id, name: c.name })) || [],
        fetchedFallbackCount: fetchedSubstrateConditions.length
      });
      const sourceConditions = (s?.conditions && s.conditions.length > 0)
        ? s.conditions
        : fetchedSubstrateConditions;
      if (sourceConditions?.length) {
        options.push(...sourceConditions);
      }
    }
    
    console.log('🔍 [SubstrateConditionList] Final options:', options.map(o => ({ id: o.id, name: o.name, displayName: o.displayName })));
    return options;
  }, [substrates, selectedSubstrateId]);

  // Resolved display names for read-only mode to avoid 'Not selected/Not found' when data is still syncing
  const resolvedSubstrateName = React.useMemo(() => {
    if (substratesLoading) return null;
    if (selectedSubstrateId && selectedSubstrateId !== 'create_new') {
      return substrates.find(s => String(s.id) === String(selectedSubstrateId))?.name || null;
    }
    if (condition?.substrate_id) {
      return substrates.find(s => String(s.id) === String(condition.substrate_id))?.name || null;
    }
    if (condition?.substrate_condition) {
      const found = substrates.find(s => (s.conditions || []).some(c => String(c.id) === String(condition.substrate_condition)));
      return found?.name || null;
    }
    if (condition?.substrateConditionName && typeof condition.substrateConditionName === 'string') {
      const [substratePart] = condition.substrateConditionName.split(' - ');
      return substratePart || null;
    }
    return null;
  }, [selectedSubstrateId, condition?.substrate_id, condition?.substrate_condition, condition?.substrateConditionName, substrates, substratesLoading]);
  
  const resolvedSubstrateConditionName = React.useMemo(() => {
    if (substratesLoading) return null;
    const condId = localSubstrateConditionId || (condition?.substrate_condition ? String(condition.substrate_condition) : '');
    if (condId && condId !== 'create_new') {
      for (const s of substrates) {
        const cond = (s.conditions || []).find(c => String(c.id) === String(condId));
        if (cond) return cond.name;
      }
    }
    if (condition?.substrateConditionName && typeof condition.substrateConditionName === 'string') {
      const parts = condition.substrateConditionName.split(' - ');
      return parts[1] || null;
    }
    return null;
  }, [localSubstrateConditionId, condition?.substrate_condition, condition?.substrateConditionName, substrates, substratesLoading]);
  
  const inkCurveOptions = [
    { value: 'as_measured', label: 'As Measured' },
    { value: 'iso_12647', label: 'ISO 12647-2' },
    { value: 'custom_curve', label: 'Custom Curve' },
  ];

  // Create a save handler that includes local state values
  const handleSaveWithLocalState = () => {
    // Pass current local state values to the save function
    if (onSave) {
      // Extract substrate ID from condition if it's a composite value
      let resolvedSubstrateId = selectedSubstrateId;
      let resolvedConditionId = localSubstrateConditionId;
      
      if (condition?.substrate_condition?.includes('_')) {
        const parts = condition.substrate_condition.split('_');
        resolvedSubstrateId = parts[0]; // First part is substrate ID
        resolvedConditionId = parts[1]; // Second part is condition ID
      } else if (!resolvedSubstrateId && condition?.substrate_condition) {
        // Try to find substrate ID from substrates data
        const foundSubstrate = substrates?.find(s => 
          s.conditions?.some(c => c.id === condition.substrate_condition)
        );
        if (foundSubstrate) {
          resolvedSubstrateId = foundSubstrate.id;
        }
      }
      
      onSave({
        selectedSubstrateId: resolvedSubstrateId,
        localSubstrateConditionId: resolvedConditionId,
        localName
      });
    }
  };

  return (
    <Card>
      <CardHeader
        title="Ink Condition Settings"
        onEdit={onEdit}
        onSave={handleSaveWithLocalState}
        onCancel={onCancel}
        showEdit={!isNew && showEditControls}
        showLearn={false}
        isEditing={isEditMode}
        canSave={
          (condition?.version || '') !== originalValues.version ||
          (condition?.substrate_condition || '') !== originalValues.substrate_condition ||
          (condition?.ink_curve || 'as_measured') !== originalValues.ink_curve ||
          (selectedSubstrateId && selectedSubstrateId !== '' && localSubstrateConditionId && localSubstrateConditionId !== '')
        }
        editDisabled={!canEdit}
        editTooltip={!canEdit ? 'You do not have permission to edit this ink condition' : null}
        saving={saving}
        className="px-6 pt-6 pb-2"
      />
      <CardContent className="pt-0">
        {/* First row: Condition Name and Version */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2">
              <Label htmlFor="condition_name">Ink Condition Name</Label>
              <Input
                id="condition_name"
                value={localName}
                onChange={() => {}} // Read-only field
                placeholder="Auto-generated from selections below"
                disabled={true} // Always disabled for all users
                className="bg-muted text-muted-foreground"
              />
            </div>
          
          <div className="lg:col-span-1">
            <Label htmlFor="version">Version</Label>
            <Input
              id="version"
              value={condition?.version || ''}
              onChange={(e) => onConditionChange('version', e.target.value)}
              placeholder="1.0"
              disabled={!canEdit || !isEditMode}
            />
          </div>
        </div>

        {/* Second row: Substrate, Substrate Condition, and Ink Curve */}
        <div className={`grid grid-cols-1 gap-4 ${hideSubstrateConditionField ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>

          {/* Substrate */}
          <div>
            <Label htmlFor="substrate">
              Substrate
              {(!selectedSubstrateId || selectedSubstrateId === '') && isEditMode && (
                <span className="text-sm text-red-500 ml-1">(required)</span>
              )}
            </Label>
            {!isEditMode ? (
              <Input
                value={
                  selectedSubstrateId === 'create_new'
                    ? 'Create new'
                    : (resolvedSubstrateName ?? (substratesLoading ? 'Loading substrates...' : 'Not selected'))
                }
                disabled={true}
                className="bg-muted text-muted-foreground"
              />
            ) : (
              <Select
                value={selectedSubstrateId || ''}
                onValueChange={(value) => {
                  setSelectedSubstrateId(value);
                  
                  if (value === 'create_new') {
                    // Auto-set substrate condition to "Create new" and mark sticky selections
                    setLocalSubstrateConditionId('create_new');
                    setHasSelectedCreateNewSubstrate(true);
                    setHasSelectedCreateNewSubstrateCondition(true);
                    onConditionChange('substrate_condition', '');
                    onConditionChange('_creatingNewSubstrate', true);
                    onConditionChange('_creatingNewSubstrateCondition', true);
                    
                    // Call callbacks to update page state and switch to substrate tab
                    if (onCreationModeChange) {
                      onCreationModeChange({ 
                        creatingNewSubstrate: true, 
                        creatingNewSubstrateCondition: true 
                      });
                    }
                    if (onRequestActiveTab) {
                      onRequestActiveTab('substrate');
                    }
                  } else {
                    // Existing substrate selected - clear substrate condition and reset sticky flags
                    setLocalSubstrateConditionId('');
                    setHasSelectedCreateNewSubstrate(false);
                    setHasSelectedCreateNewSubstrateCondition(false);
                    onConditionChange('substrate_condition', '');
                    onConditionChange('_creatingNewSubstrate', false);
                    onConditionChange('_creatingNewSubstrateCondition', false);
                    
                    if (onCreationModeChange) {
                      onCreationModeChange({ 
                        creatingNewSubstrate: false, 
                        creatingNewSubstrateCondition: false 
                      });
                    }
                  }
                }}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      substratesLoading ? 'Loading substrates...' : 'Select substrate'
                    }
                  />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-lg z-[9999] pointer-events-auto">
                  {substratesLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : substrateList.length === 0 ? (
                    <SelectItem value="no-substrates" disabled>No substrates available</SelectItem>
                  ) : (
                    substrateList.map((s) => (
                      <SelectItem 
                        key={s.id} 
                        value={String(s.id)}
                        className={s.isCreateNew ? "italic text-gray-600" : ""}
                      >
                        {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Substrate Condition */}
          <div className={hideSubstrateConditionField ? 'hidden' : ''}>
            <Label htmlFor="substrate_condition">
              Substrate Condition
              {(!localSubstrateConditionId || localSubstrateConditionId === '') && isEditMode && (
                <span className="text-sm text-red-500 ml-1">(required)</span>
              )}
            </Label>
            {!isEditMode ? (
              <Input
                value={
                  localSubstrateConditionId === 'create_new'
                    ? 'Create new'
                    : (resolvedSubstrateConditionName ?? (substratesLoading ? 'Loading conditions...' : (!selectedSubstrateId ? 'Select substrate first' : 'Not found')))
                }
                disabled={true}
                className="bg-muted text-muted-foreground"
              />
            ) : (
              <Select
                value={localSubstrateConditionId}
                onValueChange={(value) => {
                  setLocalSubstrateConditionId(value);
                  if (value === 'create_new') {
                    setHasSelectedCreateNewSubstrateCondition(true);
                    // Also set substrate to "create_new" if not already
                    if (selectedSubstrateId !== 'create_new') {
                      setSelectedSubstrateId('create_new');
                      setHasSelectedCreateNewSubstrate(true);
                      onConditionChange('_creatingNewSubstrate', true);
                    }
                    onConditionChange('substrate_condition', '');
                    onConditionChange('_creatingNewSubstrateCondition', true);
                    
                    // Call callbacks to update page state and switch to substrate condition tab
                    if (onCreationModeChange) {
                      onCreationModeChange({ 
                        creatingNewSubstrate: true, 
                        creatingNewSubstrateCondition: true 
                      });
                    }
                    if (onRequestActiveTab) {
                      onRequestActiveTab('substrate-condition');
                    }
                  } else {
                    setHasSelectedCreateNewSubstrateCondition(false);
                    onConditionChange('substrate_condition', value);
                    onConditionChange('_creatingNewSubstrateCondition', false);
                    
                    if (onCreationModeChange) {
                      onCreationModeChange({ 
                        creatingNewSubstrate: false, 
                        creatingNewSubstrateCondition: false 
                      });
                    }
                  }
                }}
                disabled={!canEdit || !selectedSubstrateId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !selectedSubstrateId 
                        ? 'Select substrate first' 
                        : 'Select substrate condition'
                    }
                  />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-lg z-[9999] pointer-events-auto">
                  {!selectedSubstrateId ? (
                    <SelectItem value="no-substrate" disabled>Select substrate first</SelectItem>
                  ) : substrateConditionList.length === 0 ? (
                    <SelectItem value="no-conditions" disabled>No conditions available</SelectItem>
                  ) : (
                    substrateConditionList.map((c) => (
                      <SelectItem 
                        key={c.id} 
                        value={String(c.id)}
                        className={c.isCreateNew ? "italic text-gray-600" : ""}
                      >
                        {c.displayName || c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>


          {/* Ink Curve */}
          <div>
            <Label htmlFor="ink_curve">Ink Curve</Label>
            {!isEditMode ? (
              <Input
                value={inkCurveOptions.find(opt => opt.value === (condition?.ink_curve || 'as_measured'))?.label || 'As Measured'}
                disabled={true}
                className="bg-muted text-muted-foreground"
              />
            ) : (
              <Select
                value={condition?.ink_curve || 'as_measured'}
                onValueChange={(value) => onConditionChange('ink_curve', value)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ink curve" />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-lg z-[9999] pointer-events-auto">
                  {inkCurveOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InkConditionInfoPanel;