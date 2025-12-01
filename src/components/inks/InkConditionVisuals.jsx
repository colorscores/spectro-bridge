import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import InkConditionInfoPanel from './InkConditionInfoPanel';
import InkWedgePicker from './InkWedgePicker';
import SubstrateMismatchCard from './SubstrateMismatchCard';
import InkDotGainPlot from './InkDotGainPlot';
import SpectralPlot from '@/components/conditions/SpectralPlot';
import ColorInfoPanelHorizontal from './ColorInfoPanelHorizontal';
import SubstrateDifferenceDialog from '@/components/ui/alert-dialog-custom';
import PrintConditionCardSimple from '@/components/colors/PrintConditionCardSimple';

import { calculateDeltaE } from '@/lib/deltaE';
import { labToHex, spectralToLabASTME308, labToHexD65, labToChromaHue } from '@/lib/colorUtils/colorConversion';
import { normalizeTints, safeSpectralData, getTintPercentage } from '@/lib/tintsUtils';
import { getSolidColorHex } from '@/lib/colorUtils/solidColorExtractor';
import { computeAdaptedSpectralRatio, getPureSubstrateSpectral } from '@/lib/spectralAdaptation';
import { computeTwoStepSubstrateAdaptation } from '@/lib/inkSubstrateAdaptation';
import { dbSafeTints } from '@/lib/safePlainJson';
import { debug } from '@/lib/debugUtils';
// Removed useSpectralCalculations to avoid dispatcher errors
import { useIso53DensityTables } from '@/hooks/useIso53DensityTables';
import { pickBestMeasurement } from '@/lib/measurementSelection';
import { findSolidWedgeIndex } from '@/lib/wedgeUtils';

// Silence verbose logs in this module (only keep errors)
const __SILENCE_LOGS__ = false;
// eslint-disable-next-line no-shadow
const console = __SILENCE_LOGS__ ? { ...globalThis.console, log: () => {}, info: () => {}, debug: () => {}, warn: () => {} } : globalThis.console;

const InkConditionVisuals = ({ 
  condition, 
  onConditionChange, 
  canEdit, 
  showEditControls,
  isNew,
  measurementControls,
  standards,
  importedTints = null,
  onTintSelect = null,
  onClearTints = null,
  substrateMismatchChoice = null,
  onSubstrateMismatchChoice = null,
  substrateNameFilled = false,
  substrateConditionNameFilled = false,
  mismatchResolved = false,
  onResolveMismatch = null,
  selectedWedge = null,
  onWedgeSelect = null,
    onWedgeSelectIdentity = 'index',
    onWedgeDataChange = null,
    onAvailableModesChange = null, // Callback to pass available modes to parent
    forceActiveDataMode = null, // NEW: Parent-driven override for immediate mode changes
    activeDataMode = 'imported', // Receive from parent instead of local state
    preferredDataMode = null, // Preferred mode based on substrate Delta E calculation
    onActiveDataModeChange = null, // Callback to change active data mode
    // New props for print condition support
    usePrintConditions = false, // Flag to use print conditions instead of substrate conditions
    selectedPrintConditionId = null,
    onPrintConditionChange = null,
    onSelectedPrintConditionChange = null, // Callback to pass selected print condition to parent
    parentPrintCondition = null, // Pre-fetched print condition from parent
    preloadedPrintConditions = null, // Preloaded print conditions for dropdown
    // Edit control props
    isEditMode = false,
    onEdit = null,
    onSave = null,
    onCancel = null,
    saving = false,
    // Passthrough props for creation mode and tab switching
    onCreationModeChange = null,
    onRequestActiveTab = null,
    onValidationChange = null,
    creatingNewSubstrate = false,
    creatingNewSubstrateCondition = false,
    // Performance optimization props - pre-computed data from parent
    preAdaptedWedgeData = null, // Pre-adapted wedge data from parent (avoids duplicate adaptation)
    preSelectedBackground = null, // Selected background from parent
    astmWeightingTable = null, // ASTM weighting table from parent
    disableInternalAdaptationPreview = false, // Skip internal adaptation when parent provides pre-adapted data
    isEditing = false, // NEW: Whether parent is in edit mode
    isAdaptationPending = false, // Flag to prevent empty state during adaptation transition
    // Controlled props for substrate mismatch UI
    showSubstrateOptions: showSubstrateOptionsProp = undefined, // Controlled from parent
    onShowSubstrateOptionsChange = null, // Callback for changes
    creation_origin = null // Track origin to determine which settings to show
  }) => {
  let renderGuardContent = null;
  // Use forced mode if provided (parent override), otherwise use activeDataMode prop
  const effectiveActiveDataMode = forceActiveDataMode ?? activeDataMode;
  
  console.log('🎯 [InkConditionVisuals] Mode resolution:', {
    forceActiveDataMode,
    activeDataMode,
    effectiveActiveDataMode,
    preAdaptedCount: preAdaptedWedgeData?.length || 0
  });
  
  // Helper function to get tint count from various data formats (array, object, or JSON string)
  const getLengthFromUnknown = (data) => {
    if (!data) return 0;
    if (Array.isArray(data)) return data.length;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return getLengthFromUnknown(parsed);
      } catch {
        return 0;
      }
    }
    if (typeof data === 'object') {
      // Handle object with numeric or string keys (e.g., {"0": {...}, "100": {...}})
      const keys = Object.keys(data).filter(k => !['measurement_settings', 'ui_state', 'meta', 'metadata'].includes(k));
      return keys.length;
    }
    return 0;
  };

  // State declarations - must come before early returns that use them
  const [showSubstrateDifferenceDialog, setShowSubstrateDifferenceDialog] = useState(false);
  const [substrateDeltaE, setSubstrateDeltaE] = useState(null);
  
  // Internal state for uncontrolled mode
  const [internalShowSubstrateOptions, setInternalShowSubstrateOptions] = useState(false);

  // Use prop if provided (controlled), otherwise use internal state (uncontrolled)
  const showSubstrateOptions = typeof showSubstrateOptionsProp === 'boolean' 
    ? showSubstrateOptionsProp 
    : internalShowSubstrateOptions;

  // Setter wrapper - updates internal state or calls parent callback
  const setShowSubstrateOptions = useCallback((value) => {
    if (typeof showSubstrateOptionsProp === 'boolean') {
      // Controlled mode - notify parent
      onShowSubstrateOptionsChange?.(value);
    } else {
      // Uncontrolled mode - update internal state
      setInternalShowSubstrateOptions(value);
    }
  }, [showSubstrateOptionsProp, onShowSubstrateOptionsChange]);
  
  // Print condition mismatch handling
  const [printConditionMismatchData, setPrintConditionMismatchData] = useState(null);
  const [showPrintConditionMismatch, setShowPrintConditionMismatch] = useState(false);

  // Guard: Prepare loading UI but do not early return before hooks
  if (effectiveActiveDataMode === null) {
    renderGuardContent = (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading spectral data...</div>
      </div>
    );
  }

  // In adapted mode, check if we have the necessary data
  if (effectiveActiveDataMode === 'adapted') {
    const hasRequiredAstmTables = standards?.astmTables && standards.astmTables.length > 0;
    
    // Check for substrate data from print condition or substrate condition
    const hasSubstrateData = usePrintConditions 
      ? !!(parentPrintCondition?.spectral_data && Object.keys(parentPrintCondition.spectral_data).length > 0)
      : !!condition?.substrate_spectral_data;
    
    // Use robust tint detection that handles arrays, objects, and JSON strings
    const hasAdaptedTints = getLengthFromUnknown(condition?.adapted_tints) > 0;
    const hasImportedTints = getLengthFromUnknown(importedTints) > 0 || getLengthFromUnknown(condition?.imported_tints) > 0;
    
    console.log('🔍 [InkConditionVisuals] Data check for adapted mode:', {
      hasAdaptedTints,
      hasImportedTints,
      adaptedTintsCount: getLengthFromUnknown(condition?.adapted_tints),
      importedTintsCount: getLengthFromUnknown(importedTints),
      conditionImportedTintsCount: getLengthFromUnknown(condition?.imported_tints),
      hasRequiredAstmTables,
      hasSubstrateData,
      substrateDataSource: usePrintConditions ? 'print_condition' : 'substrate_condition',
      usePrintConditions,
      hasPrintConditionSpectral: !!(parentPrintCondition?.spectral_data && Object.keys(parentPrintCondition.spectral_data).length > 0),
      hasSubstrateConditionSpectral: !!condition?.substrate_spectral_data,
      isAdaptationPending
    });
    
    // CRITICAL FIX: Skip empty state during adaptation transition
    if (isAdaptationPending) {
      console.log('⏳ [InkConditionVisuals] Adaptation pending, showing imported data temporarily');
      // Don't set renderGuardContent - let it proceed with available data
    } else if (hasImportedTints && !hasAdaptedTints && (!hasRequiredAstmTables || !hasSubstrateData)) {
      // If we need adaptation but don't have the prerequisites, prepare a helpful message
      renderGuardContent = (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="text-muted-foreground text-center">
            Adapted data requires a substrate with spectral data.
          </div>
          <Button
            variant="outline"
            onClick={() => onActiveDataModeChange?.('imported')}
            size="sm"
          >
            Switch to Imported Mode
          </Button>
        </div>
      );
    } else if (!hasAdaptedTints && !hasImportedTints) {
      // If we have no data at all in adapted mode, show error and fallback option
      renderGuardContent = (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="text-muted-foreground text-center">
            No tint data available for adaptation.
          </div>
          <Button
            variant="outline"
            onClick={() => onActiveDataModeChange?.('imported')}
            size="sm"
          >
            Switch to Imported Mode
          </Button>
        </div>
      );
    }
  }
  
  // Clear mismatch UI when in adapted mode (only in uncontrolled mode)
  // DO NOT gate by isEditMode - data should flow regardless of edit state
  useEffect(() => {
    // Only auto-clear in uncontrolled mode when switching to adapted mode
    if (typeof showSubstrateOptionsProp !== 'boolean' && effectiveActiveDataMode === 'adapted') {
      setInternalShowSubstrateOptions(false);
      setPrintConditionMismatchData(null);
      setSubstrateDeltaE(null);
    }
  }, [effectiveActiveDataMode, showSubstrateOptionsProp]);

  // ISO 5-3 tables for debug density
  const { data: iso53Data } = useIso53DensityTables('T');
  
  // Ref to track last notified print condition ID to prevent duplicate notifications
  const lastNotifiedPrintConditionIdRef = useRef(null);
  
  // Notify parent when print condition changes (use parent's preloaded data)
  useEffect(() => {
    if (!onSelectedPrintConditionChange || !usePrintConditions) {
      return;
    }
    
    // Guard: Prevent notification during initial mount if print condition is null
    if (parentPrintCondition === null && !selectedPrintConditionId) {
      return;
    }
    
    const currentId = parentPrintCondition?.id;
    
    // Only notify if the ID actually changed
    if (currentId === lastNotifiedPrintConditionIdRef.current) {
      return;
    }
    
    console.log('🔄 Notifying parent of print condition change:', currentId);
    lastNotifiedPrintConditionIdRef.current = currentId;
    onSelectedPrintConditionChange(parentPrintCondition);
    
  }, [parentPrintCondition?.id, usePrintConditions]);
  
  // Initialize substrateAdaptationMode based on substrateMismatchChoice
  const getInitialSubstrateAdaptationMode = () => {
    if (substrateMismatchChoice === 'create') return 'create';
    if (substrateMismatchChoice === 'adapt') return 'adapt';
    return 'adapt'; // default value
  };
  
  const [substrateAdaptationMode, setSubstrateAdaptationMode] = useState(getInitialSubstrateAdaptationMode());
  
  // Background selection state
  const [selectedBackground, setSelectedBackground] = useState('Substrate');
  
  // Component-level render tracking for selectedBackground changes
  useEffect(() => {
    console.warn('🔄 [COMPONENT RENDER] selectedBackground changed:', {
      selectedBackground,
      timestamp: Date.now()
    });
  }, [selectedBackground]);
  
  // Gate for when the mismatch popup is allowed to appear
  const allowMismatchPopupRef = useRef(false);
  const prevImportedTintsRef = useRef(importedTints);
  const prevSubstrateKeyRef = useRef(
    (condition?.substrate_condition || condition?.substrate_id) ?? null
  );
  const lastMismatchTriggerRef = useRef(null);
  
  // Update substrateAdaptationMode when substrateMismatchChoice changes
  useEffect(() => {
    const newMode = getInitialSubstrateAdaptationMode();
    setSubstrateAdaptationMode(newMode);
  }, [substrateMismatchChoice]);

  // Fetch substrate spectral data when substrate_condition is assigned
  useEffect(() => {
    const fetchSubstrateSpectralData = async () => {
      if (!condition?.substrate_condition || condition?.substrate_spectral_data) {
        return; // Already have data or no substrate condition to fetch
      }

      try {
        // Try by ID first, fallback to name for compatibility
        let data = null;
        let error = null;
        
        // Check if substrate_condition is a UUID
        const isUUID = condition.substrate_condition.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        
        if (isUUID) {
          const result = await supabase
            .from('substrate_conditions')
            .select('spectral_data, lab, ch, color_hex')
            .eq('id', condition.substrate_condition)
            .maybeSingle();
          data = result.data;
          error = result.error;
        } else {
          // Fallback to name-based lookup for compatibility  
          const result = await supabase
            .from('substrate_conditions')
            .select('spectral_data, lab, ch, color_hex')
            .eq('name', condition.substrate_condition)
            .maybeSingle();
          data = result.data;
          error = result.error;
        }

        if (error) {
          console.warn('Failed to fetch substrate condition:', error);
          return;
        }

        if (data?.spectral_data && onConditionChange) {
          
          onConditionChange(prev => ({
            ...prev,
            substrate_spectral_data: data.spectral_data,
            substrate_lab: data.lab,
            substrate_ch: data.ch,
            substrate_color_hex: data.color_hex
          }));
        }
      } catch (error) {
        console.error('Error fetching substrate spectral data:', error);
      }
    };

    fetchSubstrateSpectralData();
  }, [condition?.substrate_condition, condition?.substrate_spectral_data, onConditionChange]);

  // Use useRef to persist flags across re-renders
  const substrateMismatchShownRef = useRef(false);
  const substrateMismatchCallbackRef = useRef(false);

  // Enhanced trigger mechanism - Allow popup only when user imports new data or changes associated substrate/condition
  useEffect(() => {
    if (prevImportedTintsRef.current !== importedTints) {
      const shouldTrigger = !!importedTints && importedTints.length > 0;
      allowMismatchPopupRef.current = shouldTrigger;
      
      if (shouldTrigger) {
        // Reset mismatch shown flag when new tints are imported
        substrateMismatchShownRef.current = false;
        lastMismatchTriggerRef.current = `import-${Date.now()}`;
        
      }
      
      
      prevImportedTintsRef.current = importedTints;
    }
  }, [importedTints]);

  useEffect(() => {
    const currentKey = (condition?.substrate_condition || condition?.substrate_id) ?? null;
    if (currentKey !== prevSubstrateKeyRef.current && currentKey !== null) {
      allowMismatchPopupRef.current = true;
      
      // Reset mismatch shown flag when substrate changes
      substrateMismatchShownRef.current = false;
      lastMismatchTriggerRef.current = `substrate-${Date.now()}`;
      
      // Reset UI state when substrate changes
      setShowSubstrateOptions(false);
      setShowSubstrateDifferenceDialog(false);
      
      
      prevSubstrateKeyRef.current = currentKey;
    }
  }, [condition?.substrate_condition, condition?.substrate_id]);
  const estimateSubstrateBleedColor = useCallback((substrateHex, tintHex, tintPercentage) => {
    try {
      const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      };

      const rgbToHex = (r, g, b) => {
        return "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
      };

      const substrate = hexToRgb(substrateHex);
      const tint = hexToRgb(tintHex);
      if (!substrate || !tint) return substrateHex || tintHex || '#ffffff';

      const tp = Number(tintPercentage ?? 100);
      const safeTp = Number.isFinite(tp) ? tp : 100;
      const bleedFactor = Math.max(0.1, 1 - (safeTp / 100) * 0.8);

      const blendedR = substrate.r * bleedFactor + tint.r * (1 - bleedFactor);
      const blendedG = substrate.g * bleedFactor + tint.g * (1 - bleedFactor);
      const blendedB = substrate.b * bleedFactor + tint.b * (1 - bleedFactor);

      return rgbToHex(blendedR, blendedG, blendedB);
    } catch (err) {
      console.warn('estimateSubstrateBleedColor failed:', err);
      return substrateHex || tintHex || '#ffffff';
    }
  }, []);

  // Normalize background names to handle variants (Grey/Gray, spaces/underscores, case)
  const normalizeBackgroundName = useCallback((name) => {
    if (!name) return 'Substrate';
    
    const normalized = String(name).trim().toLowerCase().replace(/\s+/g, '_');
    
    // Map common variants to canonical forms
    const mappings = {
      'substrate': 'Substrate',
      'process_black': 'Process_Black',
      'process_grey': 'Process_Grey',
      'process_gray': 'Process_Grey', // Grey/Gray variant
    };
    
    return mappings[normalized] || name; // Return canonical or original
  }, []);

  // Note: Using computeAdaptedSpectralRatio directly for spectral adaptation

  // Helper: resolve a background name from tint data (Smart Import format)
  const getBackgroundName = useCallback((tint, availableBackgroundsArray = null) => {
    if (!tint) return 'Substrate';
    
    // First try direct name fields
    if (tint.backgroundName) return normalizeBackgroundName(tint.backgroundName);
    if (tint.background_name) return normalizeBackgroundName(tint.background_name);
    if (tint.background) return normalizeBackgroundName(tint.background);
    
    // Then try key lookup via availableBackgrounds array (Smart Import format)
    // Keys are in format bgX where X is the array index
    const key = tint.background_key || tint.bg_key || tint.key;
    if (key && availableBackgroundsArray) {
      const match = key.match(/^bg(\d+)$/); // Match bgX format
      if (match) {
        const index = parseInt(match[1], 10);
        const bgName = availableBackgroundsArray[index];
        if (bgName) return normalizeBackgroundName(bgName);
      }
    }
    
    // Last fallback: return normalized key or default
    if (key) return normalizeBackgroundName(key);
    return 'Substrate';
  }, [normalizeBackgroundName]);

  const wedgeData = useMemo(() => {
    
    let patches = [];
    
    // Determine substrate spectral based on context (print condition vs substrate)
    const substrateSpectral = (usePrintConditions && parentPrintCondition?.spectral_data && Object.keys(parentPrintCondition.spectral_data).length > 0)
      ? parentPrintCondition.spectral_data
      : (condition?.substrate_spectral_data || null);
    
    // Check if we have substrate/condition assigned
    const hasSubstrateAssigned = condition?.substrate_id || condition?.substrate_color_hex;
    
    // ROBUST: Source selection that prevents empty charts
    let sourceTints;
    
    // Prepare both sources
    const adaptedNormalized = normalizeTints(condition?.adapted_tints);
    const importedSource =
      (condition?.imported_tints && typeof condition.imported_tints === 'object' && !Array.isArray(condition.imported_tints))
        ? collectRawTints(condition.imported_tints)
        : Array.isArray(condition?.imported_tints)
          ? condition.imported_tints
          : (importedTints?.length > 0 ? importedTints : []);
    
    // Create stable imported arrays for auto-split functionality
    const importedRaw = Array.isArray(importedSource) ? importedSource : collectRawTints(importedSource);
    const importedEffective = importedRaw.length > 0 ? importedRaw : normalizeTints(importedSource);
    const importedSorted = [...importedEffective].sort((a, b) => getTintPercentage(a) - getTintPercentage(b));
    
    // Consider BOTH DB adapted_tints AND pre-computed adapted data from parent
    const hasAdaptedData = adaptedNormalized.length > 0 || (preAdaptedWedgeData && preAdaptedWedgeData.length > 0);
    
    const shouldUseAdapted =
      effectiveActiveDataMode === 'adapted' &&
      hasAdaptedData &&
      !showSubstrateOptions &&
      (forceActiveDataMode ? true : !isAdaptationPending); // Bypass pending flag when parent forces adapted
    
    console.log('🔍 [shouldUseAdapted] Decision:', {
      effectiveActiveDataMode,
      forceActiveDataMode,
      isAdaptationPending,
      hasAdaptedData,
      showSubstrateOptions,
      using: shouldUseAdapted ? 'adapted' : 'imported'
    });
    
    // Prefer pre-computed adapted data, fall back to DB adapted_tints, then imported
    sourceTints = shouldUseAdapted
      ? (preAdaptedWedgeData?.length > 0 ? preAdaptedWedgeData : (condition?.adapted_tints || []))
      : importedSource;
    
    // Safety fallback to prevent empty displays
    if ((!sourceTints || (Array.isArray(sourceTints) && sourceTints.length === 0)) && importedSource?.length > 0) {
      sourceTints = importedSource;
    }
    
    // Show split when:
    // 1. In edit mode AND
    // 2. Adaptation is preferred (whether pending OR complete)
    // 3. We have both imported and adapted data to show
    const effectivePreferredMode = preferredDataMode || activeDataMode;
    const autoSplit = isEditing &&
                      preferredDataMode === 'adapted' &&
                      (preAdaptedWedgeData?.length > 0 || adaptedNormalized?.length > 0) &&
                      (importedEffective.length > 0);
    
    console.info('[Wedge] source selection', {
      activeDataMode,
      preferredDataMode,
      effectivePreferredMode,
      isEditing,
      adaptedCountDB: adaptedNormalized.length,
      preAdaptedCount: preAdaptedWedgeData?.length || 0,
      importedCount: Array.isArray(importedSource) ? importedSource.length : 0,
      using: shouldUseAdapted ? 'adapted' : 'imported',
      usingPreAdapted: shouldUseAdapted && preAdaptedWedgeData?.length > 0,
      showSubstrateOptions,
      isAdaptationPending
    });
    
    console.info('[Wedge] Auto-split detection', {
      autoSplit,
      isEditing,
      preferredDataMode,
      isAdaptationPending,
      preAdaptedCount: preAdaptedWedgeData?.length || 0,
      importedCount: importedEffective.length,
      hasAdaptedData: (preAdaptedWedgeData?.length > 0 || adaptedNormalized?.length > 0),
      hasImportedData: importedEffective.length > 0
    });
    
    // console.log('🎛️ [Wedge] Mode:', activeDataMode, 'Found tints:', sourceTints.length);
    
    
    // Use RAW tints to preserve backgrounds (avoid dedup by percentage)
    const rawTints = Array.isArray(sourceTints) ? sourceTints : collectRawTints(sourceTints);
    const effectiveTints = rawTints.length > 0 ? rawTints : normalizeTints(sourceTints);
    
    // Verification logging for condition view
    
    if (effectiveTints && effectiveTints.length > 0) {
      const sortedTints = [...effectiveTints].sort((a, b) => getTintPercentage(a) - getTintPercentage(b));
      
      // Derive availableBackgrounds array from measurement_settings or ui_state.backgrounds_map
      const availableBackgroundsArray = condition?.measurement_settings?.available_backgrounds || 
        (condition?.ui_state?.backgrounds_map ? 
          Object.keys(condition.ui_state.backgrounds_map)
            .sort((a, b) => {
              const aNum = parseInt(a.replace('bg', ''));
              const bNum = parseInt(b.replace('bg', ''));
              return aNum - bNum;
            })
            .map(key => condition.ui_state.backgrounds_map[key]) 
        : []);
      
      // Use imported sorted tints as base when auto-splitting
      const baseSorted = (autoSplit && !showSubstrateOptions) ? importedSorted : sortedTints;
      const zeroPercentTint = baseSorted.find(tint => getTintPercentage(tint) === 0);
      const nonZeroTints = baseSorted.filter(tint => getTintPercentage(tint) !== 0);
      
      // Broaden hasActiveMismatch to include auto-split scenario
      const hasActiveMismatch = showSubstrateOptions || autoSplit;
      
      // Add defensive logging if auto-split is active but no 0% tint found
      if (hasActiveMismatch && !zeroPercentTint) {
        console.warn('[Wedge] Auto-split active but no 0% tint found in data', {
          importedCount: importedEffective.length,
          sortedCount: baseSorted.length,
          tintPercentages: baseSorted.map(t => getTintPercentage(t))
        });
      }
      
      if (hasActiveMismatch) {
        // Active mismatch case - show splits (substrate + all imported tints as split patches)
        const substratePatch = {
          name: 'Substrate / 0%',
          tintPercentage: 0,
          isSubstrate: true,
          measurementType: 'substrate',
          colorHex: condition?.substrate_color_hex || '#F5F5F5',
          spectralData: substrateSpectral,
          lab: condition?.substrate_lab || { L: 95, a: 0, b: 0 },
          ch: condition?.substrate_ch || { C: 0, h: 0 },
          backgroundName: 'Substrate', // Ensure substrate always has Substrate background
          hasSplit: true,
          splitColor: zeroPercentTint.colorHex,
          splitSpectralData: safeSpectralData(zeroPercentTint),
          splitLab: zeroPercentTint.lab,
          splitCh: zeroPercentTint.ch
        };
        
        patches.push(substratePatch);
        
        // Show all tints as split patches
        const splitTints = nonZeroTints.map(tint => {
          const actualTintPercentage = getTintPercentage(tint);
          
          // PERFORMANCE OPTIMIZATION: Use pre-adapted data if available (from parent)
          let adaptedSpectral = null;
          let adaptedLab = tint.lab;
          let adaptedCh = tint.ch;
          
          if (disableInternalAdaptationPreview && preAdaptedWedgeData?.length > 0) {
            // Use pre-computed adaptation from parent
            const preAdaptedMatch = preAdaptedWedgeData.find(w => getTintPercentage(w) === actualTintPercentage);
            if (preAdaptedMatch) {
              adaptedSpectral = safeSpectralData(preAdaptedMatch);
              adaptedLab = preAdaptedMatch.lab || tint.lab;
              adaptedCh = preAdaptedMatch.ch || tint.ch;
            }
          }
          
          // Fallback: compute adaptation if not pre-provided
          if (!adaptedSpectral) {
            // Get imported substrate data (0% tint from imported tints) - use importedEffective for consistency
            const importedZeroTint = importedEffective.find(t => getTintPercentage(t) === 0);
            const importedSubstrateSpectral = safeSpectralData(importedZeroTint);
            
            // Use two-step substrate adaptation for consistency with ink-based colors
            adaptedSpectral = computeTwoStepSubstrateAdaptation(
              importedSubstrateSpectral,
              safeSpectralData(tint),
              substratePatch.spectralData, 
              actualTintPercentage, 
              {
                enableLogging: false,
                maxCoverage: 0.95,
                opticalGain: 1.1
              }
            );
            
            // Calculate Lab/CH from adapted spectral data
            const weightingTables = astmWeightingTable || (standards?.astmTables && measurementControls ? 
              standards.astmTables.filter(row => 
                row.illuminant_name === measurementControls.illuminant && 
                String(row.observer) === String(measurementControls.observer) && 
                String(row.table_number) === String(measurementControls.table)
              ) : []);
            
            if (adaptedSpectral && weightingTables.length > 0) {
              try {
                const calculatedLab = spectralToLabASTME308(adaptedSpectral, weightingTables);
                if (calculatedLab) {
                  adaptedLab = calculatedLab;
                  adaptedCh = labToChromaHue(calculatedLab.L, calculatedLab.a, calculatedLab.b);
                }
              } catch (error) {
                console.warn('Failed to calculate Lab/CH from adapted spectral:', error);
              }
            }
          }
          
          const estimatedBleedColor = estimateSubstrateBleedColor(substratePatch.colorHex, tint.colorHex, actualTintPercentage);
          
          // Verbose logging disabled - summary only
          // console.log('🔬 Adaptation result:', {
          //   name: tint.name,
          //   tintPercentage: actualTintPercentage,
          //   original: Object.values(tint.spectralData || {})[0],
          //   adapted: Object.values(adaptedSpectral || {})[0],
          //   different: Object.values(tint.spectralData || {})[0] !== Object.values(adaptedSpectral || {})[0],
          //   originalLab: tint.lab,
          //   adaptedLab
          // });
          
          return {
            ...tint,
            backgroundName: getBackgroundName(tint, availableBackgroundsArray), // Ensure consistent background naming
            hasSplit: true,
            // Bottom (Adapted)
            colorHex: estimatedBleedColor,
            spectralData: adaptedSpectral,
            lab: adaptedLab,
            ch: adaptedCh,
            // Top (Imported) - preserve original import data
            splitColor: tint.colorHex,
            splitSpectralData: safeSpectralData(tint),
            splitLab: tint.lab,
            splitCh: tint.ch,
            // Store both data sources for switching
            originalImportData: {
              colorHex: tint.colorHex,
              spectralData: safeSpectralData(tint),
              lab: tint.lab,
              ch: tint.ch
            },
            adaptedData: {
              colorHex: estimatedBleedColor,
              spectralData: adaptedSpectral,
              lab: adaptedLab,
              ch: adaptedCh
            }
          };
        });
        
        patches.push(...splitTints);
      } else {
        // No active mismatch or mismatch resolved - use final tint data
        const cleanedTints = [];
        
        sortedTints.forEach(tint => {
          const { hasSplit, splitColor, splitSpectralData, splitLab, splitCh, ...cleanTint } = tint;
          
          let finalTint = { ...cleanTint };
          
          // For 0% tint (substrate), use substrate spectral data from condition if available
          const tintPercentage = getTintPercentage(cleanTint);
          if (tintPercentage === 0 && substrateSpectral) {
            finalTint.spectralData = substrateSpectral;
            finalTint.isSubstrate = true;
            finalTint.measurementType = 'substrate';
            // Use substrate Lab/CH if available
            if (condition.substrate_lab) {
              finalTint.lab = condition.substrate_lab;
            }
            if (condition.substrate_ch) {
              finalTint.ch = condition.substrate_ch;
            }
            if (condition.substrate_color_hex) {
              finalTint.colorHex = condition.substrate_color_hex;
            }
          }
          
          // Ensure spectralData is consistently assigned for both modes
          // ALWAYS check measurements first - this is where physics-based adapted data lives
          let spectralDataAssigned = false;
          
          if (Array.isArray(cleanTint?.measurements) && cleanTint.measurements.length > 0) {
            try {
              const best = pickBestMeasurement(cleanTint.measurements, measurementControls?.mode);
              if (best?.spectral_data && Object.keys(best.spectral_data).length > 0) {
                finalTint.spectralData = best.spectral_data;
                spectralDataAssigned = true;
                console.log('✅ [Spectral] Assigned from measurements for', tintPercentage + '%', effectiveActiveDataMode, 'mode - data points:', Object.keys(best.spectral_data).length);
              }
              // Preserve measurement background even for single-measurement tints
              if (!finalTint.backgroundName) {
                const measBg = getBackgroundName(best, backgroundsKeyMap || availableBackgroundsArray);
                if (measBg) finalTint.backgroundName = measBg;
              }
            } catch (e) {
              console.warn('InkConditionVisuals: failed to select measurement for spectral data', e);
            }
          }
          
          // Fall back to direct spectral data if no measurements available
          if (!spectralDataAssigned && (!finalTint.spectralData || Object.keys(finalTint.spectralData || {}).length === 0)) {
            const fallbackSpectral = safeSpectralData(cleanTint);
            if (fallbackSpectral && Object.keys(fallbackSpectral).length > 0) {
              finalTint.spectralData = fallbackSpectral;
              console.log('⚠️ [Spectral] Using fallback spectral data for', tintPercentage + '%', effectiveActiveDataMode, 'mode');
            } else {
              console.log('❌ [Spectral] No spectral data found for', tintPercentage + '%', effectiveActiveDataMode, 'mode');
            }
          }
           
           
          // Only assign colorHex if we don't have spectral data to compute from
          // This allows InkWedgePicker to dynamically compute colors from spectral data
          if (!finalTint.colorHex && !finalTint.spectralData) {
            let calculatedColorHex = cleanTint.color_hex || cleanTint.colorHex || cleanTint.color;
            
            // If mismatch was resolved, use the appropriate data based on the choice
            if (mismatchResolved && cleanTint.usingAdaptedData !== undefined) {
              if (cleanTint.usingAdaptedData && cleanTint.adaptedData) {
                calculatedColorHex = cleanTint.adaptedData.colorHex;
              } else if (!cleanTint.usingAdaptedData && cleanTint.originalImportData) {
                calculatedColorHex = cleanTint.originalImportData.colorHex;
              }
            } else if (cleanTint.lab && cleanTint.lab.L !== undefined && cleanTint.lab.a !== undefined && cleanTint.lab.b !== undefined) {
              try {
                calculatedColorHex = labToHex(cleanTint.lab.L, cleanTint.lab.a, cleanTint.lab.b);
              } catch (error) {
                // Fall back to stored color if conversion fails
              }
            }
            
            finalTint.colorHex = calculatedColorHex;
          }
          // Check if this tint has measurements with different backgrounds (works for both imported and adapted modes)
          if (Array.isArray(cleanTint?.measurements) && cleanTint.measurements.length > 1) {
            // Group measurements by background
            const measurementsByBackground = new Map();
            
            cleanTint.measurements.forEach(measurement => {
              // Try measurement first (Pattern B), then tint (Pattern A), then default
              const bgName = getBackgroundName(measurement, availableBackgroundsArray) 
                || getBackgroundName(cleanTint, availableBackgroundsArray) 
                || 'Default';
              
              console.log('🔍 Background detection:', {
                fromMeasurement: getBackgroundName(measurement, availableBackgroundsArray),
                fromTint: getBackgroundName(cleanTint, availableBackgroundsArray),
                final: bgName,
                tintPercentage: getTintPercentage(cleanTint)
              });
              
              if (!measurementsByBackground.has(bgName)) {
                measurementsByBackground.set(bgName, []);
              }
              measurementsByBackground.get(bgName).push(measurement);
            });
            
            // If multiple backgrounds found, create separate wedges
            if (measurementsByBackground.size > 1) {
              console.log('🔍 [Background Split] Splitting tint into multiple backgrounds:', {
                tintPercentage: getTintPercentage(cleanTint),
                activeDataMode,
                backgrounds: Array.from(measurementsByBackground.keys()),
                measurementsPerBackground: Array.from(measurementsByBackground.entries()).map(([bg, meas]) => ({
                  background: bg,
                  count: meas.length
                }))
              });
              
              measurementsByBackground.forEach((measurements, bgName) => {
                const best = pickBestMeasurement(measurements, measurementControls?.mode);
                if (best) {
                  const backgroundSpecificTint = { 
                    ...finalTint,
                    backgroundName: bgName,
                    spectralData: best.spectral_data || finalTint.spectralData,
                    lab: best.lab || finalTint.lab,
                    ch: best.ch || finalTint.ch
                  };
                  console.log('  ✅ Created wedge for background:', {
                    background: bgName,
                    percentage: getTintPercentage(cleanTint),
                    hasSpectralData: !!best.spectral_data,
                    lab: best.lab
                  });
                  cleanedTints.push(backgroundSpecificTint);
                }
              });
              return; // Skip adding the original tint
            }
          }
          
          // Ensure consistent backgroundName for all final tints
          finalTint.backgroundName = getBackgroundName(finalTint, availableBackgroundsArray);
          
          cleanedTints.push(finalTint);
        });
        
        
        
        // If we have a selected substrate but no 0% tint in the import (e.g., solid-only CXF),
        // still show the substrate patch first so the "substrate block" remains visible.
        if (hasSubstrateAssigned && !zeroPercentTint) {
          const substratePatch = {
            name: 'Substrate',
            tintPercentage: 0,
            isSubstrate: true,
            measurementType: 'substrate',
            colorHex: condition?.substrate_color_hex || '#F5F5F5',
            spectralData: condition?.substrate_spectral_data || null,
            lab: condition?.substrate_lab || { L: 95, a: 0, b: 0 },
            ch: condition?.substrate_ch || { C: 0, h: 0 },
            backgroundName: 'Substrate' // Ensure consistent background naming
          };
          patches.push(substratePatch);
        }
        
        patches.push(...cleanedTints);
      }
    } else if (hasSubstrateAssigned) {
      // Substrate/condition assigned but no imported tints - show substrate patch only
      const substratePatch = {
        name: 'Substrate',
        tintPercentage: 0,
        isSubstrate: true,
        measurementType: 'substrate',
        colorHex: condition?.substrate_color_hex || '#F5F5F5',
        spectralData: substrateSpectral,
        lab: condition?.substrate_lab || { L: 95, a: 0, b: 0 },
        ch: condition?.substrate_ch || { C: 0, h: 0 },
        backgroundName: 'Substrate' // Ensure consistent background naming
      };
      
      patches.push(substratePatch);
    }
    // If no substrate assigned and no imported tints, return empty array (new document state)
    
    console.info('[Wedge] Mode/dependency change', {
      effectiveActiveDataMode,
      forceActiveDataMode,
      activeDataMode,
      conditionUiMode: condition?.ui_state?.active_data_mode,
      preferred: condition?.measurement_settings?.preferred_data_mode,
      preAdaptedCount: preAdaptedWedgeData?.length || 0
    });
    
    // console.log('🎯 Final Patches:', patches.map(p => ({ tintPercentage: p.tintPercentage, colorHex: p.colorHex, name: p.name, isSubstrate: p.isSubstrate })));
    return patches;
  }, [
    getBackgroundName, // Add the helper function dependency
    // Mode changes should always rebuild the wedge
    effectiveActiveDataMode,           // USE EFFECTIVE MODE
    forceActiveDataMode,               // TRIGGER REBUILD ON FORCE
    activeDataMode,
    preferredDataMode,                 // NEW: prop used in autoSplit logic
    isEditing,                         // NEW: prop used in autoSplit logic
    condition?.ui_state?.active_data_mode,
    condition?.measurement_settings?.preferred_data_mode,
    // Existing dependencies
    importedTints,
    condition?.imported_tints,
    condition?.adapted_tints, // CRITICAL FIX: Add missing dependency
    substrateMismatchChoice,
    showSubstrateOptions,
    mismatchResolved,
    condition?.substrate_id,
    condition?.substrate_color_hex, 
    condition?.substrate_spectral_data, 
    condition?.substrate_lab, 
    condition?.substrate_ch,
    condition?.ui_state?.backgrounds_map, // Add backgrounds_map dependency
    estimateSubstrateBleedColor,
    standards,
    measurementControls,
    usePrintConditions,
    parentPrintCondition?.spectral_data,
    parentPrintCondition?.id,        // CRITICAL: Force rebuild on every print condition change
    preAdaptedWedgeData,              // CRITICAL: Enables wedge rebuild when adapted tints computed
    isAdaptationPending,               // Controls auto-split activation
    disableInternalAdaptationPreview   // Controls internal adaptation behavior
  ]);

  // Dynamic wedge data that recalculates hex colors from spectral data when measurement controls change
  const dynamicWedgeData = useMemo(() => {
    const baseWedgeData = wedgeData;
    if (!baseWedgeData || !measurementControls || !standards?.astmTables) {
      return baseWedgeData;
    }

    return baseWedgeData.map(wedge => {
      // Recalculate hex for ALL wedges with spectral data (including substrate)
      // Get spectral data from either direct property or measurements array
      const spectralSource = wedge.spectralData || 
        (wedge.measurements?.[0]?.spectral_data ? wedge.measurements[0].spectral_data : null);

      if (spectralSource) {
        try {
          const spectralData = (spectralSource && typeof spectralSource === 'object') ? spectralSource : null;
          if (spectralData && Object.keys(spectralData).length > 0) {
            // Find matching ASTM tables
            const matchingTables = standards.astmTables.filter(row => 
              row.illuminant_name === measurementControls.illuminant && 
              String(row.observer) === String(measurementControls.observer) && 
              String(row.table_number) === String(measurementControls.table)
            );

            if (matchingTables.length > 0) {
              const lab = spectralToLabASTME308(spectralData, matchingTables);
              if (lab) {
                const dynamicHex = labToHexD65(lab.L, lab.a, lab.b, measurementControls.illuminant);
                let updatedWedge = {
                  ...wedge,
                  colorHex: dynamicHex,
                  lab: lab,
                  ch: labToChromaHue(lab.L, lab.a, lab.b)
                };

                // Also recalculate splitColor if this is a split wedge
                if (wedge.hasSplit && wedge.splitSpectralData) {
                  try {
                    const splitSpectralData = (wedge.splitSpectralData && typeof wedge.splitSpectralData === 'object') ? wedge.splitSpectralData : null;
                    if (splitSpectralData && Object.keys(splitSpectralData).length > 0) {
                      const splitLab = spectralToLabASTME308(splitSpectralData, matchingTables);
                      if (splitLab) {
                        const splitHex = labToHexD65(splitLab.L, splitLab.a, splitLab.b, measurementControls.illuminant);
                        updatedWedge.splitColor = splitHex;
                      }
                    }
                  } catch (splitError) {
                    console.warn('Failed to recalculate split color for wedge:', splitError);
                  }
                }

                return updatedWedge;
              }
            }
          }
        } catch (error) {
          console.warn('Failed to recalculate hex for wedge:', error);
        }
      }
      
      // Fallback: if wedge has lab values, recalculate hex with current illuminant
      if (wedge.lab?.L != null && wedge.lab?.a != null && wedge.lab?.b != null) {
        console.log('Using Lab fallback for wedge color calculation');
        try {
          const fallbackHex = labToHexD65(wedge.lab.L, wedge.lab.a, wedge.lab.b, measurementControls.illuminant);
          const fallbackCh = labToChromaHue(wedge.lab.L, wedge.lab.a, wedge.lab.b);
          let fallbackWedge = {
            ...wedge,
            colorHex: fallbackHex,
            ch: fallbackCh
          };
          
          // Also handle split color if it has lab values
          if (wedge.hasSplit && wedge.splitLab?.L != null && wedge.splitLab?.a != null && wedge.splitLab?.b != null) {
            try {
              const fallbackSplitHex = labToHexD65(wedge.splitLab.L, wedge.splitLab.a, wedge.splitLab.b, measurementControls.illuminant);
              fallbackWedge.splitColor = fallbackSplitHex;
            } catch (splitFallbackError) {
              console.warn('Split Lab fallback also failed:', splitFallbackError);
            }
          }
          
          return fallbackWedge;
        } catch (fallbackError) {
          console.warn('Lab fallback also failed:', fallbackError);
        }
      }
      
      return wedge;
    });
  }, [wedgeData, measurementControls, standards?.astmTables]);

  // Utility: flatten tints without dedup to preserve backgrounds
  function collectRawTints(input) {
    if (!input) return [];
    let data = input;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return []; }
    }

    const expandMeasurements = (entry, sourceKey = null) => {
      if (!entry) return [];
      const { measurements, ...rest } = entry;
      const groupBgName = rest.backgroundName ?? rest.background_name ?? rest.background ?? rest.name ?? null;
      const groupBgKey = rest.background_key ?? rest.bg_key ?? rest.key ?? null;
      const inferredName = groupBgName ?? sourceKey ?? null;
      const inferredKey = groupBgKey ?? sourceKey ?? null;
      if (Array.isArray(measurements) && measurements.length > 0) {
        return measurements.map((m) => {
          const mBgName = m.backgroundName ?? m.background_name ?? m.background ?? m.name ?? inferredName;
          const mBgKey = m.background_key ?? m.bg_key ?? m.key ?? inferredKey;
          const merged = {
            ...rest,
            ...m,
            ...(mBgName ? { backgroundName: mBgName } : {}),
            ...(mBgKey ? { background_key: mBgKey } : {}),
            tintPercentage: rest.tintPercentage ?? rest.tint_percentage ?? rest.tint ?? m.tintPercentage ?? m.tint_percentage ?? m.tint ?? rest.percentage,
          };
          return merged;
        });
      }
      const bgName = rest.backgroundName ?? rest.background_name ?? rest.background ?? inferredName;
      const bgKey = rest.background_key ?? rest.bg_key ?? inferredKey;
      return [{
        ...rest,
        ...(bgName ? { backgroundName: bgName } : {}),
        ...(bgKey ? { background_key: bgKey } : {}),
      }];
    };

    const toArray = (d, sourceKey = null) => {
      if (!d) return [];
      if (Array.isArray(d)) {
        return d.flatMap((v) => {
          if (!v) return [];
          if (Array.isArray(v)) return toArray(v, sourceKey);
          if (v?.tints && Array.isArray(v.tints)) return v.tints.flatMap((t) => expandMeasurements(t, sourceKey));
          return expandMeasurements(v, sourceKey);
        }).filter(Boolean);
      }
      if (typeof d === 'object') {
        if (Array.isArray(d.tints)) return d.tints.flatMap((t) => expandMeasurements(t, sourceKey));
        if (d.tints && typeof d.tints === 'object') return Object.entries(d.tints).flatMap(([k, t]) => expandMeasurements(t, k));
        // exclude known metadata keys and expand nested objects/arrays, propagating the object key as background
        const entries = Object.entries(d).filter(([k]) => !['measurement_settings','ui_state','meta','metadata','$schema','schema','_meta'].includes(k));
        return entries.flatMap(([k, v]) => {
          if (Array.isArray(v)) return toArray(v, k);
          if (v && typeof v === 'object') {
            // Preserve parent-level fields like tintPercentage when expanding nested objects
            const expanded = expandMeasurements(v, k);
            return expanded.map(item => ({
              tintPercentage: d.tintPercentage ?? d.tint_percentage ?? d.tint,
              ...item
            }));
          }
          return [];
        }).filter(Boolean);
      }
      return [];
    };

    const result = toArray(data);
    // console.log('🧩 collectRawTints:', { inputType: typeof input, count: result.length });
    return result;
  }

  // Build stable backgroundsKeyMap preserving original order of Smart Import array or numeric bgX order
  const backgroundsKeyMap = useMemo(() => {
    const ms = condition?.measurement_settings;
    if (Array.isArray(ms?.available_backgrounds) && ms.available_backgrounds.length > 0) {
      return ms.available_backgrounds; // keep order as-is for bg index mapping
    }
    const map = condition?.ui_state?.backgrounds_map;
    if (map && typeof map === 'object') {
      return Object.keys(map)
        .sort((a, b) => parseInt(a.replace('bg',''),10) - parseInt(b.replace('bg',''),10))
        .map(k => map[k]);
    }
    return null;
  }, [condition?.measurement_settings?.available_backgrounds, condition?.ui_state?.backgrounds_map]);

  // STRICT: Compute available backgrounds (Smart Import format - use array)
  const availableBackgrounds = useMemo(() => {
    // Get available_backgrounds array from measurement_settings (Smart Import format)
    const ms = condition?.measurement_settings || {};
    const availableBgArray = Array.isArray(ms.available_backgrounds) ? ms.available_backgrounds : null;
    
    // Priority 1: If we have available_backgrounds in measurement_settings, merge it with tint data
    if (availableBgArray && availableBgArray.length > 0) {
      // Preserve the original order from measurement_settings for correct bg index mapping
      const norm = (bg) => normalizeBackgroundName(bg);
      const base = availableBgArray.map(norm);
      const seen = new Set(base);
      const extras = [];

      // Also collect backgrounds from tints to catch any missing ones (append in first-seen order)
      const importedSource = condition?.imported_tints || importedTints || [];
      const rawTints = collectRawTints(importedSource);
      rawTints.forEach(tint => {
        const srcName = tint.backgroundName || tint.background_name;
        const name = srcName ? norm(srcName) : null;
        if (name && !seen.has(name)) {
          seen.add(name);
          extras.push(name);
        }
      });

      const merged = [...base, ...extras];
      // console.log('🎛️ [Background] Using available_backgrounds from measurement_settings + tints (order preserved):', merged);
      return merged;
    }
    
    // Priority 2: Collect from wedgeData
    const wedgeDataBackgrounds = new Set();
    if (wedgeData && wedgeData.length > 0) {
      wedgeData.forEach(wedge => {
        const background = getBackgroundName(wedge, availableBgArray);
        if (background) wedgeDataBackgrounds.add(background);
      });
      
      if (wedgeDataBackgrounds.size > 0) {
        // console.log('🎛️ [Background] Using backgrounds from processed wedgeData:', Array.from(wedgeDataBackgrounds));
        return Array.from(wedgeDataBackgrounds).map(bg => normalizeBackgroundName(bg)).sort();
      }
    }
    
    // Priority 3: Collect from raw tints
    const adaptedNormalized = normalizeTints(condition?.adapted_tints);
    const useAdapted = activeDataMode === 'adapted' && adaptedNormalized.length > 0;
    const importedSource = condition?.imported_tints || importedTints || [];
    const sourceTints = useAdapted ? condition?.adapted_tints : importedSource;
    
    const rawFromMode = collectRawTints(sourceTints);
    const rawFromAdapted = collectRawTints(condition?.adapted_tints);
    const rawFromImported = collectRawTints(importedSource);
    const rawTints = [...(rawFromMode || []), ...(rawFromAdapted || []), ...(rawFromImported || [])];
    
    // Background Calculation Debug logs disabled
    // { activeDataMode, useAdapted, rawTintsLength: rawTints.length, hasAvailableBgArray: !!availableBgArray, availableBgArrayLength: availableBgArray?.length || 0 }
    
    if (rawTints.length === 0) {
      // console.log('🎛️ [Background] No raw tints found, defaulting to Substrate');
      return ['Substrate'];
    }
    
    const backgrounds = new Set();
    rawTints.forEach((tint, index) => {
      const background = getBackgroundName(tint, availableBgArray);
      if (background) backgrounds.add(background);
    });

    // Ensure substrate option appears if a substrate is assigned
    const hasSubstrateAssigned = !!(condition?.substrate_id || condition?.substrate_color_hex || condition?.substrate_spectral_data);
    if (hasSubstrateAssigned) {
      backgrounds.add('Substrate');
    }

    if (backgrounds.size === 0) {
      backgrounds.add('Substrate');
    }
    
    const result = Array.from(backgrounds).map(bg => normalizeBackgroundName(bg)).sort();
    // console.log('🎛️ [Background] Final result:', result);
    return result;
  }, [getBackgroundName, normalizeBackgroundName, activeDataMode, importedTints, condition?.imported_tints, condition?.adapted_tints, condition?.measurement_settings?.available_backgrounds, condition?.substrate_id, condition?.substrate_color_hex, condition?.substrate_spectral_data]);
  // Persist backgrounds & keys when detected from tints but missing in measurement_settings
  const backgroundsPersistedSigRef = React.useRef('');
  useEffect(() => {
    if (!condition?.id) return;
    const sig = `${condition.id}|${(availableBackgrounds || []).join('|')}`;
    if (!sig || sig === backgroundsPersistedSigRef.current) return;
    const ms = condition?.measurement_settings || {};
    const current = Array.isArray(ms.available_backgrounds) ? ms.available_backgrounds : [];
    if (availableBackgrounds.length > 1 && current.length <= 1) {
      const keyFor = (bg) => {
        const idx = availableBackgrounds.indexOf(bg);
        return idx >= 0 ? `bg${idx}` : undefined;
      };
      const attachKeys = (tints) => Array.isArray(tints)
        ? tints.map(t => {
            const name = t.backgroundName || t.background_name;
            const key = t.background_key || (name ? keyFor(name) : undefined);
            return { ...t, ...(key && { background_key: key }) };
          })
        : tints;

      const updatedMs = { ...ms, available_backgrounds: availableBackgrounds };
      const updatedImported = attachKeys(condition.imported_tints);
      const updatedAdapted = attachKeys(condition.adapted_tints);

      supabase
        .from('ink_conditions')
        .update({
          measurement_settings: updatedMs,
          imported_tints: updatedImported,
          adapted_tints: updatedAdapted
        })
        .eq('id', condition.id)
        .then(({ error }) => {
          if (!error && onConditionChange) {
            backgroundsPersistedSigRef.current = sig;
            onConditionChange(prev => ({
              ...prev,
              measurement_settings: updatedMs,
              imported_tints: updatedImported,
              adapted_tints: updatedAdapted
            }));
          }
        });
    }
  }, [condition?.id, availableBackgrounds, onConditionChange]);

  // STRICT: Compute available measurement modes - SANITIZED to only include M0-M3
  const availableModes = useMemo(() => {
    // Get available modes from measurement_settings first
    const settingsModes = condition?.measurement_settings?.available_modes || [];
    
    // Only keep measurement modes (M0–M3)
    const measurementModes = settingsModes.filter(mode => /^M[0-3]$/.test(mode));
    if (measurementModes.length > 0) {
      return measurementModes;
    }
    
    // Fallback: extract from actual tint measurements
    const modes = new Set();
    const adaptedNormalized = normalizeTints(condition?.adapted_tints);
    const importedSource = (importedTints?.tints || importedTints || condition?.imported_tints?.tints || condition?.imported_tints || []);
    const useAdapted = activeDataMode === 'adapted' && adaptedNormalized.length > 0;
    const effectiveTints = useAdapted ? adaptedNormalized : normalizeTints(importedSource);

    effectiveTints.forEach((tint) => {
      if (Array.isArray(tint?.measurements)) {
        tint.measurements.forEach((measurement) => {
          const mode = measurement?.assignedMode || measurement?.mode || measurement?.measurementMode || measurement?.measurement_mode;
          if (mode && /^M[0-3]$/.test(mode)) {  // Only real measurement modes
            modes.add(mode);
          }
        });
      }
    });

    console.log('🔧 Available modes calculation:', {
      settingsModes,
      measurementModes,
      usedSource: useAdapted ? 'adapted' : 'imported',
      fallbackModes: Array.from(modes),
      result: measurementModes.length > 0 ? measurementModes : Array.from(modes)
    });
    
    return Array.from(modes).sort();
  }, [activeDataMode, importedTints, condition?.imported_tints, condition?.adapted_tints, condition?.measurement_settings]);

  // Notify parent of available modes changes (only when content actually changes)
  const availableModesSigRef = React.useRef('');
  useEffect(() => {
    if (!onAvailableModesChange) return;
    const sig = Array.isArray(availableModes) ? availableModes.join('|') : String(availableModes);
    if (sig !== availableModesSigRef.current) {
      availableModesSigRef.current = sig;
      onAvailableModesChange(availableModes);
    }
  }, [availableModes, onAvailableModesChange]);

  // Keep selectedBackground valid if data changes
  useEffect(() => {
    if (!availableBackgrounds.includes(selectedBackground)) {
      const normalized = normalizeBackgroundName(availableBackgrounds[0] || 'Substrate');
      setSelectedBackground(normalized);
    }
  }, [availableBackgrounds, selectedBackground, normalizeBackgroundName]);

  // Switch to adapted mode when mismatch is resolved
  useEffect(() => {
    if (mismatchResolved && activeDataMode !== 'adapted' && onActiveDataModeChange) {
      onActiveDataModeChange('adapted');
    }
  }, [mismatchResolved, activeDataMode, onActiveDataModeChange]);

  // Filter wedge data by selected background (use dynamic data)
  const filteredWedgeData = useMemo(() => {
    console.warn('🔄 FILTER USEMEMO EXECUTING', {
      selectedBackground,
      dynamicWedgeDataLength: dynamicWedgeData?.length
    });
    
    // Prefer the stable key map to resolve bg indices
    const resolverArray = backgroundsKeyMap || availableBackgrounds;

    // Get unique backgrounds that actually exist in the data
    const uniqueBackgrounds = [...new Set(dynamicWedgeData.map(w => getBackgroundName(w, resolverArray)))];

    // Count distribution of backgrounds in current data
    const distribution = dynamicWedgeData.reduce((acc, w) => {
      const bg = getBackgroundName(w, resolverArray) || 'Unknown';
      acc[bg] = (acc[bg] || 0) + 1;
      return acc;
    }, {});
    
    console.warn('🔍 [BACKGROUND FILTER DEBUG]', {
      selectedBackground: `"${selectedBackground}"`,
      selectedBackgroundLength: selectedBackground?.length,
      uniqueBackgrounds: uniqueBackgrounds.map(bg => `"${bg}"`),
      totalWedges: dynamicWedgeData.length,
      availableBackgroundsFromUI: availableBackgrounds,
      distribution
    });

    const backgroundFiltered = dynamicWedgeData.filter(wedge => {
      const background = getBackgroundName(wedge, resolverArray);
      return background === selectedBackground;
    });

    // Deduplicate: ensure only one wedge per (backgroundName + tintPercentage) combination
    const seen = new Map();
    const deduplicated = [];
    
    backgroundFiltered.forEach(wedge => {
      const resolvedBg = getBackgroundName(wedge, resolverArray);
      const key = `${resolvedBg}:${getTintPercentage(wedge)}`;
      if (!seen.has(key)) {
        seen.set(key, true);
        deduplicated.push(wedge);
      }
    });

    console.warn('✅ [FILTER RESULTS]', {
      beforeDeduplication: backgroundFiltered.length,
      afterDeduplication: deduplicated.length,
      selectedBackground: `"${selectedBackground}"`,
      percentagesKept: deduplicated.map(w => getTintPercentage(w)).sort((a,b) => a-b),
      duplicatesRemoved: backgroundFiltered.length - deduplicated.length
    });

    return deduplicated;
  }, [dynamicWedgeData, selectedBackground, availableBackgrounds, backgroundsKeyMap, getBackgroundName]);

  // Reset selected wedge when background changes and index is out of range - default to solid (100%)
  useEffect(() => {
    if (filteredWedgeData && selectedWedge >= filteredWedgeData.length && onWedgeSelect && filteredWedgeData.length > 0) {
      const solidIndex = findSolidWedgeIndex(filteredWedgeData);
      // console.log('[InkConditionVisuals] Out-of-range after background change, defaulting to solid index:', solidIndex);
      handleWedgeSelect(solidIndex);
    }
  }, [filteredWedgeData, selectedWedge, onWedgeSelect]);

  // Auto-select solid wedge (100%) on initial load for new conditions
  useEffect(() => {
    if (!filteredWedgeData || filteredWedgeData.length === 0) return;
    if (selectedWedge !== null) return; // Don't override existing selection
    if (!onWedgeSelect) return;
    
    const solidIndex = findSolidWedgeIndex(filteredWedgeData);
    // console.log('[InkConditionVisuals] Initial auto-select solid index:', solidIndex);
    handleWedgeSelect(solidIndex);
  }, [filteredWedgeData, selectedWedge, onWedgeSelect]);

  // Notify parent of wedge data changes (only when content actually changes)
  const wedgeSigRef = React.useRef('');
  useEffect(() => {
    if (!onWedgeDataChange) return;
    // Build a lightweight signature to detect meaningful changes without heavy JSON
    const sig = Array.isArray(filteredWedgeData)
      ? filteredWedgeData.map(w => `${getTintPercentage(w)}:${w.colorHex ?? w.hex ?? w.color ?? ''}:${w.splitColor ?? ''}:${w.isSubstrate ? 1 : 0}`).join('|')
      : '';
    if (sig !== wedgeSigRef.current) {
      wedgeSigRef.current = sig;
      onWedgeDataChange(filteredWedgeData);
    }
  }, [filteredWedgeData, onWedgeDataChange]);
  
  // Reset selected wedge when wedge data changes and current selection is out of bounds - default to solid (100%)
  useEffect(() => {
    if (dynamicWedgeData && selectedWedge >= dynamicWedgeData.length && onWedgeSelect && dynamicWedgeData.length > 0) {
    const solidIndex = findSolidWedgeIndex(dynamicWedgeData);
    // console.log('[InkConditionVisuals] Out-of-range after wedge data change, defaulting to solid index:', solidIndex);
    handleWedgeSelect(solidIndex);
    }
  }, [dynamicWedgeData, selectedWedge, onWedgeSelect]);

  // Sync local state with parent when the mode changes - FIXED to prevent infinite loop
  useEffect(() => {
    // Only sync if the change is from user interaction, not from parent prop changes
    if (showSubstrateOptions && substrateAdaptationMode && onSubstrateMismatchChoice && !substrateMismatchCallbackRef.current) {
      const expectedChoice = substrateAdaptationMode === 'create' ? 'create' : 'adapt';
      // Only call the parent if the choice is different from what we expect
      if (substrateMismatchChoice !== expectedChoice) {
        substrateMismatchCallbackRef.current = true;
        onSubstrateMismatchChoice(expectedChoice);
        // Reset the flag after a short delay to allow for future calls
        setTimeout(() => {
          substrateMismatchCallbackRef.current = false;
        }, 100);
      }
    }
  }, [showSubstrateOptions, substrateAdaptationMode, onSubstrateMismatchChoice, substrateMismatchChoice]);

  useEffect(() => {
    // If UI is already showing mismatch options/dialog and user hasn't resolved it, keep it visible
    if ((showSubstrateOptions || showSubstrateDifferenceDialog) && !mismatchResolved) {
      return;
    }

    // Reset the flag when new imports come in or substrate mismatch choice changes
    if (!substrateMismatchChoice) {
      substrateMismatchShownRef.current = false;
    }
    
    // If mismatch has been resolved, don't show it again
    if (mismatchResolved) {
      return;
    }
    
    // Modified mismatch detection logic:
    // 1. Always check for mismatch when importing data with substrate (0% tint)
    // 2. If no substrate is selected yet, show mismatch options but don't calculate deltaE
    
    const hasSelectedSubstrateCondition = condition && (condition.substrate_id || condition.substrate_condition_id || condition.substrate_condition);
    console.log('🔍 Substrate selection check:', {
      hasSelectedSubstrateCondition,
      substrate_id: condition?.substrate_id,
      substrate_condition_id: condition?.substrate_condition_id,
      substrate_condition: condition?.substrate_condition
    });
    
    // Use unified tint source to consider both live imports and saved condition data
    const rawSourceTints = activeDataMode === 'adapted'
      ? condition?.imported_tints
      : (importedTints || condition?.imported_tints);
    const sourceTints = normalizeTints(rawSourceTints);
    const hasImportedData = sourceTints && sourceTints.length > 0;
    const hasMeasurementControls = measurementControls;
    
    // Skip mismatch detection if we're already in adapted mode viewing saved adapted data
    const isViewingAdaptedData = activeDataMode === 'adapted' && condition?.adapted_tints?.length > 0;
    
    // Find substrate patch from unified source
    const importedSubstrate = sourceTints?.find(tint => getTintPercentage(tint) === 0);
    console.log('🔎 Mismatch check using mode:', activeDataMode, 'source tints length:', sourceTints.length);
    console.log('🔍 Imported substrate found:', !!importedSubstrate, importedSubstrate?.lab);
    console.log('🔍 Is viewing adapted data:', isViewingAdaptedData);
    
    // If we have imported data with substrate, proceed with mismatch detection
    if (hasImportedData && hasMeasurementControls && importedSubstrate) {
      // Skip deltaE if missing lab data
      if (!importedSubstrate.lab) {
        setSubstrateDeltaE(null);
        if (showSubstrateDifferenceDialog) setShowSubstrateDifferenceDialog(false);
        if (showSubstrateOptions) setShowSubstrateOptions(false);
        return;
      }
      
      if (hasSelectedSubstrateCondition) {
        // User has selected a substrate/condition - calculate mismatch
        let substrateLabForComparison = null;
        
        // 1. Try substrate_lab from condition (from linked substrate condition)
        if (condition.substrate_lab) {
          substrateLabForComparison = condition.substrate_lab;
        }
        // 2. Try condition's own lab values if it's a substrate-like condition
        else if (condition.lab && condition.tint_percentage === 0) {
          substrateLabForComparison = condition.lab;
        }
        
        // Compute deltaE based on context:
        // - For print conditions: use printConditionMismatchData (from card)
        // - For ink conditions: compute directly from substrate comparison
        const deltaE = usePrintConditions
          ? printConditionMismatchData?.deltaE
          : (importedSubstrate?.lab && substrateLabForComparison)
            ? calculateDeltaE(
                importedSubstrate.lab,
                substrateLabForComparison,
                measurementControls?.deltaE || 'dE00'
              )
            : null;
        
        console.log('🔍 ΔE check:', {
          deltaE,
          threshold: 1,
          hasMismatchData: !!printConditionMismatchData,
          allowMismatchPopup: allowMismatchPopupRef.current,
          substrateMismatchShown: substrateMismatchShownRef.current,
          showSubstrateDifferenceDialog,
          showSubstrateOptions,
          lastTrigger: lastMismatchTriggerRef.current
        });
        
        setSubstrateDeltaE(deltaE);
        
        if (deltaE && deltaE > 1) {
          // Always show the mismatch card when mismatch is detected
          if (!showSubstrateOptions) {
            console.log('🔧 Setting showSubstrateOptions = true, deltaE:', deltaE);
            setShowSubstrateOptions(true);
          }
          
          // Enhanced popup logic - show dialog when triggered by substrate/import changes
          const shouldShowDialog = allowMismatchPopupRef.current && 
                                 !substrateMismatchShownRef.current && 
                                 !showSubstrateDifferenceDialog &&
                                 lastMismatchTriggerRef.current !== null;
          
          if (shouldShowDialog) {
            console.log('🔧 Showing substrate mismatch dialog, trigger:', lastMismatchTriggerRef.current);
            setShowSubstrateDifferenceDialog(true);
            substrateMismatchShownRef.current = true;
            // Don't consume the trigger immediately - let it persist for a bit
            setTimeout(() => {
              allowMismatchPopupRef.current = false;
            }, 100);
          } else {
            console.log('🚫 Mismatch popup blocked:', {
              alreadyShown: substrateMismatchShownRef.current,
              allowPopup: allowMismatchPopupRef.current,
              dialogOpen: showSubstrateDifferenceDialog,
              trigger: lastMismatchTriggerRef.current
            });
          }
        } else {
          // No mismatch, reset state completely
          console.log('🔧 No mismatch detected, resetting all state');
          if (showSubstrateDifferenceDialog) {
            setShowSubstrateDifferenceDialog(false);
          }
          if (showSubstrateOptions) {
            setShowSubstrateOptions(false);
          }
          substrateMismatchShownRef.current = false;
          allowMismatchPopupRef.current = false;
          lastMismatchTriggerRef.current = null;
        }
      } else {
        // Selected substrate/condition doesn't have lab data to compare
        console.log('🔍 No lab data for comparison, resetting mismatch state');
        setSubstrateDeltaE(null);
        if (showSubstrateDifferenceDialog) setShowSubstrateDifferenceDialog(false);
        if (showSubstrateOptions) setShowSubstrateOptions(false);
        substrateMismatchShownRef.current = false;
        allowMismatchPopupRef.current = false;
        lastMismatchTriggerRef.current = null;
      }
    } else {
      // Reset mismatch state when conditions are not met for detection
      console.log('🔍 Conditions not met for mismatch detection, resetting state');
      setSubstrateDeltaE(null);
      if (showSubstrateDifferenceDialog) setShowSubstrateDifferenceDialog(false);
      if (showSubstrateOptions) setShowSubstrateOptions(false);
      substrateMismatchShownRef.current = false;
      allowMismatchPopupRef.current = false;
      lastMismatchTriggerRef.current = null;
    }
  }, [activeDataMode, importedTints, condition?.imported_tints, condition?.substrate_id, condition?.substrate_condition_id, condition?.substrate_condition, condition?.substrate_lab, condition?.lab, condition?.tint_percentage, measurementControls?.table, substrateMismatchChoice, mismatchResolved, printConditionMismatchData]);

  // Set preferred_data_mode based on PrintConditionCardSimple's deltaE calculation
  // Set preferred_data_mode in LOCAL STATE based on deltaE (but don't persist to DB yet)
  useEffect(() => {
    // Use the appropriate deltaE based on context:
    // - usePrintConditions=true → printConditionMismatchData.deltaE (print condition comparison)
    // - usePrintConditions=false → substrateDeltaE (substrate condition comparison)
    const deltaE = usePrintConditions 
      ? printConditionMismatchData?.deltaE 
      : substrateDeltaE;
    
    if (!deltaE) return;
    
    const shouldUseAdaptedMode = deltaE > 1;
    const preferredMode = shouldUseAdaptedMode ? 'adapted' : 'imported';
    
    // Only update LOCAL STATE if mode needs to change
    // DO NOT persist to database here - that happens on save
    if (condition?.measurement_settings?.preferred_data_mode !== preferredMode) {
      console.log('🎯 Setting preferred_data_mode in LOCAL STATE (will persist on save):', {
        context: usePrintConditions ? 'from_color (print condition)' : 'from_ink (substrate condition)',
        deltaE,
        preferredMode,
        currentMode: condition?.measurement_settings?.preferred_data_mode,
        threshold: 1,
        willPersistOnSave: true
      });
      
      if (onConditionChange) {
        onConditionChange('measurement_settings', {
          ...condition.measurement_settings,
          preferred_data_mode: preferredMode,
          substrate_delta_e: deltaE,
          delta_e_updated_at: new Date().toISOString()
        });
        
        // Sync parent's active mode for immediate UI update (split view)
        if (onActiveDataModeChange) {
          onActiveDataModeChange(preferredMode);
        }
      }
    } else {
      // Mode is already correct - just ensure split view is synced
      console.log('✅ Mode already correct, ensuring split view sync:', {
        preferredMode,
        currentMode: condition?.measurement_settings?.preferred_data_mode
      });
      if (onActiveDataModeChange && activeDataMode !== preferredMode) {
        onActiveDataModeChange(preferredMode);
      }
    }
  }, [
    usePrintConditions, 
    printConditionMismatchData?.deltaE, 
    substrateDeltaE, 
    condition?.measurement_settings?.preferred_data_mode,
    onConditionChange, 
    onActiveDataModeChange,
    activeDataMode
  ]);

  const selectedData = filteredWedgeData[selectedWedge];
  
  // Calculate dynamic Lab/CH values from spectral data for the selected item
  // For substrate (0% tint), use condition's substrate spectral data if available
  const isSelectedSubstrate = selectedData?.isSubstrate || getTintPercentage(selectedData || {}) === 0;
  const selectedSpectralData = isSelectedSubstrate && condition?.substrate_spectral_data
    ? condition.substrate_spectral_data
    : selectedData?.spectralData;
    
  // Removed useSpectralCalculations; rely on existing selectedData/condition values
  const dynamicColorCalculations = { lab: null, ch: null };
  
  // Prioritize pre-calculated adapted values when in adapted mode, otherwise use dynamic calculations
  const finalSelectedLab = (activeDataMode === 'adapted' && selectedData?.lab) 
    ? selectedData.lab 
    : dynamicColorCalculations?.lab || selectedData?.lab || condition?.lab;
  const finalSelectedCh = (activeDataMode === 'adapted' && selectedData?.ch) 
    ? selectedData.ch 
    : dynamicColorCalculations?.ch || selectedData?.ch || condition?.ch;
  const finalSelectedHex = finalSelectedLab ? 
    labToHexD65(finalSelectedLab.L, finalSelectedLab.a, finalSelectedLab.b, measurementControls?.illuminant || 'D50') :
    (selectedData?.colorHex || getSolidColorHex(condition, activeDataMode));
  
  console.debug('ColorInfoPanel Lab calculation:', {
    isSelectedSubstrate,
    hasSubstrateSpectral: !!condition?.substrate_spectral_data,
    hasSpectralData: !!selectedSpectralData,
    hasDynamicCalc: !!dynamicColorCalculations,
    dynamicLab: dynamicColorCalculations?.lab,
    storedLab: selectedData?.lab,
    finalLab: finalSelectedLab,
    illuminant: measurementControls?.illuminant,
    observer: measurementControls?.observer,
    table: measurementControls?.table
  });
  
  // Get import data for comparison if substrate difference detected
  const normalizedImportedTints = normalizeTints(importedTints || condition?.imported_tints);
  const importSubstrate = normalizedImportedTints.find(tint => getTintPercentage(tint) === 0);
  const selectedImportData = normalizedImportedTints.find(tint => 
    getTintPercentage(tint) === getTintPercentage(selectedData || {})
  );

  // Memoized wedge selection handler - extract index and forward to parent
  const handleWedgeSelect = useCallback((selection) => {
    console.log('🟣🟣🟣 HANDLE WEDGE SELECT CALLED 🟣🟣🟣', {
      selection,
      selectionType: typeof selection,
      hasOnWedgeSelect: !!onWedgeSelect,
      hasOnTintSelect: !!onTintSelect,
      filteredWedgeDataLength: filteredWedgeData?.length,
    });

    // selection may be a number or an object { index, tintPercentage }
    const index = typeof selection === 'object' && selection !== null
      ? (Number.isFinite(selection.index) ? selection.index : null)
      : selection;

    console.log('🟣 Normalized index:', index);

    if (index === null || index === undefined) {
      console.warn('🔴 Index is null or undefined, aborting');
      return;
    }

    console.log('🎯 Wedge selected in InkConditionVisuals, normalized index:', index);
    const tintPercentage = (filteredWedgeData && filteredWedgeData[index]) ? getTintPercentage(filteredWedgeData[index]) : null;

    if (onWedgeSelect) {
      const payload = onWedgeSelectIdentity === 'tintPercentage' || onWedgeSelectIdentity === 'object'
        ? { tintPercentage, index }
        : index;
      console.log('🟢 Calling parent onWedgeSelect with payload:', payload);
      onWedgeSelect(payload);
      console.log('✅ Parent onWedgeSelect called');
    } else {
      console.warn('🔴 onWedgeSelect callback missing in InkConditionVisuals');
    }

    if (onTintSelect && filteredWedgeData && filteredWedgeData[index]) {
      const selectedTint = filteredWedgeData[index];
      console.log('🟢 Calling onTintSelect with tint:', selectedTint);
      onTintSelect(selectedTint, index);
    }
  }, [onWedgeSelect, onTintSelect, filteredWedgeData, onWedgeSelectIdentity]);

  // Memoized substrate adaptation change handler
  const handleSubstrateAdaptationChange = useCallback((mode) => {
    setSubstrateAdaptationMode(mode);
    if (onSubstrateMismatchChoice) {
      onSubstrateMismatchChoice(mode === 'new' ? 'create' : 'adapt');
    }
  }, [onSubstrateMismatchChoice]);

  // Handler for substrate mismatch save
  const handleSubstrateMismatchSave = useCallback(() => {
    console.log('💾 Save button clicked with mode:', substrateAdaptationMode);
    console.log('💾 Current state before save:', {
      showSubstrateOptions,
      mismatchResolved,
      importedTintsLength: importedTints?.length,
      usePrintConditions,
      hasSelectedPrintCondition: !!parentPrintCondition
    });
    
    // Determine the target substrate spectral data (print condition or substrate condition)
    const targetSubstrateSpectral = usePrintConditions && parentPrintCondition?.spectral_data
      ? parentPrintCondition.spectral_data
      : condition?.substrate_spectral_data;
    
    const targetSubstrateLab = usePrintConditions && parentPrintCondition?.lab
      ? parentPrintCondition.lab
      : condition?.substrate_lab;
      
    const targetSubstrateColorHex = usePrintConditions && parentPrintCondition?.color_hex
      ? parentPrintCondition.color_hex
      : condition?.substrate_color_hex;
      
    const targetSubstrateCh = usePrintConditions && parentPrintCondition?.ch
      ? parentPrintCondition.ch
      : condition?.substrate_ch;
    
    if (substrateAdaptationMode === 'adapt' && importedTints) {
      // Store both original imported data and adapted versions
      const normalizedTints = normalizeTints(importedTints);
      const adaptedTints = normalizedTints.map(tint => {
        // Calculate adapted hex, lab, and spectral values based on current substrate
        let adaptedColorHex = tint.colorHex;
        let adaptedLab = tint.lab;
        let adaptedCh = tint.ch;
        let adaptedSpectralData = tint.spectralData;
        
        if (getTintPercentage(tint) === 0) {
          // Use target substrate data for 0% tint
          adaptedColorHex = targetSubstrateColorHex || '#F5F5F5';
          adaptedLab = targetSubstrateLab || tint.lab;
          adaptedCh = targetSubstrateCh || tint.ch;
          adaptedSpectralData = targetSubstrateSpectral || tint.spectralData;
        } else if (targetSubstrateColorHex) {
          // Blend with target substrate for other tints - calculate proper spectral adaptation
          const actualPercentage = getTintPercentage(tint) || 100;
          adaptedColorHex = estimateSubstrateBleedColor(targetSubstrateColorHex, tint.colorHex, actualPercentage);
          console.log('🔬 Adaptation save - tint:', { 
            name: tint.name, 
            originalPercentage: getTintPercentage(tint),
            actualPercentage,
            usedPercentage: actualPercentage,
            usePrintConditions,
            hasTargetSubstrate: !!targetSubstrateSpectral
          });
          
          // For lab values, use physics-based calculation from adapted spectral when possible
          if (targetSubstrateSpectral && Object.keys(safeSpectralData(tint)).length > 0) {
            // Calculate Lab from the adapted spectral data we'll compute below
            const importedZeroTint = normalizedTints.find(t => getTintPercentage(t) === 0);
            const importedSubstrateSpectral = safeSpectralData(importedZeroTint);
            
            const tempAdaptedSpectralData = computeTwoStepSubstrateAdaptation(
              importedSubstrateSpectral,
              safeSpectralData(tint),
              targetSubstrateSpectral, 
              actualPercentage,
              {
                enableLogging: false, // Skip logging for Lab calculation
                maxCoverage: 0.95,
                opticalGain: 1.1
              }
            );
            
            // Convert adapted spectral to Lab
            if (tempAdaptedSpectralData && Object.keys(tempAdaptedSpectralData).length > 0) {
              try {
                adaptedLab = spectralToLabASTME308(tempAdaptedSpectralData);
                adaptedCh = {
                  C: Math.sqrt(adaptedLab.a**2 + adaptedLab.b**2),
                  h: (Math.atan2(adaptedLab.b, adaptedLab.a) * 180 / Math.PI + 360) % 360
                };
              } catch (error) {
                console.warn('Failed to convert adapted spectral to Lab, falling back to linear interpolation:', error);
                // Fallback to linear interpolation only if spectral conversion fails
                if (targetSubstrateLab && tint.lab) {
                  const tintRatio = (getTintPercentage(tint)) / 100;
                  const substrateRatio = 1 - tintRatio;
                  
                  adaptedLab = {
                    L: (targetSubstrateLab.L * substrateRatio) + (tint.lab.L * tintRatio),
                    a: (targetSubstrateLab.a * substrateRatio) + (tint.lab.a * tintRatio),
                    b: (targetSubstrateLab.b * substrateRatio) + (tint.lab.b * tintRatio)
                  };
                  
                  adaptedCh = {
                    C: Math.sqrt(adaptedLab.a**2 + adaptedLab.b**2),
                    h: (Math.atan2(adaptedLab.b, adaptedLab.a) * 180 / Math.PI + 360) % 360
                  };
                }
              }
            }
          } else if (targetSubstrateLab && tint.lab) {
            // Fallback to linear interpolation only when spectral data is not available
            const tintRatio = (getTintPercentage(tint)) / 100;
            const substrateRatio = 1 - tintRatio;
            
            adaptedLab = {
              L: (targetSubstrateLab.L * substrateRatio) + (tint.lab.L * tintRatio),
              a: (targetSubstrateLab.a * substrateRatio) + (tint.lab.a * tintRatio),
              b: (targetSubstrateLab.b * substrateRatio) + (tint.lab.b * tintRatio)
            };
            
            adaptedCh = {
              C: Math.sqrt(adaptedLab.a**2 + adaptedLab.b**2),
              h: (Math.atan2(adaptedLab.b, adaptedLab.a) * 180 / Math.PI + 360) % 360
            };
          }
          
          // For spectral data, use two-step substrate adaptation for consistency
          if (targetSubstrateSpectral && Object.keys(safeSpectralData(tint)).length > 0) {
            // Get imported substrate data (0% tint from imported tints)
            const importedZeroTint = normalizedTints.find(t => getTintPercentage(t) === 0);
            const importedSubstrateSpectral = safeSpectralData(importedZeroTint);
            
            adaptedSpectralData = computeTwoStepSubstrateAdaptation(
              importedSubstrateSpectral,
              safeSpectralData(tint),
              targetSubstrateSpectral, 
              actualPercentage,
              {
                enableLogging: true,
                maxCoverage: 0.95,
                opticalGain: 1.1
              }
            );
          }
        }
        
        return {
          ...tint,
          // Store original imported values
          originalImportData: {
            colorHex: tint.colorHex,
            lab: tint.lab,
            ch: tint.ch,
            spectralData: safeSpectralData(tint)
          },
          // Store adapted values
          adaptedData: {
            colorHex: adaptedColorHex,
            lab: adaptedLab,
            ch: adaptedCh,
            spectralData: adaptedSpectralData
          },
          // Current values (using adapted)
          colorHex: adaptedColorHex,
          lab: adaptedLab,
          ch: adaptedCh,
          spectralData: adaptedSpectralData,
          isAdapted: true,
          usingAdaptedData: true,
          // Remove split display state
          hasSplit: false,
          splitSpectralData: undefined,
          splitColorHex: undefined,
          splitLab: undefined,
          splitCh: undefined
        };
      });
      
      console.log('💾 Updating with adapted tints:', adaptedTints);
      
      // Find the adapted solid color (100% tint) for condition-level updates
      const adaptedSolidTint = adaptedTints.find(t => getTintPercentage(t) === 100);
      let adaptedSolidHex = null;
      let adaptedSolidLab = null;
      
      if (adaptedSolidTint?.adaptedData) {
        adaptedSolidHex = adaptedSolidTint.adaptedData.colorHex;
        adaptedSolidLab = adaptedSolidTint.adaptedData.lab;
        console.log('💾 TRACE: Found adapted solid color:', { hex: adaptedSolidHex, lab: adaptedSolidLab });
      }
      
      // Update the condition with adapted tints but preserve original data
      console.log('💾 TRACE: InkConditionVisuals: Storing adapted data in tints without replacing originals');
      
      // Create updated tints with adapted data stored alongside original
      const tintsWithAdaptedData = normalizedTints.map(originalTint => {
        const adaptedTint = adaptedTints.find(at => 
          getTintPercentage(at) === getTintPercentage(originalTint)
        );
        
        if (adaptedTint?.adaptedData) {
          return {
            ...originalTint,
            adaptedData: adaptedTint.adaptedData,
            usingAdaptedData: true,
            isAdapted: true
          };
        }
        return originalTint;
      });
      
      if (onConditionChange) {
        onConditionChange('imported_tints', tintsWithAdaptedData);
        
        // Also update condition-level color data to match adapted solid
        if (adaptedSolidHex) {
          console.log('💾 TRACE: Updating condition color_hex to adapted solid:', adaptedSolidHex);
          onConditionChange('color_hex', adaptedSolidHex);
        }
        if (adaptedSolidLab) {
          console.log('💾 TRACE: Updating condition lab to adapted solid:', adaptedSolidLab);
          onConditionChange('lab', adaptedSolidLab);
        }
      }
      
      // NOTE: preferred_data_mode is now auto-set by deltaE detection logic above
      // Only update adapted_at timestamp here
      if (onConditionChange && condition) {
        console.log('💾 TRACE: Updating adapted_at timestamp in measurement_settings');
        onConditionChange('measurement_settings', {
          ...condition.measurement_settings,
          adapted_at: new Date().toISOString()
        });
      }
      
      // Immediate persistence for existing conditions
      if (condition?.id && !isNew) {
        console.log('💾 TRACE: Immediately persisting adapted data to database');
        const persistAdaptedData = async () => {
          try {
            const updateData = {
              imported_tints: tintsWithAdaptedData,
              measurement_settings: {
                ...condition.measurement_settings,
                adapted_at: new Date().toISOString()
                // NOTE: preferred_data_mode already set by deltaE detection
              },
              updated_at: new Date().toISOString()
            };
            
            // Include adapted solid color in database update
            if (adaptedSolidHex) {
              updateData.color_hex = adaptedSolidHex;
            }
            if (adaptedSolidLab) {
              updateData.lab = adaptedSolidLab;
            }
            
            const { error } = await supabase
              .from('ink_conditions')
              .update(updateData)
              .eq('id', condition.id);
              
            if (error) {
              console.error('❌ Failed to persist adapted data:', error);
            } else {
              console.log('✅ Adapted data persisted to database');
            }
          } catch (error) {
            console.error('❌ Error persisting adapted data:', error);
          }
        };
        persistAdaptedData();
      }
      
      // Inform parent we chose to adapt to existing substrate
      console.log('💾 TRACE: InkConditionVisuals: Setting substrate mismatch choice to adapt');
      if (onSubstrateMismatchChoice) {
        onSubstrateMismatchChoice('adapt');
      }
      
      // Switch to adapted mode after saving adapted data
      console.log('💾 TRACE: InkConditionVisuals: Setting active data mode to adapted');
      if (onActiveDataModeChange) {
        onActiveDataModeChange('adapted');
      }
      
      console.log('✅ Updated condition.imported_tints with adapted data and set activeDataMode to adapted');
    } else if (substrateAdaptationMode === 'create') {
      // Store both original and adapted data but use original values
      const normalizedTints = normalizeTints(importedTints);
      const tints = normalizedTints.map(tint => ({
        ...tint,
        // Store original imported values
        originalImportData: {
          colorHex: tint.colorHex,
          lab: tint.lab,
          ch: tint.ch,
          spectralData: safeSpectralData(tint)
        },
        // Current values (using original import)
        isAdapted: true,
        usingAdaptedData: false,
        // Remove split display state
        hasSplit: false,
        splitSpectralData: undefined,
        splitColorHex: undefined,
        splitLab: undefined,
        splitCh: undefined
      }));
      
      console.log('💾 Updating with original tints:', tints);
      
      if (onConditionChange) {
        onConditionChange('imported_tints', tints);
      }
      
      if (onSubstrateMismatchChoice) {
        onSubstrateMismatchChoice('create');
      }
    }
    
    // Mark mismatch as resolved and hide options
    
    if (onResolveMismatch) {
      onResolveMismatch(true);
    }
    setShowSubstrateOptions(false);
    setSubstrateDeltaE(null);
  }, [
    substrateAdaptationMode, 
    importedTints, 
    onConditionChange, 
    onSubstrateMismatchChoice, 
    condition?.substrate_color_hex, 
    condition?.substrate_lab,
    condition?.substrate_ch,
    condition?.substrate_spectral_data,
    estimateSubstrateBleedColor, 
    onResolveMismatch,
    onActiveDataModeChange,
    usePrintConditions,
    parentPrintCondition,
    showSubstrateOptions,
    mismatchResolved,
    condition?.id,
    condition?.measurement_settings,
    isNew
  ]);

  // Memoized spectral plot data - shows imported or adapted data based on mismatch option
  const spectralPlotData = useMemo(() => {
    if (!showSubstrateOptions) {
      // When not in mismatch resolution mode, respect effectiveActiveDataMode
      const plotData = filteredWedgeData.map(wedge => {
        if (effectiveActiveDataMode === 'adapted' && wedge.adaptedData?.spectralData) {
          return {
            ...wedge,
            spectralData: wedge.adaptedData.spectralData
          };
        }
        return wedge;
      }).filter(item => item.spectralData && Object.keys(item.spectralData).length > 0);
      
      
      return plotData;
    }

    // During mismatch mode, show data based on adaptation choice
    const plotData = filteredWedgeData.map(wedge => {
      const isSubstratePatch = !!(wedge.isSubstrate || wedge.measurementType === 'substrate' || getTintPercentage(wedge) === 0);

      let chosenSpectral = wedge.spectralData;

      if (substrateAdaptationMode === 'create') {
        // New mode: show imported data for all patches
        chosenSpectral = wedge.splitSpectralData || wedge.originalImportData?.spectralData || wedge.spectralData;
      } else {
        // Adapt mode: show ONLY adapted data for all patches (no splitSpectralData fallback)
        chosenSpectral = wedge.adaptedData?.spectralData || wedge.spectralData;
      }

      return {
        ...wedge,
        spectralData: chosenSpectral
      };
    }).filter(item => item.spectralData && Object.keys(item.spectralData).length > 0);

    // Log summary for debugging

    return plotData;
  }, [showSubstrateOptions, substrateAdaptationMode, filteredWedgeData, effectiveActiveDataMode]);

  // Debug substrate spectral data in tone plot
  const debugToneSubstrate = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debugToneSubstrate');
  
  // Manual density calculations for verification
  useEffect(() => {
    if (debugToneSubstrate && filteredWedgeData?.length && iso53Data?.weightingFunctions) {
      console.log('🔍 Tone Plot Substrate Debug:', {
        filteredWedgeDataCount: filteredWedgeData.length,
        hasSubstrateSpectral: !!condition?.substrate_spectral_data,
        measurementControls
      });

      // Find substrate and solid patches
      const substratePatch = filteredWedgeData.find(w => 
        w.isSubstrate || w.measurementType === 'substrate' || getTintPercentage(w) === 0
      );
      const solidPatch = filteredWedgeData.find(w => getTintPercentage(w) === 100);

      if (substratePatch && solidPatch) {
        // Manual density calculation using ISO 5-3
        const calculateManualDensity = (spectralData, channel) => {
          if (!spectralData || !iso53Data.weightingFunctions[channel]) return null;
          
          let numerator = 0;
          let denominator = 0;
          
          for (const wavelength in spectralData) {
            const wl = parseInt(wavelength);
            const reflectance = spectralData[wavelength] / 100; // Convert to 0-1
            const weight = iso53Data.weightingFunctions[channel][wl];
            
            if (weight !== undefined && reflectance !== undefined) {
              numerator += reflectance * weight;
              denominator += weight;
            }
          }
          
          if (denominator === 0) return null;
          const tristimulus = numerator / denominator;
          return -Math.log10(tristimulus);
        };

        // Calculate densities for all channels
        const channels = ['red', 'green', 'blue', 'visual'];
        const substrateDensities = {};
        const solidDensities = {};

        channels.forEach(channel => {
          substrateDensities[channel] = calculateManualDensity(substratePatch.spectralData, channel);
          solidDensities[channel] = calculateManualDensity(solidPatch.spectralData, channel);
        });

        // Find primary channel (highest density difference)
        let primaryChannel = 'green';
        let maxDifference = 0;
        channels.forEach(channel => {
          const diff = (solidDensities[channel] || 0) - (substrateDensities[channel] || 0);
          if (diff > maxDifference) {
            maxDifference = diff;
            primaryChannel = channel;
          }
        });

        console.log('📊 Manual Tone Plot Density Calculations:', {
          substrate: substrateDensities,
          solid: solidDensities,
          primaryChannel,
          maxDifference,
          substrateSpectralDataUsed: !!substratePatch.spectralData,
          substrateSpectralSample: substratePatch.spectralData ? 
            Object.keys(substratePatch.spectralData).slice(0, 3).map(k => `${k}:${substratePatch.spectralData[k]}`) : 'none'
        });

        // Verify substrate patch is using condition.substrate_spectral_data
        const isUsingCorrectSubstrate = substratePatch.spectralData === condition.substrate_spectral_data;
        console.log('✅ Substrate Data Verification:', {
          isUsingCorrectSubstrate,
          substrateDataSource: isUsingCorrectSubstrate ? 'condition.substrate_spectral_data' : 'unknown',
          substratePatchData: substratePatch
        });
      }
    }
  }, [debugToneSubstrate, filteredWedgeData, condition?.substrate_spectral_data, iso53Data?.weightingFunctions, measurementControls]);



  if (!condition) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Loading condition data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (renderGuardContent) {
    return renderGuardContent;
  }
  return (
    <div className="space-y-6">
      {/* General Info Section - Ink Condition Info Panel (hide when using print conditions OR when from_color origin) */}
      {!usePrintConditions && creation_origin !== 'from_color' && (
        <div>
          <InkConditionInfoPanel
            condition={condition}
            onConditionChange={onConditionChange}
            canEdit={canEdit}
            showEditControls={showEditControls}
            isNew={isNew}
            substrateMismatchChoice={substrateMismatchChoice}
            substrateNameFilled={substrateNameFilled}
            substrateConditionNameFilled={substrateConditionNameFilled}
            isEditMode={isEditMode}
            onEdit={onEdit}
            onSave={onSave}
            onCancel={onCancel}
            saving={saving}
              onCreationModeChange={onCreationModeChange}
              onRequestActiveTab={onRequestActiveTab}
              onValidationChange={onValidationChange}
              creatingNewSubstrate={creatingNewSubstrate}
              creatingNewSubstrateCondition={creatingNewSubstrateCondition}
          />
        </div>
      )}

      {/* Print Condition Settings - For ink-based colors */}
      {usePrintConditions && (
        <PrintConditionCardSimple
          selectedPrintConditionId={selectedPrintConditionId}
          onPrintConditionChange={onPrintConditionChange}
          importedSubstrate={normalizeTints(activeDataMode === 'adapted' ? (condition?.adapted_tints || []) : (importedTints || condition?.imported_tints || [])).find(t => getTintPercentage(t) === 0)}
          disableMismatchChecks={activeDataMode === 'adapted'}
          onSubstrateMismatch={(mismatchData) => {
            // ALWAYS set printConditionMismatchData for mode-setting logic
            setPrintConditionMismatchData(mismatchData);
            
            // Substrate comparison should always happen, regardless of edit mode
            // Only the UI controls are gated by isEditMode
          }}
          canEdit={canEdit}
          standardType="print"
          isEditMode={isEditMode}
          onEdit={onEdit}
          onSave={onSave}
          onCancel={() => {
            // Reset print condition selection and mode
            onPrintConditionChange?.(null);
            onActiveDataModeChange?.('imported');
            setShowSubstrateOptions(false);
            setPrintConditionMismatchData(null);
            setSubstrateDeltaE(null);
            // Call parent onCancel if provided
            onCancel?.();
          }}
          saving={saving}
          disableFetch={true}
          preloadedPrintCondition={parentPrintCondition}
          preloadedPrintConditions={preloadedPrintConditions}
        />
      )}


      {/* Substrate Mismatch Card - only for "from_ink" creation context in edit mode */}
      {!usePrintConditions && 
       condition?.creation_origin === 'from_ink' && 
       isEditMode && 
       !isHidden && 
       substrateDeltaE > 1 && (
        <SubstrateMismatchCard 
          showSubstrateOptions={showSubstrateOptions}
          substrateAdaptationMode={substrateAdaptationMode}
          onSubstrateAdaptationChange={handleSubstrateAdaptationChange}
          onSave={handleSubstrateMismatchSave}
          substrateNameFilled={substrateNameFilled}
          substrateConditionNameFilled={substrateConditionNameFilled}
          deltaE={substrateDeltaE}
          context="from-import"
        />
      )}
      
      {/* Wedge Picker - Full Width */}
      <div className="space-y-4">
        {/* Helper note when raw tints exist but none are recognized after normalization */}
        {((importedTints || condition?.imported_tints) && normalizeTints(importedTints || condition?.imported_tints).length === 0) && (
          <div className="text-sm text-muted-foreground">No valid tints recognized from the imported data. Showing substrate only.</div>
        )}
        <InkWedgePicker 
          key={`wedge-${effectiveActiveDataMode}`}
          wedgeData={filteredWedgeData}
          importedTints={importedTints}
          selectedWedge={selectedWedge}
          onWedgeSelect={handleWedgeSelect}
          availableBackgrounds={availableBackgrounds}
          selectedBackground={selectedBackground}
          onBackgroundChange={setSelectedBackground}
          availableModes={availableModes}
          showSubstrateOptions={showSubstrateOptions}
          substrateAdaptationMode={substrateAdaptationMode}
          measurementControls={measurementControls}
          standards={standards}
          onSubstrateAdaptationChange={handleSubstrateAdaptationChange}
          substrateConditionSpectral={usePrintConditions && parentPrintCondition?.spectral_data 
            ? parentPrintCondition.spectral_data 
            : condition?.substrate_spectral_data}
          activeDataMode={effectiveActiveDataMode}
        />
        
        {/* Debug section to clear bad tints - only show for missing or incomplete imported_tints */}
        {(() => {
          // Check if we have proper imported_tints data or if we're using fallback/temporary data
          const hasProperImportedTints = condition?.imported_tints && 
            (Array.isArray(condition.imported_tints) ? condition.imported_tints.length > 0 : 
             Object.keys(condition.imported_tints).some(key => !['measurement_settings', 'ui_state', 'meta', 'metadata'].includes(key)));
          
          const hasTemporaryFallback = !hasProperImportedTints && importedTints && importedTints.length > 0;
          
          return hasTemporaryFallback && onClearTints;
        })() && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-yellow-800">Temporary Tint Data Detected</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  The current tints appear to be fallback data. Clear them to import new CxF data.
                </p>
              </div>
              <button
                onClick={onClearTints}
                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm"
              >
                Clear Tints
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Tone Plot and Spectral Plot side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <InkDotGainPlot 
            wedgeData={filteredWedgeData}
            selectedWedge={selectedWedge}
            measurementControls={measurementControls}
          />
        </div>
        
        <div>
          <SpectralPlot 
            data={spectralPlotData && spectralPlotData.length > 0 ? (spectralPlotData[selectedWedge]?.spectralData || spectralPlotData[0]?.spectralData) : null}
            multipleSpectra={spectralPlotData}
            selectedTintIndex={Math.min(selectedWedge ?? 0, Math.max(0, (spectralPlotData?.length || 1) - 1))}
          />
        </div>
      </div>

      {/* Color Information Cards */}
      <div>
        {(() => {
          const showComparisonPanel = Boolean(showSubstrateOptions && (selectedData?.isAdapted === true));
          return (
            <ColorInfoPanelHorizontal 
              lab={finalSelectedLab}
              ch={finalSelectedCh}
              colorHex={finalSelectedHex}
              showComparison={showComparisonPanel}
              importLab={selectedImportData?.lab}
              importCh={selectedImportData?.ch}
              importColorHex={selectedImportData?.colorHex}
            />
          );
        })()}
      </div>
      
      {/* Substrate Difference Dialog */}
      <SubstrateDifferenceDialog
        isOpen={showSubstrateDifferenceDialog}
        onClose={() => {
          setShowSubstrateDifferenceDialog(false);
          // Keep mismatch card visible - user can still see and interact with options
          console.log('🔧 Dialog closed, keeping mismatch card visible');
        }}
        deltaEValue={substrateDeltaE}
        deltaEMethod={measurementControls?.table || 'dE00'}
      />
    </div>
  );
};

export default InkConditionVisuals;