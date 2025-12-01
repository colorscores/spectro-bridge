import React, { useState, useEffect, useCallback, useRef, useMemo, startTransition } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save, Loader2, ChevronDown, Edit3, X, Upload, Plus, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast as showToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/integrations/supabase/client';
import ColorSettingsBox from '@/components/ColorSettingsBox';

import { useProfile } from '@/context/ProfileContext';
import { useInksData } from '@/context/InkContext';
import { useAppContext } from '@/context/AppContext';
import { useSubstratesData } from '@/context/SubstrateContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
// Removed useCanEditInk import to avoid dispatcher errors
import Breadcrumb from '@/components/Breadcrumb';
import InkConditionDetailHeader from '@/components/inks/InkConditionDetailHeader';
import InkConditionInfoTab from '@/components/inks/InkConditionInfoTab';
import InkInfoTab from '@/components/inks/InkInfoTab';
import InkConditionMatchesTab from '@/components/inks/InkConditionMatchesTab';
import HistoryTab from '@/components/common/HistoryTab';
import SubstrateConditionFormTab from '@/components/substrates/SubstrateConditionFormTab';
import SubstrateInfoFormWrapper from '@/components/substrates/SubstrateInfoFormWrapper';
import SubstrateConditionCreator from '@/components/conditions/SubstrateConditionCreator';
import CxfImportDialogWrapper from '@/components/cxf/CxfImportDialogWrapper';
import CxfParserClient from '@/components/substrate/CxfParserClient';
import { generateRandomSpectralData, spectralToLabASTME308, labToHex, adaptTintsToSubstrate } from '@/lib/colorUtils';
import { calculateInkConditionColorHex } from '@/lib/colorUtils/inkConditionColorHex';
import { parseCgats } from '@/lib/cgatsParser';
import LoadingErrorBoundary from '@/components/LoadingErrorBoundary';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { generateInkConditionName, shouldUseAutoNameForInkCondition } from '@/lib/inkConditionNaming';
import { generateSubstrateConditionName } from '@/lib/substrateConditionNaming';
import { findSolidWedgeIndex, getSolidColorFromCondition } from '@/lib/wedgeUtils';
import { normalizeTints, getTintPercentage } from '@/lib/tintsUtils';
import { useSubstrateConditionCreation } from '@/hooks/useSubstrateConditionCreation';
import { useInkConditionBackfill } from '@/hooks/useInkConditionBackfill';
import { createSubstrateConditionFromTints as createSubstrateConditionFromTintsUtil } from '@/lib/substrateConditionFromTints';
import PrintColorCardPanel from '@/components/matching/PrintColorCardPanel';



const InkConditionDetail = () => {
  // Removed console log that was causing render tracking noise
  // Component initialization
  const { inkId, conditionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
const toast = showToast;
  
  // Check for full-add mode from URL parameters
  const searchParams = new URLSearchParams(location.search);
  const isFullAddMode = searchParams.get('mode') === 'full-add';
  const fullAddConditionId = searchParams.get('conditionId');
  const { profile, loading: profileLoading } = useProfile();
  const { optimisticUpdateInk, optimisticUpdateInkCondition, optimisticAddInkCondition, allInks, forceRefreshConditions, loadConditionDetails } = useInksData();
  const { appMode, setAppMode, setNavGroupSelections, refetch: refetchColors } = useAppContext();
  
  // Form for managing ink properties - moved up to prevent initialization issues
  const inkForm = useForm({
    defaultValues: {
      name: '',
      print_process: '',
      ink_type: '',
      curve: 'as_measured',
      appearance_type: 'standard',
      opacity_left: undefined,
      metallic_gloss: undefined,
      series: '',
      book_id: ''
    }
  });
  const { substrates, refetch: refetchSubstrates, optimisticAddSubstrate, optimisticAddSubstrateCondition } = useSubstratesData();
  const { canEdit: hasRolePermission, isSuperadmin } = useRoleAccess();
  const isNew = !conditionId || conditionId === 'new';
  
  // Form for managing substrate properties when creating new substrates
  const substrateForm = useForm({
    defaultValues: {
      name: '',
      type: '',
      material: '',
      surface_quality: '',
      contrast: '',
      color: '',
      finish: '',
      printing_side: '',
      weight: '',
      thickness: '',
      metallic_intensity: null,
      ink_adhesion: ''
    }
  });
  
  // Track user selections and page initialization to prevent auto-select from overriding user choices
  const userHasSelectedRef = useRef(false);
  const pageInitializedRef = useRef(false);
  const calculationInProgressRef = useRef(false);
  const initializationRef = useRef(false);
  // Track if the user explicitly changed data mode (guards persistence)
  const hasUserChangedModeRef = useRef(false);
  
  // Local ink state (may be fetched separately)
  const [ink, setInk] = useState(null);
  

  // (will resolve currentInk and canEdit after state declarations)
  
  // Get current wedge data for live color updates
  const [currentWedgeData, setCurrentWedgeData] = useState(null);

  // Handle wedge data changes from child component with proper equality checks
  const handleWedgeDataChange = useCallback((wedgeData) => {
    // Prevent overlapping calculations
    if (calculationInProgressRef.current) return;
    
    calculationInProgressRef.current = true;
    
    // Only update if data has actually changed (deep equality check on relevant fields)
    setCurrentWedgeData(prev => {
      if (!prev && !wedgeData) return prev;
      if (!prev || !wedgeData) return wedgeData;
      if (prev.length !== wedgeData.length) return wedgeData;
      
      // Check if meaningful data has changed
      const hasChanged = prev.some((item, index) => {
        const newItem = wedgeData[index];
        return item?.tintPercentage !== newItem?.tintPercentage ||
               item?.colorHex !== newItem?.colorHex ||
               item?.splitColor !== newItem?.splitColor ||
               item?.isSubstrate !== newItem?.isSubstrate;
      });
      
      return hasChanged ? wedgeData : prev;
    });
    
    // Clear calculation flag immediately since we're using functional setState
    calculationInProgressRef.current = false;
  }, []);


  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [condition, setCondition] = useState(null); // Restored to original
  const [isPrintPanelOpen, setIsPrintPanelOpen] = useState(false);
  const [printColorData, setPrintColorData] = useState(null);
  const [originalCondition, setOriginalCondition] = useState(null);
  // const [ink, setInk] = useState(null); // moved earlier
  const [isEditMode, setIsEditMode] = useState(isNew);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const [measurementControls, setMeasurementControls] = useState({
    mode: 'M0',
    illuminant: 'D50',
    observer: '2',
    table: '5',
  });

  // Resolve current ink and edit permissions after states
  const currentInk = allInks.find(inkRec => inkRec.id === inkId);
  
  // Calculate edit permissions locally without using React hooks
  // profile and roleAccess already declared above
  const canEdit = (() => {
    if (!hasRolePermission || !profile?.organization_id || !currentInk?.organization_id) {
      return false;
    }
    if (isSuperadmin) {
      return true;
    }
    return profile.organization_id === currentInk.organization_id;
  })();

  // Initialize ink form with current ink data
  useEffect(() => {
    if (currentInk || ink) {
      const inkData = currentInk || ink;
      inkForm.reset({
        name: inkData.name || '',
        print_process: inkData.print_process || '',
        ink_type: inkData.ink_type || '',
        curve: inkData.curve || 'as_measured',
        appearance_type: inkData.appearance_type || 'standard',
        opacity_left: inkData.opacity_left,
        metallic_gloss: inkData.metallic_gloss,
        series: inkData.series || '',
        book_id: inkData.book_id || ''
      });
    }
  }, [currentInk, ink]);

  // Utilities for substrate condition creation and backfill
  const [isCreating, setIsCreating] = useState(false);
  const createSubstrateConditionFromTints = useCallback(async (inkConditionId, substrateId, organizationId) => {
    setIsCreating(true);
    try {
      return await createSubstrateConditionFromTintsUtil(inkConditionId, substrateId, organizationId);
    } finally {
      setIsCreating(false);
    }
  }, []);
  const { createSubstrateConditionFromImportedTints } = useSubstrateConditionCreation();
  const { triggerBackfill, isBackfilling } = useInkConditionBackfill();

  // Removed excessive console logs to reduce re-render noise
  // Compatibility auto-fix for non-UUID substrate conditions
  const fixSubstrateConditionId = useCallback(async (condition) => {
    if (!condition?.substrate_condition || 
        condition.substrate_condition.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return condition; // Already UUID or empty
    }
    
    console.log('[DEBUG] Auto-fixing non-UUID substrate_condition:', condition.substrate_condition);
    
    try {
      const { data: substrateCondition, error } = await supabase
        .from('substrate_conditions')
        .select('id, name, spectral_data, lab, ch, color_hex')
        .eq('name', condition.substrate_condition)
        .single();
      
      if (!error && substrateCondition) {
        console.log('[DEBUG] Resolved substrate condition to UUID:', substrateCondition.id);
        
        // Update the condition with UUID and hydrate substrate data
        const fixedCondition = {
          ...condition,
          substrate_condition: substrateCondition.id,
          substrate_spectral_data: substrateCondition.spectral_data,
          substrate_lab: substrateCondition.lab,
          substrate_ch: substrateCondition.ch,
          substrate_color_hex: substrateCondition.color_hex
        };
        
        // Save the fix to database
        await supabase
          .from('ink_conditions')
          .update({ substrate_condition: substrateCondition.id })
          .eq('id', condition.id);
        
        return fixedCondition;
      }
    } catch (error) {
      console.warn('[DEBUG] Failed to auto-fix substrate_condition:', error);
    }
    
    return condition;
  }, []);

  // State for available measurement modes from imported data
  const [availableModes, setAvailableModes] = useState([]);

  // Handle available modes changes with equality checks
  const handleAvailableModesChange = useCallback((newModes) => {
    setAvailableModes(prev => {
      if (!Array.isArray(newModes)) return prev;
      if (!Array.isArray(prev)) return newModes;
      if (prev.length !== newModes.length) return newModes;
      
      // Check if content has actually changed
      const hasChanged = prev.some((mode, index) => mode !== newModes[index]);
      return hasChanged ? newModes : prev;
    });
  }, []);
  
  // Active data mode - determines which data source to use (lifted from InkConditionVisuals)
  // Initialize to null to prevent flash and gate rendering until resolved from DB
  const [activeDataMode, setActiveDataMode] = useState(null);
  
  // State for auto-computing adapted tints
  const [isComputingAdaptedTints, setIsComputingAdaptedTints] = useState(false);
  
   
   
   // Substrate mismatch handling (moved up to avoid TDZ in effects)
   const [substrateMismatchChoice, setSubstrateMismatchChoice] = useState(null);
   const [mismatchResolved, setMismatchResolved] = useState(false);
   
   // Handle active data mode changes with persistence for existing conditions
  const handleActiveDataModeChange = useCallback((newMode) => {
    
    // Mark as a user-originated change so persistence effect can act
    hasUserChangedModeRef.current = true;
    setActiveDataMode(newMode);
    
    // Persist the choice immediately if this is an existing condition
    if (!isNew && conditionId && newMode && pageInitializedRef.current) {
      
      setHasUnsavedChanges(true);
      
      // Update condition measurement_settings to include the new preference
      setCondition(prev => ({
        ...prev,
        measurement_settings: {
          ...prev?.measurement_settings,
          preferred_data_mode: newMode
        }
      }));
    }
  }, [isNew, conditionId]);
  
  // Auto-detect and set data mode based on condition content
  useEffect(() => {
    if (!condition) return;
    
    
    const uiActive = condition.ui_state?.active_data_mode;
    const preferred = condition.measurement_settings?.preferred_data_mode;
    
    // Enhanced priority: adapted_tints presence -> ui_state -> measurement_settings -> context inference -> fallback
    const hasAdaptedTints = !!(condition?.adapted_tints?.length);
    
    let resolved = null;
    if (hasAdaptedTints && !uiActive) {
      
      resolved = 'adapted';
    } else if (['imported', 'adapted'].includes(uiActive)) {
      
      resolved = uiActive;
    } else if (['imported', 'adapted'].includes(preferred)) {
      
      resolved = preferred;
    } else if (condition?.substrate_spectral_data && Array.isArray(condition?.imported_tints) && condition.imported_tints.length > 0) {
      // If we have a substrate to adapt to and imported tints, default to adapted
      
      resolved = 'adapted';
    } else {
      // Default to imported if no explicit preference is set and no adaptation context
      
      resolved = 'imported';
    }
    
    
    hasUserChangedModeRef.current = false;
    setActiveDataMode(resolved);
    
    // Mark page as initialized after processing condition
    if (!pageInitializedRef.current) {
      
      pageInitializedRef.current = true;
    }
  }, [condition, conditionId, isNew]);
  
  // Flag to prevent refetch after save (must be declared before effects using it)
  const [justSaved, setJustSaved] = useState(false);
  
  // Persist activeDataMode changes immediately to database for existing conditions
  useEffect(() => {
    // Guard: need a condition to persist preferences
    if (!condition) return;
    // Only persist for existing conditions with a valid id
    if (isNew || !conditionId) return;
    
    // Don't persist during initial load, during save flows
    if (!pageInitializedRef.current || saving || justSaved) {
      return;
    }
    
    // Only persist when the user explicitly changed the mode and it is valid
    if (!hasUserChangedModeRef.current || !['imported','adapted'].includes(activeDataMode)) return;
    
    
    
    // Snapshot values to avoid TDZ/closure issues
    const snapshotSettings = { ...(condition?.measurement_settings || {}) };
    const snapshotMode = activeDataMode;
    const snapshotConditionId = conditionId;
    
    const persist = async () => {
      try {
        const { error } = await supabase
          .from('ink_conditions')
          .update({
            ui_state: {
              active_data_mode: snapshotMode,
              last_saved_at: new Date().toISOString()
            },
            measurement_settings: { ...snapshotSettings, preferred_data_mode: snapshotMode },
            updated_at: new Date().toISOString()
          })
          .eq('id', snapshotConditionId);
          
        if (error) {
          console.error('❌ TRACE: Failed to persist data mode preference:', error);
        } else {
          console.log('✅ TRACE: Data mode preference saved to database');
          // Clear the user-change flag but don't update local condition to avoid infinite loop
          hasUserChangedModeRef.current = false;
        }
      } catch (err) {
        console.error('❌ TRACE: Error persisting data mode:', err);
      }
    };
    
    // Debounce the persistence to avoid too many DB calls
    const timeoutId = setTimeout(persist, 1000);
    return () => clearTimeout(timeoutId);
  }, [activeDataMode, conditionId, isNew, condition, saving, justSaved]);
  
  const [cxfDialogOpen, setCxfDialogOpen] = useState(false);
  const [cxfColors, setCxfColors] = useState([]);
  const [showCxfParser, setShowCxfParser] = useState(false);
  const cxfParserRef = useRef(null);
  const [cgatsDialogOpen, setCgatsDialogOpen] = useState(false);
  const [cgatsColors, setCgatsColors] = useState([]);
  const [importedTints, setImportedTints] = useState(null);
  // justSaved state moved above
  const [adaptedTints, setAdaptedTints] = useState(null); // Adapted measurements for existing substrate
  // Cache for original imported data to re-check mismatches
  const [originalImportedTints, setOriginalImportedTints] = useState(null);
  
  // Selected wedge/tint reference for Matches tab
  const [referencePatch, setReferencePatch] = useState(null);
  
  // Lifted selectedWedge state for persistence across tab changes  
  const [selectedWedge, setSelectedWedge] = useState(null);
  
  // Active tab state for performance optimization
  const [activeTab, setActiveTab] = useState("info");
  
  // State for dynamic substrate creation tabs (moved up to avoid TDZ)
  const [creatingNewSubstrate, setCreatingNewSubstrate] = useState(false);
  const [creatingNewSubstrateCondition, setCreatingNewSubstrateCondition] = useState(false);
  
  // Auto-fallback to info tab when special creation tabs are no longer available
  useEffect(() => {
    const shouldShowSubstrateTab = (creatingNewSubstrate || substrateMismatchChoice === 'create') && !mismatchResolved;
    const shouldShowSubstrateConditionTab = creatingNewSubstrateCondition;
    
    if (activeTab === "substrate" && !shouldShowSubstrateTab) {
      setActiveTab("info");
    }
    if (activeTab === "substrate-condition" && !shouldShowSubstrateConditionTab) {
      setActiveTab("info");
    }
  }, [activeTab, creatingNewSubstrate, substrateMismatchChoice, mismatchResolved, creatingNewSubstrateCondition]);
  
  // (moved earlier) const [creatingNewSubstrate, setCreatingNewSubstrate] = useState(false);
  // (moved earlier) const [creatingNewSubstrateCondition, setCreatingNewSubstrateCondition] = useState(false);
  
  // State for debounced database persistence
  const [pendingColorUpdate, setPendingColorUpdate] = useState(null);
  const debouncedPendingUpdate = useDebounce(pendingColorUpdate, 500);
  
  // Handle database persistence of color updates (debounced)
  useEffect(() => {
    if (!debouncedPendingUpdate) return;
    
    const persistColorUpdate = async () => {
      const { conditionId, updates } = debouncedPendingUpdate;
      try {
        const { error } = await supabase
          .from('ink_conditions')
          .update({
            color_hex: updates.color_hex,
            lab: updates.lab,
            ch: updates.ch,
            updated_at: new Date().toISOString()
          })
          .eq('id', conditionId);

        if (error) {
          console.error('Failed to persist color update:', error);
          toast({
            title: "Save Error",
            description: "Failed to save color selection. Please try again.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Database persistence error:', error);
      }
    };

    persistColorUpdate();
  }, [debouncedPendingUpdate]); // Removed toast dependency
  
  // Handle wedge selection changes with stability checks
  const handleWedgeSelect = useCallback((selection, force = false) => {
    // Prevent cascading updates during calculations unless forced (for default programmatic selection)
    if (calculationInProgressRef.current && !force) return;
    
    // Handle both object { index, tintPercentage } and plain number index
    const index = typeof selection === 'object' && selection !== null
      ? selection.index
      : selection;
    
    userHasSelectedRef.current = !force;  // Mark as user-selected only when not forced
    setSelectedWedge(index);
    
    // Update reference patch for matches tab
    if (currentWedgeData && currentWedgeData[index]) {
      const selectedTint = currentWedgeData[index];
      setReferencePatch(selectedTint);
      
      try { console.debug('[InkConditionDetail] Wedge selected', { index, tint: { pct: selectedTint?.tintPercentage, hasSpectral: !!selectedTint?.spectralData }, forced: force }); } catch {}

    } else if (condition) {
      // Fallback to condition data for substrate patch
      setReferencePatch({
        name: 'Substrate',
        colorHex: condition.substrate_color_hex || condition.color_hex || '#f3f4f6',
        spectralData: condition.substrate_spectral_data || condition.spectral_data,
        lab: condition.substrate_lab || condition.lab,
        ch: condition.substrate_ch || condition.ch,
        tintPercentage: 0,
        isSubstrate: true
      });
    }
  }, [currentWedgeData, condition, optimisticUpdateInkCondition, inkId]);
  
  // Extract auto-selection logic into reusable function
  const performAutoSelection = useCallback(() => {
    // Guard against running during calculations
    if (calculationInProgressRef.current) return;
    
    // Primary: use currentWedgeData when available
    if (currentWedgeData && currentWedgeData.length > 0) {
      // Auto-select solid wedge if no user selection has been made yet
      if (!userHasSelectedRef.current && selectedWedge === null) {
        // Look for 100% solid first (on-substrate solid)
        const solidIndex = currentWedgeData.findIndex(wedge => wedge.tintPercentage === 100);
        
        if (solidIndex !== -1) {
          calculationInProgressRef.current = true;
          setSelectedWedge(solidIndex);
          handleWedgeSelect(solidIndex, true); // Force the selection
          calculationInProgressRef.current = false;
        } else {
          // If no 100% found, find the highest percentage (excluding substrate at 0%)
          let maxPercentage = -1;
          let maxIndex = -1;
          
          currentWedgeData.forEach((wedge, index) => {
            const percentage = wedge.tintPercentage || 0;
            if (percentage > 0 && percentage > maxPercentage) {
              maxPercentage = percentage;
              maxIndex = index;
            }
          });
          
          if (maxIndex !== -1) {
            calculationInProgressRef.current = true;
            setSelectedWedge(maxIndex);
            handleWedgeSelect(maxIndex, true); // Force the selection
            calculationInProgressRef.current = false;
          }
        }
      }
      return;
    }

    // Fallback: when Matches tab is opened first and wedge data hasn't been pushed up yet
    if (!userHasSelectedRef.current && selectedWedge === null && condition?.imported_tints?.length) {
      const tints = normalizeTints(condition.imported_tints) || [];
      // Prefer 100% solid, otherwise highest non-zero
      let chosen = tints.find(t => (t.tintPercentage || 0) === 100);
      if (!chosen) {
        chosen = tints
          .filter(t => (t.tintPercentage || 0) > 0)
          .sort((a, b) => (b.tintPercentage || 0) - (a.tintPercentage || 0))[0];
      }
      if (chosen) {
        const colorHex = chosen.colorHex || chosen.color_hex || chosen.color;
        setReferencePatch({ ...chosen, colorHex });
      }
    }
  }, [currentWedgeData, selectedWedge, handleWedgeSelect, condition?.imported_tints]);

  // Auto-select solid wedge on initial load OR when switching to matches tab
  useEffect(() => {
    // Only trigger on matches tab or initial load, guard against continuous calls
    if ((activeTab === 'matches' || !userHasSelectedRef.current) && !calculationInProgressRef.current) {
      performAutoSelection();
    }
  }, [currentWedgeData, selectedWedge, activeTab, performAutoSelection]);
  
  // Ensure referencePatch syncs to selected wedge once wedge data is available (handles initial race)
  useEffect(() => {
    if (!currentWedgeData || selectedWedge === null) return;
    const sel = currentWedgeData[selectedWedge];
    if (sel) setReferencePatch(sel);
  }, [currentWedgeData, selectedWedge]);
  
  // (moved earlier) const [substrateMismatchChoice, setSubstrateMismatchChoice] = useState(null);
  // (moved earlier) const [mismatchResolved, setMismatchResolved] = useState(false);
  const [newSubstrateData, setNewSubstrateData] = useState(null);
  const [newSubstrateConditionData, setNewSubstrateConditionData] = useState(null);
  const [substrateNameFilled, setSubstrateNameFilled] = useState(false);
  const [substrateConditionNameFilled, setSubstrateConditionNameFilled] = useState(false);
   
  // parentSubstrateForConstruction state for substrate condition creation
  const [parentSubstrateForConstruction, setParentSubstrateForConstruction] = useState(null);

  // Prefill substrate form from selected substrate on Info tab (leave name blank)
  useEffect(() => {
    const prefill = async () => {
      try {
        const normalizePrintingSide = (val) => {
          const v = String(val || 'Surface').toLowerCase();
          return v === 'reverse' ? 'Reverse' : 'Surface';
        };

        // Map legacy/name surface quality values to the correct ID for the selected type
        const resolveSurfaceQualityId = async (typeId, sqValue) => {
          try {
            if (!sqValue || !typeId) return '';
            const { data, error } = await supabase
              .from('substrate_surface_qualities')
              .select('id, name')
              .eq('substrate_type_id', typeId);
            if (error || !data) return '';
            const byId = data.find(q => q.id === sqValue);
            if (byId) return byId.id;
            const byName = data.find(q => (q.name || '').trim().toLowerCase() === String(sqValue).trim().toLowerCase());
            return byName?.id || '';
          } catch {
            return '';
          }
        };

        // Determine substrate from the selected substrate_condition or direct substrate selection
        if (condition?.substrate_condition) {
          let condId = condition.substrate_condition;
          if (typeof condId === 'string' && condId.includes('_')) {
            condId = condId.split('_')[1];
          }

          // Step 1: fetch the substrate_condition to get substrate_id (avoid fragile FK aliasing)
          const { data: sc, error: scErr } = await supabase
            .from('substrate_conditions')
            .select('id, substrate_id')
            .eq('id', condId)
            .maybeSingle();

          if (scErr) {
            console.warn('Prefill: failed to fetch substrate_condition:', scErr);
            return;
          }
          if (!sc?.substrate_id) return;

          // Step 2: fetch the substrate by id
          const { data: s, error: sErr } = await supabase
            .from('substrates')
            .select('id, type, material, surface_quality, printing_side, use_white_ink, contrast, ink_adhesion, notes')
            .eq('id', sc.substrate_id)
            .maybeSingle();

          if (sErr || !s) return;

          // Copy over key fields from the associated substrate
          substrateForm.setValue('type', s.type || '');
          substrateForm.setValue('material', s.material || '');
            substrateForm.setValue('surface_quality', await resolveSurfaceQualityId(s.type, s.surface_quality));
          substrateForm.setValue('printing_side', normalizePrintingSide(s.printing_side));
          substrateForm.setValue('use_white_ink', typeof s.use_white_ink === 'boolean' ? s.use_white_ink : false);
          substrateForm.setValue('contrast', s.contrast || '');
          if (s.ink_adhesion !== undefined && s.ink_adhesion !== null) {
            const adh = typeof s.ink_adhesion === 'string'
              ? s.ink_adhesion
              : (s.ink_adhesion >= 100 ? '100%' : s.ink_adhesion >= 90 ? '90%' : s.ink_adhesion >= 80 ? '80%' : s.ink_adhesion >= 70 ? '70%' : '<70%');
            substrateForm.setValue('ink_adhesion', adh);
          }
          substrateForm.setValue('notes', s.notes || '');
        } else if (condition?.substrate_id) {
          const { data: s, error } = await supabase
            .from('substrates')
            .select('id, type, material, surface_quality, printing_side, use_white_ink, contrast, ink_adhesion, notes')
            .eq('id', condition.substrate_id)
            .maybeSingle();

          if (!error && s) {
            substrateForm.setValue('type', s.type || '');
            substrateForm.setValue('material', s.material || '');
            substrateForm.setValue('surface_quality', await resolveSurfaceQualityId(s.type, s.surface_quality));
            substrateForm.setValue('printing_side', normalizePrintingSide(s.printing_side));
            substrateForm.setValue('use_white_ink', typeof s.use_white_ink === 'boolean' ? s.use_white_ink : false);
            substrateForm.setValue('contrast', s.contrast || '');
            if (s.ink_adhesion !== undefined && s.ink_adhesion !== null) {
              const adh = typeof s.ink_adhesion === 'string'
                ? s.ink_adhesion
                : (s.ink_adhesion >= 100 ? '100%' : s.ink_adhesion >= 90 ? '90%' : s.ink_adhesion >= 80 ? '80%' : s.ink_adhesion >= 70 ? '70%' : '<70%');
              substrateForm.setValue('ink_adhesion', adh);
            }
            substrateForm.setValue('notes', s.notes || '');
          }
        }
      } catch (e) {
        console.warn('Prefill substrate form failed:', e);
      }
    };
    prefill();
  }, [condition?.substrate_condition, condition?.substrate_id]);

  // Keep parent substrate info for ConstructionPanel in sync with Substrate tab
  useEffect(() => {
    const subscription = substrateForm.watch((value) => {
      setParentSubstrateForConstruction({
        name: value.name,
        printing_side: value.printing_side,
        use_white_ink: value.use_white_ink,
        surface_quality: value.surface_quality ? { id: value.surface_quality } : null,
      });
    });
    return () => subscription.unsubscribe();
  }, [substrateForm]);
  
  const [newSubstrateCondition, setNewSubstrateCondition] = useState({
    name: '',
    pack_type: '',
    use_pack_type: false,
    is_metallic: false,
    metallic_intensity: 100,
    measurement_settings: null,
    spectral_data: null,
    lab: null,
    ch: null,
    color_hex: null,
    construction_details: null
  });

  // Prefill substrate condition settings from selected substrate condition on Info tab
  useEffect(() => {
    const prefillFromSelectedCondition = async () => {
      try {
        if (substrateMismatchChoice !== 'create') return;
        const selected = condition?.substrate_condition;
        if (!selected) return;
        let condId = selected;
        if (typeof condId === 'string' && condId.includes('_')) {
          condId = condId.split('_')[1];
        }
        const { data, error } = await supabase
          .from('substrate_conditions')
          .select('pack_type, construction_details')
          .eq('id', condId)
          .maybeSingle();
        if (error || !data) return;
        setNewSubstrateCondition(prev => ({
          ...prev,
          pack_type: prev.pack_type || data.pack_type || '',
          use_pack_type: prev.use_pack_type ?? false,
          is_metallic: prev.is_metallic ?? false,
          metallic_intensity: prev.metallic_intensity ?? 100,
          construction_details: prev.construction_details || data.construction_details || prev.construction_details
        }));
      } catch (e) {
        console.warn('Prefill substrate condition failed:', e);
      }
    };
    prefillFromSelectedCondition();
  }, [substrateMismatchChoice, condition?.substrate_condition]);

  // State for substrate display
  const [allSubstrates, setAllSubstrates] = useState([]);
  const [isFetchingSubstrateData, setIsFetchingSubstrateData] = useState(false);
  const [selectedSubstrate, setSelectedSubstrate] = useState(null);
  const [selectedSubstrateCondition, setSelectedSubstrateCondition] = useState(null);

  // Performance monitoring removed
  
  const cxfInputRef = useRef(null);
  const cgatsInputRef = useRef(null);
  // Fetch ASTM tables locally to avoid dispatcher issues with lazy-loaded component
  const [astmTables, setAstmTables] = useState([]);
  const [astmLoading, setAstmLoading] = useState(false);
  
  useEffect(() => {
    let cancelled = false;
    const fetchAstm = async () => {
      setAstmLoading(true);
      try {
        const { data } = await supabase
          .from('astm_e308_tables')
          .select('*');
        if (!cancelled) setAstmTables(data || []);
      } catch (e) {
        if (!cancelled) setAstmTables([]);
      } finally {
        if (!cancelled) setAstmLoading(false);
      }
    };
    fetchAstm();
    return () => { cancelled = true; };
  }, []);
  
  // Build complete standards object for ColorSettingsBox
  const standards = useMemo(() => {
    const illuminantNames = astmTables.map(t => t.illuminant_name || t.illuminant).filter(Boolean);
    const illuminants = [...new Set(illuminantNames)].map(name => ({ id: name, name }));
    
    const observerVals = astmTables.map(t => String(t.observer || t.observer_degree || '2')).filter(Boolean);
    const observers = [...new Set(observerVals)].sort().map(name => ({ id: name, name }));
    
    return {
      astmTables,
      illuminants,
      observers,
      loading: astmLoading
    };
  }, [astmTables, astmLoading]);
  
  const [organization, setOrganization] = useState(null);

  // Fetch organization data only (standards now cached globally)
  useEffect(() => {
    const fetchOrganization = async () => {
      if (profileLoading || !profile?.organization_id) return;
      try {
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.organization_id)
          .maybeSingle();

        if (orgError) {
          console.error('Failed to fetch organization:', orgError);
        } else {
          setOrganization(org);
          
          // Initialize measurement controls with organization defaults
          if (org) {
            const orgDefaults = {
              mode: org.default_measurement_mode || 'M0',
              illuminant: org.default_illuminant || 'D50',
              observer: org.default_observer || '2',
              table: org.default_astm_table || '5',
            };
            // Only update if values are actually different
            setMeasurementControls(prev => {
              if (prev.mode !== orgDefaults.mode || 
                  prev.illuminant !== orgDefaults.illuminant || 
                  prev.observer !== orgDefaults.observer || 
                  prev.table !== orgDefaults.table) {
                return orgDefaults;
              }
              return prev;
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch organization:', error);
      }
    };

    fetchOrganization();
  }, [profile?.organization_id, astmLoading, isNew]); // Removed toast dependency

  const recalculateColorValues = useCallback((spectralData, controls) => {
    if (!spectralData || astmTables.length === 0) return {};
    
    const { illuminant: illuminantName, observer: observerName, table: tableName } = controls;
    
    const tableNumber = parseInt(tableName, 10);
    const weightingTable = astmTables.filter(t => t.table_number === tableNumber && t.illuminant_name === illuminantName);

    if (weightingTable.length === 0) {
      return {};
    }

    const lab = spectralToLabASTME308(spectralData, weightingTable);
    const hex = labToHex(lab.L, lab.a, lab.b, illuminantName);
    const ch = { C: Math.sqrt(lab.a**2 + lab.b**2), h: (Math.atan2(lab.b, lab.a) * 180 / Math.PI + 360) % 360 };
    
    return { lab, color_hex: hex, ch };
  }, [astmTables]);

  // Fetch substrate condition data for the wedge - define this first
  const fetchSubstrateCondition = useCallback(async (substrateConditionId) => {
    if (!substrateConditionId) return null;
    
    // Fetching substrate condition with ID
    
    // Handle composite IDs (substrate_id + "_" + condition_id)
    let actualConditionId = substrateConditionId;
    if (substrateConditionId.includes('_')) {
      // Split composite ID and take the condition part
      const parts = substrateConditionId.split('_');
      actualConditionId = parts[1]; // Take the second part (condition ID)
      // Parsed composite ID, using condition ID
    }
    
    const { data, error } = await supabase
      .from('substrate_conditions')
      .select('spectral_data, lab, ch, color_hex')
      .eq('id', actualConditionId)
      .maybeSingle();
    
    // Substrate condition fetch result
    if (error) {
      // Error fetching substrate condition
      return null;
    }
    
    return data;
  }, []);

  // Cache reference data to avoid refetching
  const [referenceDataCache, setReferenceDataCache] = useState({
    allSubstrates: null,
    loaded: false
  });

  // Fetch reference data once and cache it
  const fetchReferenceData = useCallback(async () => {
    if (referenceDataCache.loaded) return referenceDataCache;

    try {
      const substratesRes = await supabase.from('substrates').select('id, name').order('name');

      const cache = {
        allSubstrates: substratesRes.data || [],
        loaded: true
      };

      setReferenceDataCache(cache);
      setAllSubstrates(cache.allSubstrates);

      return cache;
    } catch (error) {
      console.error('Error fetching reference data:', error);
      return referenceDataCache;
    }
  }, [referenceDataCache.loaded]);

  // Optimized substrate display data fetching
  const fetchSubstrateDisplayData = useCallback(async (substrateConditionId) => {
    if (!substrateConditionId || isFetchingSubstrateData) return;

    setIsFetchingSubstrateData(true);
    
    try {
      // Ensure reference data is loaded first
      await fetchReferenceData();

      // Parse substrate and condition IDs
      let actualSubstrateId, actualConditionId;
      if (substrateConditionId.includes('_')) {
        [actualSubstrateId, actualConditionId] = substrateConditionId.split('_');
      } else {
        actualConditionId = substrateConditionId;
      }

      // Only fetch the specific substrate condition and substrate data
      const [conditionRes, substrateRes] = await Promise.all([
        supabase
          .from('substrate_conditions')
          .select('*')
          .eq('id', actualConditionId)
          .maybeSingle(),
        
        actualSubstrateId ? 
          supabase
            .from('substrates')
            .select('*')
            .eq('id', actualSubstrateId)
            .maybeSingle() :
          Promise.resolve({ data: null, error: null })
      ]);



    } catch (error) {
      console.error('Error fetching substrate display data:', error);
    } finally {
      setIsFetchingSubstrateData(false);
    }
  }, [isFetchingSubstrateData, fetchReferenceData]);

  // Helper function to handle condition data from ink (context or database)
  const handleConditionFromInk = useCallback(async (conditionData) => {
    // Parallel fetch substrate data if needed
    let substratePromise = null;
    if (conditionData.substrate_condition) {
      substratePromise = fetchSubstrateCondition(conditionData.substrate_condition);
    }

    // Wait for substrate data before setting condition
    let enhancedData = { ...conditionData };
    
    if (substratePromise) {
      const substrateData = await substratePromise;
      if (substrateData) {
        enhancedData = {
          ...enhancedData,
          substrate_spectral_data: substrateData.spectral_data,
          substrate_lab: substrateData.lab,
          substrate_ch: substrateData.ch,
          substrate_color_hex: substrateData.color_hex
        };
      } else {
        enhancedData.substrate_condition = null;
      }
    }
    
    setCondition(enhancedData);
    setOriginalCondition(enhancedData);
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    setLoading(false); // Stop loading after condition is fully set

    // Fetch substrate display data in background if needed
    if (conditionData.substrate_condition && !isFetchingSubstrateData) {
      fetchSubstrateDisplayData(conditionData.substrate_condition);
    }
    
    // Load imported tints if they exist
    if (conditionData.imported_tints) {
      
      setImportedTints(conditionData.imported_tints);
    }

    // Removed auto-backfill - it was creating duplicate spectral data
  }, [fetchSubstrateCondition, fetchSubstrateDisplayData, isFetchingSubstrateData]);

  const fetchInk = useCallback(async () => {
    
    if (!inkId || justSaved) {
      
      return;
    }
    
    // Check authentication first
    if (!profile || !profile.organization_id) {
      console.log('⚠️ User not authenticated or no organization:', { profile });
      toast({ 
        title: 'Authentication Required', 
        description: 'Please log in to access ink data.', 
        variant: 'destructive' 
      });
      navigate('/login');
      return;
    }
    
    // First try to get ink from context (faster, optimistically updated)
    const inkFromContext = allInks.find(ink => ink.id === inkId);
    if (inkFromContext) {
      
      setInk(inkFromContext);
      
      // If not new condition, fetch full condition details (includes imported_tints/adapted_tints)
      if (!isNew && conditionId) {
        const conditionData = inkFromContext.conditions?.find(c => c.id === conditionId);
        if (conditionData) {
          // Load full condition details to get imported_tints and adapted_tints
          const fullConditionData = await loadConditionDetails(conditionId);
          const dataToUse = fullConditionData || conditionData;
          
          // Parallel fetch substrate data if needed
          let substratePromise = null;
          if (dataToUse.substrate_condition) {
            substratePromise = fetchSubstrateCondition(dataToUse.substrate_condition);
          }

          // Wait for substrate data before setting condition
          let enhancedData = { ...dataToUse };
          
          if (substratePromise) {
            const substrateData = await substratePromise;
            if (substrateData) {
              enhancedData = {
                ...enhancedData,
                substrate_spectral_data: substrateData.spectral_data,
                substrate_lab: substrateData.lab,
                substrate_ch: substrateData.ch,
                substrate_color_hex: substrateData.color_hex
              };
            } else {
              enhancedData.substrate_condition = null;
            }
          }
          
          // Set local condition state directly with full data
          setCondition(enhancedData);
          setOriginalCondition(enhancedData);
          setIsEditMode(false);
          setHasUnsavedChanges(false);
          setLoading(false);
          
          // Fetch substrate display data in background if needed
          if (dataToUse.substrate_condition && !isFetchingSubstrateData) {
            fetchSubstrateDisplayData(dataToUse.substrate_condition);
          }
        } else {
          console.error('Condition not found in ink from context:', conditionId);
          toast({ title: 'Error', description: 'Ink condition not found.', variant: 'destructive' });
          navigate('/assets/inks');
          return;
        }
      } else {
        // For new conditions, we can stop loading immediately
        setLoading(false);
      }
      return;
    }
    
    // Fallback to database query if not in context
    console.log('📡 Fetching ink from database (fallback):', inkId);
    const { data, error } = await supabase
      .from('inks_with_details')
      .select('*')
      .eq('id', inkId)
      .maybeSingle();

    console.log('fetchInk result:', { data, error });

    if (error) {
      console.error('Fetch error:', error);
      toast({ title: 'Error', description: 'Failed to fetch ink data.', variant: 'destructive' });
      setLoading(false);
      navigate('/assets/inks');
      return;
    }

    if (!data) {
      console.error('Ink not found with ID:', inkId);
      toast({ title: 'Error', description: 'Ink not found or access denied.', variant: 'destructive' });
      setLoading(false);
      navigate('/assets/inks');
      return;
    }
    
    setInk(data);
      
    // If not new condition, extract condition from ink data
    if (!isNew && conditionId) {
      const conditionData = data.conditions?.find(c => c.id === conditionId);
      
      if (conditionData) {
        // Load full condition details to get imported_tints and adapted_tints
        const fullConditionData = await loadConditionDetails(conditionId);
        const dataToUse = fullConditionData || conditionData;
        
        // Parallel fetch substrate data if needed
        let substratePromise = null;
        if (dataToUse.substrate_condition) {
          substratePromise = fetchSubstrateCondition(dataToUse.substrate_condition);
        }

        // Wait for substrate data before setting condition
        let enhancedData = { ...dataToUse };
        
        if (substratePromise) {
          const substrateData = await substratePromise;
          if (substrateData) {
            enhancedData = {
              ...enhancedData,
              substrate_spectral_data: substrateData.spectral_data,
              substrate_lab: substrateData.lab,
              substrate_ch: substrateData.ch,
              substrate_color_hex: substrateData.color_hex
            };
          } else {
            enhancedData.substrate_condition = null;
          }
        }
        
        // Set local condition state directly with full data
        setCondition(enhancedData);
        setOriginalCondition(enhancedData);
        setIsEditMode(false);
        setHasUnsavedChanges(false);
        setLoading(false);

        // Fetch substrate display data in background if needed
        if (dataToUse.substrate_condition && !isFetchingSubstrateData) {
          fetchSubstrateDisplayData(dataToUse.substrate_condition);
        }
        
        // Load imported tints if they exist
        if (dataToUse.imported_tints) {
          setImportedTints(dataToUse.imported_tints);
          
          // Check if this is a resolved mismatch by looking for adapted tints
          const normalizedTints = normalizeTints(conditionData.imported_tints);
          const hasAdaptedTints = normalizedTints.some(tint => tint.isAdapted);
          
          
          if (hasAdaptedTints) {
            // This was a resolved mismatch - determine which resolution was chosen
            const firstAdaptedTint = normalizedTints.find(tint => tint.isAdapted);
            
            
            const resolvedChoice = firstAdaptedTint.usingAdaptedData ? 'adapt' : 'create';
            
            
            setSubstrateMismatchChoice(resolvedChoice);
            setMismatchResolved(true);
            
          } else {
            // FALLBACK: Check for legacy resolved mismatches without isAdapted flags
            // If condition has both substrate_condition and imported_tints with substrate data,
            // and no active mismatch state, assume it was previously resolved with "adapt"
            if (conditionData.substrate_condition && normalizedTints.some(tint => tint.tintPercentage === 0)) {
              console.log('🔄 Detected legacy resolved mismatch - assuming "adapt" choice');
              setSubstrateMismatchChoice('adapt');
              setMismatchResolved(true);
              
            } else {
              // Fresh imported tints or no mismatch resolution
              
              // Only reset substrate mismatch choice if we're loading from a fresh save (justSaved is true)
              // or if there are no unsaved changes, to preserve mismatch state during tab switches
              if (justSaved || !hasUnsavedChanges) {
                setSubstrateMismatchChoice(null);
              }
            }
         }
       }
     } else {
       console.log('🐛 InkConditionDetail: Not isNew, calling fetchCondition for conditionId:', conditionId);
       await fetchCondition(conditionId);
     }
   } else {
     console.log('🐛 InkConditionDetail: isNew condition, setting loading to false');
     setLoading(false);
   }
 }, [inkId, justSaved, isNew, conditionId]); // Removed unstable function dependencies

 const fetchCondition = useCallback(async (id) => {
   console.log('🐛 InkConditionDetail: fetchCondition called with id:', id);
   setLoading(true);
   const { data, error } = await supabase
     .from('ink_conditions')
     .select('*')
     .eq('id', id)
     .maybeSingle();

   console.log('🐛 InkConditionDetail: Database query result:', { data, error });

    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch condition data.', variant: 'destructive' });
      navigate(`/assets/inks/${inkId}`);
      return;
    }

    // If condition not found, try to find the latest condition for this ink
    if (!data) {
      console.log('🔄 Condition not found, fetching latest condition for ink:', inkId);
      const { data: latestCondition, error: latestError } = await supabase
        .from('ink_conditions')
        .select('*')
        .eq('ink_id', inkId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError || !latestCondition) {
        toast({ title: 'Error', description: 'No conditions found for this ink.', variant: 'destructive' });
        navigate(`/assets/inks/${inkId}`);
        return;
      }

      // Redirect to the latest condition
      navigate(`/assets/inks/${inkId}/conditions/${latestCondition.id}`, { replace: true });
      return;
    }

    if (data) {
      let enhancedData = { ...data };
      
      // Fetch substrate data if needed
      if (data.substrate_condition) {
        const substrateData = await fetchSubstrateCondition(data.substrate_condition);
        if (substrateData) {
          enhancedData = {
            ...enhancedData,
            substrate_spectral_data: substrateData.spectral_data,
            substrate_lab: substrateData.lab,
            substrate_ch: substrateData.ch,
            substrate_color_hex: substrateData.color_hex
          };
        } else {
          enhancedData.substrate_condition = null;
        }
      }
      
      // Apply compatibility auto-fix for substrate condition
      const fixedCondition = await fixSubstrateConditionId(enhancedData);
      
      setCondition(fixedCondition);
      setOriginalCondition(fixedCondition);
      setIsEditMode(false);
      setHasUnsavedChanges(false);
     setLoading(false);
     console.log('🐛 InkConditionDetail: Successfully loaded condition:', fixedCondition.name);
      
      if (data.imported_tints) {
        setImportedTints(data.imported_tints);
        
        // Check if this is a resolved mismatch by looking for adapted tints
        const normalizedTints = normalizeTints(data.imported_tints);
        const hasAdaptedTints = normalizedTints.some(tint => tint.isAdapted);
        console.log('🔍 Checking for adapted tints:', hasAdaptedTints);
        
        if (hasAdaptedTints) {
          // This was a resolved mismatch - determine which resolution was chosen
          const firstAdaptedTint = normalizedTints.find(tint => tint.isAdapted);
          console.log('🎯 First adapted tint found:', firstAdaptedTint);
          
          const resolvedChoice = firstAdaptedTint.usingAdaptedData ? 'adapt' : 'create';
          
          console.log('🔄 Restoring resolved mismatch state:', resolvedChoice);
          setSubstrateMismatchChoice(resolvedChoice);
          setMismatchResolved(true);
          
          // Note: activeDataMode will be resolved by useEffect after condition is fully loaded
          
          console.log('✅ Mismatch resolution state restored - no new detection will run');
        } else {
          // Fresh imported tints or no mismatch resolution
          console.log('🆕 No adapted tints found - treating as fresh import');
          if (!hasUnsavedChanges) {
            setSubstrateMismatchChoice(null);
          }
        }
        
        setAdaptedTints(null);
      }

      // ============ COMPLETE STATE RESTORATION & AUTO-SAVE LOGIC ============
      
      // Restore all UI state from database to ensure perfect session continuity
      if (data.ui_state) {
        console.log('🔄 Restoring UI state from database:', data.ui_state);
        
        // Note: activeDataMode restoration is handled by useEffect
        const uiState = data.ui_state;
        if (typeof uiState.mismatch_resolved === 'boolean') {
          setMismatchResolved(uiState.mismatch_resolved);
        }
        if (uiState.mismatch_choice) {
          setSubstrateMismatchChoice(uiState.mismatch_choice);
        }
      }
      
      // Restore complete measurement controls including defaults
      if (data.measurement_settings) {
        const settings = data.measurement_settings;
        console.log('🔄 Restoring measurement controls from database:', settings);
        
        // Set measurement controls with saved values, maintaining user's exact session
        setMeasurementControls(prev => ({
          ...prev,
          illuminant: settings.illuminant || prev.illuminant,
          observer: settings.observer || prev.observer,
          table: settings.table || prev.table,
          mode: settings.mode || settings.measurement_mode || prev.mode
        }));
        
        // Restore available modes
        if (settings.available_modes && Array.isArray(settings.available_modes)) {
          setAvailableModes(settings.available_modes);
        }
      }
      
      // Auto-save any computed values that weren't persisted (ensure DB completeness)
      setTimeout(async () => {
        try {
          const needsAutoSave = [];
          
          // Check if measurement settings need completion
          if (!data.measurement_settings?.computed_at) {
            needsAutoSave.push('measurement_settings');
          }
          
          // Check if UI state needs saving
          if (!data.ui_state?.last_saved_at) {
            needsAutoSave.push('ui_state');
          }
          
          // Check if imported tints lack metadata
          if (data.imported_tints && data.imported_tints.length > 0) {
            const hasMetadata = data.imported_tints.some(tint => tint.persistedAt);
            if (!hasMetadata) {
              needsAutoSave.push('imported_tints_metadata');
            }
          }
          
          if (needsAutoSave.length > 0) {
            console.log('🔧 Auto-saving missing computed values:', needsAutoSave);
            
            const autoSavePayload = {
              measurement_settings: {
                ...data.measurement_settings,
                ...measurementControls,
                computed_at: new Date().toISOString()
              },
              ui_state: {
                active_data_mode: activeDataMode,
                mismatch_resolved: mismatchResolved,
                mismatch_choice: substrateMismatchChoice,
                current_substrate_condition: data.substrate_condition,
                last_saved_at: new Date().toISOString()
              }
            };
            
            // Add enhanced imported tints if needed
            if (needsAutoSave.includes('imported_tints_metadata') && data.imported_tints) {
              autoSavePayload.imported_tints = data.imported_tints.map(tint => ({
                ...tint,
                persistedAt: new Date().toISOString(),
                isAdapted: tint.isAdapted || false
              }));
            }
            
            // Perform silent auto-save to complete the database state
            const { error: autoSaveError } = await supabase
              .from('ink_conditions')
              .update(autoSavePayload)
              .eq('id', id);
              
            if (autoSaveError) {
              console.warn('⚠️ Auto-save failed:', autoSaveError);
            } else {
              console.log('✅ Auto-save completed - database now contains complete state');
            }
          }
        } catch (error) {
          console.warn('⚠️ Auto-save error:', error);
        }
      }, 1000); // Delay to ensure component is fully initialized

      // Fetch substrate display data if substrate_condition exists
      if (data.substrate_condition && !isFetchingSubstrateData) {
        fetchSubstrateDisplayData(data.substrate_condition);
      }
    } else {
      toast({ title: 'Error', description: 'Condition not found.', variant: 'destructive' });
      navigate(`/assets/inks/${inkId}`);
    }
  }, [inkId, navigate]); // Removed unstable function dependencies

  // State reset effect when switching between different inks
  useEffect(() => {
    
    
    // Reset initialization flag and all state when switching inks
    initializationRef.current = false;
    
    // Reset all state to initial values
    setCondition(null);
    setOriginalCondition(null);
    setImportedTints(null);
    setAdaptedTints(null);
    setOriginalImportedTints(null);
    setSubstrateMismatchChoice(null);
    setMismatchResolved(false);
    setNewSubstrateData(null);
    setNewSubstrateConditionData(null);
    setSubstrateNameFilled(false);
    setSubstrateConditionNameFilled(false);
    setHasUnsavedChanges(false);
    setJustSaved(false);
    
    // Reset forms
    substrateForm.reset();
    setNewSubstrateCondition({
      name: '',
      pack_type: '',
      measurement_settings: null,
      spectral_data: null,
      lab: null,
      ch: null,
      color_hex: null,
      construction_details: null
    });
    
    
  }, [inkId, conditionId, substrateForm]);

  // Simplified initialization effect to prevent infinite loops
  useEffect(() => {
    // Only initialize once per component mount
    if (initializationRef.current) return;
    
    const performInitialization = async () => {
      if (isNew && !astmLoading) {
        initializationRef.current = true;
        // Setting up new condition
        setLoading(false);
        const initialControls = { mode: 'M0', illuminant: 'D50', observer: '2', table: '5' };
        setMeasurementControls(initialControls);
        const initialCondition = {
          name: '',
          pack_type: '',
          color_hex: '#FFFFFF',
          is_part_of_structure: false,
          spectral_data: null
        };
        setCondition(initialCondition);
        setOriginalCondition(null);
        setIsEditMode(true);
        setHasUnsavedChanges(false);
        
        // Load reference data in background for new conditions
        await fetchReferenceData();
      } else if (!isNew && !justSaved && inkId) {
        
        initializationRef.current = true;
        // Fetch existing condition data
        await fetchInk();
      } else {
      }
    };
    
    
    performInitialization();
    
    // Reset justSaved flag after sufficient delay to prevent refetch
    if (justSaved) {
      const timer = setTimeout(() => setJustSaved(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isNew, astmLoading, justSaved, inkId]); // Removed fetchInk and other functions that cause re-renders

  // Handle CxF import click - show parser when needed
  const handleCxfImportClick = () => {
    setShowCxfParser(true);
    // Wait for next tick to ensure parser is rendered
    setTimeout(() => {
      if (cxfParserRef.current?._cxfParser) {
        cxfParserRef.current._cxfParser.handleCxfImportClick();
      }
    }, 0);
  };

  // Use shared adaptTintsToSubstrate utility

  const updateConditionWithParsedData = (parsedData, preserveMultiTints = false) => {
    const newValues = recalculateColorValues(parsedData.spectral, measurementControls);
    
    setCondition(prev => ({
      ...prev,
      // Always preserve the existing name (auto-generated or user-set), never use imported name
      name: prev?.name || '',
      spectral_data: parsedData.spectral,
      ...newValues,
    }));
    
    // In full-add mode, ensure substrate mismatch detection can be triggered
    if (isFullAddMode && !isNew) {
      console.log('🔧 updateConditionWithParsedData: full-add mode with existing condition - enabling mismatch detection');
    }
    
    // Only create importedTints if preserveMultiTints flag is not set
    // When preserveMultiTints is true, we keep existing multi-tints
    // When preserveMultiTints is false (default), we always create a single tint
    if (!preserveMultiTints) {
      const singleTint = {
        name: parsedData.name || "Imported Color",
        tintPercentage: 100,
        colorHex: newValues.color_hex,
        spectralData: parsedData.spectral,
        lab: newValues.lab,
        ch: newValues.ch,
        measurementType: "substrate",
        isSubstrate: false
      };
      // Creating imported tints from condition update
      setImportedTints([singleTint]);
      // Reset mismatch workflow so a fresh detection runs after this new import
      setAdaptedTints(null);
      setSubstrateMismatchChoice(null);
      setMismatchResolved(false);
      setOriginalImportedTints([singleTint]);
      console.log('🔄 Reset mismatch workflow for new single import');
    } else {
      // Preserving existing multi-tint data
    }
    
    setHasUnsavedChanges(true);
    if (!isNew) setIsEditMode(true);
    
    toast({
      title: 'Success!',
      description: 'Measurement data imported successfully.'
    });
  };

  // Normalize CGATS data to match CxF structure for dialog display
  const normalizeCgatsForDialog = (cgatsColors) => {
    return cgatsColors.map((color, index) => ({
      name: color.name,
      objectType: 'ColorValues',
      spectralData: color.spectral || null,
      lab: color.lab || null,
      hex: color.hex || '#000000',
      // Don't set measurementMode - let dialog detect missing mode and show assignment card
      measurements: color.lab ? [{
        lab: color.lab,
        spectral_data: color.spectral
      }] : [],
      index: index
    }));
  };

  // Handle import from CGATS selection dialog
  const handleImportFromCgatsSelection = (selectedObjects) => {
    console.log('🎯 handleImportFromCgatsSelection called with:', selectedObjects);
    
    if (selectedObjects.length === 0) return;
    
    const selectedColor = selectedObjects[0];
    const spectral = selectedColor.spectralData || selectedColor.measurements?.[0]?.spectral_data;
    
    if (!spectral || Object.keys(spectral).length === 0) {
      toast({
        title: 'Error',
        description: 'No spectral data found in selected object.',
        variant: 'destructive',
      });
      return;
    }
    
    console.log('Assigned measurement mode:', selectedColor.measurementMode);
    
    updateConditionWithParsedData({ 
      name: selectedColor.name, 
      spectral: spectral,
      lab: selectedColor.lab,
      color_hex: selectedColor.hex
    });
    
    // Store measurement mode if assigned
    if (selectedColor.measurementMode) {
      setMeasurementControls(prev => ({
        ...prev,
        mode: selectedColor.measurementMode
      }));
    }
    
    setCgatsDialogOpen(false);
    setCgatsColors([]);
    
    toast({
      title: 'Import Successful',
      description: `Imported data from ${selectedColor.name}${selectedColor.measurementMode ? ` with ${selectedColor.measurementMode} mode` : ''}`,
    });
  };

  const handleFileChange = useCallback((event, type) => {
    const file = event.target?.files?.[0];
    
    if (!file) {
      return;
    }
    
    // Handle CGATS with selection dialog
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        if (type === 'cgats') {
          const parsedColors = parseCgats(content);
          if (parsedColors.length > 0) {
            // Always show selection dialog for CGATS, even for single color
            setCgatsColors(parsedColors);
            setCgatsDialogOpen(true);
          } else {
            throw new Error("No valid color data found in the file.");
          }
        }
      } catch (error) {
        console.error('Error processing file:', error);
        toast({
          title: 'Import Error',
          description: `Failed to import: ${error.message}`,
          variant: 'destructive'
        });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }, [toast]);



  // Clear imported tints and reset
  const clearImportedTints = useCallback(() => {
    // Clearing imported tints
    setImportedTints(null);
    setAdaptedTints(null);
    setSubstrateMismatchChoice(null);
    // Also clear the original imported data cache
    setOriginalImportedTints(null);
    
    // Reset mismatch resolution state
    setMismatchResolved(false);
    console.log('🔄 Reset mismatch state for clearing tints');
    setHasUnsavedChanges(true);
    toast({
      title: 'Cleared Tints',
      description: 'Imported tints have been cleared. Save to persist changes.',
    });
  }, [toast]);

  // Enhanced CxF import handler for tints
  const handleCxfTintsImport = useCallback((groupedTints) => {
    console.log('=== HANDLING CXF TINTS IMPORT ===');
    
    
    // Convert grouped tints to flat array for processing
    const allTints = Object.values(groupedTints).flat();
    
    
    // Sort tints by percentage, treating substrate as 0%
    const sortedTints = allTints.sort((a, b) => {
      const aPerc = a.isSubstrate ? 0 : (a.tintPercentage || 100);
      const bPerc = b.isSubstrate ? 0 : (b.tintPercentage || 100);
      return aPerc - bPerc;
    });
    
    
    
    // Ensure each tint has lab/ch/colorHex computed from spectral if missing
    const enrichedTints = sortedTints.map((t) => {
      const isSub = !!t.isSubstrate;
      const tintPercentage = isSub ? 0 : (t.tintPercentage ?? 100);
      let lab = t.lab;
      let ch = t.ch;
      let colorHex = t.colorHex || t.color_hex;
      if ((!lab || !ch || !colorHex) && t.spectralData && Object.keys(t.spectralData).length > 0) {
        const computed = recalculateColorValues(t.spectralData, measurementControls) || {};
        lab = lab || computed.lab;
        ch = ch || computed.ch;
        colorHex = colorHex || computed.color_hex;
      }
      return {
        ...t,
        isSubstrate: isSub,
        tintPercentage,
        lab,
        ch,
        colorHex,
      };
    });
    
    // Cache the original imported data for future mismatch re-checking
    setOriginalImportedTints(enrichedTints);
    
    // Set imported tints for visualization
    
    // Reset substrate mismatch choice to trigger new mismatch detection
    setSubstrateMismatchChoice(null);
    
    // Reset mismatch resolution state for fresh detection  
    setMismatchResolved(false);
    
    // In full-add mode, ensure substrate mismatch detection is enabled for existing conditions
    if (isFullAddMode && !isNew) {
      console.log('🔧 Full-add mode: enabling substrate mismatch detection for existing condition');
      // Force a slight delay to ensure the InkConditionVisuals component can detect the change
      setTimeout(() => {
        console.log('🔧 Full-add mode: triggering mismatch detection with delay');
      }, 100);
    }
    
    // Mark as having unsaved changes so user knows to save
    if (!isNew) setHasUnsavedChanges(true);
    if (!isNew) setIsEditMode(true);
    
    // Recalculate adapted tints with physics-based method if in adapted mode and substrate is available
    if (activeDataMode === 'adapted' && condition?.substrate_spectral_data && astmTables?.length) {
      console.log('🔄 Recalculating adapted tints for CxF import using physics-based method');
      setIsComputingAdaptedTints(true);
      
      const computeAdaptedTints = async () => {
        try {
          // Extract imported substrate spectral from 0% tint of enriched tints
          const substrateFromImported = enrichedTints.find(t => t.isSubstrate || (t.tintPercentage === 0));
          const importedSubstrateSpectral = substrateFromImported?.spectralData || {};
          
          const adaptedResult = adaptTintsToSubstrate(
            enrichedTints,
            importedSubstrateSpectral,
            condition.substrate_spectral_data,
            {
              astmTables,
              measurementControls: condition.measurement_settings || {
                illuminant: 'D50',
                observer: '2',
                table: '5'
              },
              fallbackSubstrateLab: condition.substrate_lab || { L: 95, a: 0, b: 0 }
            }
          );

          if (adaptedResult) {
            console.log('✅ Successfully recalculated adapted tints for CxF import');
            
            // Update local state
            setCondition(prev => ({
              ...prev,
              adapted_tints: adaptedResult
            }));
          }
        } catch (error) {
          console.error('Failed to recalculate adapted tints for CxF import:', error);
          toast({
            title: 'Adaptation Failed',
            description: 'Imported data successfully but could not adapt to current substrate.',
            variant: 'destructive'
          });
        } finally {
          setIsComputingAdaptedTints(false);
        }
      };

      computeAdaptedTints();
    }
    
    // Update condition with the solid ink data (prefer explicit 100% otherwise highest)
    const solidInk = enrichedTints.find(t => !t.isSubstrate && (t.tintPercentage === 100))
      || enrichedTints.filter(t => !t.isSubstrate).sort((a,b) => (b.tintPercentage||0) - (a.tintPercentage||0))[0];
    if (solidInk && solidInk.spectralData && Object.keys(solidInk.spectralData).length > 0) {
      // Updating condition with solid ink data
      updateConditionWithParsedData({ 
        name: isNew ? solidInk.name : undefined, 
        spectral: solidInk.spectralData 
      }, true); // preserveMultiTints = true
    }
    
  }, [recalculateColorValues, measurementControls, isNew, setHasUnsavedChanges, updateConditionWithParsedData]);

  // Handle individual tint selection from wedge
  const handleTintSelect = useCallback((tintData, index) => {
    // Update condition with selected tint data if it has spectral data
    if (tintData.spectralData && Object.keys(tintData.spectralData).length > 0) {
      const newValues = recalculateColorValues(tintData.spectralData, measurementControls);
      
      setCondition(prev => ({
        ...prev,
        spectral_data: tintData.spectralData,
        ...newValues,
      }));
      // Track selected wedge as reference for Matches tab (do not persist to DB automatically)
      setReferencePatch({
        name: tintData.name || `Tint ${tintData.tintPercentage ?? ''}%`,
        tintPercentage: tintData.tintPercentage,
        spectralData: tintData.spectralData,
        lab: newValues.lab || tintData.lab || null,
        colorHex: newValues.color_hex || tintData.colorHex || tintData.color,
      });
      
      setHasUnsavedChanges(true);
    }
  }, [measurementControls, recalculateColorValues]);

  // Single object import handler for modern CxF parser
  const handleImportFromCxfSelection = (selectedObjects) => {
    try {
      if (selectedObjects.length === 0) return;
    
    const selectedObject = selectedObjects[0];
    
    // Check if this is a SpotInkCharacterisation object with multiple tints
    const isSpotInkCharacterisation = selectedObject.objectType === 'SpotInkCharacterisation' || 
                                     selectedObject.cxfVariant?.startsWith('CxF/X-4') ||
                                     selectedObject.substrateTints?.length > 0 ||
                                     selectedObject.overBlackTints?.length > 0;
    
    if (isSpotInkCharacterisation) {
      // Handle SpotInkCharacterisation with multiple tints
      console.log('=== HANDLING SPOT INK CHARACTERISATION IMPORT ===');
      console.log('selectedObject:', selectedObject);
      
      // Extract all tints from SpotInkCharacterisation
      const allTints = [];
      
      // Add substrate tints (0% tint) - try both substrateTints and tints
      const tintsList = selectedObject.substrateTints || selectedObject.tints || [];
      if (tintsList.length > 0) {
        tintsList.forEach(tint => {
          allTints.push({
            ...tint,
            isSubstrate: tint.tintPercentage === 0,
            measurementType: tint.tintPercentage === 0 ? 'substrate' : 'tint',
            originalObject: selectedObject,
            backgroundName: tint.backgroundName || 'Substrate'
          });
        });
      }
      
      // Add over-black tints
      if (selectedObject.overBlackTints) {
        selectedObject.overBlackTints.forEach(tint => {
          allTints.push({
            ...tint,
            name: `${tint.name} (Over-black)`,
            isSubstrate: false,
            measurementType: 'over-black',
            originalObject: selectedObject,
            backgroundName: tint.backgroundName || 'Black'
          });
        });
      }
      
      // If no tints found, fall back to main object as single tint
      if (allTints.length === 0) {
        allTints.push({
          name: selectedObject.name,
          tintPercentage: 100,
          colorHex: selectedObject.colorHex,
          spectralData: selectedObject.spectralData,
          lab: selectedObject.lab,
          ch: selectedObject.ch,
          measurementType: "substrate",
          isSubstrate: false,
          originalObject: selectedObject,
          backgroundName: 'Substrate'
        });
      }
      
      // Process tints like handleCxfTintsImport does
      const sortedTints = allTints.sort((a, b) => {
        const aPerc = a.isSubstrate ? 0 : (a.tintPercentage || 100);
        const bPerc = b.isSubstrate ? 0 : (b.tintPercentage || 100);
        return aPerc - bPerc;
      });
      
      // Enrich tints with computed values and measurements array
      const enrichedTints = sortedTints.map((t) => {
        const isSub = !!t.isSubstrate;
        const tintPercentage = isSub ? 0 : (t.tintPercentage ?? 100);
        let lab = t.lab;
        let ch = t.ch;
        let colorHex = t.colorHex || t.color_hex;
        if ((!lab || !ch || !colorHex) && t.spectralData && Object.keys(t.spectralData).length > 0) {
          const computed = recalculateColorValues(t.spectralData, measurementControls) || {};
          lab = lab || computed.lab;
          ch = ch || computed.ch;
          colorHex = colorHex || computed.color_hex;
        }
        
        // Structure measurements array from tint data (like wizard does)
        const measurements = (t.measurements || []).map(measurement => ({
          ...measurement,
          mode: measurement.assignedMode || measurement.mode || measurementControls.mode || 'M1',
          lab: measurement.lab || (measurement.spectral_data ? recalculateColorValues(measurement.spectral_data, measurementControls)?.lab : null),
          spectral_data: measurement.spectral_data,
          backgroundName: t.backgroundName
        }));
        
        return {
          ...t,
          isSubstrate: isSub,
          tintPercentage,
          lab,
          ch,
          colorHex,
          backgroundName: t.backgroundName || 'Substrate',
          measurements,
          spectral_data: t.spectralData,
          spectralData: t.spectralData
        };
      });
      
      console.log('enrichedTints with measurements:', enrichedTints);
      
      // Extract unique backgrounds and create backgrounds_map (like wizard does)
      const uniqueBackgrounds = [...new Set(enrichedTints.map(t => t.backgroundName))];
      const backgroundNameToKey = {};
      const backgrounds_map = {};
      uniqueBackgrounds.forEach((name, idx) => {
        const key = `bg${idx}`;
        backgroundNameToKey[name] = key;
        backgrounds_map[key] = name;
      });
      
      // Attach background_key to tints and measurements
      const tintsWithBackgroundKeys = enrichedTints.map(t => ({
        ...t,
        background_key: backgroundNameToKey[t.backgroundName],
        measurements: (t.measurements || []).map(m => ({
          ...m,
          background_key: backgroundNameToKey[m.backgroundName || t.backgroundName]
        }))
      }));
      
      // Compute available modes intersection across all tints (like wizard does)
      const modeOrder = ['M0','M1','M2','M3'];
      const tintModeSets = tintsWithBackgroundKeys
        .map(t => new Set((t.measurements || []).map(m => m.mode).filter(Boolean)))
        .filter(set => set.size > 0);
      
      let intersectedModes = [];
      if (tintModeSets.length > 0) {
        const intersection = new Set(tintModeSets[0]);
        tintModeSets.slice(1).forEach(set => {
          for (const m of Array.from(intersection)) {
            if (!set.has(m)) intersection.delete(m);
          }
        });
        intersectedModes = Array.from(intersection);
      }
      intersectedModes.sort((a,b) => modeOrder.indexOf(a) - modeOrder.indexOf(b));
      
      // Create rich imported_tints object structure (like wizard does)
      const richImportedTints = {
        tints: tintsWithBackgroundKeys,
        measurements: selectedObject.measurements || [],
        spectralDataByMode: selectedObject.spectralDataByMode || {},
        measurement_settings: {
          available_modes: intersectedModes.length > 0 ? intersectedModes : [measurementControls.mode || 'M1'],
          available_backgrounds: uniqueBackgrounds,
          start_wl: selectedObject.measurement_settings?.start_wl || 380,
          increment: selectedObject.measurement_settings?.increment || 10,
          mode: measurementControls.mode || 'M1',
          illuminant: measurementControls.illuminant || 'D50',
          observer: measurementControls.observer || '2'
        }
      };
      
      // Create ui_state with backgrounds_map
      const uiState = { 
        backgrounds_map,
        active_data_mode: 'imported'
      };
      
      console.log('Rich imported_tints structure:', richImportedTints);
      console.log('UI state with backgrounds_map:', uiState);
      
      // Cache the original imported data for future mismatch re-checking
      setOriginalImportedTints(tintsWithBackgroundKeys);
      
      // Set imported tints for visualization (use tints array for UI)
      setImportedTints(tintsWithBackgroundKeys);
      
      // Update condition state with rich structure
      setCondition(prev => ({
        ...prev,
        imported_tints: richImportedTints,
        measurement_settings: richImportedTints.measurement_settings,
        ui_state: uiState
      }));
      
      // Reset substrate mismatch choice to trigger new mismatch detection
      setSubstrateMismatchChoice(null);
      
      // Reset mismatch resolution state for fresh detection
      setMismatchResolved(false);
      console.log('🔄 Reset mismatch state for new import - fresh detection will run');
      
      // Mark as having unsaved changes
      if (!isNew) setHasUnsavedChanges(true);
      if (!isNew) setIsEditMode(true);
      
      // Recalculate adapted tints with physics-based method if in adapted mode and substrate is available
      if (activeDataMode === 'adapted' && condition?.substrate_spectral_data && astmTables?.length) {
        console.log('🔄 Recalculating adapted tints for CxF selection import using physics-based method');
        setIsComputingAdaptedTints(true);
        
        const computeAdaptedTints = async () => {
          try {
            // Extract imported substrate spectral from 0% tint of enriched tints
            const substrateFromImported = tintsWithBackgroundKeys.find(t => t.isSubstrate || (t.tintPercentage === 0));
            const importedSubstrateSpectral = substrateFromImported?.spectralData || {};
            
            const adaptedResult = adaptTintsToSubstrate(
              tintsWithBackgroundKeys,
              importedSubstrateSpectral,
              condition.substrate_spectral_data,
              {
                astmTables,
                measurementControls: condition.measurement_settings || {
                  illuminant: 'D50',
                  observer: '2',
                  table: '5'
                },
                fallbackSubstrateLab: condition.substrate_lab || { L: 95, a: 0, b: 0 }
              }
            );

            if (adaptedResult) {
              console.log('✅ Successfully recalculated adapted tints for CxF selection import');
              
              // Update local state
              setCondition(prev => ({
                ...prev,
                adapted_tints: adaptedResult
              }));
            }
          } catch (error) {
            console.error('Failed to recalculate adapted tints for CxF selection import:', error);
            toast({
              title: 'Adaptation Failed',
              description: 'Imported data successfully but could not adapt to current substrate.',
              variant: 'destructive'
            });
          } finally {
            setIsComputingAdaptedTints(false);
          }
        };

        computeAdaptedTints();
      }
      
      // Update condition with the solid ink data (prefer explicit 100% otherwise highest)
      const solidInk = tintsWithBackgroundKeys.find(t => !t.isSubstrate && (t.tintPercentage === 100))
        || tintsWithBackgroundKeys.filter(t => !t.isSubstrate).sort((a,b) => (b.tintPercentage||0) - (a.tintPercentage||0))[0];
      if (solidInk && solidInk.spectralData && Object.keys(solidInk.spectralData).length > 0) {
        updateConditionWithParsedData({ 
          name: isNew ? (selectedObject.spotInkName || selectedObject.name) : undefined, 
          spectral: solidInk.spectralData 
        }, true); // Preserve multi-tints
      }
      
      // In full-add mode, ensure substrate mismatch detection is triggered for existing conditions
      if (isFullAddMode && !isNew) {
        console.log('🔧 Full-add mode CXF import: enabling substrate mismatch detection for existing condition');
        // Force reset mismatch state to allow fresh detection
        setSubstrateMismatchChoice(null);
        setMismatchResolved(false);
      }
      
      toast({
        title: 'Import Successful',
        description: `Imported ${tintsWithBackgroundKeys.length} tint${tintsWithBackgroundKeys.length !== 1 ? 's' : ''} from ${selectedObject.name}`,
      });
    } else {
      // Handle regular single object import
      const spectralData = selectedObject.spectralData || selectedObject.spectral || {};
      if (Object.keys(spectralData).length === 0) {
        toast({
          title: 'Error Parsing CXF File',
          description: 'No spectral data found in selected object.',
          variant: 'destructive',
        });
        return;
      }
      
      // Create a single tint entry with measurements
      const singleTint = {
        name: selectedObject.name,
        tintPercentage: 100,
        colorHex: selectedObject.colorHex,
        spectralData: spectralData,
        lab: selectedObject.lab,
        ch: selectedObject.ch,
        measurementType: "substrate",
        isSubstrate: false,
        backgroundName: 'Substrate',
        background_key: 'bg0',
        measurements: (selectedObject.measurements || []).map(m => ({
          ...m,
          mode: m.assignedMode || m.mode || measurementControls.mode || 'M1',
          spectral_data: m.spectral_data,
          backgroundName: 'Substrate',
          background_key: 'bg0'
        }))
      };
      
      // Create rich structure for single tint
      const richImportedTints = {
        tints: [singleTint],
        measurements: selectedObject.measurements || [],
        measurement_settings: {
          available_modes: singleTint.measurements.map(m => m.mode).filter(Boolean),
          available_backgrounds: ['Substrate'],
          mode: measurementControls.mode || 'M1',
          illuminant: measurementControls.illuminant || 'D50',
          observer: measurementControls.observer || '2'
        }
      };
      
      const uiState = {
        backgrounds_map: { bg0: 'Substrate' },
        active_data_mode: 'imported'
      };
      
      // Set imported tints for visualization
      setImportedTints([singleTint]);
      
      // Update condition state with rich structure
      setCondition(prev => ({
        ...prev,
        imported_tints: richImportedTints,
        measurement_settings: richImportedTints.measurement_settings,
        ui_state: uiState
      }));
      
      // Update the condition with the parsed data
      updateConditionWithParsedData({ 
        name: isNew ? selectedObject.name : undefined, 
        spectral: spectralData
      });
      
      // Show success message
      toast({
        title: 'Import Successful',
        description: `Imported single measurement: ${selectedObject.name}`,
      });
    }
    } catch (error) {
      console.error('Error in handleImportFromCxfSelection:', error);
      toast({
        title: 'Import Failed',
        description: 'An error occurred while importing the CxF data.',
        variant: 'destructive'
      });
    }
  };

  const handleSaveUpdate = async (localStateValues) => {
    if (profileLoading || !profile) {
      toast({ title: 'Error', description: 'You must be logged in to perform this action.', variant: 'destructive' });
      return;
    }
    
    if (loading) {
      toast({ title: 'Error', description: 'Please wait for the component to finish loading.', variant: 'destructive' });
      return;
    }
    
    if (!inkId || typeof inkId !== 'string') {
      toast({ title: 'Error', description: 'Invalid ink ID provided.', variant: 'destructive' });
      return;
    }
    
    if (!condition || typeof condition !== 'object') {
      console.log('Condition is not properly initialized in handleSaveUpdate');
      toast({ title: 'Error', description: 'Invalid condition data provided.', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    try {
      let newSubstrateId = null;
      let newSubstrateConditionId = null;
      
      // Handle substrate creation if mismatch choice is "create"
      if (substrateMismatchChoice === 'create' && substrateNameFilled && substrateConditionNameFilled) {
        const substrateFormData = substrateForm.getValues();
        
        // Get substrate color data from imported tints if available
        let substrateColorData = {};
        if (importedTints) {
          const importedSubstrateTint = importedTints.find(tint => tint.isSubstrate || tint.tintPercentage === 0);
          if (importedSubstrateTint && importedSubstrateTint.spectralData) {
            const substrateColorValues = recalculateColorValues(importedSubstrateTint.spectralData, measurementControls);
            substrateColorData = {
              spectral_data: importedSubstrateTint.spectralData,
              lab: substrateColorValues.lab,
              ch: substrateColorValues.ch,
              color_hex: substrateColorValues.color_hex
            };
          }
        }
        
        // Create new substrate
        const { data: substrateData, error: substrateError } = await supabase
          .from('substrates')
          .insert([{
            name: substrateFormData.name,
            type: substrateFormData.type,
            material: substrateFormData.material,
            surface_quality: substrateFormData.surface_quality,
            color: substrateFormData.color,
            printing_side: substrateFormData.printing_side,
            use_white_ink: substrateFormData.use_white_ink,
            contrast: substrateFormData.contrast,
            ink_adhesion: typeof substrateFormData.ink_adhesion === 'string' ? parseInt(substrateFormData.ink_adhesion.replace(/[^0-9]/g, '')) : substrateFormData.ink_adhesion,
            notes: substrateFormData.notes,
            organization_id: profile.organization_id,
            last_modified_by: profile.id
          }])
          .select()
          .single();
          
        if (substrateError) throw substrateError;
        newSubstrateId = substrateData.id;
        
        // Create new substrate condition with imported color data
        const { data: substrateConditionData, error: substrateConditionError } = await supabase
          .from('substrate_conditions')
          .insert([{
            name: newSubstrateCondition.name,
            substrate_id: newSubstrateId,
            pack_type: newSubstrateCondition.pack_type,
            measurement_settings: newSubstrateCondition.measurement_settings || measurementControls,
            ...substrateColorData, // Populate with imported substrate color data
            construction_details: newSubstrateCondition.construction_details,
            use_white_ink: substrateFormData.use_white_ink,
            organization_id: profile.organization_id
          }])
          .select()
          .single();
          
        if (substrateConditionError) throw substrateConditionError;
        newSubstrateConditionId = substrateConditionData.id;
        
        // Update the ink condition to link to the new substrate condition
        condition.substrate_condition = newSubstrateConditionId;
      }
      
      // Filter out substrate-related fields that are for UI only and don't belong in ink_conditions table
      const {
        substrate_spectral_data,
        substrate_lab,
        substrate_ch,
        substrate_color_hex,
        ...conditionDataForSave
      } = condition;

      // Choose tints to save: prioritize final adapted data when mismatch is resolved
      const chosenTints = (() => {
        console.log('🎯 Choosing tints for save (update):', {
          mismatchResolved,
          substrateMismatchChoice,
          hasConditionImportedTints: !!condition?.imported_tints?.length,
          hasAdaptedTints: !!adaptedTints?.length,
          hasImportedTints: !!importedTints?.length
        });
        if (mismatchResolved && condition?.imported_tints?.length) {
          console.log('🎯 Using final adapted data from condition.imported_tints');
          return condition.imported_tints;
        }
        if (substrateMismatchChoice === 'adapt' && adaptedTints?.length) {
          console.log('🎯 Using temporary adapted data from adaptedTints');
          return adaptedTints;
        }
        if (substrateMismatchChoice === 'create' && importedTints?.length) {
          console.log('🎯 Using original imported data from importedTints');
          return importedTints;
        }
        const fallback = adaptedTints?.length ? adaptedTints : (importedTints?.length ? importedTints : null);
        console.log('🎯 Using fallback data:', fallback ? 'found' : 'none');
        return fallback;
      })();

      // Extract solid color from chosen tints if available
      let solidColorData = {};
      if (chosenTints) {
        const normalizedChosen = normalizeTints(chosenTints);
        const solidTint = normalizedChosen.find(tint => (tint.tintPercentage || tint.tint_percentage) === 100);
        console.log('🔍 InkConditionDetail - Found solid tint:', solidTint);
        if (solidTint) {
          solidColorData = {
            color_hex: solidTint.colorHex || solidTint.color_hex,
            lab: solidTint.lab,
            ch: solidTint.ch,
            spectral_data: solidTint.spectralData || solidTint.spectral_data,
            spectral_string: solidTint.spectralString || solidTint.spectral_string
          };
          console.log('🔍 InkConditionDetail - Storing solid color:', solidColorData.color_hex);
        } else {
          console.log('⚠️ InkConditionDetail - No 100% tint found in chosenTints!');
        }
      }

      // Prepare complete state for database persistence - avoid saving imported_tints when creating substrate condition
      const completeStateForPersistence = {
        // Core condition data
        ...conditionDataForSave,
        ink_id: inkId,
        
        // Complete measurement settings with all displayed values
        measurement_settings: { 
          ...measurementControls, 
          available_modes: availableModes,
          preferred_data_mode: activeDataMode || condition?.measurement_settings?.preferred_data_mode,
          computed_at: new Date().toISOString()
        },
        
        // Store solid color data in the main condition fields (always persist displayed values)
        ...solidColorData,
        
        // Save data based on activeDataMode
        ...(activeDataMode === 'adapted' && chosenTints ? {
          adapted_tints: chosenTints.map(tint => ({
            ...tint,
            isAdapted: true,
            adaptedFrom: condition?.substrate_condition,
            persistedAt: new Date().toISOString()
          }))
        } : {}),
        
        // Save imported data when activeDataMode is imported
        ...(activeDataMode === 'imported' && chosenTints ? {
          imported_tints: chosenTints.map(tint => ({
            ...tint,
            persistedAt: new Date().toISOString()
          }))
        } : {}),
        
        // Persist current UI state for perfect restoration
        ui_state: {
          active_data_mode: activeDataMode,
          current_substrate_condition: condition?.substrate_condition,
          last_saved_at: new Date().toISOString()
        }
      };

      const submissionData = completeStateForPersistence;
      
      
      
      // Update substrate condition if new one was created
      if (newSubstrateConditionId) {
        submissionData.substrate_condition = newSubstrateConditionId;
        submissionData.substrate_id = newSubstrateId;
      }
      
      // Apply substrate IDs from localStateValues if provided
      if (localStateValues?.selectedSubstrateId && /^[0-9a-f-]{36}$/i.test(localStateValues.selectedSubstrateId)) {
        submissionData.substrate_id = localStateValues.selectedSubstrateId;
      }
      if (localStateValues?.localSubstrateConditionId && /^[0-9a-f-]{36}$/i.test(localStateValues.localSubstrateConditionId)) {
        submissionData.substrate_condition = localStateValues.localSubstrateConditionId;
      }

      // Clean up any undefined or empty string values that might cause issues
      const fieldsToNullify = ['pack_type', 'substrate_condition'];
      fieldsToNullify.forEach(field => {
        if (submissionData[field] === '' || submissionData[field] === undefined) {
          submissionData[field] = null;
        }
      });
      
      // Ensure all required fields are properly typed
      if (typeof submissionData.name !== 'string') {
        throw new Error('Name must be a string');
      }
      
      if (typeof submissionData.ink_id !== 'string') {
        throw new Error('Ink ID must be a string');
      }

      // Set is_hidden to false for imported conditions when saving
      submissionData.is_hidden = false;
      
      // Handle substrate_condition - extract condition ID if it's a composite value
      if (submissionData.substrate_condition && typeof submissionData.substrate_condition === 'string') {
        if (submissionData.substrate_condition.includes('_')) {
          // Extract condition ID from composite format (substrate_id_condition_id)
          const parts = submissionData.substrate_condition.split('_');
          submissionData.substrate_condition = parts[1]; // Take the condition ID part
          console.log('🔧 Extracted condition ID from composite:', submissionData.substrate_condition);
        }
      } else if (submissionData.substrate_condition && typeof submissionData.substrate_condition !== 'string') {
        console.error('substrate_condition is not a string:', submissionData.substrate_condition);
        submissionData.substrate_condition = null;
      }
      
      // Remove any properties that shouldn't be sent to the database
      delete submissionData.created_at;
      delete submissionData.updated_at;

      console.log('Final submissionData for ink_conditions update:', submissionData);
      console.log('inkId being used:', inkId);
      console.log('submissionData.ink_id:', submissionData.ink_id);

      // Debug: Verify the ink exists and belongs to the user's organization
      if (isNew) {
        // Test authentication with the custom client
        const { data: authTest, error: authError } = await supabase.auth.getUser();
        console.log('Auth test result:', authTest);
        console.log('Auth error:', authError);
        
        if (authError || !authTest?.user) {
          throw new Error('Authentication failed - user not authenticated');
        }
        
        console.log('Authenticated user:', authTest.user.id);
        
        // Check if profile exists for this user
        const { data: profileCheck, error: profileError } = await supabase
          .from('profiles')
          .select('id, organization_id')
          .eq('id', authTest.user.id)
          .single();
        
        console.log('Profile check result:', profileCheck);
        console.log('Profile error:', profileError);
        
        if (profileError || !profileCheck) {
          throw new Error('Profile not found for authenticated user');
        }
      }

      let result;
      
      if (isNew) {
        delete submissionData.id;
        // Also update parent ink properties for new conditions
        const inkFormData = inkForm.getValues();
        const inkUpdateData = {
          name: inkFormData.name,
          print_process: inkFormData.print_process,
          ink_type: inkFormData.ink_type,
          curve: inkFormData.curve,
          appearance_type: inkFormData.appearance_type,
          opacity_left: inkFormData.opacity_left,
          metallic_gloss: inkFormData.metallic_gloss,
          series: inkFormData.series,
          book_id: inkFormData.book_id || null,
          is_hidden: false
        };

        await supabase
          .from('inks')
          .update(inkUpdateData)
          .eq('id', inkId);

        // Calculate color_hex before insertion - use activeDataMode
        const effectiveDataMode = submissionData?.measurement_settings?.preferred_data_mode || activeDataMode;
        
        // Get substrate spectral data for adaptation calculation
        const substrateSpectralData = condition.substrate_spectral_data || null;
        
        const calculatedColorHex = calculateInkConditionColorHex(
          submissionData,
          effectiveDataMode,
          profile?.organization_defaults,
          astmTables,
          substrateSpectralData
        );
        submissionData.color_hex = calculatedColorHex;

        result = await supabase.from('ink_conditions').insert([submissionData]).select().single();
      } else {
        if (!conditionId) {
          throw new Error("Condition ID is missing for update.");
        }
        
        // Updating ink condition (direct update)
        const directPayload = {
          name: submissionData.name,
          color_hex: submissionData.color_hex ?? null,
          spectral_data: submissionData.spectral_data ?? null,
          lab: submissionData.lab ?? null,
          ch: submissionData.ch ?? null,
          measurement_settings: submissionData.measurement_settings ?? null,
          spectral_string: submissionData.spectral_string ?? null,
          substrate_condition: submissionData.substrate_condition ?? null,
          ink_curve: submissionData.ink_curve ?? 'as_measured',
          pack_type: typeof submissionData.pack_type === 'string' ? submissionData.pack_type : (submissionData.pack_type?.value ?? null),
          version: submissionData.version ?? null,
          is_hidden: false,
          updated_at: new Date().toISOString(),
          ui_state: submissionData.ui_state
        };
        // Include adapted_tints and imported_tints based on what data was provided
        if (submissionData.adapted_tints != null) {
          directPayload.adapted_tints = submissionData.adapted_tints;
        }
        if (submissionData.imported_tints != null) {
          directPayload.imported_tints = submissionData.imported_tints;
        }
        const upd = await supabase
          .from('ink_conditions')
          .update(directPayload)
          .eq('id', conditionId)
          .select()
          .maybeSingle();

        if (upd.error || !upd.data) {
          throw new Error(`Failed to update condition: ${upd.error?.message || 'No data returned'}`);
        }
        result = { data: upd.data, error: null };
      }

      const { data, error } = result;

      if (error) throw error;

      // Update parent ink properties and unhide it
      try {
        const inkFormData = inkForm.getValues();
        const inkUpdateData = {
          name: inkFormData.name,
          print_process: inkFormData.print_process,
          ink_type: inkFormData.ink_type,
          curve: inkFormData.curve,
          appearance_type: inkFormData.appearance_type,
          opacity_left: inkFormData.opacity_left,
          metallic_gloss: inkFormData.metallic_gloss,
          series: inkFormData.series,
          book_id: inkFormData.book_id || null,
          is_hidden: false
        };

        await supabase
          .from('inks')
          .update(inkUpdateData)
          .eq('id', inkId);

        // Update local ink state
        setInk(prev => ({ ...prev, ...inkUpdateData }));
        
        console.log('✅ Parent ink updated successfully');
      } catch (error) {
        console.warn('⚠️ Failed to update parent ink:', error);
      }

      toast({
        title: 'Success!',
        description: `Condition ${isNew ? 'created' : 'updated'} successfully.`,
      });

      // Proactively refresh substrate lists used in selectors
      try { refetchSubstrates?.(); } catch {}

      // Update state after successful save
      setCondition(data);
      setOriginalCondition(data);
      setIsEditMode(false);
      setHasUnsavedChanges(false);
      
      // Force refresh to ensure auto-generated names are displayed correctly
      await forceRefreshConditions();
      
      // Note: activeDataMode will be resolved by useEffect after condition refresh
      
      
      // Proactively refresh ink data across the app so list/flyout icons update
      try { await forceRefreshConditions?.(); } catch {}
      
      // Handle imported tints state based on what was saved
      if (substrateMismatchChoice === 'adapt' && adaptedTints) {
        // Mark adapted tints to prevent re-triggering mismatch detection
        const markedAdaptedTints = adaptedTints.map(tint => ({
          ...tint,
          isAdapted: true
        }));
        setImportedTints(markedAdaptedTints);
      } else if (substrateMismatchChoice === 'create' && importedTints) {
        setImportedTints(importedTints);
      }
      
      // Clear substrate mismatch state after updating imported tints
      setSubstrateMismatchChoice(null);
      setAdaptedTints(null);
      setNewSubstrateData(null);
      setNewSubstrateConditionData(null);
      
      // Clear original imported data cache after successful save
      setOriginalImportedTints(null);
      setJustSaved(true);
      
      if (isNew) {
        // For new conditions, navigate to the created condition
        navigate(`/assets/inks/${inkId}/conditions/${data.id}`, { replace: true });
      } else {
        // For existing conditions, exit edit mode and stay on the same page
        setIsEditMode(false);
        setHasUnsavedChanges(false);
        // Reset substrate mismatch state and clear imported tints
        setSubstrateMismatchChoice(null);
        setImportedTints(null);
        setAdaptedTints(null);
        setNewSubstrateData(null);
        setNewSubstrateConditionData(null);
        // Refresh the condition data to show the updated state
        await fetchCondition(conditionId);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${isNew ? 'create' : 'update'} condition. ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNew = async (localStateValues) => {
    console.log('🚀 handleSaveNew called - starting save process');
    
    if (profileLoading || !profile) {
      console.error('❌ Profile not loaded or missing');
      toast({ title: 'Error', description: 'You must be logged in to perform this action.', variant: 'destructive' });
      return;
    }
    
    if (loading) {
      console.error('❌ Component still loading');
      toast({ title: 'Error', description: 'Please wait for the component to finish loading.', variant: 'destructive' });
      return;
    }
    
    if (!inkId || typeof inkId !== 'string') {
      console.error('❌ Invalid ink ID:', inkId);
      toast({ title: 'Error', description: 'Invalid ink ID provided.', variant: 'destructive' });
      return;
    }
    
    if (!condition || typeof condition !== 'object') {
      console.error('❌ Condition not properly initialized:', condition);
      console.log('Condition is not properly initialized, creating fallback condition');
      // Create a fallback condition if it's not properly initialized
      const fallbackCondition = {
        name: '',
        pack_type: '',
        color_hex: '#FFFFFF',
        is_part_of_structure: false,
        spectral_data: null
      };
      setCondition(fallbackCondition);
      
      toast({ 
        title: 'Warning', 
        description: 'Please fill in the condition details before saving.', 
        variant: 'destructive' 
      });
      return;
    }
    
    console.log('✅ Initial validation passed. Current condition:', condition);
    
    // Auto-generate name if empty
    if (!condition.name || condition.name.trim() === '') {
      console.log('🏷️ Condition name is empty, attempting auto-generation...');
      
      // Try to generate name if we have substrate condition
      if (condition.substrate_condition) {
        // Import the name generation utility
        const { generateInkConditionNameFromData } = await import('@/lib/inkConditionNameGenerator');
        
        // Fetch substrate condition data for name generation
        try {
          const { data: substrateConditionData } = await supabase
            .from('substrate_conditions')
            .select('name')
            .eq('id', condition.substrate_condition)
            .maybeSingle();
          
          if (substrateConditionData) {
            const autoGeneratedName = generateInkConditionNameFromData(
              substrateConditionData,
              condition.ink_curve || 'as_measured',
              condition.version
            );
            
            if (autoGeneratedName) {
              console.log('🏷️ Auto-generated name:', autoGeneratedName);
              // Update the condition object
              condition.name = autoGeneratedName;
              // Update React state
              setCondition(prev => ({ ...prev, name: autoGeneratedName }));
            } else {
              console.error('❌ Failed to auto-generate condition name');
              toast({ 
                title: 'Validation Error', 
                description: 'Please enter a name for the condition before saving.', 
                variant: 'destructive' 
              });
              return;
            }
          } else {
            console.error('❌ Could not fetch substrate condition data for name generation');
            toast({ 
              title: 'Validation Error', 
              description: 'Please enter a name for the condition before saving.', 
              variant: 'destructive' 
            });
            return;
          }
        } catch (error) {
          console.error('❌ Error during name auto-generation:', error);
          toast({ 
            title: 'Validation Error', 
            description: 'Please enter a name for the condition before saving.', 
            variant: 'destructive' 
          });
          return;
        }
      } else {
        console.error('❌ Condition name is required and no substrate condition available for auto-generation');
        toast({ 
          title: 'Validation Error', 
          description: 'Please enter a name for the condition before saving.', 
          variant: 'destructive' 
        });
        return;
      }
    }
    
    if (originalCondition && condition.name === originalCondition.name) {
      console.error('❌ Name must be different from original');
      toast({ 
        title: 'Different name required', 
        description: 'If you wish to create a new condition, please use a different name than the existing condition.', 
        variant: 'destructive' 
      });
      return;
    }

    console.log('🚀 Starting save process with substrate mismatch choice:', substrateMismatchChoice);
    setSaving(true);
    try {
      let newSubstrateId = null;
      let newSubstrateConditionId = null;
      
      // Handle substrate creation if mismatch choice is "create"
      if (substrateMismatchChoice === 'create' && newSubstrateData && newSubstrateConditionData) {
        // Create new substrate
        const formVals = substrateForm.getValues();
        const substrateInsert = {
          name: formVals.name || (newSubstrateData?.name || ''),
          type: formVals.type || newSubstrateData?.type || null,
          material: formVals.material || newSubstrateData?.material || null,
          surface_quality: formVals.surface_quality || newSubstrateData?.surface_quality || null,
          color: formVals.color || newSubstrateData?.color || null,
          printing_side: formVals.printing_side || newSubstrateData?.printing_side || 'Surface',
          use_white_ink: typeof formVals.use_white_ink === 'boolean' ? formVals.use_white_ink : (newSubstrateData?.use_white_ink || false),
          contrast: formVals.contrast || newSubstrateData?.contrast || null,
          ink_adhesion: typeof (formVals.ink_adhesion || newSubstrateData?.ink_adhesion) === 'string'
            ? parseInt(String(formVals.ink_adhesion || newSubstrateData?.ink_adhesion).replace(/[^0-9]/g, ''))
            : (formVals.ink_adhesion || newSubstrateData?.ink_adhesion || null),
          notes: formVals.notes || newSubstrateData?.notes || null,
          organization_id: profile.organization_id,
          last_modified_by: profile.id
        };
        const { data: substrateData, error: substrateError } = await supabase
          .from('substrates')
          .insert([substrateInsert])
          .select()
          .single();
          
        if (substrateError) throw substrateError;
        newSubstrateId = substrateData.id;
        
        // Create new substrate condition
        const scInsert = {
          name: newSubstrateCondition?.name || newSubstrateConditionData?.name || '',
          pack_type: newSubstrateCondition?.pack_type || newSubstrateConditionData?.pack_type || null,
          measurement_settings: newSubstrateCondition?.measurement_settings || newSubstrateConditionData?.measurement_settings || measurementControls,
          spectral_data: newSubstrateCondition?.spectral_data || newSubstrateConditionData?.spectral_data || null,
          lab: newSubstrateCondition?.lab || newSubstrateConditionData?.lab || null,
          ch: newSubstrateCondition?.ch || newSubstrateConditionData?.ch || null,
          color_hex: newSubstrateCondition?.color_hex || newSubstrateConditionData?.color_hex || null,
          construction_details: newSubstrateCondition?.construction_details || newSubstrateConditionData?.construction_details || null,
          use_white_ink: typeof formVals.use_white_ink === 'boolean' ? formVals.use_white_ink : (newSubstrateCondition?.use_white_ink ?? null),
          substrate_id: newSubstrateId,
          organization_id: profile.organization_id
        };
        const { data: substrateConditionData, error: substrateConditionError } = await supabase
          .from('substrate_conditions')
          .insert([scInsert])
          .select()
          .single();
          
        if (substrateConditionError) throw substrateConditionError;
        newSubstrateConditionId = substrateConditionData.id;
      }

      // Filter out substrate-related fields that are for UI only and don't belong in ink_conditions table
      const {
        substrate_spectral_data,
        substrate_lab,
        substrate_ch,
        substrate_color_hex,
        ...conditionDataForSave
      } = condition;

       // Choose tints to save: ensure adapted data is properly marked and normalized
       const chosenTints = (() => {
         console.log('🎯 Choosing tints for save:', {
           mismatchResolved,
           substrateMismatchChoice,
           activeDataMode,
           hasConditionImportedTints: !!condition?.imported_tints?.length,
           hasAdaptedTints: !!adaptedTints?.length,
           hasImportedTints: !!importedTints?.length
         });
         
         // When saving adapted data, ensure tints are properly marked
         if (substrateMismatchChoice === 'adapt' && adaptedTints?.length) {
           console.log('🎯 Using adapted data with proper marking');
           const markedAdaptedTints = adaptedTints.map(tint => ({
             ...tint,
             isAdapted: true,
             adaptedAt: new Date().toISOString(),
             originalData: tint.originalData || tint // Preserve original for reference
           }));
           return markedAdaptedTints;
         }
         
         // When mismatch is resolved, ensure existing adapted data retains markers
         if (mismatchResolved && condition?.imported_tints?.length) {
           console.log('🎯 Using resolved mismatch data from condition');
           return condition.imported_tints;
         }
         
         if (substrateMismatchChoice === 'create' && importedTints?.length) {
           console.log('🎯 Using original imported data for new substrate');
           return importedTints;
         }
         
         // Fallback: use whatever is available but normalize it
         const fallback = adaptedTints?.length ? adaptedTints : (importedTints?.length ? importedTints : condition?.imported_tints);
         console.log('🎯 Using fallback data:', fallback ? 'found' : 'none');
         return fallback ? normalizeTints(fallback) : null;
       })();

       // Serialize imported tints safely before saving
       let safeTints = null;
       try {
         safeTints = chosenTints ? JSON.parse(JSON.stringify(chosenTints)) : null;
       } catch (e) {
         console.warn('🛑 HARD STOP: Imported tints not serializable', e);
         toast({
           title: 'Imported data error',
           description: 'Imported measurements are not serializable. Please re-import or simplify.',
           variant: 'destructive',
         });
         setSaving(false);
         return;
       }

       // HARD STOP: ensure we have at least one tint (allow 0% only cases)
       const normalizedSafeTints = normalizeTints(safeTints || []);
       if (!Array.isArray(normalizedSafeTints) || normalizedSafeTints.length === 0) {
         console.warn('🛑 HARD STOP: No measurement data to save');
         toast({
           title: 'No measurements',
           description: 'No measurement data to save. Import at least one tint.',
           variant: 'destructive',
         });
         setSaving(false);
         return;
       }

       const submissionData = {
         ...conditionDataForSave,
         ink_id: inkId,
         measurement_settings: { 
           ...measurementControls, 
           available_modes: availableModes,
           preferred_data_mode: activeDataMode, // Persist the user's data mode choice
           saved_at: new Date().toISOString()
         },
         // Save tints with proper adaptation metadata (already serialized)
         imported_tints: safeTints,
       };

       
      
      // Update substrate condition if new one was created
      if (newSubstrateConditionId) {
        submissionData.substrate_condition = newSubstrateConditionId;
        submissionData.substrate_id = newSubstrateId;
      }
      
      // Apply substrate IDs from localStateValues if provided
      if (localStateValues?.selectedSubstrateId && /^[0-9a-f-]{36}$/i.test(localStateValues.selectedSubstrateId)) {
        submissionData.substrate_id = localStateValues.selectedSubstrateId;
      }
      if (localStateValues?.localSubstrateConditionId && /^[0-9a-f-]{36}$/i.test(localStateValues.localSubstrateConditionId)) {
        submissionData.substrate_condition = localStateValues.localSubstrateConditionId;
      }

      const fieldsToNullify = ['pack_type', 'substrate_condition'];
      fieldsToNullify.forEach(field => {
        if (submissionData[field] === '' || submissionData[field] === undefined) {
          submissionData[field] = null;
        }
      });

      // Coerce primitive types for text columns that may come from Select components
      if (submissionData.pack_type && typeof submissionData.pack_type !== 'string') {
        submissionData.pack_type = submissionData.pack_type.value || submissionData.pack_type.name || String(submissionData.pack_type) || null;
      }

      // Ensure all required fields are properly typed
      if (typeof submissionData.name !== 'string') {
        throw new Error('Name must be a string');
      }
      submissionData.name = submissionData.name.trim();
      
      if (typeof submissionData.ink_id !== 'string') {
        throw new Error('Ink ID must be a string');
      }

      // Set is_hidden to false for imported conditions when saving
      submissionData.is_hidden = false;
      
      // Handle substrate_condition - extract condition ID if it's a composite value
      if (submissionData.substrate_condition && typeof submissionData.substrate_condition === 'string') {
        if (submissionData.substrate_condition.includes('_')) {
          // Extract condition ID from composite format (substrate_id_condition_id)
          const parts = submissionData.substrate_condition.split('_');
          submissionData.substrate_condition = parts[1]; // Take the condition ID part
          console.log('🔧 Extracted condition ID from composite:', submissionData.substrate_condition);
        }
      } else if (submissionData.substrate_condition && typeof submissionData.substrate_condition !== 'string') {
        console.error('substrate_condition is not a string:', submissionData.substrate_condition);
        submissionData.substrate_condition = null;
      }

      // Remove any properties that shouldn't be sent to the database
      delete submissionData.id;
      delete submissionData.created_at;
      delete submissionData.updated_at;

      // Calculate color_hex before insertion - determine effective data mode based on form state
      const effectiveDataMode = submissionData?.measurement_settings?.preferred_data_mode || 
        (substrateMismatchChoice === 'adapt' ? 'adapted' : 
         substrateMismatchChoice === 'create' ? 'imported' : activeDataMode);
      
      // Get substrate spectral data for adaptation calculation
      const substrateSpectralData = newSubstrateCondition?.spectral_data || null;
      
      const calculatedColorHex = calculateInkConditionColorHex(
        submissionData,
        effectiveDataMode,
        profile?.organization_defaults,
        astmTables,
        substrateSpectralData
      );
      submissionData.color_hex = calculatedColorHex;

      console.log('📤 Attempting to insert ink condition with data:', submissionData);

      // Primary insert attempt
      let result = await supabase.from('ink_conditions').insert([submissionData]).select().single();

      if (result.error || !result.data) {
        // HARD STOP: Do not proceed silently.
        try {
          const payloadSize = JSON.stringify(submissionData).length;
          const tintsSize = submissionData.imported_tints ? JSON.stringify(submissionData.imported_tints).length : 0;
          console.warn('🛑 HARD STOP: Primary insert failed', { error: result.error, payloadSize, tintsSize });
        } catch (sizingErr) {
          console.warn('🛑 HARD STOP: Primary insert failed (size estimation error)', { error: result.error, sizingErr });
        }
        toast({
          title: 'Save failed',
          description: 'Could not create condition. See console for details.',
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }
      const { data, error } = result;
      console.log('📥 Insert/Update result:', { data, error });

      if (error) {
        console.error('❌ Database insert error:', error);
        throw error;
      }

      console.log('✅ Successfully created new ink condition:', data);
      
      // Post-insert verification: ensure imported_tints persisted when provided
      try {
        const intendedCount = (normalizeTints(submissionData.imported_tints)?.length) || 0;
        const { data: verifyRow, error: verifyErr } = await supabase
          .from('ink_conditions')
          .select('id, imported_tints, substrate_condition')
          .eq('id', data.id)
          .single();
        if (!verifyErr && intendedCount > 0) {
          const savedNormalized = normalizeTints(verifyRow?.imported_tints || []);
          if (!Array.isArray(savedNormalized) || savedNormalized.length === 0) {
            console.warn('🛑 HARD STOP: Imported measurements did not persist', { intendedCount, savedCount: savedNormalized?.length || 0 });
            toast({
              title: 'Imported data lost',
              description: 'Imported measurements did not persist. Please try again.',
              variant: 'destructive',
            });
            try { await supabase.from('ink_conditions').delete().eq('id', data.id); } catch (delErr) { console.warn('Cleanup delete failed', delErr); }
            setSaving(false);
            return;
          }
        }
      } catch (verifyCatch) {
        console.warn('Verification step encountered an error (continuing)', verifyCatch);
      }
      
      // Unhide the parent ink unconditionally (RLS may block SELECT on hidden rows)
      try {
        await supabase
          .from('inks')
          .update({ is_hidden: false })
          .eq('id', inkId);
      } catch (error) {
        console.warn('⚠️ Failed to unhide parent ink:', error);
      }
      
      // Note: Detailed success toast will be shown after final verification

      // Proactively refresh lists so the new ink/condition appears in Inks list
      try { 
        await forceRefreshConditions?.(); 
        await refetchSubstrates?.(); 
      } catch {}

      // Handle imported tints state based on what was saved
      if (substrateMismatchChoice === 'adapt' && adaptedTints) {
        // Mark adapted tints to prevent re-triggering mismatch detection
        const markedAdaptedTints = adaptedTints.map(tint => ({
          ...tint,
          isAdapted: true
        }));
        setImportedTints(markedAdaptedTints);
      } else if (substrateMismatchChoice === 'create' && importedTints) {
        setImportedTints(importedTints);
      }
      
      // Clear substrate mismatch state after updating imported tints
      setSubstrateMismatchChoice(null);
      setAdaptedTints(null);
      setNewSubstrateData(null);
      setNewSubstrateConditionData(null);
      
      // Clear original imported data cache after successful save
      setOriginalImportedTints(null);
      setJustSaved(true);

      if (data) {
        // Optimistically add the new condition to the inks list
        optimisticAddInkCondition(inkId, data);
        
        try {
          // Auto-create substrate condition from imported tints when possible
          const hasZeroTint = (() => {
            try {
              const tints = normalizeTints(data?.imported_tints || importedTints || condition?.imported_tints || []);
              const found = Array.isArray(tints) && tints.some(t => getTintPercentage(t) === 0 && (t.spectral_data || t.spectralData));
              console.log('🔎 Post-create 0% tint check:', {
                tintsCount: Array.isArray(tints) ? tints.length : 0,
                hasZeroTint: found,
                sampleZero: Array.isArray(tints) ? tints.find(t => getTintPercentage(t) === 0) : null,
              });
              return found;
            } catch (e) {
              console.warn('0% tint detection failed:', e);
              return false;
            }
          })();

          const noSubstrateCondition = !data?.substrate_condition && !condition?.substrate_condition;

          if (hasZeroTint && noSubstrateCondition && profile?.organization_id) {
            const substrateIdToUse =
              condition?.substrate_id ||
              selectedSubstrate?.id;

            console.log('🎯 Substrate selection after create:', {
              conditionSubstrateId: condition?.substrate_id,
              selectedSubstrateId: selectedSubstrate?.id,
              substrateIdToUse,
            });

            if (!substrateIdToUse) {
              // Try to find or create a default substrate for the organization
              try {
                console.log('🔍 No substrate available, trying to find/create default...');
                
                // First try to find an existing substrate for this org
                const { data: existingSubstrates, error: findError } = await supabase
                  .from('substrates')
                  .select('id, name')
                  .eq('organization_id', profile.organization_id)
                  .limit(1);
                
                if (!findError && existingSubstrates?.length > 0) {
                  substrateIdToUse = existingSubstrates[0].id;
                  console.log('✅ Found existing substrate:', existingSubstrates[0].name);
                } else {
                  // Create a default substrate
                  const { data: newSubstrate, error: createError } = await supabase
                    .from('substrates')
                    .insert({
                      name: 'C1S Paper',
                      printing_side: 'Surface',
                      use_white_ink: false,
                      organization_id: profile.organization_id
                    })
                    .select('id')
                    .single();
                  
                  if (!createError && newSubstrate) {
                    substrateIdToUse = newSubstrate.id;
                    console.log('✅ Created default substrate with ID:', substrateIdToUse);
                  } else {
                    console.error('Failed to create default substrate:', createError);
                    toast({
                      title: 'No Substrate Available',
                      description: 'Could not resolve or create a substrate to link. Please create a substrate manually.',
                      variant: 'destructive',
                    });
                    setSaving(false);
                    return;
                  }
                }
              } catch (substrateFindError) {
                console.error('Error finding/creating substrate:', substrateFindError);
                toast({
                  title: 'Substrate Resolution Failed',
                  description: 'Could not resolve a substrate to link. Please try again.',
                  variant: 'destructive',
                });
                setSaving(false);
                return;
              }
            }
            
            if (substrateIdToUse) {
              const created = await createSubstrateConditionFromTints(
                data.id,
                substrateIdToUse,
                profile.organization_id
              );

              // If created, force-link the ink condition to the substrate condition
              const createdId = typeof created === 'object' ? created?.id : created;
              if (createdId) {
                // Force-link the ink condition to ensure both substrate_condition and substrate_id are set
                try {
                  await supabase
                    .from('ink_conditions')
                    .update({ 
                      substrate_condition: createdId, 
                      substrate_id: substrateIdToUse 
                    })
                    .eq('id', data.id);
                  console.log('✅ Force-linked ink condition to substrate condition:', createdId);
                } catch (linkError) {
                  console.error('Failed to force-link ink condition:', linkError);
                  toast({
                    title: 'Link Failed',
                    description: 'Failed to link ink condition to substrate condition.',
                    variant: 'destructive',
                  });
                  setSaving(false);
                  return;
                }

                // Verify the link persisted
                try {
                  const { data: verifyLink, error: verifyError } = await supabase
                    .from('ink_conditions')
                    .select('substrate_condition, substrate_id')
                    .eq('id', data.id)
                    .single();
                  
                  if (verifyError || !verifyLink?.substrate_condition) {
                    console.error('Link verification failed:', verifyError);
                    toast({
                      title: 'Link Verification Failed',
                      description: 'Substrate condition link did not persist.',
                      variant: 'destructive',
                    });
                    setSaving(false);
                    return;
                  }
                } catch (verifyLinkError) {
                  console.warn('Link verification error (continuing):', verifyLinkError);
                }

                try {
                  await supabase.rpc('update_ink_condition_name_auto', { p_condition_id: data.id });
                } catch (e) {
                  console.warn('Failed to auto-update ink condition name:', e);
                }

                try {
                  // Force refresh conditions to ensure auto-generated names are displayed
                  forceRefreshConditions();
                } catch {}
              } else {
                toast({
                  title: 'Substrate Condition Creation Failed',
                  description: 'The substrate condition could not be created from the imported 0% tint.',
                  variant: 'destructive',
                });
                setSaving(false);
                return;
              }
            }
          }
        } catch (e) {
          console.warn('Auto-create substrate condition flow failed:', e);
          toast({
            title: 'Auto-create Failed',
            description: 'An error occurred while creating the substrate condition. Please resolve and try again.',
            variant: 'destructive',
          });
          return;
        }

        // Final status summary and navigation
        try {
          const finalIntendedCount = (normalizeTints(submissionData.imported_tints)?.length) || 0;
          const { data: finalVerifyRow } = await supabase
            .from('ink_conditions')
            .select('imported_tints, substrate_condition')
            .eq('id', data.id)
            .single();
          
          const finalSavedNormalized = normalizeTints(finalVerifyRow?.imported_tints || []);
          const finalSavedCount = finalSavedNormalized?.length || 0;
          const finalHasZeroTint = Array.isArray(finalSavedNormalized) && finalSavedNormalized.some(t => getTintPercentage(t) === 0);
          const finalSubstrateConditionId = finalVerifyRow?.substrate_condition;

          // Guard against data loss after substrate condition creation
          if (finalIntendedCount > 0 && finalSavedCount === 0) {
            console.error('🛑 HARD STOP: Imported data lost after substrate condition creation');
            toast({
              title: 'Imported Data Lost',
              description: 'Imported measurements were lost after substrate condition creation. Please try again.',
              variant: 'destructive',
            });
            setSaving(false);
            return;
          }

          console.groupCollapsed('📊 Final condition creation summary');
          console.log('Intended tint count:', finalIntendedCount);
          console.log('Saved tint count:', finalSavedCount);
          console.log('Has 0% tint:', finalHasZeroTint);
          console.log('Substrate condition ID:', finalSubstrateConditionId);
          console.log('Created substrate condition:', !!finalSubstrateConditionId);
          console.groupEnd();

          toast({
            title: 'Created condition',
            description: `Tints: ${finalSavedCount}; Substrate condition: ${finalSubstrateConditionId ? 'yes' : 'no'}`,
            duration: 3000, // Show toast for 3 seconds
          });

          // Delay navigation to let toast show
          setTimeout(() => {
            navigate(`/assets/inks/${inkId}/conditions/${data.id}`, { replace: true });
          }, 1500);
        } catch (finalErr) {
          console.warn('Final status summary failed (continuing):', finalErr);
          // Still navigate on success, but with delay
          setTimeout(() => {
            navigate(`/assets/inks/${inkId}/conditions/${data.id}`, { replace: true });
          }, 1500);
        }
      }
    } catch (error) {
      console.error('❌ Error in handleSaveNew:', error);
      console.error('❌ Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      toast({
        title: 'Error',
        description: `Failed to create new condition. ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleNameChange = (e) => {
    setCondition(prev => ({ ...prev, name: e.target.value }));
    if (!isNew) setHasUnsavedChanges(true);
  };

  const handleMeasurementControlsChange = (newControls) => {
    setMeasurementControls(newControls);
    if (!isNew) setHasUnsavedChanges(true);
    
    // Auto-save measurement controls for existing conditions to persist user's display preferences
    if (!isNew && conditionId && pageInitializedRef.current) {
      // Debounced auto-save to avoid excessive DB calls
      const autoSaveMeasurementControls = async () => {
        try {
          console.log('🔧 Auto-saving measurement controls changes');
          const { error } = await supabase
            .from('ink_conditions')
            .update({
              measurement_settings: {
                ...newControls,
                available_modes: availableModes,
                preferred_data_mode: activeDataMode,
                last_updated: new Date().toISOString()
              }
            })
            .eq('id', conditionId);
            
          if (error) {
            console.warn('⚠️ Auto-save measurement controls failed:', error);
          } else {
            console.log('✅ Measurement controls auto-saved to database');
          }
        } catch (error) {
          console.warn('⚠️ Auto-save measurement controls error:', error);
        }
      };
      
      // Debounce to avoid excessive DB calls
      setTimeout(autoSaveMeasurementControls, 2000);
    }
  };

  const handlePackTypeChange = (packType) => {
    setCondition(prev => ({ ...prev, pack_type: packType }));
    if (!isNew) setHasUnsavedChanges(true);
  };

  // Edit button clicked
  const handleEdit = () => {
    setIsEditMode(true);
    // After edit - should be true
  };

  // Save this ink condition as a new Color and navigate to its detail page
  const handleSaveAsColor = async () => {
    try {
      if (profileLoading || !profile?.organization_id) {
        toast({ title: 'Not available', description: 'Please sign in and select an organization.', variant: 'destructive' });
        return;
      }

      // Verify the user's organization exists and is accessible
      const { data: orgCheck, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', profile.organization_id)
        .single();

      if (orgError || !orgCheck) {
        console.error('Organization access error:', orgError);
        toast({ 
          title: 'Organization Error', 
          description: 'Your organization is not accessible. Please contact your administrator.', 
          variant: 'destructive' 
        });
        return;
      }

      // Derive the exact hex used by the visible solid block (100% tint)
      let hex = null;
      let solid = null;
      // Use the correct tints based on current activeDataMode
      const tints = activeDataMode === 'adapted' && Array.isArray(condition?.adapted_tints)
        ? condition.adapted_tints
        : Array.isArray(condition?.imported_tints) ? condition.imported_tints : null;
      if (tints && tints.length) {
        solid = tints.find(t => t.tintPercentage === 100) || tints[tints.length - 1];
        if (solid) {
          // Respect adapted/original choice when present
          if (solid.usingAdaptedData !== undefined) {
            if (solid.usingAdaptedData && solid.adaptedData?.colorHex) {
              hex = solid.adaptedData.colorHex;
            } else if (!solid.usingAdaptedData && solid.originalImportData?.colorHex) {
              hex = solid.originalImportData.colorHex;
            }
          }
          // Fallbacks matching wedge logic
          if (!hex) hex = solid.color_hex || solid.colorHex || solid.color || null;
          if (!hex && solid.lab && solid.lab.L != null && solid.lab.a != null && solid.lab.b != null) {
            try { hex = labToHex(solid.lab.L, solid.lab.a, solid.lab.b); } catch {}
          }
        }
      }
      // Legacy fallbacks
      if (!hex) hex = condition?.color_hex || null;
      if (!hex && condition?.lab && condition.lab.L != null) {
        try { hex = labToHex(condition.lab.L, condition.lab.a, condition.lab.b); } catch {}
      }

      if (!hex) {
        toast({ title: 'No solid color found', description: 'Import tints and ensure 100% solid is available first.', variant: 'destructive' });
        return;
      }

      // Create a hidden ink for this color (RLS requires ink to belong to user's org)
      const { data: hiddenInk, error: inkError } = await supabase
        .from('inks')
        .insert([{
          name: condition.name || 'Ink from condition',
          organization_id: profile.organization_id,
          type: 'spot',
          curve: condition.ink_curve || 'as_measured',
          appearance_type: 'standard',
          is_hidden: true // Hide from ink list
        }])
        .select('id')
        .single();
      if (inkError) throw inkError;

      // Create a hidden copy of the ink condition linked to the hidden ink
      const { data: copiedCondition, error: conditionError } = await supabase
        .from('ink_conditions')
        .insert([{
          ink_id: hiddenInk.id, // Link to hidden ink
          name: condition.name,
          color_hex: hex,
          lab: solid?.lab || condition?.lab,
          ch: solid?.ch || condition?.ch,
          spectral_data: solid?.spectralData || condition?.spectral_data,
          imported_tints: condition.imported_tints,
          adapted_tints: condition.adapted_tints,
          measurement_settings: condition.measurement_settings,
          ui_state: {
            active_data_mode: activeDataMode, // Use current component state
            last_saved_at: new Date().toISOString()
          },
          ink_curve: condition.ink_curve,
          substrate_condition: condition.substrate_condition,
          substrate_id: condition.substrate_id,
          creation_origin: 'from_ink', // Mark as created from ink condition
          is_hidden: true, // Hide from ink condition list
        }])
        .select('id')
        .single();
      if (conditionError) throw conditionError;

      // Create color with empty name so user must provide one
      const { data: colorRow, error } = await supabase
        .from('colors')
        .insert([{ name: '', hex, standard_type: 'master', organization_id: profile.organization_id, from_ink_condition_id: copiedCondition.id }])
        .select('id')
        .single();
      if (error) throw error;

      // Create a measurement on the new color with the solid spectral/lab so the chart shows immediately
      try {
        const mode = condition?.measurement_settings?.mode || 'M0';
        const spectral_data = solid?.spectralData || condition?.spectral_data || null;
        const lab = solid?.lab || condition?.lab || null;
        if (spectral_data) {
          await supabase.from('color_measurements').insert([{ color_id: colorRow.id, mode, spectral_data, lab, tint_percentage: 100 }]);
        }
      } catch (mErr) {
        console.warn('Could not attach measurement to new color:', mErr);
      }

      // Switch to matching mode and update nav memory to show Colors
      setAppMode('matching');
      setNavGroupSelections(prev => ({
        ...prev,
        matching: `/colors/${colorRow.id}?fromInkConditionId=${copiedCondition.id}`
      }));

      toast({ title: 'Saved as Color', description: 'A new color was created from this ink condition.' });
      refetchColors(); // Optimistically update colors list
      startTransition(() => navigate(`/colors/${colorRow.id}?fromInkConditionId=${copiedCondition.id}`));
    } catch (e) {
      console.error('Save as color failed:', e);
      toast({ title: 'Error', description: 'Could not create color from ink condition.', variant: 'destructive' });
    }
  };

  // Handler for printing color card
  const handlePrintColorCard = useCallback(() => {
    if (!condition) {
      toast({ 
        title: "No condition data", 
        description: "Ink condition data not available for printing",
        variant: "destructive" 
      });
      return;
    }

    // Get solid tint based on activeDataMode (same logic as handleSaveAsColor)
    let solid = null;
    let spectralData = null;
    
    // Use the correct tints based on current activeDataMode
    const tints = activeDataMode === 'adapted' && Array.isArray(condition?.adapted_tints)
      ? condition.adapted_tints
      : Array.isArray(condition?.imported_tints) ? condition.imported_tints : null;
    
    if (tints && tints.length) {
      // Find 100% solid tint or use the last tint (highest percentage)
      solid = tints.find(t => t.tintPercentage === 100) || tints[tints.length - 1];
      
      if (solid) {
        // Extract spectral data - check multiple possible locations
        spectralData = solid.spectralData || solid.spectral_data;
        
        // If not found directly, check in adapted/original data structures
        if (!spectralData && solid.usingAdaptedData && solid.adaptedData?.spectralData) {
          spectralData = solid.adaptedData.spectralData;
        } else if (!spectralData && !solid.usingAdaptedData && solid.originalImportData?.spectralData) {
          spectralData = solid.originalImportData.spectralData;
        }
      }
    }
    
    // Fallback to condition-level spectral data
    if (!spectralData) {
      spectralData = condition.spectral_data;
    }
    
    if (!spectralData || Object.keys(spectralData).length === 0) {
      toast({ 
        title: "No spectral data", 
        description: "This ink condition does not have spectral data available for printing. Import measurements with tints first.",
        variant: "destructive" 
      });
      return;
    }

    // Prepare color data for PrintColorCardPanel
    setPrintColorData({
      name: condition.name || 'Ink Condition',
      spectral_data: spectralData,
      illuminant: condition.measurement_settings?.illuminant || 'D50',
      observer: condition.measurement_settings?.observer || '2',
      lab: solid?.lab || condition.lab
    });
    setIsPrintPanelOpen(true);
  }, [condition, activeDataMode, toast]);

  // Handle saving ink properties
  const handleSaveInk = async (inkData) => {
    if (!profile?.organization_id || !inkId) {
      toast({ title: 'Error', description: 'Missing required information to save ink.', variant: 'destructive' });
      return;
    }

    try {
      const submissionData = {
        ...inkData,
        organization_id: profile.organization_id,
      };

      // Clean up fields similar to InkDetail.jsx
      const fieldsToNullify = ['type', 'material', 'print_process', 'ink_type', 'series'];
      fieldsToNullify.forEach(field => {
        if (submissionData[field] === '') {
          submissionData[field] = null;
        }
      });

      // Remove fields not in inks table or managed server-side
      delete submissionData.book_id; // legacy, no longer used
      delete submissionData.conditions;
      delete submissionData.associationId;
      delete submissionData.displayName;
      delete submissionData.created_at;
      delete submissionData.updated_at;

      const { data, error } = await supabase
        .from('inks')
        .update(submissionData)
        .eq('id', inkId)
        .select()
        .single();

      if (error) throw error;

      // Update context and local state
      optimisticUpdateInk(data);
      setInk(data);

      toast({
        title: 'Success!',
        description: 'Ink properties updated successfully.',
      });
    } catch (error) {
      console.error('Error saving ink:', error);
      toast({
        title: 'Error',
        description: `Failed to update ink properties. ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleCancel = async () => {
    if (isNew) {
      // Ensure data is refreshed before navigating back
      await forceRefreshConditions();
      navigate(`/assets/inks/${inkId}`);
    } else {
      setCondition(originalCondition);
      setIsEditMode(false);
      setHasUnsavedChanges(false);
      // Reset substrate mismatch state and restore original imported tints
      setSubstrateMismatchChoice(null);
      // Restore the imported tints that were saved with the original condition
      setImportedTints(originalCondition?.imported_tints || null);
      setAdaptedTints(null);
      setNewSubstrateData(null);
      setNewSubstrateConditionData(null);
      // Clear the original imported data cache since we're canceling
      setOriginalImportedTints(null);
    }
  };

  const handleSubstrateMismatchChoice = useCallback(async (choice) => {
    console.log('🎯 handleSubstrateMismatchChoice called with:', choice);
    setSubstrateMismatchChoice(choice);
    
    if (choice === 'adapt' && importedTints) {
      // Find the substrate condition to adapt to
      const substrateCondition = condition?.substrate_condition;
      if (substrateCondition) {
        // Adapt the imported tints to the existing substrate
        const adaptedTints = adaptTintsToSubstrate(
          importedTints,
          importedTints.find(t => t.tintPercentage === 0)?.spectralData,
          condition.substrate_spectral_data,
          {
            astmTables,
            measurementControls,
            fallbackSubstrateLab: condition?.substrate_lab || { L: 95, a: 0, b: 0 }
          }
        );
        setAdaptedTints(adaptedTints);
      }
    } else if (choice === 'create') {
      // Clear any adapted tints since we're creating new
      setAdaptedTints(null);
      
      // Pre-create a new substrate ID and set in form
      try {
        const { data: newSubstrate, error } = await supabase
          .from('substrates')
          .insert([{
            name: 'New Substrate',
            organization_id: profile.organization_id,
            last_modified_by: profile.id
          }])
          .select()
          .single();
          
        if (error) throw error;
        
        // Update form with the new substrate ID
        substrateForm.setValue('id', newSubstrate.id);
        substrateForm.setValue('name', '');
        
        // Update our state
        setSelectedSubstrate(newSubstrate);
        setAllSubstrates(prev => [...prev, newSubstrate]);
        setCreatingNewSubstrate(true);
        
        console.log('✅ Pre-created substrate with ID:', newSubstrate.id);
      } catch (error) {
        console.error('❌ Failed to pre-create substrate:', error);
        toast({
          title: "Error",
          description: "Failed to initialize new substrate. Please try again.",
          variant: "destructive"
        });
        return;
      }
      
      // Populate substrate condition with imported substrate color data
      if (importedTints) {
        const importedSubstrateTint = importedTints.find(tint => tint.isSubstrate || tint.tintPercentage === 0);
        if (importedSubstrateTint && importedSubstrateTint.spectralData) {
          const substrateColorValues = recalculateColorValues(importedSubstrateTint.spectralData, measurementControls);
          setNewSubstrateCondition(prev => ({
            ...prev,
            spectral_data: importedSubstrateTint.spectralData,
            lab: substrateColorValues.lab,
            ch: substrateColorValues.ch,
            color_hex: substrateColorValues.color_hex,
            measurement_settings: measurementControls
          }));
          
          // Store the imported substrate data for potential transfer to substrate condition page
          const { storeImportedSubstrateData } = require('@/utils/substrateDataTransfer');
          storeImportedSubstrateData({
            name: importedSubstrateTint.name || 'Imported Substrate',
            spectral_data: importedSubstrateTint.spectralData,
            lab: substrateColorValues.lab,
            color_hex: substrateColorValues.color_hex,
            ch: substrateColorValues.ch,
            measurement_settings: measurementControls
          });
        }
      }
      
      // Fetch current substrate and condition data to use as templates
      fetchSubstrateTemplateData();
      
      // Mark as having unsaved changes since we're creating new substrate data
      if (!isNew) setHasUnsavedChanges(true);
    } else if (choice === null) {
      // Clear adapted tints when clearing the choice
      setAdaptedTints(null);
    }
  }, [importedTints, condition?.substrate_condition, condition?.substrate_spectral_data, recalculateColorValues, measurementControls, isNew, profile, substrateForm, toast, astmTables]);

  // Copy imported substrate data when creating new substrate condition
  useEffect(() => {
    if (creatingNewSubstrateCondition && importedTints) {
      console.log('🔧 Creating new substrate condition - copying imported substrate data');
      
      // Find the imported substrate (0% tint)
      const importedSubstrateTint = importedTints.find(tint => tint.isSubstrate || tint.tintPercentage === 0);
      
      if (importedSubstrateTint && importedSubstrateTint.spectralData) {
        const substrateColorValues = recalculateColorValues(importedSubstrateTint.spectralData, measurementControls);
        
        // Copy imported substrate data into new substrate condition
        setNewSubstrateCondition(prev => ({
          ...prev,
          spectral_data: importedSubstrateTint.spectralData,
          lab: substrateColorValues.lab,
          ch: substrateColorValues.ch,
          color_hex: substrateColorValues.color_hex,
          measurement_settings: measurementControls,
          imported_tints: importedTints // Store imported tints for reference
        }));
        
        console.log('✅ Copied imported substrate data to new substrate condition');
      }
    }
  }, [creatingNewSubstrateCondition, importedTints, measurementControls, recalculateColorValues]);

  // Handle substrate condition changes and trigger re-checking
  const handleSubstrateConditionChange = useCallback(async (newSubstrateConditionId) => {
    console.log('🏷️ handleSubstrateConditionChange called with:', newSubstrateConditionId);
    
    // Reset mismatch state to ensure fresh detection
    setMismatchResolved(false);
    setSubstrateMismatchChoice(null);
    
    // Defensive: normalize and validate value
    if (!newSubstrateConditionId) {
      setCondition(prev => ({ ...prev, substrate_condition: null }));
      return;
    }
    const idStr = String(newSubstrateConditionId);
    
    // Handle composite IDs (substrate_id + "_" + condition_id)
    let actualConditionId = idStr;
    let substrateId = null;
    
    if (idStr.includes('_')) {
      // Split composite ID and take the condition part
      const parts = idStr.split('_');
      substrateId = parts[0]; // First part is substrate ID
      actualConditionId = parts[1]; // Take the second part (condition ID)
      console.log('🏷️ Parsed composite ID:', { substrateId, actualConditionId });
    }
    
    // Immediately update the substrate_condition to show selection in UI
    setCondition(prev => ({ 
      ...prev, 
      substrate_condition: actualConditionId 
    }));
    
    // Fetch the new substrate condition data
    if (actualConditionId) {
      try {
        // First, try to fetch substrate + condition data with join
        const { data: substrateConditionData, error } = await supabase
          .from('substrate_conditions')
          .select(`
            spectral_data, 
            lab, 
            ch, 
            color_hex,
            name,
            substrate_id,
            substrates!substrate_conditions_substrate_id_fkey(name)
          `)
          .eq('id', actualConditionId)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching substrate condition:', error);
          toast({ title: 'Error', description: 'Failed to fetch substrate condition data.', variant: 'destructive' });
          return;
        }
        
        // Generate combined substrate + condition name for auto-naming
        let substrateConditionName = '';
        
        if (substrateConditionData?.substrates) {
          // We have substrate name from the join; format condition with comma after print side
          const conditionFormatted = (substrateConditionData.name || '').replace(' - ', ', ');
          substrateConditionName = `${substrateConditionData.substrates.name} - ${conditionFormatted}`;
        } else if (substrateId) {
          // Fallback: get substrate name using the substrate ID from composite
          const { data: substrateData } = await supabase
            .from('substrates')
            .select('name')
            .eq('id', substrateId)
            .maybeSingle();
          
          if (substrateData && substrateConditionData) {
            const conditionFormatted = (substrateConditionData.name || '').replace(' - ', ', ');
            substrateConditionName = `${substrateData.name} - ${conditionFormatted}`;
          }
        } else {
          // Last fallback: just use condition name (formatted)
          substrateConditionName = (substrateConditionData?.name || '').replace(' - ', ', ');
        }
        
        
        
        // Update the condition with the new substrate condition data and auto-generated name using functional state
        setCondition(prev => {
          const base = prev || {};
          let computedName = base.name || '';
          if (substrateConditionName && shouldUseAutoNameForInkCondition(base, substrateConditionName)) {
            computedName = generateInkConditionName({
              substrateConditionName,
              inkCurve: base.ink_curve || 'as_measured',
              version: base.version
            });
            
          }
          return {
            ...base,
            name: computedName,
            // Store only the actual substrate condition UUID, not the composite value
            substrate_condition: actualConditionId,
            substrate_spectral_data: substrateConditionData?.spectral_data || null,
            substrate_lab: substrateConditionData?.lab || null,
            substrate_ch: substrateConditionData?.ch || null,
            substrate_color_hex: substrateConditionData?.color_hex || null
          };
        });
        
        if (!isNew) setHasUnsavedChanges(true);
        
        // Re-check substrate mismatch with original imported data
        if (originalImportedTints && originalImportedTints.length > 0) {
          const currentChoice = substrateMismatchChoice;
          if (currentChoice) {
            setSubstrateMismatchChoice(null);
          }
          
          // Reset mismatch resolution state for fresh detection
          setMismatchResolved(false);
          console.log('🔄 Reset mismatch state for substrate change - fresh detection will run');
          
          // Clear any adapted tints since we're changing substrates
          setAdaptedTints(null);
          
          // Recalculate adapted tints with physics-based method if in adapted mode
          if (activeDataMode === 'adapted' && condition?.imported_tints && substrateConditionData?.spectral_data && astmTables?.length) {
            console.log('🔄 Recalculating adapted tints for substrate change using physics-based method');
            setIsComputingAdaptedTints(true);
            
            const computeAdaptedTints = async () => {
              try {
                // Extract imported substrate spectral from 0% tint
                const normalizedImportedTints = normalizeTints(condition.imported_tints);
                const substrateFromImported = normalizedImportedTints.find(t => t.isSubstrate || (t.tintPercentage === 0));
                const importedSubstrateSpectral = substrateFromImported?.spectralData || {};
                
                const adaptedResult = adaptTintsToSubstrate(
                  condition.imported_tints,
                  importedSubstrateSpectral,
                  substrateConditionData.spectral_data,
                  {
                    astmTables,
                    measurementControls: condition.measurement_settings || {
                      illuminant: 'D50',
                      observer: '2',
                      table: '5'
                    },
                    fallbackSubstrateLab: substrateConditionData.lab || { L: 95, a: 0, b: 0 }
                  }
                );

                if (adaptedResult) {
                  console.log('✅ Successfully recalculated adapted tints for substrate change');
                  
                  // Update local state
                  setCondition(prev => ({
                    ...prev,
                    adapted_tints: adaptedResult
                  }));
                  
                  // Mark as having unsaved changes
                  setHasUnsavedChanges(true);
                }
              } catch (error) {
                console.error('Failed to recalculate adapted tints for substrate change:', error);
                toast({
                  title: 'Adaptation Failed',
                  description: 'Could not adapt tints to new substrate. Please try again.',
                  variant: 'destructive'
                });
              } finally {
                setIsComputingAdaptedTints(false);
              }
            };

            computeAdaptedTints();
          }
          
          // Temporarily restore original imported tints for mismatch detection
          setImportedTints(originalImportedTints);
          
          // The InkConditionVisuals component will detect the mismatch and show the dialog
        }
      } catch (error) {
        console.error('Error in handleSubstrateConditionChange:', error);
        toast({ title: 'Error', description: 'Failed to update substrate condition.', variant: 'destructive' });
      }
    }
  }, [originalImportedTints, toast, isNew, substrateMismatchChoice]);

  // Memoized importedTints prop calculation
  // Removed auto-computation of adapted tints on open - only recalculate on user-driven events

  const importedTintsForComponent = useMemo(() => {
    
    // Show loading state while computing
    if (isComputingAdaptedTints) {
      return null;
    }
    
    // When activeDataMode is 'adapted', prefer adapted tints
    if (activeDataMode === 'adapted' && condition?.adapted_tints?.length) {
      return condition.adapted_tints;
    }
    
    // When mismatch is resolved, prioritize condition.imported_tints (final adapted data)
    if (mismatchResolved && condition?.imported_tints?.length) {
      console.log('🎯 Using final adapted data from condition.imported_tints');
      return condition.imported_tints;
    }
    
    // During mismatch flow (!mismatchResolved), use original importedTints to keep wedge display consistent
    if (substrateMismatchChoice != null && !mismatchResolved) {
      return importedTints;
    }
    
    // After mismatch is resolved, use adapted tints if available (legacy flow)
    if (substrateMismatchChoice === 'adapt' && adaptedTints) {
      return adaptedTints;
    }
    
    // CRITICAL FIX: Always normalize fallback data
    const fallbackTints = importedTints || condition?.imported_tints;
    return fallbackTints ? normalizeTints(fallbackTints) : null;
  }, [activeDataMode, condition?.adapted_tints, condition?.imported_tints, substrateMismatchChoice, adaptedTints, importedTints, mismatchResolved, isComputingAdaptedTints]);

  // Memoized callback functions to prevent re-renders
  const handleConditionChange = useCallback((field, value) => {
    
    
    // Handle creation mode flags
    if (field === '_creatingNewSubstrate') {
      setCreatingNewSubstrate(value);
      return;
    }
    if (field === '_creatingNewSubstrateCondition') {
      setCreatingNewSubstrateCondition(value);
      return;
    }
    
    // onConditionChange called
    if (field === 'substrate_mismatch_choice') {
      handleSubstrateMismatchChoice(value);
    } else if (field === 'imported_tints') {
      // When child saves adapted tints, update state and let useEffect resolve activeDataMode
      
      setCondition(prev => ({ 
        ...prev, 
        imported_tints: value,
        ui_state: { 
          ...prev?.ui_state, 
          active_data_mode: 'adapted' 
        }
      }));
      setImportedTints(value);
      setSubstrateMismatchChoice('adapt');
      setMismatchResolved(true);
      if (!isNew) setHasUnsavedChanges(true);
    } else if (field === 'substrate_condition') {
      // Handle substrate_condition changes with re-checking
      console.log('🏷️ Substrate condition changing to:', value);
      handleSubstrateConditionChange(value);
    } else {
      setCondition(prev => ({ ...prev, [field]: value }));
      if (!isNew) setHasUnsavedChanges(true);
    }
  }, [isNew, handleSubstrateMismatchChoice, handleSubstrateConditionChange]);

  const handleTintSelectCallback = useCallback((tintData, index) => {
    handleTintSelect(tintData, index);
  }, [handleTintSelect]);

  const handleClearTintsCallback = useCallback(() => {
    clearImportedTints();
  }, [clearImportedTints]);



  const handleFileChangeCallback = useCallback((event, type) => {
    handleFileChange(event, type);
  }, [handleFileChange]);

  const handleSubstrateMismatchChoiceCallback = useCallback((choice) => {
    handleSubstrateMismatchChoice(choice);
  }, [handleSubstrateMismatchChoice]);

  // Fetch substrate and condition data to use as templates for new entries
  const fetchSubstrateTemplateData = async () => {
    try {
      const substrateConditionId = condition?.substrate_condition;
      if (!substrateConditionId) return;

      // Parse composite ID if needed
      let actualSubstrateId, actualConditionId;
      if (substrateConditionId.includes('_')) {
        [actualSubstrateId, actualConditionId] = substrateConditionId.split('_');
      } else {
        actualConditionId = substrateConditionId;
      }

      // Fetch substrate data if we have substrate ID
      if (actualSubstrateId) {
        const { data: substrateData } = await supabase
          .from('substrates')
          .select('*')
          .eq('id', actualSubstrateId)
          .maybeSingle();

        if (substrateData) {
          setNewSubstrateData({
            ...substrateData,
            name: '', // Clear name for user to fill
            id: null // Will be generated on save
          });
          setSubstrateNameFilled(false);
        }
      }

      // Fetch substrate condition data
      if (actualConditionId) {
        const { data: conditionData } = await supabase
          .from('substrate_conditions')
          .select('*')
          .eq('id', actualConditionId)
          .maybeSingle();

        if (conditionData) {
          setNewSubstrateConditionData({
            ...conditionData,
            name: '', // Clear name for user to fill
            id: null, // Will be generated on save
            substrate_id: null // Will be set to new substrate ID
          });
          setSubstrateConditionNameFilled(false);
        }
      }
    } catch (error) {
      // Error fetching template data
      toast({
        title: 'Error',
        description: 'Failed to fetch template data for new substrate',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Define mode configuration for root breadcrumb
  const modeConfig = {
    assets: { label: 'Color Assets', href: '/assets/dashboard' },
    matching: { label: 'Matching Jobs', href: '/color-matches' },
    admin: { label: 'Admin', href: '/admin/my-company' },
  };
  const rootConfig = modeConfig[appMode] || modeConfig.assets;

  const breadcrumbItems = [
    { label: 'Inks', href: '/assets/inks' },
    { label: currentInk?.name || ink?.name || 'Ink', href: `/assets/inks/${inkId}` },
    { label: isNew ? 'New Ink Condition' : (condition?.name || 'Ink Condition') },
  ];
  
  const pageTitle = isNew ? 'New Ink Condition' : (condition?.name || 'Ink Condition');
  const showEditControls = canEdit;
  
  const showEditButton = !isNew && !isEditMode;

  return (
    <>
      <Helmet>
        <title>{pageTitle} - Color KONTROL</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="flex-1 flex flex-col h-full"
      >
        <div className="flex flex-col h-full p-4 sm:p-6 lg:p-8">
          <div>
            {isNew ? (
              <InkConditionDetailHeader
                isNew={isNew}
                conditionName={condition?.name}
                inkName={currentInk?.name || ink?.name}
                handleSaveNew={handleSaveNew}
                saving={saving}
                onCancel={handleCancel}
                requiredFieldsFilled={!!(condition?.name && condition?.name.trim())}
              />
            ) : (
              <div className="flex items-center justify-between mb-6">
                <div>
                  <Breadcrumb items={breadcrumbItems} />
                  <div className="mt-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      {condition?.name || 'Ink Condition'}
                    </h1>
                    <p className="text-sm text-gray-600">
                      For ink: <span className="font-medium text-gray-800">{currentInk?.name || ink?.name || 'Loading...'}</span>
                    </p>
                  </div>
                </div>
                {canEdit && !isEditMode && (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleSaveAsColor}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Save as Color
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handlePrintColorCard}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print Color Card
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            <Tabs defaultValue="info" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between mb-2 relative mt-6">
                <TabsList className="flex w-auto h-auto p-1 gap-1">
                  <TabsTrigger value="info" className="px-3 py-1.5 text-sm">Ink Info</TabsTrigger>
                  <TabsTrigger value="matches" className="px-3 py-1.5 text-sm">Matches</TabsTrigger>
                  <TabsTrigger value="history" className="px-3 py-1.5 text-sm">History</TabsTrigger>
                  {(creatingNewSubstrate || substrateMismatchChoice === 'create') && !mismatchResolved && (
                    <TabsTrigger value="substrate" className="px-4 py-1.5 text-sm min-w-[120px]">Substrate</TabsTrigger>
                  )}
                  {(creatingNewSubstrate || creatingNewSubstrateCondition || substrateMismatchChoice === 'create') && !mismatchResolved && (
                    <TabsTrigger value="substrate-condition" className="px-4 py-1.5 text-sm min-w-[140px]">Substrate Condition</TabsTrigger>
                  )}
                </TabsList>
                <div className="flex items-center gap-4">
                  {canEdit && isEditMode && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Upload className="mr-2 h-4 w-4" />
                          Import Measurement
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => {
                          // CxF dropdown clicked
                          handleCxfImportClick();
                        }}>
                          <Plus className="mr-2 h-4 w-4" />
                          CxF File
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          cgatsInputRef.current?.click();
                        }}>
                          <Plus className="mr-2 h-4 w-4" />
                          CGATS File
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <ColorSettingsBox
                    controls={measurementControls}
                    setControls={handleMeasurementControlsChange}
                    availableModes={availableModes}
                    standards={standards}
                    organizationDefaults={organization}
                  />
                </div>
              </div>
              
                <ScrollArea className="flex-1 mt-2">
                  <div className="space-y-6">
                     <TabsContent value="info" className="space-y-6 mt-0">
                            {/* Guard: Only render after activeDataMode is resolved to prevent premature "imported" default */}
                            {activeDataMode !== null && (
                            <InkConditionInfoTab
                               condition={condition}
                                onConditionChange={handleConditionChange}
                                canEdit={canEdit}
                                showEditControls={showEditControls}
                                isNew={isNew}
                               onNameChange={handleNameChange}
                               onPackTypeChange={handlePackTypeChange}
                               onMeasurementControlsChange={handleMeasurementControlsChange}
                               measurementControls={measurementControls}
                               standards={standards}
                                importedTints={importedTintsForComponent}
                                onTintSelect={handleTintSelectCallback}
                                onClearTints={handleClearTintsCallback}
                                onFileChange={handleFileChangeCallback}
                                substrateMismatchChoice={substrateMismatchChoice}
                                onSubstrateMismatchChoice={handleSubstrateMismatchChoiceCallback}
                                 substrateNameFilled={substrateNameFilled}
                                 substrateConditionNameFilled={substrateConditionNameFilled}
                                 mismatchResolved={mismatchResolved}
                                 onResolveMismatch={setMismatchResolved}
                                 selectedWedge={selectedWedge}
                                 onWedgeSelect={handleWedgeSelect}
                                 onWedgeDataChange={handleWedgeDataChange}
                                 onAvailableModesChange={handleAvailableModesChange}
                                 activeDataMode={activeDataMode}
                                 onActiveDataModeChange={handleActiveDataModeChange}
                                 isEditMode={isEditMode}
                                 onEdit={handleEdit}
                                 onSave={isNew ? handleSaveNew : handleSaveUpdate}
                                 onCancel={handleCancel}
                                 saving={saving}
                                  isComputingAdaptedTints={isComputingAdaptedTints}
                              />
                              )}
                              
                               {/* Substrate Condition Creator - Only show manual creator, no auto-generation */}
                              {!isNew && condition && ink && !condition.substrate_condition && (
                                <SubstrateConditionCreator
                                  inkConditionId={conditionId}
                                  parentSubstrate={substrates?.find(s => s.name === 'C1S Paper')} // Find C1S Paper substrate
                                  organizationId={profile?.organization_id}
                                   onSubstrateConditionCreated={async (substrateConditionId) => {
                                     try {
                                       const selectedSubstrate = substrates?.find(s => s.name === 'C1S Paper');
                                       // Auto-generate substrate condition name based on substrate details
                                       const autoName = generateSubstrateConditionName({
                                         substrateName: selectedSubstrate?.name,
                                         printSide: selectedSubstrate?.printing_side,
                                         useWhiteInk: selectedSubstrate?.use_white_ink || false,
                                         laminateEnabled: false,
                                         varnishEnabled: false,
                                       });
                                       if (autoName) {
                                         await supabase
                                           .from('substrate_conditions')
                                           .update({ name: autoName })
                                           .eq('id', substrateConditionId);
                                         // Auto-update ink condition name too
                                         await supabase.rpc('update_ink_condition_name_auto', { p_condition_id: conditionId });
                                       }
                                       // Refresh the condition data to show the new substrate condition link and substrate
                                       setCondition(prev => ({
                                         ...prev,
                                         substrate_condition: substrateConditionId,
                                         substrate_id: selectedSubstrate?.id
                                       }));
                                       // Trigger a refetch to ensure UI is updated
                                       fetchCondition(conditionId);
                                     } catch (e) {
                                       console.warn('Substrate condition post-create updates failed', e);
                                     }
                                   }}
                                  shouldAutoCreate={false}
                                />
                              )}
                      </TabsContent>
                      
      {(creatingNewSubstrate || substrateMismatchChoice === 'create') && !mismatchResolved && (
        <TabsContent value="substrate" className="space-y-6 mt-0">
          <SubstrateInfoFormWrapper
            register={substrateForm.register}
            control={substrateForm.control}
            errors={substrateForm.formState.errors}
            watch={substrateForm.watch}
            setValue={substrateForm.setValue}
            onDataChange={(data) => {
              setSubstrateNameFilled(!!data.name);
            }}
            onSubstrateSaved={async (savedSubstrate) => {
              console.log('🔧 onSubstrateSaved callback called with:', savedSubstrate);
              // Update substrate context with new substrate using optimistic update
              optimisticAddSubstrate(savedSubstrate);
              
              // Update selected substrate state
              setSelectedSubstrate(savedSubstrate);
              setSubstrateNameFilled(!!savedSubstrate.name);
              
              // Update parent substrate reference for condition creation
              setParentSubstrateForConstruction(savedSubstrate);
              
              // Switch back to info tab after saving
              setActiveTab("info");
              
              // Update condition with new substrate ID  
              setCondition(prev => ({
                ...prev,
                substrate_id: savedSubstrate.id,
                // Clear creation flags so dropdowns update properly
                _creatingNewSubstrate: false
              }));
              
              // For existing conditions, also update the database immediately
              if (!isNew && conditionId) {
                // Use setTimeout to avoid blocking the main thread
                setTimeout(async () => {
                  try {
                    const { error } = await supabase
                      .from('ink_conditions')
                      .update({ substrate_id: savedSubstrate.id, updated_at: new Date().toISOString() })
                      .eq('id', conditionId);
                    
                    if (error) {
                      console.error('Error updating ink condition substrate:', error);
                      toast({
                        title: "Warning",
                        description: "Substrate saved but failed to update ink condition. Please save the ink condition manually.",
                        variant: "destructive"
                      });
                    }
                  } catch (error) {
                    console.error('Error updating ink condition substrate:', error);
                    toast({
                      title: "Warning", 
                      description: "Substrate saved but failed to update ink condition. Please save the ink condition manually.",
                      variant: "destructive"
                    });
                  }
                }, 0);
              }
              
              // Set state to indicate substrate has been saved
              setCreatingNewSubstrate(false);
              setSubstrateMismatchChoice(null);
              setMismatchResolved(true);
              
              // Clear unsaved changes flag for substrate
              setHasUnsavedChanges(false);
              
              toast({
                title: "Substrate Saved",
                description: "New substrate has been created and selected.",
              });
            }}
            hideThumbnail={true}
          />
        </TabsContent>
      )}
        
      {(creatingNewSubstrate || creatingNewSubstrateCondition || substrateMismatchChoice === 'create') && !mismatchResolved && (
        <TabsContent value="substrate-condition" className="space-y-6 mt-0">
            <SubstrateConditionFormTab
              condition={newSubstrateCondition}
              onConditionChange={(updates) => {
                setNewSubstrateCondition(prev => ({ ...prev, ...updates }));
                setHasUnsavedChanges(true);
              }}
              canEdit={true}
              isNew={true}
              onNameChange={(e) => {
                const name = e.target.value;
                setNewSubstrateCondition(prev => ({ ...prev, name }));
                setSubstrateConditionNameFilled(!!name);
                setHasUnsavedChanges(true);
              }}
              onPackTypeChange={(packType) => {
                setNewSubstrateCondition(prev => ({ ...prev, pack_type: packType }));
                setHasUnsavedChanges(true);
              }}
              onMeasurementControlsChange={(controls) => {
                setNewSubstrateCondition(prev => ({ ...prev, measurement_settings: controls }));
                setHasUnsavedChanges(true);
              }}
              measurementControls={newSubstrateCondition.measurement_settings || measurementControls}
              standards={standards}
              allSubstrates={allSubstrates}
              parentSubstrate={parentSubstrateForConstruction || {
                name: substrateForm.watch('name'),
                printing_side: substrateForm.watch('printing_side'),
                use_white_ink: substrateForm.watch('use_white_ink')
              }}
              constructionDetails={newSubstrateCondition.construction_details}
              setConstructionDetails={(details) => {
                setNewSubstrateCondition(prev => ({ ...prev, construction_details: details }));
                setHasUnsavedChanges(true);
              }}
              setHasUnsavedChanges={setHasUnsavedChanges}
              onDataChange={(data) => {
                setSubstrateConditionNameFilled(!!data.name);
              }}
               onSubstrateConditionSaved={async (conditionData) => {
                 try {
                   // Get the current substrate ID from form or newly created substrate
                   const substrateId = substrateForm.watch('substrate_id') || parentSubstrateForConstruction?.id;
                   
                   if (!substrateId) {
                     throw new Error('No substrate selected for condition creation');
                   }
                   
                   // Create substrate condition directly with its own data (from newSubstrateCondition)
                   const substrateConditionPayload = {
                     name: newSubstrateCondition.name || 'New Substrate Condition',
                     substrate_id: substrateId,
                     organization_id: profile.organization_id,
                     spectral_data: newSubstrateCondition.spectral_data,
                     lab: newSubstrateCondition.lab,
                     color_hex: newSubstrateCondition.color_hex,
                     pack_type: newSubstrateCondition.pack_type,
                     measurement_settings: newSubstrateCondition.measurement_settings,
                     construction_details: newSubstrateCondition.construction_details,
                     version: newSubstrateCondition.version
                   };
                   
                   // Insert substrate condition directly to keep substrate data separate
                   const { data: savedCondition, error: conditionError } = await supabase
                     .from('substrate_conditions')
                     .insert(substrateConditionPayload)
                     .select()
                     .single();
                   
                   if (conditionError) {
                     throw conditionError;
                   }
                   
                   // Auto-generate substrate condition name
                   const autoName = generateSubstrateConditionName({
                     substrateName: parentSubstrateForConstruction?.name || substrates?.find(s => s.id === substrateId)?.name,
                     printSide: parentSubstrateForConstruction?.printing_side,
                     useWhiteInk: parentSubstrateForConstruction?.use_white_ink || false,
                     laminateEnabled: !!newSubstrateCondition.construction_details?.printedSubstrate?.enabled,
                     laminateSurfaceQuality: newSubstrateCondition.construction_details?.printedSubstrate?.surfaceQuality,
                     varnishEnabled: !!newSubstrateCondition.construction_details?.varnish?.enabled,
                     varnishSurfaceQuality: newSubstrateCondition.construction_details?.varnish?.surfaceQuality,
                     version: newSubstrateCondition.version
                   });
                   
                   // Update substrate condition with auto-generated name
                   if (autoName && savedCondition?.id) {
                     await supabase
                       .from('substrate_conditions')
                       .update({ name: autoName })
                       .eq('id', savedCondition.id);
                     
                     savedCondition.name = autoName; // Update local object
                   }
                   
                   // Update ink condition with ONLY substrate_condition reference (preserve imported_tints)
                   const inkConditionUpdate = {
                     substrate_condition: savedCondition.id,
                     substrate_id: substrateId
                   };
                   
                   // Update ink condition in database (preserving imported_tints)
                   const { error: inkUpdateError } = await supabase
                     .from('ink_conditions')
                     .update(inkConditionUpdate)
                     .eq('id', conditionId);
                   
                   if (inkUpdateError) {
                     throw inkUpdateError;
                   }
                   
                   // Auto-update ink condition name based on new substrate condition
                   await supabase.rpc('update_ink_condition_name_auto', { 
                     p_condition_id: conditionId 
                   });
                   
                   // Update local state
                   setCondition(prev => ({
                     ...prev,
                     substrate_condition: savedCondition.id,
                     substrate_id: substrateId,
                     // Explicitly preserve imported_tints - DO NOT overwrite
                     _creatingNewSubstrate: false,
                     _creatingNewSubstrateCondition: false
                   }));
                   
                   // Update substrate context
                   optimisticAddSubstrateCondition(substrateId, savedCondition);
                   setSubstrateConditionNameFilled(savedCondition.name || autoName);
                   
                   // Switch back to info tab
                   setActiveTab("info");
                    
                   // Update state
                   setCreatingNewSubstrateCondition(false);
                   setSubstrateMismatchChoice(null);
                   setMismatchResolved(true);
                   
                   // Update creation mode state to ensure dropdowns reflect new selections
                   setCreatingNewSubstrate(false);
                   
                   // Clear unsaved changes flag
                   setHasUnsavedChanges(false);
                   
                   toast({
                     title: "Substrate Condition Saved",
                     description: "New substrate condition has been created and selected.",
                   });
                   
                   return savedCondition;
                 } catch (error) {
                   console.error('Error creating substrate condition:', error);
                   toast({
                     title: "Error",
                     description: `Failed to create substrate condition: ${error.message}`,
                     variant: "destructive",
                   });
                   throw error;
                 }
               }}
             />
        </TabsContent>
      )}
                     <LoadingErrorBoundary>
                       <TabsContent value="matches" className="space-y-6 mt-0" key="matches-tab">
                          {condition && conditionId && conditionId !== 'new' ? (
                            <InkConditionMatchesTab
                              condition={condition}
                              controls={measurementControls}
                              setControls={handleMeasurementControlsChange}
                              standards={standards}
                              referencePatch={referencePatch}
                              onRequestAutoSelection={performAutoSelection}
                              activeDataMode={activeDataMode}
                            />
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              Matches will be available once this condition is loaded.
                            </div>
                          )}
                       </TabsContent>
                     </LoadingErrorBoundary>
                    <TabsContent value="history" className="space-y-6 mt-0">
                      <HistoryTab assetType="Ink Condition" assetId={conditionId} />
                    </TabsContent>
                  </div>
                </ScrollArea>
            </Tabs>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={cgatsInputRef}
          type="file"
          accept=".txt,.cgats"
          onChange={(e) => handleFileChange(e, 'cgats')}
          className="hidden"
        />

        {/* CxF Parser Client - only render when needed */}
        {showCxfParser && (
          <div ref={cxfParserRef}>
            <CxfParserClient
              onDataUpdate={updateConditionWithParsedData}
              onDialogOpen={setCxfDialogOpen}
              onColorsUpdate={setCxfColors}
            />
          </div>
        )}

        {/* CxF Import Dialog */}
        {cxfColors && cxfColors.length > 0 && (
          <CxfImportDialogWrapper
            isOpen={cxfDialogOpen}
            onClose={() => {
              setCxfDialogOpen(false);
              setCxfColors([]);
              setShowCxfParser(false);
            }}
            colors={cxfColors}
            context="ink-condition"
            onImport={handleImportFromCxfSelection}
            title="Select CxF Object for Ink Condition"
            directInkImport
          />
        )}

        {/* CGATS Import Dialog */}
        {cgatsColors && cgatsColors.length > 0 && (
          <CxfImportDialogWrapper
            isOpen={cgatsDialogOpen}
            onClose={() => {
              setCgatsDialogOpen(false);
              setCgatsColors([]);
            }}
            colors={normalizeCgatsForDialog(cgatsColors)}
            context="ink-condition"
            onImport={handleImportFromCgatsSelection}
            title="Select CGATS Object for Ink Condition"
            directInkImport
          />
        )}

        {/* Print Color Card Panel */}
        <PrintColorCardPanel
          isOpen={isPrintPanelOpen}
          onClose={() => {
            setIsPrintPanelOpen(false);
            setPrintColorData(null);
          }}
          colorData={printColorData}
        />
      </motion.div>
    </>
  );
};

export default InkConditionDetail;