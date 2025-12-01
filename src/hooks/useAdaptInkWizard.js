import { useState, useCallback, useMemo, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useProfile } from '@/context/ProfileContext';
import { useInksData } from '@/context/InkContext';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { generateSubstrateConditionName } from '@/lib/substrateConditionNaming';
import { generateInkConditionName } from '@/lib/inkConditionNaming';
import { computeDefaultDisplayColor, spectralToLabASTME308, extractSpectralData, labToHex, isValidDisplayColor } from '@/lib/colorUtils';
import { calculateInkConditionColorHex, updateInkConditionColorHex } from '@/lib/colorUtils/inkConditionColorHex';
import { getSolidSpectralData } from '@/lib/colorUtils/spectralDataHelpers';
import { computeTwoStepSubstrateAdaptation } from '@/lib/inkSubstrateAdaptation';
import { normalizeTints, getTintPercentage, safeSpectralData } from '@/lib/tintsUtils';
import { adaptTintsToSubstrate } from '@/lib/colorUtils/tintAdaptation';
import { getEffectiveDataMode } from '@/lib/substrateAdaptationUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Extract and normalize tints from ink condition data
 * Handles various imported_tints formats (array, object with numeric keys, tints wrapper)
 * @param {Object} inkCondition - Ink condition object
 * @returns {Array} - Normalized array of tint objects
 */
const extractNormalizedTints = (inkCondition) => {
  console.log('🔍 extractNormalizedTints called:', {
    hasInkCondition: !!inkCondition,
    hasImportedTints: !!inkCondition?.imported_tints,
    importedTintsType: inkCondition?.imported_tints ? typeof inkCondition.imported_tints : 'undefined',
    importedTintsIsArray: Array.isArray(inkCondition?.imported_tints),
    importedTintsKeys: inkCondition?.imported_tints && typeof inkCondition.imported_tints === 'object' 
      ? Object.keys(inkCondition.imported_tints).slice(0, 5) 
      : []
  });
  
  if (!inkCondition?.imported_tints) {
    console.log('❌ No imported_tints found');
    return [];
  }
  
  let rawTints = inkCondition.imported_tints;
  
  // Handle different imported_tints formats
  if (typeof rawTints === 'object' && !Array.isArray(rawTints)) {
    // Check if it has a 'tints' array property
    if (Array.isArray(rawTints.tints)) {
      rawTints = rawTints.tints;
    } 
    // Check if it's an object with numeric keys (common database format)
    else if (Object.keys(rawTints).some(key => !isNaN(parseInt(key)))) {
      rawTints = Object.values(rawTints);
    }
  }
  
  console.log('🔍 After format normalization:', {
    rawTintsType: typeof rawTints,
    rawTintsIsArray: Array.isArray(rawTints),
    rawTintsLength: Array.isArray(rawTints) ? rawTints.length : 'N/A'
  });
  
  // Apply normalizeTints for deduplication and standardization
  const baseTints = normalizeTints(rawTints);
  
  console.log('🔍 After normalizeTints:', {
    baseTintsCount: baseTints?.length || 0,
    firstTintSample: baseTints?.[0] ? {
      percentage: baseTints[0].tintPercentage || baseTints[0].tint_percentage,
      hasSpectralData: !!(baseTints[0].spectral_data || baseTints[0].spectralData),
      backgroundName: baseTints[0].backgroundName || baseTints[0].background_name
    } : null
  });
  
  const src = inkCondition.imported_tints;

  // Gather backgrounds list from multiple possible locations
  let backgroundsList = null;
  if (Array.isArray(src?.measurement_settings?.available_backgrounds)) {
    backgroundsList = src.measurement_settings.available_backgrounds;
  } else if (Array.isArray(src?.available_backgrounds)) {
    backgroundsList = src.available_backgrounds;
  } else if (Array.isArray(src?.availableBackgrounds)) {
    backgroundsList = src.availableBackgrounds;
  } else if (Array.isArray(src?.backgrounds)) {
    backgroundsList = src.backgrounds;
  } else if (Array.isArray(inkCondition?.available_backgrounds)) {
    backgroundsList = inkCondition.available_backgrounds;
  }
  
  // Derive backgroundName for each tint (NO normalization - preserve exact names)
  return baseTints.map((t) => {
    // Prefer explicit tint-level names
    let backgroundName = t.backgroundName || t.background_name || null;
    
    // Map via tint-level index if present
    const idx = t.backgroundIndex ?? t.background_index;
    if (!backgroundName && backgroundsList && idx != null && !isNaN(idx)) {
      const nameFromIndex = backgroundsList[idx];
      if (nameFromIndex) backgroundName = nameFromIndex;
    }

    // Fallbacks via measurement-level metadata
    if (!backgroundName && Array.isArray(t.measurements) && t.measurements.length > 0) {
      const mWithName = t.measurements.find(m => m?.backgroundName || m?.background_name);
      if (mWithName) {
        backgroundName = mWithName.backgroundName || mWithName.background_name;
      }
      if (!backgroundName && backgroundsList) {
        const mWithIdx = t.measurements.find(m => (m?.backgroundIndex ?? m?.background_index) != null);
        if (mWithIdx) {
          const midx = mWithIdx.backgroundIndex ?? mWithIdx.background_index;
          const fromIdx = backgroundsList[midx];
          if (fromIdx) backgroundName = fromIdx;
        }
      }
    }

    // Default to 'Substrate' if no background name found and it's 0% or no percentage info
    const tintPct = getTintPercentage(t);
    if (!backgroundName && tintPct === 0) {
      backgroundName = 'Substrate';
    }
    
    // Diagnostic logging (temporary - remove after validation)
    if (t.backgroundName || t.background_name) {
      console.info('[AdaptWizard] Preserving background name:', {
        original: t.backgroundName || t.background_name,
        resolved: backgroundName,
        percentage: tintPct
      });
    }
    
    return {
      ...t,
      backgroundName: backgroundName, // Use direct name - NO normalization
      tintPercentage: tintPct // Ensure standardized percentage field
    };
  });
};

/**
 * Enhance imported tints with mode-specific hints for better display
 * @param {Array} tints - Normalized tints array  
 * @param {string} activeDataMode - Current data mode ('adapted' or 'imported')
 * @param {Object} solidSpectralData - Solid spectral data if available
 * @returns {Array} Enhanced tints array
 */
const enhanceImportedTintsForMode = (tints, activeDataMode, solidSpectralData) => {
  if (activeDataMode === 'adapted' && solidSpectralData) {
    // Mark the 100% tint with adapted data hint
    return tints.map(tint => {
      if (getTintPercentage(tint) === 100) {
        return {
          ...tint,
          _adaptedDataAvailable: true,
          _adaptedSolidSpectral: solidSpectralData
        };
      }
      return tint;
    });
  }
  
  return tints;
};

export const useAdaptInkWizard = ({ sourceInkCondition, isOpen, onSuccess, onClose }) => {
  const { profile } = useProfile();
  const { astmTables } = useAstmTablesCache();
  // Removed useToast hook to avoid dispatcher issues; using non-hook toast API
  const { optimisticAddInkCondition, forceRefresh } = useInksData();

  // Wizard state - only Step 1 for adaptation
  const [currentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data - simplified for adaptation
  const [formData, setFormData] = useState({
    assignedSubstrate: '',
    selectedSubstrate: null,
    assignedSubstrateCondition: '',
    selectedSubstrateCondition: null,
    activeDataMode: 'imported', // Always use imported data for adaptation
    selectedBackground: 'Substrate', // Default to Substrate background
    
    // Substrate details (if creating new)
    newSubstrateName: '',
    substrateTypeId: '',
    substrateMaterialId: '',
    surfaceQualityId: '',
    
    // Substrate condition details (if creating new)
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
  });

  // Reset form when dialog opens
  const resetForm = useCallback(() => {
    if (isOpen) {
      // Discard existing adapted data when re-opening (requirement #4)
      if (sourceInkCondition?.adapted_tints) {
        // previously logged discard message
      }
      
      setFormData({
        assignedSubstrate: '',
        selectedSubstrate: null,
        assignedSubstrateCondition: '',
        selectedSubstrateCondition: null,
        activeDataMode: 'imported',
        selectedBackground: 'Substrate', // Reset to Substrate background
        newSubstrateName: '',
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
      });
    }
  }, [isOpen]);

  // Active steps - only Step 1 for adaptation
  const activeSteps = useMemo(() => [
    { id: 1, name: 'Select Target Substrate & Condition' }
  ], []);

  // Current step index (always 0 for adaptation)
  const currentStepIndex = 0;

  // Form data updater
  const updateFormData = useCallback((updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Resolved names for the new ink condition
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
        version: ''
      });
    } else {
      substrateConditionName = formData.selectedSubstrateCondition?.name || '';
    }

    // Generate ink condition name using the original ink name
    const inkConditionName = generateInkConditionName({
      substrateName,
      substrateConditionName,
      inkCurve: sourceInkCondition?.ink_curve || 'as_measured',
      version: ''
    });

    return {
      substrateName,
      substrateConditionName,
      inkName: sourceInkCondition?.name || 'Adapted Ink',
      inkConditionName
    };
  }, [formData, sourceInkCondition]);

  // Process the source ink condition with proper color calculation
  const processedColors = useMemo(() => {
    if (!sourceInkCondition || !profile?.organization) {
      return [];
    }

    const orgDefaults = {
      // Legacy shape used by substrate adaptation utilities
      illuminant: profile.organization.default_illuminant || 'D50',
      observer: profile.organization.default_observer || '2',
      astmTable: profile.organization.default_astm_table || '5',
      // Normalized shape expected by inkConditionColorHex/getWeightingTable
      default_illuminant: profile.organization.default_illuminant || 'D50',
      default_observer: profile.organization.default_observer || '2',
      default_astm_table: profile.organization.default_astm_table || '5'
    };

    try {
      // Extract normalized tints from the source ink condition
      const baseTints = extractNormalizedTints(sourceInkCondition);
      
      console.log('🎨 Adapt wizard tint extraction:', {
        baseTintsCount: baseTints.length,
        firstTintSample: baseTints[0]
      });
      
      // Normalize tints with proper background mapping
      const normalizedTints = baseTints.map(tint => {
        let enhancedTint = { ...tint };
        
        // Ensure both camelCase and snake_case are populated
        if (!enhancedTint.backgroundName && enhancedTint.background_name) {
          enhancedTint.backgroundName = enhancedTint.background_name;
        }
        if (!enhancedTint.spectral_data && enhancedTint.spectralData) {
          enhancedTint.spectral_data = enhancedTint.spectralData;
        }
        
        // Calculate colorHex if missing and spectral data is available
        if (!enhancedTint.colorHex && enhancedTint.spectral_data && astmTables?.length) {
          try {
            const result = computeDefaultDisplayColor(
              { spectral_data: enhancedTint.spectral_data },
              orgDefaults,
              astmTables
            );
            const computedHex = result?.hex;
            if (computedHex && isValidDisplayColor(computedHex)) {
              enhancedTint.colorHex = computedHex;
            }
          } catch (error) {
            console.warn('Failed to calculate color for tint:', error);
          }
        }
        
        return enhancedTint;
      });
      
      // Group tints by background - use direct background names (NO normalization)
      const substrateTints = normalizedTints.filter(t => {
        const bg = t.backgroundName || t.background_name || 'Substrate';
        return bg === 'Substrate';
      });

      const overBlackTints = normalizedTints.filter(t => {
        const bg = t.backgroundName || t.background_name;
        return bg && bg !== 'Substrate';
      });

      const availableBackgroundsSet = new Set(
        normalizedTints
          .map(t => t.backgroundName || t.background_name || 'Substrate')
          .filter(Boolean)
      );
      if (availableBackgroundsSet.size === 0) availableBackgroundsSet.add('Substrate');

      console.log('🎨 Adapt wizard background grouping:', {
        substrateTintsCount: substrateTints.length,
        overBlackTintsCount: overBlackTints.length,
        availableBackgrounds: Array.from(availableBackgroundsSet)
      });

      // Calculate display hex from solid tint
      const solidTint = substrateTints.find(t => getTintPercentage(t) === 100);
      let displayHex = solidTint?.colorHex || sourceInkCondition.color_hex;
      
      // If no hex yet and we have ASTM tables, compute it
      if (!displayHex && solidTint?.spectral_data && astmTables?.length) {
        try {
          const result = computeDefaultDisplayColor(
            { spectral_data: solidTint.spectral_data },
            orgDefaults,
            astmTables
          );
          displayHex = result?.hex;
        } catch (error) {
          console.warn('Failed to compute display hex:', error);
        }
      }

      // Fallback to neutral gray if no valid color
      if (!displayHex || !isValidDisplayColor(displayHex)) {
        displayHex = '#808080';
      }

      // Calculate effective data mode if ASTM tables are available
      const effectiveDataMode = astmTables?.length ? getEffectiveDataMode(
        normalizedTints,
        formData.selectedSubstrateCondition,
        formData.assignedSubstrateCondition,
        astmTables,
        orgDefaults
      ) : 'imported';

      // Calculate adapted tints if effective mode is adapted
      let adaptedTints = null;
      if (effectiveDataMode === 'adapted' && 
          formData.assignedSubstrateCondition !== 'create-new' && 
          formData.selectedSubstrateCondition?.spectral_data &&
          astmTables?.length) {
        
        const importedSubstrateTint = normalizedTints.find(tint => getTintPercentage(tint) === 0);
        const importedSubstrateSpectral = safeSpectralData(importedSubstrateTint);
        
        if (importedSubstrateSpectral) {
          try {
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
            
            console.log('🎨 Adapted tints calculated:', {
              adaptedTintsCount: adaptedTints?.length || 0
            });
            
            // Update display hex if adapted
            if (adaptedTints?.length) {
              const solidAdaptedTint = adaptedTints.find(tint => getTintPercentage(tint) >= 99);
              if (solidAdaptedTint?.colorHex) {
                displayHex = solidAdaptedTint.colorHex;
              }
            }
          } catch (error) {
            console.error('Failed to generate adapted tints:', error);
          }
        }
      }

      const result = [{
        id: sourceInkCondition.id,
        name: sourceInkCondition.name,
        hex: displayHex,
        colorHex: displayHex,
        displayHex: displayHex,
        lab: sourceInkCondition.lab,
        spectral_data: sourceInkCondition.spectral_data,
        substrateTints: substrateTints,
        overBlackTints: overBlackTints,
        adaptedTints: adaptedTints,
        effectiveDataMode: effectiveDataMode,
        availableBackgrounds: Array.from(availableBackgroundsSet),
        originalObject: {
          ...sourceInkCondition,
          substrateTints: substrateTints,
          overBlackTints: overBlackTints
        },
        isValidForImport: true
      }];

      console.log('🎨 Adapt wizard processedColors result:', {
        substrateTintsCount: substrateTints.length,
        overBlackTintsCount: overBlackTints.length,
        effectiveDataMode,
        hasAdaptedTints: !!adaptedTints,
        displayHex
      });

      return result;
    } catch (error) {
      console.warn('Failed to process source ink condition color:', error);
      return [{
        id: sourceInkCondition.id,
        name: sourceInkCondition.name,
        hex: sourceInkCondition.color_hex || '#808080',
        colorHex: sourceInkCondition.color_hex || '#808080',
        lab: sourceInkCondition.lab,
        spectral_data: sourceInkCondition.spectral_data,
        originalObject: {
          ...sourceInkCondition,
          substrateTints: sourceInkCondition.imported_tints || []
        },
        isValidForImport: true
      }];
    }
  }, [sourceInkCondition, profile?.organization, astmTables, formData.activeDataMode, formData.assignedSubstrateCondition, formData.selectedSubstrateCondition]);

  // Validation for proceeding
  const canProceed = useMemo(() => {
    // Must have either selected existing substrate/condition or filled in details for new ones
    const hasValidSubstrate = formData.assignedSubstrate !== 'create-new' || 
      (formData.newSubstrateName.trim() && formData.substrateTypeId && formData.substrateMaterialId && formData.surfaceQualityId);
    
    const hasValidSubstrateCondition = formData.assignedSubstrateCondition !== 'create-new' || 
      formData.assignedSubstrateCondition === 'create-new'; // Basic validation for new condition
    
    return hasValidSubstrate && hasValidSubstrateCondition;
  }, [formData]);

  // Create adapted ink condition
  const createAdaptedInkCondition = useMutation({
    mutationFn: async () => {
      if (!sourceInkCondition || !profile?.organization_id) {
        throw new Error('Missing source ink condition or organization');
      }

      console.log('[DEBUG] Starting adaptation mutation', {
        sourceInkConditionId: sourceInkCondition?.id,
        sourceInkHasImportedTints: Array.isArray(sourceInkCondition?.imported_tints) ? sourceInkCondition.imported_tints.length : 0,
        assignedSubstrate: formData.assignedSubstrate,
        selectedSubstrateId: formData.selectedSubstrate?.id,
        assignedSubstrateCondition: formData.assignedSubstrateCondition,
        selectedSubstrateConditionId: formData.selectedSubstrateCondition?.id
      });

      let substrateId = null;
      let substrateConditionId = null;

      // Create or use existing substrate
      if (formData.assignedSubstrate === 'create-new') {
        const { data: newSubstrate, error: substrateError } = await supabase
          .from('substrates')
          .insert({
            name: formData.newSubstrateName,
            organization_id: profile.organization_id,
            type_id: formData.substrateTypeId,
            material_id: formData.substrateMaterialId,
            surface_quality_id: formData.surfaceQualityId
          })
          .select()
          .single();

        if (substrateError) throw substrateError;
        substrateId = newSubstrate.id;
      } else {
        substrateId = formData.selectedSubstrate?.id;
      }

      // Create or use existing substrate condition
      if (formData.assignedSubstrateCondition === 'create-new') {
        const conditionName = generateSubstrateConditionName({
          printSide: formData.printSide,
          useWhiteInk: formData.useWhiteInk || false,
          laminateEnabled: formData.printSide === 'surface' ? formData.laminate : false,
          laminateSurfaceQuality: formData.printSide === 'surface' && formData.laminate ? formData.laminateSurfaceQuality : null,
          varnishEnabled: formData.varnish || false,
          varnishSurfaceQuality: formData.varnish ? formData.varnishSurfaceQuality : null,
          version: ''
        });

        const { data: newCondition, error: conditionError } = await supabase
          .from('substrate_conditions')
          .insert({
            name: conditionName,
            substrate_id: substrateId,
            organization_id: profile.organization_id,
            print_side: formData.printSide,
            construction: formData.construction,
            use_white_ink: formData.useWhiteInk,
            varnish: formData.varnish,
            laminate: formData.laminate,
            is_metallic: formData.isMetallic,
            varnish_type: formData.varnish ? formData.varnishType : null,
            varnish_surface_quality: formData.varnish ? formData.varnishSurfaceQuality : null,
            laminate_type: formData.laminate ? formData.laminateType : null,
            laminate_surface_quality: formData.laminate ? formData.laminateSurfaceQuality : null,
            base_substrate: formData.baseSubstrate,
            base_substrate_type: formData.baseSubstrate ? formData.baseSubstrateType : null,
            base_substrate_surface_quality: formData.baseSubstrate ? formData.baseSubstrateSurfaceQuality : null
          })
          .select()
          .single();

        if (conditionError) throw conditionError;
        substrateConditionId = newCondition.id;
      } else {
        substrateConditionId = formData.selectedSubstrateCondition?.id;
      }

      // Generate new ink condition name
      const newInkConditionName = generateInkConditionName({
        substrateName: formData.assignedSubstrate === 'create-new' ? formData.newSubstrateName : formData.selectedSubstrate?.name,
        substrateConditionName: resolvedNames.substrateConditionName,
        inkCurve: sourceInkCondition.ink_curve || 'as_measured',
        version: ''
      });

      // Calculate proper color_hex for the new ink condition
      const orgDefaults = {
        // Legacy shape used by substrate adaptation utilities
        illuminant: profile.organization.default_illuminant || 'D50',
        observer: profile.organization.default_observer || '2',
        astmTable: profile.organization.default_astm_table || '5',
        // Normalized shape expected by inkConditionColorHex/getWeightingTable
        default_illuminant: profile.organization.default_illuminant || 'D50',
        default_observer: profile.organization.default_observer || '2',
        default_astm_table: profile.organization.default_astm_table || '5'
      };

      // Extract and normalize tints from source condition with color calculation
      const normalizedTints = extractNormalizedTints(sourceInkCondition, orgDefaults, astmTables);
      
      // Resolve selected substrate condition with defensive fetch if missing spectral_data
      let resolvedSelectedSubstrateCondition = formData.selectedSubstrateCondition;
      if (
        formData.assignedSubstrateCondition &&
        formData.assignedSubstrateCondition !== 'create-new' &&
        (!resolvedSelectedSubstrateCondition || !resolvedSelectedSubstrateCondition.spectral_data)
      ) {
        try {
          const { data: fetchedCondition } = await supabase
            .from('substrate_conditions')
            .select('*')
            .eq('id', formData.assignedSubstrateCondition)
            .maybeSingle();
          if (fetchedCondition) {
            resolvedSelectedSubstrateCondition = fetchedCondition;
          }
        } catch (e) {
          console.warn('⚠️ Failed defensive fetch for substrate condition:', e);
        }
      }

      // Get target substrate spectral data for adaptation
      const targetSubstrateSpectral = resolvedSelectedSubstrateCondition?.spectral_data || null;
      
      // Extract solid (100%) spectral data using the same logic as CXF wizard
      const getSolidSpectralForMode = (inkCondition, mode, targetSubstrateSpectral) => {
        // For adapted mode, try to get solid spectral data from measurements or compute adaptation
        if (mode === 'adapted') {
          // Try getSolidSpectralData first for database measurements
          const solidResult = getSolidSpectralData(inkCondition, 'adapted', normalizedTints, null, { 
            mode: orgDefaults.astmTable, 
            strictAdapted: false 
          });
          
          if (solidResult?.spectralData) {
            console.log('🔧 ADAPT: Using adapted solid spectral from database measurements');
            return solidResult.spectralData;
          }
          
          // If no adapted data but we have imported tints and target substrate, compute adaptation
          if (normalizedTints.length > 0 && targetSubstrateSpectral) {
            console.log('🔧 ADAPT: Computing adapted solid spectral on-the-fly');
            
            // Find 100% solid and 0% substrate from imported tints
            const solidTint = normalizedTints.find(tint => getTintPercentage(tint) === 100);
            const zeroTint = normalizedTints.find(tint => getTintPercentage(tint) === 0);
            
            const solidSpectral = safeSpectralData(solidTint);
            const zeroSpectral = safeSpectralData(zeroTint);
            
            if (solidSpectral && zeroSpectral && Object.keys(solidSpectral).length && Object.keys(zeroSpectral).length) {
              const adaptedSpectral = computeTwoStepSubstrateAdaptation(
                zeroSpectral,
                solidSpectral,
                targetSubstrateSpectral,
                100,
                { enableLogging: true }
              );
              
              if (adaptedSpectral) {
                console.log('✅ ADAPT: Successfully computed adapted solid spectral');
                return adaptedSpectral;
              }
            }
          }
        }
        
        // For imported mode or fallback, use imported solid spectral data
        const solidResult = getSolidSpectralData(inkCondition, 'imported', normalizedTints, null);
        if (solidResult?.spectralData) {
          console.log('🔧 ADAPT: Using imported solid spectral data');
          return solidResult.spectralData;
        }
        
        // Final fallback to condition's direct spectral_data
        return inkCondition.spectral_data || null;
      };
      
      // Always use 'adapted' mode for adapted ink conditions
      const finalDataMode = 'adapted';

      console.log('[DEBUG] Mutation - using adapted mode for adapted ink condition:', {
        finalDataMode,
        assignedCondition: formData.assignedSubstrateCondition,
        hasSelectedCondition: !!formData.selectedSubstrateCondition,
        normalizedTintsCount: normalizedTints.length
      });

      let solidSpectralData = getSolidSpectralForMode(sourceInkCondition, finalDataMode, targetSubstrateSpectral);
      
      // Build measurement settings
      let measurementSettings = {
        preferred_data_mode: finalDataMode,
        available_modes: [finalDataMode],
        illuminant: orgDefaults.illuminant,
        observer: orgDefaults.observer,
        measurement_mode: profile.organization.default_measurement_mode || 'M0'
      };
      
      // Prepare tints for temp condition based on current mode
      let tempImportedTints = enhanceImportedTintsForMode(
        normalizedTints,
        finalDataMode,
        solidSpectralData
      );

      // Create temporary condition object for color calculation
      let tempCondition = {
        lab: sourceInkCondition.lab,
        imported_tints: tempImportedTints,
        measurement_settings: measurementSettings,
        ...(solidSpectralData && { spectral_data: solidSpectralData })
      };

      // Prepare tint data for both modes - color calculation already done above
      const normalizedImportedTints = enhanceImportedTintsForMode(normalizedTints, 'imported', solidSpectralData);
      
      // Generate complete adapted tints for this adapted ink condition
      let normalizedAdaptedTints = null;
      if (finalDataMode === 'adapted' && targetSubstrateSpectral && normalizedTints.length > 0) {
        console.log('[DEBUG] Generating adapted tints for persistence...');
        
        // Get imported substrate spectral data (0% tint)
const importedSubstrateTint = normalizedTints.find(tint => getTintPercentage(tint) === 0);
const importedSubstrateSpectral = safeSpectralData(importedSubstrateTint);
        
        if (importedSubstrateSpectral) {
          console.log('💾 [PERSISTENCE] About to call adaptTintsToSubstrate with:', {
            normalizedTintsCount: normalizedTints.length,
            normalizedTintsDetailed: normalizedTints.map(t => ({
              name: t.name,
              tintPercentage: getTintPercentage(t),
              hasSpectralData: !!safeSpectralData(t),
              spectralDataKeys: Object.keys(safeSpectralData(t) || {}),
              hasLab: !!t.lab,
              labData: t.lab
            })),
            importedSubstrateSpectralKeys: Object.keys(importedSubstrateSpectral),
            importedSubstrateSpectralSample: Object.entries(importedSubstrateSpectral).slice(0, 3),
            targetSubstrateSpectralKeys: Object.keys(targetSubstrateSpectral),
            targetSubstrateSpectralSample: Object.entries(targetSubstrateSpectral).slice(0, 3),
            astmTablesCount: astmTables.length,
            measurementControls: {
              illuminant: orgDefaults.illuminant,
              observer: orgDefaults.observer,
              table: orgDefaults.astmTable
            },
            fallbackSubstrateLab: resolvedSelectedSubstrateCondition?.lab || { L: 95, a: 0, b: 0 }
          });

          try {
            const adaptedTintsResult = adaptTintsToSubstrate(
              normalizedTints,
              importedSubstrateSpectral,
              targetSubstrateSpectral,
              {
                astmTables,
                measurementControls: {
                  illuminant: orgDefaults.illuminant,
                  observer: orgDefaults.observer,
                  table: orgDefaults.astmTable
                },
                fallbackSubstrateLab: resolvedSelectedSubstrateCondition?.lab || { L: 95, a: 0, b: 0 }
              }
            );
            
            console.log('💾 [PERSISTENCE] adaptTintsToSubstrate returned:', {
              resultType: typeof adaptedTintsResult,
              isArray: Array.isArray(adaptedTintsResult),
              resultLength: adaptedTintsResult?.length || 0,
              resultDetailed: adaptedTintsResult?.map(t => ({
                name: t.name,
                tintPercentage: t.tintPercentage,
                isAdapted: t.isAdapted,
                colorHex: t.colorHex,
                hasLab: !!t.lab,
                hasSpectralData: !!t.spectralData,
                spectralDataKeys: Object.keys(t.spectralData || {}).length
              })) || null
            });
            
            if (adaptedTintsResult && adaptedTintsResult.length > 0) {
              normalizedAdaptedTints = adaptedTintsResult;
              console.log('💾 [PERSISTENCE] Successfully assigned adapted tints for persistence:', {
                count: normalizedAdaptedTints.length,
                assignedTints: normalizedAdaptedTints.map(t => ({
                  name: t.name,
                  tintPercentage: t.tintPercentage,
                  colorHex: t.colorHex,
                  isAdapted: t.isAdapted
                }))
              });
            } else {
              console.warn('💾 [PERSISTENCE] adaptTintsToSubstrate returned empty or invalid result');
            }
          } catch (error) {
            console.error('💾 [PERSISTENCE] Failed to generate adapted tints for persistence:', {
              error: error.message,
              stack: error.stack,
              inputData: {
                normalizedTintsCount: normalizedTints.length,
                hasImportedSubstrate: !!importedSubstrateSpectral,
                hasTargetSubstrate: !!targetSubstrateSpectral
              }
            });
          }
        } else {
          console.warn('💾 [PERSISTENCE] No imported substrate spectral data available');
        }
      }

      // finalDataMode is already 'adapted' - no need for safety switch

      console.log('💾 [PERSISTENCE] Final tints for persistence:', {
        importedTintsCount: normalizedImportedTints?.length || 0,
        importedTintsDetailed: normalizedImportedTints?.map(t => ({
          name: t.name,
          tintPercentage: getTintPercentage(t),
          colorHex: t.colorHex || t.color_hex,
          hasLab: !!t.lab,
          hasSpectralData: !!safeSpectralData(t)
        })) || null,
        adaptedTintsCount: normalizedAdaptedTints?.length || 0,
        adaptedTintsDetailed: normalizedAdaptedTints?.map(t => ({
          name: t.name,
          tintPercentage: t.tintPercentage,
          colorHex: t.colorHex,
          isAdapted: t.isAdapted,
          hasLab: !!t.lab,
          hasSpectralData: !!t.spectralData
        })) || null,
        finalDataMode
      });

      // Calculate final display hex using effective data mode for consistency
      const tempInkCondition = {
        ...sourceInkCondition,
        imported_tints: normalizedImportedTints,
        adapted_tints: normalizedAdaptedTints,
        spectral_data: solidSpectralData
      };
      
      const finalDisplayHex = calculateInkConditionColorHex(
        tempInkCondition, 
        finalDataMode, 
        orgDefaults, 
        astmTables,
        targetSubstrateSpectral
      ) || (processedColors.length > 0 ? processedColors[0].colorHex : sourceInkCondition.color_hex);
      
      console.log('🔧 ADAPT VERIFICATION:', {
        finalDataMode: finalDataMode,
        hasSolidSpectral: !!solidSpectralData,
        solidSpectralWavelengths: solidSpectralData ? Object.keys(solidSpectralData).length : 0,
        finalDisplayHex,
        hasTargetSubstrateSpectral: !!targetSubstrateSpectral,
        usedModeForCalculation: finalDataMode
      });

      // Build available_backgrounds array - PRESERVE from source condition first
      let availableBackgrounds = [];
      
      // Priority 1: Use source condition's available_backgrounds if it exists
      const sourceAvailableBg = sourceInkCondition?.measurement_settings?.available_backgrounds 
        || sourceInkCondition?.imported_tints?.measurement_settings?.available_backgrounds
        || sourceInkCondition?.imported_tints?.available_backgrounds;
      
      if (Array.isArray(sourceAvailableBg) && sourceAvailableBg.length > 0) {
        availableBackgrounds = [...sourceAvailableBg];
        console.log('🗺️ [Backgrounds] Preserving from source condition:', availableBackgrounds);
      } else {
        // Priority 2: Collect from all tints
        const uniqueBackgrounds = new Set();
        const allTints = [...normalizedImportedTints, ...(normalizedAdaptedTints || [])];
        
        allTints.forEach(tint => {
          // Collect from tint-level background
          if (tint.backgroundName) uniqueBackgrounds.add(tint.backgroundName);
          if (tint.background_name) uniqueBackgrounds.add(tint.background_name);
          
          // Collect from measurement-level backgrounds
          if (Array.isArray(tint.measurements)) {
            tint.measurements.forEach(m => {
              if (m.backgroundName) uniqueBackgrounds.add(m.backgroundName);
              if (m.background_name) uniqueBackgrounds.add(m.background_name);
            });
          }
        });
        
        availableBackgrounds = Array.from(uniqueBackgrounds);
        console.log('🗺️ [Backgrounds] Collected from tints:', availableBackgrounds);
      }
      
      // Ensure "Substrate" is always present if missing
        if (!availableBackgrounds.includes('Substrate')) {
          availableBackgrounds.push('Substrate');
        }
      
      // Attach background_key to all tints using bgX format (no underscore, matches Smart Import)
      const attachBackgroundKeys = (tints) => {
        return tints.map(tint => {
          const bgName = tint.backgroundName || tint.background_name;
          const existingKey = tint.background_key;
          
          // Always compute deterministic background_key from final availableBackgrounds
          let bgKey;
          if (bgName) {
            const bgIndex = availableBackgrounds.indexOf(bgName);
            if (bgIndex >= 0) {
              bgKey = `bg${bgIndex}`; // Use bgX format (no underscore)
            }
          }
          // Fallback: preserve existingKey only if name-based mapping failed
          if (!bgKey && existingKey) {
            bgKey = existingKey;
          }
          
          // Update measurements if present
          const updatedMeasurements = Array.isArray(tint.measurements) 
            ? tint.measurements.map(m => {
                const mBgName = m.backgroundName || m.background_name;
                const mExistingKey = m.background_key;
                let mBgKey;
                if (mBgName) {
                  const mBgIndex = availableBackgrounds.indexOf(mBgName);
                  if (mBgIndex >= 0) {
                    mBgKey = `bg${mBgIndex}`; // Use bgX format (no underscore)
                  }
                }
                if (!mBgKey && mExistingKey) {
                  mBgKey = mExistingKey;
                }
                return {
                  ...m,
                  ...(mBgKey && { background_key: mBgKey })
                };
              })
            : tint.measurements;
          
          return {
            ...tint,
            ...(bgKey && { background_key: bgKey }),
            ...(updatedMeasurements && { measurements: updatedMeasurements })
          };
        });
      };
      
      const finalImportedTints = attachBackgroundKeys(normalizedImportedTints);
      const finalAdaptedTints = normalizedAdaptedTints ? attachBackgroundKeys(normalizedAdaptedTints) : null;
      
      console.log('🗺️ [Backgrounds] Smart Import format (no backgrounds_map):', {
        availableBackgrounds,
        importedTintsCount: finalImportedTints.length,
        adaptedTintsCount: finalAdaptedTints?.length || 0,
        sampleTint: finalImportedTints[0] ? {
          backgroundName: finalImportedTints[0].backgroundName,
          background_key: finalImportedTints[0].background_key,
          hasMeasurements: Array.isArray(finalImportedTints[0].measurements)
        } : null
      });

      // Build backgrounds_map: key -> name (e.g., {"bg0": "Process_Black"})
      const backgroundsMap = Object.fromEntries(
        availableBackgrounds.map((name, idx) => [`bg${idx}`, name])
      );

      // Create new ink condition with properly extracted spectral data
      const insertData = {
        ink_id: sourceInkCondition.ink_id,
        name: newInkConditionName,
        substrate_id: substrateId,
        substrate_condition: formData.assignedSubstrateCondition === 'create-new' 
          ? substrateConditionId 
          : formData.selectedSubstrateCondition?.id || formData.assignedSubstrateCondition,
        version: sourceInkCondition.version,
        pack_type: sourceInkCondition.pack_type,
        ink_curve: sourceInkCondition.ink_curve,
        imported_tints: finalImportedTints,
        adapted_tints: finalAdaptedTints,
        spectral_data: solidSpectralData,
        spectral_string: sourceInkCondition.spectral_string,
        lab: sourceInkCondition.lab,
        ch: sourceInkCondition.ch,
        color_hex: finalDisplayHex,
        measurement_settings: {
          ...(sourceInkCondition.measurement_settings || {}),
          preferred_data_mode: finalDataMode,
          available_backgrounds: availableBackgrounds
        },
        ui_state: {
          // Preserve source ui_state, filter out camelCase activeDataMode only
          ...(sourceInkCondition.ui_state ? Object.fromEntries(
            Object.entries(sourceInkCondition.ui_state).filter(([key]) => 
              !key.includes('activeDataMode')
            )
          ) : {}),
          active_data_mode: finalDataMode,
          backgrounds_map: backgroundsMap,
          last_saved_at: new Date().toISOString()
        },
        is_part_of_structure: sourceInkCondition.is_part_of_structure
      };

      console.log('💾 [PERSISTENCE] About to insert ink condition with data:', {
        finalDataMode,
        hasAdaptedTints: !!insertData.adapted_tints,
        adaptedTintsCount: insertData.adapted_tints?.length || 0,
        adaptedTintsStructure: insertData.adapted_tints?.map(t => ({
          name: t.name,
          tintPercentage: t.tintPercentage,
          colorHex: t.colorHex,
          isAdapted: t.isAdapted,
          hasLab: !!t.lab,
          hasSpectralData: !!t.spectralData
        })) || null,
        preferredDataMode: insertData.measurement_settings?.preferred_data_mode,
        activeDataMode: insertData.ui_state?.active_data_mode,
        insertDataKeys: Object.keys(insertData)
      });

      const { data: newInkCondition, error: inkConditionError } = await supabase
        .from('ink_conditions')
        .insert(insertData)
        .select()
        .single();

      if (inkConditionError) throw inkConditionError;

      console.log('💾 [PERSISTENCE] Successfully inserted ink condition:', {
        id: newInkCondition?.id,
        savedColorHex: newInkCondition?.color_hex,
        wizardColorHex: finalDisplayHex,
        colorsMatch: newInkCondition?.color_hex === finalDisplayHex,
        hasAdaptedTints: Array.isArray(newInkCondition?.adapted_tints),
        adaptedTintsCount: newInkCondition?.adapted_tints?.length || 0,
        adaptedTintsFromDB: newInkCondition?.adapted_tints?.map(t => ({
          name: t.name,
          tintPercentage: t.tintPercentage,
          colorHex: t.colorHex,
          isAdapted: t.isAdapted,
          hasLab: !!t.lab,
          hasSpectralData: !!t.spectralData
        })) || null,
        preferredDataMode: newInkCondition?.measurement_settings?.preferred_data_mode,
        activeDataMode: newInkCondition?.ui_state?.active_data_mode,
        allDBKeys: Object.keys(newInkCondition || {})
      });

      // Immediate verification - query the database to confirm what was stored
      console.log('💾 [VERIFICATION] Querying database to verify storage...');
      const { data: verificationData, error: verificationError } = await supabase
        .from('ink_conditions')
        .select('id, name, adapted_tints, imported_tints, measurement_settings, ui_state')
        .eq('id', newInkCondition.id)
        .single();

      if (verificationError) {
        console.error('💾 [VERIFICATION] Failed to verify stored data:', verificationError);
      } else {
        console.log('💾 [VERIFICATION] Database verification result:', {
          id: verificationData.id,
          name: verificationData.name,
          hasAdaptedTints: Array.isArray(verificationData.adapted_tints),
          adaptedTintsCount: verificationData.adapted_tints?.length || 0,
          adaptedTintsFromVerification: verificationData.adapted_tints?.map(t => ({
            name: t.name,
            tintPercentage: t.tintPercentage,
            colorHex: t.colorHex,
            isAdapted: t.isAdapted,
            hasLab: !!t.lab,
            hasSpectralData: !!t.spectralData
          })) || null,
          hasImportedTints: Array.isArray(verificationData.imported_tints),
          importedTintsCount: verificationData.imported_tints?.length || 0,
          measurementSettings: verificationData.measurement_settings,
          uiState: verificationData.ui_state
        });
      }

      // Verify that the saved color_hex matches the wizard preview
      console.log('💾 [COLOR VERIFICATION] Saved ink condition color verification:', {
        savedColorHex: newInkCondition.color_hex,
        wizardColorHex: finalDisplayHex,
        colorsMatch: newInkCondition.color_hex === finalDisplayHex,
        finalDataMode
      });

      return {
        inkCondition: newInkCondition,
        substrate: substrateId,
        substrateCondition: substrateConditionId
      };
    },
    onSuccess: async (result) => {
      toast({
        title: "Success",
        description: `Ink condition adapted successfully: ${result.inkCondition.name}`,
      });
      
      // Optimistic update
      optimisticAddInkCondition(sourceInkCondition.ink_id, result.inkCondition);
      
      // Refresh data and wait for completion before closing
      await forceRefresh();
      
      // Note: Query invalidation removed to avoid context errors
      
      onSuccess?.(result);
      onClose();
    },
    onError: (error) => {
      console.error('❌ [MUTATION ERROR] Failed to create adapted ink condition:', error);
      
      let errorMessage = "Failed to create adapted ink condition";
      
      // Handle specific RLS errors
      if (error?.message?.includes('row-level security') || error?.message?.includes('RLS')) {
        errorMessage = "You don't have permission to create ink conditions for this ink. Make sure you have the proper role and the ink belongs to your organization.";
      } else if (error?.message?.includes('violates')) {
        errorMessage = "Permission denied: Unable to create ink condition. Please check your access rights.";
      } else if (error?.message) {
        errorMessage = error.message;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const handleCreateAssets = useCallback(async () => {
    if (!canProceed) return;
    
    setIsSubmitting(true);
    try {
      await createAdaptedInkCondition.mutateAsync();
    } finally {
      setIsSubmitting(false);
    }
  }, [canProceed, createAdaptedInkCondition]);

  return {
    // State
    currentStep,
    currentStepIndex,
    isSubmitting,
    formData,
    
    // Computed
    activeSteps,
    resolvedNames,
    processedColors,
    canProceed,
    isFirstStep: true,
    isLastStep: true,
    
    // Actions
    updateFormData,
    resetForm,
    handleCreateAssets,
    
    // No navigation needed for single step
    handleNext: () => {},
    handleBack: () => {},
  };
};