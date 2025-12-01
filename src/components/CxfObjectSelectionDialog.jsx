import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Edit2, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { spectralToLabASTME308, labToHexD65 } from '@/lib/colorUtils';
import { getWavelengthRange } from '@/lib/colorUtils/spectralRangeUtils';
import { useProfile } from '@/context/ProfileContext';

const CxfObjectSelectionDialog = ({ 
  isOpen, 
  onClose, 
  objects, 
  onImport, 
  importContext, // 'substrate-condition' | 'print-condition' | 'ink-condition' | 'colors'
  title = "Select CxF Objects to Import",
  twoStageInk = true // when false and importContext==='ink-condition', close after import
}) => {
  const [selectedObjects, setSelectedObjects] = useState([]);
  const [colorType, setColorType] = useState('master'); // For colors import only
  const [defaultMeasurementMode, setDefaultMeasurementMode] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setSelectedObjects([]);
      setDefaultMeasurementMode('');
      setColorType('master');
      setSaving(false);
    }
  }, [isOpen]);
  
  // ASTM tables fetched on-demand when dialog opens
  const [astmTables, setAstmTables] = useState([]);
  const [astmLoading, setAstmLoading] = useState(false);
  React.useEffect(() => {
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
      } catch (_) {
        if (!cancelled) setAstmTables([]);
      } finally {
        if (!cancelled) setAstmLoading(false);
      }
    };
    fetchAstm();
    return () => { cancelled = true; };
  }, [isOpen]);
  
  // Get organization defaults for Lab calculations
  const { profile } = useProfile();
  const orgDefaults = {
    illuminant: profile?.organization?.default_illuminant || 'D50',
    observer: profile?.organization?.default_observer || '2',
    table: profile?.organization?.default_astm_table || '5'
  };
  
  // Helper function to extract spectral data from various CxF object structures
  const extractSpectralData = (obj) => {
    console.log('Extracting spectral data for object:', obj.name, obj.objectType);
    console.log('Object structure:', {
      spectralData: !!obj.spectralData,
      measurements: obj.measurements?.length || 0,
      substrateTints: obj.substrateTints?.length || 0,
      overBlackTints: obj.overBlackTints?.length || 0,
      objectType: obj.objectType,
      cxfVariant: obj.cxfVariant
    });
    
    // Direct spectral data property
    if (obj.spectralData && typeof obj.spectralData === 'object') {
      console.log('Found direct spectralData with keys:', Object.keys(obj.spectralData));
      return obj.spectralData;
    }
    
    // Check measurements array for spectral data
    if (obj.measurements?.length > 0) {
      for (const measurement of obj.measurements) {
        if (measurement.spectral_data && typeof measurement.spectral_data === 'object') {
          console.log('Found spectral_data in measurements with keys:', Object.keys(measurement.spectral_data));
          return measurement.spectral_data;
        }
        if (measurement.spectralData && typeof measurement.spectralData === 'object') {
          console.log('Found spectralData in measurements with keys:', Object.keys(measurement.spectralData));
          return measurement.spectralData;
        }
      }
    }
    
    // For CxF/X-4 SpotInkCharacterisation objects, check substrateTints and overBlackTints
    if (obj.objectType === 'SpotInkCharacterisation' || obj.cxfVariant?.startsWith('CxF/X-4')) {
      console.log('Checking CxF/X-4 object for spectral data in tints:', {
        substrateTints: obj.substrateTints?.length || 0,
        overBlackTints: obj.overBlackTints?.length || 0
      });
      
      // Check each substrate tint for spectral data
      if (obj.substrateTints?.length > 0) {
        console.log('Substrate tints details:', obj.substrateTints.map(tint => ({
          name: tint.name,
          tintPercentage: tint.tintPercentage,
          hasSpectralData: !!tint.spectralData,
          spectralKeys: tint.spectralData ? Object.keys(tint.spectralData) : [],
          hasMeasurements: !!tint.measurements,
          measurementCount: tint.measurements?.length || 0
        })));
        
        // Look for 100% solid tint in substrateTints first
        const solidTint = obj.substrateTints.find(tint => 
          tint.tintPercentage === 100 || 
          tint.tintPercentage === '100' ||
          (tint.name && tint.name.includes('100%'))
        );
        
        if (solidTint?.spectralData && typeof solidTint.spectralData === 'object') {
          console.log('Found spectral data in 100% substrate tint with keys:', Object.keys(solidTint.spectralData));
          return solidTint.spectralData;
        }
        
        // Check if the solid tint has measurements with spectral data
        if (solidTint?.measurements?.length > 0) {
          for (const measurement of solidTint.measurements) {
            if (measurement.spectral_data && typeof measurement.spectral_data === 'object') {
              console.log('Found spectral_data in 100% tint measurements with keys:', Object.keys(measurement.spectral_data));
              return measurement.spectral_data;
            }
          }
        }
        
        // Fallback to first substrate tint if no 100% found
        const firstSubstrate = obj.substrateTints[0];
        if (firstSubstrate?.spectralData && typeof firstSubstrate.spectralData === 'object') {
          console.log('Found spectral data in first substrate tint with keys:', Object.keys(firstSubstrate.spectralData));
          return firstSubstrate.spectralData;
        }
        
        // Check measurements in first substrate tint
        if (firstSubstrate?.measurements?.length > 0) {
          for (const measurement of firstSubstrate.measurements) {
            if (measurement.spectral_data && typeof measurement.spectral_data === 'object') {
              console.log('Found spectral_data in first substrate tint measurements with keys:', Object.keys(measurement.spectral_data));
              return measurement.spectral_data;
            }
          }
        }
      }
      
      // Fallback to overBlackTints if no substrate data
      if (obj.overBlackTints?.length > 0) {
        const firstOverBlack = obj.overBlackTints[0];
        if (firstOverBlack?.spectralData && typeof firstOverBlack.spectralData === 'object') {
          console.log('Found spectral data in first over-black tint with keys:', Object.keys(firstOverBlack.spectralData));
          return firstOverBlack.spectralData;
        }
        
        // Check measurements in over-black tint
        if (firstOverBlack?.measurements?.length > 0) {
          for (const measurement of firstOverBlack.measurements) {
            if (measurement.spectral_data && typeof measurement.spectral_data === 'object') {
              console.log('Found spectral_data in over-black tint measurements with keys:', Object.keys(measurement.spectral_data));
              return measurement.spectral_data;
            }
          }
        }
      }
    }
    
    console.log('No spectral data found for object:', obj.name);
    return null;
  };

  // Function to calculate LAB and hex from spectral data using organization defaults
  const calculateLabFromSpectral = useMemo(() => {
    if (astmLoading || !astmTables?.length) return null;
    
    return (spectralData) => {
      try {
        // Use organization defaults for calculation
        const illuminant = orgDefaults.illuminant;
        const observer = orgDefaults.observer;
        const tableNumber = orgDefaults.table;
        
        console.log(`🔬 CxF Lab Calculation using org defaults:`, {
          illuminant,
          observer: `${observer}°`,
          table: `Table ${tableNumber}`,
          spectralPoints: spectralData ? Object.keys(spectralData).length : 0
        });
        
        if (!spectralData || Object.keys(spectralData).length === 0) {
          console.warn('❌ No spectral data provided for calculation');
          return null;
        }
        
        // Build normalized weighting rows for ASTM E308 (must be an array, not a single row)
        const matchingRows = astmTables.filter(row => 
          row.illuminant_name === illuminant && 
          String(row.observer) === String(observer) && 
          String(row.table_number) === String(tableNumber)
        );
        
        console.log(`📊 Found ${matchingRows.length} matching ASTM rows for ${illuminant}/${observer}°/Table ${tableNumber}`);
        
        const weightingRows = (matchingRows.length ? matchingRows : astmTables)
          .map(r => ({
            ...r,
            white_point_x: r.white_point_x ?? r.xn,
            white_point_y: r.white_point_y ?? r.yn,
            white_point_z: r.white_point_z ?? r.zn,
            wavelength: r.wavelength ?? r.lambda ?? r.wl,
            x_factor: r.x_factor ?? r.xbar ?? r.Sx ?? r.x,
            y_factor: r.y_factor ?? r.ybar ?? r.Sy ?? r.y,
            z_factor: r.z_factor ?? r.zbar ?? r.Sz ?? r.z,
          }));
        
        if (!weightingRows.length) {
          console.warn('❌ No ASTM weighting rows found after normalization');
          return null;
        }
        
        // Convert spectral data to Lab
        const lab = spectralToLabASTME308(spectralData, weightingRows);
        if (!lab) {
          console.warn('❌ spectralToLabASTME308 returned null');
          return null;
        }
        
        console.log(`✅ Calculated Lab values:`, {
          L: lab.L?.toFixed(2),
          a: lab.a?.toFixed(2),
          b: lab.b?.toFixed(2)
        });
        
        // Convert Lab to hex
        const hex = labToHexD65(lab.L, lab.a, lab.b, illuminant);
        
        console.log(`🎨 Generated hex color: ${hex} from Lab(${lab.L?.toFixed(2)}, ${lab.a?.toFixed(2)}, ${lab.b?.toFixed(2)})`);
        
        return { lab, hex };
      } catch (error) {
        console.error('❌ Failed to calculate LAB from spectral data:', error);
        return null;
      }
    };
  }, [astmTables, astmLoading, orgDefaults]);

  const handleObjectToggle = (objectIndex, isChecked) => {
    if (importContext === 'substrate-condition' || importContext === 'ink-condition') {
      // Single selection for substrate and ink conditions
      setSelectedObjects(isChecked ? [objectIndex] : []);
    } else {
      // Multi-selection for colors
      setSelectedObjects(prev => 
        isChecked 
          ? [...prev, objectIndex]
          : prev.filter(idx => idx !== objectIndex)
      );
    }
  };

  const handleRadioSelection = (objectIndex) => {
    setSelectedObjects([parseInt(objectIndex)]);
  };

  const handleImport = async () => {
    if (selectedObjects.length === 0) return;
    
    setSaving(true);
    try {
      const selectedObjectsData = selectedObjects.map(index => {
        const obj = objects[index];
        // Apply default measurement mode ONLY if explicitly selected by user
        const hasNoMode = !obj.measurementMode || obj.measurementMode === null;
        const hasSpectralData = obj.measurements?.some(m => m.spectral_data) || obj.spectralData;
        
        if (hasNoMode && hasSpectralData && defaultMeasurementMode) {
          return {
            ...obj,
            measurementMode: defaultMeasurementMode,
            measurements: obj.measurements?.map(m => ({
              ...m,
              mode: !m.mode || m.mode === null ? defaultMeasurementMode : m.mode
            }))
          };
        }
        return obj; // Keep original object, including null modes
      });
      
      await onImport(selectedObjectsData, colorType);
      // Close dialog unless we're in two-stage ink flow
      if (importContext !== 'ink-condition' || twoStageInk === false) {
        // Ensure dialog closes reliably (shadcn onClose expects boolean setter)
        onClose?.(false);
      }
    } finally {
      setSaving(false);
    }
  };

  // Check if ANY objects have missing measurement modes (null) and spectral data - show immediately
  const hasSpectralWithoutMode = objects.some(obj => {
    const hasNoMode = !obj.measurementMode || obj.measurementMode === null;
    const hasSpectralData = extractSpectralData(obj);
    return hasNoMode && hasSpectralData;
  });

  // Always allow import without edit mode - require measurement mode if spectral data lacks it
  const canSave = selectedObjects.length > 0 && (!hasSpectralWithoutMode || defaultMeasurementMode);

  const isColorImport = importContext === 'colors';
  const maxSelectionReached = (importContext === 'substrate-condition' || importContext === 'ink-condition') && selectedObjects.length >= 1;

  // Get background information - extract actual background names from CxF data
  const getBackgroundSummary = (obj) => {
    const backgroundNames = new Set();
    
    // Extract background names from substrate tints
    if (obj.substrateTints?.length > 0) {
      obj.substrateTints.forEach(tint => {
        if (tint.backgroundName) {
          backgroundNames.add(tint.backgroundName);
        } else {
          backgroundNames.add('Substrate'); // fallback
        }
      });
    }
    
    // Extract background names from over-black tints
    if (obj.overBlackTints?.length > 0) {
      obj.overBlackTints.forEach(tint => {
        if (tint.backgroundName) {
          backgroundNames.add(tint.backgroundName);
        } else {
          backgroundNames.add('Over-black'); // fallback
        }
      });
    }
    
    // Count tints specifically on substrate background only
    const substrateTints = obj.substrateTints?.filter(tint => 
      !tint.backgroundName || 
      tint.backgroundName.toLowerCase().includes('substrate') ||
      tint.backgroundName.toLowerCase().includes('paper')
    )?.length || obj.substrateTints?.length || 0;
    
    return {
      tintsPerBackground: substrateTints,
      uniqueBackgrounds: backgroundNames.size,
      backgroundNames: Array.from(backgroundNames)
    };
  };

  // Detect CxF format from objects
  const cxfFormat = useMemo(() => {
    if (!objects || objects.length === 0) return null;
    
    // Check for CxF format indicators
    const firstObj = objects[0];
    if (firstObj.cxfVariant) {
      if (firstObj.cxfVariant.includes('CxF3')) return 'CxF3';
      if (firstObj.cxfVariant.includes('CxF/X-4')) return 'CxF/X-4';
      return firstObj.cxfVariant;
    }
    
    // Fallback detection based on object structure
    if (firstObj.objectType === 'SpotInkCharacterisation') return 'CxF/X-4';
    
    // Don't show format for CGATS or generic ColorValues
    if (firstObj.objectType === 'ColorValues' && !firstObj.cxfVariant) return null;
    
    return 'CxF3'; // Default assumption for actual CxF files
  }, [objects]);

  const isInvalidLab = (lab) => {
    if (!lab) return true;
    const L = Number(lab.L);
    const a = Number(lab.a);
    const b = Number(lab.b);
    if ([L, a, b].some(v => Number.isNaN(v))) return true;
    return Math.abs(L) < 0.0001 && Math.abs(a) < 0.0001 && Math.abs(b) < 0.0001;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {title}
            {cxfFormat && <span className="text-sm text-gray-500 ml-2">({cxfFormat} detected)</span>}
          </DialogTitle>
        </DialogHeader>
        
        {/* Measurement Mode Selection Card - Show early and pin above table */}
        {hasSpectralWithoutMode && (
          <div className={`border rounded-lg p-4 mb-4 ${defaultMeasurementMode ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${defaultMeasurementMode ? 'text-blue-600' : 'text-red-600'}`} />
              <div className="flex-1">
                <h4 className={`text-sm font-bold ${defaultMeasurementMode ? 'text-blue-600' : 'text-red-600'} flex items-center justify-between`}>
                  {defaultMeasurementMode ? 'Measurement Mode Selected' : 'Measurement Mode Required'}
                </h4>
                <p className={`text-sm mt-1 mb-3 ${defaultMeasurementMode ? 'text-blue-700' : 'text-red-700'}`}>
                  {defaultMeasurementMode 
                    ? `Default mode "${defaultMeasurementMode}" will be assigned to spectral colors without measurement modes.`
                    : 'Some spectral colors don\'t have measurement modes. Choose a default mode to assign during import.'
                  }
                </p>
                <div className="flex items-center gap-4">
                  <Label htmlFor="measurement-mode-select" className={`text-sm font-medium ${defaultMeasurementMode ? 'text-blue-600' : 'text-red-600'}`}>
                    Assign to inks with missing measurement mode:
                  </Label>
                  <Select value={defaultMeasurementMode} onValueChange={setDefaultMeasurementMode}>
                     <SelectTrigger className={`w-32 bg-white ${defaultMeasurementMode ? 'border-blue-300' : 'border-red-300'}`}>
                       <SelectValue placeholder="Select Mode" />
                     </SelectTrigger>
                    <SelectContent className="bg-white border shadow-lg z-50">
                      <SelectItem value="M0">M0</SelectItem>
                      <SelectItem value="M1">M1</SelectItem>
                      <SelectItem value="M2">M2</SelectItem>
                      <SelectItem value="M3">M3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {(importContext === 'substrate-condition' || importContext === 'ink-condition') ? (
            // Radio button mode for single selection
            <RadioGroup value={selectedObjects[0]?.toString() || ""} onValueChange={handleRadioSelection}>
                  <Table className="border-b border-border">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead className="w-16">Color</TableHead>
                    <TableHead>Color Name</TableHead>
                    <TableHead>Object Type</TableHead>
                    <TableHead>Lab</TableHead>
                    <TableHead>Source Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {objects.map((obj, index) => {
                    const isSelected = selectedObjects.includes(index);
                    
                    // Determine object type display
                    let objectTypeDisplay = obj.objectType || obj.type || 'Standard';
                    if (obj.cxfVariant && obj.cxfVariant.startsWith('CxF/X-4')) {
                      objectTypeDisplay = 'SIC';
                    }
                    
                    // Calculate LAB and hex from spectral data if needed
                    let displayColor = obj.colorHex || obj.hex;
                    let displayLab = obj.lab;
                    
                    // Extract spectral data from various possible locations
                    const spectralData = extractSpectralData(obj);
                    
                    // If no color/LAB but has spectral data, calculate it
                    if ((!displayColor || isInvalidLab(displayLab)) && spectralData && calculateLabFromSpectral) {
                      console.log(`🔍 Calculating color for object: ${obj.name}`);
                      const calculated = calculateLabFromSpectral(spectralData);
                      if (calculated) {
                        console.log(`✅ Calculated result for ${obj.name}:`, { hex: calculated.hex, lab: calculated.lab });
                        if (!displayColor || displayColor === '#000000') displayColor = calculated.hex;
                        if (isInvalidLab(displayLab)) displayLab = calculated.lab;
                      } else {
                        console.warn(`❌ Failed to calculate color for ${obj.name}`);
                      }
                    }
                    
                    // Fallback color if still no valid color
                    if (!displayColor || displayColor === '#000000' || displayColor === '#ffffff') {
                      displayColor = '#f3f4f6'; // Light gray fallback
                      console.log(`🎨 Using fallback color for ${obj.name}: ${displayColor}`);
                    }

                    // Get background summary for display
                    const backgroundSummary = getBackgroundSummary(obj);
                    
                    // Determine source data badges
                    const sourceDataBadges = [];
                    if (spectralData) {
                      sourceDataBadges.push({ text: 'Spectral', variant: 'secondary' });
                      const wavelengthRange = getWavelengthRange(spectralData);
                      if (wavelengthRange !== 'Unknown range') {
                        sourceDataBadges.push({ text: wavelengthRange, variant: 'outline' });
                      }
                    } else if (obj.lab) {
                      sourceDataBadges.push({ text: 'Lab', variant: 'secondary' });
                      // Add illuminant/observer info if available in the object
                      if (obj.illuminant) {
                        sourceDataBadges.push({ text: obj.illuminant, variant: 'outline' });
                      }
                      if (obj.observer) {
                        sourceDataBadges.push({ text: `${obj.observer}°`, variant: 'outline' });
                      }
                    }
                    
                    return (
                      <TableRow key={index} className={`${isSelected ? 'border-b-0' : ''} h-auto`}>
                        <TableCell className="py-4 align-middle">
                         <div className="flex items-center justify-center">
                            <RadioGroupItem value={index.toString()} className="h-4 w-4" />
                           </div>
                        </TableCell>
                        <TableCell className="py-4 align-middle">
                          <div className="flex items-center">
                          <div 
                            className="w-8 h-8 rounded border border-gray-300 flex-shrink-0"
                            style={{ 
                              backgroundColor: displayColor || '#f3f4f6',
                              backgroundImage: displayColor ? 'none' : 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)'
                            }}
                            title={displayColor || 'No color data'}
                          />
                          </div>
                        </TableCell>
                        <TableCell className="py-4 align-middle">
                          <div className="flex flex-col justify-center">
                          <div className="font-medium truncate max-w-[240px]" title={obj.name}>{obj.name}</div>
                          {cxfFormat !== 'CxF3' && (
                            <div className="text-xs text-muted-foreground mt-1 whitespace-nowrap">
                              {backgroundSummary.tintsPerBackground} tints on {backgroundSummary.uniqueBackgrounds} backgrounds
                            </div>
                          )}
                          
                          {/* Show measurement mode badges under color name */}
                          {obj.measurements && obj.measurements.length > 0 ? (
                            (() => {
                              const rawModes = obj.measurements.map(m => m.mode || m.measurementMode || null).filter(Boolean);
                              const uniqueModes = Array.from(new Set(rawModes));
                              const hasAnyMode = uniqueModes.length > 0;
                              if (hasAnyMode) {
                                return (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {uniqueModes.map((mode, idx) => (
                                      <Badge key={idx} variant="secondary" className="text-xs px-2 py-0.5">
                                        {mode}
                                      </Badge>
                                    ))}
                                  </div>
                                );
                              }
                              // No mode values present in measurements
                              return (
                                <div className="mt-1">
                                  {defaultMeasurementMode ? (
                                    <Badge variant="outline" className="text-xs px-2 py-0.5 text-blue-600 border-blue-300">
                                      {defaultMeasurementMode} (assigned)
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive" className="text-xs px-2 py-0.5">
                                      No mode
                                    </Badge>
                                  )}
                                </div>
                              );
                            })()
                          ) : obj.measurementMode ? (
                            <div className="mt-1">
                              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                {obj.measurementMode}
                              </Badge>
                            </div>
                          ) : (
                            <div className="mt-1">
                              {defaultMeasurementMode ? (
                                <Badge variant="outline" className="text-xs px-2 py-0.5 text-blue-600 border-blue-300">
                                  {defaultMeasurementMode} (assigned)
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs px-2 py-0.5">
                                  No mode
                                </Badge>
                              )}
                            </div>
                          )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 align-middle">
                          <div className="flex items-center justify-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {objectTypeDisplay}
                          </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm py-4 align-middle">
                          <div className="flex items-center">
                          {displayLab ? (
                            <div className="flex items-center gap-1 whitespace-nowrap overflow-x-auto">
                              <Badge variant="outline" className="text-xs px-2 py-1">L* {displayLab.L?.toFixed(1)}</Badge>
                              <Badge variant="outline" className="text-xs px-2 py-1">a* {displayLab.a?.toFixed(1)}</Badge>
                              <Badge variant="outline" className="text-xs px-2 py-1">b* {displayLab.b?.toFixed(1)}</Badge>
                            </div>
                          ) : (astmLoading && spectralData ? 'Calculating...' : <span className="text-gray-400">No Lab data</span>)}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 align-middle">
                          <div className="flex items-center">
                          <div className="flex items-center gap-1 whitespace-nowrap overflow-x-auto">
                            {sourceDataBadges.map((badge, badgeIndex) => (
                              <Badge key={badgeIndex} variant={badge.variant} className="text-xs">
                                {badge.text}
                              </Badge>
                            ))}
                          </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </RadioGroup>
          ) : (
            // Checkbox mode for multi-selection (colors import)
            <Table className="border-b border-border">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Select</TableHead>
                  <TableHead className="w-16">Color</TableHead>
                  <TableHead>Color Name</TableHead>
                  <TableHead>Object Type</TableHead>
                  <TableHead>Lab</TableHead>
                  <TableHead>Source Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {objects.map((obj, index) => {
                  const isSelected = selectedObjects.includes(index);
                  const isDisabled = maxSelectionReached && !isSelected;
                  
                  // Determine object type display
                  let objectTypeDisplay = obj.objectType || obj.type || 'Standard';
                  if (obj.cxfVariant && obj.cxfVariant.startsWith('CxF/X-4')) {
                    objectTypeDisplay = 'SIC';
                  }
                  
                  // Calculate LAB and hex from spectral data if needed
                  let displayColor = obj.colorHex || obj.hex;
                  let displayLab = obj.lab;
                  
                  // Extract spectral data from various possible locations
                  const spectralData = extractSpectralData(obj);
                  
                  // If no color/LAB but has spectral data, calculate it
                  if ((!displayColor || isInvalidLab(displayLab)) && spectralData && calculateLabFromSpectral) {
                    console.log(`🔍 Calculating color for object: ${obj.name}`);
                    const calculated = calculateLabFromSpectral(spectralData);
                    if (calculated) {
                      console.log(`✅ Calculated result for ${obj.name}:`, { hex: calculated.hex, lab: calculated.lab });
                      if (!displayColor || displayColor === '#000000') displayColor = calculated.hex;
                      if (isInvalidLab(displayLab)) displayLab = calculated.lab;
                    } else {
                      console.warn(`❌ Failed to calculate color for ${obj.name}`);
                    }
                  }
                  
                  // Fallback color if still no valid color
                  if (!displayColor || displayColor === '#000000' || displayColor === '#ffffff') {
                    displayColor = '#f3f4f6'; // Light gray fallback
                    console.log(`🎨 Using fallback color for ${obj.name}: ${displayColor}`);
                  }

                  // Get background summary for display
                  const backgroundSummary = getBackgroundSummary(obj);
                  
                  // Determine source data badges for checkbox mode
                  const sourceDataBadges = [];
                  if (spectralData) {
                    sourceDataBadges.push({ text: 'Spectral', variant: 'secondary' });
                    const wavelengthRange = getWavelengthRange(spectralData);
                    if (wavelengthRange !== 'Unknown range') {
                      sourceDataBadges.push({ text: wavelengthRange, variant: 'outline' });
                    }
                  } else if (obj.lab) {
                    sourceDataBadges.push({ text: 'Lab', variant: 'secondary' });
                    // Add illuminant/observer info if available in the object
                    if (obj.illuminant) {
                      sourceDataBadges.push({ text: obj.illuminant, variant: 'outline' });
                    }
                    if (obj.observer) {
                      sourceDataBadges.push({ text: `${obj.observer}°`, variant: 'outline' });
                    }
                  }
                  
                  return (
                    <TableRow key={index} className={`${isSelected ? 'border-b-0' : ''} h-auto`}>
                       <TableCell className="py-4 align-middle">
                         <div className="flex items-center justify-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleObjectToggle(index, checked === true)}
                            disabled={isDisabled}
                          />
                        </div>
                      </TableCell>
                       <TableCell className="py-4 align-middle">
                         <div className="flex items-center">
                        <div 
                          className="w-8 h-8 rounded border border-gray-300 flex-shrink-0"
                          style={{ 
                            backgroundColor: displayColor || '#f3f4f6',
                            backgroundImage: displayColor ? 'none' : 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)'
                          }}
                          title={displayColor || 'No color data'}
                        />
                        </div>
                      </TableCell>
                       <TableCell className="py-4 align-middle">
                        <div className="flex flex-col justify-center">
                        <div className="font-medium truncate max-w-[240px]" title={obj.name}>{obj.name}</div>
                        {cxfFormat !== 'CxF3' && (
                          <div className="text-xs text-gray-500 mt-1">
                            {backgroundSummary.tintsPerBackground} tints on {backgroundSummary.uniqueBackgrounds} backgrounds
                          </div>
                        )}
                        
                        {/* Show measurement mode badges under color name */}
                        {obj.measurements && obj.measurements.length > 0 ? (
                          (() => {
                            const rawModes = obj.measurements.map(m => m.mode || m.measurementMode || null).filter(Boolean);
                            const uniqueModes = Array.from(new Set(rawModes));
                            const hasAnyMode = uniqueModes.length > 0;
                            if (hasAnyMode) {
                              return (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {uniqueModes.map((mode, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs px-2 py-0.5">
                                      {mode}
                                    </Badge>
                                  ))}
                                </div>
                              );
                            }
                            // No mode values present in measurements
                            return (
                              <div className="mt-1">
                                {defaultMeasurementMode ? (
                                  <Badge variant="outline" className="text-xs px-2 py-0.5 text-blue-600 border-blue-300">
                                    {defaultMeasurementMode} (assigned)
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-xs px-2 py-0.5">
                                    No mode
                                  </Badge>
                                )}
                              </div>
                            );
                          })()
                        ) : obj.measurementMode ? (
                          <div className="mt-1">
                            <Badge variant="secondary" className="text-xs px-2 py-0.5">
                              {obj.measurementMode}
                            </Badge>
                          </div>
                        ) : (
                          <div className="mt-1">
                            {defaultMeasurementMode ? (
                              <Badge variant="outline" className="text-xs px-2 py-0.5 text-blue-600 border-blue-300">
                                {defaultMeasurementMode} (assigned)
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs px-2 py-0.5">
                                No mode
                              </Badge>
                            )}
                          </div>
                        )}
                        </div>
                      </TableCell>
                       <TableCell className="py-4 align-middle">
                        <div className="flex items-center justify-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {objectTypeDisplay}
                        </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm py-4 align-middle">
                         <div className="flex items-center">
                        {displayLab ? (
                          <div className="flex items-center gap-1 whitespace-nowrap overflow-x-auto">
                            <Badge variant="outline" className="text-xs px-2 py-1">L* {displayLab.L?.toFixed(1)}</Badge>
                            <Badge variant="outline" className="text-xs px-2 py-1">a* {displayLab.a?.toFixed(1)}</Badge>
                            <Badge variant="outline" className="text-xs px-2 py-1">b* {displayLab.b?.toFixed(1)}</Badge>
                          </div>
                        ) : (astmLoading && spectralData ? 'Calculating...' : <span className="text-gray-400">No Lab data</span>)}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 align-middle">
                        <div className="flex items-center">
                        <div className="flex items-center gap-1 whitespace-nowrap overflow-x-auto">
                          {sourceDataBadges.map((badge, badgeIndex) => (
                            <Badge key={badgeIndex} variant={badge.variant} className="text-xs">
                              {badge.text}
                            </Badge>
                          ))}
                        </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="pt-1 space-y-4">
          {isColorImport && (
            <div className="flex items-center gap-4">
              <Label htmlFor="color-type">Assign Color Type:</Label>
              <Select value={colorType} onValueChange={setColorType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="master">Master</SelectItem>
                  <SelectItem value="dependent">Dependent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        
        {/* Dialog Controls - Moved to bottom */}
        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <div className="text-sm text-gray-600 text-center">
            {(importContext === 'substrate-condition' || importContext === 'ink-condition')
              ? `Select 1 object for ${importContext === 'ink-condition' ? 'ink' : 'substrate'} condition import (${selectedObjects.length}/1 selected)`
              : `Selected ${selectedObjects.length} object${selectedObjects.length !== 1 ? 's' : ''} for color import`
            }
          </div>
          <Button onClick={handleImport} disabled={!canSave || saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {saving ? 'Importing...' : 'Import Selected'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CxfObjectSelectionDialog;