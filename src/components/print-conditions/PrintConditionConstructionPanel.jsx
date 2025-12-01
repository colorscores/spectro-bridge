import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import CardHeader from '@/components/admin/my-company/CardHeader';

const ConstructionLayer = ({ label, bgColor, textColor = 'black', bold = false, className = '' }) => {
    const isTransparent = bgColor === 'transparent';
    const displayBgColor = isTransparent ? 'transparent' : bgColor;
    const borderStyle = isTransparent ? 'border border-gray-600' : 'border border-gray-400';
    
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
            className={cn('text-center text-xs py-1 overflow-hidden', borderStyle, bold && 'font-bold', className)}
            style={{ backgroundColor: displayBgColor }}
        >
            <span style={{ color: textColor }}>{label}</span>
        </motion.div>
    );
};

const Spacer = () => (
    <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="h-4"
    />
);

const getDefaultLayers = (isSurfacePrint, isReversePrint) => ({
    Varnish: { enabled: false, label: 'Varnish', bgColor: '#EFF6FF', type: null, surfaceQuality: null },
    Laminate: { 
        enabled: false, // Not enabled by default
        label: isSurfacePrint ? 'Laminate' : 'Printed Substrate', 
        bgColor: 'transparent', 
        type: null, // Will be set dynamically for surface print
        surfaceQuality: null 
    },
    UseWhiteInk: { 
        enabled: false, 
        label: isSurfacePrint ? 'Use white ink base coat' : 'Use white ink backer', 
        bgColor: '#F3F4F6' 
    },
    BaseSubstrate: { 
        enabled: isSurfacePrint ? true : false, // Always enabled for surface print, disabled for reverse
        label: isSurfacePrint ? 'Printed Substrate' : 'Base Substrate', 
        bgColor: '#D1D5DB', 
        type: null, 
        surfaceQuality: null 
    },
    ColorInk: { enabled: true, label: 'Color Ink', bgColor: 'black', textColor: 'white', bold: true },
});

const PrintConditionConstructionPanel = ({ 
  constructionDetails, 
  onConstructionDetailsChange, 
  onConditionChange,
  canEdit, 
  setHasUnsavedChanges, 
  isNew,
  condition,
  liveColorHex,
  onSave,
  saving = false
}) => {
  const [isEditing, setIsEditing] = useState(isNew);
  const [originalLayers, setOriginalLayers] = useState(null);
  console.log('=== COMPONENT RENDER ===', { 
    condition, 
    constructionDetails, 
    timestamp: new Date().toISOString() 
  });
  
  const printingSide = condition?.printing_side;
  const ps = (printingSide || '').toLowerCase();
  const isSurfacePrint = ps === 'surface';
  const isReversePrint = ps === 'reverse';
  
  console.log('Print side values:', { printingSide, isSurfacePrint, isReversePrint });
  
  const [substrates, setSubstrates] = useState([]);
  const [substrateTypes, setSubstrateTypes] = useState([]);
  const [surfaceQualities, setSurfaceQualities] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Force re-render when data changes
  const [renderKey, setRenderKey] = useState(0);
  
  console.log('🔄 RENDER STATE:', { 
    substratesCount: substrates.length, 
    substrateTypesCount: substrateTypes.length, 
    surfaceQualitiesCount: surfaceQualities.length,
    dataLoaded,
    renderKey,
    timestamp: Date.now()
  });
  
  const [layers, setLayers] = useState(() => {
    console.log('Initial layers state creation:', { printingSide, constructionDetails });
    if (!printingSide) return {};
    
    return getDefaultLayers(isSurfacePrint, isReversePrint);
  });

  const controlsRef = useRef(null);
  const previousPrintingSideRef = useRef(printingSide);
  const hydratedRef = useRef(false);
  const [layerBoxHeight, setLayerBoxHeight] = useState('auto');
  
  useEffect(() => {
    console.log('=== COMPONENT MOUNT - FORCE FETCHING DATA ===');
    // Force clear existing data first
    setSubstrates([]);
    setSubstrateTypes([]);
    setSurfaceQualities([]);
    setDataLoaded(false);
    
    const initializeData = async () => {
      console.log('🔄 Starting fresh data fetch...');
      await fetchSubstrates();
      await fetchSubstrateTypes();
      await fetchSurfaceQualities();
      console.log('✅ Data fetch complete');
    };
    initializeData();
  }, []); // Only run once on mount

  useEffect(() => {
    console.log('=== PRINT SIDE/DATA CHANGE EFFECT ===', { 
      printingSide, 
      isSurfacePrint, 
      isReversePrint, 
      dataLoaded, 
      substrateTypesLength: substrateTypes.length,
      hydratedRef: hydratedRef.current
    });
    
    if (!printingSide) {
      console.log('No printing side, clearing layers');
      setLayers({});
      return;
    }
    
    // Check if print side has actually changed
    const hasPrintingSideChanged = previousPrintingSideRef.current !== printingSide;
    
    // If we've already hydrated saved data and print side hasn't changed, don't reset to defaults
    if (hydratedRef.current && !hasPrintingSideChanged && constructionDetails && Object.keys(constructionDetails).length > 0) {
      console.log('✅ Already hydrated with saved data, skipping reset to defaults');
      previousPrintingSideRef.current = printingSide;
      return;
    }
    
    const defaultLayers = getDefaultLayers(isSurfacePrint, isReversePrint);
    
    // Only auto-set Film type if Laminate.type is not already set (don't override saved data)
    if (isSurfacePrint && dataLoaded && substrateTypes.length > 0 && !defaultLayers.Laminate.type) {
      const filmType = substrateTypes.find(type => type.name && type.name.toLowerCase().includes('film'));
      console.log('🎯 Auto-setting Film type for surface print:', { 
        filmType, 
        allTypes: substrateTypes.map(t => ({id: t.id, name: t.name})),
        dataLoaded,
        isSurfacePrint 
      });
      if (filmType) {
        defaultLayers.Laminate.type = filmType.id;
        console.log('✅ Film type set to:', filmType.id, filmType.name);
      } else {
        console.warn('⚠️ Film type not found in substrate types');
      }
    }
    
    // Only reset checkboxes when print side actually changes
    const hasNoPreviousPrintingSide = previousPrintingSideRef.current === null || previousPrintingSideRef.current === undefined;
    
    if (hasPrintingSideChanged && !hasNoPreviousPrintingSide && printingSide) {
      console.log('Print side changed, resetting checkboxes');
      // Reset all checkboxes except the "Printed Substrate" when switching modes
      if (isSurfacePrint) {
        // Surface mode: BaseSubstrate is "Printed Substrate" - force checked, reset others
        defaultLayers.BaseSubstrate.enabled = true;
        defaultLayers.Varnish.enabled = false;
        defaultLayers.Laminate.enabled = false;
        defaultLayers.UseWhiteInk.enabled = false;
      } else if (isReversePrint) {
        // Reverse mode: Laminate is "Printed Substrate" - force checked, reset others  
        defaultLayers.Laminate.enabled = true;
        defaultLayers.Varnish.enabled = false;
        defaultLayers.BaseSubstrate.enabled = false;
        defaultLayers.UseWhiteInk.enabled = false;
      }
      
      // Reset the UseWhiteInk condition state when switching modes
      if (condition?.use_white_ink && onConditionChange) {
        onConditionChange({ ...condition, use_white_ink: false });
      }
    } else {
      // Just force the "Printed Substrate" checkbox to always be enabled when not switching
      if (isSurfacePrint) {
        defaultLayers.BaseSubstrate.enabled = true;
      } else if (isReversePrint) {
        defaultLayers.Laminate.enabled = true;
      }
    }
    
    // Update the ref to track the current print side
    previousPrintingSideRef.current = printingSide;
    
    console.log('Setting final layers:', defaultLayers);
    setLayers(defaultLayers);
  }, [printingSide, isSurfacePrint, isReversePrint, dataLoaded, substrateTypes, constructionDetails]);

  // Sync printed substrate type with selection from General Info
  useEffect(() => {
    const selectedTypeId = condition?.substrate_type_id || '';
    if (!selectedTypeId) return;
    setLayers(prev => {
      const updated = { ...prev };
      if (isSurfacePrint && updated.BaseSubstrate) {
        updated.BaseSubstrate = { ...updated.BaseSubstrate, type: selectedTypeId };
      } else if (isReversePrint && updated.Laminate) {
        updated.Laminate = { ...updated.Laminate, type: selectedTypeId };
      }
      return updated;
    });
  }, [condition?.substrate_type_id, isSurfacePrint, isReversePrint]);

  const fetchSubstrates = async () => {
    try {
      const { data, error } = await supabase
        .from('substrates')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setSubstrates(data || []);
    } catch (error) {
      console.error('Error fetching substrates:', error);
    }
  };

  const fetchSubstrateTypes = async () => {
    try {
      console.log('=== FETCHING SUBSTRATE TYPES ===');
      const { data, error } = await supabase
        .from('substrate_types')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      console.log('Raw substrate types from DB:', data);
      
      // Remove duplicates by name (keep first occurrence)
      const uniqueTypes = [];
      const seenNames = new Set();
      
      (data || []).forEach(type => {
        if (!seenNames.has(type.name)) {
          seenNames.add(type.name);
          uniqueTypes.push(type);
        }
      });
      
      console.log('Deduplicated substrate types:', uniqueTypes);
      setSubstrateTypes(uniqueTypes);
      setDataLoaded(true);
      setRenderKey(prev => prev + 1); // Force re-render
    } catch (error) {
      console.error('Error fetching substrate types:', error);
    }
  };

  const fetchSurfaceQualities = async () => {
    try {
      console.log('=== FETCHING SURFACE QUALITIES ===');
      const { data, error } = await supabase
        .from('substrate_surface_qualities')
        .select('id, name, substrate_type_id')
        .order('name');
      
      if (error) throw error;
      console.log('Raw surface qualities from DB:', data);
      
      // Remove duplicates by name + substrate_type_id (keep first occurrence)
      const uniqueQualities = [];
      const seenCombinations = new Set();
      
      (data || []).forEach(quality => {
        const key = `${quality.name}_${quality.substrate_type_id}`;
        if (!seenCombinations.has(key)) {
          seenCombinations.add(key);
          uniqueQualities.push(quality);
        }
      });
      
      console.log('Deduplicated surface qualities:', uniqueQualities);
      setSurfaceQualities(uniqueQualities);
      setRenderKey(prev => prev + 1); // Force re-render
    } catch (error) {
      console.error('Error fetching surface qualities:', error);
    }
  };

  useEffect(() => {
    // Only sync to parent while actively editing to avoid overwriting during initial load
    if (!isEditing) return;
    
    if (!printingSide || Object.keys(layers).length === 0) {
      onConstructionDetailsChange({});
      return;
    }
    
    // Convert layers to format expected by parent component
    const simpleFormat = {};
    Object.keys(layers).forEach(key => {
      if (key !== 'ColorInk') { // ColorInk is always enabled, don't include in construction details
        simpleFormat[key] = layers[key];
      }
    });
    
    // Only call if the data has actually changed
    const currentDetails = JSON.stringify(simpleFormat);
    const existingDetails = JSON.stringify(constructionDetails || {});
    
    if (currentDetails !== existingDetails) {
      onConstructionDetailsChange(simpleFormat);
    }
  }, [layers, printingSide, isEditing]);

  // Hydrate layers from saved constructionDetails
  useEffect(() => {
    console.log('💧 HYDRATION EFFECT:', { 
      printingSide, 
      dataLoaded, 
      constructionDetails, 
      isEditing, 
      originalLayers: !!originalLayers,
      hydratedRef: hydratedRef.current
    });
    
    if (!printingSide || !dataLoaded) {
      console.log('💧 Skipping hydration: no printingSide or data not loaded');
      return;
    }
    
    if (!constructionDetails || Object.keys(constructionDetails).length === 0) {
      console.log('💧 Skipping hydration: no constructionDetails');
      return;
    }
    
    // Don't override user's unsaved edits
    if (isEditing && originalLayers) {
      console.log('💧 Skipping hydration: currently editing with unsaved changes');
      return;
    }
    
    console.log('💧 Hydrating layers from constructionDetails...');
    const defaults = getDefaultLayers(isSurfacePrint, isReversePrint);
    const merged = { ...defaults };
    
    // Merge saved data into defaults
    Object.keys(constructionDetails).forEach((key) => {
      const saved = constructionDetails[key];
      if (!merged[key]) return;
      if (saved && typeof saved === 'object') {
        merged[key] = { 
          ...merged[key], 
          ...saved,
          // Keep default labels
          label: merged[key].label
        };
      }
    });
    
    // Enforce printed substrate always enabled for the active mode
    if (isSurfacePrint && merged.BaseSubstrate) {
      merged.BaseSubstrate.enabled = true;
    } else if (isReversePrint && merged.Laminate) {
      merged.Laminate.enabled = true;
    }
    
    console.log('💧 Hydrated layers:', merged);
    setLayers(merged);
    hydratedRef.current = true; // Mark as hydrated
  }, [constructionDetails, printingSide, isSurfacePrint, isReversePrint, dataLoaded, isEditing, originalLayers]);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        setLayerBoxHeight(entry.contentRect.height);
      }
    });

    if (controlsRef.current) {
      resizeObserver.observe(controlsRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const handleCheckChange = (layerKey) => {
    setLayers(prev => ({
      ...prev,
      [layerKey]: { ...prev[layerKey], enabled: !prev[layerKey].enabled }
    }));
    if (!isNew && setHasUnsavedChanges) setHasUnsavedChanges(true);
  };

  const handleTypeChange = (layerKey, value) => {
    setLayers(prev => ({
      ...prev,
      [layerKey]: { ...prev[layerKey], type: value }
    }));
    if (!isNew && setHasUnsavedChanges) setHasUnsavedChanges(true);
  };

  const handleSurfaceQualityChange = (layerKey, value) => {
    setLayers(prev => ({
      ...prev,
      [layerKey]: { ...prev[layerKey], surfaceQuality: value }
    }));
    if (!isNew && setHasUnsavedChanges) setHasUnsavedChanges(true);
  };

  const renderSurfacePrintStack = () => {
    // Check if we have any top layers (varnish or laminate)
    const hasTopLayers = layers.Varnish?.enabled || layers.Laminate?.enabled;
    // Check if we have color ink or white ink
    const hasColorInk = layers.ColorInk?.enabled;
    const hasWhiteInk = condition?.use_white_ink;
    const hasBaseSubstrate = layers.BaseSubstrate?.enabled;
    
    return (
      <>
        {/* Top group: Varnish and Laminate together with no gap */}
        {hasTopLayers && (
          <div className="space-y-[-1px]">
            {layers.Varnish?.enabled && <ConstructionLayer {...layers.Varnish} />}
            {layers.Laminate?.enabled && <ConstructionLayer 
              {...layers.Laminate}
              bgColor="transparent"
            />}
          </div>
        )}
        
        {/* Spacer above color ink - only if both top layers and color ink exist */}
        {hasTopLayers && hasColorInk && <Spacer />}

        {/* Color Ink above base substrate */}
        {hasColorInk && (
          <div className="space-y-[-1px]">
            {layers.ColorInk?.enabled && <ConstructionLayer {...layers.ColorInk} />}
            {hasWhiteInk && <ConstructionLayer 
              label="White Ink" 
              bgColor="white" 
              textColor="black" 
              bold={false} 
            />}
          </div>
        )}
        
        {/* Base substrate at the bottom - no spacer, connects directly */}
        {hasBaseSubstrate && (
          <ConstructionLayer 
            {...layers.BaseSubstrate}
            bgColor={liveColorHex || 'transparent'}
          />
        )}
      </>
    );
  };

  const renderReversePrintStack = () => {
    const hasVarnish = layers.Varnish?.enabled;
    const hasLaminate = layers.Laminate?.enabled; // This is "Printed Substrate" in reverse
    const hasColorInk = layers.ColorInk?.enabled;
    const hasWhiteInk = condition?.use_white_ink;
    const hasBaseSubstrate = layers.BaseSubstrate?.enabled;
    
    return (
      <>
        {/* Top layers: Varnish first */}
        {hasVarnish && <ConstructionLayer {...layers.Varnish} />}
        
        {/* Printed Substrate (Laminate in reverse) */}
        {hasLaminate && <ConstructionLayer 
          {...layers.Laminate}
          bgColor="transparent"
        />}
        
        {/* Color Ink below printed substrate */}
        {hasColorInk && (
          <div className="space-y-[-1px]">
            {layers.ColorInk?.enabled && <ConstructionLayer {...layers.ColorInk} />}
            {hasWhiteInk && <ConstructionLayer 
              label="White Ink" 
              bgColor="white" 
              textColor="black" 
              bold={false} 
            />}
          </div>
        )}
        
        {/* Spacer above base substrate - only if base substrate exists */}
        {hasBaseSubstrate && <Spacer />}
        
        {/* Base Substrate at the bottom */}
        {hasBaseSubstrate && <ConstructionLayer 
          {...layers.BaseSubstrate}
          bgColor={liveColorHex || 'transparent'}
        />}
      </>
    );
  };
  
  // Check if layers have changed from original
  const hasChanges = originalLayers && JSON.stringify(layers) !== JSON.stringify(originalLayers);

  const localCanEdit = isNew ? canEdit : (canEdit && isEditing);

  // Don't render construction panel if no print side is selected
  if (!printingSide) {
    return (
      <Card>
        <CardHeader
          title="Construction"
          showEdit={false}
          showLearn={false}
        />
        <CardContent className="p-6 text-center text-gray-500">
          Please select a print side to configure construction details.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={`Construction (${isSurfacePrint ? 'Surface' : 'Reverse'} Print)`}
        showEdit={!isNew}
        showLearn={false}
        isEditing={isEditing}
        canSave={isNew || hasChanges}
        saving={saving}
        onEdit={() => {
          setIsEditing(true);
          setOriginalLayers(JSON.parse(JSON.stringify(layers)));
        }}
        onSave={() => {
          // Build the final payload
          const simpleFormat = {};
          Object.keys(layers).forEach(key => {
            if (key !== 'ColorInk') {
              simpleFormat[key] = layers[key];
            }
          });
          
          // Sync UseWhiteInk with condition toggle
          if (simpleFormat.UseWhiteInk) {
            simpleFormat.UseWhiteInk.enabled = !!condition?.use_white_ink;
          }
          
          // Sync to parent immediately before closing edit mode
          onConstructionDetailsChange(simpleFormat);
          
          setIsEditing(false);
          setOriginalLayers(null);
          
          // Pass payload directly - no state timing dependency
          if (onSave) onSave(simpleFormat);
        }}
        onCancel={() => {
          if (originalLayers) {
            setLayers(JSON.parse(JSON.stringify(originalLayers)));
          }
          setIsEditing(false);
          setOriginalLayers(null);
          if (!isNew && setHasUnsavedChanges) {
            setHasUnsavedChanges(false);
          }
        }}
      />
      <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        <div ref={controlsRef} className="md:col-span-2 grid grid-cols-[1fr_1fr_1fr] gap-x-6 gap-y-1 items-center">
          
          {/* Header Row */}
          <Label className="text-sm font-medium text-gray-700">Layer</Label>
          <Label className="text-sm font-medium text-gray-700">Type</Label>
          <Label className="text-sm font-medium text-gray-700">Surface Quality</Label>

          {/* Varnish Row */}
          <div className="flex items-center space-x-2 min-h-[2.5rem]">
            <Checkbox 
              id="varnish" 
              checked={layers.Varnish?.enabled || false} 
              onCheckedChange={() => handleCheckChange('Varnish')} 
              disabled={!localCanEdit}
            />
            <Label htmlFor="varnish" className="cursor-pointer">
              {layers.Varnish?.label || 'Varnish'}
            </Label>
          </div>
          <div className="min-h-[2.5rem] flex items-center">
            <Select
              value={layers.Varnish?.type || ""}
              onValueChange={(value) => handleTypeChange('Varnish', value)}
              disabled={!localCanEdit || !layers.Varnish?.enabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="matte">Matte Varnish</SelectItem>
                <SelectItem value="gloss">Gloss Varnish</SelectItem>
                <SelectItem value="satin">Satin Varnish</SelectItem>
                <SelectItem value="uv">UV Varnish</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-h-[2.5rem] flex items-center">
            <Select
              value={layers.Varnish?.surfaceQuality || ""}
              onValueChange={(value) => handleSurfaceQualityChange('Varnish', value)}
              disabled={!localCanEdit || !layers.Varnish?.enabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="glossy">Glossy</SelectItem>
                <SelectItem value="matte">Matte</SelectItem>
                <SelectItem value="textured">Textured</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Laminate Row */}
          <div className="flex items-center space-x-2 min-h-[2.5rem]">
            <Checkbox 
              id="laminate" 
              checked={layers.Laminate?.enabled || false} 
              onCheckedChange={() => handleCheckChange('Laminate')} 
              disabled={!localCanEdit || isReversePrint}
            />
            <Label htmlFor="laminate" className={`cursor-pointer ${isReversePrint ? 'text-gray-500' : ''}`}>
              {layers.Laminate?.label || (isReversePrint ? 'Printed Substrate' : 'Laminate')}
            </Label>
          </div>
          <div className="min-h-[2.5rem] flex items-center">
            <Select
              key={`laminate-type-${printingSide}-${dataLoaded}-${substrateTypes.length}`}
              value={(() => {
                if (isSurfacePrint && dataLoaded) {
                  const filmType = substrateTypes.find(type => type.name && type.name.toLowerCase().includes('film'));
                  console.log('🔍 Laminate dropdown value - Film type:', filmType);
                  return filmType?.id || "";
                } else if (isReversePrint) {
                  return condition?.substrate_type_id || "";
                } else {
                  console.log('🔍 Laminate dropdown value - Current type:', layers.Laminate?.type);
                  return layers.Laminate?.type || "";
                }
              })()}
              onValueChange={(value) => {
                console.log('Laminate type change attempted:', value, 'isSurfacePrint:', isSurfacePrint);
                if (!isSurfacePrint && !isReversePrint) {
                  handleTypeChange('Laminate', value);
                }
              }}
              disabled={!localCanEdit || isSurfacePrint || isReversePrint}
            >
              <SelectTrigger className={`w-full ${(isSurfacePrint || isReversePrint) ? 'bg-gray-100 text-gray-600' : ''}`}>
                <SelectValue placeholder={(isSurfacePrint || isReversePrint) ? "Selected at top" : "Select Type"} />
              </SelectTrigger>
              <SelectContent className="bg-white z-[100] border shadow-lg">
                {console.log('🔍 RENDERING Laminate Type Options:', { 
                  isSurfacePrint, 
                  substrateTypesLength: substrateTypes.length,
                  allTypes: substrateTypes,
                  timestamp: Date.now()
                })}
                {substrateTypes.length === 0 ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : isSurfacePrint ? (
                  substrateTypes
                    .filter(type => type.name && type.name.toLowerCase().includes('film'))
                    .map(type => {
                      console.log('📝 Rendering Film option:', type);
                      return <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>;
                    })
                ) : (
                  substrateTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="min-h-[2.5rem] flex items-center">
            <Select
              value={layers.Laminate?.surfaceQuality || ""}
              onValueChange={(value) => handleSurfaceQualityChange('Laminate', value)}
              disabled={!localCanEdit || !layers.Laminate?.enabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Quality" />
              </SelectTrigger>
              <SelectContent className="bg-white z-[100] border shadow-lg">
                {console.log('🔍 RENDERING Surface Quality Options:', { 
                  surfaceQualitiesLength: surfaceQualities.length,
                  allQualities: surfaceQualities,
                  timestamp: Date.now()
                })}
                {surfaceQualities.length === 0 ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : (() => {
                  // Get the selected type ID for Laminate surface quality
                  // Laminate is always Film type
                  const filmType = substrateTypes.find(type => 
                    type.name && type.name.toLowerCase().includes('film')
                  );
                  const selectedTypeId = filmType?.id;
                  
                  console.log('🔍 Film type for Laminate surface quality:', { 
                    filmType, 
                    selectedTypeId,
                    substrateTypesCount: substrateTypes.length 
                  });
                  
                  return surfaceQualities
                    .filter(quality => quality.substrate_type_id === selectedTypeId)
                    .map(quality => {
                      console.log('📝 Rendering surface quality option:', quality);
                      return <SelectItem key={quality.id} value={quality.id}>{quality.name}</SelectItem>;
                    });
                })()}
              </SelectContent>
            </Select>
          </div>

          {/* White Ink Row */}
          <div className="flex items-center space-x-2 min-h-[2.5rem]">
            <Checkbox 
              id="white-ink" 
              checked={condition?.use_white_ink || false} 
              onCheckedChange={(checked) => {
                if (localCanEdit && onConditionChange) {
                  onConditionChange({ ...condition, use_white_ink: checked });
                  if (!isNew && setHasUnsavedChanges) setHasUnsavedChanges(true);
                }
              }}
              disabled={!localCanEdit}
            />
            <Label htmlFor="white-ink" className="cursor-pointer">
              {layers.UseWhiteInk?.label || (isSurfacePrint ? 'Use white ink base coat' : 'Use white ink backer')}
            </Label>
          </div>
          <div className="min-h-[2.5rem]"></div>
          <div className="min-h-[2.5rem]"></div>

          {/* Base Substrate Row */}
          <div className="flex items-center space-x-2 min-h-[2.5rem]">
            <Checkbox 
              id="baseSubstrate" 
              checked={layers.BaseSubstrate?.enabled || false} 
              onCheckedChange={() => handleCheckChange('BaseSubstrate')} 
              disabled={!localCanEdit || isSurfacePrint}
            />
            <Label htmlFor="baseSubstrate" className={`cursor-pointer ${isSurfacePrint ? 'text-gray-500' : ''}`}>
              {layers.BaseSubstrate?.label || (isReversePrint ? 'Base Substrate' : (isSurfacePrint ? 'Printed Substrate' : 'Base Substrate'))}
            </Label>
          </div>
          <div className="min-h-[2.5rem] flex items-center">
            <Select
              value={isSurfacePrint ? (condition?.substrate_type_id || "") : (layers.BaseSubstrate?.type || "")}
              onValueChange={(value) => handleTypeChange('BaseSubstrate', value)}
              disabled={!localCanEdit || !layers.BaseSubstrate?.enabled || isSurfacePrint}
            >
              <SelectTrigger className={`w-full ${isSurfacePrint ? 'bg-gray-100 text-gray-600' : ''}`}>
                <SelectValue placeholder={isSurfacePrint ? "Selected at top" : "Select Type"} />
              </SelectTrigger>
              <SelectContent className="bg-white z-[100] border shadow-lg">
                {substrateTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-h-[2.5rem] flex items-center">
            <Select
              value={layers.BaseSubstrate?.surfaceQuality || ""}
              onValueChange={(value) => handleSurfaceQualityChange('BaseSubstrate', value)}
              disabled={!localCanEdit || !layers.BaseSubstrate?.enabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Quality" />
              </SelectTrigger>
              <SelectContent className="bg-white z-[100] border shadow-lg">
                {surfaceQualities.length === 0 ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : (() => {
                  // Get the selected type ID for Base Substrate
                  let selectedTypeId;
                  if (isSurfacePrint) {
                    // For surface print, Base Substrate (labeled "Printed Substrate") uses the main substrate type from General Info
                    selectedTypeId = condition?.substrate_type_id;
                  } else {
                    // For reverse print, Base Substrate uses whatever type is selected in the Type dropdown
                    selectedTypeId = layers.BaseSubstrate?.type;
                  }
                  
                  console.log('🔍 Filtering Base Substrate surface qualities:', { 
                    selectedTypeId, 
                    isSurfacePrint,
                    availableQualities: surfaceQualities.length 
                  });
                  
                  return surfaceQualities
                    .filter(quality => quality.substrate_type_id === selectedTypeId)
                    .map(quality => (
                      <SelectItem key={quality.id} value={quality.id}>{quality.name}</SelectItem>
                    ));
                })()}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div 
          className="w-full max-w-xs mx-auto bg-gray-200 p-4 border border-gray-300 flex flex-col justify-center mt-6"
          style={{ height: layerBoxHeight }}
        >
          <AnimatePresence>
            {isSurfacePrint ? renderSurfacePrintStack() : renderReversePrintStack()}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrintConditionConstructionPanel;