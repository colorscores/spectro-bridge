import React, { useState, useMemo, useCallback, useEffect, useRef, startTransition } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet-async';
import InkWedgePicker from '@/components/inks/InkWedgePicker';
import SpectralPlot from '@/components/conditions/SpectralPlot';
import ColorInfoPanelHorizontal from '@/components/inks/ColorInfoPanelHorizontal';
import InkDotGainPlot from '@/components/inks/InkDotGainPlot';
import PrintConditionCardSimple from './PrintConditionCardSimple';
import PrintConditionCard from './PrintConditionCard';

import InkConditionVisuals from '@/components/inks/InkConditionVisuals';
import SubstrateMismatchCard from '@/components/inks/SubstrateMismatchCard';
import SubstrateDifferenceDialog from '@/components/ui/SubstrateDifferenceDialog';
import { useLiveColorDisplay } from '@/hooks/useLiveColorDisplay';
import { calculateDeltaE } from '@/lib/deltaE';
import { spectralToLabASTME308, labToHexD65, labToChromaHue } from '@/lib/colorUtils';
import { pickBestMeasurement } from '@/lib/measurementSelection';
import { findSolidWedgeIndex } from '@/lib/wedgeUtils';
import { getTintPercentage, normalizeTints, safeSpectralData } from '@/lib/tintsUtils';
import { dbSafeTints } from '@/lib/safePlainJson';
import { ensureTintsArrayForDB } from '@/lib/tintsUtils';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { computeAdaptedSpectralRatio as computePhysicsBasedSpectral, getPureSubstrateSpectral } from '@/lib/spectralAdaptation';
import { 
  computeTwoStepSubstrateAdaptation,
  calculateInkSubstrateDeltaE,
  determinePreferredDataMode,
  computeAdaptedTintsIfNeeded,
  selectTintsForDisplay
} from '@/lib/inkSubstrateAdaptation';
import { saveInkConditionWithAdaptation } from '@/lib/inkConditionSave';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { resolveActiveDataMode } from '@/lib/colorUtils/resolveActiveDataMode';

// Silence verbose logs in this module (only keep errors)
const __SILENCE_LOGS__ = true;
// eslint-disable-next-line no-shadow
const console = __SILENCE_LOGS__ ? { ...globalThis.console, log: () => {}, info: () => {}, debug: () => {}, warn: () => {} } : globalThis.console;

const InkBasedColorInfoTab = ({
  color,
  fromInkCondition,
  measurementControls,
  standards,
  importedTints = [],
  onColorUpdate,
  canEdit = false,
  isEditing = false,
  onEdit,
  onTabSwitch,
  persistentState,
  onPersistentStateChange,
  onMismatchStateChange,
  isPrintConditionComplete = false,
  forcedPrintConditionId = null
}) => {
  // Get role access to conditionally show print conditions
  const { isSuperadmin } = useRoleAccess();
  
  // toast imported directly; no hook to avoid dispatcher issues
  // Remove selectedWedge state management - we'll compute directly from 100% solid tint
  const selectedPrintConditionId = persistentState?.selectedPrintConditionId ?? color?.print_condition_id ?? null;
  const showSubstrateOptions = persistentState?.showSubstrateOptions ?? false;
  const substrateAdaptationMode = persistentState?.substrateAdaptationMode ?? 'adapt';
  const substrateDeltaE = persistentState?.substrateDeltaE ?? null;
  const selectedPrintCondition = persistentState?.selectedPrintCondition ?? null;
  const selectedBackground = persistentState?.selectedBackground ?? 'Substrate';
  const editOriginalPrintConditionId = persistentState?.editOriginalPrintConditionId ?? null;
  const activeDataMode = persistentState?.activeDataMode; // Don't default to 'imported'
  const hasAcceptedAdaptation = persistentState?.hasAcceptedAdaptation ?? false;
  const acceptedAdaptationData = persistentState?.acceptedAdaptationData ?? null;
  const hasBeenAdapted = persistentState?.hasBeenAdapted ?? false;
  const selectedTintPercentage = persistentState?.selectedTintPercentage ?? null;
  const [savingAdaptation, setSavingAdaptation] = useState(false);
  const [showMismatchDialog, setShowMismatchDialog] = useState(false);
  const [dismissedMismatchDialogForDeltaE, setDismissedMismatchDialogForDeltaE] = useState(null);
  // Local fallback when persistent state updater is unavailable (e.g., imported ink-based flow)
  const [localSelectedWedge, setLocalSelectedWedge] = useState();
  const lastValidSelectedWedgeRef = useRef(null);
  const [computedAdaptedTints, setComputedAdaptedTints] = useState(null);
  const [previousPrintConditionState, setPreviousPrintConditionState] = useState(null);
  // Local fallback for activeDataMode when parent doesn't provide state management
  const [localActiveDataMode, setLocalActiveDataMode] = useState(null);
  // Hydration guard to make selection update atomic and avoid duplicate fetches
  const hydrationRef = useRef(false);
  // Track if we've completed initial hydration
  const initialHydrationDone = useRef(false);
  // Preloaded print conditions for dropdown (fetched during hydration)
  const [preloadedPrintConditions, setPreloadedPrintConditions] = useState(null);

  // Diagnostic: Track when computedAdaptedTints updates
  useEffect(() => {
    console.info('[InkBasedColorInfoTab] computedAdaptedTints updated:', {
      length: computedAdaptedTints?.length ?? 0,
      hasData: !!computedAdaptedTints
    });
  }, [computedAdaptedTints]);

  // Helper functions to update persistent state (must be defined before useMemo/useEffect that use them)
  const setSelectedPrintConditionId = (value) => {
    onPersistentStateChange?.(prev => ({ ...prev, selectedPrintConditionId: value }));
  };
  const setShowSubstrateOptions = (value) => {
    onPersistentStateChange?.(prev => ({ ...prev, showSubstrateOptions: value }));
  };
  const setSubstrateAdaptationMode = (value) => {
    onPersistentStateChange?.(prev => ({ ...prev, substrateAdaptationMode: value }));
  };
  const setSubstrateDeltaE = (value) => {
    onPersistentStateChange?.(prev => ({ ...prev, substrateDeltaE: value }));
  };
  const setSelectedPrintCondition = useCallback((value) => {
    onPersistentStateChange?.(prev => ({ ...prev, selectedPrintCondition: value }));
  }, [onPersistentStateChange]);
  const setSelectedBackground = (value) => {
    onPersistentStateChange?.(prev => ({ ...prev, selectedBackground: value }));
  };
  const setActiveDataMode = (value) => {
    if (onPersistentStateChange) {
      onPersistentStateChange(prev => ({ ...prev, activeDataMode: value }));
    } else {
      setLocalActiveDataMode(value);
    }
  };
  const setHasAcceptedAdaptation = (value) => {
    onPersistentStateChange?.(prev => ({ ...prev, hasAcceptedAdaptation: value }));
  };
  const setAcceptedAdaptationData = (value) => {
    onPersistentStateChange?.(prev => ({ ...prev, acceptedAdaptationData: value }));
  };
  const setHasBeenAdapted = (value) => {
    onPersistentStateChange?.(prev => ({ ...prev, hasBeenAdapted: value }));
  };

  // Render-level override for immediate mode changes (prevents stale UI after save)
  const [renderActiveMode, setRenderActiveMode] = useState(null);
  
  // Use the activeDataMode from persistent state, local fallback, or inherit from ink condition
  const resolvedActiveDataMode = useMemo(() => {
    // Priority 1: Persistent state (user's current session choice)
    if (persistentState?.activeDataMode) {
      return persistentState.activeDataMode;
    }
    
    // Priority 2: Local state (fallback when no persistent state manager)
    if (localActiveDataMode) {
      return localActiveDataMode;
    }
    
    // Priority 3: Inherit from source ink condition's saved preference
    if (fromInkCondition) {
      const inheritedMode = resolveActiveDataMode(fromInkCondition);
      console.log('🎯 [InkBasedColorInfoTab] Inheriting activeDataMode from ink condition:', {
        inkConditionId: fromInkCondition.id,
        inkConditionName: fromInkCondition.name,
        inheritedMode,
        active_data_mode: fromInkCondition.active_data_mode,
        ui_state_mode: fromInkCondition.ui_state?.active_data_mode,
        measurement_settings_mode: fromInkCondition.measurement_settings?.preferred_data_mode
      });
      return inheritedMode;
    }
    
    // Priority 4: Default fallback
    return 'imported';
  }, [persistentState?.activeDataMode, localActiveDataMode, fromInkCondition]);
  
  // Effective mode with local override for immediate rendering
  const effectiveActiveMode = renderActiveMode ?? resolvedActiveDataMode;
  
  console.log('🎯 [InkBasedColorInfoTab] Mode resolution:', {
    renderActiveMode,
    resolvedActiveDataMode,
    effectiveActiveMode,
    persistentStateMode: persistentState?.activeDataMode
  });

  // Initialize persistent state from ink condition on first load
  useEffect(() => {
    if (!fromInkCondition) return;
    
    // Only initialize if no explicit mode is set yet
    if (persistentState?.activeDataMode || localActiveDataMode) return;
    
    const inheritedMode = resolveActiveDataMode(fromInkCondition);
    
    console.log('🎯 [InkBasedColorInfoTab] Initializing persistent state from ink condition:', {
      inheritedMode,
      inkConditionId: fromInkCondition.id
    });
    
    // Set both persistent and local state
    if (onPersistentStateChange) {
      onPersistentStateChange(prev => ({
        ...prev,
        activeDataMode: inheritedMode,
        preferredDataMode: inheritedMode
      }));
    } else {
      setLocalActiveDataMode(inheritedMode);
    }
  }, [fromInkCondition, persistentState?.activeDataMode, localActiveDataMode, onPersistentStateChange]);

  // Hydrate adapted tints from DB when in adapted mode and tints are missing
  useEffect(() => {
    const hydrateAdaptedTints = async () => {
      // Only hydrate if we're in adapted mode, have no computed tints, and have a valid ink condition ID
      if (resolvedActiveDataMode !== 'adapted' || computedAdaptedTints?.length > 0 || !color?.from_ink_condition_id) {
        return;
      }

      console.log('[InkBasedColorInfoTab] Hydrating adapted tints from DB for ink condition:', color.from_ink_condition_id);

      try {
        const { data, error } = await supabase
          .from('ink_conditions')
          .select('adapted_tints')
          .eq('id', color.from_ink_condition_id)
          .maybeSingle();

        if (error) throw error;

        if (data?.adapted_tints) {
          const rawTints = Array.isArray(data.adapted_tints) ? data.adapted_tints : data.adapted_tints.tints || [];
          
          if (rawTints.length > 0) {
            console.log('[InkBasedColorInfoTab] Hydrated adapted tints:', rawTints.length);
            setComputedAdaptedTints(rawTints);
          }
        }
      } catch (e) {
        console.error('[InkBasedColorInfoTab] Failed to hydrate adapted tints:', e);
      }
    };

    hydrateAdaptedTints();
  }, [resolvedActiveDataMode, computedAdaptedTints?.length, color?.from_ink_condition_id]);

  const setSelectedWedge = (value) => {
    const DEBUG = false;
    if (DEBUG) {
      console.log('setSelectedWedge', { value, type: typeof value });
    }

    // Note: baseFilteredOriginal and getAdaptedTints are defined later, so we can't use them here
    // This function will be called after component initialization when those are available

    let index = null;
    let tintPercentage = null;

    if (typeof value === 'object' && value !== null) {
      if (Number.isFinite(value.index)) index = Number(value.index);
      if (Number.isFinite(value.tintPercentage)) tintPercentage = Number(value.tintPercentage);
    } else if (Number.isFinite(value)) {
      index = Number(value);
    }

    // Store tintPercentage for later use when data is available
    if (tintPercentage != null) {
      if (onPersistentStateChange) {
        onPersistentStateChange(prev => ({ ...prev, selectedTintPercentage: tintPercentage }));
      } else {
        setLocalSelectedWedge(index ?? 0);
      }
    } else {
      // Default to 100% if we can't determine percentage yet
      const defaultTint = 100;
      if (onPersistentStateChange) {
        onPersistentStateChange(prev => ({ ...prev, selectedTintPercentage: defaultTint }));
      } else {
        setLocalSelectedWedge(index ?? 0);
      }
    }
  };

  const disableMismatchChecks = resolvedActiveDataMode === 'adapted';

  useEffect(() => {
    // Hide mismatch UI when in adapted mode to prevent double rows
    if (disableMismatchChecks && showSubstrateOptions) {
      setShowSubstrateOptions(false);
    }
  }, [disableMismatchChecks, showSubstrateOptions]);

  // Load persisted print condition selection from DB on mount/reload
  useEffect(() => {
    const loadPersistedSelection = async () => {
      if (!color?.id) return;
      if (initialHydrationDone.current) return; // Only hydrate once
      
      // Begin atomic hydration
      hydrationRef.current = true;
      
      try {
        // Fetch user profile for organization_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', (await supabase.auth.getUser()).data.user?.id)
          .single();
        
        // Fetch print conditions in parallel with association data
        const printConditionsPromise = profile ? supabase
          .from('print_conditions')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('name') : Promise.resolve({ data: null });
        
        // Query for the latest association, prioritizing adapted_at over created_at
        const { data, error } = await supabase
          .from('color_print_condition_associations')
          .select('print_condition_id, created_at, is_adapted, adapted_at, preferred_data_mode')
          .eq('color_id', color.id)
          .order('adapted_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        
        // Resolve print conditions fetch
        const { data: printConditionsData } = await printConditionsPromise;
        if (printConditionsData) {
          setPreloadedPrintConditions(printConditionsData);
        }
        
        const persistedId = data?.print_condition_id || null;
        const isAdapted = data?.is_adapted || false;
        const preferred = data?.preferred_data_mode ?? null;

        console.log('[InkBasedColorInfoTab] Loaded persisted selection:', { 
          persistedId, 
          isAdapted, 
          preferred, 
          currentActiveDataMode: activeDataMode 
        });
        
        // Fetch full print condition details to populate selectedPrintCondition
        let printConditionData = null;
        if (persistedId) {
          try {
            const { data: pcData } = await supabase
              .from('print_conditions')
              .select('*')
              .eq('id', persistedId)
              .maybeSingle();
            printConditionData = pcData || null;
          } catch (pcErr) {
            console.warn('[InkBasedColorInfoTab] Failed to load print condition details:', pcErr);
          }
        }
        
        // Mark hydration complete BEFORE updating state to prevent blip
        initialHydrationDone.current = true;
        
        // Only set activeDataMode when there's an explicit preference
        // Do NOT default to 'imported' - let the color inherit from ink condition
        const stateUpdate = {
          hasBeenAdapted: isAdapted || prev?.hasBeenAdapted,
          adaptedForPrintConditionId: (isAdapted && persistedId) ? persistedId : prev?.adaptedForPrintConditionId,
          selectedPrintConditionId: persistedId,
          selectedPrintCondition: printConditionData,
          editOriginalPrintConditionId: persistedId || prev?.editOriginalPrintConditionId
        };
        
        // Only override activeDataMode if there's an explicit preference saved
        if (typeof preferred === 'string' && ['imported', 'adapted'].includes(preferred)) {
          stateUpdate.activeDataMode = preferred;
        } else if (isAdapted) {
          // If adapted but no explicit preference, set to 'adapted'
          stateUpdate.activeDataMode = 'adapted';
        }
        // Otherwise, don't touch activeDataMode - let it inherit from ink condition

        // Update all state atomically in a single operation
        onPersistentStateChange?.(prev => ({
          ...prev,
          ...stateUpdate
        }));
        
      } catch (e) {
        console.error('Failed to load persisted print condition selection:', e);
        initialHydrationDone.current = true;
        // Don't force any default mode on error - let it inherit naturally
      } finally {
        // End atomic hydration
        hydrationRef.current = false;
      }
    };

    loadPersistedSelection();
  }, [color?.id]); // Don't include isEditing - causes re-runs
  
  // Clear local override once persistent state catches up
  useEffect(() => {
    if (renderActiveMode === 'adapted' && persistentState?.activeDataMode === 'adapted') {
      console.log('✅ [Sync] Persistent state caught up, clearing local override');
      setRenderActiveMode(null);
    }
  }, [renderActiveMode, persistentState?.activeDataMode]);

  // Update hasBeenAdapted when color changes or persistent state indicates adaptation
  useEffect(() => {
    // Don't auto-set hasBeenAdapted if we're currently handling a substrate mismatch
    if (showSubstrateOptions) {
      return;
    }
    
    const shouldBeAdapted = color?.hasAdaptedData || 
                           (persistentState?.hasBeenAdapted && 
                            persistentState?.adaptedForPrintConditionId === selectedPrintConditionId);
    if (shouldBeAdapted && !hasBeenAdapted) {
      setHasBeenAdapted(true);
    }
  }, [color?.hasAdaptedData, persistentState?.hasBeenAdapted, persistentState?.adaptedForPrintConditionId, selectedPrintConditionId, showSubstrateOptions, hasBeenAdapted]);


  // Ensure selected print condition object is loaded when ID changes
  useEffect(() => {
    const effectiveId = forcedPrintConditionId || selectedPrintConditionId;
    if (!effectiveId) return;

    // Skip during atomic hydration to avoid duplicate fetches/renders
    if (hydrationRef.current) return;

    // Avoid refetching if already loaded with same ID
    if (selectedPrintCondition?.id === effectiveId) return;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('print_conditions')
          .select('*')
          .eq('id', effectiveId)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled && data) {
          setSelectedPrintCondition(data);
        }
      } catch (e) {
        console.error('Failed to load selected print condition:', e, { effectiveId });
      }
    }, 100); // 100ms debounce

    return () => { 
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [selectedPrintConditionId, forcedPrintConditionId, selectedPrintCondition?.id, setSelectedPrintCondition]);

  // Capture state snapshot when entering edit mode (for cancel/revert)
  useEffect(() => {
    if (isEditing && !previousPrintConditionState) {
      console.log('📸 Capturing state snapshot for potential cancel');
      setPreviousPrintConditionState({
        printConditionId: selectedPrintConditionId,
        printCondition: selectedPrintCondition,
        showSubstrateOptions,
        substrateDeltaE,
        activeDataMode: resolvedActiveDataMode,
        hasBeenAdapted,
        computedAdaptedTints
      });
    }
    
    // Clear snapshot when exiting edit mode successfully
    if (!isEditing && previousPrintConditionState) {
      console.log('🧹 Clearing state snapshot after edit mode exit');
      setPreviousPrintConditionState(null);
    }
  }, [isEditing, selectedPrintConditionId, selectedPrintCondition, showSubstrateOptions, 
      substrateDeltaE, resolvedActiveDataMode, hasBeenAdapted, computedAdaptedTints, previousPrintConditionState]);

  // Helper function to commit the current selection as the new baseline and save to database
  const handleCommitSelection = async () => {
    if (!selectedPrintConditionId || !color?.id) return;

    try {
      // Save the selection to the database using correct RPC parameters
      const { error } = await supabase.rpc('update_color_print_conditions', {
        p_color_id: color.id,
        p_print_condition_ids: [selectedPrintConditionId],
        p_organization_id: color.organization_id,
      });

      if (error) throw error;

      // Update the baseline to current selection
      onPersistentStateChange?.(prev => ({ 
        ...prev, 
        editOriginalPrintConditionId: prev.selectedPrintConditionId 
      }));
    } catch (error) {
      console.error('Error saving print condition selection:', error);
      throw error; // Re-throw to let the caller handle the error
    }
  };

  // Callback to update color with 100% solid tint data from InkConditionVisuals
  const handleInkConditionChange = useCallback((updatedCondition) => {
    // Handle both function and value updates
    let newCondition;
    if (typeof updatedCondition === 'function') {
      newCondition = updatedCondition(fromInkCondition);
    } else {
      newCondition = updatedCondition;
    }
    
    // Safety check
    if (!newCondition || !onColorUpdate) {
      return;
    }
    
    try {
      // Extract 100% solid tint data
      const tints = newCondition.imported_tints || {};
      
      // Handle both object format {100: {...}, 50: {...}} and array format
      let solidTint = null;
      if (typeof tints === 'object' && !Array.isArray(tints)) {
        // Object format with numeric keys
        solidTint = tints['100'] || tints[100];
        
        // If not found, search through all values
        if (!solidTint) {
          const tintValues = Object.values(tints);
          solidTint = tintValues.find(t => {
            const percentage = getTintPercentage(t);
            return percentage === 100 || percentage === '100';
          });
        }
      }
      
      if (solidTint) {
        const updateData = {};
        
        // Update spectral data
        if (solidTint.spectral_data || solidTint.spectralData) {
          updateData.spectral_data = solidTint.spectral_data || solidTint.spectralData;
        }
        
        // Update Lab values
        if (solidTint.lab) {
          updateData.lab_l = solidTint.lab.L;
          updateData.lab_a = solidTint.lab.a;
          updateData.lab_b = solidTint.lab.b;
        }
        
        // Update hex color
        if (solidTint.displayHex || solidTint.hex) {
          updateData.hex = solidTint.displayHex || solidTint.hex;
        }
        
        if (Object.keys(updateData).length > 0) {
          console.log('[InkBasedColorInfoTab] Updating color with 100% solid tint data:', updateData);
          onColorUpdate(updateData);
        }
      }
    } catch (error) {
      console.error('[InkBasedColorInfoTab] Error in handleInkConditionChange:', error);
      // Don't throw - just log the error to prevent breaking the UI
    }
  }, [fromInkCondition, onColorUpdate]);

  // Helper function to sanitize print_side data
  // Helper function to get substrate data from imported color for new print conditions
  const getSubstrateDataFromColor = useMemo(() => {
    if (!color) return {};
    
    // Extract substrate information from imported color
    const substrateData = {
      substrate_type: color.substrate_type,
      material_type: color.material_type,
      print_process: color.print_process,
      print_side: color.print_side
    };
    
    // Extract substrate LAB and spectral data from 0% tint or substrate measurement
    const zeroPercentTint = color.measurements?.find(m => 
      (m.tint_percentage === 0 || m.tint_percentage === '0%' || (m.tint_percentage == null && m.mode))
    );
    
    if (zeroPercentTint) {
      substrateData.lab = zeroPercentTint.lab;
      substrateData.spectral_data = zeroPercentTint.spectral_data;
      substrateData.color_hex = zeroPercentTint.color_hex;
    }
    
    return substrateData;
  }, [color]);

  // Helper function to map substrate names to IDs from database
  const getPrePopulatedDataForNewPrintCondition = async () => {
    const substrateData = getSubstrateDataFromColor;
    const prePopulatedData = { ...substrateData };
    
    try {
      // Fetch substrate types and materials to map names to IDs
      const [substrateTypesRes, substrateMaterialsRes] = await Promise.all([
        supabase.from('substrate_types').select('id, name'),
        supabase.from('substrate_materials').select('id, name, substrate_type_id')
      ]);
      
      const substrateTypes = substrateTypesRes.data || [];
      const substrateMaterials = substrateMaterialsRes.data || [];
      
      // Map substrate type name to ID
      if (substrateData.substrate_type) {
        const matchingType = substrateTypes.find(t => 
          t.name.toLowerCase() === substrateData.substrate_type.toLowerCase()
        );
        if (matchingType) {
          prePopulatedData.substrate_type_id = matchingType.id;
        }
      }
      
      // Map material type name to ID (if substrate type was found)
      if (substrateData.material_type && prePopulatedData.substrate_type_id) {
        const matchingMaterial = substrateMaterials.find(m => 
          m.name.toLowerCase() === substrateData.material_type.toLowerCase() &&
          m.substrate_type_id === prePopulatedData.substrate_type_id
        );
        if (matchingMaterial) {
          prePopulatedData.substrate_material_id = matchingMaterial.id;
        }
      }
      
      // Sanitize print side
      if (substrateData.print_side) {
        prePopulatedData.print_side = sanitizePrintSide(substrateData.print_side);
      }
      
    } catch (error) {
      console.error('Error fetching substrate mapping data:', error);
    }
    
    return prePopulatedData;
  };

  const sanitizePrintSide = (printSide) => {
    console.log('🔍 sanitizePrintSide input:', printSide);
    
    if (!printSide) return 'Surface';
    
    let normalizedValue;
    if (typeof printSide === 'object' && printSide.value) {
      normalizedValue = printSide.value === 'undefined' ? 'surface' : printSide.value;
    } else {
      normalizedValue = printSide === 'undefined' ? 'surface' : printSide;
    }
    
    const lowerValue = normalizedValue.toLowerCase();
    if (lowerValue === 'surface') return 'Surface';
    if (lowerValue === 'reverse') return 'Reverse';
    
    console.log('🔍 sanitizePrintSide output (preserving):', normalizedValue);
    return normalizedValue; // Preserve any other values as-is
  };

  // Helper function to get L* value of a background from 0% tint
  const getLStarOfBackground = useCallback((backgroundName, data) => {
    const zeroPercentTint = data.find(tint => 
      (tint.tintPercentage ?? 100) === 0 && tint.backgroundName === backgroundName
    );
    return zeroPercentTint?.lab?.L || 90; // Default to 90 if not found
  }, []);

  // Helper function to calculate background scale ratio
  const getBackgroundScale = useCallback((backgroundName, data) => {
    if (backgroundName === 'Substrate') return 1;
    
    const substrateL = getLStarOfBackground('Substrate', data);
    const backgroundL = getLStarOfBackground(backgroundName, data);
    
    if (substrateL <= 0) return 1;
    return Math.max(0, Math.min(1, backgroundL / substrateL));
  }, [getLStarOfBackground]);

  // Helper function to scale spectral data by a factor
  const scaleSpectralByFactor = useCallback((spectralData, factor) => {
    const scaledSpectral = {};
    Object.keys(spectralData).forEach(wavelength => {
      scaledSpectral[wavelength] = Math.max(0, Math.min(1, spectralData[wavelength] * factor));
    });
    return scaledSpectral;
  }, []);

  // Helper function to compute adapted spectral using physics-based area coverage model
  const computeAdaptedSpectralRatio = useCallback((importedSubstrateSpectral, importedInkSpectral, printConditionSubstrateSpectral, tintPercentage) => {
    // For 0% tint, return pure print condition substrate
    if (tintPercentage === 0) {
      return getPureSubstrateSpectral(printConditionSubstrateSpectral);
    }
    
    // First, adapt the ink spectral from imported substrate to print condition substrate
    // This maintains the ink character but adjusts for the new substrate
    const keys = Object.keys(importedInkSpectral || {}).filter(
      (w) => importedSubstrateSpectral?.[w] !== undefined && printConditionSubstrateSpectral?.[w] !== undefined
    );
    
    const adaptedInkSpectral = {};
    keys.forEach(wavelength => {
      const importedSubstrate = importedSubstrateSpectral[wavelength] || 0;
      const importedInk = importedInkSpectral[wavelength] || 0;
      const printSubstrate = printConditionSubstrateSpectral[wavelength] || 0;
      
      // Calculate the ratio and apply to print substrate
      const ratio = importedSubstrate > 0 ? importedInk / importedSubstrate : 0;
      adaptedInkSpectral[wavelength] = Math.max(0, Math.min(1, printSubstrate * ratio));
    });
    
    // Then use physics-based area coverage model for the final mixing
    return computePhysicsBasedSpectral(printConditionSubstrateSpectral, adaptedInkSpectral, tintPercentage, {
      enableLogging: false,
      maxCoverage: 0.95,
      opticalGain: 1.1
    });
  }, []);

// Process imported tints and sort by percentage (base data, always from imports)
const wedgeData = useMemo(() => {
  // ALWAYS use imported_tints as source for wedgeData
  // effectiveMode only controls display and whether to compute adaptation
  const rawImportedTints = fromInkCondition?.imported_tints || [];
  
  // Handle both array and object structures
  let rawTints = rawImportedTints;
  if (rawTints && typeof rawTints === 'object' && !Array.isArray(rawTints)) {
    rawTints = rawTints.tints || [];
  }
    
    if (!Array.isArray(rawTints) || rawTints.length === 0) return [];
    
    const selectedMode = measurementControls?.mode || 'M1';
    
    return [...rawTints]
      .sort((a, b) => {
        const aPercent = a.tint_percentage ?? a.tintPercentage ?? a.tint ?? 0;
        const bPercent = b.tint_percentage ?? b.tintPercentage ?? b.tint ?? 0;
        return Number(aPercent) - Number(bPercent);
      })
      .map(tint => {
        // Use DB format primarily (snake_case) for tint percentage
        let tintPercentage = tint.tint_percentage ?? tint.tintPercentage ?? tint.tint;
        
        // Normalize percentage: handle strings like "100%", floats like 1.0, or direct percentages
        if (tintPercentage !== undefined && tintPercentage !== null) {
          if (typeof tintPercentage === 'string') {
            // Strip % and parse
            tintPercentage = parseFloat(tintPercentage.replace('%', ''));
          } else {
            tintPercentage = Number(tintPercentage);
          }
          
          // If value is between 0-1, scale to 0-100
          if (tintPercentage >= 0 && tintPercentage <= 1) {
            tintPercentage = tintPercentage * 100;
          }
          
          // Round to avoid floating point issues
          tintPercentage = Math.round(tintPercentage * 100) / 100;
          
          if (isNaN(tintPercentage)) {
            tintPercentage = null;
          }
        }
        
        // Find measurement using the same logic as ColorInfoTab
        let selectedMeasurement = null;
        let spectralData = null;
        let lab = null;
        
        if (tint.measurements && Array.isArray(tint.measurements)) {
          // For substrate (0%), use spectral data directly if available
          if (tintPercentage === 0) {
            const substrateWithSpectral = tint.measurements.find(m => m.spectral_data);
            if (substrateWithSpectral) {
              selectedMeasurement = substrateWithSpectral;
              spectralData = substrateWithSpectral.spectral_data;
              lab = substrateWithSpectral.lab;
            }
          } else {
            // Use shared measurement selection logic for non-substrate tints
            selectedMeasurement = pickBestMeasurement(tint.measurements, selectedMode);
            if (selectedMeasurement) {
              spectralData = selectedMeasurement.spectral_data;
              lab = selectedMeasurement.lab;
            }
          }
        } else {
          // Fallback to direct properties if no measurements array
          spectralData = tint.spectralData || tint.spectral_data;
          lab = tint.lab;
        }
        
        const isSubstrate = tintPercentage === 0;
        
        return {
          name: isSubstrate ? 'Substrate' : tintPercentage !== null && !isNaN(tintPercentage) ? `${Math.round(tintPercentage)}%` : null,
          tintPercentage,
          colorHex: null,
          backgroundName: tint.backgroundName || tint.background_name || 'Substrate',
          spectralData,
          lab,
          ch: lab ? { 
            C: Math.sqrt(lab.a * lab.a + lab.b * lab.b),
            h: Math.atan2(lab.b, lab.a) * 180 / Math.PI
          } : (tint.ch || null),
          isSubstrate,
          selectedMode: selectedMeasurement?.mode || selectedMode,
          availableModes: tint.measurements?.map(m => m.mode) || [selectedMode]
        };
      });
  }, [
    fromInkCondition?.imported_tints, 
    fromInkCondition?.adapted_tints, 
    measurementControls?.mode, 
    resolvedActiveDataMode,
    hasBeenAdapted,
    showSubstrateOptions,
    computedAdaptedTints
  ]);

  // Extract available backgrounds from original imported data (not adapted)
  const availableBackgrounds = useMemo(() => {
    const backgrounds = [...new Set(wedgeData.map(item => item.backgroundName))];
    return backgrounds.filter(Boolean);
  }, [wedgeData]);

  // Filter base wedge data by selected background
  const baseFilteredOriginal = useMemo(() => {
    if (!selectedBackground || availableBackgrounds.length <= 1) {
      return wedgeData;
    }
    return wedgeData.filter(item => item.backgroundName === selectedBackground);
  }, [wedgeData, selectedBackground, availableBackgrounds]);

  // Memoize weighting table FIRST for reuse in display color computation
  const matchingWeightingTable = useMemo(() => {
    if (!measurementControls || !standards?.astmTables) return [];
    const { illuminant: illuminantName = 'D50', observer: observerName = '2', table: tableName = '5' } = measurementControls;
    const tableNumber = parseInt(String(tableName), 10);
    const tables = Array.isArray(standards.astmTables) ? standards.astmTables : [];
    return tables.filter(t => 
      t.illuminant_name === illuminantName && 
      t.observer === observerName &&
      String(t.table_number) === String(tableNumber)
    );
  }, [measurementControls, standards?.astmTables]);

  // Helper: Get the current adapted tints (for preview or post-save)
  const getAdaptedTints = useCallback(() => {
    // Priority 1: Use computed adapted tints (preview OR post-save, before reload)
    if (computedAdaptedTints?.length > 0) {
      return computedAdaptedTints.map(tint => ({
        ...tint,
        spectralData: tint.spectral_data || tint.spectralData,
        tintPercentage: tint.tint_percentage ?? tint.tintPercentage ?? 0,
        isAdapted: true
      }));
    }
    
    // Priority 2: Use saved adapted_tints from DB (after page reload)
    if (fromInkCondition?.adapted_tints?.length > 0) {
      return fromInkCondition.adapted_tints.map(tint => ({
        ...tint,
        spectralData: tint.spectral_data || tint.spectralData,
        tintPercentage: tint.tint_percentage ?? tint.tintPercentage ?? 0,
        isAdapted: true
      }));
    }
    
    return null;
  }, [computedAdaptedTints, fromInkCondition?.adapted_tints]);


  // hasBeenAdapted is now managed through persistent state (see line 49 and setter on line 83)

  // Create UI wedge data - wedges will compute display colors from spectral data
  const uiWedgeData = useMemo(() => {
    if (!wedgeData || wedgeData.length === 0) return [];
    
    const adaptedTints = getAdaptedTints();

    // Show full adapted wedges (no split) after save
    if ((resolvedActiveDataMode === 'adapted' || hasBeenAdapted) && adaptedTints?.length > 0) {
      return adaptedTints.map((tint) => ({
        ...tint,
        hasSplit: false,
        isSubstrate: tint.tintPercentage === 0,
        tintPercentage: tint.tintPercentage ?? tint.tint ?? 0
      }));
    }

    // Loading state: adapted mode selected but data not ready
    if (resolvedActiveDataMode === 'adapted' && !adaptedTints) {
      return [];
    }

    // Show split view during preview (ΔE > 1, before save)
    if (showSubstrateOptions && selectedPrintCondition && !hasBeenAdapted && computedAdaptedTints?.length > 0) {
      return baseFilteredOriginal.map((importedTint, index) => {
        const adaptedTint = computedAdaptedTints[index];
        
        return {
          ...importedTint,
          tintPercentage: importedTint.tintPercentage ?? 0,
          hasSplit: true,
          splitSpectralData: adaptedTint?.spectral_data || adaptedTint?.spectralData,
          isSubstrate: (importedTint.tintPercentage ?? importedTint.tint ?? 0) === 0
        };
      });
    }

    // Default: show imported wedges
    return baseFilteredOriginal.map((tint) => ({
      ...tint,
      hasSplit: false,
      isSubstrate: (tint.tintPercentage ?? tint.tint ?? 0) === 0,
      tintPercentage: tint.tintPercentage ?? tint.tint ?? 0
    }));
  }, [baseFilteredOriginal, getAdaptedTints, showSubstrateOptions, selectedPrintCondition, hasBeenAdapted, computedAdaptedTints, resolvedActiveDataMode]);

  // Update selected background when data changes
  useEffect(() => {
    if (availableBackgrounds.length > 0 && !availableBackgrounds.includes(selectedBackground)) {
      setSelectedBackground(availableBackgrounds.includes('Substrate') ? 'Substrate' : availableBackgrounds[0]);
    }
  }, [availableBackgrounds, selectedBackground]);

  // Determine effective data mode - prioritize 'adapted' during preview
  const effectiveDataMode = useMemo(() => {
    if (showSubstrateOptions && substrateAdaptationMode === 'adapt') {
      console.log('🔄 Using adapted mode during mismatch preview');
      return 'adapted';
    }
    return resolvedActiveDataMode;
  }, [resolvedActiveDataMode, showSubstrateOptions, substrateAdaptationMode]);

  // Get data for chart/color info based on effective data mode
  // PERFORMANCE: Prefer computed adapted tints immediately when in adapted mode
  const chartData = useMemo(() => {
    // During substrate mismatch preview with "Adapt" selected, only show adapted data
    if (showSubstrateOptions && substrateAdaptationMode === 'adapt') {
      const adaptedTints = getAdaptedTints();
      return (adaptedTints || []).filter(item => 
        (item.spectralData && Object.keys(item.spectralData).length > 0) ||
        (item.lab && item.lab.L != null)
      );
    }
    
    // CRITICAL: Prefer client-computed adapted tints for instant UI updates
    const adaptedTints = getAdaptedTints();
    if (effectiveDataMode === 'adapted' && adaptedTints?.length > 0) {
      return adaptedTints;
    }
    
    // Fallback: try DB adapted measurements (for reopened colors)
    if (effectiveDataMode === 'adapted' && color?.measurements) {
      // Check if we have adapted measurements in the database - include Lab-only
      let adaptedMeasurements = color.measurements.filter(m => 
        m.mode === 'adapted' && (
          (m.spectral_data && Object.keys(m.spectral_data).length > 0) ||
          (m.lab && m.lab.L != null)
        )
      );

      // Prefer measurements matching the current mode
      if (measurementControls?.mode) {
        const exactMode = adaptedMeasurements.filter(m =>
          m.mode && String(m.mode).toUpperCase() === String(measurementControls.mode).toUpperCase()
        );
        if (exactMode.length > 0) {
          console.log('📊 InkBasedColorInfoTab: Filtering adapted measurements by mode', {
            requestedMode: measurementControls.mode,
            matchedCount: exactMode.length,
            totalAdapted: adaptedMeasurements.length
          });
          adaptedMeasurements = exactMode;
        }
      }
      
      if (adaptedMeasurements.length > 0) {
        console.log('📊 InkBasedColorInfoTab: Using adapted measurements from DB instead of computed ratio');
        
        // Map DB measurements to chart format with robust tint percentage inference
        const dbChartData = adaptedMeasurements.map((measurement, index) => {
          // Robust tint percentage inference
          let tintPercentage = measurement.tint_percentage;
          
          // Handle string tint percentages
          if (typeof tintPercentage === 'string') {
            const parsed = parseFloat(tintPercentage.replace('%', ''));
            if (!isNaN(parsed)) {
              tintPercentage = parsed;
            }
          }
          
          // Scale 0-1 values to 0-100%
          if (typeof tintPercentage === 'number' && tintPercentage >= 0 && tintPercentage <= 1) {
            tintPercentage = tintPercentage * 100;
          }
          
          // Fallback to measurement position-based inference
          if (tintPercentage == null || isNaN(tintPercentage)) {
            // Try inferring from measurement mode or position
            if (measurement.mode && typeof measurement.mode === 'string') {
              const modeMatch = measurement.mode.match(/(\d+)%/);
              if (modeMatch) {
                tintPercentage = parseFloat(modeMatch[1]);
              }
            }
            
            // Final fallback based on measurement position/density
            if (tintPercentage == null || isNaN(tintPercentage)) {
              tintPercentage = index === 0 ? 100 : (100 - (index * 25)); // Default sequence
            }
          }
          
          const spectralData = measurement.spectral_data;
          
          if (tintPercentage === 100) {
            console.log('🔬 InkBasedColorInfoTab: Using adapted spectral data (100% solid):', {
              tab: 'InkBasedColorInfoTab',
              tintPercentage,
              spectralFingerprint: {
                keyCount: Object.keys(spectralData).length,
                range: Object.keys(spectralData).length > 0 ? 
                  `${Math.min(...Object.keys(spectralData).map(Number))}-${Math.max(...Object.keys(spectralData).map(Number))}` : 'none',
                checksum: Object.keys(spectralData).reduce((sum, k) => sum + (spectralData[k] || 0), 0).toFixed(3)
              },
              source: 'db-adapted-measurement',
              activeDataMode: effectiveDataMode
            });
          }
          
          return {
            name: `${Math.round(tintPercentage)}%`,
            tintPercentage,
            spectralData,
            lab: measurement.lab || null,
            colorHex: measurement.lab ? labToHexD65(measurement.lab.L, measurement.lab.a, measurement.lab.b) : null,
            isSubstrate: Math.abs(tintPercentage) < 0.1
          };
        }).filter(item => 
          // Filter out invalid entries
          item.tintPercentage != null && 
          !isNaN(item.tintPercentage) && 
          item.spectralData && 
          Object.keys(item.spectralData).length > 0
        ).sort((a, b) => a.tintPercentage - b.tintPercentage); // Sort ascending for proper curve
        
        // Quality check: ensure we have unique tint levels including 0% and 100%
        const uniqueTints = [...new Set(dbChartData.map(item => Math.round(item.tintPercentage)))];
        const hasSubstrate = uniqueTints.includes(0);
        const hasSolid = uniqueTints.some(t => t >= 90);
        
        if (dbChartData.length >= 3 && hasSubstrate && hasSolid) {
          console.log('📊 InkBasedColorInfoTab: Quality check passed', {
            totalPoints: dbChartData.length,
            uniqueTints,
            hasSubstrate,
            hasSolid
          });
          return dbChartData;
        } else {
          console.warn('📊 InkBasedColorInfoTab: Quality check failed, falling back to computed data', {
            totalPoints: dbChartData.length,
            uniqueTints,
            hasSubstrate,
            hasSolid
          });
          // Fall through to use computed data
        }
      }
    }
    
    // Strict gating: when adapted mode is chosen but not ready, return empty array (no imported fallback)
    if (effectiveDataMode === 'adapted') {
      const adaptedTints = getAdaptedTints();
      return adaptedTints?.length > 0 ? adaptedTints : []; // No fallback to imported
    }
    
    return baseFilteredOriginal;
  }, [effectiveDataMode, getAdaptedTints, baseFilteredOriginal, color?.measurements, showSubstrateOptions, substrateAdaptationMode]);

  // Get solid wedge index using the robust utility function
const solidIndex = useMemo(() => {
  const dataToUse = effectiveDataMode === 'adapted' ? (getAdaptedTints() || baseFilteredOriginal) : baseFilteredOriginal;
  return findSolidWedgeIndex(dataToUse);
}, [effectiveDataMode, getAdaptedTints, baseFilteredOriginal]);

// Compute selected index from selectedTintPercentage (stable across reorders)
const selectedWedge = useMemo(() => {
  const dataToUse = effectiveDataMode === 'adapted' ? (getAdaptedTints() || baseFilteredOriginal) : baseFilteredOriginal;
  if (!dataToUse || dataToUse.length === 0) return 0;

  const target = Number.isFinite(selectedTintPercentage) ? selectedTintPercentage : null;
  if (target !== null) {
    const idx = dataToUse.findIndex(t => getTintPercentage(t) === target);
    if (idx !== -1) return idx;
  }
  return solidIndex;
}, [selectedTintPercentage, effectiveDataMode, getAdaptedTints, baseFilteredOriginal, solidIndex]);

// Keep last valid selection updated
useEffect(() => {
  const dataToUse = effectiveDataMode === 'adapted' ? (getAdaptedTints() || baseFilteredOriginal) : baseFilteredOriginal;
  if (Number.isFinite(selectedWedge) && selectedWedge >= 0 && selectedWedge < dataToUse.length) {
    lastValidSelectedWedgeRef.current = selectedWedge;
  }
}, [selectedWedge, effectiveDataMode, getAdaptedTints, baseFilteredOriginal]);

const selectedData = useMemo(() => {
  const dataToUse = effectiveDataMode === 'adapted' ? (getAdaptedTints() || baseFilteredOriginal) : baseFilteredOriginal;
  return selectedWedge >= 0 && selectedWedge < dataToUse.length ? dataToUse[selectedWedge] : null;
}, [effectiveDataMode, getAdaptedTints, baseFilteredOriginal, selectedWedge]);

// Create tint index for SpectralPlot
const selectedTintIndex = useMemo(() => {
  const dataToUse = effectiveDataMode === 'adapted' ? (getAdaptedTints() || baseFilteredOriginal) : baseFilteredOriginal;
  return selectedWedge >= 0 && selectedWedge < dataToUse.length ? selectedWedge : solidIndex;
}, [effectiveDataMode, getAdaptedTints, baseFilteredOriginal, selectedWedge, solidIndex]);
  
  // Get substrate data (0% tint) for print condition comparison - use data based on current activeDataMode
  const substrateData = useMemo(() => {
    // Use data appropriate to the EFFECTIVE data mode to respect user's choice everywhere
    const dataToUse = effectiveDataMode === 'adapted' ? (getAdaptedTints() || baseFilteredOriginal) : baseFilteredOriginal;
    const substrateTint = dataToUse.find(tint => tint.isSubstrate);
    if (!substrateTint) return null;

    let lab = substrateTint.lab;
    
    // If no direct LAB, compute from spectral data using the same ASTM logic as the main calculations
    if (!lab && substrateTint.spectralData && standards?.astmTables?.length > 0 && measurementControls) {
      try {
        const { illuminant: illuminantName = 'D50', observer: observerName = '2', table: tableName = '5' } = measurementControls;
        const tableNumber = parseInt(String(tableName), 10);
        
        // Find weighting table using the same logic as main calculations
        const weightingTable = standards.astmTables.filter(t => 
          t.illuminant_name === illuminantName && 
          t.observer === observerName &&
          String(t.table_number) === String(tableNumber)
        );
        
        if (weightingTable.length > 0) {
          lab = spectralToLabASTME308(substrateTint.spectralData, weightingTable);
        }
      } catch (error) {
        console.error('Failed to compute substrate LAB from spectral data:', error);
      }
    }

    if (lab) {
      return {
         lab,
         colorHex: labToHexD65(lab.L, lab.a, lab.b, measurementControls?.illuminant || 'D50'),
         spectral_data: substrateTint.spectralData
      };
    }
    
    return null;
  }, [activeDataMode, getAdaptedTints, wedgeData, measurementControls, standards?.astmTables]);

  // Add display hex caching to prevent substrate flashing
  const lastSolidHexRef = React.useRef(null);
  
  // Simplified: Get color info directly from current selected tint
  const { lab, ch, hex } = useMemo(() => {
        if (!selectedData) return { lab: null, ch: null, hex: null };

        // 1) Prefer LAB already present on the selected data (e.g., adapted tints provide adapted LAB)
        if (selectedData.lab) {
            return {
                lab: selectedData.lab,
                ch: selectedData.ch || labToChromaHue(selectedData.lab.L, selectedData.lab.a, selectedData.lab.b),
                hex: labToHexD65(selectedData.lab.L, selectedData.lab.a, selectedData.lab.b, measurementControls?.illuminant || 'D50')
            };
        }

        // 2) Otherwise, compute from spectral if available
        if (selectedData.spectralData && standards?.astmTables?.length > 0 && measurementControls) {
            try {
                const { illuminant: illuminantName = 'D50', observer: observerName = '2', table: tableName = '5' } = measurementControls;
                const tableNumber = parseInt(String(tableName), 10);

                const weightingTable = standards.astmTables.filter(t =>
                    t.illuminant_name === illuminantName &&
                    t.observer === observerName &&
                    String(t.table_number) === String(tableNumber)
                );

                if (weightingTable.length > 0) {
                    const computedLab = spectralToLabASTME308(selectedData.spectralData, weightingTable);
                    const computedCh = labToChromaHue(computedLab.L, computedLab.a, computedLab.b);
                    const computedHex = labToHexD65(computedLab.L, computedLab.a, computedLab.b, illuminantName);

                    return { lab: computedLab, ch: computedCh, hex: computedHex };
                }
            } catch (error) {
                console.error('Failed to compute Lab from spectral:', error);
            }
        }

        // 3) Final fallback
        return { lab: null, ch: null, hex: null };
    }, [selectedData, standards?.astmTables, measurementControls?.illuminant, measurementControls?.observer, measurementControls?.table]);

  // Cache solid color hex to prevent substrate flashing
  const displayHex = useMemo(() => {
    // If we have a valid solid/tint hex, cache it and use it
    if (hex && selectedData && !selectedData.isSubstrate) {
      lastSolidHexRef.current = hex;
      return hex;
    }
    
    // If showing substrate during loading/transition, return cached solid hex if available
    if (selectedData?.isSubstrate && lastSolidHexRef.current) {
      return lastSolidHexRef.current;
    }
    
    // Final fallback
    return hex || lastSolidHexRef.current || '#808080';
  }, [hex, selectedData]);

  // Compute imported lab data for comparison (baseline from original imported wedge)
  const { lab: importedLabData, ch: importedChData, hex: importedHexData } = useMemo(() => {
    // Always compute the original imported values for the currently selected wedge
    const originalData = baseFilteredOriginal[selectedWedge];
    if (!originalData) return { lab: null, ch: null, hex: null };

    // Prefer existing LAB on original data
    if (originalData.lab) {
      return {
        lab: originalData.lab,
        ch: originalData.ch || labToChromaHue(originalData.lab.L, originalData.lab.a, originalData.lab.b),
        hex: labToHexD65(originalData.lab.L, originalData.lab.a, originalData.lab.b, measurementControls?.illuminant || 'D50')
      };
    }

    // Fallback: compute LAB from spectral if available
    if (originalData.spectralData && standards?.astmTables?.length > 0 && measurementControls) {
      try {
        const { illuminant: illuminantName = 'D50', observer: observerName = '2', table: tableName = '5' } = measurementControls;
        const tableNumber = parseInt(String(tableName), 10);
        const weightingTable = standards.astmTables.filter(t => 
          t.illuminant_name === illuminantName && 
          t.observer === observerName &&
          String(t.table_number) === String(tableNumber)
        );
        if (weightingTable.length > 0) {
          const lab = spectralToLabASTME308(originalData.spectralData, weightingTable);
          return {
            lab,
            ch: labToChromaHue(lab.L, lab.a, lab.b),
            hex: labToHexD65(lab.L, lab.a, lab.b, illuminantName)
          };
        }
      } catch (e) {
        console.warn('Failed to compute imported LAB from spectral for comparison:', e);
      }
    }
    
    return { lab: null, ch: null, hex: null };
  }, [baseFilteredOriginal, selectedWedge, measurementControls?.illuminant, measurementControls?.observer, measurementControls?.table, standards?.astmTables]);


  // Detect substrate mismatch and show dialog when first detected
  useEffect(() => {
    if (substrateDeltaE > 1 && !showMismatchDialog && showSubstrateOptions) {
      // Only show if user hasn't dismissed this specific deltaE value
      if (dismissedMismatchDialogForDeltaE !== substrateDeltaE) {
        setShowMismatchDialog(true);
      }
    }
  }, [substrateDeltaE, showMismatchDialog, showSubstrateOptions, dismissedMismatchDialogForDeltaE]);


  // Handle print condition change
  const handlePrintConditionChange = useCallback(async (printConditionId, printConditionData = null) => {
    console.log('InkBasedColorInfoTab.handlePrintConditionChange', { printConditionId, hasData: !!printConditionData });
    
    // If we're in 'create' mode and user selected "Create new", create the tab now
    if (substrateAdaptationMode === 'create' && printConditionId === 'create-new') {
      const newTabId = `new-print-condition-${Date.now()}`;
      const tabData = {
        id: newTabId,
        label: 'Print Condition',
        type: 'new-print-condition',
        isAlert: true,
        alertColor: 'red',
        prePopulatedData: {
          // Copy all settings from selected print condition
          ...(selectedPrintCondition ? {
            print_process: selectedPrintCondition.print_process,
            substrate_type_id: selectedPrintCondition.substrate_type_id,
            substrate_material_id: selectedPrintCondition.substrate_material_id,
            // Normalize and include both keys for compatibility
            print_side: selectedPrintCondition.printing_side || selectedPrintCondition.print_side || null,
            printing_side: selectedPrintCondition.printing_side || selectedPrintCondition.print_side || null,
            pack_type: selectedPrintCondition.pack_type,
          } : {}),
          // Override with imported substrate data from color
          ...getSubstrateDataFromColor,
          // Extract LAB and spectral from proper source
          // Clear fields that should be user-input
          name: '',
          version: '',
          organizationId: color?.organization_id,
          requiredFields: ['name']
        }
      };
      
      if (onTabSwitch) {
        console.log('Creating new print condition tab from dropdown selection:', tabData);
        onTabSwitch(newTabId, tabData, false); // false = don't auto-switch, preserve from-ink tab state
      }
      return; // Don't proceed with normal print condition selection
    }
    
    // Close any existing "new-print-condition" tabs when switching to a real print condition
    if (onTabSwitch && printConditionId !== 'create-new') {
      console.log('Print condition changed from create-new to existing condition:', printConditionId);
      onTabSwitch('remove-print-condition-tabs');
    }
    
    // If no data provided, fetch it with organization filter
    let printCondition = printConditionData;
    if (!printCondition && printConditionId && printConditionId !== 'create-new') {
      try {
        const { data, error } = await supabase
          .from('print_conditions')
          .select('*')
          .eq('id', printConditionId)
          .eq('organization_id', color.organization_id)
          .maybeSingle();
        
        if (error) {
          console.warn('[InkBasedColorInfoTab] Failed to fetch print condition:', error);
        }
        
        printCondition = data;
        
        if (!printCondition) {
          toast({
            title: 'Print Condition unavailable',
            description: 'You may not have access to this record. Adaptation skipped.',
            variant: 'default'
          });
          console.warn('[InkBasedColorInfoTab] Print condition not accessible:', printConditionId);
        }
      } catch (err) {
        console.warn('[InkBasedColorInfoTab] Failed to fetch print condition:', err);
      }
    }
    
    // CRITICAL: Calculate Delta E and determine adaptation need
    let deltaE = null;
    let preferredMode = 'imported';
    let adaptedTintsResult = null;
    
    if (printCondition && fromInkCondition?.imported_tints && standards?.astmTables?.length) {
      try {
        // Step 1: Calculate substrate Delta E
        const importedTints = normalizeTints(fromInkCondition.imported_tints);
        const printConditionSpectral = printCondition.spectral_data;
        
        // Extract 0% tint spectral from imported data (check measurements array too)
        const importedSubstrateTint = importedTints.find(t => (t.tintPercentage || t.tint_percentage || 0) === 0);
        const importedSubstrateSpectral = importedSubstrateTint ? safeSpectralData(importedSubstrateTint) : null;
        
        deltaE = calculateInkSubstrateDeltaE(
          importedTints,
          printConditionSpectral,
          standards.astmTables,
          {
            illuminant: measurementControls?.illuminant || 'D50',
            observer: measurementControls?.observer || '2',
            astmTable: measurementControls?.table || '5',
            deltaEMethod: measurementControls?.deltaE || 'dE00'
          }
        );
        
        console.log(`[InkBasedColorInfoTab] Substrate Delta E: ${deltaE}`);
        
        // Step 2: Determine preferred mode
        preferredMode = determinePreferredDataMode(deltaE);
        console.log(`[InkBasedColorInfoTab] Preferred mode: ${preferredMode}`);
        
        // Step 3: Compute adapted tints if needed - CORRECT PARAMETER ORDER
        if (preferredMode === 'adapted') {
          adaptedTintsResult = computeAdaptedTintsIfNeeded(
            importedTints,                  // Array of tints
            importedSubstrateSpectral,      // 0% tint spectral from imported
            printConditionSpectral,         // Target substrate spectral (print condition)
            deltaE,                         // Delta E value
            {                               // Measurement controls with astmTables
              illuminant: measurementControls?.illuminant || 'D50',
              observer: measurementControls?.observer || '2',
              astmTable: measurementControls?.table || '5',
              astmTables: standards.astmTables  // Add astmTables for Lab calculation
            }
          );
          
          console.log(`[InkBasedColorInfoTab] Generated ${adaptedTintsResult?.length || 0} adapted tints`);
        }
        
      } catch (err) {
        console.error('[InkBasedColorInfoTab] Adaptation calculation failed:', err);
        preferredMode = 'imported';
      }
    }
    
    // Step 4: Update state with calculated values (IMMEDIATE - no startTransition)
    // CRITICAL: Set computedAdaptedTints BEFORE updating persistent state
    // This ensures the state is available on the next render when the child re-renders
    if (preferredMode === 'adapted' && adaptedTintsResult) {
      setComputedAdaptedTints(adaptedTintsResult);
      console.info('[InkBasedColorInfoTab] Set computedAdaptedTints:', {
        length: adaptedTintsResult.length,
        getAdaptedTintsReturns: getAdaptedTints()?.length ?? 0
      });
    }
    
    setSelectedPrintConditionId(printConditionId);
    setSelectedPrintCondition(printCondition);
    
    // DON'T reset activeDataMode - it represents DB state
    // Only update preferredDataMode based on ΔE
    setSubstrateDeltaE(deltaE);
    setShowSubstrateOptions(false);
    onMismatchStateChange?.(false);
    
    onPersistentStateChange?.(prev => {
      // Check if we've already adapted for THIS specific print condition
      const alreadyAdaptedForThisPC = prev?.adaptedForPrintConditionId === printConditionId;
      const isAdaptationPending = preferredMode === 'adapted' && !alreadyAdaptedForThisPC;

      console.log('[InkBasedColorInfoTab] Print condition changed:', {
        printConditionId,
        preferredMode,
        activeDataMode: resolvedActiveDataMode, // Keep existing DB state
        alreadyAdaptedForThisPC,
        adaptedForPrintConditionId: prev?.adaptedForPrintConditionId,
        isAdaptationPending,
        willShowSplit: isEditing && isAdaptationPending,
        deltaE
      });

      return {
        ...prev,
        selectedPrintConditionId: printConditionId,
        selectedPrintCondition: printCondition,
        substrateDeltaE: deltaE,
        // activeDataMode stays unchanged - represents DB state
        showSubstrateOptions: false,
        preferredDataMode: preferredMode,  // Target mode from ΔE calculation
        isAdaptationPending
      };
    });
    
    // Step 5: If adaptation needed, immediately update local state then save
    if (preferredMode === 'adapted' && adaptedTintsResult && fromInkCondition?.id && color?.id) {
      // Immediately update local fromInkCondition with adapted tints
      const updatedCondition = {
        ...fromInkCondition,
        adapted_tints: adaptedTintsResult,
        measurement_settings: {
          ...fromInkCondition.measurement_settings,
          ...measurementControls
        }
      };
      
      // Update via color update callback to ensure data is available
      if (onColorUpdate) {
        onColorUpdate({
          from_ink_condition: updatedCondition
        });
      }
      
      // Store adapted tints in local state for immediate use in split wedge preview
      setComputedAdaptedTints(adaptedTintsResult);
      
      // DON'T switch activeDataMode yet - wait for user to Save
      // The split wedge will show preview using computedAdaptedTints
      console.log('[InkBasedColorInfoTab] Adapted tints computed, awaiting user confirmation to save');
      
      // Validate required data before attempting save
      if (!standards?.astmTables?.length || !measurementControls) {
        console.warn('[InkBasedColorInfoTab] Skipping save - missing required data:', {
          hasAstmTables: !!standards?.astmTables?.length,
          hasMeasurementControls: !!measurementControls
        });
        return;
      }
      
      // Save to database in background
      saveInkConditionWithAdaptation({
        inkConditionId: fromInkCondition.id,
        importedTints: fromInkCondition.imported_tints || [],
        adaptedTints: adaptedTintsResult,
        preferredDataMode: preferredMode,  // Use computed preferredMode from this function
        measurementControls: measurementControls || {},
        printConditionId: printConditionId,
        organizationId: color?.organization_id,
        orgDefaults: {
          illuminant: measurementControls?.illuminant || 'D50',
          observer: measurementControls?.observer || '2',
          astmTable: measurementControls?.table || '5',
          deltaEMethod: measurementControls?.deltaE || 'dE00'
        },
        astmTables: standards?.astmTables || []
      }).then(saveResult => {
        if (saveResult.success) {
          console.log('[InkBasedColorInfoTab] Adaptation saved successfully');
          
          // CRITICAL: Set activeDataMode to match the mode we just saved
          const savedMode = preferredMode;  // Use computed preferredMode from this scope
          
          onPersistentStateChange?.(prev => ({
            ...prev,
            isAdaptationPending: false,
            activeDataMode: savedMode,
            hasBeenAdapted: savedMode === 'adapted',
            adaptedForPrintConditionId: savedMode === 'adapted' ? printConditionId : prev.adaptedForPrintConditionId
          }));
          
          // Update local state to immediately reflect the saved mode
          setHasBeenAdapted(savedMode === 'adapted');
          setActiveDataMode(savedMode);
          
          toast({
            title: savedMode === 'adapted' ? 'Adaptation Complete' : 'Data Saved',
            description: savedMode === 'adapted' 
              ? `Color adapted to print condition (ΔE: ${deltaE?.toFixed(2)})`
              : 'Imported data saved',
          });
          
          // Trigger background refetch to sync with DB
          if (onColorUpdate) {
            onColorUpdate({ _refetch: true });
          }
        } else {
          throw saveResult.error;
        }
      }).catch(err => {
        console.error('[InkBasedColorInfoTab] Failed to save adaptation:', err);
        toast({
          title: 'Warning',
          description: 'Adaptation calculated but not saved to database',
          variant: 'destructive'
        });
      });
    }
    
  }, [substrateAdaptationMode, selectedPrintCondition, getSubstrateDataFromColor, color?.organization_id, color?.id, onTabSwitch, setSelectedPrintCondition, setSelectedPrintConditionId, setActiveDataMode, setHasBeenAdapted, setShowSubstrateOptions, setSubstrateDeltaE, onPersistentStateChange, onMismatchStateChange, fromInkCondition, standards?.astmTables, measurementControls]);

  // Handle substrate mismatch detection
  const handleSubstrateMismatch = useCallback((mismatchInfo) => {
    console.log('InkBasedColorInfoTab.handleSubstrateMismatch', mismatchInfo);
    
    // If cleared or null, reset mismatch UI and exit
    if (!mismatchInfo || mismatchInfo.deltaE == null) {
      setShowSubstrateOptions(false);
      setSubstrateDeltaE(null);
      onMismatchStateChange?.(false);
      return;
    }
    
    if (mismatchInfo.deltaE > 1) {
      setShowSubstrateOptions(true);
      setSubstrateDeltaE(mismatchInfo.deltaE);
      startTransition(() => {
        setSelectedPrintCondition(mismatchInfo.printCondition);
      });
      // Notify parent about mismatch state change
      onMismatchStateChange?.(true);
    } else {
      // Within tolerance
      setShowSubstrateOptions(false);
      setSubstrateDeltaE(null);
      onMismatchStateChange?.(false);
    }
    // Do not auto-switch to from-ink tab to preserve tab state
  }, [hasBeenAdapted, selectedPrintConditionId, onMismatchStateChange]);

  // Handle substrate adaptation mode change  
  const handleSubstrateAdaptationChange = useCallback((mode) => {
    console.log('InkBasedColorInfoTab.handleSubstrateAdaptationChange', mode);
    setSubstrateAdaptationMode(mode);
    
    if (mode === 'new') {
      // Don't create tab immediately - wait for print condition selection
      console.log('New print condition mode set - tab will be created when print condition is selected');
    } else if (mode === 'adapt') {
      // Do not switch modes here; switch after successful save
      // Optionally close any PC tabs if needed, but defer UI changes until save completes
    } else if (mode === 'none') {
      // Reset to imported data mode
      setActiveDataMode('imported');
      setComputedAdaptedTints(null); // Clear computed tints
    }
  }, []);

  // Handle mismatch resolution
  const handleMismatchSave = useCallback(async (mode = substrateAdaptationMode) => {
    console.log('InkBasedColorInfoTab.handleMismatchSave', { mode, selectedPrintConditionId, substrateData, selectedPrintCondition, selectedData });
    
    try {
      if (mode === 'adapt') {
        // CRITICAL: Capture adapted tints BEFORE any state changes
        // to prevent data loss during save
        const adaptedTintsSnapshot = getAdaptedTints();
        
        if (!adaptedTintsSnapshot || adaptedTintsSnapshot.length === 0) {
          console.error('❌ No adapted tints available, cannot save adaptation');
          throw new Error('No adapted data available to save');
        }
        
        console.log('📸 Captured adapted tints snapshot:', {
          count: adaptedTintsSnapshot.length,
          tints: adaptedTintsSnapshot.map(t => t.tintPercentage)
        });
        
        let hundredPercentTint = null; // Declare in function scope
        
        // Force adapted mode locally for immediate rendering (no waiting for DB round-trip)
        console.log('💾 [Save] Setting renderActiveMode to adapted immediately');
        setRenderActiveMode('adapted');
        
        // Also update persistent state (async, will catch up later)
        setActiveDataMode('adapted');
        setHasBeenAdapted(true);
        
        // Guard: If selectedWedge is out of bounds for adapted array, reset to solid
        if (selectedWedge >= adaptedTintsSnapshot.length) {
          setSelectedWedge(solidIndex);
        }
        
        // Now safe to trigger UI state changes
        setSavingAdaptation(true);
        setShowSubstrateOptions(false);
        setSubstrateDeltaE(null);
        onMismatchStateChange?.(false);
        console.log('InkBasedColorInfoTab.handleMismatchSave - adapting to selected print condition');
        
        try {
          const selectedIlluminant = standards?.selectedIlluminant?.name || 'D50';
          const selectedObserver = standards?.selectedObserver?.name || '2';
          const selectedTable = measurementControls?.table || '5';
          const tableNumber = parseInt(String(selectedTable), 10);
          
          // Check if this is an ink-based color
          const isInkBased = !!color.from_ink_condition_id;
          
          if (isInkBased) {
            // === SPLIT WEDGE PATH: Save to ink_condition ===
            
            // Determine the mode being used
            const usedMode = measurementControls?.mode || 'M1';
            
            console.info('[Adapt Save] Saving adapted spectral for wedge', { count: adaptedTintsSnapshot.length });
            
            // 1. Format adapted tints for ink condition - save spectral directly without ASTM per tint
            const adaptedTintsForInk = adaptedTintsSnapshot.map(item => {
              if (!item.spectralData || Object.keys(item.spectralData).length === 0) {
                throw new Error(`Tint ${item.tintPercentage}% missing spectral data`);
              }
              
              const tintPct = Number(item.tintPercentage ?? 100);
              
              // Build tint with spectral data only - no Lab/Hex calculation per tint
              return {
                name: `${color.name} ${tintPct}%`,
                tint: tintPct,
                tintPercentage: tintPct,
                backgroundName: 'Substrate',
                measurements: [
                  {
                    mode: usedMode,
                    spectral_data: item.spectralData,
                    start_wl: 380,
                    increment: 10,
                    tint_percentage: tintPct
                  }
                ]
              };
            });
            
            // Sanitize to remove UI-only fields and normalize camelCase→snake_case
            const sanitizedAdaptedTints = dbSafeTints(adaptedTintsForInk);
            
            // 2. Compute Lab/Hex only for 100% solid (for color table update)
            const solidTint = adaptedTintsSnapshot.find(t => t.tintPercentage === 100) 
              || adaptedTintsSnapshot[adaptedTintsSnapshot.length - 1];
            
            if (!solidTint?.spectralData) {
              throw new Error('Missing spectral data for 100% tint');
            }
            
            let solidLab = null;
            let solidHex = null;
            
            // Only compute if weighting table is available
            {
              const wt = Array.isArray(matchingWeightingTable) ? matchingWeightingTable : (matchingWeightingTable ? [matchingWeightingTable] : []);
              if (wt.length > 0) {
                solidLab = spectralToLabASTME308(solidTint.spectralData, wt);
                solidHex = labToHexD65(solidLab.L, solidLab.a, solidLab.b, selectedIlluminant);
              }
            }
            // 3. Update ink condition using unified save function
            const orgDefaults = {
              illuminant: measurementControls?.illuminant || selectedIlluminant || 'D50',
              observer: measurementControls?.observer || selectedObserver || '2',
              astmTable: measurementControls?.table || String(tableNumber || '5'),
              deltaEMethod: measurementControls?.deltaE || 'dE00'
            };
            const astmTables = standards?.astmTables || [];
            const saveResult = await saveInkConditionWithAdaptation({
              inkConditionId: color.from_ink_condition_id,
              importedTints: fromInkCondition.imported_tints || [],
              adaptedTints: sanitizedAdaptedTints,
              preferredDataMode: 'adapted',
              measurementControls: {
                mode: usedMode,
                illuminant: selectedIlluminant,
                observer: selectedObserver,
                table: tableNumber,
                measurement_mode: usedMode
              },
              printConditionId: selectedPrintConditionId,
              organizationId: color.organization_id,
              orgDefaults,
              astmTables
            });
            
            if (!saveResult.success) {
              console.error('❌ Unified save failed:', saveResult.error);
              throw saveResult.error;
            }
            
            console.info('✅ Successfully saved ink condition with adapted tints via unified function');
            
            
            console.info('[Adapt Save] ink_conditions updated', { conditionId: color.from_ink_condition_id, tintsSaved: adaptedTintsSnapshot.length });
            
            // Verify adapted_tints were saved
            const { data: verifyData, error: verifyError } = await supabase
              .from('ink_conditions')
              .select('adapted_tints')
              .eq('id', color.from_ink_condition_id)
              .maybeSingle();
            
            if (verifyError) {
              console.warn('⚠️ Verification skipped (SELECT error):', verifyError);
            } else if (verifyData) {
              console.log('✅ Verified adapted_tints in DB:', {
                isNull: verifyData.adapted_tints === null,
                count: verifyData.adapted_tints ? Object.keys(verifyData.adapted_tints).length : 0
              });
            } else {
              console.log('⚠️ Verification skipped: no row returned (likely RLS).');
            }
            
            
            // 4. Update the color with the 100% tint data (if Lab was computed)
            if (solidLab && solidHex) {
              const { error: colorError } = await supabase
                .from('colors')
                .update({
                  hex: solidHex,
                  lab_l: solidLab.L,
                  lab_a: solidLab.a,
                  lab_b: solidLab.b,
                  lab_illuminant: selectedIlluminant,
                  lab_observer: selectedObserver,
                  updated_at: new Date().toISOString()
                })
                .eq('id', color.id);
              
              if (colorError) {
                throw colorError;
              }
            }
            
            // 5. Mark association as adapted (non-blocking)
            if (selectedPrintConditionId) {
              try {
                const { error: assocError } = await supabase
                  .from('color_print_condition_associations')
                  .upsert({
                    color_id: color.id,
                    print_condition_id: selectedPrintConditionId,
                    organization_id: color.organization_id,
                    is_adapted: true,
                    adapted_at: new Date().toISOString(),
                    preferred_data_mode: 'adapted'
                  }, { onConflict: 'color_id,print_condition_id' });
                
                if (assocError) {
                  console.warn('[Adapt Save] Association upsert failed:', assocError);
                }
              } catch (assocErr) {
                console.warn('[Adapt Save] Association upsert error:', assocErr);
              }
            }
            
            // 6. Update UI state
            setHasBeenAdapted(true);
            setActiveDataMode('adapted');
            setShowSubstrateOptions(false);
            setSubstrateDeltaE(null);
            onMismatchStateChange?.(false);
            onPersistentStateChange?.(prev => ({ 
              ...prev, 
              activeDataMode: 'adapted',
              hasBeenAdapted: true,
              adaptedForPrintConditionId: selectedPrintConditionId,
              preferredDataMode: 'adapted',
            }));
            
            // 7. Notify parent with updated color data (if Lab was computed)
            if (solidLab && solidHex) {
              onColorUpdate?.({
                hex: solidHex,
                lab_l: solidLab.L,
                lab_a: solidLab.a,
                lab_b: solidLab.b,
                spectral_data: solidTint.spectralData
              }, { silent: true });
            }
            
            // 7.5. Save adapted spectral data to color_measurements for Color Info tab
            if (adaptedTintsSnapshot && adaptedTintsSnapshot.length > 0) {
              const measurementsToSave = adaptedTintsSnapshot.map((item) => {
                if (!item.spectralData || Object.keys(item.spectralData).length === 0) {
                  console.warn(`Tint ${item.tintPercentage}% missing spectral data, skipping measurement save`);
                  return null;
                }
                
                return {
                  color_id: color.id,
                  mode: 'adapted',
                  tint_percentage: Number(item.tintPercentage ?? 100),
                  spectral_data: item.spectralData,
                  illuminant: selectedIlluminant,
                  observer: selectedObserver
                };
              }).filter(Boolean);

              if (measurementsToSave.length > 0) {
                // Delete old adapted measurements
                const { error: deleteError } = await supabase
                  .from('color_measurements')
                  .delete()
                  .eq('color_id', color.id)
                  .eq('mode', 'adapted');

                if (deleteError) {
                  console.warn('Error deleting old adapted measurements:', deleteError);
                }

                // Insert new adapted measurements
                const { error: insertError } = await supabase
                  .from('color_measurements')
                  .insert(measurementsToSave);

                if (insertError) {
                  console.error('Error saving adapted measurements to color_measurements:', insertError);
                  // Don't throw - this is supplementary data
                } else {
                  console.info('✅ Saved adapted spectral measurements to color_measurements for Color Info tab:', {
                    colorId: color.id,
                    count: measurementsToSave.length,
                    tints: measurementsToSave.map(m => m.tint_percentage)
                  });
                  
                  // Trigger parent refetch after measurements are saved
                  onColorUpdate?.({ _refetch: true });
                }
              }
            }
            
          } else {
            // === NON-SPLIT WEDGE PATH: Save to color_measurements (existing logic) ===
            
            // Use computedAdaptedTints or fromInkCondition.adapted_tints directly (guaranteed arrays)
            const adaptedTints = computedAdaptedTints || fromInkCondition?.adapted_tints || [];
            if (onColorUpdate && selectedPrintConditionId && adaptedTints.length > 0) {
              const measurementsToSave = adaptedTints.map((item, index) => {
                if (!item.spectralData || Object.keys(item.spectralData).length === 0) {
                  throw new Error(`Tint ${item.tintPercentage}% missing spectral data`);
                }
                
                return {
                  color_id: color.id,
                  mode: 'adapted',
                  tint_percentage: Number(item.tintPercentage ?? 100),
                  spectral_data: item.spectralData,
                  illuminant: selectedIlluminant,
                  observer: selectedObserver
                };
              });

              const { error: deleteError } = await supabase
                .from('color_measurements')
                .delete()
                .eq('color_id', color.id)
                .eq('mode', 'adapted');

              if (deleteError) {
                console.warn('Error deleting old adapted measurements:', deleteError);
              }

              const { error: insertError } = await supabase
                .from('color_measurements')
                .insert(measurementsToSave);

              if (insertError) {
                throw insertError;
              }

              // Update color with 100% tint
              const hundredPercentTint = adaptedTints.find(t => t.tintPercentage === 100) 
                || adaptedTints[adaptedTints.length - 1];
              
              const wt2 = Array.isArray(matchingWeightingTable) ? matchingWeightingTable : (matchingWeightingTable ? [matchingWeightingTable] : []);
              if (hundredPercentTint?.spectralData && wt2.length > 0) {
                const hundredLab = spectralToLabASTME308(
                  hundredPercentTint.spectralData,
                  wt2
                );
                
                const hundredHex = labToHexD65(hundredLab.L, hundredLab.a, hundredLab.b, selectedIlluminant);
                
                onColorUpdate?.({
                  hex: hundredHex,
                  lab_l: hundredLab.L,
                  lab_a: hundredLab.a,
                  lab_b: hundredLab.b,
                  spectral_data: hundredPercentTint.spectralData
                }, { silent: true });
              }
            }
            
            // Persist the print condition selection
            handleCommitSelection().catch((e) => console.warn('handleCommitSelection error (adapt):', e));
            
            // Mark association as adapted (non-blocking)
            if (selectedPrintConditionId) {
              try {
                const { error: adaptedError } = await supabase
                  .from('color_print_condition_associations')
                  .upsert({
                    color_id: color.id,
                    print_condition_id: selectedPrintConditionId,
                    organization_id: color.organization_id,
                    is_adapted: true,
                    adapted_at: new Date().toISOString(),
                    preferred_data_mode: 'adapted'
                  }, { onConflict: 'color_id,print_condition_id' });

                if (adaptedError) {
                  console.warn('Failed to upsert adaptation status:', adaptedError);
                }
              } catch (assocErr) {
                console.warn('Association upsert error:', assocErr);
              }
            }
            
            // After successful save, NOW switch to adapted mode permanently
            setRenderActiveMode('adapted'); // Force immediate UI update FIRST
            onPersistentStateChange?.(prev => ({ ...prev, isAdaptationPending: false })); // Clear pending flag
            setHasBeenAdapted(true);
            setActiveDataMode('adapted');
            setShowSubstrateOptions(false);
            setSubstrateDeltaE(null);
            onMismatchStateChange?.(false);
            
            console.log('✅ [Save] Cleared isAdaptationPending and set adapted mode', {
              renderActiveMode: 'adapted',
              persistentPending: false
            });
            
            onPersistentStateChange?.(prev => ({ 
              ...prev, 
              activeDataMode: 'adapted',
              hasBeenAdapted: true,
              adaptedForPrintConditionId: selectedPrintConditionId,
              preferredDataMode: 'adapted',
            }));
          }
        
        toast({
          title: 'Success',
          description: 'Color adapted to print condition substrate.',
        });
        setSavingAdaptation(false);
      } catch (error) {
        console.error('Error during adapt save:', error);
        toast({
          title: 'Error',
          description: `Failed to save adapted data${error?.message ? `: ${error.message}` : ''}.`,
          variant: 'destructive',
        });
        setSavingAdaptation(false);
      }
    } else if (mode === 'imported') {
        // Low dE: save imported mode without computing adapted data
        setSavingAdaptation(true);
        
        try {
          // Persist the selected print condition selection
          handleCommitSelection().catch((e) => console.warn('handleCommitSelection error (imported):', e));
          
          // Upsert association with imported mode (non-blocking)
          if (selectedPrintConditionId) {
            try {
              const { error: updateError } = await supabase
                .from('color_print_condition_associations')
                .upsert({
                  color_id: color.id,
                  print_condition_id: selectedPrintConditionId,
                  organization_id: color.organization_id,
                  is_adapted: false,
                  adapted_at: null,
                  preferred_data_mode: 'imported'
                }, { onConflict: 'color_id,print_condition_id' });

              if (updateError) {
                console.warn('Failed to upsert association for imported mode:', updateError);
              }
            } catch (assocErr) {
              console.warn('Association upsert error (imported):', assocErr);
            }
          }
          
          // Update UI state
          setActiveDataMode('imported');
          setShowSubstrateOptions(false);
          setSubstrateDeltaE(null);
          onMismatchStateChange?.(false);
          onPersistentStateChange?.(prev => ({ 
            ...prev, 
            activeDataMode: 'imported',
            hasBeenAdapted: false,
          }));
          
          // Optionally notify parent
          onColorUpdate?.({ print_condition_id: selectedPrintConditionId }, { silent: true });
          
          toast({
            title: 'Success',
            description: 'Print condition saved with imported data.',
          });
          
        } catch (error) {
          console.error('Error saving imported mode:', error);
          toast({
            title: 'Error',
            description: 'Failed to save print condition selection.',
            variant: 'destructive',
          });
        } finally {
          setSavingAdaptation(false);
        }
      } else if (mode === 'new') {
        // Create new print condition tab with substrate data from imported ink
        setSavingAdaptation(true);
        
        // Hide mismatch options first
        setShowSubstrateOptions(false);
        setSubstrateDeltaE(null);
        onMismatchStateChange?.(false);
        
        if (onTabSwitch && substrateData) {
          const newTabId = `new-print-condition-${Date.now()}`;
          const tabData = {
            id: newTabId,
            label: 'Print Condition',
            type: 'new-print-condition',
            isAlert: true,
            data: {
              name: '',
              version: '',
              organizationId: color?.organization_id,
              substrate: {
                name: substrateData.name || 'Imported Substrate',
                lab_l: substrateData.lab?.L,
                lab_a: substrateData.lab?.a,
                lab_b: substrateData.lab?.b,
                spectral_data: substrateData.spectralData
              },
              requiredFields: ['name']
            }
          };
          
          console.log('Creating new print condition tab from mismatch save:', tabData);
          onTabSwitch(newTabId, tabData, false); // false = don't auto-switch
        }
        
        // Set print condition dropdown to "Create new" state  
        setSelectedPrintConditionId('create-new');
        setSelectedPrintCondition(null);
        
        // Set to show imported data (not adapted)
        setActiveDataMode('imported');
        onPersistentStateChange?.(prev => ({ 
          ...prev, 
          activeDataMode: 'imported',
          hasBeenAdapted: false,
          adaptedForPrintConditionId: null,
        }));
        
        toast({
          title: 'Success',
          description: 'New print condition tab created with substrate data.',
        });
        
        setSavingAdaptation(false);
      }
    } catch (error) {
      console.error('Error handling substrate mismatch save:', error);
      setSavingAdaptation(false);
      // Re-enable mismatch UI since save failed
      setShowSubstrateOptions(true);
      toast({
        title: 'Error',
        description: `Failed to process substrate adaptation: ${error.message}`,
        variant: 'destructive'
      });
    }
  }, [substrateAdaptationMode, selectedPrintConditionId, onColorUpdate, substrateData, selectedPrintCondition, color?.organization_id, onMismatchStateChange, getAdaptedTints, hasBeenAdapted, selectedData, handleCommitSelection, toast, onTabSwitch, color?.id, onPersistentStateChange]);

  // Gate rendering during hydration to prevent visual blips
  if (!initialHydrationDone.current && color?.id) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Ink-Based Color Info | PrintColorOS</title>
        <meta name="description" content="Ink-based color information with print condition and spectral data." />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : ''} />
      </Helmet>

      {/* Detect workflow type based on color origin and data */}
      {(() => {
        // Explicitly check creation_origin to determine which card to show
        const origin = fromInkCondition?.creation_origin ?? null;
        const isFromInkCondition = origin === 'from_ink' || origin === 'from_ink_based_color';
        const isFromImport = origin === 'from_color' || origin === null;
        
        // WORKFLOW 1: Color saved from visible ink condition
        // Show InkConditionVisuals WITHOUT print condition settings (shows ink condition details instead)
        if (color?.from_ink_condition_id && isFromInkCondition) {
          return (
            <Card>
              <CardContent className="p-6 space-y-6">
                <InkConditionVisuals
                  key={`icv-wf1-${effectiveActiveMode}-${(computedAdaptedTints?.length || 0)}`}
                  condition={fromInkCondition}
                  onConditionChange={handleInkConditionChange}
                  canEdit={canEdit}
                  showEditControls={false}
                  isNew={false}
                  measurementControls={measurementControls}
                  standards={standards}
                  forceActiveDataMode={effectiveActiveMode}
                  activeDataMode={effectiveActiveMode}
                  onActiveDataModeChange={setActiveDataMode}
                  usePrintConditions={false} // Don't show print conditions for from_ink workflow
                  creation_origin={fromInkCondition?.creation_origin}
                  isEditMode={isEditing}
                  onEdit={onEdit}
                  onSave={onEdit}
                  onCancel={onEdit}
                  saving={savingAdaptation}
                  selectedWedge={selectedWedge}
                  onWedgeSelectIdentity="object"
                  onWedgeSelect={(selection) => {
                    // Accept either { index, tintPercentage } or raw index
                    setSelectedWedge(selection);
                  }}
                  isEditing={isEditing}
                  isAdaptationPending={persistentState?.isAdaptationPending ?? false}
                />
              </CardContent>
            </Card>
          );
        }
        
        // WORKFLOW 2: Ink-based color imported from CXF
        // Show InkConditionVisuals with Print Condition Settings
        if (color?.from_ink_condition_id && isFromImport) {
          return (
            <Card>
              <CardContent className="p-6 space-y-6">
                {/* InkConditionVisuals component - includes print condition settings and all visuals */}
                <InkConditionVisuals
                  key={`icv-wf2-${selectedPrintConditionId}-${effectiveActiveMode}-${(computedAdaptedTints?.length || 0)}`}
                  condition={fromInkCondition}
                  onConditionChange={handleInkConditionChange}
                  canEdit={canEdit}
                  showEditControls={false}
                  isNew={false}
                  measurementControls={measurementControls}
                  standards={standards}
              forceActiveDataMode={effectiveActiveMode}
              activeDataMode={effectiveActiveMode}
              preferredDataMode={persistentState?.preferredDataMode || effectiveActiveMode}
              onActiveDataModeChange={setActiveDataMode}
                  usePrintConditions={isSuperadmin}
                  creation_origin={fromInkCondition?.creation_origin}
                  selectedPrintConditionId={selectedPrintConditionId}
                  onPrintConditionChange={handlePrintConditionChange}
                  onWedgeSelectIdentity="object"
                  isEditMode={isEditing}
                  onEdit={onEdit}
                  preAdaptedWedgeData={computedAdaptedTints || fromInkCondition?.adapted_tints || null}
                  preSelectedBackground={selectedBackground}
                  isEditing={isEditing}
                  isAdaptationPending={persistentState?.isAdaptationPending ?? false}
                  parentPrintCondition={selectedPrintCondition}
                  onSelectedPrintConditionChange={setSelectedPrintCondition}
                  astmWeightingTable={Array.isArray(matchingWeightingTable) ? matchingWeightingTable : (matchingWeightingTable ? [matchingWeightingTable] : [])}
                  disableInternalAdaptationPreview={true}
                  showSubstrateOptions={showSubstrateOptions}
                  onShowSubstrateOptionsChange={setShowSubstrateOptions}
                  preloadedPrintConditions={preloadedPrintConditions}
                  onSave={async () => {
                    // SPECIAL CASE: "None" selected - clear association and reset to imported mode
                    if (!selectedPrintConditionId) {
                      try {
                        setSavingAdaptation(true);
                        
                        // Clear print condition association from database
                        if (color?.id) {
                          const { error: deleteError } = await supabase
                            .from('color_print_condition_associations')
                            .delete()
                            .eq('color_id', color.id);
                          
                          if (deleteError) {
                            console.warn('Failed to delete print condition association:', deleteError);
                          }
                        }
                        
                        // Update ink condition to use imported mode
                        if (color?.from_ink_condition_id) {
                          const { error: updateError } = await supabase
                            .from('ink_conditions')
                            .update({
                              active_data_mode: 'imported',
                              preferred_data_mode: 'imported'
                            })
                            .eq('id', color.from_ink_condition_id);
                          
                          if (updateError) {
                            console.warn('Failed to update ink condition mode:', updateError);
                          }
                        }
                        
                        // Synchronize activeDataMode to preferredDataMode ('imported')
                        setActiveDataMode('imported');
                        setHasBeenAdapted(false);
                        setComputedAdaptedTints(null);
                        
                        // Update persistent state
                        onPersistentStateChange?.(prev => ({
                          ...prev,
                          activeDataMode: 'imported',
                          preferredDataMode: 'imported',
                          hasBeenAdapted: false,
                          adaptedForPrintConditionId: null,
                          selectedPrintConditionId: null,
                          selectedPrintCondition: null
                        }));
                        
                        toast({
                          title: 'Print condition removed',
                          description: 'Showing original imported data'
                        });
                        
                        // Trigger refetch
                        onColorUpdate?.({ _refetch: true });
                        
                        setSavingAdaptation(false);
                        onEdit?.(); // Exit edit mode
                      } catch (error) {
                        console.error('Error clearing print condition:', error);
                        toast({
                          title: 'Error',
                          description: 'Failed to clear print condition',
                          variant: 'destructive'
                        });
                        setSavingAdaptation(false);
                      }
                      return;
                    }

                    // EXISTING LOGIC: Handle print condition selection (adapt or imported mode)
                    const mode = (substrateDeltaE !== null && substrateDeltaE > 1) ? 'adapt' : 'imported';
                    console.log(`🔧 Save with mode: ${mode}`);
                    
                    try {
                      // Wait for state updates to complete
                      await handleMismatchSave(mode);
                      
                      // Clear previous state after successful save
                      setPreviousPrintConditionState(null);
                      
                      // Exit edit mode AFTER state updates complete
                      onEdit?.();
                    } catch (e) {
                      console.error('handleMismatchSave error:', e);
                      // Don't exit edit mode if save failed
                    }
                  }}
                  onCancel={() => {
                    // Revert to previous state
                    if (previousPrintConditionState) {
                      setSelectedPrintConditionId(previousPrintConditionState.printConditionId);
                      setSelectedPrintCondition(previousPrintConditionState.printCondition);
                      setShowSubstrateOptions(previousPrintConditionState.showSubstrateOptions);
                      setSubstrateDeltaE(previousPrintConditionState.substrateDeltaE);
                      setActiveDataMode(previousPrintConditionState.activeDataMode);
                      setHasBeenAdapted(previousPrintConditionState.hasBeenAdapted);
                      setComputedAdaptedTints(previousPrintConditionState.computedAdaptedTints);
                      setPreviousPrintConditionState(null);
                    }
                    
                    onEdit?.(); // Exit edit mode
                  }}
                  saving={savingAdaptation}
                  showSubstrateOptions={showSubstrateOptions}
                  onSubstrateMismatchChoice={(choice) => {
                    setSubstrateAdaptationMode(choice === 'create' ? 'create' : 'adapt');
                  }}
                  substrateMismatchChoice={substrateAdaptationMode === 'create' ? 'create' : 'adapt'}
                  selectedWedge={selectedWedge}
                   onWedgeSelect={(selection) => {
                     // Accept either { index, tintPercentage } or raw index
                     setSelectedWedge(selection);
                   }}
                />
              </CardContent>
            </Card>
          );
        }
        
        // FALLBACK: For non-ink-based colors or undefined states
        return null;
      })()}

      {/* Substrate Mismatch Warning Dialog */}
      <SubstrateDifferenceDialog
        isOpen={showMismatchDialog}
        onClose={() => {
          setShowMismatchDialog(false);
          setDismissedMismatchDialogForDeltaE(substrateDeltaE);
        }}
        deltaEValue={substrateDeltaE}
        deltaEMethod="dE76"
      />
    </>
  );
};

export default InkBasedColorInfoTab;