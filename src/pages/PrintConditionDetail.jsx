import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit, Save, X, Loader2, Upload, Plus, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';
import PrintConditionInfo from '@/components/print-conditions/PrintConditionInfo';
import PrintConditionHeader from '@/components/print-conditions/PrintConditionHeader';
import PrintConditionVisuals from '@/components/print-conditions/PrintConditionVisuals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SpectralPlot from '@/components/conditions/SpectralPlot';
import ColorInfoPanel from '@/components/conditions/ColorInfoPanel';
import PrintConditionConstructionPanel from '@/components/print-conditions/PrintConditionConstructionPanel';
import CxfImportDialogWrapper from '@/components/cxf/CxfImportDialogWrapper';
import { useCxfParser } from '@/hooks/useCxfParser';
import { useCgatsImport } from '@/hooks/useCgatsImport';
import { useSpectralCalculations } from '@/hooks/useSpectralCalculations';
import ColorSettingsBox from '@/components/ColorSettingsBox';
import { labToHex, labToHexD65 } from '@/lib/colorUtils';
// Removed unused import - print conditions don't need substrate data transfer
// import { labToChromaHue } from '@/lib/colorUtils/colorConversion.js';

// Temporary inline function to bypass import issue
const labToChromaHue = (L, a, b) => {
  if (a === undefined || b === undefined || a === null || b === null) {
    return { C: 0, h: 0 };
  }
  
  // Calculate Chroma: C* = √(a² + b²)
  const C = Math.sqrt(a * a + b * b);
  
  // Calculate Hue angle: h* = atan2(b, a) in degrees
  let h = Math.atan2(b, a) * (180 / Math.PI);
  
  // Ensure hue is in range [0, 360)
  if (h < 0) {
    h += 360;
  }
  
  return { C, h };
};

const PrintConditionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useProfile();
  // Check if we're on the "new" route by looking at the pathname
  const isNew = window.location.pathname.includes('/new') || id === 'new';

  const [condition, setCondition] = useState({
    name: '',
    description: '',
    pack_type: '',
    print_process: '',
    printing_side: 'Surface',
    color_hex: '',
    spectral_data: null,
    lab: null,
    measurement_settings: null,
    use_white_ink: false,
  });

  const [constructionDetails, setConstructionDetails] = useState({
    primer: false,
    basecoat: false,
    coating: false,
    white_ink: false,
    adhesive: false,
    barrier: false
  });
  
  const [measurementControls, setMeasurementControls] = useState({
    mode: '',
    illuminant: '',
    observer: '',
    table: ''
  });

  const [standards, setStandards] = useState({
    illuminants: [],
    observers: [],
    astmTables: [],
    loading: true
  });

  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Edit mode state for Print Condition Info card
  const [infoCardEditMode, setInfoCardEditMode] = useState(isNew);
  const [infoCardUnsavedChanges, setInfoCardUnsavedChanges] = useState(false);
  const [originalCondition, setOriginalCondition] = useState(null);

  // Stabilize CxF parser instance with useRef
  const cxfParserRef = useRef(null);
  if (!cxfParserRef.current) {
    cxfParserRef.current = useCxfParser();
  }
  const { 
    fileInputRef: cxfInputRef,
    triggerFileInput: handleCxfImportClick,
    handleFileChange: handleCxfFileChange,
  } = cxfParserRef.current;
  
  const [cxfColorsLocal, setCxfColorsLocal] = useState([]);
  const [cxfDialogOpen, setCxfDialogOpen] = useState(false);
  
  
  // Add state for CGATS import
  const [cgatsColors, setCgatsColors] = useState([]);
  const [cgatsDialogOpen, setCgatsDialogOpen] = useState(false);

  // Initialize import hooks - show dialog for user selection
  const { 
    fileInputRef: cgatsFileRef, 
    handleAddCgatsClick, 
    handleFileChange: handleCgatsFileChange 
  } = useCgatsImport((parsedColors) => {
    // Show dialog for user selection instead of auto-importing
    console.log('CGATS parsed successfully:', parsedColors);
    setCgatsColors(parsedColors);
    setCgatsDialogOpen(true);
  });

  // Normalize CGATS data to match CxF structure for dialog display
  const normalizeCgatsForDialog = (cgatsColors) => {
    return cgatsColors.map((color, index) => ({
      name: color.name,
      objectType: 'ColorValues',
      spectralData: color.spectral || null,
      lab: color.lab || null,
      hex: color.hex || '#000000',
      // Don't set measurementMode - let dialog detect missing mode and show assignment card
      measurements: color.lab ? [{
        lab: color.lab,
        spectral_data: color.spectral
      }] : [],
      index: index
    }));
  };

  // Handle CxF file selection using stabilized parser
  const handleCxfFileChangeWrapper = async (event) => {
    const onSuccess = (colors) => {
      setCxfColorsLocal(colors);
      setCxfDialogOpen(true);
    };

    const onError = (error) => {
      toast({
        title: 'Error Parsing CXF File',
        description: error.message,
        variant: 'destructive',
      });
    };

    handleCxfFileChange(event, onSuccess, onError);
  };

  // Handle import from CxF selection dialog
  const handleImportFromCxfSelection = (selectedObjects) => {
    if (selectedObjects.length === 0) return;
    
    const selectedObject = selectedObjects[0];
    
    if (!selectedObject.spectralData || Object.keys(selectedObject.spectralData).length === 0) {
      toast({
        title: 'Error',
        description: 'No spectral data found in selected object.',
        variant: 'destructive',
      });
      return;
    }
    
    console.log('Importing CxF object for print condition:', selectedObject);
    
    // Update condition with ALL measurement data
    setCondition(prev => ({
      ...prev,
      spectral_data: selectedObject.spectralData,
      measurement_settings: {
        mode: selectedObject.measurementMode || measurementControls.mode,
        illuminant: selectedObject.illuminant || measurementControls.illuminant,
        observer: selectedObject.observer || measurementControls.observer,
        table: measurementControls.table
      }
    }));
    
    setHasUnsavedChanges(true);
    setInfoCardUnsavedChanges(true);
    
    // For new conditions, ensure edit mode is active
    if (isNew) {
      setInfoCardEditMode(true);
    }
    
    setCxfDialogOpen(false);
    setCxfColorsLocal([]);
    
    toast({
      title: 'Import Successful',
      description: `Imported data from ${selectedObject.name}`,
    });
  };
  
  // Handle import from CGATS selection dialog
  const handleImportFromCgatsSelection = (selectedObjects) => {
    if (selectedObjects.length === 0) return;
    
    const selectedObject = selectedObjects[0];
    
    if (!selectedObject.spectralData && !selectedObject.lab) {
      toast({
        title: 'Error',
        description: 'No measurement data found in selected object.',
        variant: 'destructive',
      });
      return;
    }
    
    console.log('Importing CGATS object for print condition:', selectedObject);
    console.log('Assigned measurement mode:', selectedObject.measurementMode);
    
    // Update condition with measurement data
    setCondition(prev => ({
      ...prev,
      spectral_data: selectedObject.spectralData || selectedObject.spectral || null,
      lab: selectedObject.lab || null,
      color_hex: selectedObject.hex || prev.color_hex,
    }));
    
    // Store measurement mode if assigned
    if (selectedObject.measurementMode) {
      setMeasurementControls(prev => ({
        ...prev,
        mode: selectedObject.measurementMode
      }));
    }
    
    setHasUnsavedChanges(true);
    setInfoCardUnsavedChanges(true);
    
    // For new conditions, ensure edit mode is active
    if (isNew) {
      setInfoCardEditMode(true);
    }
    
    setCgatsDialogOpen(false);
    setCgatsColors([]);
    
    toast({
      title: 'Import Successful',
      description: `Imported data from ${selectedObject.name}${selectedObject.measurementMode ? ` with ${selectedObject.measurementMode} mode` : ''}`,
    });
  };

  const [availableModes, setAvailableModes] = useState(['M0','M1','M2','M3']);

  // Use spectral calculations hook to recalculate Lab/CH when measurement controls change
  const spectralCalculations = useSpectralCalculations(
    condition?.spectral_data,
    measurementControls?.illuminant,
    measurementControls?.observer,
    measurementControls?.table
  );

  // Update condition with recalculated Lab/CH values when spectral calculations change
  useEffect(() => {
    if (spectralCalculations.lab && condition?.spectral_data && !isNew) {
      setCondition(prev => ({
        ...prev,
        lab: spectralCalculations.lab,
        ch: spectralCalculations.ch,
        color_hex: spectralCalculations.hex
      }));
      setHasUnsavedChanges(true);
    }
  }, [spectralCalculations.lab, spectralCalculations.ch, spectralCalculations.hex, condition?.spectral_data, isNew]);

  // Set available modes when condition is loaded - if it has imported measurement mode, restrict to that
  useEffect(() => {
    if (condition?.measurement_settings?.mode) {
      // If loaded condition has a specific measurement mode, restrict to that mode
      setAvailableModes([condition.measurement_settings.mode]);
    } else if (condition?.spectral_data) {
      // If spectral data exists but no specific mode, allow all modes
      setAvailableModes(['M0','M1','M2','M3']);
    }
  }, [condition?.measurement_settings?.mode, condition?.spectral_data]);

  useEffect(() => {
    fetchStandards();
  }, []);

  // Fetch organization defaults for ColorSettingsBox
  useEffect(() => {
    const loadOrg = async () => {
      try {
        if (!profile?.organization_id) return;
        const { data } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.organization_id)
          .maybeSingle();
        setOrganization(data || null);
      } catch (e) {
        console.warn('Failed to load organization defaults', e);
      }
    };
    loadOrg();
  }, [profile?.organization_id]);

  useEffect(() => {
    if (!isNew) {
      fetchData();
    } else {
      // For new conditions, set default measurement controls
      setHasUnsavedChanges(false);
      
      // Set default measurement controls for new conditions
      if (organization && measurementControls.mode === '') {
        setMeasurementControls({
          mode: organization.default_measurement_mode || 'M1',
          illuminant: organization.default_illuminant || 'D50',
          observer: organization.default_observer || '2',
          table: organization.default_astm_table || '5'
        });
      }
    }
  }, [id, isNew, organization]);

  const fetchStandards = async () => {
    try {
      const [illuminantsRes, observersRes, astmRes] = await Promise.all([
        supabase.from('illuminants').select('*').order('name'),
        supabase.from('observers').select('*').order('name'),
        supabase.from('astm_e308_tables').select('*').order('table_number')
      ]);

      setStandards({
        illuminants: illuminantsRes.data || [],
        observers: observersRes.data || [],
        astmTables: astmRes.data || [],
        loading: false
      });
    } catch (error) {
      console.error('Error fetching standards:', error);
      setStandards(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchData = useCallback(async () => {
    if (isNew) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('print_conditions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching print condition:', error);
        toast({
          title: 'Error',
          description: 'Failed to load print condition details',
          variant: 'destructive',
        });
        navigate('/print-conditions');
        return;
      }
      
      if (!data) {
        toast({
          title: 'Access Denied',
          description: 'Print condition not found or you do not have permission to view it',
          variant: 'destructive',
        });
        navigate('/print-conditions');
        return;
      }

      setCondition(data);
      
      if (data.measurement_settings) {
        setMeasurementControls(data.measurement_settings);
      } else if (organization) {
        // Apply organization defaults if no measurement settings exist
        setMeasurementControls({
          mode: organization.default_measurement_mode || 'M1',
          illuminant: organization.default_illuminant || 'D50',
          observer: organization.default_observer || '2',
          table: organization.default_astm_table || '5'
        });
      }
      
      // Handle construction_details - support both old and new formats
      if (data.construction_details) {
        const details = data.construction_details;
        // Check if it contains new keys (Varnish, Laminate, BaseSubstrate, UseWhiteInk)
        const hasNewKeys = details.Varnish || details.Laminate || details.BaseSubstrate || details.UseWhiteInk;
        
        if (hasNewKeys) {
          // New format - use as-is
          setConstructionDetails(details);
        } else if (typeof details.primer === 'boolean') {
          // Old boolean format - migrate to new structure
          const printingSide = (data.printing_side || '').toLowerCase();
          const isSurface = printingSide === 'surface';
          setConstructionDetails({
            Varnish: { enabled: details.coating || false, label: 'Varnish', bgColor: '#EFF6FF', type: null, surfaceQuality: null },
            Laminate: { enabled: false, label: isSurface ? 'Laminate' : 'Printed Substrate', bgColor: 'transparent', type: null, surfaceQuality: null },
            UseWhiteInk: { enabled: details.white_ink || false, label: isSurface ? 'Use white ink base coat' : 'Use white ink backer', bgColor: '#F3F4F6' },
            BaseSubstrate: { enabled: isSurface, label: isSurface ? 'Printed Substrate' : 'Base Substrate', bgColor: '#D1D5DB', type: null, surfaceQuality: null }
          });
        } else {
          // Unknown format - start fresh
          setConstructionDetails({});
        }
      } else {
        setConstructionDetails({});
      }
    } catch (error) {
      console.error('Error fetching print condition:', error);
      toast({
        title: 'Error',
        description: 'Failed to load print condition details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  const handleSaveNew = async () => {
    if (!condition.name) {
      toast({
        title: 'Name is required',
        description: 'Please enter a name for the print condition.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (!user || !profile?.organization_id) {
        toast({
          title: 'Authentication Error',
          description: 'Please log in to continue',
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }

      const conditionData = {
        ...condition,
        measurement_settings: measurementControls,
        construction_details: constructionDetails,
        organization_id: profile.organization_id,
        // Include the latest calculated values if available
        lab: spectralCalculations.lab || condition.lab,
        ch: spectralCalculations.ch || condition.ch,
        color_hex: spectralCalculations.hex || condition.color_hex
      };

      const { data, error } = await supabase
        .from('print_conditions')
        .insert([conditionData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Print condition created successfully',
      });

      setHasUnsavedChanges(false);
      navigate('/print-conditions');
    } catch (error) {
      console.error('Error creating print condition:', error);
      toast({
        title: 'Error',
        description: 'Failed to create print condition',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUpdate = async (nextConstructionDetails) => {
    if (!condition.name) {
      toast({
        title: 'Name is required',
        description: 'Please enter a name for the print condition.',
        variant: 'destructive',
      });
      return;
    }

    const effectiveConstructionDetails = nextConstructionDetails ?? constructionDetails;

    console.log('💾 Saving print condition with construction details:', {
      constructionDetails: effectiveConstructionDetails,
      conditionName: condition.name,
      timestamp: new Date().toISOString()
    });

    setSaving(true);
    try {
      const conditionData = {
        ...condition,
        measurement_settings: measurementControls,
        construction_details: effectiveConstructionDetails,
        // Include the latest calculated values if available
        lab: spectralCalculations.lab || condition.lab,
        ch: spectralCalculations.ch || condition.ch,
        color_hex: spectralCalculations.hex || condition.color_hex
      };

      const { data, error } = await supabase
        .from('print_conditions')
        .update(conditionData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Print condition updated successfully',
      });

      setHasUnsavedChanges(false);

      // Sync local state from DB response - no need to refetch, we have the updated row
      if (data?.construction_details) {
        setConstructionDetails(data.construction_details);
      }
    } catch (error) {
      console.error('Error updating print condition:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      toast({
        title: 'Error',
        description: 'Failed to update print condition',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };
  
  // Edit mode handlers for Print Condition Info card
  const handleInfoEdit = () => {
    setInfoCardEditMode(true);
    setOriginalCondition({...condition});
    setInfoCardUnsavedChanges(false);
  };

  const handleInfoSave = async () => {
    await handleSaveUpdate();
    setInfoCardEditMode(false);
    setInfoCardUnsavedChanges(false);
    setOriginalCondition(null);
  };

  const handleInfoCancel = () => {
    // Restore original data, discarding import changes
    if (originalCondition) {
      setCondition(originalCondition);
      setMeasurementControls(originalCondition.measurement_settings || measurementControls);
    }
    setInfoCardEditMode(false);
    setInfoCardUnsavedChanges(false);
    setHasUnsavedChanges(false);
  };

  // Add debug URL parameter for spectral calculations
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === 'spectral' || urlParams.get('similarDebug') === 'true') {
      console.log('[PrintConditionDetail] Debug enabled for spectral calculations');
      console.log('[PrintConditionDetail] Condition spectral data:', condition?.spectral_data ? Object.keys(condition.spectral_data).length + ' wavelengths' : 'none');
      console.log('[PrintConditionDetail] Measurement controls:', measurementControls);
      console.log('[PrintConditionDetail] Spectral calculations:', spectralCalculations);
      console.log('[PrintConditionDetail] Available modes:', availableModes);
      console.log('[PrintConditionDetail] Organization defaults:', organization);
    }
  }, [condition?.spectral_data, measurementControls, spectralCalculations, availableModes, organization]);

  // Debug log for measurement controls changes
  useEffect(() => {
    console.log('🔧 Measurement controls changed:', measurementControls);
    console.log('📊 Spectral calculations result:', spectralCalculations);
    console.log('🎯 Available modes:', availableModes);
  }, [measurementControls, spectralCalculations, availableModes]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Restore full render with proper components
  return (
    <>
      <Helmet>
        <title>{isNew ? 'New Print Condition' : condition.name} - Print Conditions</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="flex-1 flex flex-col h-full"
      >
        <div className="p-6">
          <div className="max-w-6xl">
            <PrintConditionHeader
              isNew={isNew}
              conditionName={condition.name}
              originalName={condition.name}
              handleSaveUpdate={handleSaveUpdate}
              handleSaveNew={handleSaveNew}
              saving={saving}
              onCancel={() => {
                if (isNew) {
                  navigate('/print-conditions');
                } else {
                  setHasUnsavedChanges(false);
                  fetchData();
                }
              }}
            />

            <div className="flex items-center justify-between mb-2 relative mt-6">
              <div /> {/* Empty div for spacing */}
              <div className="flex items-center gap-4">
                {infoCardEditMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Upload className="mr-2 h-4 w-4" />
                        Import Measurement
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={handleCxfImportClick}>
                        <Plus className="mr-2 h-4 w-4" />
                        CxF File
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        cgatsFileRef.current?.click();
                      }}>
                        <Plus className="mr-2 h-4 w-4" />
                        CGATS File
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <ColorSettingsBox
                  controls={measurementControls}
                  setControls={setMeasurementControls}
                  standards={standards}
                  organizationDefaults={organization}
                  measurementLoaded={Boolean(condition?.lab || condition?.spectral_data)}
                  availableModes={availableModes}
                />
              </div>
            </div>

            <motion.div 
              layout 
              className="flex-1 flex flex-col bg-white border border-border rounded-lg overflow-hidden min-h-[950px] mt-4"
              transition={{ duration: 0.3, type: 'spring' }}
            >
              <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                <PrintConditionInfo
                  condition={condition}
                  onNameChange={(e) => {
                    setCondition(prev => ({ ...prev, name: e.target.value }));
                    if (!isNew) setHasUnsavedChanges(true);
                  }}
                  onFileChange={() => {}} // Not used with new system
                  onConditionChange={setCondition}
                  canEdit={true}
                  setHasUnsavedChanges={setHasUnsavedChanges}
                  isNew={isNew}
                  onPackTypeChange={(value) => setCondition(prev => ({ ...prev, pack_type: value }))}
                  onPrintProcessChange={(value) => setCondition(prev => ({ ...prev, print_process: value }))}
                  isEditing={isNew ? true : infoCardEditMode}
                  onInfoEdit={handleInfoEdit}
                  onInfoSave={handleInfoSave}
                  onInfoCancel={handleInfoCancel}
                  hasChanges={infoCardUnsavedChanges}
                  saving={saving}
                />
                
                <PrintConditionConstructionPanel
                  constructionDetails={constructionDetails}
                  onConstructionDetailsChange={setConstructionDetails}
                  onConditionChange={setCondition}
                  canEdit={true}
                  setHasUnsavedChanges={setHasUnsavedChanges}
                  isNew={isNew}
                  condition={condition}
                  liveColorHex={spectralCalculations.hex || (condition?.lab ? labToHexD65(condition.lab.L, condition.lab.a, condition.lab.b) : null)}
                  onSave={(payload) => handleSaveUpdate(payload)}
                  saving={saving}
                />
                
                <PrintConditionVisuals 
                  condition={condition}
                  measurementControls={measurementControls}
                  constructionDetails={constructionDetails}
                  onConstructionDetailsChange={setConstructionDetails}
                  onConditionChange={setCondition}
                  canEdit={true}
                  setHasUnsavedChanges={setHasUnsavedChanges}
                  isNew={isNew}
                  organization={organization}
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* CxF Import Dialog */}
        {cxfColorsLocal && cxfColorsLocal.length > 0 && cxfDialogOpen && (
          <CxfImportDialogWrapper
            isOpen={cxfDialogOpen}
            onClose={() => {
              setCxfDialogOpen(false);
              setCxfColorsLocal([]);
            }}
            colors={cxfColorsLocal}
            context="print-condition"
            onImport={handleImportFromCxfSelection}
            title="Select CxF Object for Print Condition"
          />
        )}
        
        {/* CGATS Import Dialog */}
        {cgatsColors && cgatsColors.length > 0 && (
          <CxfImportDialogWrapper
            isOpen={cgatsDialogOpen}
            onClose={() => {
              setCgatsDialogOpen(false);
              setCgatsColors([]);
            }}
            colors={normalizeCgatsForDialog(cgatsColors)}
            context="print-condition"
            onImport={handleImportFromCgatsSelection}
            title="Select CGATS Object for Print Condition"
          />
        )}

        {/* Hidden file inputs for imports */}
        <input
          ref={cgatsFileRef}
          type="file"
          accept=".txt,.cgats"
          onChange={handleCgatsFileChange}
          className="hidden"
        />
        <input
          ref={cxfInputRef}
          type="file"
          accept=".cxf,.CXF"
          onChange={handleCxfFileChangeWrapper}
          className="hidden"
        />
      </motion.div>
    </>
  );
};

export default PrintConditionDetail;