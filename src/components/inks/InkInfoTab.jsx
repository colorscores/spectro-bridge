import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Controller } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import InkSpecificationsCard from './InkSpecificationsCard';
import CardHeader from '@/components/admin/my-company/CardHeader';

const InkInfoTab = ({ register, control, errors, watch, setValue, inkBooks, disabled = false, isNew = false, onSave }) => {
  const [inkTypes, setInkTypes] = useState([]);
  const [editingSettings, setEditingSettings] = useState(isNew);
  const [editingAppearance, setEditingAppearance] = useState(isNew);
  const [editingSpecifications, setEditingSpecifications] = useState(isNew);
  const [originalSettingsValues, setOriginalSettingsValues] = useState({});
  const [originalAppearanceValues, setOriginalAppearanceValues] = useState({});
  const appearanceType = watch('appearance_type') || 'standard';

  const getInkTypeValue = (it) => (it?.value ?? it?.name ?? (it?.id != null ? String(it.id) : ''));


  // Watch form values for change detection
  const watchedValues = watch();

  const isEmpty = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

  // Helper function to check if required fields are filled
  const areRequiredFieldsFilled = () => {
    return !isEmpty(watchedValues.name) && !isEmpty(watchedValues.print_process) && !isEmpty(watchedValues.ink_type);
  };

  // Initialize original values when component loads with existing data
  useEffect(() => {
    if (watchedValues.name || watchedValues.print_process || watchedValues.ink_type) {
      setOriginalSettingsValues({
        name: watchedValues.name,
        print_process: watchedValues.print_process,
        ink_type: watchedValues.ink_type,
        curve: watchedValues.curve,
      });
      setOriginalAppearanceValues({
        appearance_type: watchedValues.appearance_type,
        opacity_left: watchedValues.opacity_left,
        metallic_gloss: watchedValues.metallic_gloss,
      });
    }
  }, []);

  // Helper function to check if settings have changed
  const hasSettingsChanged = () => {
    if (!editingSettings) return false;
    const currentSettings = {
      name: watchedValues.name,
      print_process: watchedValues.print_process,
      ink_type: watchedValues.ink_type,
      curve: watchedValues.curve,
    };
    return JSON.stringify(currentSettings) !== JSON.stringify(originalSettingsValues);
  };

  // Helper function to check if appearance has changed
  const hasAppearanceChanged = () => {
    if (!editingAppearance) return false;
    const currentAppearance = {
      appearance_type: watchedValues.appearance_type,
      opacity_left: watchedValues.opacity_left,
      metallic_gloss: watchedValues.metallic_gloss,
    };
    return JSON.stringify(currentAppearance) !== JSON.stringify(originalAppearanceValues);
  };

  // Handle settings edit mode
  const handleEditSettings = () => {
    setOriginalSettingsValues({
      name: watchedValues.name,
      print_process: watchedValues.print_process,
      ink_type: watchedValues.ink_type,
      curve: watchedValues.curve,
    });
    setEditingSettings(true);
  };

  const handleSaveSettings = async () => {
    if (onSave) {
      const success = await onSave();
      if (success !== false) { // Consider anything except explicit false as success
        // Update original values after successful save
        setOriginalSettingsValues({
          name: watchedValues.name,
          print_process: watchedValues.print_process,
          ink_type: watchedValues.ink_type,
          curve: watchedValues.curve,
        });
        setEditingSettings(false);
      }
    } else {
      setEditingSettings(false);
    }
  };

  const handleCancelSettings = () => {
    // Only restore values if they exist
    if (originalSettingsValues.name !== undefined) setValue('name', originalSettingsValues.name);
    if (originalSettingsValues.print_process !== undefined) setValue('print_process', originalSettingsValues.print_process);
    if (originalSettingsValues.ink_type !== undefined) setValue('ink_type', originalSettingsValues.ink_type);
    if (originalSettingsValues.curve !== undefined) setValue('curve', originalSettingsValues.curve);
    setEditingSettings(false);
  };

  // Handle appearance edit mode
  const handleEditAppearance = () => {
    setOriginalAppearanceValues({
      appearance_type: watchedValues.appearance_type,
      opacity_left: watchedValues.opacity_left,
      metallic_gloss: watchedValues.metallic_gloss,
    });
    setEditingAppearance(true);
  };

  const handleSaveAppearance = async () => {
    if (onSave) {
      const success = await onSave();
      if (success !== false) { // Consider anything except explicit false as success
        // Update original values after successful save
        setOriginalAppearanceValues({
          appearance_type: watchedValues.appearance_type,
          opacity_left: watchedValues.opacity_left,
          metallic_gloss: watchedValues.metallic_gloss,
        });
        setEditingAppearance(false);
      }
    } else {
      setEditingAppearance(false);
    }
  };

  const handleCancelAppearance = () => {
    // Only restore values if they exist
    if (originalAppearanceValues.appearance_type !== undefined) setValue('appearance_type', originalAppearanceValues.appearance_type);
    if (originalAppearanceValues.opacity_left !== undefined) setValue('opacity_left', originalAppearanceValues.opacity_left);
    if (originalAppearanceValues.metallic_gloss !== undefined) setValue('metallic_gloss', originalAppearanceValues.metallic_gloss);
    setEditingAppearance(false);
  };

  // Fetch ink types from database
  useEffect(() => {
    const fetchInkTypes = async () => {
      try {
        const { data, error } = await supabase
          .from('ink_types')
          .select('*')
          .order('name');
        
        if (error) {
          console.error('Error fetching ink types:', error);
          // Fallback static options if DB fetch fails
          setInkTypes([
            { id: 'solvent-based', name: 'Solvent-based', value: 'solvent-based' },
            { id: 'water-based', name: 'Water-based', value: 'water-based' },
            { id: 'uv-curable', name: 'UV Curable', value: 'uv-curable' },
            { id: 'led-uv', name: 'LED UV', value: 'led-uv' },
            { id: 'conventional', name: 'Conventional', value: 'conventional' }
          ]);
        } else {
          const list = data || [];
          // Normalize values to match stored format (lowercase with hyphens)
          const normalizedList = list.map(type => ({
            ...type,
            value: type.value || type.name?.toLowerCase().replace(/\s+/g, '-') || type.id
          }));
          setInkTypes(normalizedList);
        }
      } catch (error) {
        console.error('Error fetching ink types:', error);
        // Fallback static options
        setInkTypes([
          { id: 'solvent-based', name: 'Solvent-based', value: 'solvent-based' },
          { id: 'water-based', name: 'Water-based', value: 'water-based' },
          { id: 'uv-curable', name: 'UV Curable', value: 'uv-curable' },
          { id: 'led-uv', name: 'LED UV', value: 'led-uv' },
          { id: 'conventional', name: 'Conventional', value: 'conventional' }
        ]);
      }
    };

    fetchInkTypes();
  }, []);

  // Handle preserving current ink_type value if it's not in the options
  useEffect(() => {
    const current = watchedValues.ink_type;
    if (current && inkTypes.length > 0) {
      const optionValues = inkTypes.map(getInkTypeValue).filter(Boolean);
      if (!optionValues.includes(current) && current !== 'spot') {
        console.log('Adding custom ink type for existing value:', current);
        setInkTypes(prev => [{ id: 'custom', name: current, value: current }, ...prev]);
      }
    }
  }, [watchedValues.ink_type, inkTypes]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
      {/* Ink Settings Card */}
      <Card>
        <CardHeader 
          title="Ink Settings"
          subtitle="Configure basic ink information and properties"
          showEdit={!isNew}
          onEdit={handleEditSettings}
          onSave={handleSaveSettings}
          onCancel={handleCancelSettings}
          isEditing={editingSettings}
          canSave={hasSettingsChanged()}
          saving={false}
          showLearn={false}
        />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="name">
                Ink Name
                {isEmpty(watchedValues.name) && <span className="text-red-500 ml-1">(required)</span>}
              </Label>
              <Input
                id="name"
                {...register('name', { required: 'Ink name is required' })}
                placeholder="Enter ink name"
                disabled={!editingSettings}
              />
            </div>

            <div>
              <Label htmlFor="print_process">
                Print Process
                {isEmpty(watchedValues.print_process) && <span className="text-red-500 ml-1">(required)</span>}
              </Label>
              <Controller
                name="print_process"
                control={control}
                rules={{ required: 'Print process is required' }}
                render={({ field }) => (
                  !editingSettings ? (
                    <Input
                      value={field.value || ''}
                      disabled={true}
                      className="bg-muted text-muted-foreground"
                      placeholder="—"
                    />
                  ) : (
                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={!editingSettings}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select print process" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border shadow-lg z-[9999]">
                        <SelectItem value="Offset">Offset</SelectItem>
                        <SelectItem value="Flexo">Flexo</SelectItem>
                        <SelectItem value="Gravure">Gravure</SelectItem>
                        <SelectItem value="Digital">Digital</SelectItem>
                      </SelectContent>
                    </Select>
                  )
                )}
              />
            </div>

            <div>
              <Label htmlFor="ink_type">
                Ink Type
                {isEmpty(watchedValues.ink_type) && <span className="text-red-500 ml-1">(required)</span>}
              </Label>
              <Controller
                name="ink_type"
                control={control}
                rules={{ required: 'Ink type is required' }}
                render={({ field }) => (
                  !editingSettings ? (
                    <Input
                      value={(inkTypes.find((inkType) => getInkTypeValue(inkType) === (field.value || ''))?.name) || field.value || ''}
                      disabled={true}
                      className="bg-muted text-muted-foreground"
                      placeholder="—"
                    />
                  ) : (
                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={!editingSettings}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select ink type" />
                      </SelectTrigger>
                       <SelectContent className="bg-white border shadow-lg z-[9999]">
                         {inkTypes.map((inkType) => (
                           <SelectItem key={inkType.id ?? getInkTypeValue(inkType)} value={getInkTypeValue(inkType)}>
                             {inkType.name ?? inkType.value ?? inkType.id}
                           </SelectItem>
                         ))}
                       </SelectContent>
                    </Select>
                   )
                )}
              />
              {errors?.ink_type && <p className="text-sm text-red-500 mt-1">{errors.ink_type.message}</p>}
            </div>

            <div>
              <Label htmlFor="curve">Curve</Label>
              <Controller
                name="curve"
                control={control}
                render={({ field }) => (
                  !editingSettings ? (
                    <Input
                      value={field.value === 'as_measured' || !field.value ? 'As Measured' : field.value}
                      disabled={true}
                      className="bg-muted text-muted-foreground"
                      placeholder="—"
                    />
                  ) : (
                    <Select onValueChange={field.onChange} value={field.value || 'as_measured'} disabled={!editingSettings}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select curve" />
                      </SelectTrigger>
                       <SelectContent className="bg-white border shadow-lg z-[9999]">
                         <SelectItem value="as_measured">As Measured</SelectItem>
                       </SelectContent>
                    </Select>
                  )
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance Card */}
      <Card>
        <CardHeader 
          title="Appearance"
          subtitle="Configure ink appearance properties and visual characteristics"
          showEdit={!isNew}
          onEdit={handleEditAppearance}
          onSave={handleSaveAppearance}
          onCancel={handleCancelAppearance}
          isEditing={editingAppearance}
          canSave={hasAppearanceChanged()}
          saving={false}
          showLearn={false}
        />
        <CardContent>
          <Controller
            name="appearance_type"
            control={control}
            defaultValue="standard"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  // Reset related fields when changing appearance type
                  if (value !== 'opaque') {
                    setValue('opacity_left', undefined);
                  }
                  if (value !== 'metallic') {
                    setValue('metallic_gloss', undefined);
                  }
                }}
                className="flex flex-row gap-8 items-center flex-wrap"
                disabled={!editingAppearance}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="standard" id="standard" />
                  <Label htmlFor="standard" className="cursor-pointer">Standard Ink</Label>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="opaque" id="opaque" />
                    <Label htmlFor="opaque" className="cursor-pointer">Opaque Ink</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="opacity_left" className="text-sm whitespace-nowrap">Opacity Level (%):</Label>
                    <Input
                      id="opacity_left"
                      type="number"
                      min="0"
                      max="100"
                      className="w-20"
                      disabled={!editingAppearance || appearanceType !== 'opaque'}
                      {...register('opacity_left', {
                        valueAsNumber: true,
                        min: { value: 0, message: 'Value must be between 0 and 100' },
                        max: { value: 100, message: 'Value must be between 0 and 100' }
                      })}
                      placeholder="50"
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="metallic" id="metallic" />
                    <Label htmlFor="metallic" className="cursor-pointer">Metallic Ink</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="metallic_gloss" className="text-sm whitespace-nowrap">Metallic Gloss (%):</Label>
                    <Input
                      id="metallic_gloss"
                      type="number"
                      min="0"
                      max="100"
                      className="w-20"
                      disabled={!editingAppearance || appearanceType !== 'metallic'}
                      {...register('metallic_gloss', {
                        valueAsNumber: true,
                        min: { value: 0, message: 'Value must be between 0 and 100' },
                        max: { value: 100, message: 'Value must be between 0 and 100' }
                      })}
                      placeholder="50"
                    />
                  </div>
                </div>
              </RadioGroup>
            )}
          />
          {errors.opacity_left && <p className="text-sm text-red-500 mt-1">{errors.opacity_left.message}</p>}
          {errors.metallic_gloss && <p className="text-sm text-red-500 mt-1">{errors.metallic_gloss.message}</p>}
        </CardContent>
      </Card>

      <InkSpecificationsCard 
        register={register} 
        disabled={false}
        isNew={isNew}
        isEditing={editingSpecifications}
        onEdit={() => setEditingSpecifications(true)}
        onSave={() => setEditingSpecifications(false)}
        onCancel={() => setEditingSpecifications(false)}
        watch={watch}
      />

      {/* Hidden field for ink book to maintain compatibility */}
      <div className="hidden">
        <Controller
          name="book_id"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Select ink book" />
              </SelectTrigger>
              <SelectContent>
                {inkBooks.map((book) => (
                  <SelectItem key={book.id} value={book.id}>
                    {book.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InkInfoTab;