import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/context/ProfileContext';
import { useToast } from '@/hooks/use-toast';

const PrintConditionForm = ({ prePopulatedData, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    version: '',
    print_process: '',
    substrate_type_id: '',
    substrate_material_id: '',
    print_side: '',
    pack_type: '',
    ...prePopulatedData
  });
  
  const [dropdownData, setDropdownData] = useState({
    printProcesses: [],
    substrateTypes: [],
    substrateMaterials: [],
    packTypes: []
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  
  const { profile } = useProfile();
  const { toast } = useToast();

  // Fetch dropdown data and map imported substrate names to IDs
  useEffect(() => {
    const fetchDropdownData = async () => {
      if (!profile?.organization_id) return;
      
      try {
        const [processesRes, typesRes, materialsRes, packTypesRes] = await Promise.all([
          supabase.from('print_processes').select('*').eq('organization_id', profile.organization_id),
          supabase.from('substrate_types').select('*').eq('organization_id', profile.organization_id),
          supabase.from('substrate_materials').select('*').eq('organization_id', profile.organization_id),
          supabase.from('pack_types').select('*').eq('organization_id', profile.organization_id)
        ]);

        const newDropdownData = {
          printProcesses: processesRes.data || [],
          substrateTypes: typesRes.data || [],
          substrateMaterials: materialsRes.data || [],
          packTypes: packTypesRes.data || []
        };
        
        setDropdownData(newDropdownData);
        
        // Map imported substrate names to IDs if present in prePopulatedData
        if (prePopulatedData?.substrate_type && !prePopulatedData?.substrate_type_id) {
          const matchingType = newDropdownData.substrateTypes.find(t => 
            t.name.toLowerCase() === prePopulatedData.substrate_type.toLowerCase()
          );
          if (matchingType) {
            setFormData(prev => ({ ...prev, substrate_type_id: matchingType.id }));
          }
        }
        
        if (prePopulatedData?.material_type && !prePopulatedData?.substrate_material_id) {
          const matchingMaterial = newDropdownData.substrateMaterials.find(m => 
            m.name.toLowerCase() === prePopulatedData.material_type.toLowerCase()
          );
          if (matchingMaterial) {
            setFormData(prev => ({ ...prev, substrate_material_id: matchingMaterial.id }));
          }
        }
        
      } catch (error) {
        console.error('Error fetching dropdown data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load form data.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDropdownData();
  }, [profile?.organization_id, toast, prePopulatedData?.substrate_type, prePopulatedData?.material_type]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name?.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!formData.print_process) {
      errors.print_process = 'Print process is required';
    }
    
    if (!formData.substrate_type_id) {
      errors.substrate_type_id = 'Substrate type is required';
    }
    
    if (!formData.substrate_material_id) {
      errors.substrate_material_id = 'Substrate material is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const printConditionData = {
        name: formData.name.trim(),
        version: formData.version?.trim() || null,
        print_process: formData.print_process,
        substrate_type_id: formData.substrate_type_id,
        substrate_material_id: formData.substrate_material_id,
        print_side: formData.print_side || null,
        pack_type: formData.pack_type || null,
        organization_id: profile.organization_id,
        // Include LAB and spectral data from imported substrate
        lab: formData.lab,
        color_hex: formData.color_hex,
        spectral_data: formData.spectral_data
      };

      const { data, error } = await supabase
        .from('print_conditions')
        .insert([printConditionData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Print condition created successfully.',
      });

      onSave(data);
    } catch (error) {
      console.error('Error creating print condition:', error);
      toast({
        title: 'Error',
        description: 'Failed to create print condition.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create New Print Condition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-red-700">Create New Print Condition</CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure a new print condition with the imported substrate data
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Show substrate info */}
        {formData.lab && (
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="text-sm">
                <Label className="text-xs font-medium">Imported Substrate LAB Values:</Label>
                <div className="font-mono text-xs text-muted-foreground mt-1">
                  L:{formData.lab.L?.toFixed(2)} a:{formData.lab.a?.toFixed(2)} b:{formData.lab.b?.toFixed(2)}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Name - Required and blank */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Enter print condition name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className={validationErrors.name ? 'border-red-500' : ''}
          />
          {validationErrors.name && (
            <p className="text-sm text-red-500">{validationErrors.name}</p>
          )}
        </div>

        {/* Version */}
        <div className="space-y-2">
          <Label htmlFor="version">Version</Label>
          <Input
            id="version"
            placeholder="Enter version (optional)"
            value={formData.version}
            onChange={(e) => handleInputChange('version', e.target.value)}
          />
        </div>

        {/* Print Process */}
        <div className="space-y-2">
          <Label htmlFor="print-process" className="text-sm font-medium">
            Print Process <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.print_process}
            onValueChange={(value) => handleInputChange('print_process', value)}
          >
            <SelectTrigger className={validationErrors.print_process ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select print process" />
            </SelectTrigger>
            <SelectContent>
              {dropdownData.printProcesses.map((process) => (
                <SelectItem key={process.id} value={process.name}>
                  {process.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validationErrors.print_process && (
            <p className="text-sm text-red-500">{validationErrors.print_process}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Substrate Type */}
          <div className="space-y-2">
            <Label htmlFor="substrate-type" className="text-sm font-medium">
              Substrate Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.substrate_type_id}
              onValueChange={(value) => handleInputChange('substrate_type_id', value)}
            >
              <SelectTrigger className={validationErrors.substrate_type_id ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select substrate type" />
              </SelectTrigger>
              <SelectContent>
                {dropdownData.substrateTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validationErrors.substrate_type_id && (
              <p className="text-sm text-red-500">{validationErrors.substrate_type_id}</p>
            )}
          </div>

          {/* Substrate Material */}
          <div className="space-y-2">
            <Label htmlFor="substrate-material" className="text-sm font-medium">
              Substrate Material <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.substrate_material_id}
              onValueChange={(value) => handleInputChange('substrate_material_id', value)}
            >
              <SelectTrigger className={validationErrors.substrate_material_id ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select material" />
              </SelectTrigger>
              <SelectContent>
                {dropdownData.substrateMaterials.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    {material.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validationErrors.substrate_material_id && (
              <p className="text-sm text-red-500">{validationErrors.substrate_material_id}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Print Side */}
          <div className="space-y-2">
            <Label htmlFor="print-side">Print Side</Label>
            <Select
              value={formData.print_side}
              onValueChange={(value) => handleInputChange('print_side', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select print side" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Surface">Surface</SelectItem>
                <SelectItem value="Reverse">Reverse</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pack Type */}
          <div className="space-y-2">
            <Label htmlFor="pack-type">Pack Type</Label>
            <Select
              value={formData.pack_type}
              onValueChange={(value) => handleInputChange('pack_type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pack type" />
              </SelectTrigger>
              <SelectContent>
                {dropdownData.packTypes.map((packType) => (
                  <SelectItem key={packType.id} value={packType.name}>
                    {packType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1"
          >
            {saving ? 'Creating...' : 'Create Print Condition'}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={saving}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrintConditionForm;