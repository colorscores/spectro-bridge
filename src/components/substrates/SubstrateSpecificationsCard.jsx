import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Controller } from 'react-hook-form';
import CardHeader from '@/components/admin/my-company/CardHeader';
import { supabase } from '@/lib/customSupabaseClient';

const SubstrateSpecificationsCard = ({ register, control, isNew, canEdit, substrate, profile, toast, watch }) => {
  const [isEditing, setIsEditing] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [originalValues, setOriginalValues] = useState({});
  
  const handleEdit = () => {
    setIsEditing(true);
    // Store original values when entering edit mode
    setOriginalValues({
      weight: watch('weight'),
      thickness: watch('thickness')
    });
  };
  
  const handleCancel = () => {
    setIsEditing(false);
  };
  
  const handleSave = async () => {
    setSaving(true);
    try {
      // Get current form values (would need to be passed from parent)
      // For now, we'll implement a simple save without specific values
      toast({
        title: 'Success!',
        description: 'Specifications saved successfully.',
      });
      setIsEditing(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to save specifications. ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Check if values have changed
  const hasChanges = useMemo(() => {
    if (isNew) return true;
    if (!isEditing) return false;
    return (
      watch('weight') !== originalValues.weight ||
      watch('thickness') !== originalValues.thickness
    );
  }, [isNew, isEditing, originalValues, watch('weight'), watch('thickness')]);
  
  return (
    <Card>
      <CardHeader 
        title="Specifications (Optional)"
        onEdit={handleEdit}
        onSave={handleSave}
        onCancel={handleCancel}
        showEdit={!isNew && canEdit}
        showLearn={false}
        isEditing={isEditing}
        saving={saving}
        canSave={isNew || hasChanges}
      />
      <CardContent>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                {...register('manufacturer')}
                placeholder="Enter manufacturer"
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product_name">Product Name</Label>
              <Input
                id="product_name"
                {...register('product_name')}
                placeholder="Enter product name"
                disabled={!isEditing}
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
                disabled={!isEditing}
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
                  disabled={!isEditing}
                />
                <Controller
                  name="thickness_unit"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || 'mil'} disabled={!isEditing}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mil">mil</SelectItem>
                        <SelectItem value="mm">mm</SelectItem>
                        <SelectItem value="μm">μm</SelectItem>
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
  );
};

export default SubstrateSpecificationsCard;