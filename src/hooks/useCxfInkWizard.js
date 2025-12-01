import { useState, useCallback, useMemo, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useProfile } from '@/context/ProfileContext';
import { useInksData } from '@/context/InkContext';
// import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { generateSubstrateConditionName } from '@/lib/substrateConditionNaming';
import { generateInkConditionName } from '@/lib/inkConditionNaming';
import { computeDefaultDisplayColor, isValidDisplayColor } from '@/lib/colorUtils';
import { calculateInkConditionColorHex } from '@/lib/colorUtils/inkConditionColorHex';
import { normalizeTints, getTintPercentage, safeSpectralData } from '@/lib/tintsUtils';
import { adaptTintsToSubstrate } from '@/lib/colorUtils/tintAdaptation';
import { computeTwoStepSubstrateAdaptation } from '@/lib/inkSubstrateAdaptation';
import { getEffectiveDataMode } from '@/lib/substrateAdaptationUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { fixSubstrateCondition } from '@/lib/substrateConditionFixer';
import { isSingleColorImport, createSubstrateIntegratedColorData } from '@/hooks/useCxfInkImport';

/**
 * Extract and normalize tints from CxF color data based on active data mode
 * CRITICAL: Flattens tintsByBackground to preserve multi-background data
 * @param {Array} cxfColors - Array of CxF color objects
 * @param {string} activeDataMode - Active data mode ('imported' or 'adapted')
 * @returns {Array} - Normalized array of tint objects with backgroundName stamped
 */
const extractNormalizedTints = (cxfColors, activeDataMode = 'imported') => {
  if (!Array.isArray(cxfColors)) return [];

  const normalizeMode = (val) => {
    if (!val) return null;
    const s = String(val).toUpperCase();
    const m = s.match(/M[0-3]/);
    return m ? m[0] : null;
  };

  const normalizeMeasurements = (arr, tintPct, parentColor) => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map(meas => {
        const mode = normalizeMode(
          meas?.assignedMode || 
          meas?.mode || 
          meas?.measurement_mode || 
          meas?.measurementMode ||
          parentColor?.assignedMode ||
          parentColor?.measurementMode
        );
        const spectral = meas?.spectral_data || meas?.spectralData;
        if (!mode || !spectral || Object.keys(spectral || {}).length === 0) return null;
        
        const normalized = {
          mode,
          spectral_data: spectral,
          lab: meas?.lab || null,
          tint_percentage: Number(tintPct ?? 0),
          start_wl: meas?.start_wl || meas?.startWl || meas?.start || meas?.start_wavelength || null,
          increment: meas?.increment || meas?.wavelengthStep || meas?.step || null
        };
        
        // Preserve background information from measurement
        if (meas?.backgroundName) normalized.backgroundName = meas.backgroundName;
        if (meas?.background_name) normalized.background_name = meas.background_name;
        if (meas?.background) normalized.background = meas.background;
        if (meas?.background_key) normalized.background_key = meas.background_key;
        if (meas?.bg_key) normalized.bg_key = meas.bg_key;
        if (meas?.key) normalized.key = meas.key;
        
        return normalized;
      })
      .filter(Boolean);
  };
  
  const normalizedTints = [];
  
  for (const cxfColor of cxfColors) {
    if (!cxfColor || typeof cxfColor !== 'object') continue;

    console.log('🔧 EXTRACTING TINTS from color (mode-specific):', {
      colorName: cxfColor.name,
      activeDataMode,
      hasTintsByBackground: !!cxfColor.tintsByBackground,
      hasImportedTints: !!(cxfColor.imported_tints || cxfColor.substrateTints),
      hasAdaptedTints: !!cxfColor.adapted_tints,
      isSingleColorImport: cxfColor._isSingleColorImport
    });

    const pushTint = (tint, opts = {}) => {
      const tintPct = tint?.tintPercentage ?? tint?.tint ?? 0;
      const base = {
        name: tint?.name || `${cxfColor.name || 'Tint'} ${tintPct || 0}%`,
        tintPercentage: tintPct || 0,
        spectralData: tint?.spectralData || tint?.spectral_data || {},
        spectral_data: tint?.spectral_data || tint?.spectralData || {},
        lab: tint?.lab || null,
        colorHex: tint?.colorHex || null,
        tint: tintPct || 0,
        backgroundName: tint?.backgroundName,
        background: tint?.background,
        measurementType: tint?.measurementType
      };
      const measurements = normalizeMeasurements(tint?.measurements, tintPct, cxfColor);
      const finalTint = measurements.length ? { ...base, measurements } : base;
      
      normalizedTints.push(finalTint);
    };

    // Helper function to normalize imported_tints structure
    const normalizeImportedTints = (importedTints) => {
      if (Array.isArray(importedTints)) return importedTints;
      if (importedTints?.tints && Array.isArray(importedTints.tints)) return importedTints.tints;
      return [];
    };

    // Extract tints based on active data mode
    if (activeDataMode === 'adapted') {
      // For adapted mode, extract from adapted_tints with fallback to substrate tints
      const adaptedTints = normalizeImportedTints(cxfColor.adapted_tints);
      if (adaptedTints.length > 0) {
        console.log('🔧 Processing adapted_tints array:', adaptedTints.length, 'tints');
        for (const tint of adaptedTints) {
          if (tint && typeof tint === 'object') {
            pushTint({
              ...tint,
              backgroundName: tint.backgroundName || tint.background_name || tint.background || 'Adapted'
            });
          }
        }
      } else if (Array.isArray(cxfColor.substrateTints)) {
        // Fallback to substrate tints for adapted mode
        console.log('🔧 Fallback: Processing substrateTints for adapted mode:', cxfColor.substrateTints.length, 'tints');
        for (const tint of cxfColor.substrateTints) {
          if (tint && typeof tint === 'object') {
            pushTint({
              ...tint,
              backgroundName: tint.backgroundName || tint.background || 'Substrate'
            });
          }
        }
      }
    } else {
      // For imported mode: PRIORITY 1 - Check for tintsByBackground (multi-background CxF)
      if (cxfColor.tintsByBackground && typeof cxfColor.tintsByBackground === 'object') {
        console.log('🔧 Flattening tintsByBackground for imported mode:', Object.keys(cxfColor.tintsByBackground));
        for (const [bgName, tints] of Object.entries(cxfColor.tintsByBackground)) {
          if (Array.isArray(tints)) {
            for (const tint of tints) {
              if (tint && typeof tint === 'object') {
                normalizedTints.push({
                  ...tint,
                  backgroundName: tint.backgroundName || bgName,
                  background: tint.background || bgName
                });
              }
            }
          }
        }
      } else {
        // PRIORITY 2: Legacy support - individual arrays (substrateTints, overBlackTints)
        const substrateTintsArray = Array.isArray(cxfColor.substrateTints) ? cxfColor.substrateTints : [];
        const overBlackTintsArray = Array.isArray(cxfColor.overBlackTints) ? cxfColor.overBlackTints : [];

        if (substrateTintsArray.length > 0) {
          console.log('🔧 Adding raw substrateTints for imported mode:', substrateTintsArray.length, 'tints');
          for (const tint of substrateTintsArray) {
            if (tint && typeof tint === 'object') {
              normalizedTints.push({
                ...tint,
                backgroundName: tint.backgroundName || tint.background || 'Substrate',
                background: tint.background || 'Substrate'
              });
            }
          }
        }

        if (overBlackTintsArray.length > 0) {
          console.log('🔧 Adding raw overBlackTints for imported mode:', overBlackTintsArray.length, 'tints');
          for (const tint of overBlackTintsArray) {
            if (tint && typeof tint === 'object') {
              const normalizedBgName = tint.backgroundName || tint.background_name || tint.background || 'Process_Black';
              normalizedTints.push({
                ...tint,
                backgroundName: normalizedBgName,
                background: normalizedBgName
              });
            }
          }
        }
      }
    }
  }
  
  console.log('🔧 EXTRACT RESULT:', {
    totalTintsExtracted: normalizedTints.length,
    tintPercentages: normalizedTints.map(t => t.tintPercentage),
    backgrounds: [...new Set(normalizedTints.map(t => t.backgroundName).filter(Boolean))],
    activeDataMode
  });
  
  // Only apply deduplication for adapted mode
  // For imported mode, return raw arrays to preserve exact CXF patch-to-background associations
  if (activeDataMode === 'adapted') {
    const deduplicatedTints = normalizeTints(normalizedTints);
    console.log('🔧 Applied deduplication for adapted mode:', {
      beforeCount: normalizedTints.length,
      afterCount: deduplicatedTints.length
    });
    return deduplicatedTints;
  }
  
  return normalizedTints;
};

/**
 * Enhance imported tints with mode-specific hints for better display
 * @param {Array} tints - Normalized tints array  
 * @param {string} activeDataMode - Current data mode ('adapted' or 'imported')
 * @param {Object} solidSpectralData - Solid spectral data if available
 * @returns {Array} Enhanced tints array
 */
const enhanceImportedTintsForMode = (tints, activeDataMode, solidSpectralData) => {
  return tints.map(tint => {
    const enhancedTint = { ...tint };
    
    // Ensure spectral_data is in snake_case format for calculateInkConditionColorHex
    if (tint.spectralData && typeof tint.spectralData === 'object') {
      enhancedTint.spectral_data = tint.spectralData;
    }
    
    if (activeDataMode === 'adapted' && solidSpectralData) {
      // Mark the 100% tint with adapted data hint
      if (getTintPercentage(tint) === 100) {
        enhancedTint._adaptedDataAvailable = true;
        enhancedTint._adaptedSolidSpectral = solidSpectralData;
      }
    }
    
    console.debug('🎨 Enhanced tint:', {
      percentage: getTintPercentage(enhancedTint),
      hasSpectralData: !!enhancedTint.spectral_data,
      spectralDataKeys: enhancedTint.spectral_data ? Object.keys(enhancedTint.spectral_data).length : 0,
      mode: activeDataMode
    });
    
    return enhancedTint;
  });
};

export const useCxfInkWizard = ({ cxfColors, isOpen, onSuccess, onClose }) => {
  const { profile } = useProfile();
  
  // Debug profile context
  console.log('🧙 CxF Wizard Profile Debug:', {
    profile: profile?.id ? 'Available' : 'Missing',
    organization: profile?.organization?.id ? 'Available' : 'Missing',
    profileData: profile
  });
  // Lazy-load ASTM tables when wizard opens to avoid dispatcher issues
  const [astmTables, setAstmTables] = useState([]);
  const [astmLoading, setAstmLoading] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const fetchAstm = async () => {
      setAstmLoading(true);
      try {
        const { data, error } = await supabase
          .from('astm_e308_tables')
          .select('*')
          .eq('table_number', 5)
          .eq('illuminant_name', 'D50')
          .eq('observer', '2');
        if (!cancelled) setAstmTables(data || []);
      } catch (e) {
        if (!cancelled) setAstmTables([]);
      } finally {
        if (!cancelled) setAstmLoading(false);
      }
    };
    fetchAstm();
    return () => { cancelled = true; };
  }, [isOpen]);
  // Removed useToast hook to avoid dispatcher issues; using non-hook toast API
  const { optimisticAddInk, optimisticAddInkCondition, optimisticUpdateInk, optimisticUpdateInkCondition, forceRefresh } = useInksData();
  


  // Check if ALL of the colors are single color imports
  const hasSingleColorImport = useMemo(() => {
    return cxfColors.length > 0 && cxfColors.every(color => isSingleColorImport(color));
  }, [cxfColors]);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    assignedSubstrate: 'create-new', // 'create-new' or substrate name
    selectedSubstrate: null,
    assignedSubstrateCondition: 'create-new', // 'create-new' or condition ID
    selectedSubstrateCondition: null,
    assignedInk: 'create-new', // 'create-new' or existing ink selection
    selectedInk: null,
    
    // Step 1: Color selection and data mode
    selectedColorId: null,
    activeDataMode: 'imported', // 'imported' or 'adapted'
    selectedBackground: 'Substrate', // Selected background for tint filtering
    
    // Step 2: Substrate details
    selectionMethod: 'automatic',
    cxfSubstrateName: '', // Store CxF substrate name for reference only
    cxfSubstrateConditionName: '', // Store CxF condition name for reference only
    
    // Step 2: New substrate details (if creating new)
    newSubstrateName: '',
    substrateTypeId: '',
    substrateMaterialId: '',
    surfaceQualityId: '',
    
    // Step 3: New substrate condition details (if creating new)
    printSide: 'surface',
    construction: 'Standard',
    useWhiteInk: false,
    varnish: false,
    laminate: false,
    isMetallic: false,
    varnishType: '',
    varnishSurfaceQuality: '',
    laminateType: '',
    laminateSurfaceQuality: '',
    baseSubstrate: false,
    baseSubstrateType: '',
    baseSubstrateSurfaceQuality: '',
    
    // Step 4: Ink details - Fixed to match database schema
    inkName: '',
    ink_type: '', // maps to 'ink_type' column (the main ink type field)
    type: '', // maps to 'type' column (legacy/secondary type field)
    material: '', // maps to 'material' column
    printProcess: '', // maps to 'print_process' column
    series: '', // maps to 'series' column
    appearanceType: 'standard', // maps to 'appearance_type' column
    opaque: false, // maps to 'opaque' column
    metallic: false, // maps to 'metallic' column
    opacityLeft: null, // maps to 'opacity_left' column
    metallicGloss: null, // maps to 'metallic_gloss' column
    
    // Step 5: Summary (computed)
  });

  // Reset form when dialog opens and pre-select first color
  const resetForm = useCallback(() => {
    if (isOpen) {
      setCurrentStep(1);
      const firstColor = cxfColors?.[0];
      const firstColorId = firstColor?.id || firstColor?.uuid || firstColor?.name || firstColor?.originalObject?.id || firstColor?.originalObject?.name || 'single_color';
      
      console.log('🔄 CxF Ink Wizard: Resetting form', {
        cxfColorsLength: cxfColors?.length || 0,
        firstColor: firstColor ? {
          id: firstColor.id,
          name: firstColor.name,
          uuid: firstColor.uuid,
          originalObjectId: firstColor.originalObject?.id,
          originalObjectName: firstColor.originalObject?.name
        } : null,
        resolvedFirstColorId: firstColorId,
        isSingleColorImport: cxfColors?.length === 1
      });
      
      // Pre-populate with CxF data when available
      const firstColorName = firstColor?.name || firstColor?.originalObject?.name || (cxfColors?.length === 1 ? 'Imported Color' : '');
      const substrateFromCxf = firstColor?.substrateName || firstColor?.originalObject?.substrateName || '';
      const substrateConditionFromCxf = firstColor?.substrateConditionName || firstColor?.originalObject?.substrateConditionName || '';
      
      setFormData({
        assignedSubstrate: null, // Start with null for substrate selection
        selectedSubstrate: null,
        assignedSubstrateCondition: null, // Start with null for condition selection
        selectedSubstrateCondition: null,
        assignedInk: 'create-new', // Default to creating new ink
        selectedInk: null,
        selectedColorId: firstColorId,
        activeDataMode: 'imported', // Start with imported, will be updated by effective data mode logic
        selectedBackground: 'Substrate', // Default background
        selectionMethod: 'automatic',
        cxfSubstrateName: substrateFromCxf, // Store for reference only
        cxfSubstrateConditionName: substrateConditionFromCxf, // Store for reference only
        newSubstrateName: '', // Start with empty string to require user input
        substrateTypeId: '',
        substrateMaterialId: '',
        surfaceQualityId: '',
        printSide: 'surface',
        construction: 'Standard',
        useWhiteInk: false,
        varnish: false,
        laminate: false,
        isMetallic: false,
        varnishType: '',
        varnishSurfaceQuality: '',
        laminateType: '',
        laminateSurfaceQuality: '',
        baseSubstrate: false,
        baseSubstrateType: '',
        baseSubstrateSurfaceQuality: '',
        inkName: firstColorName,
        ink_type: '', // Initialize ink_type for the form
        type: '',
        material: '',
        printProcess: '',
        series: '',
        appearanceType: 'standard',
        opaque: false,
        metallic: false,
        opacityLeft: null,
        metallicGloss: null,
      });
      
      console.log('✅ CxF Ink Wizard: Form reset complete', {
        selectedColorId: firstColorId,
        inkName: firstColorName,
        formInitialized: true
      });
    }
  }, [isOpen, cxfColors]);


  // Calculate active steps based on selections with proper step metadata
  const activeSteps = useMemo(() => {
    const stepTitles = {
      1: 'Select Ink and Substrate',
      2: 'Substrate Details', 
      3: 'Substrate Condition Details',
      4: 'Ink Details',
      5: 'Summary'
    };
    
    const steps = [{ id: 1, name: stepTitles[1] }]; // Step 1 always active
    
    // For single color imports, skip substrate creation steps
    if (hasSingleColorImport) {
      // Only add Ink Details step if creating new ink
      if (formData.assignedInk === 'create-new') {
        steps.push({ id: 4, name: stepTitles[4] });
      }
      steps.push({ id: 5, name: stepTitles[5] });
    } else {
      // Add dynamic steps based on selections for multi-tint imports
      if (formData.assignedSubstrate === 'create-new') {
        steps.push({ id: 2, name: stepTitles[2] }); // Step 2: New substrate details
      }
      
      if (formData.assignedSubstrateCondition === 'create-new') {
        steps.push({ id: 3, name: stepTitles[3] }); // Step 3: New substrate condition details
      }
      
      // Only add Ink Details step if creating new ink
      if (formData.assignedInk === 'create-new') {
        steps.push({ id: 4, name: stepTitles[4] });
      }
      
      steps.push({ id: 5, name: stepTitles[5] }); // Summary always active
    }
    
    return steps;
  }, [formData.assignedSubstrate, formData.assignedSubstrateCondition, formData.assignedInk]);

  // Get current step index
  const currentStepIndex = useMemo(() => 
    activeSteps.findIndex(step => step.id === currentStep), 
    [activeSteps, currentStep]
  );

  // Guard against activeSteps changes that would leave currentStep invalid
  useEffect(() => {
    if (activeSteps.length > 0) {
      const currentStepExists = activeSteps.some(step => step.id === currentStep);
      if (!currentStepExists) {
        setCurrentStep(activeSteps[0].id);
      }
    }
  }, [activeSteps, currentStep]);

  // Navigation functions
  const handleNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < activeSteps.length) {
      setCurrentStep(activeSteps[nextIndex].id);
    }
  }, [currentStepIndex, activeSteps]);

  const handleBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(activeSteps[prevIndex].id);
    }
  }, [currentStepIndex, activeSteps]);

  // Form data updater with automatic substrate condition logic
  const updateFormData = useCallback((updates) => {
    setFormData(prev => {
      const newData = { ...prev, ...updates };
      
      // Auto-set substrate condition when substrate is set to "create-new"
      if (updates.assignedSubstrate === 'create-new') {
        newData.assignedSubstrateCondition = 'create-new';
      }
      
      return newData;
    });
  }, []);

  // Resolved names for display and creation
  const resolvedNames = useMemo(() => {
      // Substrate name
      const substrateName = formData.assignedSubstrate === 'create-new' 
        ? formData.newSubstrateName 
        : formData.selectedSubstrate?.name || '';

      // Substrate condition name
      let substrateConditionName = '';
      if (formData.assignedSubstrateCondition === 'create-new') {
      substrateConditionName = generateSubstrateConditionName({
        printSide: formData.printSide,
        useWhiteInk: formData.useWhiteInk || false,
        laminateEnabled: formData.printSide === 'surface' ? formData.laminate : false,
        laminateSurfaceQuality: formData.printSide === 'surface' && formData.laminate ? formData.laminateSurfaceQuality : null,
        varnishEnabled: formData.varnish || false,
        varnishSurfaceQuality: formData.varnish ? formData.varnishSurfaceQuality : null,
        version: '' // No version for CxF imports
      });
    } else {
      // For existing substrate conditions, use the selected condition name
      substrateConditionName = formData.selectedSubstrateCondition?.name || '';
    }

    // Ink condition name (always auto-generated with "As Measured" curve)
    const inkConditionName = generateInkConditionName({
      substrateName,
      substrateConditionName,
      inkCurve: 'as_measured', // Always "As Measured" for CxF imports
      version: '' // No version for CxF imports
    });

    return {
      substrateName,
      substrateConditionName,
      inkName: formData.inkName,
      inkConditionName
    };
  }, [formData]);

  // Process colors with organization defaults or fallbacks
  const processedColors = useMemo(() => {
    console.log('🧙 Processing CxF colors:', {
      cxfColorsCount: cxfColors?.length || 0,
      hasProfile: !!profile,
      hasOrganization: !!profile?.organization,
      hasAstmTables: astmTables?.length || 0
    });

    if (!cxfColors?.length) {
      console.log('🧙 No CxF colors available');
      return [];
    }

    // Use organization defaults or fallbacks
    const orgDefaults = {
      illuminant: profile?.organization?.default_illuminant || 'D50',
      observer: profile?.organization?.default_observer || '2', 
      astmTable: profile?.organization?.default_astm_table || '5'
    };

    console.log('🧙 Using organization defaults:', orgDefaults);

      // **CRITICAL FIX**: Process single-color imports FIRST, even without ASTM tables
    // This ensures substrate integration happens immediately for single-color imports
    const processedColors = cxfColors.map((color, index) => {
      const id = color.id || color.uuid || color.name || `color-${index}`;
      
      // Handle single color imports immediately - create substrate integration
      if (isSingleColorImport(color)) {
        console.log('🔧 Early single color processing (before ASTM check):', {
          colorName: color.name,
          hasSelectedSubstrateCondition: !!formData.selectedSubstrateCondition,
          hasAstmTables: !!astmTables?.length
        });

        // Always create substrate integration for single-color imports
        const substrateConditionToUse = formData.selectedSubstrateCondition || {
          color_hex: '#FFFFFF',
          lab: { L: 95, a: 0, b: 0 },
          spectral_data: null
        };

        const integratedColor = createSubstrateIntegratedColorData(
          color,
          substrateConditionToUse,
          orgDefaults,
          astmTables
        );
        
        console.log('🔧 Early substrate integration result:', {
          colorName: color.name,
          substrateTintsCount: integratedColor.substrateTints?.length || 0,
          tintPercentages: integratedColor.substrateTints?.map(t => t.tintPercentage) || []
        });
        
        // Use standard pipeline to calculate proper displayHex from solid tint
        const solidTint = integratedColor.substrateTints?.find(t => (t.tintPercentage || t.tint) === 100);
        let calculatedHex = solidTint?.colorHex || color.colorHex || color.hex || color.displayHex;

        // Use standard computeDefaultDisplayColor pipeline if no existing hex is available
        if (!calculatedHex) {
          const orgDefaults = {
            default_illuminant: 'D50',
            default_observer: '2', 
            default_astm_table: '5'
          };
        try {
          // Use safe spectral data wrapper for CXF shapes
          const s = color.spectral_data || color.spectralData || solidTint?.spectral_data || solidTint?.spectralData;
          const result = computeDefaultDisplayColor(s ? { spectral_data: s } : color, orgDefaults, astmTables);
          calculatedHex = result?.hex;
        } catch (error) {
          console.warn('Failed to compute hex using standard pipeline:', error);
        }
        }
        
        // Final neutral fallback only if standard pipeline fails
        if (!calculatedHex) {
          calculatedHex = '#9CA3AF';
        }
        
        console.log('🎨 Single color displayHex calculation:', {
          colorName: color.name,
          solidTintHex: solidTint?.colorHex,
          originalColorHex: color.colorHex || color.hex,
          finalDisplayHex: calculatedHex
        });
        
        return {
          ...integratedColor,
          id,
          displayHex: calculatedHex,
          _isSingleColorImport: true,
          availableBackgrounds: ['Substrate'],
          effectiveDataMode: 'imported'
        };
      }

      // For multi-tint imports, create basic structure  
      return {
        ...color,
        id,
        displayHex: color.colorHex || color.hex || color.displayHex || '#9CA3AF', // Use neutral gray instead of ugly gray
        processedTints: [],
        availableBackgrounds: ['Substrate'],
        effectiveDataMode: 'imported',
        _isSingleColorImport: false
      };
    });

    // If no ASTM tables available, return the processed colors (single-color integration already done)
    if (!astmTables?.length) {
      console.log('🧙 No ASTM tables, using processed colors (single-color integration complete) for', processedColors.length, 'colors');
      return processedColors;
    }

    // Helper to pick and normalize weighting table rows
    const getOrgWeightingTable = (astmRows = []) => {
      if (!Array.isArray(astmRows) || astmRows.length === 0) return null;
      const illuminant = orgDefaults.illuminant;
      const observer = String(orgDefaults.observer);
      const tableNumber = String(orgDefaults.astmTable);

      const normalize = (rows) => rows.map(r => ({
        ...r,
        white_point_x: r.white_point_x ?? r.xn,
        white_point_y: r.white_point_y ?? r.yn,
        white_point_z: r.white_point_z ?? r.zn,
        wavelength: r.wavelength ?? r.lambda ?? r.wl,
        x_factor: r.x_factor ?? r.xbar ?? r.Sx ?? r.x,
        y_factor: r.y_factor ?? r.ybar ?? r.Sy ?? r.y,
        z_factor: r.z_factor ?? r.zbar ?? r.Sz ?? r.z,
      }));

      const matching = astmRows.filter(t =>
        t.illuminant_name === illuminant &&
        String(t.observer) === observer &&
        String(t.table_number) === tableNumber
      );
      if (matching.length > 0) return normalize(matching);

      const fallback = astmRows.filter(t =>
        t.illuminant_name === 'D50' && String(t.observer) === '2' && String(t.table_number) === '5'
      );
      if (fallback.length > 0) return normalize(fallback);

      return normalize(astmRows);
    };

    const weightingTable = getOrgWeightingTable(astmTables);
    console.log('🧙 Weighting table result:', { 
      hasWeightingTable: !!weightingTable,
      weightingTableLength: weightingTable?.length 
    });

    return processedColors.map(color => {
      try {
        // Single-color imports are already processed above, just return them
        if (color._isSingleColorImport) {
          console.log('🔧 Single color already processed, returning:', {
            colorName: color.name,
            substrateTintsCount: color.substrateTints?.length || 0
          });
          return color;
        }

        // Normalize tints data for regular multi-tint imports
        const normalizedTints = normalizeTints(color.substrateTints);
        
        // Combine all tint sources for background discovery (substrate + overBlack)
        const combinedTintSources = [
          ...(Array.isArray(color.substrateTints) ? color.substrateTints : []),
          ...(Array.isArray(color.overBlackTints) ? color.overBlackTints : [])
        ];
        const normalizedAllTints = normalizeTints(combinedTintSources);
        
        // Extract available backgrounds from all tints for wizard preview
        const availableBackgrounds = [...new Set(normalizedAllTints.map(t => t.backgroundName).filter(Boolean))];
        if (availableBackgrounds.length === 0) {
          availableBackgrounds.push('Substrate');
        }
        console.info('[CxF Backgrounds] Wizard processed color backgrounds:', {
          colorName: color.name,
          availableBackgrounds,
          tintBackgrounds: normalizedAllTints.map(t => ({ tint: t.tintPercentage, backgroundName: t.backgroundName }))
        });
        
        // Calculate effective data mode based on Delta E and substrate condition selection
        const effectiveDataMode = isSingleColorImport(color) ? 'imported' : getEffectiveDataMode(
          normalizedTints,
          formData.selectedSubstrateCondition,
          formData.assignedSubstrateCondition,
          astmTables,
          orgDefaults
        );

        // Calculate adapted tints if effective mode is adapted
        let adaptedTints = null;
        if (effectiveDataMode === 'adapted' && 
            formData.assignedSubstrateCondition !== 'create-new' && 
            formData.selectedSubstrateCondition?.spectral_data) {
          
          console.log('🧪 Calculating adapted tints with:', {
            selectedSubstrate: formData.selectedSubstrateCondition?.name,
            hasSpectralData: !!formData.selectedSubstrateCondition?.spectral_data,
            effectiveDataMode
          });

          // Debug: Log the actual data being passed to adaptTintsToSubstrate
          console.log('🧪 Pre-adaptation debug:', {
            normalizedTints: normalizedTints?.slice(0, 2).map(tint => ({
              tint_percentage: tint.tint_percentage,
              hasSpectralData: !!tint.spectral_data,
              spectralSample: tint.spectral_data ? Object.keys(tint.spectral_data).slice(0, 3) : null,
              hasMeasurements: !!tint.measurements?.length,
              measurementsSample: tint.measurements?.[0] ? {
                hasSpectralData: !!tint.measurements[0].spectral_data,
                spectralSample: tint.measurements[0].spectral_data ? Object.keys(tint.measurements[0].spectral_data).slice(0, 3) : null
              } : null
            })),
            importedSubstrateSpectralSample: null, // Will be set below
            selectedSubstrateSpectralSample: formData.selectedSubstrateCondition?.spectral_data ? {
              wavelengths: Object.keys(formData.selectedSubstrateCondition.spectral_data).slice(0, 5),
              values: Object.keys(formData.selectedSubstrateCondition.spectral_data).slice(0, 5).map(w => formData.selectedSubstrateCondition.spectral_data[w])
            } : null
          });
          
          // Get imported substrate spectral data (0% tint)
          const importedSubstrateTint = normalizedTints.find(tint => getTintPercentage(tint) === 0);
          const importedSubstrateSpectral = importedSubstrateTint?.spectral_data || importedSubstrateTint?.spectralData;
          
          console.log('🧪 Imported substrate analysis:', {
            foundSubstrateTint: !!importedSubstrateTint,
            tintPercentage: importedSubstrateTint ? getTintPercentage(importedSubstrateTint) : null,
            hasSpectralData: !!importedSubstrateSpectral,
            spectralSample: importedSubstrateSpectral ? {
              wavelengths: Object.keys(importedSubstrateSpectral).slice(0, 5),
              values: Object.keys(importedSubstrateSpectral).slice(0, 5).map(w => importedSubstrateSpectral[w])
            } : null,
            substrateTintStructure: importedSubstrateTint ? {
              hasSpectralData: !!importedSubstrateTint.spectral_data,
              hasSpectralDataAlt: !!importedSubstrateTint.spectralData,
              hasMeasurements: !!importedSubstrateTint.measurements?.length
            } : null
          });
          
          if (importedSubstrateSpectral) {
            adaptedTints = adaptTintsToSubstrate(
              normalizedTints,
              importedSubstrateSpectral,
              formData.selectedSubstrateCondition.spectral_data,
              {
                astmTables,
                measurementControls: {
                  illuminant: orgDefaults.illuminant,
                  observer: orgDefaults.observer,
                  table: orgDefaults.astmTable
                },
                fallbackSubstrateLab: formData.selectedSubstrateCondition.lab || { L: 95, a: 0, b: 0 }
              }
            );
            
            console.log('🧪 Adapted tints result:', {
              adaptedTintsCount: adaptedTints?.length || 0,
              firstTint: adaptedTints?.[0]
            });
          }
        } else if (effectiveDataMode === 'adapted') {
          console.warn('🧪 Cannot calculate adapted tints - missing requirements:', {
            hasAssignedSubstrate: !!formData.assignedSubstrateCondition,
            isNotCreateNew: formData.assignedSubstrateCondition !== 'create-new',
            hasSelectedSubstrateSpectral: !!formData.selectedSubstrateCondition?.spectral_data,
            selectedSubstrate: formData.selectedSubstrateCondition?.name
          });
        }

        // Compute display hex with org defaults - use safe spectral wrapper for CXF shapes
        const s = color.spectral_data || color.spectralData;
        const result = computeDefaultDisplayColor(s ? { spectral_data: s } : color, profile.organization || {}, astmTables);
        const processedHex = result?.hex;

        // Use computeDefaultDisplayColor as single source of truth, with fallback to color.hex
        let finalHex = processedHex;
        if (!isValidDisplayColor(finalHex) && isValidDisplayColor(color.hex)) {
          finalHex = color.hex;
        }

        // Determine display hex based on effective data mode
        let displayHex = finalHex;
        if (effectiveDataMode === 'adapted' && adaptedTints && adaptedTints.length > 0) {
          // Find 100% solid color from adapted tints
          const solidAdaptedTint = adaptedTints.find(tint => (tint.tintPercentage || tint.percentage || 0) >= 99);
          if (solidAdaptedTint && solidAdaptedTint.colorHex) {
            displayHex = solidAdaptedTint.colorHex;
          }
        }

        return {
          id: color.id || color.uuid || color.name || color.originalObject?.id || color.originalObject?.name,
          ...color,
          substrateTints: normalizedTints,
          overBlackTints: color.overBlackTints ? normalizeTints(color.overBlackTints) : [],
          adaptedTints: adaptedTints,
          effectiveDataMode: effectiveDataMode, // Include effective mode for UI display
          hex: displayHex,
          colorHex: displayHex,
          lab: computedLab || color.lab || null,
          processedHex: displayHex,
          originalHex: color.hex,
          originalObject: color, // Keep reference to original CxF data for table display
          isValidForImport: normalizedTints.length > 0,
          availableBackgrounds: availableBackgrounds // Add for wizard UI
        };
      } catch (error) {
        console.warn('Failed to process color:', color?.name, error);
        return {
          ...color,
          hex: color.hex,
          colorHex: color.hex,
          processedHex: color.hex,
          originalHex: color.hex,
          originalObject: color // Keep reference to original CxF data for table display
        };
      }
    });
  }, [cxfColors, profile?.organization, astmTables, formData.assignedSubstrateCondition, formData.selectedSubstrateCondition]);

  // Validation for each step
  const canProceedFromStep = useCallback((step) => {
    switch (step) {
      case 1:
        // For single color imports, only require substrate selection (no condition creation)
        if (hasSingleColorImport) {
          const hasValidInk = formData.assignedInk === 'create-new' 
            ? true // Will enter ink name on Step 4
            : formData.selectedInk?.id;
          return !!formData.selectedColorId && !!formData.selectedSubstrate?.id && hasValidInk;
        }
        // For multi-tint imports, require color selection and valid substrate/condition/ink selections
        const hasValidSubstrate = formData.assignedSubstrate === 'create-new' 
          ? true // Will enter substrate name on Step 2
          : formData.selectedSubstrate?.id;
        const hasValidCondition = formData.assignedSubstrateCondition === 'create-new' 
          ? true // Condition will be auto-generated
          : formData.selectedSubstrateCondition?.id;
        const hasValidInk = formData.assignedInk === 'create-new' 
          ? true // Will enter ink name on Step 4
          : formData.selectedInk?.id;
        return !!formData.selectedColorId && hasValidSubstrate && hasValidCondition && hasValidInk;
      
      case 2:
        return formData.newSubstrateName.trim().length > 0 && 
               formData.substrateTypeId && 
               formData.substrateMaterialId && 
               formData.surfaceQualityId;
      
      case 3:
        // Validate substrate condition requirements
        let isValid = true;
        
        // If varnish is enabled, require both type and surface quality
        if (formData.varnish) {
          isValid = isValid && formData.varnishType && formData.varnishSurfaceQuality;
        }
        
        // If laminate is enabled (surface printing), require both type and surface quality
        if (formData.printSide === 'surface' && formData.laminate) {
          isValid = isValid && formData.laminateType && formData.laminateSurfaceQuality;
        }
        
        // If base substrate is enabled (reverse printing), require both type and surface quality
        if (formData.printSide === 'reverse' && formData.baseSubstrate) {
          isValid = isValid && formData.baseSubstrateType && formData.baseSubstrateSurfaceQuality;
        }
        
        return isValid;
      
      case 4:
        // Only validate ink fields if creating new ink
        if (formData.assignedInk === 'create-new') {
          return formData.inkName.trim().length > 0 && 
                 formData.printProcess.trim().length > 0 && 
                 formData.ink_type.trim().length > 0;
        }
        return true; // If using existing ink, no validation needed
      
      case 5:
        return true; // Summary step
      
      default:
        return false;
    }
  }, [formData]);

  // Create assets with optimistic updates using React Query mutation
  const createAssetsMutation = useMutation({
    mutationFn: async (formData) => {
      const organizationId = profile?.organization_id;
      if (!organizationId) {
        throw new Error('No organization found');
      }

      let substrateId = null;
      let substrateConditionId = null;

      // Step 1: Create substrate if needed
      if (formData.assignedSubstrate === 'create-new') {
        // Validate required fields before creating substrate
        if (!formData.newSubstrateName?.trim()) {
          throw new Error('Substrate name is required');
        }
        if (!formData.substrateTypeId) {
          throw new Error('Substrate type is required');
        }
        if (!formData.substrateMaterialId) {
          throw new Error('Substrate material is required');
        }
        if (!formData.surfaceQualityId) {
          throw new Error('Surface quality is required');
        }

        const { data: newSubstrate, error: substrateError } = await supabase
          .from('substrates')
          .insert([{
            name: formData.newSubstrateName.trim(),
            type: formData.substrateTypeId,
            material: formData.substrateMaterialId,
            surface_quality: formData.surfaceQualityId,
            printing_side: formData.printSide,
            organization_id: organizationId
          }])
          .select()
          .single();

        if (substrateError) {
          console.error('Substrate creation error:', substrateError);
          throw new Error(`Failed to create substrate: ${substrateError.message}`);
        }
        substrateId = newSubstrate.id;
      } else if (formData.assignedSubstrate !== 'create-new' && formData.selectedSubstrate?.id) {
        // Use existing substrate ID
        substrateId = formData.selectedSubstrate.id;
        
        // Update existing substrate's printing_side if it differs from current selection
        const { error: updateError } = await supabase
          .from('substrates')
          .update({ printing_side: formData.printSide })
          .eq('id', formData.selectedSubstrate.id);
        
        if (updateError) {
          console.warn('Failed to update substrate printing_side:', updateError);
        }
      } else {
        throw new Error('No substrate specified for creation');
      }

      // Step 2: Create substrate condition if needed
      if (formData.assignedSubstrateCondition === 'create-new') {
        if (!substrateId) {
          throw new Error('Substrate ID is required to create substrate condition');
        }
        if (!resolvedNames.substrateConditionName?.trim()) {
          throw new Error('Substrate condition name could not be generated');
        }
        const constructionDetails = {
          laminate_enabled: formData.laminate,
          laminate_type: formData.laminateType || null,
          laminate_surface_quality: formData.laminateSurfaceQuality || null,
          varnish_enabled: formData.varnish,
          varnish_type: formData.varnishType || null,
          varnish_surface_quality: formData.varnishSurfaceQuality || null,
          base_substrate_enabled: formData.baseSubstrate,
          base_substrate_type: formData.baseSubstrateType || null,
          base_substrate_surface_quality: formData.baseSubstrateSurfaceQuality || null,
          print_side: formData.printSide,
          is_metallic: formData.isMetallic
        };

        const { data: newSubstrateCondition, error: conditionError } = await supabase
          .from('substrate_conditions')
          .insert([{
            name: resolvedNames.substrateConditionName,
            substrate_id: substrateId,
            construction_details: constructionDetails,
            organization_id: organizationId,
            use_white_ink: formData.useWhiteInk
          }])
          .select()
          .single();

        if (conditionError) {
          console.error('Substrate condition creation error:', conditionError);
          throw new Error(`Failed to create substrate condition: ${conditionError.message}`);
        }
        substrateConditionId = newSubstrateCondition.id;
      } else if (formData.assignedSubstrateCondition !== 'create-new') {
        // Use existing substrate condition ID - handle both string ID and full object
        substrateConditionId = typeof formData.selectedSubstrateCondition === 'string' 
          ? formData.selectedSubstrateCondition 
          : formData.selectedSubstrateCondition?.id || formData.assignedSubstrateCondition;
      } else {
        throw new Error('No substrate condition specified for creation');
      }

      // Step 3: Conditionally create ink or use existing one
      let inkId;
      if (formData.assignedInk === 'create-new') {
        if (!formData.inkName?.trim()) {
          throw new Error('Ink name is required');
        }

        const { data: newInk, error: inkError } = await supabase
          .from('inks')
          .insert([{
            name: formData.inkName.trim(),
            ink_type: formData.ink_type || null, // Fixed: use 'ink_type' for main ink type
            type: formData.type || null, // Legacy type field
            material: formData.material || null,
            print_process: formData.printProcess || null,
            series: formData.series || null,
            appearance_type: formData.appearanceType || 'standard',
            opaque: formData.opaque || false,
            metallic: formData.metallic || false,
            opacity_left: formData.opacityLeft || null,
            metallic_gloss: formData.metallicGloss || null,
            organization_id: organizationId
          }])
          .select()
          .single();

        if (inkError) {
          console.error('Ink creation error:', inkError);
          throw new Error(`Failed to create ink: ${inkError.message}`);
        }
        
        inkId = newInk.id;
      } else {
        // Use existing ink
        if (!formData.selectedInk?.id) {
          throw new Error('Selected ink is required');
        }
        inkId = formData.selectedInk.id;
      }

      // Step 4: Create ink condition with CxF data based on selected color
      const selectedColor = processedColors.find(c => c.id === formData.selectedColorId) || processedColors[0];
      
      // CRITICAL FIX: Always extract imported tints first as base data
      // This ensures we have the original substrate data for adaptation calculations
      const selectedNormalizedTints = extractNormalizedTints([selectedColor], 'imported');
      
      // Enhanced safety fallback if selectedNormalizedTints is empty (unconditional)
      if (selectedNormalizedTints.length === 0) {
        console.log('🔧 SAFETY: Re-integrating substrate due to empty tints:', {
          selectedColorName: selectedColor?.name,
          isSingleColor: isSingleColorImport(selectedColor),
          selectedColorKeys: Object.keys(selectedColor || {}),
          hasSubstrateTints: Array.isArray(selectedColor?.substrateTints)
        });
        
        // Use orgDefaults and astmTables for proper substrate integration
        const orgDefaults = {
          illuminant: profile?.organization?.default_illuminant || 'D50',
          observer: profile?.organization?.default_observer || '2', 
          astmTable: profile?.organization?.default_astm_table || '5'
        };
        
        const reintegratedColor = createSubstrateIntegratedColorData(
          selectedColor,
          formData.selectedSubstrateCondition,
          orgDefaults,
          astmTables
        );
        const fallbackTints = extractNormalizedTints([reintegratedColor], 'imported');
        
        console.log('🔧 SAFETY FALLBACK RESULT:', {
          reintegratedColorHasSubstrateTints: Array.isArray(reintegratedColor.substrateTints),
          substrateTintsCount: reintegratedColor.substrateTints?.length || 0,
          fallbackTintsCount: fallbackTints.length,
          fallbackTintPercentages: fallbackTints.map(t => t.tintPercentage)
        });
        
        selectedNormalizedTints.push(...fallbackTints);
      }
      
      // Verification logging
      console.log('🔧 TINTS VERIFICATION:', {
        selectedColorId: selectedColor?.id,
        isSingleColor: isSingleColorImport(selectedColor),
        selectedNormalizedTintsCount: selectedNormalizedTints.length,
        tintPercentages: selectedNormalizedTints.map(t => getTintPercentage(t)),
        backgroundNames: selectedNormalizedTints.map(t => t.backgroundName)
      });
      
      const spectralData = selectedColor?.spectral_data || selectedColor?.spectralData || extractSpectralData(selectedColor, selectedColor?.name) || selectedColor?.originalObject?.spectralData || selectedColor?.originalObject?.spectral_data || null;
      const lab = selectedColor?.lab || null;
      
      // CRITICAL: Extract available backgrounds from the actual normalized tints
      const availableBackgrounds = [...new Set(
        (selectedNormalizedTints || [])
          .map(t => t.backgroundName || t.background || 'Substrate')
          .filter(Boolean)
      )].sort((a, b) => (a === 'Substrate' ? -1 : b === 'Substrate' ? 1 : a.localeCompare(b)));
      
      console.log('📊 CXF BACKGROUNDS DETECTED:', {
        fromSelectedColor: selectedColor?.availableBackgrounds,
        fromNormalizedTints: [...new Set((selectedNormalizedTints || []).map(t => t.backgroundName).filter(Boolean))],
        finalBackgrounds: availableBackgrounds
      });
      
      // Calculate effective data mode early to use in measurement settings
      const currentColor = processedColors.find(c => c.id === formData.selectedColorId);
      const prelimEffectiveDataMode = (currentColor && isSingleColorImport(currentColor)) ? 'imported' : getEffectiveDataMode(
        selectedNormalizedTints,
        formData.selectedSubstrateCondition,
        formData.assignedSubstrateCondition,
        astmTables,
        profile?.organization || {}
      );
      
      // Honor wizard-selected activeDataMode when available
      const finalPreferredDataMode = formData.activeDataMode || prelimEffectiveDataMode;
      
      // Use the chosen preferred data mode for measurement settings
      const measurementSettings = {
        preferred_data_mode: finalPreferredDataMode,
        available_modes: (() => {
          const normalize = (v) => {
            if (!v) return null;
            const s = String(v).toUpperCase();
            const m = s.match(/M[0-3]/);
            return m ? m[0] : null;
          };
          const colorModes = (selectedColor?.measurements || [])
            .map(m => normalize(m.assignedMode || m.mode || m.measurement_mode || m.measurementMode))
            .filter(Boolean);
          const tintModes = (colorModes.length ? [] : (selectedNormalizedTints || [])
            .flatMap(t => Array.isArray(t.measurements) ? t.measurements.map(mm => mm.mode) : []))
            .map(normalize)
            .filter(Boolean);
          const modes = colorModes.length ? colorModes : tintModes;
          const unique = Array.from(new Set(modes));
          return unique.length ? unique : ['M1'];
        })(),
        available_backgrounds: availableBackgrounds, // CRITICAL: Include all backgrounds from CXF
        illuminant: profile.organization.default_illuminant || 'D50',
        observer: profile.organization.default_observer || '2',
        mode: profile.organization.default_measurement_mode || 'M0'
      };
      
      // Extract the correct 100% solid spectral data based on activeDataMode
      const getSolidSpectralForMode = (cxfColor, mode, targetSubstrateSpectral) => {
        // Use the correct array based on mode
        const sourceArray = mode === 'adapted' ? cxfColor.adaptedTints : cxfColor.substrateTints;
        
        if (!sourceArray || !Array.isArray(sourceArray)) {
          // If adapted mode but no adapted data, compute it on-the-fly if we have substrate data
          if (mode === 'adapted' && cxfColor.substrateTints && targetSubstrateSpectral) {
            console.log('🔧 SAVE-TIME: Computing adapted solid spectral on-the-fly');
            
            // Find 100% solid from substrate tints and 0% substrate
            const solidTint = cxfColor.substrateTints.find(tint => getTintPercentage(tint) === 100);
            const zeroTint = cxfColor.substrateTints.find(tint => getTintPercentage(tint) === 0);
            
            if (solidTint && zeroTint && solidTint.spectralData && zeroTint.spectralData) {
              const adaptedSpectral = computeTwoStepSubstrateAdaptation(
                zeroTint.spectralData,
                solidTint.spectralData,
                targetSubstrateSpectral,
                100,
                { enableLogging: true }
              );
              
              if (adaptedSpectral) {
                console.log('✅ SAVE-TIME: Successfully computed adapted solid spectral');
                return adaptedSpectral;
              }
            }
          }
          
          // For imported mode, no fallback needed - just return null if no substrateTints
          return null;
        }
        
        // Find 100% solid tint
        const solidTint = sourceArray.find(tint => getTintPercentage(tint) === 100);
        return solidTint?.spectral_data || solidTint?.spectralData || null;
      };

      // Use the final preferred mode (wizard-selected when available)
      const effectiveDataMode = finalPreferredDataMode;

      // Get substrate spectral data for adaptation
      const targetSubstrateSpectral = formData.selectedSubstrateCondition?.spectral_data || null;
      
      const solidSpectralData = getSolidSpectralForMode(selectedColor, effectiveDataMode, targetSubstrateSpectral);
      
      // Verification logging
      console.log('🔧 SAVE-TIME VERIFICATION:', {
        effectiveDataMode: effectiveDataMode,
        hasSolidSpectral: !!solidSpectralData,
        solidSpectralWavelengths: solidSpectralData ? Object.keys(solidSpectralData).length : 0,
        selectedColorHasAdaptedTints: !!selectedColor.adaptedTints,
        hasTargetSubstrateSpectral: !!targetSubstrateSpectral
      });

      const enhancedTints = enhanceImportedTintsForMode(selectedNormalizedTints, effectiveDataMode, solidSpectralData);
      
      const tempCondition = {
        lab: lab,
        imported_tints: enhancedTints,
        measurement_settings: measurementSettings,
        ...(solidSpectralData && { spectral_data: solidSpectralData })
      };
      
      // Verify tint structure before color calculation
      console.log('🎨 TEMP CONDITION FOR COLOR CALCULATION:', {
        effectiveDataMode,
        importedTintsCount: enhancedTints.length,
        solidTint: enhancedTints.find(t => getTintPercentage(t) === 100),
        hasConditionSpectralData: !!tempCondition.spectral_data,
        conditionSpectralKeys: tempCondition.spectral_data ? Object.keys(tempCondition.spectral_data).length : 0
      });
      
      const colorHex = calculateInkConditionColorHex(tempCondition, effectiveDataMode, profile.organization, astmTables);
      
      console.log('🎨 CALCULATED COLOR HEX:', colorHex);

      // Determine substrate condition name
      const substrateConditionName = formData.assignedSubstrateCondition === 'create-new' 
        ? resolvedNames.substrateConditionName 
        : formData.selectedSubstrateCondition?.name;

      if (!substrateConditionName) {
        throw new Error('Substrate condition name is required for ink condition creation');
      }

      // Validate that we have a substrate condition ID
      if (!substrateConditionId) {
        throw new Error('Substrate condition ID is required for ink condition creation');
      }

      // Validate that we have a substrate ID for foreign key
      if (!substrateId) {
        throw new Error('Substrate ID is required for ink condition creation');
      }

      // Define organization defaults for this mutation
      const orgDefaults = {
        illuminant: profile.organization.default_illuminant || 'D50',
        observer: profile.organization.default_observer || '2',
        astmTable: profile.organization.default_astm_table || '5'
      };

      // Use effectiveDataMode instead of formData.activeDataMode for correct adapted tint saving
      const finalDataMode = effectiveDataMode;

      // Prepare tint data for both modes - use selectedNormalizedTints
      const normalizedImportedTints = enhanceImportedTintsForMode(selectedNormalizedTints, 'imported', solidSpectralData);
      
      // Final verification before database insert
      console.log('🔧 FINAL DB INSERT VERIFICATION:', {
        normalizedImportedTintsCount: normalizedImportedTints.length,
        tintsToSave: normalizedImportedTints.map(t => ({
          tintPercentage: getTintPercentage(t),
          backgroundName: t.backgroundName,
          hasSpectralData: !!(t.spectral_data || t.spectralData)
        }))
      });
      
      // Handle adapted tints: extract directly from CxF data or calculate fresh
      let normalizedAdaptedTints = null;
      let computedAdaptedMode = finalDataMode; // Track if we successfully compute adapted tints
      
      // CRITICAL: Always compute physics-based adaptation when a substrate is selected
      if (formData.assignedSubstrateCondition !== 'create-new' && formData.selectedSubstrateCondition) {
        console.log('🔧 Computing physics-based adapted tints to selected substrate');
        
        // Ensure we have the full substrate condition object with spectral_data
        let resolvedSubstrateCondition = formData.selectedSubstrateCondition;
        
        if (formData.assignedSubstrateCondition && formData.assignedSubstrateCondition !== 'create-new') {
          // If selectedSubstrateCondition is missing, incomplete, or just an ID string, fetch it now
          if (!resolvedSubstrateCondition || 
              typeof resolvedSubstrateCondition === 'string' || 
              !resolvedSubstrateCondition.spectral_data) {
            
            console.log('🔧 Fetching full substrate condition at save-time:', formData.assignedSubstrateCondition);
            
            const { data: freshSubstrateCondition, error: fetchError } = await supabase
              .from('substrate_conditions')
              .select('*')
              .eq('id', formData.assignedSubstrateCondition)
              .maybeSingle();
            
            if (fetchError || !freshSubstrateCondition) {
              console.error('❌ Failed to fetch substrate condition:', fetchError);
              throw new Error(`Cannot resolve substrate condition: ${fetchError?.message || 'Not found'}`);
            }
            
            resolvedSubstrateCondition = freshSubstrateCondition;
            console.log('✅ Fetched substrate condition with spectral data:', {
              id: freshSubstrateCondition.id,
              name: freshSubstrateCondition.name,
              hasSpectralData: !!freshSubstrateCondition.spectral_data,
              spectralKeys: Object.keys(freshSubstrateCondition.spectral_data || {}).length
            });
          }
        }
        
        // Build map of substrate spectral data by background name (0% tints)
        const importedSubstrateSpectralByBackground = {};
        normalizedImportedTints
          .filter(tint => getTintPercentage(tint) === 0)
          .forEach(zeroTint => {
            const bgName = zeroTint.backgroundName || zeroTint.background || 'Substrate';
            const spectral = safeSpectralData(zeroTint);
            if (spectral && Object.keys(spectral).length > 0) {
              importedSubstrateSpectralByBackground[bgName] = spectral;
            }
          });

        const selectedSubstrateSpectral = resolvedSubstrateCondition?.spectral_data;
        
        const hasValidSourceSubstrate = Object.keys(importedSubstrateSpectralByBackground).length > 0;
        const hasValidTargetSubstrate = selectedSubstrateSpectral && Object.keys(selectedSubstrateSpectral).length > 0;
        
        console.log('🎯 Substrate spectral data by background:', {
          backgrounds: Object.keys(importedSubstrateSpectralByBackground),
          spectralCounts: Object.fromEntries(
            Object.entries(importedSubstrateSpectralByBackground).map(([bg, spec]) => [bg, Object.keys(spec).length])
          )
        });
        
        console.log('🎯 Adaptation validation:', {
          hasValidSourceSubstrate,
          hasValidTargetSubstrate,
          targetSpectralKeys: hasValidTargetSubstrate ? Object.keys(selectedSubstrateSpectral).length : 0,
          resolvedSubstrateConditionType: typeof resolvedSubstrateCondition,
          resolvedSubstrateConditionId: resolvedSubstrateCondition?.id,
          hasResolvedSpectralData: !!resolvedSubstrateCondition?.spectral_data
        });
        
        if (hasValidSourceSubstrate && hasValidTargetSubstrate) {
          console.log('✅ Proceeding with physics-based substrate adaptation');
          
          // Compute adapted tints via physics-based adaptation
          normalizedAdaptedTints = adaptTintsToSubstrate(
            normalizedImportedTints,
            importedSubstrateSpectralByBackground,
            selectedSubstrateSpectral,
            {
              astmTables,
              measurementControls: {
                illuminant: orgDefaults.illuminant,
                observer: orgDefaults.observer,
                table: orgDefaults.astmTable
              },
              fallbackSubstrateLab: resolvedSubstrateCondition?.lab || { L: 95, a: 0, b: 0 }
            }
          );
          
          console.log('🔧 Physics-based adapted tints calculated:', {
            adaptedTintsCount: normalizedAdaptedTints?.length || 0,
            success: !!normalizedAdaptedTints
          });
          
          // If physics-based adaptation succeeded, set mode to 'adapted'
          if (normalizedAdaptedTints && normalizedAdaptedTints.length > 0) {
            computedAdaptedMode = 'adapted';
            console.log('✅ Successfully computed adapted tints - forcing active_data_mode to "adapted"');
            
            // CRITICAL: Override formData to ensure ui_state uses adapted mode
            formData.activeDataMode = 'adapted';
          }
        } else {
          console.warn('⚠️ Cannot perform substrate adaptation - missing spectral data:', {
            reason: !hasValidSourceSubstrate ? 'No imported substrate (0% tint) spectral data' : 'No selected substrate spectral data'
          });
          
          // Fallback: Try to extract adapted tints from CxF if available
          const selectedAdaptedTints = extractNormalizedTints([selectedColor], 'adapted');
          if (selectedAdaptedTints.length > 0) {
            normalizedAdaptedTints = enhanceImportedTintsForMode(selectedAdaptedTints, 'adapted', solidSpectralData);
            computedAdaptedMode = 'adapted';
            console.log('🔧 Using CxF-provided adapted tints as fallback:', {
              adaptedTintsCount: normalizedAdaptedTints.length
            });
          }
        }
      }

      // VERIFICATION: Log final tint data before database insert
      console.log('🔧 FINAL TINT VERIFICATION BEFORE DB INSERT:', {
        isSingleColor: isSingleColorImport(selectedColor),
        normalizedImportedTintsCount: normalizedImportedTints?.length || 0,
        normalizedAdaptedTintsCount: normalizedAdaptedTints?.length || 0,
        importedTintPercentages: normalizedImportedTints?.map(t => getTintPercentage(t)) || [],
        adaptedTintPercentages: normalizedAdaptedTints?.map(t => getTintPercentage(t)) || [],
        activeDataMode: computedAdaptedMode,
        expectedFor100Solid: isSingleColorImport(selectedColor) ? '[0, 100]' : 'varies',
        // Enhanced debugging
        importedTintsHaveSpectral: normalizedImportedTints?.every(t => t.spectral_data || t.spectralData) || false,
        adaptedTintsHaveSpectral: normalizedAdaptedTints?.every(t => t.spectral_data || t.spectralData) || false,
        willSaveImported: !!normalizedImportedTints,
        willSaveAdapted: !!normalizedAdaptedTints
      });

      // Validate backgrounds before saving
      console.log('✅ SAVING INK CONDITION WITH BACKGROUNDS:', {
        availableBackgrounds: measurementSettings.available_backgrounds,
        importedTintsCount: normalizedImportedTints?.length,
        adaptedTintsCount: normalizedAdaptedTints?.length,
        importedBackgrounds: [...new Set((normalizedImportedTints || []).map(t => t.backgroundName).filter(Boolean))],
        adaptedBackgrounds: [...new Set((normalizedAdaptedTints || []).map(t => t.backgroundName).filter(Boolean))]
      });

      const { data: newInkCondition, error: inkConditionError } = await supabase
        .from('ink_conditions')
        .insert([{ 
          name: resolvedNames.inkConditionName,
          ink_id: inkId,
          substrate_id: substrateId,
          substrate_condition: substrateConditionId,
          color_hex: normalizedAdaptedTints && normalizedAdaptedTints.length > 0
            ? (() => {
                // Recalculate color_hex from adapted tints if available
                const tempCondition = {
                  adapted_tints: normalizedAdaptedTints,
                  imported_tints: normalizedImportedTints
                };
                const result = computeDefaultDisplayColor(
                  tempCondition,
                  orgDefaults,
                  astmTables,
                  'adapted'
                );
                const adaptedHex = result?.hex;
                return (adaptedHex && adaptedHex !== '#E5E7EB' && adaptedHex !== '#f3f4f6')
                  ? adaptedHex 
                  : colorHex;
              })()
            : colorHex,
          spectral_data: solidSpectralData,
          lab: lab,
          ink_curve: 'as_measured',
          imported_tints: normalizedImportedTints, // Always save original imported tints
          adapted_tints: normalizedAdaptedTints, // Save adapted tints if available
          measurement_settings: measurementSettings, // Use original preferred_data_mode from measurementSettings
          ui_state: {
            active_data_mode: formData.activeDataMode, // Use formData which was overridden if adaptation succeeded
            last_saved_at: new Date().toISOString(),
            show_imported_colors: false
          }
        }])
        .select()
        .single();

      if (inkConditionError) {
        console.error('Ink condition creation error:', inkConditionError);
        throw new Error(`Failed to create ink condition: ${inkConditionError.message}`);
      }

      // Immediately process substrate condition to extract substrate spectral/Lab/hex
      try {
        if (substrateConditionId) {
          console.log('🔄 Immediately processing new substrate condition:', substrateConditionId);
          await fixSubstrateCondition(substrateConditionId);
          console.log('✅ Substrate condition processed after ink condition creation');
        }
      } catch (e) {
        console.warn('⚠️ Substrate condition processing failed (non-fatal):', e);
      }

      // Return appropriate data based on whether new ink was created
      if (formData.assignedInk === 'create-new') {
        return { newInk: { id: inkId }, newInkCondition, substrateId, substrateConditionId };
      } else {
        return { existingInk: formData.selectedInk, newInkCondition, substrateId, substrateConditionId };
      }
    },
    onMutate: async () => {
      // Set submitting state but don't create optimistic updates
      // This prevents temp IDs from entering the system
      console.log('🔄 Starting asset creation...');
    },
    onSuccess: (data, variables, context) => {
      const { newInk, existingInk, newInkCondition } = data;
      const ink = newInk || existingInk;
      
      // Force refresh InkContext data for immediate UI updates
      forceRefresh();
      
      // Note: Query invalidation removed to avoid context errors
      
      // Kick off substrate condition processing only when newly created (non-blocking)
      if (data?.substrateConditionId && variables?.assignedSubstrateCondition === 'create-new') {
        fixSubstrateCondition(data.substrateConditionId)
          .then(() => console.log('✅ Substrate condition processed'))
          .catch((e) => console.warn('⚠️ Substrate condition processing failed (non-fatal):', e));
      } else {
        console.log('⏭️ Skipping substrate condition processing for existing condition');
      }

      toast({
        title: 'Success!',
        description: newInk 
          ? `Ink "${variables.inkName}" created successfully.`
          : `Ink condition created for "${existingInk.name}".`
      });

      // Navigate using real database IDs
      onSuccess?.(ink.id, newInkCondition.id);
      onClose();
    },
    onError: (error, variables, context) => {
      console.error('Failed to create assets:', error);
      
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create ink and related assets.',
        variant: 'destructive'
      });
    }
  });

  // Create assets handler
  const handleCreateAssets = useCallback(async () => {
    createAssetsMutation.mutate(formData);
  }, [formData, createAssetsMutation]);

  return {
    // Wizard state
    currentStep,
    currentStepIndex,
    activeSteps,
    isSubmitting: createAssetsMutation.isPending,
    
    // Form data
    formData,
    updateFormData,
    
    // Processed data
    processedColors,
    resolvedNames,
    
    // Navigation
    handleNext,
    handleBack,
    canProceedFromStep,
    
    // Actions
    resetForm,
    handleCreateAssets,
    
    // Computed props
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === activeSteps.length - 1,
    canProceed: canProceedFromStep(currentStep),
    
    // CxF3 specific
    hasSingleColorImport,
    isSingleColorImport: (() => {
      const selectedColor = processedColors.find(c => c.id === formData.selectedColorId) || processedColors[0];
      // Robust fallback: use selectedColor flag or global flag if no specific color found
      return selectedColor?._isSingleColorImport || hasSingleColorImport;
    })()
  };
};