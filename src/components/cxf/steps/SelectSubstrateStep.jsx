import React, { useMemo, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { computeDefaultDisplayColor, spectralToLabASTME308, labToHexD65 } from '@/lib/colorUtils/colorConversion';
import { computeDisplayColorWithOrgDefaults, computeDisplayColorFromSpectral } from '@/lib/colorUtils/displayColorComputation';
import { getTintPercentage, safeSpectralData } from '@/lib/tintsUtils';
import { useSubstratesData } from '@/context/SubstrateContext';
// import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { useProfile } from '@/context/ProfileContext';
import { useInksData } from '@/context/InkContext';
import { calculateSubstrateChangeScalars, applySubstrateScalarsToTint, calculateAdditionalInkLayer, applyAdditionalInkLayer } from '@/lib/inkSubstrateAdaptation';
import { calculateDeltaE } from '@/lib/deltaE';
import { calculateSubstrateDeltaE } from '@/lib/substrateAdaptationUtils';
import { supabase } from '@/integrations/supabase/client';
import DiagonalSplitPatch from '@/components/ui/DiagonalSplitPatch';
import { debug } from '@/lib/debugUtils';


// Helper function to extract spectral data from substrate condition objects
const getSubstrateSpectral = (substrateCondition) => {
  if (!substrateCondition) return null;
  
  // Try spectral_data first (already an object)
  if (substrateCondition.spectral_data && typeof substrateCondition.spectral_data === 'object' && Object.keys(substrateCondition.spectral_data).length > 0) {
    console.info('[getSubstrateSpectral] Using spectral_data object', Object.keys(substrateCondition.spectral_data));
    return substrateCondition.spectral_data;
  }
  
  // Try spectral_string (JSON string)
  if (substrateCondition.spectral_string && typeof substrateCondition.spectral_string === 'string') {
    try {
      const parsed = JSON.parse(substrateCondition.spectral_string);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        console.info('[getSubstrateSpectral] Using spectral_string (parsed)', Object.keys(parsed));
        return parsed;
      }
    } catch (error) {
      console.warn('[getSubstrateSpectral] Failed to parse spectral_string:', error);
    }
  }
  
  console.info('[getSubstrateSpectral] No valid spectral data found', {
    hasSpectralData: !!substrateCondition.spectral_data,
    hasSpectralString: !!substrateCondition.spectral_string,
    spectralDataType: typeof substrateCondition.spectral_data,
    spectralStringType: typeof substrateCondition.spectral_string
  });
  return null;
};

const SelectSubstrateStep = ({ formData, updateFormData, cxfColors, hideAdaptationWarning = false, sourceInkCondition = null, isSingleColorImport = false, hideCreateNew = false }) => {
  const { substrates } = useSubstratesData();
  const { allInks } = useInksData();
  const { profile } = useProfile();
  
  // More robust color selection with fallback strategies and debug logging
  const selectedColor = useMemo(() => {
    console.log('🎨 SelectSubstrateStep: Resolving selectedColor', {
      formDataSelectedColorId: formData.selectedColorId,
      cxfColorsLength: cxfColors?.length || 0,
      cxfColorIds: cxfColors?.map(c => c.id) || [],
      isSingleColorImport
    });
    
    // Strategy 1: Try exact ID match
    if (formData.selectedColorId && cxfColors?.length) {
      const exactMatch = cxfColors.find(color => color.id === formData.selectedColorId);
      if (exactMatch) {
        console.log('✅ Found exact color match:', { id: exactMatch.id, name: exactMatch.name || 'Unnamed' });
        return exactMatch;
      }
    }
    
    // Strategy 2: For single color import, take the first available color
    if ((isSingleColorImport || formData.selectedColorId === 'single_color') && cxfColors?.length) {
      const firstColor = cxfColors[0];
      console.log('🎯 Using first color for single import:', { id: firstColor.id, name: firstColor.name || 'Unnamed' });
      return firstColor;
    }
    
    // Strategy 3: Fallback to first available color
    if (cxfColors?.length) {
      const fallbackColor = cxfColors[0];
      console.log('⚠️ Falling back to first available color:', { id: fallbackColor.id, name: fallbackColor.name || 'Unnamed' });
      return fallbackColor;
    }
    
    console.warn('❌ No color could be resolved:', { formData, cxfColors });
    return null;
  }, [formData.selectedColorId, cxfColors, isSingleColorImport]);
  const formatNum = (v) => (typeof v === 'number' ? Number(v).toFixed(2) : '—');
  
  const [selectedSubstrateCondition, setSelectedSubstrateCondition] = useState(null);
  const [adaptedColors, setAdaptedColors] = useState({ substrate: null, solid: null });
  const [deltaEs, setDeltaEs] = useState({ substrate: null, solid: null });
  
  // Lazy-load ASTM tables locally to avoid global hook crashes
  const [astmTables, setAstmTables] = useState([]);
  const [astmLoading, setAstmLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const fetchAstm = async () => {
      setAstmLoading(true);
      try {
        const { data } = await supabase
          .from('astm_e308_tables')
          .select('*')
          .eq('table_number', 5)
          .eq('illuminant_name', 'D50')
          .eq('observer', '2');
        if (!cancelled) setAstmTables(data || []);
      } finally {
        if (!cancelled) setAstmLoading(false);
      }
    };
    fetchAstm();
    return () => { cancelled = true; };
  }, []);
  
  // Handle single color imports differently with robust detection
  const isSingleColor = useMemo(() => {
    console.log('🔍 isSingleColor detection:', { 
      isSingleColorImport, 
      cxfColorsLength: cxfColors?.length,
      selectedColorFlag: selectedColor?._isSingleColorImport 
    });
    
    // Primary: explicit prop - no fallbacks that force single-color UI
    if (isSingleColorImport) return true;
    
    // Fallback 1: color-specific flag
    if (selectedColor?._isSingleColorImport) return true;
    
    return false;
  }, [isSingleColorImport, selectedColor?._isSingleColorImport]);
  
  // Effective mode from source condition (imported vs adapted)
  const effectiveMode = selectedColor?.effectiveDataMode || 'imported';
  
  // Combine all tint sources from the wizard-processed data and label backgrounds explicitly
  // Ensures background filtering works even if wizard didn't set backgroundName
  // MEMOIZED to prevent infinite re-render loops
  const tintData = useMemo(() => {
    const allTints = [];
    
    // Use tintsByBackground if available (new format)
    if (selectedColor?.tintsByBackground) {
      for (const [backgroundName, tints] of Object.entries(selectedColor.tintsByBackground)) {
        const labeledTints = tints.map(t => ({
          ...t,
          backgroundName: t.backgroundName || backgroundName
        }));
        allTints.push(...labeledTints);
      }
      return allTints;
    }
    
    // Fallback to old format (substrateTints only) for backward compatibility
    const substrateTintsLabeled = (selectedColor?.substrateTints || []).map(t => ({
      ...t,
      backgroundName: t.backgroundName || t.background_name || 'Substrate'
    }));
    
    return substrateTintsLabeled;
  }, [selectedColor?.tintsByBackground, selectedColor?.substrateTints]);
  
  // Build weighting table using org defaults with safe normalization
  const weightingTable = useMemo(() => {
    if (!astmTables || astmTables.length === 0) return null;
  
    const org = profile?.organization || {};
    const illuminant = org.default_illuminant || 'D50';
    const observer = String(org.default_observer || '2');
    const tableNumber = String(org.default_astm_table || org.default_table || '5');
  
    const pickAndNormalize = (rows) => rows.map(r => ({
      ...r,
      white_point_x: r.white_point_x ?? r.xn,
      white_point_y: r.white_point_y ?? r.yn,
      white_point_z: r.white_point_z ?? r.zn,
      wavelength: r.wavelength ?? r.lambda ?? r.wl,
      x_factor: r.x_factor ?? r.xbar ?? r.Sx ?? r.x,
      y_factor: r.y_factor ?? r.ybar ?? r.Sy ?? r.y,
      z_factor: r.z_factor ?? r.zbar ?? r.Sz ?? r.z,
    }));
  
    const matching = astmTables.filter(t =>
      t.illuminant_name === illuminant &&
      String(t.observer) === observer &&
      String(t.table_number) === tableNumber
    );
    if (matching.length > 0) return pickAndNormalize(matching);
  
    const fallback = astmTables.filter(t =>
      t.illuminant_name === 'D50' && String(t.observer) === '2' && String(t.table_number) === '5'
    );
    if (fallback.length > 0) return pickAndNormalize(fallback);
  
    return pickAndNormalize(astmTables);
  }, [astmTables, profile]);
  
  // Create measurement controls object that matches what weighting table uses
  const measurementControls = useMemo(() => {
    const org = profile?.organization || {};
    const controls = {
      illuminant: org.default_illuminant || 'D50',
      observer: String(org.default_observer || '2'),
      table: String(org.default_astm_table || org.default_table || '5')
    };
    console.info('🎯 [Preview] Measurement controls:', controls);
    return controls;
  }, [profile]);
  
  // debug: weightingTable rows removed
  
  // Process tints with proper color computation from spectral data
  const processedTints = useMemo(() => {
    // Guard: Don't process if ASTM tables are still loading
    if (astmLoading) {
      console.log('⏳ Waiting for ASTM tables to load before processing tints');
      return [];
    }
    
    if (!tintData || !Array.isArray(tintData)) return [];
    
    console.log('🎨 Processing tints:', {
      tintDataLength: tintData.length,
      hasWeightingTable: !!weightingTable,
      astmLoading,
      selectedColorHex: selectedColor?.hex || selectedColor?.colorHex
    });
    
    const wt = weightingTable;
    
    return tintData.map(tint => {
      const spectralData = safeSpectralData(tint);
      
      // Priority 1: Use existing hex values to avoid flash
      let computedHex = tint.hex || tint.colorHex || tint.color_hex || tint.displayHex;
      
      // Priority 2: Use standard computeDefaultDisplayColor pipeline for consistent color calculation
      if (!computedHex && wt) {
        const orgDefaults = {
          default_illuminant: profile?.organization?.default_illuminant || 'D50',
          default_observer: profile?.organization?.default_observer || '2',
          default_astm_table: profile?.organization?.default_astm_table || '5'
        };
        try {
          // Wrap spectral data using safeSpectralData to ensure proper format
          const s = safeSpectralData(tint);
          const result = computeDefaultDisplayColor(s ? { spectral_data: s } : tint, orgDefaults, astmTables);
          computedHex = result?.hex;
        } catch (error) {
          console.warn('Failed to compute hex using standard pipeline:', error);
        }
      }

      // Final fallback: use selectedColor hex or neutral gray (NOT black)
      if (!computedHex) {
        computedHex = selectedColor?.hex || selectedColor?.colorHex || '#9CA3AF';
      }

      return {
        ...tint,
        computedHex,
        tintPercentage: getTintPercentage(tint),
        backgroundName: tint.backgroundName || tint.background_name || null
      };
    }).sort((a, b) => a.tintPercentage - b.tintPercentage);
  }, [selectedColor, tintData, weightingTable, astmLoading]);
  
  // Find substrate (0%) and solid (100%) tints with smart fallbacks
  const substrateTint = useMemo(() => {
    // Filter by selected background first
    const backgroundFilteredTints = processedTints.filter(tint => {
      return !formData.selectedBackground || 
        tint.backgroundName === formData.selectedBackground || 
        (!tint.backgroundName && formData.selectedBackground === 'Substrate');
    });
    
    const exact = backgroundFilteredTints.find(t => t.tintPercentage === 0);
    if (exact) return exact;
    // fallback to the lowest percentage available
    return backgroundFilteredTints.length ? [...backgroundFilteredTints].sort((a,b)=>a.tintPercentage-b.tintPercentage)[0] : undefined;
  }, [processedTints, formData.selectedBackground]);
  
  const solidTint = useMemo(() => {
    // Filter by selected background first
    const backgroundFilteredTints = processedTints.filter(tint => {
      return !formData.selectedBackground || 
        tint.backgroundName === formData.selectedBackground || 
        (!tint.backgroundName && formData.selectedBackground === 'Substrate');
    });
    
    const exact = backgroundFilteredTints.find(t => t.tintPercentage === 100);
    if (exact) return exact;
    // fallback to the highest percentage available
    return backgroundFilteredTints.length ? [...backgroundFilteredTints].sort((a,b)=>b.tintPercentage-a.tintPercentage)[0] : undefined;
  }, [processedTints, formData.selectedBackground]);
  
  // debug: processed tints logs removed
  
  
  // Filter substrates to exclude the source substrate when adapting
  const filteredSubstrates = useMemo(() => {
    if (!substrates || substrates.length === 0) {
      console.log('🔍 No substrates available');
      return [];
    }
    
    // Harden source substrate name resolution with multiple fallbacks
    const sourceSubstrateName = sourceInkCondition?.substrates?.name || 
                                 sourceInkCondition?.substrate || 
                                 sourceInkCondition?.substrate_name;
    
    // Only filter if we have multiple substrates and a source substrate to exclude
    if (substrates.length > 1 && sourceSubstrateName) {
      const filtered = substrates.filter(substrate => 
        substrate.name.toLowerCase() !== sourceSubstrateName.toLowerCase()
      );
      
      // Safety: if filtering results in empty list, fallback to original
      if (filtered.length === 0) {
        console.log('⚠️ Filtering would result in empty list, using all substrates');
        return substrates;
      }
      
      console.log('✅ Filtered substrates:', { original: substrates.length, filtered: filtered.length });
      return filtered;
    }
    
    console.log('✅ Using all substrates (no filtering needed):', substrates.length);
    return substrates;
  }, [substrates, sourceInkCondition]);

  // Filter substrate conditions for dropdown based on selected substrate
  const allSubstrateConditions = useMemo(() => {
    if (!substrates || !formData.assignedSubstrate || formData.assignedSubstrate === 'create-new') return [];
    
    // Find substrate by name (since assignedSubstrate stores the name, not ID)
    const selectedSubstrate = substrates.find(s => s.name === formData.assignedSubstrate);
    if (!selectedSubstrate) return [];
    
    const conditions = (selectedSubstrate.conditions || []).map(condition => ({
      ...condition,
      substrateName: selectedSubstrate.name,
      displayLabel: condition.displayName || condition.name
    }));

    // If we have a source ink condition and the selected substrate is the same as source substrate,
    // filter out the source substrate condition
    if (sourceInkCondition?.substrates?.name && 
        sourceInkCondition?.substrate_condition &&
        selectedSubstrate.name.toLowerCase() === sourceInkCondition.substrates.name.toLowerCase()) {
      return conditions.filter(condition => 
        condition.name.toLowerCase() !== sourceInkCondition.substrate_condition.toLowerCase()
      );
    }
    
    return conditions;
  }, [substrates, formData.assignedSubstrate, sourceInkCondition]);

  // Fetch substrate condition details when selection changes
  useEffect(() => {
    const fetchSubstrateCondition = async () => {
      debug.log('🔍 Substrate condition selection changed:', formData.assignedSubstrateCondition);
      
      if (!formData.assignedSubstrateCondition || formData.assignedSubstrateCondition === 'create-new') {
        debug.log('❌ No valid substrate condition selected, clearing state');
        setSelectedSubstrateCondition(null);
        setAdaptedColors({ substrate: null, solid: null });
        setDeltaEs({ substrate: null, solid: null });
        return;
      }

      // Optimistic: try to resolve from already loaded list
      const localCandidate = allSubstrateConditions?.find(c => c.id === formData.assignedSubstrateCondition);
      if (localCandidate) {
        debug.log('🧭 Using local substrate condition candidate before fetch:', localCandidate);
        setSelectedSubstrateCondition(localCandidate);
      }

      try {
        debug.log('📡 Fetching substrate condition with ID:', formData.assignedSubstrateCondition);
        debug.log('📡 Available local conditions:', allSubstrateConditions?.map(c => ({ id: c.id, name: c.name })));
        
        const { data, error } = await supabase
          .from('substrate_conditions')
          .select('*')
          .eq('id', formData.assignedSubstrateCondition)
          .maybeSingle();

        if (error) {
          // Handle PostgREST 406 when .single() expects one row but got 0
          console.warn('⚠️ Fetch returned error (may be not found):', error);
        }

        if (!data) {
          console.warn('⚠️ No row found for substrate condition; keeping local candidate if available');
          if (!localCandidate) {
            setSelectedSubstrateCondition(null);
          }
          return;
        }

        debug.log('✅ Substrate condition fetched successfully:', data);
        setSelectedSubstrateCondition(data);
        // Update formData with full object (includes spectral_data needed for adaptation)
        // Only update if the object has changed to prevent circular updates
        if (!formData.selectedSubstrateCondition || formData.selectedSubstrateCondition.id !== data.id) {
          updateFormData({ selectedSubstrateCondition: data });
        }
      } catch (error) {
        console.error('❌ Failed to fetch substrate condition:', error);
        if (!localCandidate) setSelectedSubstrateCondition(null);
      }
    };

    fetchSubstrateCondition();
  }, [formData.assignedSubstrateCondition, allSubstrateConditions]);

  // REMOVED: Old useEffect that used deprecated computeTwoStepSubstrateAdaptation function
  // The new spectral-based adaptation is handled in the useEffect below (line ~768)

  // Track if we should show adapted colors (only when both substrate and condition are selected, not "create-new")
  const showAdaptedColors = useMemo(() => {
    // Never show adapted colors for single-color imports
    // Single-color imports are about assignment, not adaptation
    if (isSingleColor) return false;
    
    return formData.assignedSubstrate && 
           formData.assignedSubstrate !== 'create-new' && 
           formData.assignedSubstrateCondition &&
           formData.assignedSubstrateCondition !== 'create-new';
  }, [formData.assignedSubstrate, formData.assignedSubstrateCondition, isSingleColor]);

  // Store adapted spectral data for all backgrounds (no hex conversion here)
  const [adaptedSpectralByBackground, setAdaptedSpectralByBackground] = useState({});

  useEffect(() => {
    // PRIORITY 1: Check if existing adapted tints are available from the wizard
    if (selectedColor?.adaptedTints && Array.isArray(selectedColor.adaptedTints) && selectedColor.adaptedTints.length > 0) {
      debug.log('✅ Using existing adapted tints, storing as spectral data');
      
      // Convert adapted tints to spectral format grouped by background
      const newAdaptedSpectral = {};
      for (const tint of selectedColor.adaptedTints) {
        const tintPercentage = tint.tintPercentage || tint.percentage || 0;
        const bgName = tint.backgroundName || 'Substrate';
        const tintKey = `tint-${tintPercentage}`;
        
        if (!newAdaptedSpectral[bgName]) {
          newAdaptedSpectral[bgName] = {};
        }
        
        // Store spectral data if available, otherwise store hex for backward compatibility
        if (tint.spectral_data) {
          newAdaptedSpectral[bgName][tintKey] = { spectral_data: tint.spectral_data };
        } else if (tint.colorHex) {
          // Legacy: store hex for now, display will handle it
          newAdaptedSpectral[bgName][tintKey] = { hex: tint.colorHex };
        }
      }
      setAdaptedSpectralByBackground(newAdaptedSpectral);
      return;
    }

    if (!processedTints.length || !selectedSubstrateCondition) {
      setAdaptedSpectralByBackground({});
      return;
    }

    debug.log('🔄 Computing adapted spectral data for all backgrounds');

    const computeAdaptedSpectralData = async () => {
      try {
        const selectedSubstrateSpectral = getSubstrateSpectral(selectedSubstrateCondition);
        if (!selectedSubstrateSpectral) {
          debug.log('❌ No selected substrate spectral data');
          return;
        }

        // Group tints by background
        const tintsByBackground = processedTints.reduce((acc, tint) => {
          const bgName = tint.backgroundName || 'Substrate';
          if (!acc[bgName]) acc[bgName] = [];
          acc[bgName].push(tint);
          return acc;
        }, {});

        debug.log('📦 Tints grouped by background:', {
          backgrounds: Object.keys(tintsByBackground),
          tintCounts: Object.entries(tintsByBackground).map(([bg, tints]) => ({
            background: bg,
            count: tints.length,
            percentages: tints.map(t => t.tintPercentage).sort((a,b) => a-b)
          }))
        });

        const newAdaptedSpectral = {};
        
        // PHASE 1: Calculate substrate change scalars ONCE
        const substrateBackgroundTints = tintsByBackground['Substrate'] || [];
        const trueSubstrateTint = substrateBackgroundTints.find(t => t.tintPercentage === 0) || 
          [...substrateBackgroundTints].sort((a,b) => a.tintPercentage - b.tintPercentage)[0];
        
        if (!trueSubstrateTint) {
          console.warn('❌ No substrate (0%) tint found - cannot adapt');
          return;
        }
        
        const importedSubstrateSpectral = safeSpectralData(trueSubstrateTint);
        if (!importedSubstrateSpectral) {
          console.warn('❌ No spectral data for substrate tint - cannot adapt');
          return;
        }

        // Calculate deltaE directly here to avoid race condition
        // Build orgDefaults with proper shape and fallbacks
        const org = profile?.organization || {};
        const resolveDeltaEMethod = (method) => {
          const map = {
            '1': 'dE76', '2': 'dE94', '3': 'dE00', '5': 'dE00', '6': 'dE00',
            'dE76': 'dE76', 'dE94': 'dE94', 'dE00': 'dE00',
            'dECMC2:1': 'dECMC2:1', 'dECMC1:1': 'dECMC1:1'
          };
          return map[method] || 'dE00';
        };
        const orgDefaults = {
          illuminant: org.default_illuminant || 'D50',
          observer: String(org.default_observer || '2'),
          astmTable: String(org.default_astm_table || '5'),
          deltaEMethod: resolveDeltaEMethod(org.default_delta_e),
        };

        debug.log('🧮 DeltaE calculation inputs:', {
          usingAstmTables: astmTables?.length,
          orgDefaults,
          substrateBackgroundTintCount: substrateBackgroundTints.length
        });

        // Use the correct inputs: array of tints, target spectral, full ASTM tables, org defaults
        const substrateDeltaE = astmTables?.length
          ? calculateSubstrateDeltaE(
              substrateBackgroundTints,  // Array of tints (not single spectral object)
              selectedSubstrateSpectral,
              astmTables,                // Full ASTM table rows
              orgDefaults                // Proper org defaults shape
            )
          : 0;

        // Set deltaE in state for display
        setDeltaEs(prev => ({ ...prev, substrate: substrateDeltaE }));

        const shouldAdapt = substrateDeltaE >= 1;

        debug.log('🔍 Adaptation decision:', {
          shouldAdapt,
          substrateDeltaE,
          threshold: 1
        });

        debug.log('🔬 Substrate basis for scalars:', {
          hasImportedSubstrateSpectral: !!importedSubstrateSpectral,
          hasSelectedSubstrateSpectral: !!selectedSubstrateSpectral,
          importedWavelengths: importedSubstrateSpectral ? Object.keys(importedSubstrateSpectral).length : 0,
          selectedWavelengths: selectedSubstrateSpectral ? Object.keys(selectedSubstrateSpectral).length : 0,
          importedSample: importedSubstrateSpectral ? Object.entries(importedSubstrateSpectral).slice(0, 3) : null,
          selectedSample: selectedSubstrateSpectral ? Object.entries(selectedSubstrateSpectral).slice(0, 3) : null
        });

        // Calculate universal substrate change scalars
        const substrateScalars = shouldAdapt 
          ? calculateSubstrateChangeScalars(importedSubstrateSpectral, selectedSubstrateSpectral)
          : null;

        debug.log('🔧 Calculated substrate scalars:', {
          shouldAdapt,
          hasScalars: !!substrateScalars,
          scalarKeys: substrateScalars ? Object.keys(substrateScalars).length : 0,
          sampleScalars: substrateScalars ? Object.entries(substrateScalars).slice(0, 5).map(([wl, scalar]) => 
            `${wl}nm: ${scalar.toFixed(3)}`
          ) : null
        });

        // CRITICAL: Validate scalars
        if (shouldAdapt && !substrateScalars) {
          console.error('❌ Failed to calculate substrate scalars - adaptation will not work');
          setAdaptedSpectralByBackground({});
          return;
        }

        // Helper to find 0% tint from a background group
        const pickZeroSpectral = (group) => {
          if (!group || group.length === 0) return null;
          const zero = group.find(t => t.tintPercentage === 0) || [...group].sort((a,b)=>a.tintPercentage-b.tintPercentage)[0];
          return zero ? safeSpectralData(zero) : null;
        };

        // Step 1: Identify base substrate spectral (from "Substrate" background)
        const baseSubstrateGroup = tintsByBackground['Substrate'] || tintsByBackground['substrate'];
        const baseSubstrateSpectral = pickZeroSpectral(baseSubstrateGroup);

        if (!baseSubstrateSpectral) {
          console.error('❌ No base substrate spectral found');
          setAdaptedSpectralByBackground({});
          return;
        }

        // Step 2: Calculate additional ink layers for non-Substrate backgrounds
        const additionalInkLayerByBackground = {};
        for (const [backgroundName, tints] of Object.entries(tintsByBackground)) {
          const normalizedBgName = backgroundName.toLowerCase();
          if (normalizedBgName === 'substrate') {
            additionalInkLayerByBackground[backgroundName] = null; // No additional layer
          } else {
            const layeredSpectral = pickZeroSpectral(tints);
            if (layeredSpectral) {
              additionalInkLayerByBackground[backgroundName] = calculateAdditionalInkLayer(
                baseSubstrateSpectral,
                layeredSpectral
              );
              debug.log(`🎨 Calculated additional ink layer for ${backgroundName}`, {
                hasLayer: !!additionalInkLayerByBackground[backgroundName]
              });
            }
          }
        }

        // Use the selected substrate spectral as target (always base substrate)
        const targetSubstrateSpectral = selectedSubstrateSpectral;

        // Step 3: Apply scalars to ALL tints in ALL backgrounds
        let totalAdaptedTints = 0;
        for (const [backgroundName, tints] of Object.entries(tintsByBackground)) {
          newAdaptedSpectral[backgroundName] = {};
          
          debug.log(`🎨 Processing background: ${backgroundName}`, {
            tintCount: tints.length
          });
          
          for (const tint of tints) {
            const tintPercentage = tint.tintPercentage;
            const tintKey = `tint-${tintPercentage}`;
            
            if (shouldAdapt && substrateScalars) {
              const tintImportedSpectral = safeSpectralData(tint);
              
              if (tintImportedSpectral) {
                try {
                  // Step 3a: ALWAYS adapt using base substrate (not background-specific)
                  let adaptedSpectral = applySubstrateScalarsToTint(
                    tintImportedSpectral,       // This tint's imported spectral
                    substrateScalars,           // Universal substrate scalars (SAME for all)
                    targetSubstrateSpectral,    // ALWAYS use base substrate
                    tintPercentage,             // This tint's percentage
                    { enableLogging: false }
                  );
                  
                  // Step 3b: Re-apply additional ink layer for non-Substrate backgrounds
                  const additionalLayer = additionalInkLayerByBackground[backgroundName];
                  if (additionalLayer) {
                    adaptedSpectral = applyAdditionalInkLayer(adaptedSpectral, additionalLayer);
                    debug.log(`  🎨 Applied additional ink layer for ${backgroundName} ${tintPercentage}%`);
                  }
                  
                  newAdaptedSpectral[backgroundName][tintKey] = {
                    spectral_data: adaptedSpectral,
                    backgroundName: backgroundName
                  };
                  totalAdaptedTints++;
                } catch (error) {
                  console.error(`❌ Error adapting ${backgroundName} ${tintPercentage}%:`, error);
                }
              }
            } else {
              // No adaptation needed - use original spectral
              const originalSpectral = safeSpectralData(tint);
              if (originalSpectral) {
                newAdaptedSpectral[backgroundName][tintKey] = {
                  spectral_data: originalSpectral,
                  backgroundName: backgroundName
                };
                totalAdaptedTints++;
              }
            }
          }
        }
        
        debug.log('📊 Final adapted spectral structure:', {
          backgrounds: Object.keys(newAdaptedSpectral),
          totalTints: totalAdaptedTints,
          structure: Object.entries(newAdaptedSpectral).map(([bg, tints]) => ({
            background: bg,
            tintCount: Object.keys(tints).length,
            tints: Object.keys(tints)
          })),
          isEmpty: totalAdaptedTints === 0
        });

        setAdaptedSpectralByBackground(newAdaptedSpectral);
      } catch (error) {
        console.error('❌ Failed to compute adapted spectral data:', error);
        setAdaptedSpectralByBackground({});
      }
    };

    computeAdaptedSpectralData();
  }, [selectedColor, showAdaptedColors, processedTints, selectedSubstrateCondition, astmTables, profile?.organization?.default_delta_e]);

  // Compute hex colors for big appearance boxes from adapted spectral data
  useEffect(() => {
    if (!adaptedSpectralByBackground || Object.keys(adaptedSpectralByBackground).length === 0) {
      setAdaptedColors({ substrate: null, solid: null });
      return;
    }

    const currentBackground = formData.selectedBackground || 'Substrate';
    const bgData = adaptedSpectralByBackground[currentBackground];
    
    if (!bgData) {
      console.log(`⚠️ No adapted spectral data for background: ${currentBackground}`);
      setAdaptedColors({ substrate: null, solid: null });
      return;
    }

    // Extract 0% and 100% (or highest %) spectral data
    const tintKeys = Object.keys(bgData);
    const zeroKey = tintKeys.find(k => k === 'tint-0');
    const solidKey = tintKeys.find(k => k === 'tint-100') || 
      [...tintKeys].sort((a, b) => {
        const pctA = parseInt(a.split('-')[1]);
        const pctB = parseInt(b.split('-')[1]);
        return pctB - pctA;
      })[0];

    // Convert spectral to hex
    const org = profile?.organization || {};
    const illuminant = org.default_illuminant || 'D50';
    const observer = String(org.default_observer || '2');
    const astmTable = String(org.default_astm_table || '5');

    const computeHex = (tintData) => {
      if (!tintData) return null;
      
      // Build org defaults object matching the format used by small wedges
      const orgDefaults = {
        default_illuminant: illuminant,
        default_observer: observer,
        default_astm_table: astmTable
      };
      
      // Use computeDefaultDisplayColor for consistency with small wedges
      // This handles spectral data, Lab fallback, and hex fallback automatically
      const result = computeDefaultDisplayColor(
        tintData,
        orgDefaults,
        astmTables,
        'adapted'
      );
      
      return result?.hex || null;
    };

    const substrateHex = zeroKey ? computeHex(bgData[zeroKey]) : null;
    const solidHex = solidKey ? computeHex(bgData[solidKey]) : null;

    console.log('🎨 Big box colors computed:', {
      background: currentBackground,
      substrateHex,
      solidHex,
      zeroKey,
      solidKey
    });

    setAdaptedColors({ substrate: substrateHex, solid: solidHex });
  }, [adaptedSpectralByBackground, formData.selectedBackground, astmTables, profile?.organization]);

  return (
    <div className="space-y-6 pt-4 px-4 pb-4">
      {/* Ink Wedge Display */}
      <div className="space-y-3 -mt-2">
        {/* Background selector - show if multiple backgrounds available and not single color */}
        {!isSingleColor && (() => {
          // Extract available backgrounds from actual tint data
          const availableBackgrounds = [...new Set(
            processedTints
              .map(tint => tint.backgroundName || 'Substrate')
              .filter(Boolean)
          )].sort();
          
          // Ensure "Substrate" is always first in the list when available
          const sortedBackgrounds = availableBackgrounds.sort((a, b) => {
            if (a === 'Substrate') return -1;
            if (b === 'Substrate') return 1;
            return a.localeCompare(b);
          });

          // Default to "Substrate" if not set and available
          const currentBackground = formData.selectedBackground || 
            (sortedBackgrounds.includes('Substrate') ? 'Substrate' : sortedBackgrounds[0]);

          return availableBackgrounds.length > 1 ? (
            <div className="flex justify-center mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Background:</span>
                <Select 
                  value={currentBackground} 
                  onValueChange={(value) => updateFormData({ selectedBackground: value })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedBackgrounds.map((background) => (
                      <SelectItem key={background} value={background}>
                        {background}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null;
        })()}
        
        {/* Single Color Full-Width Block for CxF3 or Tint Strip for multi-tint */}
        {isSingleColor ? (
          <div className="space-y-3">
            {(() => {
              // Enhanced color and name resolution for single color mode
              // Priority 1: Original color data to prevent flash
              const displayColor = selectedColor?.colorHex || 
                                   selectedColor?.hex || 
                                   selectedColor?.displayHex ||
                                   // Prefer original solid tint hex before any computed value
                                   solidTint?.colorHex ||
                                   // Only use computed values if ASTM table is ready
                                   (weightingTable && solidTint?.computedHex) ||
                                   // Safe fallback to processed tints
                                   processedTints?.[0]?.computedHex ||
                                   // Neutral gray (NOT black)
                                   '#9CA3AF';
              
              
              const displayName = selectedColor?.name || 
                                  selectedColor?.colorName ||
                                  processedTints?.[0]?.name ||
                                  (cxfColors?.length === 1 ? 'Imported Color' : 'Single Color');

              // Squares preview (requested): Substrate + Solid
              // When no target substrate selected, show imported substrate from source
              const actualSubstrateTint = processedTints.find(t => t.tintPercentage === 0);
              const adaptedZeroHex = (effectiveMode === 'adapted' && Array.isArray(selectedColor?.adaptedTints))
                ? (selectedColor.adaptedTints.find(t => (t.tintPercentage || t.percentage || 0) === 0)?.colorHex || null)
                : null;
              const substrateImportedHex = !selectedSubstrateCondition 
                ? (actualSubstrateTint?.computedHex || '#FFFFFF') // Show imported substrate when no target selected
                : (adaptedZeroHex || selectedSubstrateCondition?.color_hex || '#FFFFFF'); // Show target substrate when selected
              
              console.log('🔧 DEBUG: Substrate color selection:', {
                selectedSubstrateCondition: !!selectedSubstrateCondition,
                actualSubstrateTintHex: actualSubstrateTint?.computedHex,
                selectedSubstrateConditionHex: selectedSubstrateCondition?.color_hex,
                finalSubstrateHex: substrateImportedHex
              });
              
              console.log('🎨 Substrate color calculation:', {
                selectedSubstrateCondition: !!selectedSubstrateCondition,
                substrateConditionHex: selectedSubstrateCondition?.color_hex,
                actualSubstrateTint: actualSubstrateTint ? { percentage: actualSubstrateTint.tintPercentage, hex: actualSubstrateTint.computedHex } : null,
                finalSubstrateHex: substrateImportedHex
              });
              const substrateAdaptedHex = showAdaptedColors ? adaptedColors.substrate : null;
              const solidImportedHex = displayColor;
              const solidAdaptedHex = showAdaptedColors ? (adaptedColors.solid || null) : null;
              
               console.log('🎨 Single color rendering with:', {
                displayColor,
                hasProcessedTints: processedTints?.length > 0,
                selectedColorHex: selectedColor?.colorHex || selectedColor?.hex,
                isSingleColor,
                solidTint: solidTint ? { computedHex: solidTint.computedHex, name: solidTint.name } : null,
                hasWeightingTable: !!weightingTable,
                displayName,
                processedTintsLength: processedTints?.length || 0
              });
              
              return (
                <>
                  {/* Small squares row - only show for multi-tint mode */}
                  {!isSingleColor && (
                    <div className="flex gap-6 justify-center">
                      {/* Substrate square */}
                      <div className="flex flex-col items-center gap-1">
                        {substrateAdaptedHex ? (
                          <DiagonalSplitPatch
                            importedColor={substrateImportedHex}
                            adaptedColor={substrateAdaptedHex}
                            size="w-10 h-10"
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded border border-border"
                            style={{ backgroundColor: substrateImportedHex }}
                          />
                        )}
                        <span className="text-xs text-muted-foreground">Substrate</span>
                      </div>

                      {/* Solid square */}
                      <div className="flex flex-col items-center gap-1">
                        {solidAdaptedHex ? (
                          <DiagonalSplitPatch
                            importedColor={solidImportedHex}
                            adaptedColor={solidAdaptedHex}
                            size="w-10 h-10"
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded border border-border"
                            style={{ backgroundColor: solidImportedHex }}
                          />
                        )}
                        <span className="text-xs text-muted-foreground">Solid</span>
                      </div>
                    </div>
                  )}

                  {/* Full-width block below (kept for clarity) */}
                  {showAdaptedColors ? (
                    // Split display: substrate condition on left, imported solid on right
                    <div className="flex gap-2 w-full">
                      <div className="flex-1 space-y-2">
                        {substrateAdaptedHex ? (
                          <>
                            {console.info('🧩 Big box (Substrate - single): showSplit=', true)}
                            <DiagonalSplitPatch
                              importedColor={substrateImportedHex}
                              adaptedColor={substrateAdaptedHex}
                              size="w-full h-20"
                              showLabels={true}
                            />
                          </>
                        ) : (
                          <>
                            {console.info('🧩 Big box (Substrate - single): showSplit=', false)}
                            <div
                              className="w-full h-20 rounded border border-border"
                              style={{ backgroundColor: substrateImportedHex }}
                            />
                          </>
                        )}
                        <div className="text-center">
                          <div className="text-sm font-medium text-muted-foreground">
                            {selectedSubstrateCondition ? 'Target Substrate' : 'Imported Substrate'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {selectedSubstrateCondition 
                              ? `${filteredSubstrates.find(s => s.name === formData.assignedSubstrate)?.name || formData.assignedSubstrate} - ${selectedSubstrateCondition?.name}`
                              : (sourceInkCondition?.substrates?.name ? `${sourceInkCondition.substrates.name} - ${sourceInkCondition.substrate_condition}` : 'Source Substrate')
                            }
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 space-y-2">
                        {solidAdaptedHex ? (
                          <>
                            {console.info('🧩 Big box (Solid - single): showSplit=', true)}
                            <DiagonalSplitPatch
                              importedColor={solidImportedHex}
                              adaptedColor={solidAdaptedHex}
                              size="w-full h-20"
                              showLabels={true}
                            />
                          </>
                        ) : (
                          <>
                            {console.info('🧩 Big box (Solid - single): showSplit=', false)}
                            <div
                              className="w-full h-20 rounded border border-border"
                              style={{ backgroundColor: displayColor }}
                            />
                          </>
                        )}
                        <div className="text-center">
                          <div className="text-sm font-medium text-muted-foreground">Imported Solid</div>
                          <div className="text-xs text-muted-foreground">{displayName}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Single-color import: Show both substrate and solid side-by-side without adaptation
                    isSingleColor && selectedSubstrateCondition ? (
                      <div className="flex gap-2 w-full">
                        <div className="flex-1 space-y-2">
                          <div
                            className="w-full h-20 rounded border border-border"
                            style={{ backgroundColor: substrateImportedHex }}
                          />
                          <div className="text-center">
                            <div className="text-sm font-medium text-muted-foreground">Substrate</div>
                            <div className="text-xs text-muted-foreground">
                              {filteredSubstrates.find(s => s.name === formData.assignedSubstrate)?.name || formData.assignedSubstrate} - {selectedSubstrateCondition?.name}
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 space-y-2">
                          <div
                            className="w-full h-20 rounded border border-border"
                            style={{ backgroundColor: displayColor }}
                          />
                          <div className="text-center">
                            <div className="text-sm font-medium text-muted-foreground">Solid Ink</div>
                            <div className="text-xs text-muted-foreground">{displayName}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Single full-width block showing imported color
                      <div className="space-y-3">
                        <div
                          className="w-full h-20 rounded border border-border"
                          style={{ backgroundColor: displayColor }}
                        />
                        <div className="text-center">
                          <div className="text-lg font-medium">{displayName}</div>
                          <div className="text-sm text-muted-foreground">{displayColor}</div>
                        </div>
                      </div>
                    )
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="flex gap-1 justify-center flex-wrap">
            {(() => {
              // Filter tints by selected background first
              const filteredTints = processedTints.filter(tint => {
                const shouldInclude = !formData.selectedBackground || 
                  tint.backgroundName === formData.selectedBackground || 
                  (!tint.backgroundName && formData.selectedBackground === 'Substrate');
                return shouldInclude;
              });
              
              // Deduplicate by percentage within the selected background - keep the first occurrence
              const deduplicatedTints = [];
              const seenPercentages = new Set();
              
              for (const tint of filteredTints) {
                if (!seenPercentages.has(tint.tintPercentage)) {
                  seenPercentages.add(tint.tintPercentage);
                  deduplicatedTints.push(tint);
                }
              }
              
              return deduplicatedTints
                .slice(0, 11)
                .map((tint) => {
              const tintHex = tint.computedHex || '#FFFFFF';
              const tintKey = `tint-${tint.tintPercentage}`;
              const currentBackground = formData.selectedBackground || 'Substrate';
              const adaptedSpectralData = adaptedSpectralByBackground[currentBackground]?.[tintKey];
              
              // Compute hex from spectral on-demand
              let adaptedHex = null;
              if (adaptedSpectralData?.spectral_data && weightingTable) {
                const orgDefaults = {
                  default_illuminant: profile?.organization?.default_illuminant || 'D50',
                  default_observer: profile?.organization?.default_observer || '2',
                  default_astm_table: profile?.organization?.default_astm_table || '5'
                };
                const result = computeDefaultDisplayColor(
                  adaptedSpectralData,
                  orgDefaults,
                  astmTables,
                  'adapted'
                );
                adaptedHex = result?.hex;
              } else if (adaptedSpectralData?.hex) {
                // Legacy: use stored hex if spectral not available
                adaptedHex = adaptedSpectralData.hex;
              }
              
              return (
                <div key={tintKey} className="flex flex-col items-center gap-1">
                  {adaptedHex ? (
                    <DiagonalSplitPatch
                      importedColor={tintHex}
                      adaptedColor={adaptedHex}
                      size="w-8 h-8 sm:w-10 sm:h-10"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded border border-border"
                      style={{ backgroundColor: tintHex }}
                    />
                  )}
                  {/* Tint percentage label */}
                  <span className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-center">
                    {tint.tintPercentage}%
                  </span>
                </div>
              );
            });
            })()}
          </div>
        )}

        {/* Substrate and Solid blocks - only show for multi-tint imports */}
        {!isSingleColor && (
          <div className="flex gap-4 w-full">
            {(() => {
              // Filter substrate and solid based on selected background
              const filteredSubstrate = !formData.selectedBackground || 
                substrateTint?.backgroundName === formData.selectedBackground || 
                (!substrateTint?.backgroundName && formData.selectedBackground === 'Substrate') ? substrateTint : null;
              
              const filteredSolid = !formData.selectedBackground || 
                solidTint?.backgroundName === formData.selectedBackground || 
                (!solidTint?.backgroundName && formData.selectedBackground === 'Substrate') ? solidTint : null;
              
              return (
                <>
                   {filteredSubstrate && (
                     <div className="flex-1 space-y-2">
                       {showAdaptedColors && adaptedColors.substrate ? (
                         <>
                           {console.info('🧩 Big box (Substrate - multi): showSplit=', true)}
                           <DiagonalSplitPatch
                             importedColor={filteredSubstrate.computedHex || '#FFFFFF'}
                             adaptedColor={adaptedColors.substrate}
                             size="w-full h-20"
                             showLabels={true}
                           />
                         </>
                        ) : (
                          <>
                            {console.info('🧩 Big box (Substrate - multi): showSplit=', false)}
                            <div
                              className="w-full h-20 rounded border border-border"
                               style={{ backgroundColor: !selectedSubstrateCondition 
                                 ? (filteredSubstrate.computedHex || '#FFFFFF') // Show imported substrate when no target selected
                                 : (effectiveMode === 'adapted' ? (selectedColor?.adaptedTints?.find(t => (t.tintPercentage || t.percentage || 0) === 0)?.colorHex || adaptedColors.substrate) : (filteredSubstrate.computedHex)) || '#FFFFFF'
                              }}
                            />
                          </>
                        )}
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">
                            {selectedSubstrateCondition ? 'Target Substrate' : 'Imported Substrate'}
                          </span>
                          {deltaEs.substrate !== null && selectedSubstrateCondition && (
                            <span className="font-mono text-xs text-muted-foreground">
                              ΔE {deltaEs.substrate.toFixed(2)}
                            </span>
                          )}
                        </div>
                     </div>
                   )}

                   {filteredSolid && (() => {
                     const tintKey = `tint-${filteredSolid.tintPercentage}`;
                     const currentBackground = formData.selectedBackground || 'Substrate';
                     const adaptedSpectralData = adaptedSpectralByBackground[currentBackground]?.[tintKey];
                     
                     // Compute hex from spectral on-demand (like imported tints do)
                     let adaptedSolidHex = null;
                     if (adaptedSpectralData?.spectral_data && weightingTable) {
                       const orgDefaults = {
                         default_illuminant: profile?.organization?.default_illuminant || 'D50',
                         default_observer: profile?.organization?.default_observer || '2',
                         default_astm_table: profile?.organization?.default_astm_table || '5'
                       };
                       const result = computeDefaultDisplayColor(
                         adaptedSpectralData,
                         orgDefaults,
                         astmTables,
                         'adapted'
                       );
                       adaptedSolidHex = result?.hex;
                     } else if (adaptedSpectralData?.hex) {
                       // Legacy: use stored hex if spectral not available
                       adaptedSolidHex = adaptedSpectralData.hex;
                     }
                     
                     // Fallback to old adaptedColors.solid if needed
                     adaptedSolidHex = adaptedSolidHex || adaptedColors.solid || null;
                     
                      return (
                        <div className="flex-1 space-y-2">
                          {showAdaptedColors && adaptedSolidHex ? (
                            <>
                              {console.info('🧩 Big box (Solid - multi): showSplit=', true)}
                              <DiagonalSplitPatch
                                importedColor={filteredSolid.computedHex || '#FFFFFF'}
                                adaptedColor={adaptedSolidHex}
                                size="w-full h-20"
                                showLabels={true}
                              />
                            </>
                         ) : (
                           <>
                             {console.info('🧩 Big box (Solid - multi): showSplit=', false)}
                             <div
                               className="w-full h-20 rounded border border-border"
                               style={{ backgroundColor: filteredSolid.computedHex || '#FFFFFF' }}
                             />
                           </>
                         )}
                         <div className="flex justify-between items-center text-sm">
                           <span className="text-muted-foreground">Solid</span>
                           {deltaEs.solid !== null && (
                             <span className="font-mono text-xs text-muted-foreground">
                               ΔE {deltaEs.solid.toFixed(2)}
                             </span>
                           )}
                         </div>
                        </div>
                      );
                   })()}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Assignment Fields - replace text inputs with dropdowns */}
      <div className="space-y-3 mt-4">
        <div className="space-y-2">
          <Label htmlFor="assignSubstrate" className="text-sm font-medium text-muted-foreground">
            Substrate
          </Label>
          <Select 
            value={formData.assignedSubstrate || undefined}
            onValueChange={(value) => {
              // Find the substrate object by name from filtered list
              const selectedSubstrate = filteredSubstrates?.find(s => s.name === value);
              updateFormData({ 
                assignedSubstrate: value,
                selectedSubstrate: selectedSubstrate || null,
                assignedSubstrateCondition: '' // Reset substrate condition when substrate changes
              });
            }}
          >
            <SelectTrigger className="h-9 bg-background">
              <SelectValue placeholder="Select Substrate" />
            </SelectTrigger>
            <SelectContent className="z-50 bg-background">
              {!hideCreateNew && !isSingleColor && (
                <SelectItem value="create-new">Create new</SelectItem>
              )}
              {(filteredSubstrates || [])
                .filter(s => s?.name && String(s.name).trim().length > 0)
                .map(substrate => (
                  <SelectItem key={substrate.id} value={substrate.name}>
                    {substrate.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Show substrate condition dropdown when an existing substrate is selected (hide when creating new) */}
        {formData.assignedSubstrate && formData.assignedSubstrate !== 'create-new' && (
          <div className="space-y-2">
            <Label htmlFor="assignSubstrateCondition" className="text-sm font-medium text-muted-foreground">
              Substrate Condition
            </Label>
            <Select 
              value={formData.assignedSubstrateCondition || undefined} 
              onValueChange={(value) => {
                // Find the substrate condition object by ID
                const selectedCondition = allSubstrateConditions?.find(c => c.id === value);
                updateFormData({ 
                  assignedSubstrateCondition: value,
                  selectedSubstrateCondition: selectedCondition || null
                });
              }}
            >
              <SelectTrigger className="h-9 bg-background">
                <SelectValue placeholder="Select Substrate Condition" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                {!hideCreateNew && !isSingleColor && (
                  <SelectItem value="create-new">Create new</SelectItem>
                )}
                {allSubstrateConditions.map(condition => (
                  <SelectItem key={condition.id} value={condition.id}>
                    {condition.displayLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Ink selection dropdown - hide when adapting from source ink condition */}
        {!sourceInkCondition && (
          <div className="space-y-2">
            <Label htmlFor="assignInk" className="text-sm font-medium text-muted-foreground">
              Ink
            </Label>
            <Select 
              value={formData.assignedInk || undefined}
              onValueChange={(value) => {
                if (value === 'create-new') {
                  updateFormData({ 
                    assignedInk: 'create-new',
                    selectedInk: null
                  });
                } else {
                  // Find the ink object by ID
                  const selectedInk = allInks?.find(ink => ink.id === value);
                  updateFormData({ 
                    assignedInk: selectedInk?.id || 'create-new',
                    selectedInk: selectedInk || null
                  });
                }
              }}
            >
              <SelectTrigger className="h-9 bg-background">
                <SelectValue placeholder="Select Ink" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                <SelectItem value="create-new">Create new</SelectItem>
                {allInks?.filter(ink => ink?.name && String(ink.name).trim().length > 0).map(ink => (
                  <SelectItem key={ink.id} value={ink.id}>
                    {ink.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
      </div>
    </div>
  );
};

export default SelectSubstrateStep;