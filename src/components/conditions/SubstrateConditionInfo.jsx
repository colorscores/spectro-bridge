import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import CardHeader from '@/components/admin/my-company/CardHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import MeasurementControls from '@/components/conditions/MeasurementControls';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const SubstrateConditionInfo = ({ 
  condition, 
  parentSubstrate, 
  onNameChange, 
  onFileChange, 
  onConditionChange, 
  measurementControls, 
  onMeasurementControlsChange, 
  canEdit, 
  setHasUnsavedChanges, 
  isNew,
  onPackTypeChange,
  isEditing,
  onEdit,
  onSave,
  onCancel
}) => {
  
  const cxfInputRef = useRef(null);
  const cgatsInputRef = useRef(null);
  const [packTypes, setPackTypes] = useState([]);
  const [substrateConditions, setSubstrateConditions] = useState([]);

  

  useEffect(() => {
    fetchPackTypes();
    fetchSubstrateConditions();
  }, []);

  const fetchPackTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('pack_types')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setPackTypes(data);
    } catch (error) {
      console.error('Error fetching pack types:', error);
    }
  };

  const fetchSubstrateConditions = async () => {
    try {
      // First try to get substrates with their conditions
      const { data: substratesData, error: substratesError } = await supabase
        .from('substrates')
        .select(`
          id,
          name,
          organization_id
        `)
        .order('name');
      
      if (substratesError) {
        console.error('Error fetching substrates:', substratesError);
        return;
      }

      // Then get substrate conditions
      const { data: conditionsData, error: conditionsError } = await supabase
        .from('substrate_conditions')
        .select(`
          id,
          name,
          substrate_id
        `)
        .order('name');
      
      if (conditionsError) {
        console.error('Error fetching substrate conditions:', conditionsError);
        return;
      }
      
      // Combine the data
      const combined = [];
      conditionsData?.forEach(condition => {
        const substrate = substratesData?.find(s => s.id === condition.substrate_id);
        if (substrate) {
          combined.push({
            id: condition.id,
            name: condition.name,
            substrate_id: substrate.id,
            substrate_name: substrate.name
          });
        }
      });
      
      setSubstrateConditions(combined);
    } catch (error) {
      console.error('Error fetching substrate conditions:', error);
    }
  };

  const handleFileChange = (event, type) => {
    onFileChange(event, type);
    if (!isNew) {
      setHasUnsavedChanges(true);
      if (setInfoCardUnsavedChanges) setInfoCardUnsavedChanges(true);
    }
  };

  const handlePackTypeChange = (value) => {
    onPackTypeChange(value);
    if (!isNew) {
      setHasUnsavedChanges(true);
    }
  };

  const handleNameChange = (e) => {
    onNameChange(e);
    if (!isNew) {
      setHasUnsavedChanges(true);
    }
  };

  const selectedPackType = condition.pack_type || '';
  const hasPackTypeOption = Array.isArray(packTypes) && packTypes.some(pt => pt.name === selectedPackType);

  return (
    <Card>
      <CardHeader
        title="Substrate Condition Settings"
        onEdit={onEdit}
        onSave={onSave}
        onCancel={onCancel}
        showEdit={!isNew}
        isEditing={isEditing}
        canSave={true}
      />
      <CardContent className="p-6">
        <div className="grid grid-cols-4 gap-6">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="condition-name" className="text-sm font-semibold text-gray-900">
                Substrate Condition Name
              </Label>
              <Input
                id="condition-name"
                value={condition.name || ''}
                onChange={handleNameChange}
                disabled={!isEditing}
                className="w-full"
                placeholder="Enter condition name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="version" className="text-sm font-semibold text-gray-900">
                Version
              </Label>
              <Input
                id="version"
                value={condition.version || ''}
                onChange={(e) => {
                  onConditionChange('version', e.target.value);
                  if (!isNew) {
                    setHasUnsavedChanges(true);
                    if (setInfoCardUnsavedChanges) setInfoCardUnsavedChanges(true);
                  }
                }}
                disabled={!isEditing}
                className="w-full"
                placeholder="e.g., V1, 2.0"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-pack-type"
                  checked={condition.use_pack_type || false}
                  onCheckedChange={(checked) => {
                    onConditionChange('use_pack_type', checked);
                    if (!checked) {
                      onPackTypeChange('');
                    }
                    if (!isNew) setHasUnsavedChanges(true);
                  }}
                  disabled={!isEditing}
                />
                <Label htmlFor="use-pack-type" className="text-sm font-semibold text-gray-900">
                  Pack Type
                </Label>
              </div>
              <Select 
                value={hasPackTypeOption ? (condition.pack_type || '') : ''} 
                onValueChange={handlePackTypeChange}
                disabled={!isEditing || !condition.use_pack_type}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={condition.pack_type || "Select pack type"} />
                </SelectTrigger>
                <SelectContent>
                  {packTypes.map((packType) => (
                    <SelectItem 
                      key={packType.id} 
                      value={packType.name}
                    >
                      {packType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Metallic Properties */}
            <div className="space-y-2 col-span-2">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="is-metallic" 
                    checked={condition?.is_metallic || false} 
                    onCheckedChange={(checked) => {
                      if (canEdit) {
                        onConditionChange('is_metallic', checked);
                        if (!isNew && setHasUnsavedChanges) {
                          setHasUnsavedChanges(true);
                          if (setInfoCardUnsavedChanges) setInfoCardUnsavedChanges(true);
                        }
                      }
                    }}
                    disabled={!isEditing}
                  />
                  <Label htmlFor="is-metallic" className="text-sm font-semibold text-gray-900">
                    Is Metallic
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="metallic-intensity" className="text-sm font-medium text-gray-600">
                    Intensity:
                  </Label>
                  <Select
                    value={condition?.metallic_intensity?.toString() || "100"}
                    onValueChange={(value) => {
                      if (canEdit) {
                        onConditionChange('metallic_intensity', parseInt(value));
                        if (!isNew && setHasUnsavedChanges) {
                          setHasUnsavedChanges(true);
                          if (setInfoCardUnsavedChanges) setInfoCardUnsavedChanges(true);
                        }
                      }
                    }}
                    disabled={!isEditing || !condition?.is_metallic}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue placeholder="100" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-[100] border shadow-lg">
                      {Array.from({ length: 101 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubstrateConditionInfo;