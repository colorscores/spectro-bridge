import React, { useState, useEffect, useMemo } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import LayerVisualization from '@/components/cxf/LayerVisualization';
import { useProfile } from '@/context/ProfileContext';
import { supabase } from '@/integrations/supabase/client';

const SubstrateConditionStep = ({ formData, updateFormData }) => {
  const { profile } = useProfile();
  const [varnishTypes, setVarnishTypes] = useState([]);
  const [substrateTypes, setSubstrateTypes] = useState([]);
  const [surfaceQualities, setSurfaceQualities] = useState([]);
  const [allSurfaceQualities, setAllSurfaceQualities] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch dropdown data from database
  useEffect(() => {
    const fetchDropdownData = async () => {
      if (!profile?.organization_id) return;
      
      try {
        setLoading(true);
        
        // Fetch varnish types
      const { data: varnishData, error: varnishError } = await supabase
        .from('varnish_types')
        .select('id, name')
        .or(`organization_id.eq.${profile.organization_id},organization_id.is.null`)
        .order('name');
          
        if (varnishError) throw varnishError;
        
        // Fetch substrate types (both global and org-specific, exclude Varnish)
        const { data: substrateData, error: substrateError } = await supabase
          .from('substrate_types')
          .select('id, name')
          .or(`organization_id.eq.${profile.organization_id},organization_id.is.null`)
          .neq('name', 'Varnish')
          .order('name');
          
        if (substrateError) throw substrateError;
        
        // Fetch substrate surface qualities (both global and org-specific)
        const { data: qualityData, error: qualityError } = await supabase
          .from('substrate_surface_qualities')
          .select('id, name, substrate_type_id')
          .or(`organization_id.eq.${profile.organization_id},organization_id.is.null`)
          .order('name');
          
        if (qualityError) throw qualityError;
        
        setVarnishTypes(varnishData || []);
        setSubstrateTypes(substrateData || []);
        setAllSurfaceQualities(qualityData || []);
        setSurfaceQualities(qualityData || []);
      } catch (error) {
        console.error('Error fetching dropdown data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDropdownData();
  }, [profile?.organization_id]);


  // Hardcoded laminate types since no database table exists
  const laminateTypes = [
    { id: 'uv', name: 'UV Laminate' },
    { id: 'thermal', name: 'Thermal Laminate' },
    { id: 'pressure_sensitive', name: 'Pressure Sensitive' },
    { id: 'water_based', name: 'Water Based' },
    { id: 'solvent_based', name: 'Solvent Based' }
  ];

  // Determine which fields to use based on print side
  const isReversePrinting = formData.printSide === 'reverse';
  const bottomRowChecked = isReversePrinting ? formData.baseSubstrate : formData.laminate;
  const bottomRowTypeValue = isReversePrinting ? formData.baseSubstrateType : formData.laminateType;
  const bottomRowQualityValue = isReversePrinting ? formData.baseSubstrateSurfaceQuality : formData.laminateSurfaceQuality;
  const bottomRowTypeOptions = isReversePrinting ? substrateTypes : laminateTypes;

  // De-duplicate surface qualities by name to avoid duplicate rows (global + org-specific)
  const dedupedSurfaceQualities = useMemo(() => {
    const seen = new Set();
    return surfaceQualities.filter((q) => {
      const key = (q?.name || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [surfaceQualities]);

  // Filter surface qualities based on selected substrate type (for base substrate only)
  useEffect(() => {
    if (isReversePrinting && bottomRowTypeValue && allSurfaceQualities.length > 0 && substrateTypes.length > 0) {
      // Find the substrate type ID for base substrate
      const selectedType = substrateTypes.find(t => t.name === bottomRowTypeValue);
      
      if (selectedType) {
        // Filter qualities that match this substrate type
        const filtered = allSurfaceQualities.filter(q => q.substrate_type_id === selectedType.id);
        setSurfaceQualities(filtered);
        
        // Reset surface quality if current value is not in the filtered list
        if (bottomRowQualityValue && !filtered.some(q => q.name === bottomRowQualityValue)) {
          updateFormData({ baseSubstrateSurfaceQuality: '' });
        }
      } else {
        setSurfaceQualities(allSurfaceQualities);
      }
    } else {
      // For varnish or when no base substrate type is selected, show all qualities
      setSurfaceQualities(allSurfaceQualities);
    }
  }, [isReversePrinting, bottomRowTypeValue, allSurfaceQualities, substrateTypes, bottomRowQualityValue, updateFormData]);

  return (
    <div className="space-y-4 p-4">
      {/* Print Side Radio Buttons - Now inline */}
      <div className="flex items-center space-x-4">
        <Label className="text-sm font-medium text-muted-foreground">Print Side</Label>
        <RadioGroup 
          value={formData.printSide || 'surface'} 
          onValueChange={(value) => updateFormData({ printSide: value })}
          className="flex items-center space-x-6"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="surface" id="surface" />
            <Label htmlFor="surface">Surface</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="reverse" id="reverse" />
            <Label htmlFor="reverse">Reverse</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Layer Visualization - Full width layer box */}
      <LayerVisualization
        printSide={formData.printSide || 'surface'}
        useWhiteInk={formData.useWhiteInk || false}
        varnish={formData.varnish || false}
        laminate={formData.laminate || false}
        baseSubstrate={formData.baseSubstrate || false}
        isMetallic={formData.isMetallic || false}
        className="rounded-md"
      />

      {/* Layer Control Rows - Tightly grouped */}
      <div className="space-y-4">
        {/* Use White Ink and Is Metallic Row */}
        <div className="flex items-center gap-8">
          <div className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              id="useWhiteInk"
              checked={formData.useWhiteInk || false}
              onChange={(e) => updateFormData({ useWhiteInk: e.target.checked })}
              className="rounded border-border"
            />
            <Label htmlFor="useWhiteInk" className="text-sm">Use White Ink</Label>
          </div>
          
          {/* Only show Is Metallic if: Surface mode (always) OR Reverse mode with Base Substrate enabled */}
          {(!isReversePrinting || formData.baseSubstrate) && (
            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="isMetallic"
                checked={formData.isMetallic || false}
                onChange={(e) => updateFormData({ isMetallic: e.target.checked })}
                className="rounded border-border"
              />
              <Label htmlFor="isMetallic" className="text-sm">
                {isReversePrinting ? 'Base Substrate is Metallic' : 'Is Metallic'}
              </Label>
            </div>
          )}
        </div>

        {/* Varnish Section */}
        <div className="space-y-2">
          {/* Varnish Header Row */}
          <div className="grid grid-cols-[120px_1fr_1fr] gap-4 items-center">
            <div></div> {/* Empty space for checkbox alignment */}
            <Label className="text-xs text-muted-foreground font-medium">Type</Label>
            <Label className="text-xs text-muted-foreground font-medium">Surface Quality</Label>
          </div>
          
          {/* Varnish Controls Row */}
          <div className="grid grid-cols-[120px_1fr_1fr] gap-4 items-center">
            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="varnish"
                checked={formData.varnish || false}
                onChange={(e) => updateFormData({ varnish: e.target.checked })}
                className="rounded border-border"
              />
              <Label htmlFor="varnish" className="text-sm font-medium">Varnish</Label>
            </div>
            
            <Select 
              value={formData.varnishType || 'none'}
              onValueChange={(value) => updateFormData({ varnishType: value })}
              disabled={loading || !formData.varnish}
            >
              <SelectTrigger className="h-8 text-sm w-full">
                <SelectValue placeholder="Select varnish type" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border shadow-lg z-50">
                {varnishTypes.filter(t => t?.name && String(t.name).trim().length > 0).map((type) => (
                  <SelectItem key={type.id} value={type.name}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={formData.varnishSurfaceQuality || 'none'}
              onValueChange={(value) => updateFormData({ varnishSurfaceQuality: value })}
              disabled={loading || !formData.varnish}
            >
              <SelectTrigger className="h-8 text-sm w-full">
                <SelectValue placeholder="Select surface quality" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border shadow-lg z-50">
                {dedupedSurfaceQualities.filter(q => q?.name && String(q.name).trim().length > 0).map((quality) => (
                  <SelectItem key={quality.id} value={quality.name}>
                    {quality.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Laminate Section */}
        <div className="space-y-2">
          {/* Laminate Header Row */}
          <div className="grid grid-cols-[120px_1fr_1fr] gap-4 items-center">
            <div></div> {/* Empty space for checkbox alignment */}
            <Label className="text-xs text-muted-foreground font-medium">Type</Label>
            <Label className="text-xs text-muted-foreground font-medium">Surface Quality</Label>
          </div>
          
          {/* Laminate Controls Row */}
          <div className="grid grid-cols-[120px_1fr_1fr] gap-4 items-center">
            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="laminate"
                checked={bottomRowChecked || false}
                onChange={(e) => {
                  const field = isReversePrinting ? 'baseSubstrate' : 'laminate';
                  updateFormData({ [field]: e.target.checked });
                }}
                className="rounded border-border"
              />
              <Label htmlFor="laminate" className="text-sm font-medium">
                {isReversePrinting ? 'Base Substrate' : 'Laminate'}
              </Label>
            </div>
            
            <Select 
              value={bottomRowTypeValue || 'none'}
              onValueChange={(value) => {
                const field = isReversePrinting ? 'baseSubstrateType' : 'laminateType';
                updateFormData({ [field]: value });
              }}
              disabled={!bottomRowChecked}
            >
              <SelectTrigger className="h-8 text-sm w-full">
                <SelectValue placeholder={`Select ${isReversePrinting ? 'base substrate' : 'laminate'} type`} />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border shadow-lg z-50">
                {bottomRowTypeOptions.filter(t => t?.name && String(t.name).trim().length > 0).map((type) => (
                  <SelectItem key={type.id} value={type.name}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={bottomRowQualityValue || 'none'}
              onValueChange={(value) => {
                const field = isReversePrinting ? 'baseSubstrateSurfaceQuality' : 'laminateSurfaceQuality';
                updateFormData({ [field]: value });
              }}
              disabled={loading || !bottomRowChecked}
            >
              <SelectTrigger className="h-8 text-sm w-full">
                <SelectValue placeholder="Select surface quality" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border shadow-lg z-50">
                {dedupedSurfaceQualities.filter(q => q?.name && String(q.name).trim().length > 0).map((quality) => (
                  <SelectItem key={quality.id} value={quality.name}>
                    {quality.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubstrateConditionStep;