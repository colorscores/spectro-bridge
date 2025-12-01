import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import SubstrateInfoTab from './info-tab/SubstrateInfoTab';
import { useProfile } from '@/context/ProfileContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const SubstrateInfoFormWrapper = ({ 
  register, 
  control, 
  errors, 
  watch, 
  setValue,
  onDataChange,
  onSubstrateSaved,
  hideThumbnail = false 
}) => {
  const { profile } = useProfile();
  
  const [isValidating, setIsValidating] = useState(false);

  // Create a mock substrate object that SubstrateInfoTab expects
  const mockSubstrate = null; // Since this is for new substrate creation

  // Handle validation state changes
  const handleValidationChange = (isValid) => {
    // Notify parent of validation state if needed
    if (onDataChange) {
      const currentValues = watch();
      onDataChange({
        name: currentValues.name,
        type: currentValues.type,
        isValid
      });
    }
  };

  // Real substrate update handler for existing substrates
  const handleSubmitUpdate = async (formData, options = {}) => {
    try {
      // Find the substrate ID from watch() values or formData
      const currentValues = watch();
      const substrateId = options.substrateId || currentValues.id || formData.id;
      
      if (!substrateId) {
        throw new Error('No substrate ID found for update');
      }

      const submissionData = {
        ...formData,
        last_modified_by: profile.id,
        updated_at: new Date().toISOString()
      };

      // Sanitize numeric fields - convert NaN or empty strings to null
      const numericFields = ['weight', 'thickness'];
      numericFields.forEach(field => {
        if (submissionData[field] === '' || submissionData[field] === undefined || 
            submissionData[field] === null || isNaN(submissionData[field])) {
          submissionData[field] = null;
        } else if (typeof submissionData[field] === 'string') {
          const parsed = parseFloat(submissionData[field]);
          submissionData[field] = isNaN(parsed) ? null : parsed;
        }
      });

      // Handle ink_adhesion separately - strip % and apply default
      if (submissionData.ink_adhesion === '' || submissionData.ink_adhesion === null || submissionData.ink_adhesion === undefined) {
        submissionData.ink_adhesion = 100; // Default value
      } else if (typeof submissionData.ink_adhesion === 'string') {
        // Strip % and parse
        const cleaned = submissionData.ink_adhesion.replace('%', '').trim();
        if (cleaned === '<70') {
          submissionData.ink_adhesion = 69;
        } else if (!isNaN(cleaned)) {
          submissionData.ink_adhesion = parseFloat(cleaned);
        } else {
          submissionData.ink_adhesion = 100; // Default if invalid
        }
      } else if (!isNaN(submissionData.ink_adhesion)) {
        submissionData.ink_adhesion = parseFloat(submissionData.ink_adhesion);
      } else {
        submissionData.ink_adhesion = 100; // Default
      }

      // Remove deprecated logic for metallic_intensity
      // metallic_intensity column doesn't exist in substrates table

      // Normalize printing_side capitalization
      if (submissionData.printing_side) {
        submissionData.printing_side = submissionData.printing_side.charAt(0).toUpperCase() + 
          submissionData.printing_side.slice(1).toLowerCase();
      }

      const fieldsToNullify = ['type', 'material', 'surface_quality'];
      fieldsToNullify.forEach(field => {
        if (submissionData[field] === '' || submissionData[field] === undefined || submissionData[field] === null) {
          submissionData[field] = null;
        }
      });

      // Handle contrast separately - apply default
      if (submissionData.contrast === '' || submissionData.contrast === null || submissionData.contrast === undefined) {
        submissionData.contrast = 'medium'; // Default value
      }

      // Remove deprecated columns
      delete submissionData.color;
      delete submissionData.finish;
      delete submissionData.metallic_intensity;

      // Remove fields that shouldn't be updated
      delete submissionData.id;
      delete submissionData.organization_id;
      delete submissionData.created_at;

      const { data, error } = await supabase
        .from('substrates')
        .update(submissionData)
        .eq('id', substrateId)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success!',
        description: 'Substrate updated successfully.',
      });

      // Notify parent component of successful substrate update
      if (onSubstrateSaved && data) {
        onSubstrateSaved(data);
      }

      return data;
    } catch (error) {
      console.error('Error updating substrate:', error);
      toast({
        title: 'Error',
        description: `Failed to update substrate. ${error.message}`,
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Real substrate creation handler - only for truly new substrates
  const handleSubmitNew = async (formData, options = {}) => {
    console.log('🔍 SubstrateInfoFormWrapper.handleSubmitNew - Initial checks:', {
      profile: profile ? { id: profile.id, organization_id: profile.organization_id } : null
    });

    if (!profile || !profile.organization_id) {
      console.error('🚫 SubstrateInfoFormWrapper.handleSubmitNew - Authentication/org issue:', profile);
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in with a valid organization to perform this action.',
        variant: 'destructive',
      });
      return;
    }
    try {
      console.log('🔍 SubstrateInfoFormWrapper.handleSubmitNew - Profile check:', {
        profile: profile ? { id: profile.id, organization_id: profile.organization_id } : null
      });

      const submissionData = {
        ...formData,
        organization_id: profile.organization_id,
        last_modified_by: profile.id,
      };

      console.log('🔍 SubstrateInfoFormWrapper.handleSubmitNew - Submission data:', {
        organization_id: submissionData.organization_id,
        last_modified_by: submissionData.last_modified_by,
        name: submissionData.name
      });

      // Sanitize numeric fields - convert NaN or empty strings to null
      const numericFields = ['weight', 'thickness'];
      numericFields.forEach(field => {
        if (submissionData[field] === '' || submissionData[field] === undefined || 
            submissionData[field] === null || isNaN(submissionData[field])) {
          submissionData[field] = null;
        } else if (typeof submissionData[field] === 'string') {
          const parsed = parseFloat(submissionData[field]);
          submissionData[field] = isNaN(parsed) ? null : parsed;
        }
      });

      // Handle ink_adhesion separately - strip % and apply default
      if (submissionData.ink_adhesion === '' || submissionData.ink_adhesion === null || submissionData.ink_adhesion === undefined) {
        submissionData.ink_adhesion = 100; // Default value
      } else if (typeof submissionData.ink_adhesion === 'string') {
        // Strip % and parse
        const cleaned = submissionData.ink_adhesion.replace('%', '').trim();
        if (cleaned === '<70') {
          submissionData.ink_adhesion = 69;
        } else if (!isNaN(cleaned)) {
          submissionData.ink_adhesion = parseFloat(cleaned);
        } else {
          submissionData.ink_adhesion = 100; // Default if invalid
        }
      } else if (!isNaN(submissionData.ink_adhesion)) {
        submissionData.ink_adhesion = parseFloat(submissionData.ink_adhesion);
      } else {
        submissionData.ink_adhesion = 100; // Default
      }

      // Remove deprecated logic for metallic_intensity
      // metallic_intensity column doesn't exist in substrates table

      // Normalize printing_side capitalization
      if (submissionData.printing_side) {
        submissionData.printing_side = submissionData.printing_side.charAt(0).toUpperCase() + 
          submissionData.printing_side.slice(1).toLowerCase();
      }

      const fieldsToNullify = ['type', 'material', 'surface_quality'];
      fieldsToNullify.forEach(field => {
        if (submissionData[field] === '' || submissionData[field] === undefined || submissionData[field] === null) {
          submissionData[field] = null;
        }
      });

      // Handle contrast separately - apply default
      if (submissionData.contrast === '' || submissionData.contrast === null || submissionData.contrast === undefined) {
        submissionData.contrast = 'medium'; // Default value
      }

      // Remove deprecated columns
      delete submissionData.color;
      delete submissionData.finish;
      delete submissionData.metallic_intensity;

      delete submissionData.id;
      const result = await supabase.from('substrates').insert([submissionData]).select().single();

      const { data, error } = result;

      if (error) throw error;

      toast({
        title: 'Success!',
        description: 'New substrate created successfully.',
      });

      // Notify parent component of successful substrate creation
      if (onSubstrateSaved && data) {
        onSubstrateSaved(data);
      }

      return data;
    } catch (error) {
      console.error('Error creating substrate:', error);
      toast({
        title: 'Error',
        description: `Failed to create new substrate. ${error.message}`,
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Remove the stub - handleSubmitUpdate is now implemented above

  const handleCancel = () => {
    // This won't be called in ink condition context
    console.log('SubstrateInfoFormWrapper: handleCancel called (should not happen)');
  };

  // Determine if we have an existing substrate ID to update
  const currentValues = watch();
  const hasExistingId = currentValues?.id || currentValues?.substrate_id;
  const isUpdating = Boolean(hasExistingId);

  return (
    <SubstrateInfoTab
      register={register}
      control={control}
      errors={errors}
      watch={watch}
      setValue={setValue}
      isNew={!isUpdating} // False if we have an ID to update
      substrate={hasExistingId ? { id: hasExistingId, ...currentValues } : mockSubstrate}
      onSubmitUpdate={handleSubmitUpdate}
      onSubmitNew={handleSubmitNew}
      onCancel={handleCancel}
      onValidationChange={handleValidationChange}
    />
  );
};

export default SubstrateInfoFormWrapper;