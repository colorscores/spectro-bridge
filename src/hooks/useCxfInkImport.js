import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';
import { useInksData } from '@/context/InkContext';
import { labToHex, extractSpectralData, computeDefaultDisplayColor, spectralToLabASTME308 } from '@/lib/colorUtils';
import { calculateInkConditionColorHex } from '@/lib/colorUtils/inkConditionColorHex';

import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { debug } from '@/lib/debugUtils';

/**
 * Detect if this is a single color CxF3 import (no tint characterization)
 * @param {Object} colorData - CxF color object
 * @returns {boolean} - True if this is a single color import
 */
export const isSingleColorImport = (colorData) => {
  // Collect all tint arrays from various sources
  const allTintArrays = [];
  
  // Direct tint arrays
  if (Array.isArray(colorData.substrateTints)) allTintArrays.push(colorData.substrateTints);
  if (Array.isArray(colorData.overBlackTints)) allTintArrays.push(colorData.overBlackTints);
  if (Array.isArray(colorData.tints)) allTintArrays.push(colorData.tints);
  if (Array.isArray(colorData.wedgeTints)) allTintArrays.push(colorData.wedgeTints);
  if (Array.isArray(colorData.colorantTints)) allTintArrays.push(colorData.colorantTints);
  if (Array.isArray(colorData.spectralTints)) allTintArrays.push(colorData.spectralTints);
  
  // Check nested imported_tints
  if (Array.isArray(colorData.imported_tints)) {
    allTintArrays.push(colorData.imported_tints);
  } else if (colorData.imported_tints?.tints && Array.isArray(colorData.imported_tints.tints)) {
    allTintArrays.push(colorData.imported_tints.tints);
  }
  
  // Check originalObject nested structures
  if (colorData.originalObject) {
    if (Array.isArray(colorData.originalObject.tints)) allTintArrays.push(colorData.originalObject.tints);
    if (Array.isArray(colorData.originalObject.imported_tints)) {
      allTintArrays.push(colorData.originalObject.imported_tints);
    } else if (colorData.originalObject.imported_tints?.tints && Array.isArray(colorData.originalObject.imported_tints.tints)) {
      allTintArrays.push(colorData.originalObject.imported_tints.tints);
    }
  }

  // Generic safety net: any key that includes "tint" and is a non-empty array counts as wedge data
  const dynamicTintArrays = Object.keys(colorData || {}).filter((key) => {
    return /tint/i.test(key) && Array.isArray(colorData[key]) && colorData[key].length > 0;
  });
  
  dynamicTintArrays.forEach(key => {
    allTintArrays.push(colorData[key]);
  });

  // Count distinct tint percentages
  const distinctTintPercentages = new Set();
  allTintArrays.forEach(tintArray => {
    if (Array.isArray(tintArray)) {
      tintArray.forEach(tint => {
        if (tint && typeof tint === 'object') {
          const pct = tint.tintPercentage ?? tint.tint ?? tint.percentage;
          if (typeof pct === 'number') {
            distinctTintPercentages.add(pct);
          }
        }
      });
    }
  });

  const hasMultipleTints = distinctTintPercentages.size >= 2;
  const hasAnyTintData = allTintArrays.some(arr => Array.isArray(arr) && arr.length > 0);

  // Check if we only have a single 100% solid tint (CXF4 with only 100% tint)
  const hasSingleSolidOnly = (
    hasAnyTintData && 
    distinctTintPercentages.size === 1 && 
    (distinctTintPercentages.has(100) || distinctTintPercentages.has(1))
  );

  // Debug logging
  if (hasAnyTintData && !hasSingleSolidOnly) {
    console.log('🔍 Multi-tint wedge data detected:', {
      colorName: colorData?.name,
      distinctTintPercentages: Array.from(distinctTintPercentages),
      tintArrayCount: allTintArrays.length,
      hasMultipleTints,
      dynamicTintArrays,
      nestedStructures: {
        hasImportedTints: !!colorData.imported_tints,
        importedTintsType: Array.isArray(colorData.imported_tints) ? 'array' : typeof colorData.imported_tints,
        hasOriginalObject: !!colorData.originalObject,
        originalObjectKeys: colorData.originalObject ? Object.keys(colorData.originalObject) : []
      }
    });
  } else {
    console.log('✨ Single-color import detected:', {
      colorName: colorData?.name,
      allKeys: Object.keys(colorData || {}),
      hasMultipleMeasurements: Array.isArray(colorData.measurements) && colorData.measurements.length > 1,
      hasSingleSolidOnly,
      distinctTintPercentages: Array.from(distinctTintPercentages)
    });
  }

  // Return true if:
  // 1. No tint data at all (original CXF3 case), OR
  // 2. Only a single 100% solid tint (CXF4 with only 100% tint)
  return !hasAnyTintData || hasSingleSolidOnly;
};

/**
 * Create substrate condition integration for single color imports
 * @param {Object} colorData - Single color CxF data
 * @param {Object} substrateCondition - Selected substrate condition
 * @param {Object} orgDefaults - Organization defaults
 * @param {Array} astmTables - ASTM tables for calculations
 * @returns {Object} - Enhanced colorData with substrate integration
 */
export const createSubstrateIntegratedColorData = (colorData, substrateCondition, orgDefaults, astmTables) => {
  // Always create both 0% (substrate) and 100% (solid) tints for single color imports
  
  // Helper to find existing 100% tint from imported data
  const findExisting100PercentTint = () => {
    const allTintArrays = [
      colorData.substrateTints,
      colorData.overBlackTints,
      colorData.tints,
      colorData.wedgeTints,
      colorData.colorantTints,
      colorData.spectralTints,
      colorData.imported_tints
    ].filter(arr => Array.isArray(arr));

    for (const tintArray of allTintArrays) {
      const tint100 = tintArray.find(t => {
        const pct = t?.tintPercentage ?? t?.tint ?? t?.percentage;
        return pct === 100 || pct === 1;
      });
      if (tint100) return tint100;
    }
    return null;
  };

  const existingSolidTint = findExisting100PercentTint();
  
  // Create 0% substrate tint - use substrate condition data when available
  const substrateSpectral = substrateCondition?.spectral_data;
  const substrateTint = {
    name: '0%',
    tintPercentage: 0,
    backgroundName: 'Substrate',
    colorHex: substrateCondition?.color_hex || '#FFFFFF',
    lab: substrateCondition?.lab || { L: 95, a: 0, b: 0 },
    spectral_data: substrateSpectral || undefined, // Top-level for easy access
    spectralData: substrateSpectral || undefined,  // Legacy compatibility
    measurements: [],
    measurementType: 'substrate'
  };

  // Create 100% solid tint - use existing tint if available, otherwise create from colorData
  let solidColorHex, solidLab, solidMeasurements, solidSpectralData, solidCh;
  
  if (existingSolidTint) {
    // Use existing 100% tint data
    solidColorHex = existingSolidTint.colorHex || existingSolidTint.hex;
    solidLab = existingSolidTint.lab;
    solidCh = existingSolidTint.ch;
    solidSpectralData = existingSolidTint.spectral_data || existingSolidTint.spectralData;
    solidMeasurements = Array.isArray(existingSolidTint.measurements) ? existingSolidTint.measurements : [];
    
    console.log('🔄 Using existing 100% tint from import:', {
      hasHex: !!solidColorHex,
      hasLab: !!solidLab,
      hasSpectral: !!solidSpectralData,
      measurementCount: solidMeasurements.length
    });
  } else {
    // Create from colorData (original CXF3 single color case)
    solidColorHex = colorData.colorHex || colorData.hex;
    solidLab = colorData.lab;
    solidCh = colorData.ch;
    solidSpectralData = colorData.spectral_data || colorData.spectralData;
    solidMeasurements = Array.isArray(colorData.measurements) ? colorData.measurements : [];
  }
  
  // Calculate missing Lab and hex from spectral data if needed
  if ((!solidLab || !solidColorHex) && solidSpectralData && orgDefaults && astmTables?.length) {
    try {
      const spectralObj = { spectral_data: solidSpectralData };
      const result = computeDefaultDisplayColor(spectralObj, orgDefaults, astmTables, 'imported');
      solidColorHex = solidColorHex || result?.hex || '#E5E7EB';
    } catch (error) {
      console.warn('Failed to calculate hex from spectral data:', error);
    }
  }
  
  // Find primary measurement for top-level spectral (prefer M1, fallback to M0 or first)
  const primaryMeasurement = solidMeasurements.find(m => m.mode === 'M1' || m.assignedMode === 'M1') ||
                            solidMeasurements.find(m => m.mode === 'M0' || m.assignedMode === 'M0') ||
                            solidMeasurements[0];
  const primarySpectral = primaryMeasurement?.spectral_data || solidSpectralData;
  
  const solidTint = {
    name: '100%',
    tintPercentage: 100,
    backgroundName: 'Substrate',
    colorHex: solidColorHex,
    lab: solidLab,
    ch: solidCh,
    spectral_data: primarySpectral, // Top-level from primary measurement
    spectralData: primarySpectral,  // Legacy compatibility
    measurements: solidMeasurements.map(m => {
      // Calculate missing Lab for individual measurements from their spectral data
      let measurementLab = m.lab;
      if (!measurementLab && m.spectral_data && orgDefaults && astmTables?.length) {
        try {
          const calculatedResult = computeDefaultDisplayColor(m, orgDefaults, astmTables, 'imported');
          // We only need Lab here, but computeDefaultDisplayColor gives us hex, so we'll keep using the existing Lab if available
          measurementLab = m.lab;
        } catch (error) {
          console.warn('Failed to calculate Lab for measurement:', error);
        }
      }
      
      return {
        ...m,
        mode: m.assignedMode || m.mode,
        spectral_data: m.spectral_data,
        lab: measurementLab
      };
    }),
    measurementType: 'tint'
  };

  return {
    ...colorData,
    _isSingleColorImport: true,
    _hasSubstrateIntegration: true,
    _hadExisting100Tint: !!existingSolidTint,
    substrateTints: [substrateTint, solidTint]
  };
};

/**
 * Hook for importing CxF/X-4 data as ink-based colors
 * This creates a color with an associated ink that contains full tint characterization
 */
export const useCxfInkImport = () => {
  const [isImporting, setIsImporting] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useProfile();
  const { optimisticAddInk, optimisticAddInkCondition } = useInksData();
  const licenses = useMemo(() => ({
    libraries: { plan: profile?.organization?.color_libraries_license || 'Free' }
  }), [profile?.organization?.color_libraries_license]);
  const { astmTables, loading: astmLoading } = useAstmTablesCache();

  // Helper function to get unique backgrounds from tints using backgroundName
  const getUniqueBackgrounds = (tints) => {
    const backgrounds = new Set();
    debug.info('[CxF Backgrounds] getUniqueBackgrounds input tints:', tints.map(t => ({ 
      name: t.name, 
      tintPercentage: t.tintPercentage || t.tint, 
      backgroundName: t.backgroundName 
    })));
    
    tints.forEach(tint => {
      if (tint && tint.backgroundName) {
        backgrounds.add(tint.backgroundName);
      }
    });
    
    const result = backgrounds.size > 0 ? Array.from(backgrounds) : ['Substrate'];
    debug.info('[CxF Backgrounds] getUniqueBackgrounds result:', result);
    return result;
  };

  const handleImportInkBasedColor = async (selectedColors, onSuccess, defaultMeasurementMode = null, options = {}) => {
    const { createLinkedColor = true, ignoreColorLimit = false, selectedSubstrateCondition = null } = options;
    
    if (selectedColors.length === 0) {
      toast({ title: 'No colors selected', description: 'No colors selected to import.', variant: 'destructive' });
      return;
    }

    // Check color limit for free library accounts - skip if ignoreColorLimit is true
    if (!ignoreColorLimit && createLinkedColor && licenses.libraries?.plan === 'Free') {
      try {
        const { count, error } = await supabase
          .from('colors')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id);

        if (error) throw error;

        const currentCount = count || 0;
        const newTotal = currentCount + selectedColors.length;

        if (newTotal > 20) {
          toast({
            title: 'Color Limit Exceeded',
            description: `Free library accounts are limited to 20 colors. You currently have ${currentCount} colors and are trying to add ${selectedColors.length} more. Please upgrade your library license.`,
            variant: 'destructive'
          });
          return;
        }
      } catch (error) {
        console.error('Error checking color count:', error);
        toast({ title: 'Error', description: 'Failed to check color limit.', variant: 'destructive' });
        return;
      }
    }

    // For ink-based color import, we typically import one spot color at a time
    // But we'll handle multiple for flexibility
    setIsImporting(true);

    try {
      const importResults = [];

      for (const colorData of selectedColors) {
        // Handle single color imports with substrate integration
        let processedColorData = colorData;
        if (isSingleColorImport(colorData) && selectedSubstrateCondition) {
          const orgDefaults = profile?.organization || {};
          processedColorData = createSubstrateIntegratedColorData(
            colorData, 
            selectedSubstrateCondition, 
            orgDefaults, 
            astmTables
          );
        }
        
        const result = await importSingleInkBasedColor(processedColorData, defaultMeasurementMode, createLinkedColor, { selectedSubstrateCondition });
        if (result) {
          importResults.push(result);
        }
      }

      if (importResults.length > 0) {
        // For each import result, optimistically add to context
        for (const result of importResults) {
          if (result.inkData && result.conditionData) {
            // Add ink with condition to context for immediate visibility
            optimisticAddInk({
              ...result.inkData,
              conditions: [result.conditionData]
            });
          }
        }

        // Invalidate and refetch the color library cache to ensure the new colors with from_ink_condition_id appear
        await queryClient.refetchQueries({ queryKey: ['colors', profile.organization_id] });
        
        // For multi-color workflow, stay on colors list and call success callback to refresh
        toast({ 
          title: 'Import successful', 
          description: `Successfully imported ${importResults.length} ink-based color${importResults.length > 1 ? 's' : ''}. You can view the 'From Ink' tab for each color to manage print conditions.` 
        });

        // Call success callback
        if (onSuccess) {
          if (selectedColors.length === 1 && importResults[0]) {
            onSuccess(importResults[0].inkId, importResults[0].inkConditionId, selectedColors[0]);
          } else {
            onSuccess();
          }
        }
      }
    } catch (error) {
      console.error('❌ Ink-based color import failed:', error);
      toast({ title: 'Import failed', description: `Error importing ink-based color: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const importSingleInkBasedColor = async (colorData, defaultMeasurementMode = null, createLinkedColor = true, importOptions = {}) => {
    const { selectedSubstrateCondition = null } = importOptions;
    console.log('🎨 Starting ink-based color import for:', colorData.name);

    // Guard: Ensure profile and organization are ready
    if (!profile?.organization_id) {
      toast({ 
        title: 'Profile not ready', 
        description: 'Please wait for your profile to load and try again.', 
        variant: 'destructive' 
      });
      throw new Error('Profile organization not ready');
    }

    // Ensure authenticated session before writes (RLS requires auth.uid())
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast({ 
        title: 'Please sign in', 
        description: 'Your session expired. Sign in and try again.', 
        variant: 'destructive' 
      });
      throw new Error('No authenticated session');
    }

    // Extract the primary/solid color data for the color record
    const primaryTint = colorData.substrateTints?.find(tint => tint.tintPercentage === 100) ||
                       colorData.overBlackTints?.find(tint => tint.tintPercentage === 100) ||
                       colorData;

    // Get organization defaults for LAB calculations
    const orgDefaults = profile?.organization || {};
    
    // Calculate LAB values and hex for primary tint
    const primaryLabData = calculateLabData(primaryTint, orgDefaults, astmTables);
    const primaryHex = primaryTint.colorHex || colorData.colorHex || primaryLabData.hex;

    // Step 1: Create the color record (only if createLinkedColor is true)
    let colorRecord = null;
    if (createLinkedColor) {
      try {
        const { data: createdColor, error: colorError } = await supabase
          .from('colors')
          .insert([{
            name: colorData.name || colorData.spotInkName,
            hex: primaryHex, // This will be updated later to match ink condition color_hex
            organization_id: profile.organization_id, // Required for RLS policy
            lab_l: primaryLabData.lab?.L,
            lab_a: primaryLabData.lab?.a,
            lab_b: primaryLabData.lab?.b,
            standard_type: 'standard'
          }])
          .select()
          .single();

        if (colorError) {
          console.error('❌ Colors insert failed:', colorError);
          throw new Error(`Failed to create color: ${colorError.message}`);
        }

        colorRecord = createdColor;
        console.log('✅ Color created:', colorRecord.id);
      } catch (error) {
        console.error('❌ Color creation failed:', error);
        throw error;
      }
    }

    // Step 2: Create color measurements from ONLY the solid (100% or highest) tint
    if (createLinkedColor && colorRecord) {
      // Find all available tints to determine the solid (100% or highest)
      const allTints = [];
      
      if (Array.isArray(colorData.substrateTints)) allTints.push(...colorData.substrateTints);
      if (Array.isArray(colorData.overBlackTints)) allTints.push(...colorData.overBlackTints);
      if (Array.isArray(colorData.tints)) allTints.push(...colorData.tints);
      
      // Get tint percentage helper
      const getTintPercentage = (tint) => tint?.tintPercentage ?? tint?.tint ?? 100;
      
      // Find the solid tint (100% or highest available)
      let solidTint = allTints.find(t => getTintPercentage(t) === 100);
      if (!solidTint && allTints.length > 0) {
        // Fallback to highest percentage if 100 is missing
        solidTint = allTints.reduce((max, t) => 
          getTintPercentage(t) > getTintPercentage(max) ? t : max, allTints[0]);
      }
      
      // Collect measurements from solid tint, fallback to colorData.measurements
      const solidMeasurements = solidTint?.measurements && solidTint.measurements.length > 0
        ? solidTint.measurements
        : (colorData.measurements || []);

      if (solidMeasurements.length > 0) {
        const solidPercentage = solidTint ? getTintPercentage(solidTint) : 100;
        
        const measurementInserts = solidMeasurements.map(measurement => ({
          color_id: colorRecord.id,
          mode: measurement.assignedMode || measurement.mode || defaultMeasurementMode || null,
          spectral_data: measurement.spectral_data || extractSpectralData(measurement, `measurement for ${colorData.name}`),
          lab: measurement.lab || calculateLabFromSpectral(
            measurement.spectral_data || extractSpectralData(measurement, `measurement for ${colorData.name}`),
            orgDefaults,
            astmTables
          ),
          tint_percentage: solidPercentage,
          illuminant: orgDefaults.default_illuminant || 'D50',
          observer: String(orgDefaults.default_observer || '2')
        }));

        const { error: measurementError } = await supabase
          .from('color_measurements')
          .upsert(measurementInserts, {
            onConflict: 'color_id,mode,tint_percentage'
          });

        if (measurementError) {
          console.warn('⚠️ Failed to create measurements:', measurementError.message);
        } else {
          console.log(`✅ Created ${measurementInserts.length} solid (${solidPercentage}%) measurement modes for color`);
        }
      }
    }

// Step 3: Create the ink record
    const { data: inkRecord, error: inkError } = await supabase
      .from('inks')
      .insert([{
        name: colorData.spotInkName || colorData.name,
        organization_id: profile.organization_id,
        type: 'spot',
        curve: 'as_measured', // Always set to "as measured" for CxF/X-4 imports
        appearance_type: 'standard',
        is_hidden: true // Hide imported inks from list by default
      }])
      .select()
      .single();

    if (inkError) {
      throw new Error(`Failed to create ink: ${inkError.message}`);
    }

    console.log('✅ Ink created:', inkRecord.id);

    // Step 4: Create ink condition with all tint data
    // Source arrays with robust fallbacks
    const substrateSource = (Array.isArray(colorData.substrateTints) && colorData.substrateTints.length > 0)
      ? colorData.substrateTints
      : (Array.isArray(colorData.tints) ? colorData.tints.filter(t => (t.tintPercentage ?? t.tint ?? 0) === 0) : []);
    const overBlackSource = (Array.isArray(colorData.overBlackTints) && colorData.overBlackTints.length > 0)
      ? colorData.overBlackTints
      : (Array.isArray(colorData.tints) ? colorData.tints.filter(t => t.isOverBlack) : []);

    // Extract all available measurement modes from the imported data
    const extractAvailableModes = (sources) => {
      const allModes = new Set();
      
      sources.forEach(sourceArray => {
        if (Array.isArray(sourceArray)) {
          sourceArray.forEach(tint => {
            if (Array.isArray(tint.measurements)) {
              tint.measurements.forEach(m => {
                const mode = m.assignedMode || m.mode;
                if (mode && /^M[0-3]$/.test(mode)) {
                  allModes.add(mode);
                }
              });
            }
          });
        }
      });
      
      // Also check colorData.measurements
      if (Array.isArray(colorData.measurements)) {
        colorData.measurements.forEach(m => {
          const mode = m.assignedMode || m.mode;
          if (mode && /^M[0-3]$/.test(mode)) {
            allModes.add(mode);
          }
        });
      }
      
      return Array.from(allModes);
    };
    
    const availableModesForCondition = extractAvailableModes([substrateSource, overBlackSource]);

    // Build processed tints per background to preserve background context
    const processedSubstrateTints = substrateSource.map(tint => {
      const tintLabData = calculateLabData(tint, orgDefaults, astmTables);
      const tintPercentage = tint.tintPercentage ?? tint.tint ?? 0;
      const backgroundName = tint.backgroundName || 'Substrate';
      const stableId = tint.id || `tint-${tintPercentage}-${backgroundName}`;
      
      return {
        id: stableId,
        name: tint.name,
        tintPercentage,
        backgroundName,
        colorHex: tint.colorHex || tintLabData.hex,
        lab: tintLabData.lab,
        ch: tint.ch || tintLabData.ch,
        spectral_data: extractSpectralData(tint, `tint ${tint.name}`),
        spectralData: extractSpectralData(tint, `tint ${tint.name}`),
        measurements: (tint.measurements || []).map(measurement => ({
          ...measurement,
          mode: measurement.assignedMode || measurement.mode || defaultMeasurementMode,
          lab: measurement.lab || calculateLabFromSpectral(measurement.spectral_data, orgDefaults, astmTables),
          spectral_data: measurement.spectral_data,
          backgroundName
        })),
        measurementType: tintPercentage === 0 ? 'substrate' : 'tint'
      };
    });

    const processedOverBlackTints = overBlackSource.map(tint => {
      const tintLabData = calculateLabData(tint, orgDefaults, astmTables);
      const tintPercentage = tint.tintPercentage ?? tint.tint ?? 100;
      const backgroundName = tint.backgroundName || 'Substrate';
      const stableId = tint.id || `tint-${tintPercentage}-${backgroundName}`;
      
      return {
        id: stableId,
        name: tint.name,
        tintPercentage,
        backgroundName,
        colorHex: tint.colorHex || tintLabData.hex,
        lab: tintLabData.lab,
        ch: tint.ch || tintLabData.ch,
        spectral_data: extractSpectralData(tint, `tint ${tint.name}`),
        spectralData: extractSpectralData(tint, `tint ${tint.name}`),
        measurements: (tint.measurements || []).map(measurement => ({
          ...measurement,
          mode: measurement.assignedMode || measurement.mode || defaultMeasurementMode,
          lab: measurement.lab || calculateLabFromSpectral(measurement.spectral_data, orgDefaults, astmTables),
          spectral_data: measurement.spectral_data,
          backgroundName
        })),
        measurementType: 'tint'
      };
    });

    let processedTints = [...processedSubstrateTints, ...processedOverBlackTints];

    // Global fallback: if no background names provided in any tints, set all to "Substrate"
    const anyBackgroundNamed = processedTints.some(t => !!t.backgroundName);
    debug.info('[CxF Backgrounds] Processed tints background check:', {
      processedTintsCount: processedTints.length,
      anyBackgroundNamed,
      backgrounds: processedTints.map(t => ({ tint: t.tintPercentage, backgroundName: t.backgroundName }))
    });
    
    if (!anyBackgroundNamed) {
      processedTints = processedTints.map(t => ({
        ...t,
        backgroundName: 'Substrate',
        measurements: (t.measurements || []).map(m => ({ ...m, backgroundName: 'Substrate' }))
      }));
      debug.info('[CxF Backgrounds] Applied fallback Substrate background to all tints');
    }

    // Final fallback: if no tints were detected, create a single 100% solid on Substrate from primaryTint/colorData
    if (processedTints.length === 0 && primaryTint) {
      const tintLabData = calculateLabData(primaryTint, orgDefaults, astmTables);
      processedTints = [{
        id: 'tint-100-Substrate',
        name: primaryTint.name || '100%',
        tintPercentage: 100,
        backgroundName: 'Substrate',
        colorHex: primaryTint.colorHex || tintLabData.hex,
        lab: tintLabData.lab,
        ch: tintLabData.ch,
        spectral_data: extractSpectralData(primaryTint, 'primary tint'),
        spectralData: extractSpectralData(primaryTint, 'primary tint'),
        measurements: (primaryTint.measurements || colorData.measurements || []).map(measurement => ({
          ...measurement,
          mode: measurement.assignedMode || measurement.mode || defaultMeasurementMode,
          lab: measurement.lab || calculateLabFromSpectral(measurement.spectral_data, orgDefaults, astmTables),
          spectral_data: measurement.spectral_data,
          backgroundName: 'Substrate'
        })),
        measurementType: 'tint'
      }];
    }

    // Precompute backgrounds list with safe default
    const backgroundsList = getUniqueBackgrounds(processedTints);

    // Create a canonical background map and assign stable keys to each background
    const backgroundNameToKey = {};
    const backgrounds_map = {};
    backgroundsList.forEach((name, idx) => {
      const key = `bg${idx}`;
      backgroundNameToKey[name] = key;
      backgrounds_map[key] = name;
    });

    // Attach background_key to tints and their measurements
    processedTints = processedTints.map(t => ({
      ...t,
      background_key: t.background_key || (t.backgroundName ? backgroundNameToKey[t.backgroundName] : null),
      measurements: (t.measurements || []).map(m => ({
        ...m,
        background_key: m.background_key || (m.backgroundName ? backgroundNameToKey[m.backgroundName] : (t.backgroundName ? backgroundNameToKey[t.backgroundName] : null))
      }))
    }));

    // Compute intersection of available modes across ALL tints and include from color level
    const modeOrder = ['M0','M1','M2','M3'];
    const tintModeSets = processedTints
      .map(t => new Set((t.measurements || []).map(m => m.assignedMode || m.mode).filter(Boolean)))
      .filter(set => set.size > 0);
    
    // Also include modes from color-level measurements
    const colorModes = new Set((colorData.measurements || []).map(m => m.assignedMode || m.mode).filter(Boolean));
    if (colorModes.size > 0) {
      tintModeSets.push(colorModes);
    }
    
    let intersectedModes = [];
    if (tintModeSets.length > 0) {
      const intersection = new Set(tintModeSets[0]);
      tintModeSets.slice(1).forEach(set => {
        for (const m of Array.from(intersection)) {
          if (!set.has(m)) intersection.delete(m);
        }
      });
      intersectedModes = Array.from(intersection);
    } else if (colorData.measurements && colorData.measurements.length > 0) {
      intersectedModes = Array.from(new Set(colorData.measurements.map(m => m.assignedMode || m.mode).filter(Boolean)));
    }
    // Sort by standard mode order if present
    intersectedModes.sort((a,b) => modeOrder.indexOf(a) - modeOrder.indexOf(b));

    const availableBackgrounds = getUniqueBackgrounds(processedTints);
    debug.info('[CxF Backgrounds] Final available_backgrounds for database:', availableBackgrounds);

    // Extract spectral measurement metadata from first tint for DB settings
    const firstTint = processedTints[0];
    const extractedStartWl = firstTint?.spectralData?.start_wl || colorData.measurement_settings?.start_wl || 380;
    const extractedIncrement = firstTint?.spectralData?.increment || colorData.measurement_settings?.increment || 10;

    // CRITICAL: Ensure imported_tints ALWAYS has a valid tints array
    // This is the root fix to prevent empty wedge data downstream
    let normalizedTints = processedTints;
    
    // Ensure we have at least one tint (100% solid) if processedTints is empty
    if (normalizedTints.length === 0) {
      console.warn('⚠️ No processed tints found, synthesizing 100% solid tint');
      const fallbackSpectral = extractSpectralData(primaryTint, 'fallback primary tint');
      const fallbackLab = calculateLabData(primaryTint, orgDefaults, astmTables);
      
      normalizedTints = [{
        id: 'tint-100-Substrate',
        name: '100%',
        tintPercentage: 100,
        backgroundName: 'Substrate',
        colorHex: primaryTint?.colorHex || fallbackLab.hex,
        lab: fallbackLab.lab,
        ch: fallbackLab.ch,
        spectral_data: fallbackSpectral,
        spectralData: fallbackSpectral,
        measurements: (primaryTint?.measurements || colorData.measurements || []).map(measurement => ({
          ...measurement,
          mode: measurement.assignedMode || measurement.mode || defaultMeasurementMode || 'M1',
          lab: measurement.lab || calculateLabFromSpectral(measurement.spectral_data, orgDefaults, astmTables),
          spectral_data: measurement.spectral_data,
          backgroundName: 'Substrate'
        })),
        measurementType: 'tint'
      }];
    }
    
    const importedTints = {
      tints: normalizedTints, // ALWAYS an array with at least one tint
      // Enhanced measurement metadata - preserve ALL mode data
      measurements: (colorData.measurements || []).map(measurement => ({
        ...measurement,
        mode: measurement.assignedMode || measurement.mode || defaultMeasurementMode,
        spectral_data: measurement.spectral_data
      })),
      spectralDataByMode: colorData.spectralDataByMode || {},
      measurement_settings: {
        available_modes: intersectedModes.length > 0 ? intersectedModes : [defaultMeasurementMode || 'M1'],
        available_backgrounds: getUniqueBackgrounds(normalizedTints),
        start_wl: colorData.measurement_settings?.start_wl || 380,
        increment: colorData.measurement_settings?.increment || 10,
        mode: defaultMeasurementMode || colorData.measurementMode || 'M1',
        illuminant: orgDefaults.default_illuminant || 'D50',
        observer: orgDefaults.default_observer || '2'
      }
    };
    
    // Assert tints array is valid before saving
    if (!Array.isArray(importedTints.tints) || importedTints.tints.length === 0) {
      console.error('❌ CRITICAL: imported_tints.tints is not a valid array!', importedTints);
      throw new Error('Failed to create valid tints array for ink condition');
    }
    
    console.log('✅ Validated imported_tints structure:', {
      tintsCount: importedTints.tints.length,
      tintPercentages: importedTints.tints.map(t => t.tintPercentage),
      measurementsCount: importedTints.measurements?.length || 0,
      modesAvailable: importedTints.measurement_settings?.available_modes || []
    });

    // Persist background mapping and active data mode for stable grouping across the app
    const uiState = {
      backgrounds_map,
      active_data_mode: 'imported',
      last_saved_at: new Date().toISOString()
    };

    // Calculate the proper display color using computeDefaultDisplayColor
    // Extract spectral data from the 100% solid tint
    const solidTint = normalizedTints.find(t => t.tintPercentage === 100);
    const solidSpectralData = solidTint?.spectral_data || solidTint?.spectralData || 
                             primaryTint?.spectral_data || extractSpectralData(primaryTint, 'solid tint');

    console.log('🎨 Calculating color_hex using computeDefaultDisplayColor:', {
      hasSolidTint: !!solidTint,
      hasSolidSpectral: !!solidSpectralData,
      hasOrgDefaults: !!orgDefaults,
      hasAstmTables: !!astmTables,
      solidTintPercentage: solidTint?.tintPercentage
    });

    // Use computeDefaultDisplayColor to ensure consistency
    const tempColorObject = {
      spectral_data: solidSpectralData,
      lab: primaryLabData.lab
    };

    const colorResult = computeDefaultDisplayColor(
      tempColorObject,
      orgDefaults,
      astmTables,
      'imported', // activeDataMode
      solidSpectralData, // explicit spectral override
      {} // no measurement controls override (empty object, not null)
    );

    const displayColorHex = colorResult?.hex || 
                           colorData.hex || 
                           primaryTint?.colorHex || 
                           '#808080';

    console.log('🎨 Final color_hex from computeDefaultDisplayColor:', { 
      displayColorHex,
      colorResultHex: colorResult?.hex,
      fallbackHex: colorData.hex || primaryTint?.colorHex
    });

    // Add substrate information if available (from single color substrate integration)
    let substrateCondition = null;
    let substrateId = null;
    
    if (colorData._hasSubstrateIntegration && selectedSubstrateCondition) {
      substrateCondition = selectedSubstrateCondition.id; // Store UUID not name
      substrateId = selectedSubstrateCondition.substrate_id;
    }

    // Use the primary tint data for the condition's primary color
    const { data: inkCondition, error: conditionError } = await supabase
      .from('ink_conditions')
      .insert([{
        ink_id: inkRecord.id,
        name: '', // Let auto-generation handle the name
        substrate_id: substrateId,
        substrate_condition: substrateCondition, // UUID format
        color_hex: displayColorHex,
        spectral_data: extractSpectralData(primaryTint, `primary tint for ${colorData.name}`),
        lab: primaryLabData.lab,
        ch: primaryLabData.ch,
        ink_curve: 'as_measured',
        imported_tints: importedTints, // FULL OBJECT - preserves tints array + metadata
        adapted_tints: null, // Explicit null - ink-based import doesn't compute adapted tints
        measurement_settings: importedTints.measurement_settings, // Complete settings from importedTints
        ui_state: uiState, // Enhanced with active_data_mode and last_saved_at
        creation_origin: 'from_color', // Track origin for proper cleanup
        is_hidden: true // Hide auto-generated ink conditions from user list
      }])
      .select()
      .single();

    if (conditionError) {
      throw new Error(`Failed to create ink condition: ${conditionError.message}`);
    }

    console.log('✅ Ink condition created:', inkCondition.id);

    // Step 5a: Create measurements in color_measurements table for ALL imports
    // This ensures spectral data is accessible in the colors table/UI
    if (createLinkedColor && colorRecord) {
      console.log('🔗 Creating measurements for ink-based color import:', colorRecord.id);
      
      // Extract measurement data from multiple sources with comprehensive fallbacks
      let solidMeasurements = [];
      
      // Source 1: primaryTint measurements
      if (primaryTint?.measurements && Array.isArray(primaryTint.measurements) && primaryTint.measurements.length > 0) {
        solidMeasurements = primaryTint.measurements;
        console.log('📊 Using measurements from primaryTint:', solidMeasurements.length);
      }
      // Source 2: colorData measurements
      else if (colorData.measurements && Array.isArray(colorData.measurements) && colorData.measurements.length > 0) {
        solidMeasurements = colorData.measurements;
        console.log('📊 Using measurements from colorData:', solidMeasurements.length);
      }
      // Source 3: Extract from importedTints structure (100% tint)
      else if (importedTints?.tints && Array.isArray(importedTints.tints)) {
        const solidTint = importedTints.tints.find(t => (t.tintPercentage ?? t.tint ?? 0) === 100);
        if (solidTint?.measurements && Array.isArray(solidTint.measurements)) {
          solidMeasurements = solidTint.measurements;
          console.log('📊 Using measurements from importedTints 100% tint:', solidMeasurements.length);
        }
      }
      
      console.log('📊 Total solid measurements found:', solidMeasurements.length);
      
      if (solidMeasurements.length > 0) {
        const measurementInserts = solidMeasurements
          .filter(m => m.spectral_data) // Only measurements with spectral data
          .map(measurement => {
            console.log('  📋 Creating measurement:', {
              mode: measurement.mode || measurement.assignedMode,
              hasSpectral: !!measurement.spectral_data,
              hasLab: !!measurement.lab
            });
            
            return {
              color_id: colorRecord.id,
              mode: measurement.mode || measurement.assignedMode || 'M1',
              spectral_data: measurement.spectral_data,
              lab: measurement.lab || primaryLabData.lab,
              tint_percentage: 100, // This is the solid/100% tint
              illuminant: orgDefaults.default_illuminant || 'D50',
              observer: String(orgDefaults.default_observer || '2')
            };
          });

        console.log('📊 Measurement inserts prepared:', measurementInserts.length);

        if (measurementInserts.length > 0) {
          const { error: measurementError } = await supabase
            .from('color_measurements')
            .upsert(measurementInserts, {
              onConflict: 'color_id,mode,tint_percentage'
            });

          if (measurementError) {
            console.error('❌ Failed to create measurement records:', measurementError.message);
          } else {
            console.log(`✅ Created ${measurementInserts.length} solid (100%) measurement records`);
          }
        } else {
          console.warn('⚠️ No measurements with spectral data to insert');
        }
      } else {
        console.warn('⚠️ No solid measurements found from any source');
      }
    }

    // Step 5b: Link the color to the ink condition and sync hex (only if color was created)
    if (createLinkedColor && colorRecord) {
      const { error: linkError } = await supabase
        .from('colors')
        .update({ 
          from_ink_condition_id: inkCondition.id,
          hex: displayColorHex // Update color hex to match ink condition color_hex
        })
        .eq('id', colorRecord.id);

      if (linkError) {
        console.warn('⚠️ Failed to link color to ink condition and sync hex:', linkError.message);
      } else {
        console.log('✅ Color linked to ink condition and hex synchronized');
      }
    }

    return {
      colorId: colorRecord?.id || null,
      inkId: inkRecord.id,
      inkConditionId: inkCondition.id,
      inkData: inkRecord,
      conditionData: inkCondition
    };
  };

  // Helper function to calculate LAB data from tint data
  const calculateLabData = (tintData, orgDefaults, astmTables) => {
    // If LAB already exists, use it
    if (tintData.lab?.L !== undefined && tintData.lab?.a !== undefined && tintData.lab?.b !== undefined) {
      return {
        lab: tintData.lab,
        hex: tintData.colorHex || labToHex(tintData.lab.L, tintData.lab.a, tintData.lab.b),
        ch: tintData.ch
      };
    }

    // Calculate from spectral data if available
    const spectralData = extractSpectralData(tintData, `LAB calculation for ${tintData.name || 'tint'}`);
    if (spectralData && astmTables && astmTables.length > 0) {
      const lab = calculateLabFromSpectral(spectralData, orgDefaults, astmTables);
      if (lab) {
        const hex = labToHex(lab.L, lab.a, lab.b);
        return { lab, hex };
      }
    }

    // Fallback: use existing hex or generate a default
    const source = { spectral_data: spectralData };
    if (tintData.lab) {
      source.lab_l = tintData.lab.L;
      source.lab_a = tintData.lab.a;
      source.lab_b = tintData.lab.b;
    }
    
    const result = computeDefaultDisplayColor(source, orgDefaults, astmTables);
    const hex = result?.hex || tintData.colorHex || '#808080';
    return { hex, lab: tintData.lab };
  };

  // Helper function to calculate LAB from spectral data
  const calculateLabFromSpectral = (spectralData, orgDefaults, astmTables) => {
    if (!spectralData || !astmTables || astmTables.length === 0) {
      return null;
    }

    const illuminant = orgDefaults.default_illuminant || 'D50';
    const observer = orgDefaults.default_observer || '2';
    const tableNumber = orgDefaults.default_astm_table || orgDefaults.default_table || '5';

    // Filter ASTM tables for the specified conditions
    const matchingTables = astmTables.filter(row => 
      row.illuminant_name === illuminant && 
      String(row.observer) === String(observer) && 
      String(row.table_number) === String(tableNumber)
    );

    if (matchingTables.length === 0) {
      console.warn('No matching ASTM tables found, using D50/2°/Table 5 fallback');
      const fallbackTables = astmTables.filter(row => 
        row.illuminant_name === 'D50' && 
        String(row.observer) === '2' && 
        String(row.table_number) === '5'
      );
      const normalizedFallback = fallbackTables.map(r => ({
        ...r,
        white_point_x: r.white_point_x ?? r.xn,
        white_point_y: r.white_point_y ?? r.yn,
        white_point_z: r.white_point_z ?? r.zn,
        wavelength: r.wavelength ?? r.lambda ?? r.wl,
        x_factor: r.x_factor ?? r.xbar ?? r.Sx ?? r.x,
        y_factor: r.y_factor ?? r.ybar ?? r.Sy ?? r.y,
        z_factor: r.z_factor ?? r.zbar ?? r.Sz ?? r.z,
      }));
      return normalizedFallback.length > 0 ? spectralToLabASTME308(spectralData, normalizedFallback) : null;
    }

    const normalizedMatch = matchingTables.map(r => ({
      ...r,
      white_point_x: r.white_point_x ?? r.xn,
      white_point_y: r.white_point_y ?? r.yn,
      white_point_z: r.white_point_z ?? r.zn,
      wavelength: r.wavelength ?? r.lambda ?? r.wl,
      x_factor: r.x_factor ?? r.xbar ?? r.Sx ?? r.x,
      y_factor: r.y_factor ?? r.ybar ?? r.Sy ?? r.y,
      z_factor: r.z_factor ?? r.zbar ?? r.Sz ?? r.z,
    }));

    return spectralToLabASTME308(spectralData, normalizedMatch);
  };

  // Effect to recompute LAB values when ASTM tables become available
  useEffect(() => {
    // This effect can be used to trigger recomputation if needed
    // Currently, we compute LAB values synchronously during import
  }, [astmTables, astmLoading]);

  return {
    handleImportInkBasedColor,
    isImporting,
    isSingleColorImport,
    createSubstrateIntegratedColorData
  };
};