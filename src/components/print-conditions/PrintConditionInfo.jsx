import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, Edit2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import CardHeader from '@/components/admin/my-company/CardHeader';

const PrintConditionInfo = ({ 
  condition, 
  onNameChange, 
  onFileChange, 
  onConditionChange, 
  canEdit, 
  setHasUnsavedChanges, 
  isNew,
  onPackTypeChange,
  onPrintProcessChange,
  isEditing = false,
  onInfoEdit,
  onInfoSave,
  onInfoCancel,
  hasChanges = false,
  saving = false
}) => {
  const { toast } = useToast();
  const [packTypes, setPackTypes] = useState([]);
  const [printProcesses, setPrintProcesses] = useState([]);
  const [substrateTypes, setSubstrateTypes] = useState([]);
  const [substrateMaterials, setSubstrateMaterials] = useState([]);
  const [originalCondition, setOriginalCondition] = useState(null);

  // Keep a snapshot when entering edit mode to detect changes and allow cancel
  useEffect(() => {
    if (isEditing && !originalCondition) {
      setOriginalCondition({ ...condition });
    }
    if (!isEditing) {
      setOriginalCondition(null);
    }
  }, [isEditing]);

  useEffect(() => {
    fetchPackTypes();
    fetchPrintProcesses();
    fetchSubstrateTypes();
    fetchSubstrateMaterials();
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

  const fetchPrintProcesses = async () => {
    try {
      const { data, error } = await supabase
        .from('print_processes')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setPrintProcesses(data);
    } catch (error) {
      console.error('Error fetching print processes:', error);
    }
  };

  const fetchSubstrateTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('substrate_types')
        .select('id, name')
        .order('name');
      if (error) throw error;
      setSubstrateTypes(data || []);
    } catch (error) {
      console.error('Error fetching substrate types:', error);
    }
  };
  const fetchSubstrateMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('substrate_materials')
        .select('id, name, substrate_type_id')
        .order('name');
      if (error) throw error;
      setSubstrateMaterials(data || []);
    } catch (error) {
      console.error('Error fetching substrate materials:', error);
    }
  };

  const handlePackTypeChange = (value) => {
    // Always pass object values to onConditionChange to prevent function accumulation
    if (onPackTypeChange) {
      onPackTypeChange(value);
    } else if (onConditionChange) {
      onConditionChange(prev => {
        const currentCondition = typeof prev === 'function' ? {} : prev;
        return { 
          ...currentCondition, 
          pack_type: value,
          // Preserve existing data
          spectral_data: currentCondition.spectral_data,
          lab: currentCondition.lab,
          ch: currentCondition.ch,
          color_hex: currentCondition.color_hex
        };
      });
    }
    if (!isNew) setHasUnsavedChanges(true);
  };

  const handlePrintProcessChange = (value) => {
    // Always pass object values to onConditionChange to prevent function accumulation
    if (onPrintProcessChange) {
      onPrintProcessChange(value);
    } else if (onConditionChange) {
      onConditionChange(prev => {
        const currentCondition = typeof prev === 'function' ? {} : prev;
        return { 
          ...currentCondition, 
          print_process: value,
          // Preserve existing data
          spectral_data: currentCondition.spectral_data,
          lab: currentCondition.lab,
          ch: currentCondition.ch,
          color_hex: currentCondition.color_hex
        };
      });
    }
    if (!isNew) setHasUnsavedChanges(true);
  };

  const handleSubstrateTypeChange = (value) => {
    onConditionChange(prev => {
      // Ensure prev is always an object, not a function
      const currentCondition = typeof prev === 'function' ? {} : prev;
      return { 
        ...currentCondition, 
        substrate_type_id: value, 
        substrate_material_id: null,
        // Preserve existing data
        spectral_data: currentCondition.spectral_data,
        lab: currentCondition.lab,
        ch: currentCondition.ch,
        color_hex: currentCondition.color_hex
      };
    });
    if (!isNew) setHasUnsavedChanges(true);
  };

  const handleMaterialTypeChange = (value) => {
    onConditionChange(prev => {
      // Ensure prev is always an object, not a function
      const currentCondition = typeof prev === 'function' ? {} : prev;
      return { 
        ...currentCondition, 
        substrate_material_id: value,
        // Preserve existing data
        spectral_data: currentCondition.spectral_data,
        lab: currentCondition.lab,
        ch: currentCondition.ch,
        color_hex: currentCondition.color_hex
      };
    });
    if (!isNew) setHasUnsavedChanges(true);
  };

  const handlePrintSideChange = (value) => {
    onConditionChange(prev => {
      // Ensure prev is always an object, not a function
      const currentCondition = typeof prev === 'function' ? {} : prev;
      return { 
        ...currentCondition, 
        printing_side: value,
        // Preserve existing data
        spectral_data: currentCondition.spectral_data,
        lab: currentCondition.lab,
        ch: currentCondition.ch,
        color_hex: currentCondition.color_hex
      };
    });
    if (!isNew) setHasUnsavedChanges(true);
  };

  const handleNameChange = (e) => {
    onNameChange(e);
    if (!isNew) setHasUnsavedChanges(true);
  };

    const isNameMissing = !condition?.name || condition.name.trim() === '';
    const isPrintSideMissing = !condition?.printing_side || (typeof condition.printing_side === 'string' && condition.printing_side.trim() === '');

    const localCanEdit = isNew ? canEdit : (canEdit && isEditing);

    const localHasChanges = originalCondition && (
      originalCondition.name !== condition?.name ||
      originalCondition.version !== condition?.version ||
      originalCondition.pack_type !== condition?.pack_type ||
      originalCondition.print_process !== condition?.print_process ||
      originalCondition.substrate_type_id !== condition?.substrate_type_id ||
      originalCondition.substrate_material_id !== condition?.substrate_material_id ||
      originalCondition.printing_side !== condition?.printing_side ||
      JSON.stringify(originalCondition.spectral_data) !== JSON.stringify(condition?.spectral_data) ||
      JSON.stringify(originalCondition.measurement_settings) !== JSON.stringify(condition?.measurement_settings)
    );

    return (
        <Card>
            <CardHeader
              title="Print Condition Settings"
              showEdit={!isNew}
              showLearn={false}
              isEditing={isEditing}
              canSave={isNew || localHasChanges || hasChanges}
              saving={saving}
              onEdit={onInfoEdit}
              onSave={onInfoSave}
              onCancel={onInfoCancel}
            />
            <CardContent className="p-4">
        <div className="space-y-6">
          {/* Row 1: Name (6), Version (2 = 1/3 of Name), Print Process (4) */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-6 space-y-2">
              <Label htmlFor="condition-name" className="text-sm font-semibold text-gray-900">
                Print Condition Name {isNameMissing && <span className="text-red-500">(required)</span>}
              </Label>
              <Input
                id="condition-name"
                value={condition.name || ''}
                onChange={handleNameChange}
                disabled={!localCanEdit}
                className="w-full"
                placeholder="Enter condition name"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="version" className="text-sm font-semibold text-gray-900">
                Version
              </Label>
              <Input
                id="version"
                value={condition.version || ''}
                onChange={(e) => {
                  onConditionChange(prev => ({ ...prev, version: e.target.value }));
                  if (!isNew) setHasUnsavedChanges(true);
                }}
                disabled={!localCanEdit}
                className="w-full"
                placeholder="e.g., V1, 2.0"
              />
            </div>

            <div className="col-span-4 space-y-2">
              <Label htmlFor="print-process" className="text-sm font-semibold text-gray-900">
                Print Process
              </Label>
              <Select 
                value={condition.print_process || ''} 
                onValueChange={handlePrintProcessChange}
                disabled={!localCanEdit}
              >
                <SelectTrigger id="print-process" className="w-full">
                  <SelectValue placeholder="Select print process" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[100] border shadow-lg">
                  {printProcesses.map((process) => (
                    <SelectItem key={process.id} value={process.name}>
                      {process.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Substrate Type, Material Type, Print Side, Pack Type */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-3 space-y-2">
              <Label htmlFor="substrate-type" className="text-sm font-semibold text-gray-900">
                Substrate Type
              </Label>
              <Select
                value={condition.substrate_type_id || ''}
                onValueChange={handleSubstrateTypeChange}
                disabled={!localCanEdit}
              >
                <SelectTrigger id="substrate-type" className="w-full">
                  <SelectValue placeholder="Select substrate type" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[100] border shadow-lg">
                  {substrateTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-3 space-y-2">
              <Label htmlFor="material-type" className="text-sm font-semibold text-gray-900">
                Material Type
              </Label>
              <Select
                value={condition.substrate_material_id || ''}
                onValueChange={handleMaterialTypeChange}
                disabled={!localCanEdit || !condition.substrate_type_id}
              >
                <SelectTrigger id="material-type" className="w-full">
                  <SelectValue placeholder="Select material type" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[100] border shadow-lg">
                  {substrateMaterials
                    .filter((m) => m.substrate_type_id === condition.substrate_type_id)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-3 space-y-2">
              <Label htmlFor="printing-side" className="text-sm font-semibold text-gray-900">
                Print Side {isPrintSideMissing && <span className="text-red-500">(required)</span>}
              </Label>
              <Select 
                value={condition.printing_side || ''} 
                onValueChange={handlePrintSideChange}
                disabled={!localCanEdit}
              >
                <SelectTrigger id="printing-side" className="w-full">
                  <SelectValue placeholder="Select print side" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[100] border shadow-lg">
                  <SelectItem value="Surface">Surface</SelectItem>
                  <SelectItem value="Reverse">Reverse</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-3 space-y-2">
              <Label htmlFor="pack-type" className="text-sm font-semibold text-gray-900">
                Pack Type
              </Label>
              <Select 
                value={condition.pack_type || ''} 
                onValueChange={handlePackTypeChange}
                disabled={!localCanEdit}
              >
                <SelectTrigger id="pack-type" className="w-full">
                  <SelectValue placeholder="Select pack type" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[100] border shadow-lg">
                  {packTypes.map((packType) => (
                    <SelectItem key={packType.id} value={packType.name}>
                      {packType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrintConditionInfo;