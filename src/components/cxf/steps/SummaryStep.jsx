import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, FileText, Palette, Package, Settings } from 'lucide-react';
import { generateInkConditionName } from '@/lib/inkConditionNaming';
import { spectralToLabASTME308, labToHexD65, computeDefaultDisplayColor } from '@/lib/colorUtils/colorConversion';
import { getTintPercentage, safeSpectralData } from '@/lib/tintsUtils';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { useProfile } from '@/context/ProfileContext';
import { computeTwoStepSubstrateAdaptation, calculateAdditionalInkLayer, applyAdditionalInkLayer } from '@/lib/inkSubstrateAdaptation';
import { calculateDeltaE } from '@/lib/deltaE';
import { computeDisplayColorFromSpectral } from '@/lib/colorUtils/displayColorComputation';
import DiagonalSplitPatch from '@/components/ui/DiagonalSplitPatch';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SummaryStep = ({ formData, processedColors, cxfColors, resolvedNames }) => {
  const [showImported, setShowImported] = useState(false);
  const [selectedSubstrateCondition, setSelectedSubstrateCondition] = useState(null);
  const [adaptedSpectralByBackground, setAdaptedSpectralByBackground] = useState({});
  const [selectedBackground, setSelectedBackground] = useState('Substrate');
  const [deltaEsByBackground, setDeltaEsByBackground] = useState({});
  
  const { astmTables } = useAstmTablesCache();
  const { profile } = useProfile();
  
  const selectedColor = processedColors?.find(color => color.id === formData.selectedColorId) || 
                       cxfColors?.find(color => color.id === formData.selectedColorId);
  
  // Detect if this is a single color import to hide certain UI elements
  const isSingleColorImport = selectedColor?._isSingleColorImport;

  // Get the correct hex value for the color block
  const colorHex = selectedColor?.hex || selectedColor?.colorHex || selectedColor?.processedHex || '#cccccc';

  // Use ink condition name from wizard hook (single source of truth)
  const inkConditionName = resolvedNames?.inkConditionName;
  
  // Extract tint data from the selected color - use tintsByBackground if available
  const tintData = useMemo(() => {
    if (selectedColor?.tintsByBackground) {
      const arr = [];
      for (const [bg, tints] of Object.entries(selectedColor.tintsByBackground)) {
        (tints || []).forEach(t => arr.push({ ...t, backgroundName: t.backgroundName || bg }));
      }
      return arr;
    }
    const fallback = selectedColor?.originalObject?.substrateTints
      || selectedColor?.originalObject?.tints
      || selectedColor?.tints
      || selectedColor?.measurements
      || [];
    return fallback.map(t => ({ ...t, backgroundName: t.backgroundName || t.background || 'Substrate' }));
  }, [selectedColor]);
  
  // Build weighting table using org defaults
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
  
  // Process tints with proper color computation from spectral data
  const processedTints = useMemo(() => {
    if (!tintData || !Array.isArray(tintData)) return [];
    
    const wt = weightingTable;
    
    return tintData.map(tint => {
      let computedHex = tint.hex || tint.colorHex || tint.color_hex || tint.displayHex;
  
      // Try spectral -> Lab -> Hex using org defaults
      if (!computedHex && wt) {
        const orgDefaults = {
          default_illuminant: profile?.organization?.default_illuminant || 'D50',
          default_observer: profile?.organization?.default_observer || '2',
          default_astm_table: profile?.organization?.default_astm_table || '5'
        };
        try {
          const s = safeSpectralData(tint);
          const result = computeDefaultDisplayColor(s ? { spectral_data: s } : tint, orgDefaults, astmTables);
          computedHex = result?.hex;
        } catch (error) {
          console.warn('Failed to compute hex using standard pipeline:', error);
        }
      }
  
      // Fallback: use provided Lab on tint
      if (!computedHex) {
        const lab = tint.lab || {
          L: tint.lab_l ?? tint.L ?? tint.l,
          a: tint.lab_a ?? tint.A ?? tint.a,
          b: tint.lab_b ?? tint.B ?? tint.b,
        };
        if (
          lab &&
          Number.isFinite(lab.L) &&
          Number.isFinite(lab.a) &&
          Number.isFinite(lab.b)
        ) {
          computedHex = labToHexD65(Number(lab.L), Number(lab.a), Number(lab.b), 'D50');
        }
      }
  
      // Last fallback: any color field
      if (!computedHex) {
        computedHex = tint.color || selectedColor?.hex || selectedColor?.colorHex || '#f3f4f6';
      }
  
      return {
        ...tint,
        computedHex,
        tintPercentage: getTintPercentage(tint),
        backgroundName: tint.backgroundName || tint.background || 'Substrate'
      };
    }).sort((a, b) => a.tintPercentage - b.tintPercentage);
  }, [selectedColor, tintData, weightingTable]);
  
  // Filter tints for the selected background
  const tintsForSelectedBackground = useMemo(() => {
    const filtered = processedTints.filter(
      t => (t.backgroundName || 'Substrate') === selectedBackground
    );
    console.info('[SummaryStep] Filtered tints by background', {
      selectedBackground,
      total: processedTints.length,
      filtered: filtered.length,
      sampleBackgroundNames: processedTints.slice(0, 3).map(t => t.backgroundName)
    });
    return filtered;
  }, [processedTints, selectedBackground]);
  
  // Find substrate (0%) and solid (100%) tints from filtered set
  const substrateTint = useMemo(() => {
    const arr = tintsForSelectedBackground;
    const exact = arr.find(t => t.tintPercentage === 0);
    if (exact) return exact;
    return arr.length ? [...arr].sort((a,b)=>a.tintPercentage-b.tintPercentage)[0] : undefined;
  }, [tintsForSelectedBackground]);
  
  const solidTint = useMemo(() => {
    const arr = tintsForSelectedBackground;
    const exact = arr.find(t => t.tintPercentage === 100);
    if (exact) return exact;
    return arr.length ? [...arr].sort((a,b)=>b.tintPercentage-a.tintPercentage)[0] : undefined;
  }, [tintsForSelectedBackground]);

  // Compute substrate color from selected substrate condition for single-tint imports
  const substrateConditionHex = useMemo(() => {
    if (!isSingleColorImport || !selectedSubstrateCondition) return null;
    
    // Try LAB first
    if (selectedSubstrateCondition.lab) {
      const lab = selectedSubstrateCondition.lab;
      if (lab.L !== null && lab.a !== null && lab.b !== null) {
        return labToHexD65(lab.L, lab.a, lab.b, 'D50');
      }
    }
    
    // Try spectral conversion
    if (selectedSubstrateCondition.spectral_data && weightingTable) {
      try {
        const lab = spectralToLabASTME308(selectedSubstrateCondition.spectral_data, weightingTable);
        if (lab) {
          return labToHexD65(lab.L, lab.a, lab.b, 'D50');
        }
      } catch (error) {
        console.warn('Failed to convert substrate spectral to hex:', error);
      }
    }
    
    return '#f3f4f6'; // Fallback gray
  }, [isSingleColorImport, selectedSubstrateCondition, weightingTable]);
  
  // Check if we should show adapted colors (when data has been processed/adapted)
  const hasAdaptedData = useMemo(() => {
    const hasValidSubstrate = formData.assignedSubstrate !== 'create-new' && 
                              formData.assignedSubstrateCondition !== 'create-new';
    
    // Check if we have color data from either source (import wizard or saved colors)
    const hasColorData = (processedColors && processedColors.length > 0) || 
                         (processedTints && processedTints.length > 0);
    
    return hasValidSubstrate && hasColorData;
  }, [formData.assignedSubstrate, formData.assignedSubstrateCondition, processedColors, processedTints]);
  
  // Fetch substrate condition for adaptation
  useEffect(() => {
    const fetchSubstrateCondition = async () => {
      if (!formData.assignedSubstrateCondition || formData.assignedSubstrateCondition === 'create-new') {
        setSelectedSubstrateCondition(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('substrate_conditions')
          .select('*')
          .eq('id', formData.assignedSubstrateCondition)
          .maybeSingle();

        if (data) {
          setSelectedSubstrateCondition(data);
        }
      } catch (error) {
        console.error('Failed to fetch substrate condition:', error);
      }
    };

    fetchSubstrateCondition();
  }, [formData.assignedSubstrateCondition]);
  
  // Compute adapted colors with background-aware logic (matching SelectSubstrateStep)
  useEffect(() => {
    if (!hasAdaptedData || !processedTints.length || !selectedSubstrateCondition || !weightingTable) {
      console.log('[SummaryStep] Skipping adaptation - missing data');
      setAdaptedSpectralByBackground({});
      setDeltaEsByBackground({});
      return;
    }

    const computeAdaptedSpectralData = async () => {
      try {
        const targetSubstrateSpectral = selectedSubstrateCondition.spectral_data;
        if (!targetSubstrateSpectral) {
          console.warn('[SummaryStep] No spectral data for target substrate');
          return;
        }

        console.log('[SummaryStep] Starting background-aware adaptation...');

        // STEP 1: Build tints by background - use backgroundName first
        const tintsByBackground = {};
        for (const tint of processedTints) {
          const background = tint.backgroundName || tint.background || 'Substrate';
          
          if (!tintsByBackground[background]) {
            tintsByBackground[background] = [];
          }
          tintsByBackground[background].push(tint);
        }

        console.log('[SummaryStep] Tints by background:', Object.keys(tintsByBackground));

        // STEP 2: Find imported substrate (0% tint from base "Substrate" background)
        const baseSubstrateGroup = tintsByBackground['Substrate'] || tintsByBackground['substrate'];
        const importedSubstrateTint = baseSubstrateGroup?.find(t => t.tintPercentage === 0);
        if (!importedSubstrateTint) {
          console.warn('[SummaryStep] No substrate tint found');
          return;
        }

        const importedSubstrateSpectral = safeSpectralData(importedSubstrateTint);
        if (!importedSubstrateSpectral) {
          console.warn('[SummaryStep] No spectral data for imported substrate');
          return;
        }

        // STEP 3: Compute universal scalars (Substrate 0% → Target 0%)
        const adaptedSubstrateSpectral = computeTwoStepSubstrateAdaptation(
          importedSubstrateSpectral,
          importedSubstrateSpectral,
          targetSubstrateSpectral,
          0,
          { enableLogging: false }
        );

        const importedSubstrateLab = spectralToLabASTME308(importedSubstrateSpectral, weightingTable);
        const adaptedSubstrateLab = spectralToLabASTME308(adaptedSubstrateSpectral, weightingTable);
        
        const substrateDeltaE = importedSubstrateLab && adaptedSubstrateLab 
          ? calculateDeltaE(importedSubstrateLab, adaptedSubstrateLab, 'dE76')
          : 0;

        console.log(`[SummaryStep] Substrate ΔE: ${substrateDeltaE.toFixed(2)}`);

        const orgDefaults = {
          default_illuminant: profile?.organization?.default_illuminant || 'D50',
          default_observer: profile?.organization?.default_observer || '2',
          default_astm_table: profile?.organization?.default_astm_table || '5'
        };

        // STEP 3.5: Calculate additional ink layers for non-Substrate backgrounds
        const baseSubstrateTint = baseSubstrateGroup?.find(t => t.tintPercentage === 0);
        const baseSubstrateSpectral = baseSubstrateTint ? safeSpectralData(baseSubstrateTint) : importedSubstrateSpectral;

        const additionalInkLayerByBackground = {};
        for (const [backgroundName, bgTints] of Object.entries(tintsByBackground)) {
          if (backgroundName === 'Substrate' || backgroundName === 'substrate') {
            additionalInkLayerByBackground[backgroundName] = null; // No additional layer
          } else {
            const layeredSubstrateTint = bgTints.find(t => t.tintPercentage === 0);
            const layeredSpectral = layeredSubstrateTint ? safeSpectralData(layeredSubstrateTint) : null;
            if (layeredSpectral && baseSubstrateSpectral) {
              additionalInkLayerByBackground[backgroundName] = calculateAdditionalInkLayer(
                baseSubstrateSpectral,
                layeredSpectral
              );
              console.log(`[SummaryStep] Calculated additional ink layer for ${backgroundName}`);
            }
          }
        }

        // STEP 4: Process each background
        const newAdaptedData = {};
        const newDeltaEs = { substrate: substrateDeltaE };

        for (const [backgroundName, tints] of Object.entries(tintsByBackground)) {
          console.log(`[SummaryStep] Processing background: ${backgroundName} (${tints.length} tints)`);
          
          newAdaptedData[backgroundName] = {};

          // Process each tint in this background
          for (const tint of tints) {
            const tintPercentage = tint.tintPercentage;
            const tintKey = tint.id || `tint-${tintPercentage}`;
            const importedTintSpectral = safeSpectralData(tint);

            if (!importedTintSpectral) {
              console.warn(`[SummaryStep] No spectral for ${backgroundName} ${tintPercentage}%`);
              continue;
            }

            // Apply two-step adaptation - ALWAYS use base target substrate
            let adaptedSpectral = computeTwoStepSubstrateAdaptation(
              importedSubstrateSpectral,
              importedTintSpectral,
              targetSubstrateSpectral,  // ALWAYS use base substrate
              tintPercentage,
              { enableLogging: false }
            );

            // Re-apply additional ink layer for non-Substrate backgrounds
            const additionalLayer = additionalInkLayerByBackground[backgroundName];
            if (additionalLayer) {
              adaptedSpectral = applyAdditionalInkLayer(adaptedSpectral, additionalLayer);
              console.log(`[SummaryStep] Applied additional ink layer for ${backgroundName} at ${tintPercentage}%`);
            }

            if (adaptedSpectral) {
              // Use computeDefaultDisplayColor for consistency with SelectSubstrateStep
              const result = computeDefaultDisplayColor(
                { spectral_data: adaptedSpectral },
                orgDefaults,
                astmTables,
                'adapted'
              );
              const displayHex = result?.hex;

              if (displayHex) {
                // Compute Lab values for Delta E calculation
                const adaptedLab = spectralToLabASTME308(adaptedSpectral, weightingTable);
                
                newAdaptedData[backgroundName][tintKey] = {
                  spectral_data: adaptedSpectral,
                  hex: displayHex,
                  lab: adaptedLab
                };

                // Calculate Delta E for this tint
                const importedLab = spectralToLabASTME308(importedTintSpectral, weightingTable);
                if (importedLab && adaptedLab) {
                  const deltaE = calculateDeltaE(importedLab, adaptedLab, 'dE76');
                  if (tintPercentage === 0) {
                    newDeltaEs[backgroundName] = deltaE;
                  }
                }
              }
            }
          }

          console.log(`[SummaryStep] ${backgroundName}: ${Object.keys(newAdaptedData[backgroundName]).length} tints adapted`);
        }

        setAdaptedSpectralByBackground(newAdaptedData);
        setDeltaEsByBackground(newDeltaEs);
        console.log('[SummaryStep] Adaptation complete');

      } catch (error) {
        console.error('[SummaryStep] Failed to compute adapted colors:', error);
        setAdaptedSpectralByBackground({});
        setDeltaEsByBackground({});
      }
    };

    computeAdaptedSpectralData();
  }, [hasAdaptedData, processedTints, selectedSubstrateCondition, weightingTable, astmTables, profile]);
  
  // Sync selectedBackground from formData when wizard navigates to this step
  useEffect(() => {
    if (formData?.selectedBackground) {
      setSelectedBackground(formData.selectedBackground);
    }
  }, [formData?.selectedBackground]);
  
  // Compute background options from both adapted data and processedTints
  const backgroundOptions = useMemo(() => {
    const fromAdapted = Object.keys(adaptedSpectralByBackground || {});
    const fromTints = [...new Set(processedTints.map(t => t.backgroundName || 'Substrate'))];
    const merged = Array.from(new Set([...fromAdapted, ...fromTints]));
    console.info('[SummaryStep] Background options:', merged, 'selected=', selectedBackground);
    return merged;
  }, [adaptedSpectralByBackground, processedTints, selectedBackground]);

  return (
    <div className="space-y-6 p-6">
      {/* Color Wedge Display */}
      {selectedColor && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{selectedColor.name || 'Selected Color'}</h3>
            <div className="flex items-center gap-4">
              {hasAdaptedData && backgroundOptions.length > 1 && (
                <Select value={selectedBackground} onValueChange={setSelectedBackground}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select background" />
                  </SelectTrigger>
                  <SelectContent>
                    {backgroundOptions.sort((a,b) => (a === 'Substrate' ? -1 : b === 'Substrate' ? 1 : a.localeCompare(b))).map(bg => (
                      <SelectItem key={bg} value={bg}>{bg.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {hasAdaptedData && processedTints.length > 0 && !isSingleColorImport && (
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="show-imported" 
                    checked={showImported}
                    onCheckedChange={setShowImported}
                  />
                  <label htmlFor="show-imported" className="text-sm text-muted-foreground">
                    Show imported
                  </label>
                </div>
              )}
            </div>
          </div>
          
           {processedTints.length > 0 ? (
            <div className="space-y-3">
              {/* Full Tint Wedge Display - Only show if multi-tint import */}
              {!isSingleColorImport && tintsForSelectedBackground.length > 2 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Tint Wedge</p>
                  <div className="flex gap-1 justify-center flex-wrap">
                    {tintsForSelectedBackground.slice(0, 11).map((tint) => {
                      const tintKey = tint.id || `tint-${tint.tintPercentage}`;
                      const tintHex = tint.computedHex || '#f3f4f6';
                      const currentBgData = adaptedSpectralByBackground[selectedBackground] || {};
                      const adaptedHex = currentBgData[tintKey]?.hex;
                      
                      return (
                        <div key={tintKey} className="flex flex-col items-center gap-1">
                          {hasAdaptedData && adaptedHex && showImported ? (
                            <DiagonalSplitPatch
                              importedColor={tintHex}
                              adaptedColor={adaptedHex}
                              size="w-8 h-8 sm:w-10 sm:h-10"
                            />
                          ) : (
                            <div
                              className="w-8 h-8 sm:w-10 sm:h-10 rounded border border-border"
                              style={{ 
                                backgroundColor: hasAdaptedData && adaptedHex && !showImported 
                                  ? adaptedHex 
                                  : tintHex 
                              }}
                            />
                          )}
                          <span className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-center">
                            {tint.tintPercentage}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Substrate and Solid blocks */}
              <div className="flex gap-4 w-full">
                {/* For single-color imports, show substrate from selected condition */}
                {isSingleColorImport && selectedSubstrateCondition && (
                  <div className="flex-1 space-y-2">
                    <div
                      className="w-full h-20 rounded border border-border"
                      style={{ backgroundColor: substrateConditionHex || '#f3f4f6' }}
                    />
                    <div className="text-sm text-muted-foreground">
                      <span>Substrate (Assigned)</span>
                    </div>
                  </div>
                )}
                
                {/* For single-color imports, show the solid tint */}
                {isSingleColorImport && solidTint && (
                  <div className="flex-1 space-y-2">
                    <div
                      className="w-full h-20 rounded border border-border"
                      style={{ backgroundColor: solidTint.computedHex || colorHex }}
                    />
                    <div className="text-sm text-muted-foreground">
                      <span>Solid Ink (Imported)</span>
                    </div>
                  </div>
                )}
                
                {/* For multi-tint imports, existing logic */}
                {!isSingleColorImport && substrateTint && (
                  <div className="flex-1 space-y-2">
                    {(() => {
                      const substrateTintKey = substrateTint.id || `tint-${substrateTint.tintPercentage}`;
                      const currentBgData = adaptedSpectralByBackground[selectedBackground] || {};
                      const adaptedSubstrateHex = currentBgData[substrateTintKey]?.hex;
                      
                      console.log('🧩 Big box (Substrate): showSplit=', hasAdaptedData && adaptedSubstrateHex && showImported);
                      
                      return hasAdaptedData && adaptedSubstrateHex && showImported ? (
                        <DiagonalSplitPatch
                          importedColor={substrateTint.computedHex || '#f3f4f6'}
                          adaptedColor={adaptedSubstrateHex}
                          size="w-full h-20"
                          showLabels={true}
                        />
                      ) : (
                        <div
                          className="w-full h-20 rounded border border-border"
                          style={{ 
                            backgroundColor: hasAdaptedData && !showImported && adaptedSubstrateHex
                              ? adaptedSubstrateHex
                              : substrateTint.computedHex || '#f3f4f6'
                          }}
                        />
                      );
                    })()}
                    <div className="text-sm text-muted-foreground flex items-center justify-between">
                      <span>Substrate</span>
                      {deltaEsByBackground[selectedBackground] !== undefined && (
                        <span className="text-xs">ΔE: {deltaEsByBackground[selectedBackground].toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                )}

                {!isSingleColorImport && solidTint && (
                  <div className="flex-1 space-y-2">
                    {(() => {
                      const solidTintKey = solidTint.id || `tint-${solidTint.tintPercentage}`;
                      const currentBgData = adaptedSpectralByBackground[selectedBackground] || {};
                      const adaptedSolidHex = currentBgData[solidTintKey]?.hex;
                      
                      console.log('🧩 Big box (Solid): showSplit=', hasAdaptedData && adaptedSolidHex && showImported);
                      
                      return hasAdaptedData && adaptedSolidHex && showImported ? (
                        <DiagonalSplitPatch
                          importedColor={solidTint.computedHex || '#f3f4f6'}
                          adaptedColor={adaptedSolidHex}
                          size="w-full h-20"
                          showLabels={true}
                        />
                      ) : (
                        <div
                          className="w-full h-20 rounded border border-border"
                          style={{ 
                            backgroundColor: hasAdaptedData && !showImported && adaptedSolidHex
                              ? adaptedSolidHex
                              : solidTint.computedHex || '#f3f4f6' 
                          }}
                        />
                      );
                    })()}
                    <div className="text-sm text-muted-foreground">Solid</div>
                  </div>
                )}
              </div>
              
              {/* Color Information */}
              {selectedColor.lab && (
                <div className="flex gap-4 text-xs text-muted-foreground justify-center">
                  <span>L*: {(selectedColor.lab.L ?? selectedColor.lab.l)?.toFixed(1) || 'N/A'}</span>
                  <span>a*: {(selectedColor.lab.a ?? selectedColor.lab.A)?.toFixed(1) || 'N/A'}</span>
                  <span>b*: {(selectedColor.lab.b ?? selectedColor.lab.B)?.toFixed(1) || 'N/A'}</span>
                </div>
              )}
            </div>
          ) : (
            /* Fallback to simple color block if no wedge data */
            <div className="p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-4">
                <div 
                  className="w-16 h-16 rounded border"
                  style={{ backgroundColor: colorHex }}
                ></div>
                <div className="flex-1">
                  {selectedColor.lab && (
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      <span>L*: {(selectedColor.lab.L ?? selectedColor.lab.l)?.toFixed(1) || 'N/A'}</span>
                      <span>a*: {(selectedColor.lab.a ?? selectedColor.lab.A)?.toFixed(1) || 'N/A'}</span>
                      <span>b*: {(selectedColor.lab.b ?? selectedColor.lab.B)?.toFixed(1) || 'N/A'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Summary</h3>
        <div className="p-4 border rounded-lg bg-muted/50 space-y-2 text-sm">
          <p><strong>Ink Name:</strong> {formData.inkName || 'Not specified'}</p>
          <p><strong>Ink Condition:</strong> {inkConditionName || 'Not specified'}</p>
          <p><strong>Substrate:</strong> {resolvedNames?.substrateName || formData.substrateName || formData.assignedSubstrate || 'Not specified'}</p>
          <p><strong>Substrate Condition:</strong> {resolvedNames?.substrateConditionName || 'Not specified'}</p>
        </div>
      </div>
    </div>
  );
};

export default SummaryStep;