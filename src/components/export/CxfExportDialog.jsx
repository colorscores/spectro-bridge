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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, AlertTriangle, CheckCircle, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { validateCxfExportData, generateExportSummary } from '@/lib/cxfValidation';
import { supabase } from '@/integrations/supabase/client';

const CxfExportDialog = ({ 
  isOpen, 
  setIsOpen, 
  onExport, 
  references = [], 
  measurementsByColorId = {},
  inkConditionsData = [],
  title = "Export as CxF"
}) => {
  const [format, setFormat] = useState('CxF3');
  const [filename, setFilename] = useState('');
  const [options, setOptions] = useState({
    includeSpectral: true,
    includeLab: true,
    includeDeviceInfo: true,
    includeMeasurementMetadata: true,
    selectedLabMode: null // Will be set automatically when multiple modes are available
  });
  const [validation, setValidation] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [fetchedMeasurementsByColorId, setFetchedMeasurementsByColorId] = useState({});
  const [isFetchingMeasurements, setIsFetchingMeasurements] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [availableSpectralModes, setAvailableSpectralModes] = useState([]);
  const [showLabModeSelector, setShowLabModeSelector] = useState(false);
  const [dataOptionsOpen, setDataOptionsOpen] = useState(false);

  // Auto-detect if CxF/X-4 is possible
  const hasInkData = inkConditionsData.length > 0;

  // Initialize default filename based on title
  useEffect(() => {
    if (isOpen && !filename) {
      const timestamp = new Date().toISOString().slice(0, 10);
      let defaultName = 'color-export';
      
      if (title?.toLowerCase().includes('color library')) {
        defaultName = 'color-library-export';
      } else if (title?.toLowerCase().includes('job')) {
        const jobMatch = title.match(/Job\s+([A-Za-z0-9-]+)/i);
        if (jobMatch) {
          defaultName = `job-${jobMatch[1]}-references`;
        }
      }
      
      setFilename(`${defaultName}-${timestamp}`);
    }
  }, [isOpen, title, filename]);

  // Fetch measurements when dialog opens
  useEffect(() => {
    if (isOpen && references.length > 0) {
      fetchMeasurements();
    }
  }, [isOpen, references]);

  // Analyze available spectral modes when measurements are fetched
  useEffect(() => {
    if (isOpen && references.length > 0 && !isFetchingMeasurements) {
      analyzeAvailableModes();
      validateExportData();
    }
  }, [isOpen, references, fetchedMeasurementsByColorId, isFetchingMeasurements]);

  // Validate when options change
  useEffect(() => {
    if (isOpen && references.length > 0 && !isFetchingMeasurements) {
      validateExportData();
    }
  }, [options]);

  const fetchMeasurements = async () => {
    setIsFetchingMeasurements(true);
    setFetchError(null);
    try {
      const colorIds = references.map(r => r.color_id || r.id).filter(Boolean);
      if (colorIds.length === 0) {
        setFetchedMeasurementsByColorId({});
        return;
      }

      console.log(`[CxF Export] Fetching measurements for ${colorIds.length} colors`);

      // Try RPC method first for better performance
      let measurementsByColorId = {};
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_color_measurements_for_colors', {
          color_ids: colorIds
        });

        if (!rpcError && rpcData) {
          rpcData.forEach(row => {
            if (!measurementsByColorId[row.color_id]) {
              measurementsByColorId[row.color_id] = row;
            }
          });
          console.log(`[CxF Export] RPC fetch: ${Object.keys(measurementsByColorId).length} measurements found`);
        }
      } catch (rpcErr) {
        console.warn('[CxF Export] RPC method failed, falling back to direct query:', rpcErr);
      }

      // Fetch ALL measurement modes per color (not just latest)
      const { data: measRows, error } = await supabase
        .from('color_measurements')
        .select('color_id, mode, spectral_data, lab, created_at')
        .in('color_id', colorIds)
        .order('color_id', { ascending: true })
        .order('mode', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Group measurements by color_id and mode (keeping latest for each mode)
      const groupedMeasurements = {};
      (measRows || []).forEach(row => {
        const colorId = row.color_id;
        const mode = row.mode;
        
        if (!groupedMeasurements[colorId]) {
          groupedMeasurements[colorId] = {};
        }
        
        // Keep latest measurement for each mode
        if (!groupedMeasurements[colorId][mode] || 
            new Date(row.created_at) > new Date(groupedMeasurements[colorId][mode].created_at)) {
          groupedMeasurements[colorId][mode] = row;
        }
      });

      measurementsByColorId = groupedMeasurements;

      // Check for colors with ink conditions but no measurements
      const missingColorIds = colorIds.filter(id => !measurementsByColorId[id]);
      if (missingColorIds.length > 0) {
        console.log(`[CxF Export] Checking ink conditions for ${missingColorIds.length} colors without measurements`);
        
        // Fetch colors with ink condition data
        const { data: colorsWithInk, error: inkError } = await supabase
          .from('colors')
          .select('id, from_ink_condition_id')
          .in('id', missingColorIds)
          .not('from_ink_condition_id', 'is', null);

        if (!inkError && colorsWithInk && colorsWithInk.length > 0) {
          const inkConditionIds = colorsWithInk.map(c => c.from_ink_condition_id);
          
          const { data: inkConditions, error: inkCondError } = await supabase
            .from('ink_conditions')
            .select('id, spectral_data, lab, measurement_settings')
            .in('id', inkConditionIds);

          if (!inkCondError && inkConditions) {
            colorsWithInk.forEach(color => {
              const inkCondition = inkConditions.find(ic => ic.id === color.from_ink_condition_id);
              if (inkCondition && (inkCondition.spectral_data || inkCondition.lab)) {
                measurementsByColorId[color.id] = {
                  color_id: color.id,
                  spectral_data: inkCondition.spectral_data,
                  lab: inkCondition.lab,
                  mode: inkCondition.measurement_settings?.mode || 'M1',
                  created_at: new Date().toISOString()
                };
              }
            });
            console.log(`[CxF Export] Added ${colorsWithInk.length} measurements from ink conditions`);
          }
        }
      }

      const finalCount = Object.keys(measurementsByColorId).length;
      const unresolved = colorIds.filter(id => !measurementsByColorId[id]);
      
      console.log(`[CxF Export] Final summary: ${finalCount}/${colorIds.length} colors with measurements`);
      if (unresolved.length > 0) {
        console.log(`[CxF Export] Unresolved color IDs:`, unresolved.slice(0, 5));
      }

      setFetchedMeasurementsByColorId(measurementsByColorId);
    } catch (error) {
      console.error('Failed to fetch measurements:', error);
      setFetchError(error.message);
      setFetchedMeasurementsByColorId({});
    } finally {
      setIsFetchingMeasurements(false);
    }
  };

  const analyzeAvailableModes = () => {
    const allModes = new Set();
    let hasMultipleModesWithSpectral = false;
    
    Object.values(fetchedMeasurementsByColorId).forEach(measData => {
      if (measData && typeof measData === 'object') {
        // Detect per-mode format
        const modeKeys = Object.keys(measData).filter(key => /^[Mm][0-3]$/.test(key));
        const isPerModeFormat = modeKeys.length > 0;
        
        if (isPerModeFormat) {
          // Check which modes have spectral data
          const modesWithSpectral = modeKeys.filter(key => {
            const meas = measData[key];
            return meas?.spectral_data && typeof meas.spectral_data === 'object' && Object.keys(meas.spectral_data).length > 0;
          }).map(key => key.toUpperCase());
          
          modesWithSpectral.forEach(mode => allModes.add(mode));
          
          if (modesWithSpectral.length > 1) {
            hasMultipleModesWithSpectral = true;
          }
        } else {
          // Single measurement format
          const mode = (measData.mode || 'M1').toUpperCase();
          if (measData.spectral_data && typeof measData.spectral_data === 'object' && Object.keys(measData.spectral_data).length > 0) {
            allModes.add(mode);
          }
        }
      }
    });
    
    const modesArray = Array.from(allModes).sort();
    setAvailableSpectralModes(modesArray);
    
    // Show Lab mode selector if we have multiple modes with spectral data AND includeLab is true
    const shouldShowSelector = hasMultipleModesWithSpectral && options.includeLab && modesArray.length > 1;
    setShowLabModeSelector(shouldShowSelector);
    
    // Auto-select first mode if needed
    if (shouldShowSelector && !options.selectedLabMode && modesArray.length > 0) {
      setOptions(prev => ({
        ...prev,
        selectedLabMode: modesArray[0]
      }));
    }
    
    console.log(`[CxF Export] Available spectral modes: [${modesArray.join(', ')}], showLabModeSelector: ${shouldShowSelector}`);
  };

  const validateExportData = async () => {
    setIsValidating(true);
    try {
      // Use fetched measurements for validation
      const measurementsToValidate = Object.keys(fetchedMeasurementsByColorId).length > 0 
        ? fetchedMeasurementsByColorId 
        : measurementsByColorId;
      const result = validateCxfExportData(references, measurementsToValidate, options);
      setValidation(result);
    } catch (error) {
      console.error('Validation error:', error);
      setValidation({
        isValid: false,
        exportableCount: 0,
        totalColors: references.length,
        warnings: [],
        errors: [`Validation failed: ${error.message}`]
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleFormatChange = (newFormat) => {
    setFormat(newFormat);
    if (newFormat === 'CxF3' && hasInkData) {
      // Reset to basic options for CxF3
      setOptions(prev => ({ ...prev }));
    }
  };

  const handleOptionChange = (option, checked) => {
    setOptions(prev => {
      const newOptions = { ...prev, [option]: checked };
      
      // If includeLab is unchecked, hide the Lab mode selector
      if (option === 'includeLab' && !checked) {
        setShowLabModeSelector(false);
        newOptions.selectedLabMode = null;
      }
      // If includeLab is checked and we have multiple spectral modes, show selector
      else if (option === 'includeLab' && checked && availableSpectralModes.length > 1) {
        setShowLabModeSelector(true);
        if (!newOptions.selectedLabMode) {
          newOptions.selectedLabMode = availableSpectralModes[0];
        }
      }
      
      return newOptions;
    });
  };

  const handleLabModeChange = (mode) => {
    setOptions(prev => ({
      ...prev,
      selectedLabMode: mode
    }));
  };

  const handleExport = () => {
    if (validation && canExport && filename.trim()) {
      onExport({ 
        format,
        filename: filename.trim(),
        options, 
        validation, 
        measurementsByColorId: fetchedMeasurementsByColorId 
      });
    }
  };

  const canExport = validation && validation.exportableCount > 0 && !isFetchingMeasurements && !isValidating && filename.trim();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Choose export format and configure color data options
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filename Input */}
          <div>
            <Label className="text-sm font-medium">Filename</Label>
            <div className="mt-2">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="Enter filename (without extension)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={100}
                />
                <span className="text-sm text-gray-500">.cxf</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {filename.length}/100 characters
              </p>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <RadioGroup value={format} onValueChange={handleFormatChange}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="CxF3" id="cxf3" />
                <Label htmlFor="cxf3" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>CxF3 - Standard Color Exchange</span>
                    <Badge variant="secondary">ISO 17972-1</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Industry standard for color data exchange
                  </p>
                </Label>
              </div>
              
              {hasInkData && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CxF-X4" id="cxfx4" />
                  <Label htmlFor="cxfx4" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span>CxF/X-4 - Spot Ink Characterisation</span>
                      <Badge variant="secondary">ISO 17972-4</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Includes full spot ink wedge characterization data
                    </p>
                  </Label>
                </div>
              )}
            </RadioGroup>
          </div>

          <Separator />

          {/* Data Options - Collapsible */}
          <div className="space-y-3">
            <Button
              variant="ghost"
              className="flex items-center justify-between w-full p-0 h-auto font-medium text-sm"
              onClick={() => setDataOptionsOpen(!dataOptionsOpen)}
            >
              <span>Data Options</span>
              {dataOptionsOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            
            {dataOptionsOpen && (
              <div className="space-y-3 pl-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeSpectral"
                    checked={options.includeSpectral}
                    onCheckedChange={(checked) => handleOptionChange('includeSpectral', checked)}
                  />
                  <Label htmlFor="includeSpectral" className="text-sm cursor-pointer">
                    Include spectral data (when available)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeLab"
                    checked={options.includeLab}
                    onCheckedChange={(checked) => handleOptionChange('includeLab', checked)}
                  />
                  <Label htmlFor="includeLab" className="text-sm cursor-pointer">
                    Include CIE Lab values
                  </Label>
                </div>

                {/* Lab Mode Selector - shown when multiple spectral modes are available and Lab is enabled */}
                {showLabModeSelector && (
                  <div className="ml-6 space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Lab value mode (multiple spectral modes detected)
                    </Label>
                    <Select value={options.selectedLabMode || ''} onValueChange={handleLabModeChange}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSpectralModes.map(mode => (
                          <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose which measurement mode's Lab values to include in the export
                    </p>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeDeviceInfo"
                    checked={options.includeDeviceInfo}
                    onCheckedChange={(checked) => handleOptionChange('includeDeviceInfo', checked)}
                  />
                  <Label htmlFor="includeDeviceInfo" className="text-sm cursor-pointer">
                    Include measurement device information
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeMeasurementMetadata"
                    checked={options.includeMeasurementMetadata}
                    onCheckedChange={(checked) => handleOptionChange('includeMeasurementMetadata', checked)}
                  />
                  <Label htmlFor="includeMeasurementMetadata" className="text-sm cursor-pointer">
                    Include measurement conditions metadata
                  </Label>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Validation Results */}
          {(isFetchingMeasurements || isValidating) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              {isFetchingMeasurements ? 'Fetching measurements...' : 'Validating export data...'}
            </div>
          )}

          {fetchError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Failed to fetch measurement data: {fetchError}
              </AlertDescription>
            </Alert>
          )}

          {validation && !isValidating && !isFetchingMeasurements && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {canExport ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm font-medium">
                  {canExport ? 'Ready to Export' : 'Export Issues Found'}
                </span>
              </div>

              <div className="text-sm text-muted-foreground">
                {validation.exportableCount} of {validation.totalColors} colors can be exported
              </div>

              {/* Debug visibility - show per-color measurement modes */}
              {validation.warnings.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <div className="font-medium mb-1">Warnings ({validation.warnings.length}):</div>
                    <ul className="list-disc list-inside space-y-1">
                      {validation.warnings.slice(0, 3).map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                      {validation.warnings.length > 3 && (
                        <li className="text-muted-foreground">
                          ...and {validation.warnings.length - 3} more
                        </li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {validation.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <div className="font-medium mb-1">Errors ({validation.errors.length}):</div>
                    <ul className="list-disc list-inside space-y-1">
                      {validation.errors.slice(0, 3).map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                      {validation.errors.length > 3 && (
                        <li className="text-muted-foreground">
                          ...and {validation.errors.length - 3} more
                        </li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={!canExport || isValidating || isFetchingMeasurements}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export {format}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CxfExportDialog;