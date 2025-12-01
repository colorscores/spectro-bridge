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
import { Download, AlertTriangle, CheckCircle, Info, ChevronDown, ChevronRight, Palette } from 'lucide-react';
import { validateCxfExportData } from '@/lib/cxfValidation';
import { buildCxf3, buildCxfX4 } from '@/lib/cxfBuilder';
import { buildASE, downloadASE } from '@/lib/aseBuilder';
import { buildCGATS, downloadCGATS } from '@/lib/cgatsBuilder';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const MultiFormatExportDialog = ({ 
  isOpen, 
  setIsOpen, 
  references = [], 
  measurementsByColorId = {},
  inkConditionsData = [],
  title = "Export Colors"
}) => {
  
  const [format, setFormat] = useState('CGATS');
  const [filename, setFilename] = useState('');
  const [options, setOptions] = useState({
    includeSpectral: true,
    includeLab: true,
    includeDeviceInfo: true,
    includeMeasurementMetadata: true,
    selectedLabMode: null
  });
  const [validation, setValidation] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
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
  }, [isOpen, references, fetchedMeasurementsByColorId, isFetchingMeasurements, format]);

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

      console.log(`[Multi Export] Fetching measurements for ${colorIds.length} colors`);

      // Try RPC method first
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
        }
      } catch (rpcErr) {
        console.warn('[Multi Export] RPC method failed, falling back to direct query:', rpcErr);
      }

      // Fetch ALL measurement modes per color
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

      // Group measurements by color_id and mode
      const groupedMeasurements = {};
      (measRows || []).forEach(row => {
        const colorId = row.color_id;
        const mode = row.mode;
        
        if (!groupedMeasurements[colorId]) {
          groupedMeasurements[colorId] = {};
        }
        
        if (!groupedMeasurements[colorId][mode] || 
            new Date(row.created_at) > new Date(groupedMeasurements[colorId][mode].created_at)) {
          groupedMeasurements[colorId][mode] = row;
        }
      });

      measurementsByColorId = groupedMeasurements;
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
        const modeKeys = Object.keys(measData).filter(key => /^[Mm][0-3]$/.test(key));
        const isPerModeFormat = modeKeys.length > 0;
        
        if (isPerModeFormat) {
          const modesWithSpectral = modeKeys.filter(key => {
            const meas = measData[key];
            return meas?.spectral_data && typeof meas.spectral_data === 'object' && Object.keys(meas.spectral_data).length > 0;
          }).map(key => key.toUpperCase());
          
          modesWithSpectral.forEach(mode => allModes.add(mode));
          
          if (modesWithSpectral.length > 1) {
            hasMultipleModesWithSpectral = true;
          }
        } else {
          const mode = (measData.mode || 'M1').toUpperCase();
          if (measData.spectral_data && typeof measData.spectral_data === 'object' && Object.keys(measData.spectral_data).length > 0) {
            allModes.add(mode);
          }
        }
      }
    });
    
    const modesArray = Array.from(allModes).sort();
    setAvailableSpectralModes(modesArray);
    
    const shouldShowSelector = hasMultipleModesWithSpectral && options.includeLab && modesArray.length > 1 && format.startsWith('CxF');
    setShowLabModeSelector(shouldShowSelector);
    
    if (shouldShowSelector && !options.selectedLabMode && modesArray.length > 0) {
      setOptions(prev => ({
        ...prev,
        selectedLabMode: modesArray[0]
      }));
    }
  };

  const validateExportData = async () => {
    setIsValidating(true);
    try {
      // Different validation for different formats
      let result;
      if (format.startsWith('CxF')) {
        const measurementsToValidate = Object.keys(fetchedMeasurementsByColorId).length > 0 
          ? fetchedMeasurementsByColorId 
          : measurementsByColorId;
        result = validateCxfExportData(references, measurementsToValidate, options);
      } else {
        // Simplified validation for CGATS and ASE
        let exportableCount = 0;
        const warnings = [];
        
        references.forEach((ref, idx) => {
          const colorId = ref.color_id;
          const name = ref.name || `Color ${idx + 1}`;
          const measData = fetchedMeasurementsByColorId[colorId];
          
          let hasData = false;
          
          if (format === 'ASE') {
            // ASE only needs Lab values
            if (measData || ref.reference_lab || ref.lab) {
              hasData = true;
            } else {
              warnings.push(`Color "${name}" has no Lab values for ASE export`);
            }
          } else if (format === 'CGATS') {
            // CGATS can use either spectral or Lab
            if (measData || ref.reference_lab || ref.lab) {
              hasData = true;
            } else {
              warnings.push(`Color "${name}" has no measurement or Lab data for CGATS export`);
            }
          }
          
          if (hasData) {
            exportableCount++;
          }
        });
        
        result = {
          isValid: exportableCount > 0,
          exportableCount,
          totalColors: references.length,
          warnings,
          errors: exportableCount === 0 ? ['No colors with valid data found'] : []
        };
      }
      
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
    // Update filename extension
    if (filename) {
      const nameWithoutExt = filename.replace(/\.(cxf|txt|ase)$/, '');
      let extension = '.cxf';
      if (newFormat === 'CGATS') extension = '.txt';
      if (newFormat === 'ASE') extension = '.ase';
      setFilename(nameWithoutExt + extension);
    }
  };

  const handleOptionChange = (option, checked) => {
    setOptions(prev => {
      const newOptions = { ...prev, [option]: checked };
      
      if (option === 'includeLab' && !checked) {
        setShowLabModeSelector(false);
        newOptions.selectedLabMode = null;
      } else if (option === 'includeLab' && checked && availableSpectralModes.length > 1 && format.startsWith('CxF')) {
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

  const handleExport = async () => {
    if (!validation || !validation.isValid || !filename.trim()) {
      return;
    }

    setIsExporting(true);
    try {
      let result;
      const exportData = {
        references,
        measurementsByColorId: fetchedMeasurementsByColorId,
        filename: filename.trim(),
        options,
        title
      };

      switch (format) {
        case 'CGATS':
          result = buildCGATS(exportData);
          if (result.data) {
            downloadCGATS(result.data, filename);
            toast({
              title: "CGATS Export Complete",
              description: `Successfully exported ${result.exportedCount} colors to CGATS format.`,
            });
          }
          break;

        case 'ASE':
          result = buildASE(exportData);
          if (result.data) {
            downloadASE(result.data, filename);
            toast({
              title: "ASE Export Complete", 
              description: `Successfully exported ${result.exportedCount} colors to Adobe Swatch Exchange format.`,
            });
          }
          break;

        case 'CxF3':
          const cxf3Result = buildCxf3({ 
            job: { job_id: 'export' }, 
            ...exportData,
            orgDefaults: {}
          });
          if (cxf3Result.xml) {
            downloadCxF(cxf3Result.xml, filename);
            toast({
              title: "CxF3 Export Complete",
              description: `Successfully exported ${cxf3Result.exportedCount} colors to CxF3 format.`,
            });
          }
          break;

        case 'CxF-X4':
          const cxfX4Result = buildCxfX4({ 
            job: { job_id: 'export' }, 
            ...exportData,
            inkConditionsData,
            orgDefaults: {}
          });
          if (cxfX4Result.xml) {
            downloadCxF(cxfX4Result.xml, filename);
            toast({
              title: "CxF/X-4 Export Complete",
              description: `Successfully exported ${cxfX4Result.exportedCount} colors to CxF/X-4 format.`,
            });
          }
          break;

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      if (result && result.validationWarnings && result.validationWarnings.length > 0) {
        console.warn('Export warnings:', result.validationWarnings);
      }

      setIsOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: error.message || "An error occurred during export.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const downloadCxF = (xml, filename) => {
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.cxf') ? filename : `${filename}.cxf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const canExport = validation && validation.exportableCount > 0 && !isFetchingMeasurements && !isValidating && !isExporting && filename.trim();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Choose export format and configure data options
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
                  className="flex-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  maxLength={100}
                />
                <span className="text-sm text-muted-foreground">
                  {format === 'CGATS' ? '.txt' : format === 'ASE' ? '.ase' : '.cxf'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {filename.length}/100 characters
              </p>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <RadioGroup value={format} onValueChange={handleFormatChange}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="CGATS" id="cgats" />
                <Label htmlFor="cgats" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>CGATS - Color General Format</span>
                    <Badge variant="secondary">CGATS.17</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Industry standard for color measurement data exchange
                  </p>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ASE" id="ase" />
                <Label htmlFor="ase" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>ASE - Adobe Swatch Exchange</span>
                    <div className="flex gap-1">
                      <Badge variant="outline">Spot</Badge>
                      <Badge variant="outline">Lab</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Adobe format for color swatches (Spot colors in Lab mode)
                  </p>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="CxF3" id="cxf3" />
                <Label htmlFor="cxf3" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>CxF3 - Color Exchange Format</span>
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
                {/* Spectral Data Option - Only for CGATS and CxF */}
                {(format === 'CGATS' || format.startsWith('CxF')) && (
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
                )}

                {/* Lab Data Option */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeLab"
                    checked={options.includeLab}
                    onCheckedChange={(checked) => handleOptionChange('includeLab', checked)}
                    disabled={format === 'ASE'} // ASE always includes Lab
                  />
                  <Label htmlFor="includeLab" className="text-sm cursor-pointer">
                    Include CIE Lab values
                    {format === 'ASE' && <span className="text-muted-foreground"> (required for ASE)</span>}
                  </Label>
                </div>

                {/* Lab Mode Selector - Only for CxF when multiple modes available */}
                {showLabModeSelector && format.startsWith('CxF') && (
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
                  </div>
                )}

                {/* Device Info Option - Only for CGATS and CxF */}
                {(format === 'CGATS' || format.startsWith('CxF')) && (
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
                )}
              </div>
            )}
          </div>

          {/* Validation Status */}
          {(isValidating || validation || fetchError) && (
            <div className="space-y-2">
              {fetchError && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Error loading measurement data: {fetchError}
                  </AlertDescription>
                </Alert>
              )}
              
              {isValidating && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Validating export data...
                  </AlertDescription>
                </Alert>
              )}
              
              {validation && !isValidating && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Ready to export {validation.exportableCount} of {validation.totalColors} colors in {format} format
                  </AlertDescription>
                </Alert>
              )}
              
              {validation && validation.warnings && validation.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">Validation Warnings ({validation.warnings.length}):</div>
                      <details className="cursor-pointer">
                        <summary className="text-sm">
                          View all warnings
                        </summary>
                        <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                          {validation.warnings.map((warning, idx) => (
                            <div key={idx} className="text-xs text-muted-foreground">• {warning}</div>
                          ))}
                        </div>
                      </details>
                    </div>
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
            disabled={!canExport}
            className="min-w-24"
          >
            {isExporting ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></span>
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MultiFormatExportDialog;