import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/context/ProfileContext';

const SubstrateDetailsStep = ({ formData, updateFormData }) => {
  const { profile } = useProfile();
  const [substrateTypes, setSubstrateTypes] = useState([]);
  const [substrateMaterials, setSubstrateMaterials] = useState([]);
  const [surfaceQualities, setSurfaceQualities] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch substrate types on component mount
  useEffect(() => {
    const fetchSubstrateTypes = async () => {
      if (!profile?.organization_id) {
        console.log('No organization_id found in profile');
        return;
      }
      
      console.log('Fetching substrate types for org:', profile.organization_id);
      
      try {
        const { data, error } = await supabase
          .from('substrate_types')
          .select('id, name')
          .or(`organization_id.eq.${profile.organization_id},organization_id.is.null`)
          .order('name');
        
        if (error) {
          console.error('Supabase error fetching substrate types:', error);
          throw error;
        }
        
        console.log('Fetched substrate types:', data);
        setSubstrateTypes(data || []);
      } catch (error) {
        console.error('Error fetching substrate types:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubstrateTypes();
  }, [profile?.organization_id]);

  // Fetch substrate materials when type is selected
  useEffect(() => {
    const fetchSubstrateMaterials = async () => {
      if (!formData.substrateTypeId) {
        setSubstrateMaterials([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('substrate_materials')
          .select('id, name')
          .eq('substrate_type_id', formData.substrateTypeId)
          .order('name');
        
        if (error) throw error;
        setSubstrateMaterials(data || []);
      } catch (error) {
        console.error('Error fetching substrate materials:', error);
      }
    };

    fetchSubstrateMaterials();
  }, [formData.substrateTypeId]);

  // Fetch surface qualities when type is selected
  useEffect(() => {
    const fetchSurfaceQualities = async () => {
      if (!formData.substrateTypeId) {
        setSurfaceQualities([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('substrate_surface_qualities')
          .select('id, name')
          .eq('substrate_type_id', formData.substrateTypeId)
          .order('name');
        
        if (error) throw error;
        setSurfaceQualities(data || []);
      } catch (error) {
        console.error('Error fetching surface qualities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSurfaceQualities();
  }, [formData.substrateTypeId]);
  return (
    <div className="space-y-6 p-6">
      {/* Substrate Name */}
      <div className="space-y-2">
        <Label htmlFor="substrateName" className="text-sm font-medium text-muted-foreground">
          Substrate Name
        </Label>
        <Input 
          id="substrateName"
          value={formData.newSubstrateName || ''}
          onChange={(e) => updateFormData({ newSubstrateName: e.target.value })}
          className="h-10"
        />
      </div>

      {/* Substrate Type */}
      <div className="space-y-2">
        <Label htmlFor="substrateType" className="text-sm font-medium text-muted-foreground">
          Substrate Type
        </Label>
        <Select 
          value={formData.substrateTypeId || 'none'} 
          onValueChange={(value) => updateFormData({ 
            substrateTypeId: value,
            substrateMaterialId: '', // Reset dependent fields
            surfaceQualityId: ''
          })}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Select substrate type" />
          </SelectTrigger>
          <SelectContent>
            {substrateTypes.filter(t => t?.name && String(t.name).trim().length > 0).map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Substrate Material */}
      <div className="space-y-2">
        <Label htmlFor="substrateMaterial" className="text-sm font-medium text-muted-foreground">
          Substrate Characteristics
        </Label>
        <Select 
          value={formData.substrateMaterialId || 'none'} 
          onValueChange={(value) => updateFormData({ substrateMaterialId: value })}
          disabled={!formData.substrateTypeId}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Select Substrate Characteristics" />
          </SelectTrigger>
          <SelectContent>
            {substrateMaterials.filter(m => m?.name && String(m.name).trim().length > 0).map((material) => (
              <SelectItem key={material.id} value={material.id}>
                {material.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Surface Quality */}
      <div className="space-y-2">
        <Label htmlFor="surfaceQuality" className="text-sm font-medium text-muted-foreground">
          Substrate Surface Quality
        </Label>
        <Select 
          value={formData.surfaceQualityId || 'none'} 
          onValueChange={(value) => updateFormData({ surfaceQualityId: value })}
          disabled={!formData.substrateTypeId}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Select surface quality" />
          </SelectTrigger>
          <SelectContent>
            {surfaceQualities.filter(q => q?.name && String(q.name).trim().length > 0).map((quality) => (
              <SelectItem key={quality.id} value={quality.id}>
                {quality.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

    </div>
  );
};

export default SubstrateDetailsStep;