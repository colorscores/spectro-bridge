import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { validateColorQualitySetCompatibility, COMPATIBILITY_STATUS } from '@/lib/colorQualitySetCompatibility';
import CompatibilityIcon from '@/components/match-request-wizard/CompatibilityIcon';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { useProfile } from '@/context/ProfileContext';
import { getBestColorHex, isValidDisplayColor, computeDefaultDisplayColor, labToHex } from '@/lib/colorUtils';

const ImportMatchDialog = ({ isOpen, setIsOpen, importedColors, onColorSelect, qualitySet, qualitySetDefaults }) => {
  const [selectedColorId, setSelectedColorId] = useState(null);
  const [matchName, setMatchName] = useState('Match 123');
  const [printModeFilter, setPrintModeFilter] = useState('all');
  const [objectTypeFilter, setObjectTypeFilter] = useState('all');
  const [assignMissingModes, setAssignMissingModes] = useState(false);
  
  const { astmTables } = useAstmTablesCache();
  const { profile } = useProfile();

  // Get required measurement mode from quality set
  const requiredMode = qualitySetDefaults?.mode || null;

  // Extract unique print modes and object types from imported colors, plus compatibility analysis
  // PERFORMANCE: Compute display hex once here instead of re-computing on every state change
  const { availablePrintModes, availableObjectTypes, hasColorsWithMissingModes, colorsWithCompatibility } = useMemo(() => {
    if (!importedColors || importedColors.length === 0) {
      return { availablePrintModes: [], availableObjectTypes: [], hasColorsWithMissingModes: false, colorsWithCompatibility: [] };
    }

    const printModes = new Set();
    const objectTypes = new Set();
    let hasMissingModes = false;
    const colorsWithAnalysis = [];

    importedColors.forEach((color, index) => {
      // Skip undefined or null colors
      if (!color) {
        console.warn('[ImportMatchDialog] Skipping undefined/null color in imported colors');
        return;
      }
      
      // Add object type
      if (color.type) {
        objectTypes.add(color.type);
      }
      
      // Add print modes from measurements
      const colorModes = new Set();
      if (color.measurements && Array.isArray(color.measurements)) {
        color.measurements.forEach(measurement => {
          if (measurement.mode) {
            printModes.add(measurement.mode);
            colorModes.add(measurement.mode);
          }
        });
      }

      // Check if color has missing measurement modes
      if (colorModes.size === 0) {
        hasMissingModes = true;
      }

      // Validate compatibility with quality set
      let compatibility = null;
      if (qualitySet && color.measurements) {
        compatibility = validateColorQualitySetCompatibility(color, color.measurements, qualitySet);
      }

      // If color has missing mode and quality set requires specific mode, mark as incompatible
      // unless the assign checkbox will fix it
      if (requiredMode && colorModes.size === 0) {
        compatibility = {
          status: COMPATIBILITY_STATUS.INCOMPATIBLE,
          message: `Missing required measurement mode: ${requiredMode}`
        };
      } else if (requiredMode && !colorModes.has(requiredMode)) {
        compatibility = {
          status: COMPATIBILITY_STATUS.INCOMPATIBLE,
          message: `Missing required measurement mode: ${requiredMode}`
        };
      }

      // PERFORMANCE: Compute display hex once during initial processing
      let displayHex = getBestColorHex(color);
      
      if (!displayHex) {
        // Try to compute from Lab data
        let labToTry = color.lab;
        if (!labToTry && color.measurements?.length) {
          const measurementWithLab = color.measurements.find(m => m.lab && 
            typeof m.lab.L === 'number' && 
            typeof m.lab.a === 'number' && 
            typeof m.lab.b === 'number'
          );
          if (measurementWithLab) {
            labToTry = measurementWithLab.lab;
          }
        }
        
        if (labToTry) {
          const isPlaceholder = labToTry.L === 50 && labToTry.a === 0 && labToTry.b === 0;
          if (!isPlaceholder) {
            try {
              const hex = labToHex(labToTry.L, labToTry.a, labToTry.b);
              if (isValidDisplayColor(hex)) displayHex = hex;
            } catch (e) {
              console.warn('[ImportMatchDialog] Lab to hex conversion failed:', e);
            }
          }
        }
      }
      
      if (!displayHex && astmTables?.length && profile?.organization) {
        const spectralData = color.spectral_data || 
          color.spectralData || 
          color.measurements?.find(m => m.spectral_data)?.spectral_data;
          
        if (spectralData) {
          try {
            const orgDefaults = profile.organization || {};
            const result = computeDefaultDisplayColor({ spectral_data: spectralData }, orgDefaults, astmTables);
            const hex = result?.hex;
            if (isValidDisplayColor(hex)) displayHex = hex;
          } catch (e) {
            console.warn('[ImportMatchDialog] Spectral to hex conversion failed:', e);
          }
        }
      }
      
      if (!displayHex) {
        displayHex = '#f3f4f6';
      }

      colorsWithAnalysis.push({
        ...color,
        id: color?.id ?? `import-${index}`,
        availableModes: Array.from(colorModes),
        compatibility,
        hasMissingMode: colorModes.size === 0,
        displayHex // Store computed hex
      });
    });

    return {
      availablePrintModes: Array.from(printModes).sort(),
      availableObjectTypes: Array.from(objectTypes).sort(),
      hasColorsWithMissingModes: hasMissingModes,
      colorsWithCompatibility: colorsWithAnalysis
    };
  }, [importedColors, qualitySet, astmTables, profile?.organization]);

  // PERFORMANCE: displayHex now computed in colorsWithCompatibility, no redundant computation needed

  // Filter colors based on selected filters and compatibility
  const filteredColors = useMemo(() => {
    if (!colorsWithCompatibility) return [];

    const processedColors = colorsWithCompatibility.map(color => {
      // If assignMissingModes is enabled and color has missing mode, assign quality set mode
      if (assignMissingModes && color.hasMissingMode && requiredMode) {
        const enhancedMeasurements = [...(color.measurements || [])];
        // Add a virtual measurement with the required mode
        enhancedMeasurements.push({
          mode: requiredMode,
          lab: color.lab || {},
          spectral_data: color.spectral_data || {}
        });
        
        return {
          ...color,
          measurements: enhancedMeasurements,
          availableModes: [...color.availableModes, requiredMode],
          hasMissingMode: false,
          wasAssignedMode: true,
          compatibility: {
            status: COMPATIBILITY_STATUS.WARNING,
            message: `Assigned required measurement mode: ${requiredMode}`
          }
        };
      }
      
      // If assignMissingModes is NOT enabled and color lacks required mode, ensure it's incompatible
      if (!assignMissingModes && requiredMode && (color.hasMissingMode || !color.availableModes.includes(requiredMode))) {
        return {
          ...color,
          compatibility: {
            status: COMPATIBILITY_STATUS.INCOMPATIBLE,
            message: `Missing required measurement mode: ${requiredMode}`
          }
        };
      }
      
      return color;
    });

    return processedColors.filter(color => {
      // Filter by object type
      if (objectTypeFilter !== 'all' && color.type !== objectTypeFilter) {
        return false;
      }

      // Filter by print mode
      if (printModeFilter !== 'all') {
        if (!color.measurements || !Array.isArray(color.measurements)) {
          return false;
        }
        const hasMode = color.measurements.some(m => m.mode === printModeFilter);
        if (!hasMode) {
          return false;
        }
      }

      // Note: We no longer filter out incompatible colors here
      // They will be shown but disabled in the UI

      return true;
    });
  }, [colorsWithCompatibility, printModeFilter, objectTypeFilter, assignMissingModes, requiredMode]);

  useEffect(() => {
    if (filteredColors && filteredColors.length > 0) {
      // Find the first compatible color (not disabled/incompatible)
      const firstCompatible = filteredColors.find(color => 
        color.compatibility?.status !== COMPATIBILITY_STATUS.INCOMPATIBLE
      );
      
      if (firstCompatible) {
        setSelectedColorId(firstCompatible.id.toString());
      } else {
        // If no compatible colors, clear selection
        setSelectedColorId(null);
      }
    } else {
      setSelectedColorId(null);
    }
  }, [filteredColors]);

  const handleDone = () => {
    const selectedColor = filteredColors.find(c => c.id.toString() === selectedColorId);
    if (selectedColor) {
      console.log('🔍 DEBUG - ImportMatchDialog passing color to onColorSelect:', {
        name: selectedColor.name,
        displayHex: selectedColor.displayHex,
        spectralData: selectedColor.spectral_data || selectedColor.spectralData,
        measurements: selectedColor.measurements?.length || 0,
        hasPlaceholderLab: selectedColor.lab && selectedColor.lab.L === 50 && selectedColor.lab.a === 0 && selectedColor.lab.b === 0
      });
      
      // Ensure hex/colorHex is set from displayHex if missing
      const colorToPass = {
        ...selectedColor,
        matchName,
        hex: selectedColor.hex || selectedColor.colorHex || selectedColor.displayHex,
        colorHex: selectedColor.colorHex || selectedColor.hex || selectedColor.displayHex,
        // Preserve measurements with spectral data intact
        measurements: selectedColor.measurements?.map(measurement => {
          // Remove placeholder Lab per-measurement if spectral data exists
          const hasSpectral = measurement.spectral_data && Object.keys(measurement.spectral_data).length > 0;
          const isPlaceholderLab = measurement.lab && measurement.lab.L === 50 && measurement.lab.a === 0 && measurement.lab.b === 0;
          
          if (hasSpectral && isPlaceholderLab) {
            console.log('🧹 DEBUG - Removing placeholder Lab from measurement with spectral data');
            const { lab, ...cleanMeasurement } = measurement;
            return cleanMeasurement;
          }
          return measurement;
        })
      };
      
      onColorSelect(colorToPass);
      setIsOpen(false);
    }
  };

  if (!importedColors || importedColors.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[700px] p-8">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">Add Match</DialogTitle>
          <DialogDescription className="text-center">
            {qualitySet && requiredMode ? (
              <>
                The selected quality set <strong>{qualitySet.name}</strong>, requires <strong>{requiredMode}</strong> data. 
                Please select a match color that contains the required measurement mode data.
              </>
            ) : (
              'Please select the color you\'d like to add as a match.'
            )}
          </DialogDescription>
        </DialogHeader>
        
        {/* Filter Controls */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="printModeFilter">Print Mode</Label>
            <Select value={printModeFilter} onValueChange={setPrintModeFilter}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="All print modes" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="all">All print modes</SelectItem>
                {availablePrintModes.map(mode => (
                  <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="objectTypeFilter">Object Type</Label>
            <Select value={objectTypeFilter} onValueChange={setObjectTypeFilter}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="All object types" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="all">All object types</SelectItem>
                {availableObjectTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Missing Mode Assignment Checkbox */}
        {hasColorsWithMissingModes && requiredMode && (
          <div className="mb-1 p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="assignMissingModes" 
                checked={assignMissingModes}
                onCheckedChange={setAssignMissingModes}
              />
              <Label htmlFor="assignMissingModes" className="text-sm font-medium">
                Assign quality set measurement mode for colors with missing mode values
              </Label>
            </div>
            {assignMissingModes && (
              <p className="text-xs text-amber-700 mt-2">
                Colors without measurement modes will be assigned <strong>{requiredMode}</strong> mode from the quality set.
              </p>
            )}
          </div>
        )}

        <div className="my-2">
          <ScrollArea className="h-[35vh]">
            <RadioGroup value={selectedColorId} onValueChange={setSelectedColorId} className="p-1">
              <div className="space-y-1">
                {filteredColors.map((color) => {
                  const isDisabled = color.compatibility?.status === COMPATIBILITY_STATUS.INCOMPATIBLE && !assignMissingModes;
                  const displayModes = color.wasAssignedMode 
                    ? color.availableModes.map(mode => mode === requiredMode ? `${mode} (assigned)` : mode)
                    : (color.measurements?.map(m => m.mode).filter(Boolean) || []);

                  return (
                    <Label
                      key={color.id}
                      htmlFor={`import-${color.id}`}
                      className={`flex items-center justify-between p-3 border rounded-lg transition-all ${
                        selectedColorId === color.id.toString() 
                          ? 'border-blue-500 bg-blue-50 cursor-pointer' 
                          : isDisabled
                            ? 'border-gray-200 cursor-not-allowed'
                            : 'border-gray-200 cursor-pointer hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem 
                          value={color.id.toString()} 
                          id={`import-${color.id}`}
                          disabled={isDisabled}
                          className={isDisabled ? 'opacity-50' : ''}
                        />
                        {/* Color thumbnail */}
                        <div 
                          className="w-8 h-8 rounded-lg border border-gray-300 shadow-sm"
                          style={{ backgroundColor: color.displayHex || '#f3f4f6' }}
                          title={color.displayHex ? `Color: ${color.displayHex}` : 'No preview available'}
                        ></div>
                        {/* Color information */}
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">
                            {color.name}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-600">
                              Type: {color.type || 'Standard'}
                            </span>
                            {displayModes.length > 0 && (
                              <span className="text-xs text-gray-600">
                                • Modes: {displayModes.map((mode, index) => (
                                  <span key={index} className={mode.includes('(assigned)') ? 'text-amber-600' : ''}>
                                    {mode}{index < displayModes.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Compatibility status and type badge */}
                      <div className="flex items-center gap-2">
                        {color.compatibility && (
                          <CompatibilityIcon 
                            status={color.compatibility.status}
                            message={color.compatibility.message}
                          />
                        )}
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-200 text-gray-700">
                          {color.type || 'Standard'}
                        </span>
                      </div>
                    </Label>
                  );
                })}
              </div>
            </RadioGroup>
          </ScrollArea>
        </div>
        <div className="space-y-2 mb-3">
          <Label htmlFor="matchName">Match Name</Label>
          <Input
            id="matchName"
            value={matchName}
            onChange={(e) => setMatchName(e.target.value)}
            placeholder="Enter match name"
          />
        </div>
        
        {/* Results Summary and Buttons */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {filteredColors.length} of {importedColors.length} colors
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDone} disabled={!selectedColorId}>Import</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportMatchDialog;