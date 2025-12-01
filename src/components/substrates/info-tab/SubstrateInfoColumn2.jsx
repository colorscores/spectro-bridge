import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Controller } from 'react-hook-form';

const SubstrateInfoColumn2 = ({
  register,
  control,
  surfaceQualities,
  loading,
  selectedTypeId,
}) => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="surface_quality">Surface quality</Label>
        <Controller
          name="surface_quality"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedTypeId || loading.qualities}>
              <SelectTrigger>
                <SelectValue placeholder={loading.qualities ? "Loading..." : "Select a surface quality"} />
              </SelectTrigger>
              <SelectContent>
                {surfaceQualities.map(quality => (
                  <SelectItem key={quality.id} value={quality.id}>{quality.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contrast">Contrast</Label>
        <Controller
          name="contrast"
          control={control}
          defaultValue="medium"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || 'medium'}>
              <SelectTrigger>
                <SelectValue placeholder="Select contrast" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium (default)</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ink_adhesion">Ink Adhesion</Label>
        <Controller
          name="ink_adhesion"
          control={control}
          defaultValue={100}
          render={({ field }) => (
            <Select 
              onValueChange={(value) => field.onChange(parseInt(value))} 
              value={field.value !== null && field.value !== undefined ? String(field.value) : '100'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select ink adhesion" />
              </SelectTrigger>
               <SelectContent>
                <SelectItem value="100">100% (default)</SelectItem>
                <SelectItem value="90">90%</SelectItem>
                <SelectItem value="80">80%</SelectItem>
                <SelectItem value="70">70%</SelectItem>
                <SelectItem value="69">&lt;70%</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          {...register('notes')}
          placeholder="Enter any relevant notes..."
          className="h-32"
        />
      </div>
    </div>
  );
};

export default SubstrateInfoColumn2;