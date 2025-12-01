import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const Step3JobDetails = ({ formData, setFormData, selectedColors, qualitySets }) => {
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getQualitySetText = (value) => {
    if (!value) return 'Not set';
    const selectedSet = qualitySets.find(qs => qs.id === value);
    return selectedSet ? selectedSet.name : 'Not set';
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {selectedColors.map(color => (
          <div key={color.id} className="flex items-center gap-4 py-1">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: color.hex }}></div>
            </div>
            <div className="w-[280px] flex-shrink-0">
              <span className="text-sm leading-tight break-words">{color.name}</span>
            </div>
            <div className="flex-shrink-0">
              <Button 
                variant="outline" 
                className="w-[200px] justify-start text-left font-normal pointer-events-none bg-muted"
                disabled
              >
                {getQualitySetText(formData.qualitySetMode === 'all' ? formData.allColorsQualitySet : formData.individualQualitySets[color.id])}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <hr />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="dueDate">Due Date</Label>
          <Input id="dueDate" type="date" value={formData.dueDate} onChange={(e) => handleChange('dueDate', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="projectId">Project ID</Label>
          <Input id="projectId" value={formData.projectId} onChange={(e) => handleChange('projectId', e.target.value)} placeholder="e.g. ABC-123" />
        </div>
      </div>
    </div>
  );
};

export default Step3JobDetails;