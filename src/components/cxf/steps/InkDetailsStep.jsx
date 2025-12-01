import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

const InkDetailsStep = ({ formData, updateFormData }) => {
  const [printProcesses, setPrintProcesses] = useState([]);
  const [inkTypes, setInkTypes] = useState([]);

  // Appearance type options based on database enum
  const appearanceTypeOptions = [
    { value: 'standard', label: 'Standard' },
    { value: 'opaque', label: 'Opaque' },
    { value: 'metallic', label: 'Metallic' }
  ];

  // Fetch data from database
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [processesRes, inkTypesRes] = await Promise.all([
          supabase.from('print_processes').select('*').order('name'),
          supabase.from('ink_types').select('*').order('name')
        ]);

        setPrintProcesses(processesRes.data || []);
        setInkTypes(inkTypesRes.data || []);
      } catch (error) {
        console.error('Error fetching dropdown data:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Ink Name */}
      <div className="space-y-2">
        <Label htmlFor="inkName" className="text-sm font-medium text-muted-foreground">
          Ink Name
        </Label>
        <Input 
          id="inkName"
          value={formData.inkName || ''}
          onChange={(e) => updateFormData({ inkName: e.target.value })}
          className="h-10"
          placeholder="Enter ink name"
        />
      </div>

      {/* Print Process */}
      <div className="space-y-2">
        <Label htmlFor="printProcess" className="text-sm font-medium text-muted-foreground">
          Print Process
        </Label>
        <Select 
          value={formData.printProcess || 'none'}
          onValueChange={(value) => updateFormData({ printProcess: value })}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Select print process" />
          </SelectTrigger>
          <SelectContent className="bg-background border border-border shadow-lg z-50">
            {printProcesses.filter(p => p?.name && String(p.name).trim().length > 0).map((process) => (
              <SelectItem key={process.id} value={process.name}>
                {process.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ink Type */}
      <div className="space-y-2">
        <Label htmlFor="inkType" className="text-sm font-medium text-muted-foreground">
          Ink Type
        </Label>
        <Select 
          value={formData.ink_type || 'none'}
          onValueChange={(value) => updateFormData({ ink_type: value })}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Select ink type" />
          </SelectTrigger>
          <SelectContent className="bg-background border border-border shadow-lg z-50">
            {inkTypes.filter(t => t?.value && String(t.value).trim().length > 0).map((inkType) => (
              <SelectItem key={inkType.id} value={inkType.value}>
                {inkType.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>


      {/* Appearance */}
      <div className="space-y-2">
        <Label htmlFor="appearanceType" className="text-sm font-medium text-muted-foreground">
          Appearance
        </Label>
        <div className="flex gap-2">
          <div className={formData.appearanceType === 'standard' ? "flex-1" : "flex-1"}>
            <Select 
              value={formData.appearanceType || 'standard'}
              onValueChange={(value) => {
                const updates = { 
                  appearanceType: value,
                  opaque: value === 'opaque',
                  metallic: value === 'metallic'
                };
                // Clear unused fields when switching appearance types
                if (value !== 'metallic') updates.metallicGloss = null;
                if (value !== 'opaque') updates.opacityLeft = null;
                updateFormData(updates);
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select appearance type" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border shadow-lg z-50">
                {appearanceTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Conditional value field */}
          {formData.appearanceType === 'metallic' && (
            <div className="flex-1">
              <Input 
                type="number"
                min="0"
                max="100"
                value={formData.metallicGloss || ''}
                onChange={(e) => updateFormData({ metallicGloss: parseInt(e.target.value) || null })}
                className="h-10"
                placeholder="Intensity"
              />
            </div>
          )}
          
          {formData.appearanceType === 'opaque' && (
            <div className="flex-1">
              <Input 
                type="number"
                min="0"
                max="100"
                value={formData.opacityLeft || ''}
                onChange={(e) => updateFormData({ opacityLeft: parseInt(e.target.value) || null })}
                className="h-10"
                placeholder="Opacity (%)"
              />
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default InkDetailsStep;