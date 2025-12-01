import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const AdaptStep2Details = ({ formData, updateFormData, resolvedNames }) => {
  return (
    <div className="space-y-6 p-6">
      {/* Ink Condition Name */}
      <div className="space-y-2">
        <Label htmlFor="inkConditionName" className="text-sm font-medium text-muted-foreground">
          Ink Condition Name
        </Label>
        <Input 
          id="inkConditionName"
          value={formData.inkConditionName || resolvedNames?.inkConditionName || ''}
          onChange={(e) => updateFormData({ inkConditionName: e.target.value })}
          className="h-10"
          placeholder="Enter ink condition name"
        />
      </div>

      {/* Display substrate and condition info */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">
          Target Substrate
        </Label>
        <div className="p-3 bg-muted rounded-md text-sm">
          {formData.assignedSubstrate || 'Not selected'}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">
          Target Condition
        </Label>
        <div className="p-3 bg-muted rounded-md text-sm">
          {formData.selectedSubstrateCondition?.name || 'Not selected'}
        </div>
      </div>
    </div>
  );
};

export default AdaptStep2Details;
