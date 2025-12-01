import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/context/ProfileContext';

import { toast } from 'react-hot-toast';
import { generateInkConditionName } from '@/lib/inkConditionNaming';
import { adaptTintsToSubstrate } from '@/lib/colorUtils/tintAdaptation';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { calculateInkConditionColorHex } from '@/lib/colorUtils/inkConditionColorHex';
import { normalizeTints, getTintPercentage, safeSpectralData } from '@/lib/tintsUtils';
import { computeDefaultDisplayColor, isValidDisplayColor } from '@/lib/colorUtils';
import { getEffectiveDataMode } from '@/lib/substrateAdaptationUtils';
import { calculateInkSubstrateDeltaE, determinePreferredDataMode } from '@/lib/inkSubstrateAdaptation';

const allSteps = [
  { id: 1, name: 'Select Target & Create' },
];

/**
 * Extract and normalize tints from ink condition data
 */
const extractNormalizedTints = (inkCondition) => {
  if (!inkCondition?.imported_tints) {
    console.warn('[AdaptWizard] extractNormalizedTints: No imported_tints on sourceInkCondition');
    return [];
  }
  
  console.info('[AdaptWizard] extractNormalizedTints: imported_tints type:', typeof inkCondition.imported_tints,
    Array.isArray(inkCondition.imported_tints) ? { length: inkCondition.imported_tints.length } :
    (typeof inkCondition.imported_tints === 'object' ? { keys: Object.keys(inkCondition.imported_tints).slice(0, 10) } : null)
  );
  
  let rawTints = inkCondition.imported_tints;
  
  // Handle different imported_tints formats
  if (typeof rawTints === 'object' && !Array.isArray(rawTints)) {
    if (Array.isArray(rawTints.tints)) {
      rawTints = rawTints.tints;
    } else if (Object.keys(rawTints).some(key => !isNaN(parseInt(key)))) {
      rawTints = Object.values(rawTints);
    }
  }
  
  const baseTints = normalizeTints(rawTints);
  console.info('[AdaptWizard] extractNormalizedTints: baseTints count:', baseTints?.length || 0);
  const src = inkCondition.imported_tints;

  // Gather backgrounds list
  let backgroundsList = null;
  if (Array.isArray(src?.measurement_settings?.available_backgrounds)) {
    backgroundsList = src.measurement_settings.available_backgrounds;
  } else if (Array.isArray(src?.available_backgrounds)) {
    backgroundsList = src.available_backgrounds;
  }
  
  return baseTints.map((t) => {
    let backgroundName = t.backgroundName || t.background_name || null;
    
    const idx = t.backgroundIndex ?? t.background_index;
    if (!backgroundName && backgroundsList && idx != null && !isNaN(idx)) {
      const nameFromIndex = backgroundsList[idx];
      if (nameFromIndex) backgroundName = nameFromIndex;
    }

    const tintPct = getTintPercentage(t);
    if (!backgroundName && tintPct === 0) {
      backgroundName = 'Substrate';
    }
    
    // Generate stable ID if one doesn't exist
    const stableId = t.id || `tint-${tintPct}-${backgroundName || 'Substrate'}`;
    
    return {
      ...t,
      id: stableId,
      backgroundName: backgroundName,
      tintPercentage: tintPct
    };
  });
};

const useAdaptInkWizardV2 = (isOpen, sourceInkCondition) => {
  const { profile } = useProfile();
  const queryClient = (typeof window !== 'undefined' && window.queryClient) ? window.queryClient : null;
  const { astmTables } = useAstmTablesCache();
  const [sourceSubstrateCondition, setSourceSubstrateCondition] = useState(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({});

  const activeSteps = allSteps;

  // Initialize form data when wizard opens
  useEffect(() => {
    if (isOpen && sourceInkCondition) {
      setFormData({
        sourceInkConditionId: sourceInkCondition.id,
        inkName: sourceInkCondition.inks?.name || '',
        inkId: sourceInkCondition.ink_id,
        assignedSubstrate: null,
        assignedSubstrateCondition: null,
        inkConditionName: '',
        version: String(Number.parseInt(sourceInkCondition.version || 0) + 1),
        selectedBackground: 'Substrate',
      });
      setCurrentStep(1);
    }
  }, [isOpen, sourceInkCondition]);

  const updateFormData = useCallback((updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const canProceed = useMemo(() => {
    return formData.assignedSubstrate && formData.assignedSubstrateCondition;
  }, [formData]);

  const handleNext = useCallback(() => {
    if (canProceed && currentStep < activeSteps.length) {
      setCurrentStep(prev => prev + 1);
    }
  }, [canProceed, currentStep, activeSteps.length]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const resetForm = useCallback(() => {
    setFormData({});
    setCurrentStep(1);
  }, []);

  const handleCreateAssets = useCallback(async () => {
    if (!profile?.organization_id || !sourceInkCondition) {
      toast.error('Missing required data');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // 1. Get or create substrate condition
      let targetSubstrateConditionId = formData.assignedSubstrateCondition;
      
      if (formData.assignedSubstrateCondition === 'create-new') {
        // Create new substrate condition if needed
        const { data: newCondition, error: conditionError } = await supabase
          .from('substrate_conditions')
          .insert({
            substrate_id: formData.selectedSubstrateCondition?.substrate_id,
            name: formData.selectedSubstrateCondition?.name || 'New Condition',
            organization_id: profile.organization_id,
            spectral_data: formData.selectedSubstrateCondition?.spectral_data,
            color_hex: formData.selectedSubstrateCondition?.color_hex,
          })
          .select()
          .single();

        if (conditionError) throw conditionError;
        targetSubstrateConditionId = newCondition.id;
      }

      // 2. Fetch full substrate condition with spectral data
      if (!targetSubstrateConditionId || targetSubstrateConditionId === 'create-new') {
        throw new Error('Please select a valid substrate condition');
      }
      const { data: targetCondition, error: fetchError } = await supabase
        .from('substrate_conditions')
        .select('*')
        .eq('id', targetSubstrateConditionId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!targetCondition) throw new Error('Target substrate condition not found');

      // Source substrate condition fetch removed - we use the 0% tint from imported_tints instead

      // 3. Extract source tints from ink condition's JSONB data
      // The tints are stored in the imported_tints JSONB column, not in a separate table
      let sourceTints = [];
      
      if (sourceInkCondition.imported_tints) {
        // Handle different formats of imported_tints
        if (Array.isArray(sourceInkCondition.imported_tints)) {
          sourceTints = sourceInkCondition.imported_tints;
        } else if (sourceInkCondition.imported_tints.tints && Array.isArray(sourceInkCondition.imported_tints.tints)) {
          sourceTints = sourceInkCondition.imported_tints.tints;
        } else if (typeof sourceInkCondition.imported_tints === 'object') {
          // Convert object to array if needed
          sourceTints = Object.values(sourceInkCondition.imported_tints).filter(item => 
            typeof item === 'object' && (item.percentage !== undefined || item.tint_percentage !== undefined)
          );
        }
      }
      
      console.info('[AdaptWizardV2] Extracted source tints (ORIGINAL METHOD):', {
        count: sourceTints.length,
        tints: sourceTints.map(t => ({
          percentage: t.percentage ?? t.tint_percentage,
          background: t.background_name ?? t.backgroundName,
          hasSpectralData: !!t.spectral_data,
          hasMeasurements: !!t.measurements
        }))
      });
      
      if (!sourceTints || sourceTints.length === 0) {
        throw new Error('No tints found in source ink condition');
      }
      
      // Sort tints by percentage
      sourceTints = sourceTints.sort((a, b) => {
        const aPercent = a.percentage ?? a.tint_percentage ?? 0;
        const bPercent = b.percentage ?? b.tint_percentage ?? 0;
        return aPercent - bPercent;
      });

      // 4. Build background-to-spectral map from imported_tints 0% tint
      const importedSubstrateSpectralByBackground = {};

      // Extract substrate spectral from the 0% tint in imported_tints
      const substrateTint = sourceTints.find(t => {
        const pct = t.percentage ?? t.tint_percentage ?? getTintPercentage(t);
        return pct === 0;
      });

      const substrateSpectral = safeSpectralData(substrateTint);
      if (!substrateSpectral || Object.keys(substrateSpectral).length === 0) {
        throw new Error('No 0% tint with spectral data found in imported_tints. Cannot perform adaptation.');
      }

      importedSubstrateSpectralByBackground['Substrate'] = substrateSpectral;
      console.log('🔧 Using 0% tint spectral data from imported_tints for "Substrate" background');

      // Check if ink has multi-background measurements (e.g., Process Grey)
      // In this case, we look for additional substrate spectral from the tints
      if (Array.isArray(sourceTints)) {
        const uniqueBackgrounds = new Set();
        sourceTints.forEach(tint => {
          const bg = tint.backgroundName || tint.background_name || tint.background;
          if (bg && bg !== 'Substrate') {
            uniqueBackgrounds.add(bg);
          }
        });
        
        // For non-Substrate backgrounds, try to find substrate spectral from 0% tints
        uniqueBackgrounds.forEach(bgName => {
          const substrateTint = sourceTints.find(t => {
            const tintPct = t.percentage ?? t.tint_percentage ?? 0;
            const tintBg = t.backgroundName || t.background_name || t.background;
            return tintPct === 0 && tintBg === bgName;
          });
          
          if (substrateTint) {
            const spectralData = safeSpectralData(substrateTint);
            if (spectralData && Object.keys(spectralData).length > 0) {
              importedSubstrateSpectralByBackground[bgName] = spectralData;
              console.log(`🔧 Using substrate spectral for background: ${bgName}`);
            }
          }
        });
      }

      // Validate we have at least the primary substrate
      if (!importedSubstrateSpectralByBackground['Substrate']) {
        throw new Error('Missing substrate spectral data for adaptation');
      }

      console.log('🔧 Built substrate spectral map:', Object.keys(importedSubstrateSpectralByBackground));

      // 5. Calculate substrate Delta E to determine if adaptation is needed
      const orgDefaults = {
        default_illuminant: profile.organization?.default_illuminant || 'D50',
        default_observer: profile.organization?.default_observer || '2',
        default_astm_table: profile.organization?.default_astm_table || '5',
      };

      let substratesDeltaE = null;
      let shouldAdapt = false;

      try {
        substratesDeltaE = calculateInkSubstrateDeltaE(
          sourceTints,
          targetCondition.spectral_data,
          astmTables,
          orgDefaults
        );
        
        shouldAdapt = substratesDeltaE > 1.0; // Threshold from determinePreferredDataMode
        
        console.info('[AdaptWizardV2] Substrate Delta E analysis:', {
          deltaE: substratesDeltaE,
          shouldAdapt,
          threshold: 1.0
        });
      } catch (error) {
        console.warn('[AdaptWizardV2] Failed to calculate Delta E, defaulting to adaptation:', error);
        shouldAdapt = true; // Safe default: adapt if we can't calculate
      }

      // 6. Conditionally adapt tints to new substrate
      let adaptedTints = null;
      const measurementSettings = sourceInkCondition.measurement_settings || {};

      if (shouldAdapt) {
        console.info('[AdaptWizardV2] ΔE > 1.0 - performing substrate adaptation');
        console.info('[AdaptWizardV2] Starting adaptation with:', {
          sourceTintsCount: sourceTints.length,
          targetSubstrateId: targetCondition.id,
          backgroundsAvailable: Object.keys(importedSubstrateSpectralByBackground),
          measurementSettings,
          sampleTint: sourceTints[0] ? {
            percentage: sourceTints[0].percentage ?? sourceTints[0].tint_percentage,
            hasSpectral: !!sourceTints[0].spectral_data,
            spectralWavelengths: sourceTints[0].spectral_data ? Object.keys(sourceTints[0].spectral_data).length : 0
          } : null,
          sampleSubstrateSpectral: Object.keys(importedSubstrateSpectralByBackground)[0] 
            ? Object.keys(importedSubstrateSpectralByBackground[Object.keys(importedSubstrateSpectralByBackground)[0]]).length 
            : 0,
          targetSubstrateSpectralWavelengths: Object.keys(targetCondition.spectral_data || {}).length
        });
        
        adaptedTints = adaptTintsToSubstrate(
          sourceTints,
          importedSubstrateSpectralByBackground,
          targetCondition.spectral_data,
          { 
            astmTables,
            selectedMode: measurementSettings.mode || measurementSettings.measurement_mode || 'M0',
            measurementControls: {
              mode: measurementSettings.mode || measurementSettings.measurement_mode || 'M0',
              illuminant: measurementSettings.illuminant || profile.organization?.default_illuminant || 'D50',
              observer: measurementSettings.observer || profile.organization?.default_observer || '2',
              table: measurementSettings.table || profile.organization?.default_astm_table || '5'
            }
          }
        );
        
        console.info('[AdaptWizardV2] Adaptation complete:', {
          adaptedTintsCount: adaptedTints?.length ?? 0,
          sampleAdaptedTint: adaptedTints?.[0] ? {
            percentage: adaptedTints[0].percentage ?? adaptedTints[0].tint_percentage,
            hasSpectral: !!adaptedTints[0].spectral_data,
            spectralWavelengths: adaptedTints[0].spectral_data ? Object.keys(adaptedTints[0].spectral_data).length : 0,
            isDifferentFromImported: JSON.stringify(adaptedTints[0].spectral_data) !== JSON.stringify(sourceTints[0]?.spectral_data)
          } : null
        });
      } else {
        console.info('[AdaptWizardV2] ΔE ≤ 1.0 - skipping adaptation, substrates are similar enough');
      }

      // 7. Create new ink condition
      const effectiveDataMode = shouldAdapt ? 'adapted' : 'imported';

      const colorHex = calculateInkConditionColorHex(
        { 
          ...sourceInkCondition, 
          adapted_tints: adaptedTints,
          imported_tints: sourceTints
        },
        effectiveDataMode,
        orgDefaults,
        astmTables
      );

      // Auto-generate ink condition name
      const autoGeneratedName = generateInkConditionName({
        substrateName: formData.assignedSubstrate,
        substrateConditionName: targetCondition.name,
        inkCurve: sourceInkCondition.ink_curve,
        version: formData.version,
      });

      // Direct save approach (matches smart import wizard)
      const { data: newInkCondition, error: inkError } = await supabase
        .from('ink_conditions')
        .insert({
          ink_id: sourceInkCondition.ink_id,
          substrate_id: targetCondition.substrate_id,
          substrate_condition: targetCondition.id,
          name: autoGeneratedName,
          version: formData.version,
          ink_curve: sourceInkCondition.ink_curve,
          color_hex: colorHex,
          measurement_settings: {
            ...sourceInkCondition.measurement_settings,
            preferred_data_mode: effectiveDataMode
          },
          imported_tints: sourceTints,
          adapted_tints: adaptedTints,
          ui_state: { 
            active_data_mode: effectiveDataMode,
            last_saved_at: new Date().toISOString(),
            substrate_delta_e: substratesDeltaE
          },
        })
        .select()
        .single();

      if (inkError) throw inkError;

      // 7. Invalidate queries
      queryClient?.invalidateQueries({ queryKey: ['ink_conditions'] });
      queryClient?.invalidateQueries({ queryKey: ['inks'] });

      toast.success('Ink condition adapted successfully');
      resetForm();
      return true;
    } catch (error) {
      console.error('Failed to create adapted ink condition:', error);
      toast.error(error.message || 'Failed to adapt ink condition');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, sourceInkCondition, profile, astmTables, queryClient, resetForm]);

  // Fetch selected substrate condition when ID changes
  const [fetchedSubstrateCondition, setFetchedSubstrateCondition] = useState(null);
  useEffect(() => {
    const fetchCondition = async () => {
      if (!formData.assignedSubstrateCondition || formData.assignedSubstrateCondition === 'create-new') {
        setFetchedSubstrateCondition(null);
        return;
      }

      try {
        const { data } = await supabase
          .from('substrate_conditions')
          .select('*')
          .eq('id', formData.assignedSubstrateCondition)
          .maybeSingle();
        
        setFetchedSubstrateCondition(data);
      } catch (error) {
        console.error('Failed to fetch substrate condition:', error);
        setFetchedSubstrateCondition(null);
      }
    };

    fetchCondition();
  }, [formData.assignedSubstrateCondition]);

  // Process source ink condition colors for display
  const processedColors = useMemo(() => {
    if (!sourceInkCondition || !profile?.organization) {
      return [];
    }

    const orgDefaults = {
      illuminant: profile.organization.default_illuminant || 'D50',
      observer: profile.organization.default_observer || '2',
      astmTable: profile.organization.default_astm_table || '5',
      default_illuminant: profile.organization.default_illuminant || 'D50',
      default_observer: profile.organization.default_observer || '2',
      default_astm_table: profile.organization.default_astm_table || '5'
    };

    try {
      const baseTints = extractNormalizedTints(sourceInkCondition);
      console.info('[AdaptWizard] processedColors: baseTints count', { count: baseTints?.length || 0 });
      const normalizedTints = baseTints.map(tint => {
        let enhancedTint = { ...tint };
        
        if (!enhancedTint.backgroundName && enhancedTint.background_name) {
          enhancedTint.backgroundName = enhancedTint.background_name;
        }
        if (!enhancedTint.spectral_data && enhancedTint.spectralData) {
          enhancedTint.spectral_data = enhancedTint.spectralData;
        }
        
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

      // Fallback: synthesize minimal tints if none present (0% substrate + 100% solid)
      let effectiveTints = normalizedTints;
      if (!effectiveTints?.length) {
        let displayHex = sourceInkCondition.color_hex;
        if ((!displayHex || !isValidDisplayColor(displayHex)) && sourceInkCondition.spectral_data && astmTables?.length) {
          try {
            const result = computeDefaultDisplayColor(
              { spectral_data: sourceInkCondition.spectral_data },
              orgDefaults,
              astmTables
            );
            displayHex = result?.hex;
          } catch (e) {
            console.warn('[AdaptWizard] Fallback displayHex computation failed:', e);
          }
        }
        if (!displayHex || !isValidDisplayColor(displayHex)) displayHex = '#808080';

        effectiveTints = [
          { id: 'tint-0-Substrate', tintPercentage: 0, backgroundName: 'Substrate', colorHex: '#FFFFFF' },
          { id: 'tint-100-Substrate', tintPercentage: 100, backgroundName: 'Substrate', colorHex: displayHex }
        ];
        console.info('[AdaptWizard] Using fallback tints (no imported_tints found)');
      }
      
      const substrateTints = effectiveTints.filter(t => {
        const bg = t.backgroundName || t.background_name || 'Substrate';
        return bg === 'Substrate';
      });

      const overBlackTints = effectiveTints.filter(t => {
        const bg = t.backgroundName || t.background_name;
        return bg && bg !== 'Substrate';
      });
      console.info('[AdaptWizard] processedColors: grouped tints', { substrate: substrateTints.length, overBlack: overBlackTints.length });

      // Group tints by background for proper display in SelectSubstrateStep
      const tintsByBackground = effectiveTints.reduce((acc, tint) => {
        const bgName = tint.backgroundName || tint.background_name || 'Substrate';
        if (!acc[bgName]) {
          acc[bgName] = [];
        }
        acc[bgName].push(tint);
        return acc;
      }, {});

      console.info('[AdaptWizard] Grouped tints by background:', {
        backgrounds: Object.keys(tintsByBackground),
        counts: Object.fromEntries(
          Object.entries(tintsByBackground).map(([bg, tints]) => [bg, tints.length])
        )
      });

      const availableBackgroundsSet = new Set(
        effectiveTints
          .map(t => t.backgroundName || t.background_name || 'Substrate')
          .filter(Boolean)
      );
      if (availableBackgroundsSet.size === 0) availableBackgroundsSet.add('Substrate');

      const solidTint = substrateTints.find(t => getTintPercentage(t) === 100);
      let displayHex = solidTint?.colorHex || sourceInkCondition.color_hex;
      
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

      if (!displayHex || !isValidDisplayColor(displayHex)) {
        displayHex = '#808080';
      }

      // CRITICAL: Adapt wizard ALWAYS starts from imported data, never adapted
      // This ensures users can create a fresh adaptation to any substrate
      const effectiveDataMode = 'imported';

      console.info('[AdaptWizard] processedColors: summary', { displayHex, effectiveDataMode, backgrounds: Array.from(availableBackgroundsSet) });

      let adaptedTints = null;
      if (effectiveDataMode === 'adapted' && 
          formData.assignedSubstrateCondition !== 'create-new' && 
          fetchedSubstrateCondition?.spectral_data &&
          astmTables?.length &&
          sourceSubstrateCondition?.spectral_data) {
        
        // Build background-to-spectral map for preview using fetched substrate condition
        const importedSubstrateSpectralByBackground = {};

        // Use the source substrate condition's spectral data for the primary substrate
        if (sourceSubstrateCondition?.spectral_data) {
          importedSubstrateSpectralByBackground['Substrate'] = sourceSubstrateCondition.spectral_data;
        }

        // Handle multi-background scenarios (e.g., Process Grey)
        effectiveTints.forEach(tint => {
          const tintPct = getTintPercentage(tint);
          const bgName = tint.backgroundName || tint.background_name || tint.background;
          
          if (tintPct === 0 && bgName && bgName !== 'Substrate') {
            const spectralData = safeSpectralData(tint);
            if (spectralData && Object.keys(spectralData).length > 0) {
              importedSubstrateSpectralByBackground[bgName] = spectralData;
            }
          }
        });
        
        if (Object.keys(importedSubstrateSpectralByBackground).length > 0) {
          try {
            adaptedTints = adaptTintsToSubstrate(
              effectiveTints,
              importedSubstrateSpectralByBackground,
              fetchedSubstrateCondition.spectral_data,
              {
                astmTables,
                measurementControls: {
                  illuminant: orgDefaults.illuminant,
                  observer: orgDefaults.observer,
                  table: orgDefaults.astmTable
                },
                fallbackSubstrateLab: fetchedSubstrateCondition.lab || { L: 95, a: 0, b: 0 }
              }
            );
            
            if (adaptedTints?.length) {
              const solidAdaptedTint = adaptedTints.find(tint => getTintPercentage(tint) >= 99);
              const spectral = solidAdaptedTint?.spectral_data || safeSpectralData(solidAdaptedTint);
              if (spectral && astmTables?.length) {
                try {
                  const result = computeDefaultDisplayColor(
                    { spectral_data: spectral },
                    orgDefaults,
                    astmTables
                  );
                  const hex = result?.hex;
                  if (hex && isValidDisplayColor(hex)) {
                    displayHex = hex;
                  }
                } catch (e) {
                  console.warn('Failed to compute display color from adapted spectral:', e);
                }
              }
            }
          } catch (error) {
            console.error('Failed to generate adapted tints:', error);
          }
        }
      }

      return [{
        id: sourceInkCondition.id,
        name: sourceInkCondition.name,
        hex: displayHex,
        colorHex: displayHex,
        displayHex: displayHex,
        lab: sourceInkCondition.lab,
        spectral_data: sourceInkCondition.spectral_data,
        tintsByBackground: tintsByBackground,  // NEW: Proper format for SelectSubstrateStep
        substrateTints: substrateTints,        // KEEP: Backward compatibility
        overBlackTints: overBlackTints,        // KEEP: Backward compatibility
        adaptedTints: adaptedTints,
        effectiveDataMode: effectiveDataMode,
        availableBackgrounds: Array.from(availableBackgroundsSet),
        activeDataMode: formData.activeDataMode || 'imported',
      }];
    } catch (error) {
      console.error('Failed to process colors:', error);
      return [];
    }
  }, [sourceInkCondition, profile, astmTables, fetchedSubstrateCondition, formData.assignedSubstrateCondition, formData.activeDataMode]);

  // Generate resolved names
  const resolvedNames = useMemo(() => {
    if (!formData.assignedSubstrate || !formData.assignedSubstrateCondition) {
      return { inkConditionName: '', substrateName: '', substrateConditionName: '' };
    }

    const substrateName = formData.assignedSubstrate;
    const substrateConditionName = formData.selectedSubstrateCondition?.name || '';

    const inkConditionName = formData.inkConditionName || generateInkConditionName({
      substrateName,
      substrateConditionName,
      inkCurve: sourceInkCondition?.ink_curve,
      version: formData.version,
    });

    return {
      inkConditionName,
      substrateName,
      substrateConditionName,
    };
  }, [formData, sourceInkCondition]);

  return {
    currentStep,
    formData,
    updateFormData,
    activeSteps,
    canProceed,
    handleNext,
    handleBack,
    resetForm,
    handleCreateAssets,
    isSubmitting,
    resolvedNames,
    processedColors,
  };
};

export default useAdaptInkWizardV2;
