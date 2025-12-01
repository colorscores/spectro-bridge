import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { spectralToLabASTME308, labToHex, computeDefaultDisplayColor } from '@/lib/colorUtils';
import { useProfile } from '@/context/ProfileContext';
import ImportSettingsCollapsible from '@/components/colors/ImportSettingsCollapsible';

const CxfInkImportDialog = ({ 
  isOpen, 
  onClose, 
  cxfObjects, 
  onImport,
  title = "Import CxF/X-4 Spot Color Data",
  embedded = false, // New prop for embedded usage
  defaultMeasurementMode = '' // Add measurement mode prop
}) => {
  const [selectedTints, setSelectedTints] = useState([]);
  const [measurementMode, setMeasurementMode] = useState(defaultMeasurementMode || '');
  const { profile } = useProfile();
  
  // Wait for ASTM cache to be ready before calculating Lab values
  const { astmTables, loading: astmLoading } = useAstmTablesCache();

  // Helper: pick correct ASTM E308 weighting table based on org defaults
  const getOrgWeightingTable = (astmTables = []) => {
    if (!Array.isArray(astmTables) || astmTables.length === 0) return null;
    const orgDefaults = profile?.organization || {};
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

  // Group CxF objects by base color name and organize tints
  const organizedColors = useMemo(() => {
    if (!cxfObjects || cxfObjects.length === 0) return [];

    const colorGroups = {};
    
    cxfObjects.forEach((obj, index) => {
      const variant = obj.cxfVariant || 'CxF3';
      const isSpotColor = obj.isSpotColor || variant.startsWith('CxF/X-4');
      
      // Handle SpotInkCharacterisation objects
      if (obj.objectType === 'SpotInkCharacterisation') {
        const baseName = obj.spotInkName || obj.name;
        
        
        if (!colorGroups[baseName]) {
          colorGroups[baseName] = {
            baseName,
            variant,
            isSpotColor: true,
            hasOverBlackMeasurements: obj.hasOverBlackMeasurements,
            tints: [],
            substrates: [],
            overBlackTints: [],
            // Store the complete SpotInkCharacterisation as a single entity
            spotInkCharacterisation: obj,
            allTints: [] // Will contain all tints for selection but display as single item
          };
        }
        
        // For SpotInkCharacterisation, create a single combined entry that represents the entire ink
        const combinedTintData = {
          index: `${index}-combined`, // Single index for the entire ink
          name: baseName, // Use just the SpotInkName
          spotInkName: baseName,
          tintCount: (obj.substrateTints?.length || 0) + (obj.overBlackTints?.length || 0),
          substrateTintCount: obj.substrateTints?.length || 0,
          overBlackTintCount: obj.overBlackTints?.length || 0,
          hasOverBlackMeasurements: obj.hasOverBlackMeasurements,
          colorHex: obj.colorHex, // Use primary color for display
          lab: obj.lab,
          spectralData: obj.spectralData,
          originalObject: obj,
          measurementType: 'combined',
          // Include tint details for inspection
          tintDetails: {
            substrate: obj.substrateTints || [],
            overBlack: obj.overBlackTints || []
          }
        };
        
        // Add the combined entry to allTints for selection
        colorGroups[baseName].allTints.push(combinedTintData);
        
        // Also add individual tints to allTints for internal processing but they won't be displayed separately
        const tintsList = obj.substrateTints || obj.tints || [];
        if (tintsList.length > 0) {
          tintsList.forEach((tint, tintIndex) => {
            colorGroups[baseName].allTints.push({
              index: `${index}-substrate-${tintIndex}`,
              name: tint.name,
              tintPercentage: tint.tintPercentage,
              isSubstrate: tint.tintPercentage === 0,
              substrateType: tint.tintPercentage === 0 ? 'white' : null,
              colorHex: tint.colorHex,
              lab: tint.lab,
              spectralData: tint.spectralData,
              measurements: tint.measurements,
              originalObject: obj,
              measurementType: 'substrate',
              parentCombinedIndex: `${index}-combined` // Reference to the combined entry
            });
          });
        }
        
        if (obj.overBlackTints) {
          obj.overBlackTints.forEach((tint, tintIndex) => {
            colorGroups[baseName].allTints.push({
              index: `${index}-overblack-${tintIndex}`,
              name: `${tint.name} (Over-black)`,
              tintPercentage: tint.tintPercentage,
              isSubstrate: false,
              substrateType: null,
              colorHex: tint.colorHex,
              lab: tint.lab,
              spectralData: tint.spectralData,
              measurements: tint.measurements,
              originalObject: obj,
              measurementType: 'over-black',
              parentCombinedIndex: `${index}-combined` // Reference to the combined entry
            });
          });
        }
      } else {
        // Handle regular color objects
        const tintPercentage = obj.tintPercentage;
        const isSubstrate = obj.isSubstrate;
        const substrateType = obj.substrateType;
        
        // Extract base color name (remove tint percentage and substrate indicators)
        let baseName = obj.name;
        if (isSpotColor) {
          baseName = baseName
            .replace(/\s*\d+%?\s*/g, '') // Remove percentage
            .replace(/\s*(substrate|paper|backing|white|black)\s*/gi, '') // Remove substrate indicators
            .trim();
        }
        
        if (!colorGroups[baseName]) {
          colorGroups[baseName] = {
            baseName,
            variant,
            isSpotColor,
            hasOverBlackMeasurements: false,
            tints: [],
            substrates: [],
            overBlackTints: []
          };
        }
        
        const tintData = {
          index,
          name: obj.name,
          tintPercentage: isSubstrate ? 0 : (tintPercentage || 100),
          isSubstrate,
          substrateType: substrateType || 'white',
          colorHex: obj.colorHex,
          lab: obj.lab,
          spectralData: obj.spectralData,
          originalObject: obj,
          measurementType: 'substrate'
        };
        
        if (isSubstrate) {
          colorGroups[baseName].substrates.push(tintData);
        } else {
          colorGroups[baseName].tints.push(tintData);
        }
      }
    });

    // Sort tints by percentage and prepare display tints
    Object.values(colorGroups).forEach(group => {
      group.tints.sort((a, b) => b.tintPercentage - a.tintPercentage);
      group.overBlackTints.sort((a, b) => b.tintPercentage - a.tintPercentage);
      
      // For SpotInkCharacterisation, show only the combined entry
      if (group.spotInkCharacterisation) {
        // Display only the combined entry, but keep all tints in allTints for selection processing
        group.displayTints = group.allTints.filter(tint => tint.measurementType === 'combined');
      } else {
        // For regular colors, show all individual tints
        group.displayTints = [...group.substrates, ...group.tints, ...group.overBlackTints];
        group.allTints = group.displayTints; // Same as displayTints for regular colors
      }
    });

    return Object.values(colorGroups);
  }, [cxfObjects]);

    // Calculate Lab values on-demand from spectral data using validated ASTM tables
    const calculateLabFromSpectral = useMemo(() => {
      if (astmLoading || !astmTables || astmTables.length === 0) {
        return () => null; // Return function that returns null when ASTM not ready
      }
      
      const weightingTable = getOrgWeightingTable(astmTables);
      if (!weightingTable) return () => null;
      
      return (spectralData) => {
        if (!spectralData || Object.keys(spectralData).length === 0) return null;
        
        try {
          const lab = spectralToLabASTME308(spectralData, weightingTable);
          if (lab && typeof lab.L === 'number') {
            const hex = labToHex(lab.L, lab.a, lab.b, lab.illuminant || 'D50');
            return { ...lab, hex };
          }
        } catch (error) {
          console.warn('Failed to calculate LAB from spectral data:', error);
        }
        return null;
      };
    }, [astmTables, astmLoading, profile?.organization]);

  // Helper function to get color hex from tint data
  const getColorHex = (tint, spectralData) => {
    // Try direct hex color first
    if (tint.colorHex) return tint.colorHex;
    
    // Try calculating from Lab if available
    if (tint.lab && typeof tint.lab.L === 'number') {
      return labToHex(tint.lab.L, tint.lab.a, tint.lab.b, tint.lab.illuminant || 'D50');
    }
    
    // Try calculating from spectral data
    if (spectralData && calculateLabFromSpectral) {
      const labResult = calculateLabFromSpectral(spectralData);
      if (labResult?.hex) return labResult.hex;
    }
    
    // Return fallback color
    return null;
  };

  // Check if any colors have missing measurement modes for spectral data
  const hasSpectralWithoutMode = useMemo(() => {
    return organizedColors.some(colorGroup => {
      const individualTints = colorGroup.spotInkCharacterisation 
        ? colorGroup.allTints.filter(t => t.measurementType !== 'combined')
        : colorGroup.allTints;
      
      // Use same logic as UI: check if mode list would be empty
      const modeSets = individualTints
        .map(t => new Set((t.measurements || []).map(m => m.mode).filter(Boolean)))
        .filter(s => s.size > 0);
      
      // If no modes exist but we have spectral data, we need mode assignment
      const hasSpectralData = individualTints.some(t => {
        const spectralData = t.spectralData || (t.measurements || []).find(m => m.spectral_data)?.spectral_data;
        return spectralData && Object.keys(spectralData).length > 0;
      });
      
      return modeSets.length === 0 && hasSpectralData;
    });
  }, [organizedColors]);

  // Auto-select first display tint when dialog opens
  React.useEffect(() => {
    if (organizedColors.length > 0 && selectedTints.length === 0) {
      const firstDisplayTint = organizedColors[0]?.displayTints?.[0];
      if (firstDisplayTint) {
        setSelectedTints([firstDisplayTint.index]);
      }
    }
  }, [organizedColors, selectedTints.length]);

  const handleTintToggle = (tintIndex, isChecked) => {
    // For radio behavior, clear previous selections and select only this one
    if (isChecked) {
      setSelectedTints([tintIndex]);
    } else {
      setSelectedTints([]);
    }
  };

  const handleSelectAllTints = (colorGroup, isChecked) => {
    // For radio behavior, select the first tint in the group or clear all
    if (isChecked && colorGroup.allTints.length > 0) {
      setSelectedTints([colorGroup.allTints[0].index]);
    } else {
      setSelectedTints([]);
    }
  };


  const handleColorGroupToggle = (colorGroup, isChecked) => {
    // For radio behavior, select the first tint in the group or clear all
    if (isChecked && colorGroup.allTints.length > 0) {
      setSelectedTints([colorGroup.allTints[0].index]);
    } else {
      setSelectedTints([]);
    }
  };

  const handleImport = () => {
    console.log('=== CxfInkImportDialog handleImport ===');
    console.log('selectedTints:', selectedTints);
    
    try {
      if (selectedTints.length === 0) {
        console.log('No tints selected');
        return;
      }
      
      // Find the selected tint and get its original CxF object
      const selectedTint = organizedColors
        .flatMap(colorGroup => colorGroup.allTints)
        .find(tint => selectedTints.includes(tint.index));
      
      console.log('Found selectedTint:', selectedTint);
      
      if (!selectedTint) {
        console.log('Selected tint not found');
        return;
      }
      
      // Send the original CxF object with applied measurement mode and all mode data
      const originalObject = {
        ...selectedTint.originalObject,
        measurementMode: measurementMode || defaultMeasurementMode,
        // Preserve all measurement mode data in the import
        preserveAllModes: true,
        assignedMode: measurementMode || defaultMeasurementMode
      };
      
      console.log('Calling onImport with:', [originalObject]);
      onImport([originalObject]);
    } catch (error) {
      console.error('Error during import:', error);
    } finally {
      // Always close the dialog, even if import fails
      onClose();
    }
  };

  const getTintPercentageDisplay = (tint) => {
    if (tint.isSubstrate) {
      return `Substrate (${tint.substrateType})`;
    }
    return `${tint.tintPercentage}%`;
  };

  const getVariantBadgeColor = (variant) => {
    switch (variant) {
      case 'CxF/X-4': return 'bg-green-100 text-green-800';
      case 'CxF/X-4a': return 'bg-blue-100 text-blue-800';
      case 'CxF/X-4b': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (organizedColors.length === 0) {
    if (embedded) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            No spot color data with tints was found in the imported file.
          </p>
        </div>
      );
    }
    
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>No CxF/X-4 Data Found</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              No spot color data with tints was found in the imported file.
            </p>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Embedded version (used within another dialog)
  if (embedded) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-[300px] w-full">
            <RadioGroup value={selectedTints[0] || ""} onValueChange={(value) => handleTintToggle(value, true)}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead className="w-16">Color</TableHead>
                    <TableHead>Ink Name</TableHead>
                    <TableHead>Object Type</TableHead>
                    <TableHead>LAB Value</TableHead>
                    <TableHead>Spectral Format</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizedColors.map((colorGroup, groupIndex) => {
                    // For SpotInkCharacterisation, show only the combined entry
                    const displayItems = colorGroup.spotInkCharacterisation ? 
                      colorGroup.displayTints : 
                      colorGroup.displayTints;
                    
                    return displayItems.map((tint) => {
                    const isSelected = selectedTints.includes(tint.index);
                    
                    // Compute intersection of modes across all tints in this group
                    const individualTints = colorGroup.spotInkCharacterisation 
                      ? colorGroup.allTints.filter(t => t.measurementType !== 'combined')
                      : colorGroup.allTints;
                    
                     // For spectral count, fall back to first underlying tint if combined entry lacks data
                      let spectralData = tint.spectralData || (tint.measurements || []).find(m => m.spectral_data)?.spectral_data;
                      if (!spectralData && tint.measurementType === 'combined') {
                        const firstTintWithSpectral = individualTints.find(t => t.spectralData || (t.measurements || []).some(m => m.spectral_data));
                        spectralData = firstTintWithSpectral?.spectralData || firstTintWithSpectral?.measurements?.find(m => m.spectral_data)?.spectral_data;
                      }
                    const hasSpectral = spectralData && Object.keys(spectralData).length > 0;
                    const spectralCount = hasSpectral ? Object.keys(spectralData).length : 0;
                    const modeOrder = ['M0','M1','M2','M3'];
                    const modeSets = individualTints
                      .map(t => new Set((t.measurements || []).map(m => m.mode).filter(Boolean)))
                      .filter(s => s.size > 0);
                    let modeList = [];
                    if (modeSets.length > 0) {
                      const intersection = new Set(modeSets[0]);
                      modeSets.slice(1).forEach(set => {
                        for (const m of Array.from(intersection)) {
                          if (!set.has(m)) intersection.delete(m);
                        }
                      });
                      modeList = Array.from(intersection);
                    }
                    modeList.sort((a,b) => modeOrder.indexOf(a) - modeOrder.indexOf(b));
                    const tintCount = tint.measurementType === 'combined' ? 
                      tint.tintCount : 
                      1;
                    
                    return (
                       <TableRow key={tint.index} className={isSelected ? 'bg-blue-50' : ''}>
                         <TableCell>
                           <RadioGroupItem 
                             value={tint.index}
                             id={`tint-${tint.index}`}
                             className="h-4 w-4"
                           />
                         </TableCell>
                         <TableCell>
                         <div 
                           className="w-8 h-8 rounded border border-gray-300 flex-shrink-0"
                           style={{ 
                             backgroundColor: (() => {
                               const colorHex = getColorHex(tint, spectralData);
                               return colorHex || '#f3f4f6';
                             })(),
                             backgroundImage: !getColorHex(tint, spectralData) ? 
                               'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)' : 'none'
                           }}
                           title={getColorHex(tint, spectralData) || 'No color data'}
                           />
                         </TableCell>
                        <TableCell>
                          <div className="font-medium">{tint.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            <div>Modes: {modeList.length ? modeList.join(', ') : '—'} • {tintCount} tint{tintCount !== 1 ? 's' : ''}</div>
                            {hasSpectralWithoutMode && (
                              <div className="flex items-center gap-1 mt-1">
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                                <span className="text-amber-600">
                                  {defaultMeasurementMode ? `${defaultMeasurementMode} (assigned)` : 'No mode detected'}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {colorGroup.spotInkCharacterisation ? 'SIC' : 'Color'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {astmLoading ? (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Calculating...
                            </span>
                           ) : (() => {
                             // Try original Lab first, then calculate from spectral
                             let labToShow = tint.lab;
                             if (!labToShow && spectralData && calculateLabFromSpectral) {
                               labToShow = calculateLabFromSpectral(spectralData);
                             }
                             
                             return labToShow && typeof labToShow.L === 'number' ? (
                               <span className="text-sm font-medium">
                                 L:{labToShow.L.toFixed(1)} a:{labToShow.a.toFixed(1)} b:{labToShow.b.toFixed(1)}
                               </span>
                             ) : (
                               <span className="text-muted-foreground text-sm">No LAB data</span>
                             );
                           })()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={hasSpectral ? "default" : "secondary"}>
                            {spectralCount} points
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  });
                 })}
               </TableBody>
             </Table>
            </RadioGroup>
           </ScrollArea>
        </div>

        <div className="border-t pt-2 mt-4">
          <div className="text-sm text-muted-foreground">
            Selected {selectedTints.length} tint{selectedTints.length !== 1 ? 's' : ''} for import
          </div>
        </div>
      </div>
    );
  }

  // Full dialog version  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select tints to import for ink wedge characterization. Each color group represents different tint percentages of the same spot color.
          </p>
        </DialogHeader>
        
        {/* Import Settings - Show immediately when needed */}
        <ImportSettingsCollapsible
          hasSpectralWithoutMode={hasSpectralWithoutMode}
          defaultMeasurementMode={measurementMode}
          onDefaultMeasurementModeChange={setMeasurementMode}
          showImportModeSelection={false}
          showStandardTypeControls={false}
          showPrintConditionControls={false}
        />
        
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-[400px] w-full">
            <RadioGroup value={selectedTints[0] || ""} onValueChange={(value) => handleTintToggle(value, true)}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead className="w-16">Color</TableHead>
                    <TableHead>Ink Name</TableHead>
                    <TableHead>Object Type</TableHead>
                    <TableHead>LAB Value</TableHead>
                    <TableHead>Spectral Format</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizedColors.map((colorGroup, groupIndex) => {
                    const displayItems = colorGroup.spotInkCharacterisation ? 
                      colorGroup.displayTints : 
                      colorGroup.displayTints;
                    
                    return displayItems.map((tint) => {
                    const isSelected = selectedTints.includes(tint.index);
                    
                    // Compute intersection of modes across all tints in this group
                    const individualTints = colorGroup.spotInkCharacterisation 
                      ? colorGroup.allTints.filter(t => t.measurementType !== 'combined')
                      : colorGroup.allTints;
                    
                     // For spectral count, fall back to first underlying tint if combined entry lacks data
                      let spectralData = tint.spectralData || (tint.measurements || []).find(m => m.spectral_data)?.spectral_data;
                      if (!spectralData && tint.measurementType === 'combined') {
                        const firstTintWithSpectral = individualTints.find(t => t.spectralData || (t.measurements || []).some(m => m.spectral_data));
                        spectralData = firstTintWithSpectral?.spectralData || firstTintWithSpectral?.measurements?.find(m => m.spectral_data)?.spectral_data;
                      }
                    const hasSpectral = spectralData && Object.keys(spectralData).length > 0;
                    const spectralCount = hasSpectral ? Object.keys(spectralData).length : 0;
                    const modeOrder = ['M0','M1','M2','M3'];
                    const modeSets = individualTints
                      .map(t => new Set((t.measurements || []).map(m => m.mode).filter(Boolean)))
                      .filter(s => s.size > 0);
                    let modeList = [];
                    if (modeSets.length > 0) {
                      const intersection = new Set(modeSets[0]);
                      modeSets.slice(1).forEach(set => {
                        for (const m of Array.from(intersection)) {
                          if (!set.has(m)) intersection.delete(m);
                        }
                      });
                      modeList = Array.from(intersection);
                    }
                    modeList.sort((a,b) => modeOrder.indexOf(a) - modeOrder.indexOf(b));
                    const tintCount = tint.measurementType === 'combined' ? 
                      tint.tintCount : 
                      1;
                    
                     return (
                       <TableRow key={tint.index} className={isSelected ? 'bg-blue-50' : ''}>
                         <TableCell>
                           <RadioGroupItem 
                             value={tint.index}
                             id={`full-tint-${tint.index}`}
                             className="h-4 w-4"
                           />
                         </TableCell>
                        <TableCell>
                          <div 
                            className="w-8 h-8 rounded border border-gray-300 flex-shrink-0"
                           style={{ 
                             backgroundColor: (() => {
                               const colorHex = getColorHex(tint, spectralData);
                               return colorHex || '#f3f4f6';
                             })(),
                             backgroundImage: !getColorHex(tint, spectralData) ? 
                               'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)' : 'none'
                           }}
                           title={getColorHex(tint, spectralData) || 'No color data'}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{tint.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            <div>Modes: {modeList.length ? modeList.join(', ') : '—'} • {(() => {
                              // Enhanced background detection
                              if (tint.measurementType === 'combined' && colorGroup.spotInkCharacterisation) {
                                const sicObj = colorGroup.spotInkCharacterisation;
                                const substrateTints = sicObj.substrateTints || [];
                                const overBlackTints = sicObj.overBlackTints || [];
                                const totalTints = substrateTints.length + overBlackTints.length;
                                
                                 // Enhanced background detection
                                 let backgroundCount = 1;
                                 let backgrounds = [];
                                 
                                 const measurementSettings = sicObj.measurement_settings || sicObj.original?.measurement_settings;
                                 if (measurementSettings?.available_backgrounds) {
                                   backgrounds = measurementSettings.available_backgrounds;
                                   backgroundCount = backgrounds.length;
                                 } else {
                                   // Fallback detection
                                   backgrounds = ['Substrate'];
                                   if (overBlackTints.length > 0) {
                                     backgrounds.push('Over-black');
                                     backgroundCount = 2;
                                   }
                                 }
                                 
                                 if (backgroundCount > 1) {
                                   const tintCount = substrateTints.length;
                                   const backgroundList = backgrounds.map((bg, idx) => `Background ${idx + 1}`).join(', ');
                                   return `${tintCount} tints on ${backgroundCount} backgrounds`;
                                 } else {
                                   return `${totalTints} tint${totalTints !== 1 ? 's' : ''}`;
                                 }
                              }
                              return `${tintCount} tint${tintCount !== 1 ? 's' : ''}`;
                            })()}</div>
                            {hasSpectralWithoutMode && (
                              <div className="flex items-center gap-1 mt-1">
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                               <span className="text-amber-600">
                                 {(measurementMode || defaultMeasurementMode) ? `${measurementMode || defaultMeasurementMode} (assigned)` : 'No mode detected'}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {colorGroup.spotInkCharacterisation ? 'SIC' : 'Color'}
                          </Badge>
                        </TableCell>
                           <TableCell className="text-sm">
                             {astmLoading ? (
                               <span className="text-muted-foreground flex items-center gap-1">
                                 <Loader2 className="w-3 h-3 animate-spin" />
                                 Calculating...
                               </span>
                             ) : (() => {
                               // Try original Lab first, then calculate from spectral
                               // Try original Lab first, then calculate from spectral
                               let labToShow = tint.lab;
                               if (!labToShow && spectralData && calculateLabFromSpectral) {
                                 labToShow = calculateLabFromSpectral(spectralData);
                               }
                               
                               return labToShow && typeof labToShow.L === 'number' ? (
                                 <span className="text-sm font-medium">
                                   L:{labToShow.L.toFixed(1)} a:{labToShow.a.toFixed(1)} b:{labToShow.b.toFixed(1)}
                                 </span>
                               ) : (
                                 <span className="text-muted-foreground text-sm">No LAB data</span>
                               );
                             })()}
                           </TableCell>
                        <TableCell>
                          <Badge variant={hasSpectral ? "default" : "secondary"}>
                            {spectralCount} points
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })}
              </TableBody>
            </Table>
            </RadioGroup>
          </ScrollArea>
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <div className="text-sm text-muted-foreground">
              Selected {selectedTints.length} tint{selectedTints.length !== 1 ? 's' : ''} for import
            </div>
            <Button 
              onClick={handleImport} 
              disabled={selectedTints.length === 0}
            >
              Import Selected Ink
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CxfInkImportDialog;