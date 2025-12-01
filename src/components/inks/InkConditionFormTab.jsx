import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/context/ProfileContext';
import InkConditionVisuals from '@/components/inks/InkConditionVisuals';
import ColorSettingsBox from '@/components/ColorSettingsBox';
import { normalizeTints, getTintPercentage, ensureTintsArrayForDB, safeSpectralData } from '@/lib/tintsUtils';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { calculateInkConditionColorHex } from '@/lib/colorUtils/inkConditionColorHex';
import { adaptTintsToSubstrate } from '@/lib/colorUtils/tintAdaptation';
import { debugAdaptation } from '@/utils/debugAdaptation';
import { createSubstrateConditionFromTints as createSubstrateConditionFromTintsUtil } from '@/lib/substrateConditionFromTints';

const InkConditionFormTab = ({ 
  inkId, 
  conditionId, 
  cxfData, 
  onConditionSaved,
  onCreationModeChange,
  onRequestActiveTab,
  onValidationChange,
  creatingNewSubstrate = false,
  creatingNewSubstrateCondition = false,
  newSubstrateIdToSelect = null,
  activeDataMode = null
}) => {
  const { profile } = useProfile();
  const [condition, setCondition] = useState(null);
  const [ink, setInk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPrintCondition, setSelectedPrintCondition] = useState(null);
  
  // Stabilize print condition callback to prevent hook instability
  const handleSelectedPrintConditionChange = React.useCallback((printCondition) => {
    setSelectedPrintCondition(printCondition);
  }, []);
  
  const createSubstrateConditionFromTints = React.useCallback(async (inkConditionId, substrateId, organizationId) => {
    setIsCreating(true);
    try {
      return await createSubstrateConditionFromTintsUtil(inkConditionId, substrateId, organizationId);
    } finally {
      setIsCreating(false);
    }
  }, []);
  const autoCreateRunRef = useRef(new Set());
  
  // Wedge selection state
  const [selectedWedge, setSelectedWedge] = useState(0);
  const [wedgeData, setWedgeData] = useState([]);
  const [localActiveDataMode, setLocalActiveDataMode] = useState(null); // Will be initialized based on condition data
  const [availableModes, setAvailableModes] = useState([]);

  // Initialize measurement controls with organization defaults
  const [measurementControls, setMeasurementControls] = useState({
    mode: 'M1',
    illuminant: 'D50',
    observer: '2',
    table: '5',
    deltaE: 'dE00'
  });

  // Get ASTM data for standards
  const { astmTables, loading: astmLoading } = useAstmTablesCache();
  
  // Get organization defaults and available illuminants/observers
  useEffect(() => {
    const fetchOrgData = async () => {
      if (!profile?.organization_id) return;
      
      try {
        const [orgResponse, illuminantsResponse, observersResponse] = await Promise.all([
          supabase
            .from('organizations')
            .select('*')
            .eq('id', profile.organization_id)
            .single(),
          supabase
            .from('illuminants')
            .select('*')
            .order('name'),
          supabase
            .from('observers')
            .select('*')
            .order('name')
        ]);

        if (orgResponse.data) {
          setOrganization(orgResponse.data);
          
          // Update measurement controls with org defaults
          setMeasurementControls(prev => ({
            mode: orgResponse.data.default_measurement_mode || prev.mode,
            illuminant: orgResponse.data.default_illuminant || prev.illuminant,
            observer: orgResponse.data.default_observer || prev.observer,
            table: orgResponse.data.default_astm_table || prev.table,
            deltaE: orgResponse.data.default_delta_e || prev.deltaE
          }));
        }

        // Store illuminants and observers for standards
        if (illuminantsResponse.data && observersResponse.data) {
          setStandardsData({
            illuminants: illuminantsResponse.data,
            observers: observersResponse.data
          });
        }
      } catch (error) {
        console.error('Error fetching organization data:', error);
      }
    };

    fetchOrgData();
  }, [profile?.organization_id]);

  const [standardsData, setStandardsData] = useState({ illuminants: [], observers: [] });
  
  // Load debug utilities
  useEffect(() => {
    debugAdaptation();
  }, []);
  
  // Create standards object for ColorSettingsBox and InkConditionVisuals
  const standards = useMemo(() => ({
    astmTables,
    illuminants: standardsData.illuminants,
    observers: standardsData.observers,
    loading: astmLoading
  }), [astmTables, standardsData, astmLoading]);


  // Fetch the condition and ink data with refresh capability
  const fetchData = async () => {
    if (!conditionId || !inkId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch the ink condition
      const { data: conditionData, error: conditionError } = await supabase
        .from('ink_conditions')
        .select('*')
        .eq('id', conditionId)
        .single();

      if (conditionError) {
        console.error('Error fetching condition:', conditionError);
        toast.error('Failed to load condition data');
        return;
      }

      // Fetch the ink
      const { data: inkData, error: inkError } = await supabase
        .from('inks')
        .select('*')
        .eq('id', inkId)
        .single();

      if (inkError) {
        console.error('Error fetching ink:', inkError);
        toast.error('Failed to load ink data');
        return;
      }

      // Coerce adapted_tints and imported_tints to arrays in memory
      const coercedAdapted = normalizeTints(conditionData.adapted_tints);
      const coercedImported = normalizeTints(conditionData.imported_tints);
      
      // Enrich condition with substrate data if available
      let enrichedCondition = {
        ...conditionData,
        adapted_tints: coercedAdapted,
        imported_tints: coercedImported
      };
      if (conditionData.substrate_condition) {
        try {
          // Try by ID first, fallback to name for compatibility
          let substrateData = null;
          let substrateError = null;
          
          // Check if substrate_condition is a UUID
          const isUUID = conditionData.substrate_condition.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
          
          if (isUUID) {
            const { data, error } = await supabase
              .from('substrate_conditions')
              .select('spectral_data, lab, ch, color_hex, id, name')
              .eq('id', conditionData.substrate_condition)
              .single();
            substrateData = data;
            substrateError = error;
          } else {
            // Fallback to name-based lookup for compatibility
            const { data, error } = await supabase
              .from('substrate_conditions')
              .select('spectral_data, lab, ch, color_hex, id, name')
              .eq('name', conditionData.substrate_condition)
              .single();
            substrateData = data;
            substrateError = error;
          }
          
          if (substrateData && !substrateError) {
            enrichedCondition = {
              ...enrichedCondition,
              substrate_spectral_data: substrateData.spectral_data,
              substrate_lab: substrateData.lab,
              substrate_ch: substrateData.ch,
              substrate_color_hex: substrateData.color_hex,
              substrate_condition_id: substrateData.id,
              substrate_condition_name: substrateData.name
            };
          }
        } catch (err) {
          console.warn('Failed to fetch substrate condition data:', err);
        }
      }

      setCondition(enrichedCondition);
      setInk(inkData);
      
      // Initialize localActiveDataMode based on condition data and saved preferences
      if (localActiveDataMode === null) {
        // Prioritize saved data mode preferences
        const savedDataMode = enrichedCondition.ui_state?.active_data_mode || 
                             enrichedCondition.measurement_settings?.preferred_data_mode;
        
        if (savedDataMode) {
          console.log('🎯 Using saved data mode:', savedDataMode);
          setLocalActiveDataMode(savedDataMode);
        } else {
          // Fallback to determining mode based on available data
          const hasSubstrateCondition = !!enrichedCondition.substrate_condition;
          const hasAdaptedTints = coercedAdapted.length > 0;
          const hasSpectralData = enrichedCondition.spectral_data && Object.keys(enrichedCondition.spectral_data).length > 0;
          
          const initialMode = (hasSubstrateCondition && hasAdaptedTints) || hasSpectralData ? 'adapted' : 'imported';
          console.log('🎯 Initializing localActiveDataMode:', {
            mode: initialMode,
            hasSubstrateCondition,
            hasAdaptedTints,
            hasSpectralData,
            conditionId: enrichedCondition.id
          });
          setLocalActiveDataMode(initialMode);
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [conditionId, inkId]);

  // Handle new substrate selection
  useEffect(() => {
    if (!newSubstrateIdToSelect) return;
    
    const enrichWithSubstrateData = async () => {
      try {
        const { data: substrateData, error: substrateError } = await supabase
          .from('substrate_conditions')
          .select('spectral_data, lab, ch, color_hex')
          .eq('id', newSubstrateIdToSelect)
          .single();
        
        setCondition(prev => {
          if (!prev) return prev;
          const alreadySet = prev.substrate_condition === newSubstrateIdToSelect && prev._creatingNewSubstrate === false;
          if (alreadySet) return prev;
          
          let updatedCondition = {
            ...prev,
            substrate_condition: newSubstrateIdToSelect,
            _creatingNewSubstrate: false
          };
          
          if (substrateData && !substrateError) {
            updatedCondition = {
              ...updatedCondition,
              substrate_spectral_data: substrateData.spectral_data,
              substrate_lab: substrateData.lab,
              substrate_ch: substrateData.ch,
              substrate_color_hex: substrateData.color_hex,
              substrate_condition_id: substrateData.id,
              substrate_condition_name: substrateData.name
            };
          }
          
          return updatedCondition;
        });
      } catch (err) {
        console.warn('Failed to fetch substrate condition data for new selection:', err);
        setCondition(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            substrate_condition: newSubstrateIdToSelect,
            _creatingNewSubstrate: false
          };
        });
      }
    };
    
    enrichWithSubstrateData();
  }, [newSubstrateIdToSelect]);

  // Auto-create substrate condition from imported tints if missing (idempotent)
  useEffect(() => {
    console.count('[AutoCreate] effect run');
    const run = async () => {
      const condId = condition?.id;
      if (!condId || !profile?.organization_id || isCreating) return;

      // Prevent re-running after success for this condition
      if (autoCreateRunRef.current.has(condId)) return;

      const hasSubstrateCondition = !!condition.substrate_condition;
      const normalizedTints = normalizeTints(condition.imported_tints);
      const hasImportedTints = normalizedTints.length > 0;
      const isCreatingNewSubstrateCondition = !!condition._creatingNewSubstrateCondition;

      // Look for 0% tint with spectral data
      const zeroPercentTint = hasImportedTints ?
        normalizedTints.find(tint => {
          return getTintPercentage(tint) === 0 && (tint.spectral_data || tint.spectralData);
        }) : null;

      console.log('Auto-create substrate condition check:', {
        hasSubstrateCondition,
        hasImportedTints,
        hasZeroPercentTint: !!zeroPercentTint,
        isCreatingNewSubstrateCondition,
        conditionId: condId
      });

      // If already has substrate condition, mark as done and exit
      if (hasSubstrateCondition) {
        autoCreateRunRef.current.add(condId);
        return;
      }

      // Only auto-create when user selected "Create new" substrate condition
      if (!isCreatingNewSubstrateCondition) {
        console.log('Skipping auto-creation: user has not selected "Create new" substrate condition');
        return;
      }

      if (!hasImportedTints || !zeroPercentTint) return; // wait for data

      try {
        console.log('Creating substrate condition from imported tints automatically...');

        // Fetch available substrates to link
        const { data: substrates, error: substrateError } = await supabase
          .from('substrates')
          .select('id, name')
          .eq('organization_id', profile.organization_id)
          .order('name');

        if (substrateError) {
          console.error('Error fetching substrates:', substrateError);
          return;
        }

        const targetSubstrate = substrates.find(s => s.name === 'C1S Paper') || substrates[0];
        if (!targetSubstrate) {
          console.log('No substrate found to link substrate condition to');
          return;
        }

        console.log('Using substrate for condition creation:', targetSubstrate);

        const newSubstrateConditionId = await createSubstrateConditionFromTints(
          condId,
          targetSubstrate.id,
          profile.organization_id
        );

        console.log('Created substrate condition:', newSubstrateConditionId);

        if (newSubstrateConditionId) {
          // Optimistically update local state to avoid refetch loops
          setCondition(prev => prev ? { ...prev, substrate_condition: newSubstrateConditionId } : prev);
          autoCreateRunRef.current.add(condId);

          // Post-creation reconciliation: if substrate condition lacks 0% tint, extract and update it
          try {
            const { data: substrateConditionData, error: scError } = await supabase
              .from('substrate_conditions')
              .select('imported_tints')
              .eq('id', newSubstrateConditionId)
              .single();

            if (!scError && substrateConditionData && Array.isArray(substrateConditionData.imported_tints) && substrateConditionData.imported_tints.length === 0) {
              console.log('🔄 Substrate condition created but missing 0% tint, reconciling...');
              
              // Find 0% tint from ink condition's imported_tints
              const zeroTint = normalizedTints.find(tint => getTintPercentage(tint) === 0);
              if (zeroTint) {
                console.log('Found 0% tint for reconciliation:', zeroTint);
                await supabase
                  .from('substrate_conditions')
                  .update({ imported_tints: [zeroTint] })
                  .eq('id', newSubstrateConditionId);
                console.log('✅ Reconciled substrate condition with 0% tint');
              }
            }
          } catch (e) {
            console.warn('Post-creation reconciliation failed (non-fatal):', e);
          }

          // Update the ink condition name now that a substrate is linked
          try {
            console.log('🔄 Calling update_ink_condition_name_auto after substrate link');
            const { data: updatedName, error: nameUpdateError } = await supabase.rpc('update_ink_condition_name_auto', { p_condition_id: condId });
            if (nameUpdateError) {
              console.warn('Auto-name update after substrate link failed:', nameUpdateError);
            } else {
              console.log('✅ Auto-name updated to:', updatedName);
              await fetchData();
            }
          } catch (e) {
            console.warn('Name auto-update skipped/failed after substrate link:', e);
          }
        }
      } catch (error) {
        console.error('Failed to auto-create substrate condition:', error);
        // Silent failure as this is automatic
      }
    };

    run();
  }, [condition?.id, condition?.substrate_condition, condition?.imported_tints, condition?._creatingNewSubstrateCondition, profile?.organization_id, isCreating]);

  // Auto-compute adapted_tints when substrate data and imported tints are available
  useEffect(() => {
    const computeAdaptedTints = async () => {
      if (!condition?.substrate_spectral_data || 
          !condition?.imported_tints || 
          !astmTables?.length ||
          condition.adapted_tints?.length > 0) { // Don't recompute if already exists
        return;
      }

      console.log('🔄 Computing adapted_tints automatically...');
      
      try {
        const normalizedImportedTints = normalizeTints(condition.imported_tints);
        const zeroTint = normalizedImportedTints.find(t => getTintPercentage(t) === 0);
        const importedSubstrateSpectral = safeSpectralData(zeroTint) || {};
        const targetSubstrateSpectral = condition.substrate_spectral_data;
        
        const adaptedTints = adaptTintsToSubstrate(
          normalizedImportedTints,
          importedSubstrateSpectral,
          targetSubstrateSpectral,
          {
            astmTables,
            measurementControls: measurementControls || {
              illuminant: 'D50',
              observer: '2',
              table: '5'
            }
          }
        );
        
        if (adaptedTints && adaptedTints.length > 0) {
          setCondition(prev => ({
            ...prev,
            adapted_tints: adaptedTints
          }));
          console.log('✅ Successfully computed adapted_tints:', adaptedTints.length, 'tints');
        }
      } catch (error) {
        console.error('❌ Failed to compute adapted_tints:', error);
      }
    };

    computeAdaptedTints();
  }, [
    condition?.substrate_spectral_data, 
    condition?.imported_tints, 
    condition?.adapted_tints?.length,
    astmTables, 
    measurementControls
  ]);

  // Helper function to detect single-tint import conditions
  const isSingleTintImport = (condition) => {
    if (!condition) return false;
    
    // Has spectral_data but no imported_tints or adapted_tints arrays
    const hasSpectralData = condition.spectral_data && typeof condition.spectral_data === 'object';
    const hasImportedTints = condition.imported_tints && Array.isArray(condition.imported_tints) && condition.imported_tints.length > 0;
    const hasAdaptedTints = condition.adapted_tints && Array.isArray(condition.adapted_tints) && condition.adapted_tints.length > 0;
    
    return hasSpectralData && !hasImportedTints && !hasAdaptedTints;
  };

  const handleConditionChange = async (field, value) => {
    setCondition(prev => ({ ...prev, [field]: value }));
    
    // Sync measurement_settings.preferred_data_mode to localActiveDataMode
    if (field === 'measurement_settings' && value?.preferred_data_mode) {
      console.log('🔄 Syncing preferred_data_mode from measurement_settings to localActiveDataMode:', value.preferred_data_mode);
      setLocalActiveDataMode(value.preferred_data_mode);
    }
    
    // Handle substrate condition selection changes - update localActiveDataMode
    if (field === 'substrate_condition') {
      if (value && value !== 'create_new' && value !== '') {
        // For single-tint imports, keep imported mode even with substrate condition
        if (isSingleTintImport(condition)) {
          console.log('🎯 Keeping localActiveDataMode as "imported" for single-tint import with substrate condition:', value);
          setLocalActiveDataMode('imported');
        } else {
          // User selected an existing substrate condition -> use adapted mode
          console.log('🎯 Setting localActiveDataMode to "adapted" for existing substrate condition:', value);
          setLocalActiveDataMode('adapted');
        }
      } else if (value === 'create_new' || value === '') {
        // User selected "Create new" or cleared selection -> use imported mode
        console.log('🎯 Setting localActiveDataMode to "imported" for new/empty substrate condition:', value);
        setLocalActiveDataMode('imported');
      }
    }
    
    // Handle substrate condition selection - fetch and hydrate substrate data
    if (field === 'substrate_condition' && value && value !== 'create_new' && value !== '') {
      try {
        const { data, error } = await supabase
          .from('substrate_conditions')
          .select('lab, spectral_data, ch, color_hex')
          .eq('id', value)
          .single();
          
        if (!error && data) {
          console.log('🔧 Hydrating substrate data for mismatch detection:', data);
          setCondition(prev => ({
            ...prev,
            [field]: value,
            substrate_lab: data.lab,
            substrate_spectral_data: data.spectral_data,
            substrate_ch: data.ch,
            substrate_color_hex: data.color_hex
          }));
          return; // Early return since we already updated condition
        } else {
          console.warn('Failed to fetch substrate condition data:', error);
        }
      } catch (err) {
        console.error('Error fetching substrate condition:', err);
      }
    }
    
    // Handle special flags for creation mode and tab switching
    if (field === '_creatingNewSubstrate' || field === '_creatingNewSubstrateCondition') {
      if (onCreationModeChange) {
        const updatedCondition = { ...condition, [field]: value };
        onCreationModeChange({
          creatingNewSubstrate: updatedCondition._creatingNewSubstrate || false,
          creatingNewSubstrateCondition: updatedCondition._creatingNewSubstrateCondition || false
        });
      }
    }
    
    if (field === '_setActiveTab' && onRequestActiveTab) {
      onRequestActiveTab(value);
    }
  };

  const handleSaveCondition = async (updatedCondition = null, localStateValues = null) => {
    setSaving(true);
    try {
      // Removed backfill before saving - it was creating duplicate spectral data
      // Strict whitelist of allowed database columns
      const allowedFields = [
        'name', 'version', 'substrate_condition', 'substrate_id', 'pack_type', 'ink_curve', 
        'color_hex', 'lab', 'ch', 'spectral_data', 'measurement_settings', 'ui_state',
        'adapted_tints', 'imported_tints', 'is_part_of_structure'
      ];

      const sourceData = updatedCondition || condition;
      
      // If local state values are provided, use them to preserve substrate selections
      let finalSourceData = sourceData;
      if (localStateValues) {
        console.log('🎯 Using local state values for substrate selections:', localStateValues);
        finalSourceData = {
          ...sourceData,
          // Use the local UI state as authoritative source for substrate selections
          substrate_condition: localStateValues.localSubstrateConditionId !== 'create_new' ? 
            localStateValues.localSubstrateConditionId : sourceData.substrate_condition,
          substrate_id: localStateValues.selectedSubstrateId !== 'create_new' ? 
            localStateValues.selectedSubstrateId : sourceData.substrate_id
        };
      }
      
      // Build payload with only whitelisted fields
      const conditionToSaveRaw = {};
      allowedFields.forEach(field => {
        if (finalSourceData?.[field] !== undefined) {
          conditionToSaveRaw[field] = finalSourceData[field];
        }
      });

      // Sanitize complex JSON fields to avoid cyclic structures and UI-only keys
      const conditionToSave = { ...conditionToSaveRaw };
      if (conditionToSave.lab) conditionToSave.lab = safePlainJson(conditionToSave.lab);
      if (conditionToSave.ch) conditionToSave.ch = safePlainJson(conditionToSave.ch);
      if (conditionToSave.spectral_data) conditionToSave.spectral_data = safePlainJson(conditionToSave.spectral_data);
      if (conditionToSave.measurement_settings) conditionToSave.measurement_settings = safePlainJson(conditionToSave.measurement_settings);
      if (conditionToSave.imported_tints) conditionToSave.imported_tints = dbSafeTints(conditionToSave.imported_tints);
      if (conditionToSave.adapted_tints) conditionToSave.adapted_tints = dbSafeTints(conditionToSave.adapted_tints);
      // Final safety net: deep sanitize entire payload
      const finalPayload = safePlainJson(conditionToSave);

      // Guard: prevent overwriting imported_tints with a single 0% substrate-only tint
      if (Array.isArray(finalPayload.imported_tints)) {
        try {
          const normalizedForGuard = normalizeTints(finalPayload.imported_tints);
          if (normalizedForGuard.length === 1) {
            const t = normalizedForGuard[0] || {};
            if (getTintPercentage(t) === 0 && (t.spectral_data || t.spectralData)) {
              console.log('🛡️ Guard active: skipping imported_tints update due to single 0% tint placeholder');
              console.log('🛡️ Guard detail:', { tint: t, percentage: getTintPercentage(t) });
              delete finalPayload.imported_tints;
            }
          }
        } catch (e) {
          console.warn('Guard check for imported_tints failed (continuing):', e);
        }
      }

      // Safe logging of payload structure
      console.log('💾 Saving ink_condition payload with keys:', Object.keys(finalPayload));
      console.log('💾 Payload size (bytes):', JSON.stringify(finalPayload).length);
      if (finalPayload.imported_tints) {
        const normalizedForLogging = normalizeTints(finalPayload.imported_tints);
        console.log('💾 imported_tints being saved:', normalizedForLogging.length, 'tints, percentages:', normalizedForLogging.map(t => getTintPercentage(t)));
      }

      // Update measurement_settings and ui_state to persist data mode preferences
      finalPayload.measurement_settings = {
        ...finalPayload.measurement_settings,
        ...condition?.measurement_settings,
        illuminant: measurementControls?.illuminant,
        observer: measurementControls?.observer,
        table: measurementControls?.table,
        delta_e: measurementControls?.deltaE,
        mode: measurementControls?.mode,
        preferred_data_mode: localActiveDataMode // Persist data mode preference
      };
      
      finalPayload.ui_state = {
        ...finalPayload.ui_state,
        ...condition?.ui_state,
        active_data_mode: localActiveDataMode,
        measurement_mode: measurementControls?.mode,
        selected_wedge: selectedWedge,
        saving_timestamp: new Date().toISOString()
      };
      
      console.log('💾 Persisting data mode preferences:', {
        preferred_data_mode: localActiveDataMode,
        active_data_mode: localActiveDataMode
      });

      // Ensure imported_tints have proper measurements structure for multi-mode support
      if (finalPayload.imported_tints && finalPayload.imported_tints.tints) {
        const availableModes = condition?.measurement_settings?.available_modes || [];
        if (availableModes.length > 1) {
          console.log('🔧 Ensuring multi-mode structure for saved tints...');
          finalPayload.imported_tints.tints = finalPayload.imported_tints.tints.map(tint => {
            // If tint lacks measurements array but we have multi-mode data, create it
            if ((!tint.measurements || tint.measurements.length === 0) && tint.spectralData) {
              console.log(`📋 Creating measurements array for tint with ${availableModes.length} modes`);
              tint.measurements = availableModes.map(mode => ({
                mode: mode,
                spectral_data: tint.spectralData,
                lab: tint.lab,
                tint_percentage: tint.tintPercentage || 100
              }));
            }
            return tint;
          });
        }
      }

      // Calculate adapted_tints if needed for adapted mode (only if not already computed)
      if (localActiveDataMode === 'adapted' && 
          finalPayload.imported_tints && 
          !finalPayload.adapted_tints &&
          astmTables?.length) {
        
        console.log('🔧 Computing adapted_tints for Smart Import save');
        console.log('📊 Substrate spectral data available:', !!condition?.substrate_spectral_data);
        console.log('📊 Imported tints count:', normalizeTints(finalPayload.imported_tints).length);
        
        try {
          const normalizedImportedTints = normalizeTints(finalPayload.imported_tints);
          const importedSubstrateSpectral = normalizedImportedTints.find(t => getTintPercentage(t) === 0)?.spectral_data || {};
          
          // Try to get substrate spectral from print condition first, then fall back to direct substrate data
          let targetSubstrateSpectral = null;
          let spectralSource = 'none';
          
          if (selectedPrintCondition?.spectral_data && Object.keys(selectedPrintCondition.spectral_data).length > 0) {
            targetSubstrateSpectral = selectedPrintCondition.spectral_data;
            spectralSource = 'print_condition.spectral_data';
          } else if (selectedPrintCondition?.spectral_string) {
            try {
              targetSubstrateSpectral = JSON.parse(selectedPrintCondition.spectral_string);
              spectralSource = 'print_condition.spectral_string';
            } catch (e) {
              console.warn('Failed to parse print condition spectral_string:', e);
            }
          } else if (condition.substrate_spectral_data) {
            targetSubstrateSpectral = condition.substrate_spectral_data;
            spectralSource = 'condition.substrate_spectral_data';
          }
          
          console.log('📊 Substrate spectral resolution for adaptation:', {
            source: spectralSource,
            hasImportedSubstrate: !!importedSubstrateSpectral && Object.keys(importedSubstrateSpectral).length > 0,
            hasTargetSubstrate: !!targetSubstrateSpectral && Object.keys(targetSubstrateSpectral).length > 0,
            printConditionId: selectedPrintCondition?.id,
            importedSubstrateDataPoints: Object.keys(importedSubstrateSpectral).length,
            targetSubstrateDataPoints: targetSubstrateSpectral ? Object.keys(targetSubstrateSpectral).length : 0
          });
          
          const adaptedTints = adaptTintsToSubstrate(
            normalizedImportedTints,
            importedSubstrateSpectral,      // imported substrate spectral (0% tint)
            targetSubstrateSpectral,        // target substrate spectral
            {
              astmTables,
              measurementControls: measurementControls || {
                illuminant: 'D50',
                observer: '2',
                table: '5'
              }
            }
          );
          
          if (adaptedTints && adaptedTints.length > 0) {
            finalPayload.adapted_tints = adaptedTints;
            console.log('✅ Successfully computed adapted_tints for save:', adaptedTints.length, 'tints');
            console.log('📊 Sample adapted tint percentages:', adaptedTints.slice(0, 3).map(t => getTintPercentage(t)));
          } else {
            console.warn('⚠️ adaptTintsToSubstrate returned empty result');
          }
        } catch (error) {
          console.error('❌ Failed to compute adapted_tints for save:', error);
        }
      }

      // Preserve measurement_settings from condition if they exist (contains ΔE-driven values)
      if (!finalPayload.measurement_settings && condition?.measurement_settings) {
        finalPayload.measurement_settings = condition.measurement_settings;
      } else if (finalPayload.measurement_settings && condition?.measurement_settings) {
        // Deep merge to preserve substrate_delta_e and delta_e_updated_at
        finalPayload.measurement_settings = {
          ...condition.measurement_settings,
          ...finalPayload.measurement_settings
        };
      }
      
      // Preserve ui_state.active_data_mode if not explicitly set
      if (!finalPayload.ui_state?.active_data_mode && condition?.ui_state?.active_data_mode) {
        finalPayload.ui_state = {
          ...finalPayload.ui_state,
          active_data_mode: condition.ui_state.active_data_mode
        };
      }
      
      // Calculate color_hex before saving
      const effectiveDataMode = activeDataMode || localActiveDataMode || 
                                condition?.measurement_settings?.preferred_data_mode || 
                                condition?.ui_state?.active_data_mode || 
                                'imported';
      console.log('🎨 Calculating color_hex for save with mode:', {
        effectiveDataMode,
        activeDataMode,
        localActiveDataMode,
        preferredDataMode: condition?.measurement_settings?.preferred_data_mode,
        uiStateMode: condition?.ui_state?.active_data_mode,
        conditionId: conditionId,
        hasSubstrateCondition: !!finalPayload.substrate_condition,
        hasSpectralData: !!(finalPayload.spectral_data && Object.keys(finalPayload.spectral_data).length > 0)
      });
      
      const calculatedColorHex = calculateInkConditionColorHex(
        { ...condition, ...finalPayload },
        effectiveDataMode,
        profile?.organization_defaults,
        astmTables,
        condition?.substrate_spectral_data || null
      );
      finalPayload.color_hex = calculatedColorHex;

      const { error } = await supabase
        .from('ink_conditions')
        .update(finalPayload)
        .eq('id', conditionId);

      if (error) {
        console.error('Error updating condition:', error);
        toast.error(`Failed to save condition: ${error.message}`);
        return;
      }

      // If name is missing/empty, let the DB auto-generate and then refresh local state
      if (!finalPayload.name || finalPayload.name === '') {
        const { data: newName, error: nameError } = await supabase.rpc(
          'update_ink_condition_name_auto',
          { p_condition_id: conditionId }
        );
        if (nameError) {
          console.warn('Auto-name RPC failed:', nameError);
        } else if (newName) {
          // Refetch the row to ensure UI matches DB after auto-generation
          await fetchData();
          toast.success('Condition saved and name auto-generated');
          return;
        }
      }

      // If substrate condition changed, update the auto-generated name regardless of manual name
      try {
        const substrateChanged = (
          (localStateValues?.localSubstrateConditionId && localStateValues.localSubstrateConditionId !== 'create_new' && localStateValues.localSubstrateConditionId !== condition?.substrate_condition) ||
          (finalPayload.substrate_condition && finalPayload.substrate_condition !== condition?.substrate_condition)
        );
        if (substrateChanged) {
          console.log('🔄 Substrate changed: calling update_ink_condition_name_auto');
          const { data: updatedName, error: nameUpdateError } = await supabase.rpc('update_ink_condition_name_auto', { p_condition_id: conditionId });
          if (nameUpdateError) {
            console.warn('Auto-name update after substrate change failed:', nameUpdateError);
          } else {
            console.log('✅ Auto-name updated to:', updatedName);
            await fetchData();
          }
        }
      } catch (e) {
        console.warn('Name auto-update skipped/failed:', e);
      }

      toast.success('Condition saved successfully');
      
      // Clear creation mode flags after successful save to reset sticky flags in InfoPanel
      const clearedCondition = { ...finalPayload };
      delete clearedCondition._creatingNewSubstrate;
      delete clearedCondition._creatingNewSubstrateCondition;
      
      // Preserve important state values during update, especially substrate_condition
      setCondition(prev => ({
        ...prev,
        ...clearedCondition,
        // Preserve substrate_condition if it was part of the local state
        ...(localStateValues?.localSubstrateConditionId && localStateValues.localSubstrateConditionId !== 'create_new' ? {
          substrate_condition: localStateValues.localSubstrateConditionId
        } : {})
      }));
      
      // Call the callback to handle navigation
      if (onConditionSaved) {
        onConditionSaved();
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error(`Failed to save condition: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!condition || !ink) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          Condition not found or failed to load.
        </div>
      </Card>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`${ink.name} - ${condition.name} - Color KONTROL`}</title>
        <meta name="description" content={`Manage ink condition: ${condition.name} for ${ink.name}`} />
      </Helmet>

      <Card className="p-6">
        {/* ColorSettingsBox positioned above the card */}
        <div className="flex justify-end mb-4">
          <ColorSettingsBox
            controls={measurementControls}
            setControls={setMeasurementControls}
            standards={standards}
            organizationDefaults={organization}
            availableModes={availableModes}
            className="flex-shrink-0"
          />
        </div>

        <InkConditionVisuals
          condition={condition}
          ink={ink}
          canEdit={true}
          isEditMode={true} // Always start in edit mode for Smart Import
          onEdit={() => {}}
          onCancel={() => {}}
          onSave={(localStateValues) => handleSaveCondition(null, localStateValues)}
          saving={saving}
          cxfData={cxfData}
          organizationId={profile?.organization_id}
          onConditionChange={handleConditionChange}
          onCreationModeChange={onCreationModeChange}
          onRequestActiveTab={onRequestActiveTab}
          onValidationChange={onValidationChange}
          creatingNewSubstrate={creatingNewSubstrate}
          creatingNewSubstrateCondition={creatingNewSubstrateCondition}
          measurementControls={measurementControls}
          standards={standards}
          importedTints={condition?.imported_tints}
          // Wedge selection props
          selectedWedge={selectedWedge}
          onWedgeSelect={(index) => {
            console.log('🎯 Parent received wedge selection:', index);
            setSelectedWedge(index);
          }}
          onWedgeDataChange={setWedgeData}
          activeDataMode={activeDataMode || localActiveDataMode}
          onActiveDataModeChange={(newMode) => {
            console.log('🎯 Data mode changed to:', newMode);
            setLocalActiveDataMode(newMode);
            
            // Trigger adaptation computation if switching to adapted mode
            if (newMode === 'adapted' && 
                condition?.substrate_spectral_data && 
                condition?.imported_tints && 
                (!condition?.adapted_tints || condition.adapted_tints.length === 0)) {
              console.log('🔄 Triggering adaptation for mode change...');
              // The useEffect for auto-computing adapted_tints will handle this
            }
          }}
          onAvailableModesChange={setAvailableModes}
          // Pass print condition for substrate spectral data resolution
          onSelectedPrintConditionChange={handleSelectedPrintConditionChange}
        />
      </Card>
    </>
  );
};

export default InkConditionFormTab;