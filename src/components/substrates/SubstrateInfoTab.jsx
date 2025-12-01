import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Controller } from 'react-hook-form';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const SubstrateInfoTab = ({ 
  register, 
  control, 
  errors, 
  watch, 
  setValue, 
  isNew = false,
  substrate = null,
  onSubmitUpdate = null,
  onSubmitNew = null,
  onCancel = null
}) => {
  
  const { profile } = useAuth();
  const [substrateTypes, setSubstrateTypes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [surfaceQualities, setSurfaceQualities] = useState([]);
  const [loading, setLoading] = useState({ types: true, materials: false, qualities: false });

  const selectedTypeId = watch('type');
  const selectedMaterialId = watch('material');
  const selectedFinish = watch('finish');

  const fetchSubstrateTypes = useCallback(async () => {
    setLoading(prev => ({ ...prev, types: true }));
    const { data, error } = await supabase.from('substrate_types').select('id, name').order('name');
    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch substrate types.', variant: 'destructive' });
    } else {
      setSubstrateTypes(data);
    }
    setLoading(prev => ({ ...prev, types: false }));
  }, [toast]);

  const fetchMaterials = useCallback(async (typeId) => {
    if (!typeId) {
      setMaterials([]);
      return;
    }
    setLoading(prev => ({ ...prev, materials: true }));
    const { data, error } = await supabase.from('substrate_materials').select('id, name, thumbnail_url').eq('substrate_type_id', typeId).order('name');
    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch materials.', variant: 'destructive' });
    } else {
      setMaterials(data);
    }
    setLoading(prev => ({ ...prev, materials: false }));
  }, [toast]);

  const fetchSurfaceQualities = useCallback(async (typeId) => {
    if (!typeId) {
      setSurfaceQualities([]);
      return;
    }
    setLoading(prev => ({ ...prev, qualities: true }));
    const { data, error } = await supabase.from('substrate_surface_qualities').select('id, name').eq('substrate_type_id', typeId).order('name');
    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch surface qualities.', variant: 'destructive' });
    } else {
      setSurfaceQualities(data);
    }
    setLoading(prev => ({ ...prev, qualities: false }));
  }, [toast]);

  useEffect(() => {
    fetchSubstrateTypes();
  }, [fetchSubstrateTypes]);

  useEffect(() => {
    if (selectedTypeId) {
      fetchMaterials(selectedTypeId);
      fetchSurfaceQualities(selectedTypeId);
    } else {
      setMaterials([]);
      setSurfaceQualities([]);
    }
  }, [selectedTypeId, fetchMaterials, fetchSurfaceQualities]);

  const handleTypeChange = (field, value) => {
    field.onChange(value);
    setValue('material', null, { shouldValidate: true });
    setValue('surface_quality', null, { shouldValidate: true });
  };


  const selectedPrintSide = watch('printing_side');

  return (
    <div className="space-y-6">
      {/* ===== REDESIGNED GENERAL INFO PANEL ===== */}
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6">
          {/* First Row: Name, Type, Material, Surface Quality */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="name">Substrate Name</Label>
              <Input
                id="name"
                {...register('name', { required: 'Substrate name is required' })}
                placeholder="Enter substrate name"
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>Substrate Type</Label>
              <Controller
                name="type"
                control={control}
                rules={{ required: 'Substrate type is required' }}
                render={({ field }) => (
                  <Select onValueChange={(value) => handleTypeChange(field, value)} value={field.value || ''} disabled={loading.types}>
                    <SelectTrigger>
                      <SelectValue placeholder={loading.types ? "Loading..." : "Select substrate type"} />
                    </SelectTrigger>
                    <SelectContent>
                      {substrateTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>Substrate Characteristics</Label>
              <Controller
                name="material"
                control={control}
                rules={{ required: 'Material is required' }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedTypeId || loading.materials}>
                    <SelectTrigger>
                      <SelectValue placeholder={loading.materials ? "Loading..." : "Select material"} />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map(material => (
                        <SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.material && <p className="text-sm text-destructive">{errors.material.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>Surface Quality</Label>
              <Controller
                name="surface_quality"
                control={control}
                rules={{ required: 'Surface quality is required' }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedTypeId || loading.qualities}>
                    <SelectTrigger>
                      <SelectValue placeholder={loading.qualities ? "Loading..." : "Select surface quality"} />
                    </SelectTrigger>
                    <SelectContent>
                      {surfaceQualities.map(quality => (
                        <SelectItem key={quality.id} value={quality.id}>{quality.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.surface_quality && <p className="text-sm text-destructive">{errors.surface_quality.message}</p>}
            </div>
          </div>

          {/* Second Row: Print Side and White Ink */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Print Side</Label>
              <Controller
                name="printing_side"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || 'surface'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select print side" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="surface">Surface</SelectItem>
                      <SelectItem value="reverse">Reverse</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2 mt-6">
                <Controller
                  name="use_white_ink"
                  control={control}
                  render={({ field }) => (
                    <>
                      <input
                        type="checkbox"
                        id="use_white_ink"
                        checked={field.value || false}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="use_white_ink">
                        {selectedPrintSide === 'reverse' ? 'Use white ink backer' : 'Use white ink base coat'}
                      </Label>
                    </>
                  )}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Specifications Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Specifications (optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  {...register('manufacturer')}
                  placeholder="Enter manufacturer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product_name">Product Name</Label>
                <Input
                  id="product_name"
                  {...register('product_name')}
                  placeholder="Enter product name"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (GSM)</Label>
                <Input
                  id="weight"
                  type="number"
                  {...register('weight', { valueAsNumber: true })}
                  placeholder="Enter weight"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="thickness">Thickness</Label>
                <div className="flex gap-2">
                  <Input
                    id="thickness"
                    type="number"
                    {...register('thickness', { valueAsNumber: true })}
                    placeholder="Enter thickness"
                    className="flex-1"
                  />
                  <Controller
                    name="thickness_unit"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || 'mil'}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mil">mil</SelectItem>
                          <SelectItem value="micron">micron</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Printability Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Printability</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contrast</Label>
              <Controller
                name="contrast"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select contrast" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ink_adhesion">Ink Adhesion</Label>
              <Input
                id="ink_adhesion"
                type="number"
                {...register('ink_adhesion', { valueAsNumber: true })}
                placeholder="Enter ink adhesion value"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Enter any relevant notes..."
              className="min-h-[120px]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubstrateInfoTab;