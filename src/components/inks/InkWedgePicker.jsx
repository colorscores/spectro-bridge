import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { labToChromaHue } from '@/lib/colorUtils';
import { computeDynamicDisplayColor } from '@/lib/objectSpecificColorCalculation';
// Removed useSpectralCalculations to avoid dispatcher errors
import { toast } from '@/hooks/use-toast';
import { pickBestMeasurement } from '@/lib/measurementSelection';
import { safeSpectralData, getTintPercentage } from '@/lib/tintsUtils';

const InkWedgePicker = ({ 
  wedgeData, 
  selectedWedge, 
  onWedgeSelect, 
  availableBackgrounds,
  selectedBackground,
  onBackgroundChange,
  availableModes,
  measurementControls,
  showSubstrateOptions = false,
  substrateAdaptationMode = 'adapt',
  onSubstrateAdaptationChange = null,
  standards = null,
  // New: spectral data from the current substrate condition to use for 0% tint when copying
  substrateConditionSpectral = null,
  activeDataMode = 'imported' // NEW: Add activeDataMode prop
}) => {
  const DEBUG = false;
  if (DEBUG) {
    console.log('🎛️ InkWedgePicker Debug - Background Selector:', {
      availableBackgrounds,
      availableBackgroundsLength: availableBackgrounds?.length,
      hasMultipleBackgrounds: availableBackgrounds && availableBackgrounds.length > 1,
      selectedBackground
    });
  }
  
  console.warn('📥 InkWedgePicker received props:', {
    wedgeDataLength: wedgeData?.length,
    selectedBackground,
    availableBackgrounds
  });
  
  const hasMultipleBackgrounds = availableBackgrounds && availableBackgrounds.length > 1;

  // Calculate Lab/CH values from substrate condition spectral data using current measurement controls
  // Removed useSpectralCalculations; rely on substrateConditionSpectral only for display
  const substrateCalculations = { lab: null, ch: null };

  // Function to copy wedge data to clipboard
  const copyWedgeData = async () => {
    if (!processedWedgeData?.length) {
      toast({
        title: "No data to copy",
        description: "No wedge data available",
        variant: "destructive"
      });
      return;
    }

    try {
      const dataText = formatWedgeDataForClipboard(processedWedgeData, selectedBackground);
      if (!dataText || dataText.trim() === '') {
        throw new Error('No data to copy');
      }
      
      await navigator.clipboard.writeText(dataText);
      toast({
        title: "Data copied",
        description: `Copied ${processedWedgeData.length} tints to clipboard`
      });
    } catch (error) {
      console.error('Copy failed:', error);
      toast({
        title: "Copy failed",
        description: `Failed to copy data to clipboard: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  // Format wedge data for clipboard with full spectral data in tab-delimited format
  const formatWedgeDataForClipboard = (data, background) => {
    if (!data || data.length === 0) return '';
    
    // Collect all unique wavelengths from all wedges and substrate condition
    const allWavelengths = new Set();
    
    try {
      // Add wavelengths from wedge data
      data.forEach((wedge) => {
        const spectralData = wedge?.spectralData || wedge?.spectral_data || wedge?.spectral || safeSpectralData(wedge);
        if (spectralData && typeof spectralData === 'object') {
          Object.keys(spectralData).forEach(wavelength => {
            const numWavelength = parseFloat(wavelength);
            if (!isNaN(numWavelength)) {
              allWavelengths.add(numWavelength);
            }
          });
        }
      });
      
      // Add wavelengths from substrate condition spectral data
      if (substrateConditionSpectral && typeof substrateConditionSpectral === 'object') {
        Object.keys(substrateConditionSpectral).forEach(wavelength => {
          const numWavelength = parseFloat(wavelength);
          if (!isNaN(numWavelength)) {
            allWavelengths.add(numWavelength);
          }
        });
      }
    } catch (error) {
      console.error('Error collecting wavelength data:', error);
      return 'Error collecting wavelength data';
    }
    
    try {
      // Sort wavelengths numerically
      const sortedWavelengths = Array.from(allWavelengths).sort((a, b) => a - b);
      
      // Create header
      const headerLine = `Ink Wedge Data${background ? ` (${background})` : ''}:\n`;
      const columnHeaders = ['Tint%', 'Color', ...sortedWavelengths.map(wl => `${wl}nm`)];
      const headerRow = columnHeaders.join('\t');
      
      // Create data rows
      const dataRows = data.map((wedge) => {
        const tintPercentage = wedge.tintPercentage !== undefined ? wedge.tintPercentage : 
                              wedge.tint_percentage !== undefined ? wedge.tint_percentage :
                              wedge.tint;
        const color = wedge.colorHex || wedge.hex || wedge.color;
        
        // For substrate (0% tint), use substrate condition spectral data if available
        const isSubstrate = tintPercentage === 0;
        let spectralData = wedge?.spectralData || wedge?.spectral_data || wedge?.spectral || safeSpectralData(wedge);
        
        if (isSubstrate && substrateConditionSpectral) {
          spectralData = substrateConditionSpectral;
        }
        
        // Build row data
        const rowData = [
          tintPercentage !== undefined ? tintPercentage : '',
          color || ''
        ];
        
        // Add spectral values for each wavelength
        sortedWavelengths.forEach(wavelength => {
          const wavelengthKey = wavelength.toString();
          const value = spectralData?.[wavelengthKey];
          rowData.push(value !== undefined ? parseFloat(value).toFixed(6) : '');
        });
        
        return rowData.join('\t');
      });
      
      return headerLine + headerRow + '\n' + dataRows.join('\n');
    } catch (error) {
      console.error('Error formatting data:', error);
      return `Error formatting data: ${error.message}`;
    }
  };

  // Compute hex colors from spectral data when measurement controls are available
  const processedWedgeData = useMemo(() => {
    if (!wedgeData?.length) {
      console.warn('⚠️ processedWedgeData: No wedgeData');
      return [];
    }
    
    console.warn('🔄 processedWedgeData processing:', {
      inputLength: wedgeData.length,
      hasMeasurementControls: !!measurementControls,
      hasStandards: !!standards
    });

    // If no measurement controls, return data as-is
    if (!measurementControls || !standards) {
      return wedgeData;
    }

    // Handle standards as either array or object (supports ColorSettingsBox shape)
    const standardsArray = Array.isArray(standards)
      ? standards
      : (Array.isArray(standards?.astmTables) ? standards.astmTables : []);

    if (standardsArray.length === 0) {
      return wedgeData;
    }

    // Extract measurement controls for computeDisplayColorFromSpectral
    const { illuminant = 'D50', observer = '2', table = '5' } = measurementControls || {};

    return wedgeData.map((wedge, wedgeIndex) => {
      // REMOVED: Early-return optimization that prevented dynamic color computation
      // Wedges must ALWAYS compute colors from spectral data to respect Color Settings Box changes
      
      // Handle different spectral data field names (like SpectralPlot)
      let spectralData = wedge?.spectralData || wedge?.spectral_data || wedge?.spectral || safeSpectralData(wedge);
      const hasSplit = !!wedge?.hasSplit;
      const tintPercentage = wedge.tintPercentage !== undefined ? wedge.tintPercentage : 
                            wedge.tint_percentage !== undefined ? wedge.tint_percentage :
                            wedge.tint;
      const isSubstrate = tintPercentage === 0;

      // For substrate (0% tint), use substrate condition spectral data
      if (isSubstrate && substrateConditionSpectral) {
        try {
          // Build color object for computeDynamicDisplayColor
          const substrateObject = {
            spectral_data: substrateConditionSpectral,
            ...wedge
          };
          
          // Build org defaults from measurement controls
          const orgDefaults = {
            default_illuminant: illuminant,
            default_observer: observer,
            default_astm_table: table
          };
          
          // Compute hex from spectral using computeDynamicDisplayColor
          const result = computeDynamicDisplayColor(
            substrateObject,
            orgDefaults,
            standardsArray,
            measurementControls,
            'imported' // Substrate uses imported mode
          );

          if (result?.hex && result.hex !== '#E5E7EB') { // Don't use default gray
            return {
              ...wedge,
              colorHex: result.hex,
              hex: result.hex,
              computedFromSubstrateSpectral: true
            };
          }
        } catch (error) {
          // Silent fail
        }
      }

      // If spectral is missing, try to populate from measurements using shared selector
      if ((!spectralData || Object.keys(spectralData || {}).length === 0) && Array.isArray(wedge?.measurements) && wedge.measurements.length > 0) {
        try {
          const best = pickBestMeasurement(wedge.measurements, measurementControls?.mode);
          if (best?.spectral_data && Object.keys(best.spectral_data).length > 0) {
            spectralData = best.spectral_data;
          }
        } catch (e) {
          // Silent fail
        }
      }

      // If we have spectral data, compute hex from it using computeDynamicDisplayColor
      if (spectralData && typeof spectralData === 'object') {
        try {
          // Build color object for computeDynamicDisplayColor
          const colorObject = {
            spectral_data: spectralData,
            ...wedge
          };
          
          // Build org defaults from measurement controls
          const orgDefaults = {
            default_illuminant: illuminant,
            default_observer: observer,
            default_astm_table: table
          };
          
          // Compute hex from spectral using computeDynamicDisplayColor
          // This respects ColorSettingsBox settings and handles data modes
          const result = computeDynamicDisplayColor(
            colorObject,
            orgDefaults,
            standardsArray,
            measurementControls,
            activeDataMode // Use activeDataMode prop ('imported' or 'adapted')
          );
          
          if (result?.hex && result.hex !== '#E5E7EB') { // Don't use default gray
            const next = { ...wedge, spectralData };

            if (hasSplit) {
              // Preserve explicit split/bottom colors; only fill if missing
              if (!next.colorHex) next.colorHex = result.hex;
              if (!next.hex) next.hex = next.hex ?? result.hex;
            } else {
              // Non-split: ALWAYS use computed hex
              next.colorHex = result.hex;
              next.hex = result.hex;
            }

            next.computedFromSpectral = true;
            return next;
          }
        } catch (error) {
          // Silent fail
        }
      }

      // Fallback to original data
      return wedge;
    });
  }, [wedgeData, measurementControls, standards, substrateCalculations, substrateConditionSpectral, activeDataMode]);

  return (
    <Card className="relative">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Ink Wedge</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyWedgeData}
            className="h-8 w-8 p-0"
            title="Copy wedge data to clipboard"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-4">
          {/* Mode display removed per plan */}
          
          {/* Background selector */}
          {(hasMultipleBackgrounds || true) && ( // FORCE SHOW FOR DEBUG
            <div className="flex items-center gap-2 relative z-0 pointer-events-auto">
              <span className="text-sm text-muted-foreground">Background:</span>
              <Select value={selectedBackground} onValueChange={(bg) => {
                console.log('🔽 Background changed to:', bg);
                onBackgroundChange?.(bg);
              }} onOpenChange={(open) => console.log('🔽 Background Select open state:', open)}>
                <SelectTrigger className="w-[220px] flex-shrink-0 focus:ring-0 focus:ring-offset-0 data-[state=open]:bg-background data-[state=open]:border-border hover:bg-accent/10 cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent 
                  // Rely on default Select z-index (kept low to allow modals to overlay)
                  className="bg-popover text-popover-foreground border border-border pointer-events-auto"
                  position="popper"
                  sideOffset={5}
                >
                  {availableBackgrounds?.map((background) => (
                    <SelectItem key={background} value={background} className="cursor-pointer">
                      {background}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Wedge blocks container */}
          <div className="relative z-[100] flex flex-wrap gap-2" onClick={(e) => console.log('🧪 Wedge grid container click', { target: e.target.tagName })} onPointerDown={(e) => console.log('🧪 Wedge grid pointer down', { x: e.clientX, y: e.clientY })}>
            {processedWedgeData.map((wedge, index) => {
              const isSelected = Number(selectedWedge) === index;
              // Handle different percentage field names (like SpectralPlot)
              const tintPercentage = wedge.tintPercentage !== undefined ? wedge.tintPercentage : 
                                   wedge.tint_percentage !== undefined ? wedge.tint_percentage :
                                   wedge.tint;
              // Handle different color field names with fallbacks
              const color = wedge.colorHex || wedge.hex || wedge.color;
              const isSubstrate = wedge.isSubstrate || tintPercentage === 0;
              const isSolid = tintPercentage === 100;
              
              return (
                <div key={index} className="flex flex-col items-center gap-2 relative">
                  {wedge.hasSplit ? (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          console.log('🔵🔵🔵 SPLIT WEDGE CLICKED 🔵🔵🔵', { 
                            index,
                            tintPercentage,
                            eventType: e.type,
                            target: e.target.tagName,
                            hasOnWedgeSelect: !!onWedgeSelect,
                            isSelected
                          });
                          
                          if (!onWedgeSelect) {
                            console.error('🔴 onWedgeSelect missing on split wedge');
                            return;
                          }
                          
                          console.log('🟢 Calling onWedgeSelect for split wedge:', { index, tintPercentage });
                          onWedgeSelect({ index, tintPercentage });
                          console.log('✅ onWedgeSelect called for split wedge');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (onWedgeSelect) {
                               onWedgeSelect({ index, tintPercentage });
                            }
                          }
                        }}
                        aria-selected={isSelected}
                        className={cn(
                          "relative z-[110] pointer-events-auto rounded transition-all duration-200 overflow-hidden cursor-pointer",
                          "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16",
                          isSelected ? "ring-2 ring-primary shadow-md" : "ring-1 ring-border hover:ring-primary/40"
                        )}
                        title={wedge.name || `${tintPercentage}% tint`}
                      >
                        {/* Split swatch: use stacked halves to avoid clip-path issues */}
                        <div className="absolute inset-0 pointer-events-none rounded overflow-hidden flex flex-col">
                          {/* Top half - Imported color */}
                          <div
                            className="w-full h-1/2"
                            style={{ backgroundColor: wedge.splitColor || wedge.hex || wedge.colorHex || wedge.color || 'transparent' }}
                          />
                          {/* Bottom half - Adapted color */}
                          <div
                            className="w-full h-1/2"
                            style={{ backgroundColor: wedge.colorHex || wedge.hex || wedge.color || 'transparent' }}
                          />
                        </div>
                        {/* Outline overlay */}
                        <div className="absolute inset-0 border border-black/20 rounded pointer-events-none" />
                      </button>
                       <div className="flex flex-col items-center gap-1">
                         <span className="text-xs text-muted-foreground font-medium text-center">
                           {isSubstrate ? 'Substrate' : 
                            isSolid ? 'Solid' : 
                            (tintPercentage !== null && !isNaN(tintPercentage) ? `${tintPercentage}%` : '')}
                          </span>
                        </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          console.log('🔵🔵🔵 SINGLE WEDGE CLICKED 🔵🔵🔵', { 
                            index,
                            tintPercentage,
                            eventType: e.type,
                            target: e.target.tagName,
                            hasOnWedgeSelect: !!onWedgeSelect,
                            isSelected
                          });
                          
                          if (!onWedgeSelect) {
                            console.error('🔴 onWedgeSelect missing on single wedge');
                            return;
                          }
                          
                           console.log('🟢 Calling onWedgeSelect for single wedge:', { index, tintPercentage });
                           onWedgeSelect({ index, tintPercentage });
                           console.log('✅ onWedgeSelect called for single wedge');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (onWedgeSelect) {
                               onWedgeSelect({ index, tintPercentage });
                            }
                          }
                        }}
                        aria-selected={isSelected}
                        className={cn(
                          "relative z-[110] pointer-events-auto rounded transition-all duration-200 overflow-hidden cursor-pointer",
                          "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16",
                          isSelected ? "ring-2 ring-primary shadow-md" : "ring-1 ring-border hover:ring-primary/40"
                        )}
                        title={wedge.name || `${tintPercentage}% tint`}
                      >
                        <div 
                          className="w-full h-full pointer-events-none rounded"
                          style={{ backgroundColor: color || 'transparent' }}
                        />
                      </button>
                      <div className="flex flex-col items-center gap-1">
                         <span className="text-xs text-muted-foreground font-medium text-center">
                           {isSubstrate ? 'Substrate' : 
                            isSolid ? 'Solid' : 
                            (tintPercentage !== null && !isNaN(tintPercentage) ? `${tintPercentage}%` : '')}
                         </span>
                       </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Row labels container - only show in mismatch view */}
          {showSubstrateOptions && (
            <div className="relative ml-2 h-12 sm:h-14 md:h-16 flex flex-col">
              <div className="text-xs text-muted-foreground font-medium flex items-end justify-start h-1/2 pb-1">
                Imported
              </div>
              <div className="text-xs text-muted-foreground font-medium flex items-center justify-start h-1/2">
                Adapted
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default React.memo(InkWedgePicker, (prev, next) => {
  // Force re-render when data mode changes
  if (prev.activeDataMode !== next.activeDataMode) return false;

  // Compare simple props first
  if (prev.selectedWedge !== next.selectedWedge) return false;
  if (prev.selectedBackground !== next.selectedBackground) return false;
  if (prev.showSubstrateOptions !== next.showSubstrateOptions) return false;
  if (prev.substrateAdaptationMode !== next.substrateAdaptationMode) return false;
  
  // Compare callbacks - if they change, re-render
  if (prev.onWedgeSelect !== next.onWedgeSelect) return false;
  if (prev.onBackgroundChange !== next.onBackgroundChange) return false;
  if (prev.onSubstrateAdaptationChange !== next.onSubstrateAdaptationChange) return false;

  // Compare availableBackgrounds arrays
  if (prev.availableBackgrounds !== next.availableBackgrounds) {
    if (!prev.availableBackgrounds || !next.availableBackgrounds) return false;
    if (prev.availableBackgrounds.length !== next.availableBackgrounds.length) return false;
    for (let i = 0; i < prev.availableBackgrounds.length; i++) {
      if (prev.availableBackgrounds[i] !== next.availableBackgrounds[i]) return false;
    }
  }

  // Compare measurement controls shallowly
  const pmc = prev.measurementControls || {};
  const nmc = next.measurementControls || {};
  if (pmc.mode !== nmc.mode || pmc.illuminant !== nmc.illuminant || pmc.observer !== nmc.observer || pmc.table !== nmc.table) {
    return false;
  }

  // Standards: if astmTables reference or length changes, re-render
  const pAst = Array.isArray(prev.standards?.astmTables) ? prev.standards.astmTables : prev.standards;
  const nAst = Array.isArray(next.standards?.astmTables) ? next.standards.astmTables : next.standards;
  if ((pAst && !nAst) || (!pAst && nAst)) return false;
  if (Array.isArray(pAst) && Array.isArray(nAst)) {
    if (pAst === nAst) {
      // ok
    } else if (pAst.length !== nAst.length) {
      return false;
    }
  }
  
  // Compare substrateConditionSpectral
  if (prev.substrateConditionSpectral !== next.substrateConditionSpectral) return false;

  // Wedge data shallow comparison of key fields
  const pw = prev.wedgeData || [];
  const nw = next.wedgeData || [];
  if (pw.length !== nw.length) return false;
  for (let i = 0; i < pw.length; i++) {
    const a = pw[i];
    const b = nw[i];
    if ((a.tintPercentage ?? a.tint_percentage ?? a.tint) !== (b.tintPercentage ?? b.tint_percentage ?? b.tint)) return false;
    if ((a.colorHex ?? a.hex ?? a.color) !== (b.colorHex ?? b.hex ?? b.color)) return false;
    if (!!a.hasSplit !== !!b.hasSplit) return false;
    if ((a.splitColor ?? a.splitColorHex) !== (b.splitColor ?? b.splitColorHex)) return false;
  }

  return true; // props are equal -> skip re-render
});