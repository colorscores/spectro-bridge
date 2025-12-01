import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import SubstrateInfoColumn1 from './info-tab/SubstrateInfoColumn1';
import SubstrateInfoColumn2 from './info-tab/SubstrateInfoColumn2';
import SubstrateThumbnail from './info-tab/SubstrateThumbnail';

const SubstrateInfoFormTab = ({ 
  register, 
  control, 
  errors, 
  watch, 
  setValue,
  onDataChange,
  hideThumbnail = false
}) => {
  
  const { profile } = useAuth();
  const [substrateTypes, setSubstrateTypes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [surfaceQualities, setSurfaceQualities] = useState([]);
  const [loading, setLoading] = useState({ types: true, materials: false, qualities: false });
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const selectedTypeId = watch('type');
  const substrateName = watch('name');

  // Notify parent of data changes
  useEffect(() => {
    if (onDataChange) {
      onDataChange({
        name: substrateName,
        type: selectedTypeId
      });
    }
  }, [substrateName, selectedTypeId, onDataChange]);

  const fetchSubstrateTypes = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, types: true }));
      const { data, error } = await supabase
        .from('substrate_types')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setSubstrateTypes(data || []);
    } catch (error) {
      console.error('Error fetching substrate types:', error);
      toast({
        title: "Error",
        description: "Failed to load substrate types",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, types: false }));
    }
  }, [toast]);

  const fetchMaterials = useCallback(async (typeId) => {
    if (!typeId) {
      setMaterials([]);
      return;
    }

    try {
      setLoading(prev => ({ ...prev, materials: true }));
      const selectedType = substrateTypes.find(t => t.id === typeId);
      const idsToTry = Array.from(new Set([
        typeId,
        ...substrateTypes
          .filter(t => (t.name || '').trim() === (selectedType?.name || '').trim())
          .map(t => t.id)
      ]));
      const { data, error } = await supabase
        .from('substrate_materials')
        .select('id, name, thumbnail_url')
        .in('substrate_type_id', idsToTry)
        .order('name');
      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Error fetching materials:', error);
      toast({
        title: "Error",
        description: "Failed to load materials",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, materials: false }));
    }
  }, [toast, substrateTypes]);

  const fetchSurfaceQualities = useCallback(async (typeId) => {
    if (!typeId) {
      setSurfaceQualities([]);
      return;
    }

    try {
      setLoading(prev => ({ ...prev, qualities: true }));
      const selectedType = substrateTypes.find(t => t.id === typeId);
      const idsToTry = Array.from(new Set([
        typeId,
        ...substrateTypes
          .filter(t => (t.name || '').trim() === (selectedType?.name || '').trim())
          .map(t => t.id)
      ]));
      const { data, error } = await supabase
        .from('substrate_surface_qualities')
        .select('id, name, substrate_type_id')
        .in('substrate_type_id', idsToTry)
        .order('name');
      
      if (error) throw error;
      // Deduplicate by name, but prefer the entry for the currently selected typeId
      const mapByName = new Map();
      const norm = (s) => (s || '').trim().toLowerCase();
      // First pass: prefer selected type
      (data || []).forEach(q => {
        const key = norm(q.name);
        if (q.substrate_type_id === typeId && !mapByName.has(key)) {
          mapByName.set(key, q);
        }
      });
      // Second pass: fill any missing with first seen other types
      (data || []).forEach(q => {
        const key = norm(q.name);
        if (!mapByName.has(key)) {
          mapByName.set(key, q);
        }
      });
      const unique = Array.from(mapByName.values());
      setSurfaceQualities(unique);
    } catch (error) {
      console.error('Error fetching surface qualities:', error);
      toast({
        title: "Error",
        description: "Failed to load surface qualities",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, qualities: false }));
    }
  }, [toast, substrateTypes]);

  useEffect(() => {
    fetchSubstrateTypes();
  }, [fetchSubstrateTypes]);

  useEffect(() => {
    if (selectedTypeId) {
      fetchMaterials(selectedTypeId);
      fetchSurfaceQualities(selectedTypeId);
    }
  }, [selectedTypeId, fetchMaterials, fetchSurfaceQualities]);

  const handleTypeChange = (field, value) => {
    field.onChange(value);
    // Reset dependent fields when type changes
    setValue('material', '');
    setValue('surface_quality', '');
    setThumbnailUrl(null);
  };

  const getSelectedTypeName = () => {
    const type = substrateTypes.find(t => t.id === selectedTypeId);
    return type?.name || '';
  };

  const getSelectedMaterialName = () => {
    const selectedMaterialId = watch('material');
    const material = materials.find(m => m.id === selectedMaterialId);
    return material?.name || '';
  };

  const handleThumbnailUpload = async (file) => {
    const selectedMaterialId = watch('material');
    if (!selectedMaterialId) {
      toast({
        title: "Error",
        description: "Please select a material first",
        variant: "destructive",
      });
      return;
    }

    if (!file || file.type !== 'image/bmp') {
      toast({
        title: "Invalid file",
        description: "Please select a BMP image file",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      
      const fileName = `material_${selectedMaterialId}_${Date.now()}.bmp`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('substrate-thumbnails')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('substrate-thumbnails')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('substrate_materials')
        .update({ thumbnail_url: publicUrl })
        .eq('id', selectedMaterialId);

      if (updateError) throw updateError;

      setThumbnailUrl(publicUrl);
      
      toast({
        title: "Success",
        description: "Thumbnail uploaded successfully",
      });
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      toast({
        title: "Error",
        description: "Failed to upload thumbnail",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Substrate Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`grid grid-cols-1 ${hideThumbnail ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-8`}>
          <SubstrateInfoColumn1
            register={register}
            control={control}
            errors={errors}
            watch={watch}
            setValue={setValue}
            substrateTypes={substrateTypes}
            materials={materials}
            loading={loading}
            handleTypeChange={handleTypeChange}
          />
          <SubstrateInfoColumn2
            register={register}
            control={control}
            surfaceQualities={surfaceQualities}
            loading={loading}
            selectedTypeId={selectedTypeId}
          />
          {!hideThumbnail && (
            <SubstrateThumbnail
              thumbnailUrl={thumbnailUrl}
              isUploading={isUploading}
              handleThumbnailUpload={handleThumbnailUpload}
              getSelectedTypeName={getSelectedTypeName}
              getSelectedMaterialName={getSelectedMaterialName}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SubstrateInfoFormTab;