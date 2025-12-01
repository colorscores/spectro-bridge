import React, { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle, Loader2, FileBox, Beaker } from 'lucide-react';
import { useCxfImport } from '@/hooks/useCxfImport';
import { useCxfInkImport } from '@/hooks/useCxfInkImport';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/context/ProfileContext';
import UnifiedCxfTable from './UnifiedCxfTable';
import ImportSettingsCollapsible from './ImportSettingsCollapsible';

const CxfAddColorDialogContent = ({ isOpen, setIsOpen, cxfColors, onAddColors, onRefresh, diagnostics, importSource = 'cxf', onCancel }) => {
  const { profile } = useProfile();
  const [selectedColorIds, setSelectedColorIds] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [defaultMeasurementMode, setDefaultMeasurementMode] = useState('');
  const [importMode, setImportMode] = useState('color'); // 'color' or 'ink-based-color'
  
  // New state for standard type and print condition
  const [standardType, setStandardType] = useState('master');
  const [enablePrintCondition, setEnablePrintCondition] = useState(false);
  const [selectedPrintCondition, setSelectedPrintCondition] = useState(null);
  const [printConditions, setPrintConditions] = useState([]);
  const [loadingPrintConditions, setLoadingPrintConditions] = useState(false);
  
  const { handleAddColorsFromCxf } = useCxfImport(onAddColors, profile);
  const { handleImportInkBasedColor } = useCxfInkImport();

  // Strict CxF/X-4 detection - Only trust the parser's detection and SpotInkCharacterisation objects
  const isCxfX4Detected = cxfColors?.some(color => 
    color.cxfVariant?.startsWith('CxF/X-4') ||
    color.objectType === 'SpotInkCharacterisation'
  );
  
  console.log('=== CXF/X-4 DETECTION ===');
  console.log('isCxfX4Detected:', isCxfX4Detected);
  console.log('Detection reasons:', {
    hasCxfVariant: cxfColors?.some(c => c.cxfVariant?.startsWith('CxF/X-4')),
    hasSpotInkType: cxfColors?.some(c => c.objectType === 'SpotInkCharacterisation')
  });

  // Process data for ink-based mode - create combined entries for SpotInkCharacterisation
  const processedData = React.useMemo(() => {
    if (importMode !== 'ink-based-color') {
      return cxfColors;
    }
    
    // Group SpotInkCharacterisation objects into combined entries
    const combinedEntries = [];
    const processedIds = new Set();
    
    cxfColors.forEach((color, index) => {
      if (processedIds.has(color.id)) return;
      
      if (color.objectType === 'SpotInkCharacterisation') {
        const baseName = color.spotInkName || color.name;
        const tintCount = (color.substrateTints?.length || 0) + (color.overBlackTints?.length || 0);
        
        combinedEntries.push({
          index: `${index}-combined`,
          id: color.id, // Keep original ID for selection tracking
          name: baseName,
          tintCount,
          colorHex: color.colorHex,
          lab: color.lab,
          spectralData: color.spectralData,
          originalObject: color,
          measurementType: 'combined'
        });
        
        processedIds.add(color.id);
      } else {
        // Regular colors pass through unchanged
        combinedEntries.push(color);
        processedIds.add(color.id);
      }
    });
    
    return combinedEntries;
  }, [cxfColors, importMode]);

  // Fetch print conditions
  useEffect(() => {
    if (isOpen && profile?.organization_id) {
      setLoadingPrintConditions(true);
      const fetchPrintConditions = async () => {
        try {
          const { data, error } = await supabase
            .from('print_conditions')
            .select('id, name')
            .eq('organization_id', profile.organization_id)
            .order('name');
          
          if (error) throw error;
          setPrintConditions(data || []);
        } catch (error) {
          console.error('Failed to fetch print conditions:', error);
          setPrintConditions([]);
        } finally {
          setLoadingPrintConditions(false);
        }
      };
      fetchPrintConditions();
    }
  }, [isOpen, profile?.organization_id]);

  useEffect(() => {
    if (isOpen && processedData.length > 0) {
      // Select all colors by default for both modes
      setSelectedColorIds(new Set(processedData.map(c => c.id)));
    } else if (!isOpen) {
      setSelectedColorIds(new Set());
      setIsSubmitting(false);
      setIsCancelled(false);
      setImportMode('color'); // Reset mode when dialog closes
      // Reset new state variables
      setStandardType('master');
      setEnablePrintCondition(false);
      setSelectedPrintCondition(null);
      setDefaultMeasurementMode('');
    }
  }, [isOpen, processedData, importMode]);

  const handleSelectColor = (colorId) => {
    setSelectedColorIds(prev => {
      // Allow multi-select for both import modes
      const newSet = new Set(prev);
      if (newSet.has(colorId)) {
        newSet.delete(colorId);
      } else {
        newSet.add(colorId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedColorIds(new Set(processedData.map(item => item.id)));
    } else {
      setSelectedColorIds(new Set());
    }
  };

  const handleCancel = () => {
    setIsCancelled(true);
    setIsSubmitting(false);
    onCancel?.(); // Reset parent import state
    setIsOpen(false);
  };

  const handleDone = async () => {
    setIsSubmitting(true);
    setIsCancelled(false);
    
    try {
      const selectedColors = cxfColors.filter(c => selectedColorIds.has(c.id));
      
      if (isCancelled) return;
      
      if (importMode === 'ink-based-color') {
        // Handle ink-based color import with measurement mode
        await handleImportInkBasedColor(selectedColors, onRefresh, defaultMeasurementMode);
      } else {
        // Handle regular color import with optional measurement mode assignment
        let colorsToImport = selectedColors;
        
        // Only apply measurement mode if explicitly selected for spectral colors without modes
        if (hasSpectralWithoutMode && defaultMeasurementMode) {
          colorsToImport = selectedColors.map(color => {
            const hasNoMode = !color.measurementMode || color.measurementMode === null;
            
            if (hasNoMode && (color.measurements?.some(m => m.spectral_data) || color.spectralData)) {
              return {
                ...color,
                measurementMode: defaultMeasurementMode,
                measurements: color.measurements?.map(measurement => ({
                  ...measurement,
                  mode: !measurement.mode || measurement.mode === null ? defaultMeasurementMode : measurement.mode
                }))
              };
            }
            
            return color;
          });
        }
        
        if (isCancelled) return;
        
        // Add standard type and print condition to colors
        const colorsWithSettings = colorsToImport.map(color => ({
          ...color,
          standard_type: standardType,
          print_condition_id: (standardType === 'dependent' && enablePrintCondition) ? selectedPrintCondition : null
        }));
        
        if (typeof onAddColors === 'function') {
          await onAddColors(colorsWithSettings);
        } else {
          // Fallback: perform import here when parent doesn't supply handler
          await handleAddColorsFromCxf(colorsWithSettings);
          if (typeof onRefresh === 'function') {
            try { await onRefresh(); } catch {}
          }
        }
      }
      
      if (!isCancelled) {
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Import failed:', error);
      // Don't close dialog on error so user can retry
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!cxfColors || cxfColors.length === 0) {
    return null;
  }

  // Check if any colors have missing measurement modes (null) and spectral data
  const hasSpectralWithoutMode = cxfColors.some(color => {
    const hasNoMode = !color.measurementMode || color.measurementMode === null;
    const hasSpectralData = color.measurements?.some(m => m.spectral_data) || color.spectralData;
    return hasNoMode && hasSpectralData;
  });

  const allSelected = selectedColorIds.size === processedData.length;
  const isIndeterminate = selectedColorIds.size > 0 && selectedColorIds.size < processedData.length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-6xl h-[80vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Import Colors from {importSource === 'cgats' ? 'CGATS' : 'CXF'}</DialogTitle>
          <DialogDescription>
            Select the colors you would like to import into your library. Found {cxfColors.length} colors.
            {isCxfX4Detected && (
              <span className="block mt-2 text-sm text-blue-600 font-medium">
                ✨ CxF/X-4 format detected with spot color characterization data
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        {/* Import Settings Collapsible - Hide CxF-specific settings for CGATS */}
        {importSource === 'cxf' && (
          <div className="shrink-0">
            <ImportSettingsCollapsible
              // Import mode controls
              importMode={importMode}
              onImportModeChange={setImportMode}
              showImportModeSelection={isCxfX4Detected}
              
              // Measurement mode controls
              hasSpectralWithoutMode={hasSpectralWithoutMode}
              defaultMeasurementMode={defaultMeasurementMode}
              onDefaultMeasurementModeChange={setDefaultMeasurementMode}
              
              // Standard type controls (color mode only)
              standardType={standardType}
              onStandardTypeChange={setStandardType}
              showStandardTypeControls={importMode === 'color'}
              
              // Print condition controls
              enablePrintCondition={enablePrintCondition}
              onEnablePrintConditionChange={setEnablePrintCondition}
              selectedPrintCondition={selectedPrintCondition}
              onSelectedPrintConditionChange={setSelectedPrintCondition}
              printConditions={printConditions}
              showPrintConditionControls={importMode === 'color' && standardType === 'dependent'}
            />
          </div>
        )}
        
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b mb-4 shrink-0">
            <div className="flex items-center space-x-3">
              <Label className="font-semibold">
                {selectedColorIds.size} / {processedData.length} selected
              </Label>
            </div>
          </div>
          
          <div className="flex-1 min-h-0 overflow-y-auto">
            <UnifiedCxfTable
              mode={importMode}
              data={processedData}
              selectedIds={selectedColorIds}
              onSelectItem={handleSelectColor}
              onSelectAll={handleSelectAll}
              allSelected={allSelected}
              isIndeterminate={isIndeterminate}
              defaultMeasurementMode={defaultMeasurementMode}
              orgDefaults={profile?.organization || {}}
            />
          </div>
        </div>

        
        <DialogFooter className="border-t pt-4 shrink-0">
          <div className="flex justify-between items-center w-full">
            <div className="text-sm text-muted-foreground">
              {importMode === 'ink-based-color' ? (
                <>Creating ink-based color with full characterization data</>
              ) : (
                <>Selected {selectedColorIds.size} color{selectedColorIds.size !== 1 ? 's' : ''} for import</>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleDone} disabled={isSubmitting || selectedColorIds.size === 0}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSubmitting ? 'Importing...' : `Import ${selectedColorIds.size} ${importMode === 'ink-based-color' ? `Ink-based Color${selectedColorIds.size !== 1 ? 's' : ''}` : 'Colors'}`}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Wrapper component to handle conditional rendering safely
const CxfAddColorDialog = (props) => {
  if (!props.isOpen) {
    return null;
  }
  return <CxfAddColorDialogContent {...props} />;
};

export default CxfAddColorDialog;