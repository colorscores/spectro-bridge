import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import CardHeader from '@/components/admin/my-company/CardHeader';

const InkSpecificationsCard = ({ register, disabled, isNew = false, isEditing, onEdit, onSave, onCancel, watch }) => {
  const [originalValues, setOriginalValues] = useState({});
  
  // Watch form values for change detection
  const watchedValues = watch ? watch() : {};

  // Helper function to check if specifications have changed
  const hasChanged = () => {
    if (!isEditing) return false;
    const currentValues = {
      material: watchedValues.material,
      series: watchedValues.series,
    };
    return JSON.stringify(currentValues) !== JSON.stringify(originalValues);
  };

  // Handle edit mode
  const handleEdit = () => {
    if (watch) {
      setOriginalValues({
        material: watchedValues.material,
        series: watchedValues.series,
      });
    }
    onEdit();
  };

  const handleCancel = () => {
    // Reset values if watch is available
    if (watch && originalValues) {
      // Note: setValue would need to be passed as prop to reset values
      // For now, just call the original cancel handler
    }
    onCancel();
  };

  return (
    <Card>
      <CardHeader 
        title="Specifications (optional)"
        subtitle="Optional manufacturer and formula details"
        showEdit={!isNew}
        onEdit={handleEdit}
        onSave={onSave}
        onCancel={handleCancel}
        isEditing={isEditing}
        canSave={hasChanged()}
        saving={false}
        showLearn={false}
      />
      <CardContent>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="material">Manufacturer</Label>
              <Input
                id="material"
                {...register('material')}
                placeholder="Enter manufacturer name"
                disabled={!isEditing}
              />
            </div>

            <div>
              <Label htmlFor="series">Model/Series</Label>
              <Input
                id="series"
                {...register('series')}
                placeholder="Enter model/series"
                disabled={!isEditing}
              />
            </div>
          </div>
          
          {/* Formula Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Formula</Label>
              <Button variant="outline" size="sm" disabled={!isEditing}>
                <Plus className="h-4 w-4 mr-2" />
                Add formula component
              </Button>
            </div>
            <div className="border rounded-md">
              <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 border-b font-medium text-sm">
                <div>Component Name</div>
                <div>Component Type</div>
                <div>Percentage (%)</div>
              </div>
              <div className="grid grid-cols-3 gap-4 p-3 text-sm text-muted-foreground">
                <div>No components added</div>
                <div>-</div>
                <div>-</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InkSpecificationsCard;