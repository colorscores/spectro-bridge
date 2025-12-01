import { useRef, useState, useEffect, useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useCxfParser } from '@/hooks/useCxfParser';
import { labToHex, labToHexD65, extractSpectralData, spectralToLabASTME308, computeDefaultDisplayColor, getBestColorHex } from '@/lib/colorUtils';
import { useAppContext } from '@/context/AppContext';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';


// Helper: pick correct ASTM E308 weighting table based on org defaults
const getOrgWeightingTable = (orgDefaults = {}, astmTables = []) => {
  if (!Array.isArray(astmTables) || astmTables.length === 0) return null;
  const illuminant = orgDefaults.default_illuminant || 'D50';
  const observer = String(orgDefaults.default_observer || '2');
  const tableNumber = String(orgDefaults.default_astm_table || orgDefaults.default_table || '5');

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

  // Fallback to D50/2°/Table 5 or first available combination
  const fallback = astmTables.filter(t =>
    t.illuminant_name === 'D50' && String(t.observer) === '2' && String(t.table_number) === '5'
  );
  if (fallback.length > 0) return pickAndNormalize(fallback);

  // Last resort: normalize all rows so downstream code doesn't crash
  return pickAndNormalize(astmTables);
};

/**
 * Legacy CxF import hook - now uses unified parser
 * Maintained for backward compatibility
 */
export const useCxfImport = (onSuccess, profile) => {
  const [isCxfAddOpen, setIsCxfAddOpen] = useState(false);
  const [cxfColors, setCxfColors] = useState([]);
  const [isTransforming, setIsTransforming] = useState(false);
  const [fileMetadata, setFileMetadata] = useState(null);
  
  // Call hooks at the top level - never conditionally
  const licenses = useMemo(() => ({
    libraries: { plan: profile?.organization?.color_libraries_license || 'Free' }
  }), [profile?.organization?.color_libraries_license]);
  const { addColorsOptimistically, refetch } = useAppContext();
  const { astmTables } = useAstmTablesCache();
  const cxfParserInstance = useCxfParser();
  const { 
    fileInputRef, 
    isLoading, 
    triggerFileInput, 
    handleFileChange,
    resetState, // Add resetState from parser
    parseProgress, // Add parseProgress from parser
    subscribeToProgress,
    fileMetadata: parserFileMetadata
  } = cxfParserInstance;
  
  // Track parse progress with React state for reactivity
  const [localParseProgress, setLocalParseProgress] = useState(null);
  
  useEffect(() => {
    const unsubscribe = subscribeToProgress((progress) => {
      setLocalParseProgress(progress);
    });
    return unsubscribe;
  }, [subscribeToProgress]);
  
  // Validate profile after hooks are called
  if (!profile?.organization_id) {
    console.warn('useCxfImport: No profile provided or missing organization_id');
  }

  // Add comprehensive state reset function
  const resetAllImportState = () => {
    console.log('[CxfImport] Resetting all import state');
    setIsCxfAddOpen(false);
    setCxfColors([]);
    setIsTransforming(false);
    setLocalParseProgress(null); // Reset progress state
    setFileMetadata(null); // Clear file metadata to hide warning dialog
    if (fileInputRef?.current) {
      fileInputRef.current.value = ''; // Clear file input
    }
    resetState(); // Reset parser state
  };

  // Reset progress when dialog closes
  useEffect(() => {
    if (!isCxfAddOpen && localParseProgress) {
      console.log('[CxfImport] Dialog closed, resetting progress state');
      setLocalParseProgress(null);
    }
  }, [isCxfAddOpen, localParseProgress]);

  // Recompute colors when ASTM tables become available
  useEffect(() => {
    if (astmTables && astmTables.length > 0 && cxfColors.length > 0) {
      console.log('[CXF-RECOMPUTE] ASTM tables loaded, attempting safe recompute for colors missing valid hex/Lab');

      const orgDefaults = profile?.organization || {};
      const weightingTable = getOrgWeightingTable(orgDefaults, astmTables);
      let hasUpdates = false;

      const updatedColors = cxfColors.map(color => {
        let updated = { ...color };

        // Recompute hex if missing
        const currentValidHex = getBestColorHex(updated);
        const primarySpectral = updated.spectral_data || extractSpectralData(updated, updated.name);
        if (!currentValidHex && primarySpectral) {
          const sourceForHex = { spectral_data: primarySpectral };
          const result = computeDefaultDisplayColor(sourceForHex, orgDefaults, astmTables);
          const spectralHex = result?.hex;
          if (spectralHex) {
            console.log(`[CXF-RECOMPUTE] Computed hex for ${updated.name}: ${spectralHex}`);
            updated.hex = spectralHex;
            updated.colorHex = spectralHex;
            hasUpdates = true;
          }
        }

        // Recompute Lab for display if missing/placeholder and spectral exists
        const currentLab = updated.lab || (updated.measurements && updated.measurements[0]?.lab) || null;
        const hasLab = currentLab && typeof currentLab.L === 'number' && typeof currentLab.a === 'number' && typeof currentLab.b === 'number';
        const isPlaceholderLab = hasLab && ((currentLab.L === 50 && currentLab.a === 0 && currentLab.b === 0) || (currentLab.L === 0 && currentLab.a === 0 && currentLab.b === 0));
        if ((!hasLab || isPlaceholderLab) && primarySpectral) {
          try {
            const computedLab = weightingTable ? spectralToLabASTME308(primarySpectral, weightingTable) : null;
            if (computedLab && typeof computedLab.L === 'number') {
              updated.lab = { L: computedLab.L, a: computedLab.a, b: computedLab.b, illuminant: computedLab.illuminant || 'D50' };
              if (updated.measurements && updated.measurements[0]) {
                updated.measurements = [
                  { ...updated.measurements[0], lab: updated.lab },
                  ...updated.measurements.slice(1)
                ];
              }
              hasUpdates = true;
            }
          } catch (e) {
            console.warn(`[CXF-RECOMPUTE] Failed to compute Lab for ${updated.name}:`, e?.message);
          }
        }

        return updated;
      });

      if (hasUpdates) setCxfColors(updatedColors);
    }
  }, [astmTables, cxfColors, profile?.organization]);

  const handleAddColorClick = () => {
    triggerFileInput();
  };

  const handleFileChangeWrapper = async (event) => {
    const file = event?.target?.files?.[0];
    console.log('🔧 CxF file selected:', file?.name);
    console.log('🔧 Using CxF Parser V1');
    
    // Set file metadata immediately for reactive UI
    if (file) {
      const sizeKB = (file.size / 1024).toFixed(2);
      const estimatedColors = Math.floor(file.size / 200);
      const isLarge = file.size > 500000 || estimatedColors > 500;
      setFileMetadata({ name: file.name, sizeKB, estimatedColors, isLarge });
    }
    
    // Go directly to V1 parsing
    handleParsing(event);
  };


  const handleParsing = (event) => {
    // V1 parser with simple colors array and needsModeSelection flag
    handleFileChange(event, async (colors, needsModeSelection = false) => {
      console.log('🎨 Starting color transformation (V1):', {
        totalColors: colors?.length,
        needsModeSelection
      });
      
      setIsTransforming(true);
      
      try {
        // Transform colors in chunks to prevent UI blocking
        const transformedColors = await transformColorsInChunks(colors);
        
        console.log('✅ Color transformation complete:', {
          originalCount: colors?.length,
          transformedCount: transformedColors.length,
          filtered: (colors?.length || 0) - transformedColors.length,
          needsModeSelection
        });
        
        setCxfColors(transformedColors);
        // V1 parser - go directly to dialog (mode selection handled within dialog)
        setIsCxfAddOpen(true);
      } catch (error) {
        console.error('❌ Color transformation failed:', error);
        toast({ title: 'Error processing colors', description: error.message, variant: 'destructive' });
        resetAllImportState(); // Reset state on error
      } finally {
        setIsTransforming(false);
      }
    }, (error) => {
      console.error('❌ CxF parsing failed (V1):', error);
      toast({ title: 'Error parsing CxF file (V1)', description: error.message, variant: 'destructive' });
      resetAllImportState(); // Reset state on error
      setIsTransforming(false);
    });
  };

  // Transform colors in chunks to prevent UI blocking
  const transformColorsInChunks = (colors) => {
  return new Promise((resolve) => {
    const chunkSize = 100;
    const transformedColors = [];
    let currentIndex = 0;
    const orgDefaultsGlobal = profile?.organization || {};
    const weightingTable = getOrgWeightingTable(orgDefaultsGlobal, astmTables);

      const processChunk = () => {
        const endIndex = Math.min(currentIndex + chunkSize, colors.length);
        
        for (let i = currentIndex; i < endIndex; i++) {
          const color = colors[i];
          
          // Skip colors without valid data
          if (!color.name || (!color.hex && !color.lab && !color.measurements?.length)) {
            continue;
          }
          
          // Normalize measurements and spectral data using utility function
          let measurements = [];
          if (Array.isArray(color.measurements)) {
            measurements = color.measurements.map(m => ({
              ...m,
              mode: m.assignedMode ?? m.mode,
              spectral_data: m.spectral_data || extractSpectralData(m, `measurement for ${color.name}`)
            }));
          } else if (color.measurements && typeof color.measurements === 'object') {
            measurements = Object.entries(color.measurements).map(([modeKey, m]) => ({
              mode: m?.assignedMode ?? m?.mode ?? (modeKey.startsWith('mode_') ? null : modeKey) ?? color.measurementMode ?? null,
              spectral_data: m?.spectral_data || extractSpectralData(m, `measurement ${modeKey} for ${color.name}`),
              lab: m?.lab || null,
              rgb: m?.rgb || null,
            }));
          } else {
            // Check for spectral data at color level
            const spectralData = extractSpectralData(color, color.name);
            if (spectralData) {
              measurements = [{
                mode: color.assignedMode ?? color.measurementMode ?? null,
                spectral_data: spectralData,
                lab: color.lab || null,
                rgb: color.rgb || null,
              }];
            }
          }

          // Get the best available color hex, prioritizing parser-provided valid values
          let hex = getBestColorHex(color);

          const orgDefaults = profile?.organization || {};
          const primarySpectral = (measurements[0] && measurements[0].spectral_data) || extractSpectralData(color, color.name) || null;

          // Compute LAB for display if missing or placeholder and spectral exists
          let displayLab = color.lab || (measurements[0] && measurements[0].lab) || null;
          const hasDisplayLab = displayLab && typeof displayLab.L === 'number' && typeof displayLab.a === 'number' && typeof displayLab.b === 'number';
          const isPlaceholderLab = hasDisplayLab && ((displayLab.L === 50 && displayLab.a === 0 && displayLab.b === 0) || (displayLab.L === 0 && displayLab.a === 0 && displayLab.b === 0));
          if ((!hasDisplayLab || isPlaceholderLab) && primarySpectral && astmTables && astmTables.length > 0) {
            try {
              const computedLab = weightingTable ? spectralToLabASTME308(primarySpectral, weightingTable) : null;
              if (computedLab && typeof computedLab.L === 'number') {
                displayLab = { L: computedLab.L, a: computedLab.a, b: computedLab.b, illuminant: computedLab.illuminant || 'D50' };
                if (measurements[0]) {
                  measurements[0] = { ...measurements[0], lab: displayLab };
                }
              }
            } catch (e) {
              console.warn(`[CXF-COLOR] Failed computing LAB from spectral for ${color.name}:`, e?.message);
            }
          }

          if (!hex) {
            // Only compute from spectral if parser didn't provide a valid display color
            if (primarySpectral && astmTables && astmTables.length > 0) {
              console.log(`[CXF-COLOR] Computing from spectral for ${color.name}`);
              const sourceForHex = { spectral_data: primarySpectral };
              const result = computeDefaultDisplayColor(sourceForHex, orgDefaults, astmTables);
              const spectralHex = result?.hex;
              if (spectralHex) {
                hex = spectralHex;
              }
            }

            // If still no hex, try Lab (avoid placeholder Lab: L=50,a=0,b=0)
            if (!hex) {
              const isPlaceholderLab = color.lab && color.lab.L === 50 && color.lab.a === 0 && color.lab.b === 0;
              if (color.lab && !isPlaceholderLab) {
                console.log(`[CXF-COLOR] Using Lab for ${color.name}:`, color.lab);
                hex = labToHexD65(color.lab.L, color.lab.a, color.lab.b, color.lab.illuminant || 'D50');
              } else if (primarySpectral) {
                console.log(`[CXF-COLOR] Spectral present but ASTM tables unavailable for ${color.name}; using temporary placeholder`);
                hex = '#E5E7EB';
              } else {
                // No spectral, no valid Lab - mark for data quality warning
                console.warn(`[CXF-COLOR] ${color.name} has no authentic colorimetric data (spectral or Lab)`);
                hex = '#CCCCCC'; // Gray placeholder to indicate missing colorimetric data
              }
            }

            // Final fallback - mark as missing colorimetric data
            if (!hex) {
              hex = '#CCCCCC'; // Gray to indicate missing data
              console.warn(`[CXF-COLOR] ${color.name} has no valid colorimetric data - using placeholder`);
            }
          }

          console.log(`[CXF-COLOR] Final hex for ${color.name}: ${hex}`);

          transformedColors.push({
            ...color,
            hex,
            colorHex: hex,
            lab: displayLab || color.lab || null,
            measurements,
            spectral_data: extractSpectralData(color, color.name),
          });
        }

        currentIndex = endIndex;

        if (currentIndex < colors.length) {
          // Continue processing next chunk
          setTimeout(processChunk, 0);
        } else {
          // All chunks processed
          resolve(transformedColors);
        }
      };

      processChunk();
    });
  };

  const handleAddColorsFromCxf = async (selectedColors) => {
    if (selectedColors.length === 0) {
      toast({ title: 'No colors selected', description: 'No colors selected to import.', variant: 'destructive' });
      return;
    }

    // Validate data quality and warn about colors lacking authentic colorimetric data
    const lowQualityColors = selectedColors.filter(color => {
      const hasSpectral = !!(color.spectral_data || extractSpectralData(color, color.name));
      const hasValidLab = !!(color.lab && color.lab.L !== 50 && !(color.lab.a === 0 && color.lab.b === 0));
      const hasMeasurementLab = !!(color.measurements && Array.isArray(color.measurements) && 
        color.measurements.some(m => m.lab && m.lab.L !== 50));
      
      return !hasSpectral && !hasValidLab && !hasMeasurementLab;
    });

    if (lowQualityColors.length > 0) {
      const colorNames = lowQualityColors.slice(0, 3).map(c => c.name).join(', ');
      const remainingCount = lowQualityColors.length - 3;
      const message = `${lowQualityColors.length} color${lowQualityColors.length > 1 ? 's' : ''} lack authentic colorimetric data (spectral or Lab): ${colorNames}${remainingCount > 0 ? ` and ${remainingCount} more` : ''}. These colors cannot be used for accurate color matching or quality assessment.`;
      
      toast({
        title: 'Data Quality Warning',
        description: message,
        variant: 'default' // Not destructive as import can still proceed
      });
    }

    // Check color limit for free library accounts
    if (licenses.libraries?.plan === 'Free') {
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

    // Optimistically add colors to UI immediately for instant feedback
    console.log('🚀 Adding colors optimistically for immediate UI update');
    
    const optimisticColors = selectedColors.map(color => ({
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`, // Temporary ID
      name: color.name,
      hex: color.hex || color.colorHex,
      type: color.standard_type || color.type || 'master',
      standard_type: color.standard_type || 'master',
      measurements: color.measurements || [],
      tags: [],
      book_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      organization_id: profile.organization_id,
      user_id: profile.id,
      _optimistic: true
    }));
    
    addColorsOptimistically(optimisticColors);

    const loadingToast = toast({ title: 'Importing colors...', description: 'Please wait while we import your colors.' });

    try {
      // Transform colors back to database format
      const colorsData = selectedColors.map(color => {
        let hex = color.hex || color.colorHex;
        if (!hex) {
          const orgDefaults = profile?.organization || {};
          const primarySpectral = (color.measurements && color.measurements[0] && color.measurements[0].spectral_data) || extractSpectralData(color, color.name) || null;
          const sourceForHex = {};
          if (primarySpectral) {
            sourceForHex.spectral_data = primarySpectral;
          } else if (color.lab) {
            sourceForHex.lab_l = color.lab.L;
            sourceForHex.lab_a = color.lab.a;
            sourceForHex.lab_b = color.lab.b;
            sourceForHex.lab_illuminant = color.lab.illuminant || 'D50';
          }
          const result = computeDefaultDisplayColor(sourceForHex, orgDefaults, astmTables);
          hex = result?.hex || '#E5E7EB';
        }

        // Preserve original measurement modes (including null) - allow mode assignment
        const safetyNetMeasurements = color.measurements?.map((measurement, index) => {
          if (!measurement.mode || measurement.mode === null || measurement.mode === undefined) {
            // Try to get mode from the color object itself, or use assigned mode
            let fallbackMode = measurement.assignedMode || color.measurementMode || color.printMode || null;
            
            if (fallbackMode) {
              console.log(`📝 Applying assigned/fallback mode ${fallbackMode} to measurement ${index + 1} for ${color.name}`);
              return {
                ...measurement,
                mode: fallbackMode
              };
            } else {
              console.log(`📝 Preserving null mode for measurement ${index + 1} of ${color.name} (no mode detected)`);
              return {
                ...measurement,
                mode: null
              };
            }
          }
          return measurement;
        }) || [];
        
        // Additional validation: ensure we have at least one measurement
        if (safetyNetMeasurements.length === 0 && (color.hex || color.lab)) {
          console.log(`🔧 Creating default measurement for color ${color.name} with basic data`);
          safetyNetMeasurements.push({
            mode: null,
            lab: color.lab || null,
            spectral_data: extractSpectralData(color, color.name)
          });
        }
        
        return {
          name: color.name,
          hex: hex,
          type: color.standard_type || color.type,
          standard_type: color.standard_type || 'master',
          print_condition_id: color.print_condition_id || null,
          measurements: safetyNetMeasurements
        };
      });

      // Log null mode measurements but allow them (spectral data without modes is valid)
      const nullModeColors = [];
      colorsData.forEach(color => {
        if (color.measurements) {
          color.measurements.forEach((measurement, index) => {
            if (!measurement.mode || measurement.mode === null) {
              nullModeColors.push(`${color.name} (measurement ${index + 1})`);
            }
          });
        }
      });

      if (nullModeColors.length > 0) {
        console.log('📝 Colors with null modes (will be imported without measurement modes):', nullModeColors);
      }

      console.log('✅ Import validation complete, proceeding with import...');

      const { data, error } = await supabase.rpc('import_cxf_colors', {
        p_colors_data: colorsData,
        p_organization_id: profile.organization_id,
        p_user_id: profile.id,
      });

      loadingToast.dismiss();
      if (error) {
        throw error;
      }
      
      console.log('[CxfImport] Import to database completed successfully');
      toast({ title: 'Import successful', description: `Successfully imported ${data.length} colors.` });
      
      // Enhanced cache invalidation with refetch for fresh data
      try {
        console.log('[CxfImport] Invalidating cache and refetching for fresh data');
        
        // Refetch to get the actual data from database and replace optimistic entries
        await refetch();
        
        // Refresh materialized view if it exists (no await to prevent blocking)
        supabase.rpc('refresh_colors_with_details_view').catch(err => {
          console.log('Materialized view refresh not available or failed:', err.message);
        });
        
      } catch (cacheError) {
        console.warn('[CxfImport] Cache refresh failed:', cacheError);
        // Don't fail the import for cache issues
      }
      
      // Reset all state after successful import
      resetAllImportState();
      
      // Call success callback after actual import completion
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      loadingToast.dismiss();
      console.error('❌ Database import failed:', error);
      toast({ title: 'Import failed', description: `Error importing colors: ${error.message}`, variant: 'destructive' });
      resetAllImportState(); // Reset state on error
    }
  };


  return {
    fileInputRef,
    isCxfAddOpen,
    cxfColors,
    setIsCxfAddOpen,
    handleAddColorClick,
    triggerCxfInput: handleAddColorClick, // Alias for backward compatibility
    handleFileChange: handleFileChangeWrapper,
    handleAddColorsFromCxf,
    isLoading: isLoading || isTransforming,
    isTransforming,
    parseProgress: localParseProgress, // Expose parse progress
    fileMetadata, // Expose reactive file metadata
    resetAllImportState, // Expose reset function
  };
};
