import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Controller } from 'react-hook-form';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import CardHeader from '@/components/admin/my-company/CardHeader';
import SubstrateSpecificationsCard from '@/components/substrates/SubstrateSpecificationsCard';

const SubstrateInfoTab = ({ register, control, errors, watch, setValue, isNew, substrate, onSubmitUpdate, onSubmitNew, onCancel, onValidationChange }) => {
  const { profile } = useProfile();
  const { canEdit } = useRoleAccess();
  
  const [substrateTypes, setSubstrateTypes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [surfaceQualities, setSurfaceQualities] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [loadingSurfaceQualities, setLoadingSurfaceQualities] = useState(false);
  
  // Track if this was initially new to keep card states independent after saves
  const [initialCreateMode] = useState(isNew);
  
  // Individual card edit states
  const [editingStates, setEditingStates] = useState({
    general: initialCreateMode,
    specifications: false,
    printability: false,
    notes: false
  });
  
  const [savingStates, setSavingStates] = useState({
    general: false,
    specifications: false,
    printability: false,
    notes: false
  });

  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState({
    general: {},
    printability: {},
    notes: {}
  });

  // Fetch substrate types
  const fetchSubstrateTypes = async () => {
    
    setLoadingTypes(true);
    try {
      const { data, error } = await supabase
        .from('substrate_types')
        .select('id, name, organization_id')
        .or(`organization_id.eq.${profile?.organization_id},organization_id.is.null`)
        .order('name');

      if (error) {
        console.error('❌ SubstrateInfoTab: Failed to fetch substrate types:', error);
        throw error;
      }

      // Deduplicate by name while preserving equivalent IDs
      const byName = new Map();
      const selectedId = watch('type');
      const orgId = profile?.organization_id;

      for (const type of data || []) {
        const key = (type.name || '').trim();
        const existing = byName.get(key);
        
        if (!existing) {
          byName.set(key, { ...type, equivalentIds: [type.id] });
        } else {
          const mergedEq = Array.from(new Set([...(existing.equivalentIds || []), type.id]));
          let keep = existing;
          if (type.id === selectedId) keep = { ...type, equivalentIds: mergedEq };
          else if (existing.id === selectedId) keep = { ...existing, equivalentIds: mergedEq };
          else if (existing.organization_id !== orgId && type.organization_id === orgId) keep = { ...type, equivalentIds: mergedEq };
          else keep = { ...existing, equivalentIds: mergedEq };
          byName.set(key, keep);
        }
      }
      
      const cleaned = Array.from(byName.values());
      
      setSubstrateTypes(cleaned);

      // Map selected ID if needed
      if (selectedId && !cleaned.some(t => t.id === selectedId)) {
        const match = cleaned.find(t => (t.equivalentIds || []).includes(selectedId));
        if (match) setValue('type', match.id, { shouldValidate: true, shouldDirty: false });
      }
    } catch (error) {
      console.error('❌ SubstrateInfoTab: Error in fetchSubstrateTypes:', error);
      toast({ title: 'Error', description: 'Failed to fetch substrate types.', variant: 'destructive' });
    } finally {
      setLoadingTypes(false);
      
    }
  };

  // Fetch materials based on substrate type
  const fetchMaterials = async (typeId) => {
    if (!typeId) {
      setMaterials([]);
      return;
    }
    
    console.log('🔍 SubstrateInfoTab: Starting fetchMaterials for type:', typeId);
    setLoadingMaterials(true);
    try {
      const typeObj = substrateTypes.find(t => t.id === typeId);
      const idsToTry = Array.from(new Set([typeId, ...((typeObj?.equivalentIds) || [])]));

      const { data, error } = await supabase
        .from('substrate_materials')
        .select('id, name')
        .in('substrate_type_id', idsToTry)
        .order('name');

      if (error) {
        console.error('❌ SubstrateInfoTab: Failed to fetch materials:', error);
        throw error;
      }
      console.log('✅ SubstrateInfoTab: Fetched materials:', data?.length);
      setMaterials(data || []);
    } catch (error) {
      console.error('❌ SubstrateInfoTab: Error in fetchMaterials:', error);
      toast({ title: 'Error', description: 'Failed to fetch materials.', variant: 'destructive' });
      setMaterials([]);
    } finally {
      setLoadingMaterials(false);
      console.log('🔍 SubstrateInfoTab: fetchMaterials completed');
    }
  };

  // Fetch surface qualities based on substrate type
  const fetchSurfaceQualities = async (typeId) => {
    if (!typeId) {
      setSurfaceQualities([]);
      return;
    }
    
    console.log('🔍 SubstrateInfoTab: Starting fetchSurfaceQualities for type:', typeId);
    setLoadingSurfaceQualities(true);
    try {
      const typeObj = substrateTypes.find(t => t.id === typeId);
      const idsToTry = Array.from(new Set([typeId, ...((typeObj?.equivalentIds) || [])]));

      const { data, error } = await supabase
        .from('substrate_surface_qualities')
        .select('id, name')
        .in('substrate_type_id', idsToTry)
        .order('name');

      if (error) {
        console.error('❌ SubstrateInfoTab: Failed to fetch surface qualities:', error);
        throw error;
      }

      // Deduplicate by name
      const byName = new Map();
      const selectedQualityId = watch('surface_quality');
      
      for (const quality of data || []) {
        const key = (quality.name || '').trim().toLowerCase();
        const existing = byName.get(key);
        
        if (!existing) {
          byName.set(key, quality);
        } else if (quality.id === selectedQualityId) {
          byName.set(key, quality);
        }
      }
      
      console.log('✅ SubstrateInfoTab: Fetched surface qualities:', Array.from(byName.values()).length);
      setSurfaceQualities(Array.from(byName.values()));
    } catch (error) {
      console.error('❌ SubstrateInfoTab: Error in fetchSurfaceQualities:', error);
      toast({ title: 'Error', description: 'Failed to fetch surface qualities.', variant: 'destructive' });
      setSurfaceQualities([]);
    } finally {
      setLoadingSurfaceQualities(false);
      console.log('🔍 SubstrateInfoTab: fetchSurfaceQualities completed');
    }
  };

  useEffect(() => {
    console.log('🔍 SubstrateInfoTab: useEffect triggered, profile available:', !!profile?.organization_id);
    if (profile?.organization_id) {
      fetchSubstrateTypes();
    } else {
      console.log('⏳ SubstrateInfoTab: Waiting for profile to be available...');
    }
  }, [profile?.organization_id]);

  const watchedType = watch('type');
  const watchedPrintingSide = watch('printing_side');
  const watchedName = watch('name');
  const watchedMaterial = watch('material');
  const watchedSurfaceQuality = watch('surface_quality');
  
  // Track validation state and notify parent
  useEffect(() => {
    const requiredFields = [watchedName, watchedType, watchedMaterial, watchedSurfaceQuality];
    const isValid = requiredFields.every(field => field && field.toString().trim() !== '');
    if (onValidationChange) {
      onValidationChange(isValid);
    }
  }, [watchedName, watchedType, watchedMaterial, watchedSurfaceQuality, onValidationChange]);
  
  useEffect(() => {
    if (watchedType) {
      console.log('🔍 SubstrateInfoTab: Type selected, fetching dependent data:', watchedType);
      // Fetch materials and surface qualities in parallel for better performance
      Promise.all([
        fetchMaterials(watchedType),
        fetchSurfaceQualities(watchedType)
      ]);
    } else {
      console.log('🔍 SubstrateInfoTab: No type selected, clearing dependent data');
      setMaterials([]);
      setSurfaceQualities([]);
    }
  }, [watchedType]);
  
  // Card-specific edit handlers
  const handleCardEdit = (cardName) => {
    setEditingStates(prev => ({ ...prev, [cardName]: true }));
    // Store original values when entering edit mode
    if (cardName === 'general') {
      setOriginalValues(prev => ({
        ...prev,
        general: {
          name: watch('name'),
          type: watch('type'),
          material: watch('material'),
          surface_quality: watch('surface_quality'),
          printing_side: watch('printing_side'),
          use_white_ink: watch('use_white_ink')
        }
      }));
    } else if (cardName === 'printability') {
      setOriginalValues(prev => ({
        ...prev,
        printability: {
          contrast: watch('contrast'),
          ink_adhesion: watch('ink_adhesion')
        }
      }));
    } else if (cardName === 'notes') {
      setOriginalValues(prev => ({
        ...prev,
        notes: {
          notes: watch('notes')
        }
      }));
    }
  };
  
  const handleCardCancel = (cardName) => {
    setEditingStates(prev => ({ ...prev, [cardName]: false }));
    // Reset form fields to original values would go here
  };
  
  const handleCardSave = async (cardName, fieldsToSave) => {
    setSavingStates(prev => ({ ...prev, [cardName]: true }));
    try {
      // Get current form values for the specific fields
      const currentValues = watch();
      const updateData = {};
      fieldsToSave.forEach(field => {
        updateData[field] = currentValues[field];
      });
      
      if (isNew) {
        // For new substrates, call onSubmitNew with a flag to prevent tab navigation
        await onSubmitNew(currentValues, { preventTabNavigation: true });
        // Only reset editing state after successful save
        setEditingStates(prev => ({ ...prev, [cardName]: false }));
      } else {
        // Update only the specific fields
        const { error } = await supabase
          .from('substrates')
          .update({
            ...updateData,
            organization_id: profile.organization_id,
            last_modified_by: profile.id,
          })
          .eq('id', substrate.id);
          
        if (error) throw error;
        
        // Only reset editing state after successful save
        setEditingStates(prev => ({ ...prev, [cardName]: false }));
        
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to save changes. ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setSavingStates(prev => ({ ...prev, [cardName]: false }));
    }
  };

  // Check if values have changed for each card
  const generalHasChanges = useMemo(() => {
    if (isNew) return true;
    if (!editingStates.general) return false;
    const orig = originalValues.general;
    return (
      watch('name') !== orig.name ||
      watch('type') !== orig.type ||
      watch('material') !== orig.material ||
      watch('surface_quality') !== orig.surface_quality ||
      watch('printing_side') !== orig.printing_side ||
      watch('use_white_ink') !== orig.use_white_ink
    );
  }, [isNew, editingStates.general, originalValues.general, watch('name'), watch('type'), watch('material'), watch('surface_quality'), watch('printing_side'), watch('use_white_ink')]);

  const printabilityHasChanges = useMemo(() => {
    if (isNew) return true;
    if (!editingStates.printability) return false;
    const orig = originalValues.printability;
    return (
      watch('contrast') !== orig.contrast ||
      watch('ink_adhesion') !== orig.ink_adhesion
    );
  }, [isNew, editingStates.printability, originalValues.printability, watch('contrast'), watch('ink_adhesion')]);

  const notesHasChanges = useMemo(() => {
    if (isNew) return true;
    if (!editingStates.notes) return false;
    const orig = originalValues.notes;
    return watch('notes') !== orig.notes;
  }, [isNew, editingStates.notes, originalValues.notes, watch('notes')]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* General Info Panel */}
          <Card className="border-2 border-primary/20">
        <CardHeader 
          title="Substrate Settings"
          onEdit={() => handleCardEdit('general')}
          onSave={() => handleCardSave('general', ['name', 'type', 'material', 'surface_quality', 'printing_side', 'use_white_ink'])}
          onCancel={() => handleCardCancel('general')}
          showEdit={!isNew && canEdit}
          showLearn={false}
          isEditing={editingStates.general}
          saving={savingStates.general}
          canSave={isNew || (generalHasChanges && watchedName?.trim() && watchedType && watchedMaterial && watchedSurfaceQuality)}
        />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name
                {!watchedName?.trim() && (
                  <span className="text-sm text-red-500 ml-1">(required)</span>
                )}
              </Label>
              <Input
                id="name"
                {...register('name', { required: 'Name is required' })}
                placeholder="Enter substrate name"
                className={errors.name ? 'border-red-500' : ''}
                disabled={!editingStates.general}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">
                Type
                {!watchedType && (
                  <span className="text-sm text-red-500 ml-1">(required)</span>
                )}
              </Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={!editingStates.general}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingTypes ? "Loading..." : "Select substrate type"} />
                    </SelectTrigger>
                    <SelectContent>
                      {substrateTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="material">
                Material
                {!watchedMaterial && (
                  <span className="text-sm text-red-500 ml-1">(required)</span>
                )}
              </Label>
              <Controller
                name="material"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={!editingStates.general}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingMaterials ? "Loading..." : "Select material"} />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          {material.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="surface_quality">
                Surface Quality
                {!watchedSurfaceQuality && (
                  <span className="text-sm text-red-500 ml-1">(required)</span>
                )}
              </Label>
              <Controller
                name="surface_quality"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={!editingStates.general}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingSurfaceQualities ? "Loading..." : "Select surface quality"} />
                    </SelectTrigger>
                    <SelectContent>
                      {surfaceQualities.map((quality) => (
                        <SelectItem key={quality.id} value={quality.id}>
                          {quality.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-4 mt-6">
            <div className="space-y-3">
              <Label>Print Side</Label>
              <div className="flex items-center gap-8">
                <Controller
                  name="printing_side"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex space-x-6"
                      disabled={!editingStates.general}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="surface" id="surface" disabled={!editingStates.general} />
                        <Label htmlFor="surface">Surface</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="reverse" id="reverse" disabled={!editingStates.general} />
                        <Label htmlFor="reverse">Reverse</Label>
                      </div>
                    </RadioGroup>
                  )}
                />

                <div className="flex items-center space-x-2">
                  <Controller
                    name="use_white_ink"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="use_white_ink"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!editingStates.general}
                      />
                    )}
                  />
                  <Label htmlFor="use_white_ink" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Use white ink
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>



        {/* Printability Panel */}
        <Card>
          <CardHeader 
            title="Printability"
            onEdit={() => handleCardEdit('printability')}
            onSave={() => handleCardSave('printability', ['contrast', 'ink_adhesion'])}
            onCancel={() => handleCardCancel('printability')}
            showEdit={!isNew && canEdit}
            showLearn={false}
            isEditing={editingStates.printability}
            saving={savingStates.printability}
            canSave={isNew || printabilityHasChanges}
          />
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="contrast">Contrast</Label>
                <Controller
                  name="contrast"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || 'medium'} disabled={!editingStates.printability}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select contrast level" />
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
                <Label htmlFor="ink_adhesion">Adhesion (%)</Label>
                <Controller
                  name="ink_adhesion"
                  control={control}
                  defaultValue={100}
                  render={({ field }) => (
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      value={field.value?.toString() || '100'}
                      disabled={!editingStates.printability}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select ink adhesion" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">100% (default)</SelectItem>
                        <SelectItem value="90">90%</SelectItem>
                        <SelectItem value="80">80%</SelectItem>
                        <SelectItem value="70">70%</SelectItem>
                        <SelectItem value="60">&lt;70%</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.ink_adhesion && <p className="text-sm text-red-500">{errors.ink_adhesion.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Specifications Panel */}
        <SubstrateSpecificationsCard 
          register={register} 
          control={control}
          isNew={isNew}
          canEdit={canEdit}
          substrate={substrate}
          profile={profile}
          toast={toast}
          watch={watch}
        />

        {/* Notes Panel */}
        <Card>
          <CardHeader 
            title="Notes"
            onEdit={() => handleCardEdit('notes')}
            onSave={() => handleCardSave('notes', ['notes'])}
            onCancel={() => handleCardCancel('notes')}
            showEdit={!isNew && canEdit}
            showLearn={false}
            isEditing={editingStates.notes}
            saving={savingStates.notes}
            canSave={isNew || notesHasChanges}
          />
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Enter any additional notes about this substrate"
                rows={4}
                disabled={!editingStates.notes}
              />
            </div>
        </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubstrateInfoTab;