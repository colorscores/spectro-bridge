import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';

const allSteps = [
  { id: 1, name: 'Basic Info' },
  { id: 2, name: 'Sharing Tags' },
  { id: 3, name: 'Summary' },
];

export const useWizard = ({ isOpen, mode, userToEdit, onSuccess, startOnStep = 1 }) => {
  const [currentStepId, setCurrentStepId] = useState(startOnStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSteps, setActiveSteps] = useState([]);

  const getInitialFormData = useCallback((user) => ({
    email: user?.email || '',
    password: '',
    fullName: user?.full_name || '',
    role: user?.role || 'User',
    location: user?.location || '',
    allowOtherLocations: user?.allow_other_locations || false,
    limitByTags: user?.limit_by_tags || false,
    selectedTags: new Set(user?.tags?.map(t => t.id) || []),
    organizationId: user?.organization_id || null,
  }), []);

  const [formData, setFormData] = useState(getInitialFormData(null));

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      if (mode === 'edit' && userToEdit) {
        const initialData = getInitialFormData(userToEdit);
        setFormData(initialData);
      } else {
        setFormData(getInitialFormData(null));
      }
      setCurrentStepId(startOnStep);
      setIsLoading(false);
    }
  }, [isOpen, userToEdit, mode, startOnStep, getInitialFormData]);

  useEffect(() => {
    const steps = allSteps.filter(step => {
      if (startOnStep === 2) return step.id === 2; // Tag only mode
      if (!formData.limitByTags) return step.id !== 2;
      return true;
    });
    setActiveSteps(steps);
  }, [formData.limitByTags, startOnStep]);

  const currentStepIndex = useMemo(() => activeSteps.findIndex(step => step.id === currentStepId), [activeSteps, currentStepId]);

  const handleNext = () => {
    if (currentStepIndex < activeSteps.length - 1) {
      setCurrentStepId(activeSteps[currentStepIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepId(activeSteps[currentStepIndex - 1].id);
    }
  };

  const resetForm = useCallback(() => {
    setFormData(getInitialFormData(null));
    setCurrentStepId(startOnStep);
  }, [getInitialFormData, startOnStep]);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    if (mode === 'add') {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          role: formData.role,
          location: formData.location,
          allowOtherLocations: formData.allowOtherLocations,
          limitByTags: formData.limitByTags,
          organizationId: formData.organizationId,
          tags: Array.from(formData.selectedTags),
        }
      });
      if (error || data.error) {
        toast({ title: 'Error creating user', description: error?.message || data?.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success!', description: 'User has been created.' });
        if(onSuccess) onSuccess(data);
      }
    } else { // Edit mode
      const { data, error } = await supabase.functions.invoke('update-user-details', {
        body: {
          userId: userToEdit.id,
          profileData: {
            full_name: formData.fullName,
            role: formData.role,
            location: formData.location,
            allow_other_locations: formData.allowOtherLocations,
            limit_by_tags: formData.limitByTags,
            organization_id: formData.organizationId,
          },
          tags: formData.limitByTags ? Array.from(formData.selectedTags) : []
        }
      });

      const code = data?.code;
      if (error || data?.error || code) {
        const msg = data?.error || data?.message || error?.message || 'Unknown error';
        if (msg === 'EMAIL_EXISTS' || code === 'EMAIL_EXISTS') {
          toast({ title: 'Email already in use', description: 'That email is already in use. Please use a different email.', variant: 'destructive' });
        } else if (code === 'MISSING_SUPABASE_CONFIG' || (typeof msg === 'string' && msg.includes('MISSING_SUPABASE_CONFIG'))) {
          toast({ title: 'Server not configured', description: 'Supabase Service Role secrets are missing. Please configure Edge Function secrets and redeploy.', variant: 'destructive' });
        } else {
          toast({ title: 'Error updating user', description: msg, variant: 'destructive' });
        }
      } else {
        toast({ title: 'Success!', description: 'User has been updated.' });
        if(onSuccess) onSuccess(data);
      }
    }

    setIsSubmitting(false);
  };

  return {
    currentStepId,
    currentStepIndex,
    isSubmitting,
    isLoading,
    formData,
    setFormData,
    activeSteps,
    handleNext,
    handleBack,
    handleSubmit,
    resetForm,
  };
};