import React, { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Controller } from 'react-hook-form';

const SubstrateInfoColumn1 = ({
  register,
  control,
  errors,
  watch,
  setValue,
  substrateTypes,
  materials,
  loading,
  handleTypeChange,
}) => {

  const selectedTypeId = watch('type');
  const nameVal = watch('name');
  const materialVal = watch('material');
  const printingSide = watch('printing_side');
  const checkboxLabel = printingSide === 'Reverse' ? 'Use white ink backing' : 'Use white ink base coat';

  // Validate required fields on mount so labels show state and form validity is computed
  useEffect(() => {
    setValue('name', nameVal || '', { shouldValidate: true, shouldDirty: false });
    setValue('type', selectedTypeId || '', { shouldValidate: true, shouldDirty: false });
    setValue('material', materialVal || '', { shouldValidate: true, shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">
          Substrate Name{!nameVal && <span className="ml-1 text-destructive">(required)</span>}
        </Label>
        <Input
          id="name"
          {...register('name', { required: 'Name is required' })}
          placeholder="e.g., Clear Film 2.0mil"
        />
        
      </div>
      <div className="space-y-2">
        <Label htmlFor="type">Type{!selectedTypeId && <span className="ml-1 text-destructive">(required)</span>}</Label>
        <Controller
          name="type"
          control={control}
          rules={{ required: 'Type is required' }}
          render={({ field }) => (
            <Select onValueChange={(value) => handleTypeChange(field, value)} value={field.value || ''} disabled={loading.types}>
              <SelectTrigger>
                <SelectValue placeholder={loading.types ? "Loading..." : "Select a type"} />
              </SelectTrigger>
              <SelectContent>
                {substrateTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        
      </div>
      <div className="space-y-2">
        <Label htmlFor="material">Material{!materialVal && <span className="ml-1 text-destructive">(required)</span>}</Label>
        <Controller
          name="material"
          control={control}
          rules={{ required: 'Material is required' }}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedTypeId || loading.materials}>
              <SelectTrigger>
                <SelectValue placeholder={loading.materials ? "Loading..." : "Select a material"} />
              </SelectTrigger>
              <SelectContent>
                {materials.map(material => (
                  <SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="printing_side">Printing Side</Label>
        <Controller
          name="printing_side"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || 'Surface'}>
              <SelectTrigger>
                <SelectValue placeholder="Select printing side" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Surface">Surface</SelectItem>
                <SelectItem value="Reverse">Reverse</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Controller
          name="use_white_ink"
          control={control}
          render={({ field }) => (
            <Checkbox
              id="use_white_ink"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label htmlFor="use_white_ink" className="cursor-pointer">{checkboxLabel}</Label>
      </div>
    </div>
  );
};

export default SubstrateInfoColumn1;