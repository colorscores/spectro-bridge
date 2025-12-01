import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Droplet, Save, Edit, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Breadcrumb from '@/components/Breadcrumb';
import InkDetailHeader from '@/components/inks/InkDetailHeader';
import InkInfoTab from '@/components/inks/InkInfoTab';
import InkConditionsTab from '@/components/inks/InkConditionsTab';
import InkConditionFormTab from '@/components/inks/InkConditionFormTab';

import HistoryTab from '@/components/common/HistoryTab';
import LoadingErrorBoundary from '@/components/LoadingErrorBoundary';
import CardHeader from '@/components/admin/my-company/CardHeader';
import SubstrateInfoTab from '@/components/substrates/info-tab/SubstrateInfoTab';
import SubstrateConditionFormTab from '@/components/substrates/SubstrateConditionFormTab';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/context/ProfileContext';
import { useAppContext } from '@/context/AppContext';
import { useInksData } from '@/context/InkContext';
import { useSubstratesData } from '@/context/SubstrateContext';

const InkDetail = () => {
  const { inkId } = useParams();
  
  
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { profile, loading: profileLoading } = useProfile();
  const { optimisticAddInk, optimisticUpdateInk, optimisticAddInkCondition, allInks, forceRefresh } = useInksData();
  const { optimisticAddSubstrate, optimisticUpdateSubstrate, optimisticAddSubstrateCondition, optimisticUpdateSubstrateCondition } = useSubstratesData();
  const isNew = !inkId || inkId === 'new';
  
  
  // Check for full-add mode from URL parameters
  const searchParams = new URLSearchParams(location.search);
  const isFullAddMode = searchParams.get('mode') === 'full-add';
  const fullAddConditionId = searchParams.get('conditionId');
  const fullAddCxfData = location.state?.cxfData;
  
  const { register, handleSubmit, setValue, watch, control, formState: { errors, isSubmitting, isDirty }, reset } = useForm({
    defaultValues: {
      name: '',
      type: '',
      material: '',
      print_process: '',
      ink_type: '',
      curve: 'as_measured',
      opaque: false,
      opacity_left: 50,
      metallic: false,
      metallic_gloss: 50,
    }
  });

  const [loading, setLoading] = useState(!isNew);
  const [ink, setInk] = useState(null);
  const [originalInk, setOriginalInk] = useState(null);
  const [inkBooks, setInkBooks] = useState([]);
  const [isNewSaved, setIsNewSaved] = useState(false);
  const [hasChangesAfterSave, setHasChangesAfterSave] = useState(false);
  const [newSubstrateIdToSelect, setNewSubstrateIdToSelect] = useState(null);

  // Temporary safety fallback for legacy calls that might still reference conditionSetValue
  // This prevents a ReferenceError from interrupting the save flow if any old code path runs
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.conditionSetValue !== 'function') {
      window.conditionSetValue = () => {
        console.warn('conditionSetValue() was called from a legacy code path. No-op fallback executed.');
      };
    }
  }, []);


  // State for dynamic tab creation and substrate/condition forms
  const [activeTab, setActiveTab] = useState(isFullAddMode ? "info" : "info");
  const [creatingNewSubstrate, setCreatingNewSubstrate] = useState(false);
  const [creatingNewSubstrateCondition, setCreatingNewSubstrateCondition] = useState(false);
  const [hasCreatedSubstrateTabs, setHasCreatedSubstrateTabs] = useState(false); // Sticky state
  const [conditionRequiredFieldsMissing, setConditionRequiredFieldsMissing] = useState(true); // Track condition validation
  const [substrateRequiredFieldsMissing, setSubstrateRequiredFieldsMissing] = useState(true); // Track substrate validation
  const [editingSubstrate, setEditingSubstrate] = useState(null); // Track existing substrate being edited
  
  // Track saved state for tab coloring
  const [inkInfoSaved, setInkInfoSaved] = useState(false);
  const [conditionSaved, setConditionSaved] = useState(false);
  const [substrateSaved, setSubstrateSaved] = useState(false);
  const [constructionDetails, setConstructionDetails] = useState(null);

  // Helper function to safely navigate to tabs
  const goToTab = useCallback((targetTab, creatingFlag) => {
    console.debug('goToTab called:', { targetTab, creatingFlag });
    
    // Set the creating flag first
    if (creatingFlag === 'substrate') {
      setCreatingNewSubstrate(true);
    } else if (creatingFlag === 'substrate-condition') {
      setCreatingNewSubstrateCondition(true);
    }
    
    // Use requestAnimationFrame to ensure the flag update has been processed
    requestAnimationFrame(() => {
      console.debug('Setting activeTab to:', targetTab);
      setActiveTab(targetTab);
    });
  }, []);

  // Form for new substrate
  const { 
    register: substrateRegister, 
    control: substrateControl, 
    formState: { errors: substrateErrors }, 
    watch: substrateWatch, 
    setValue: substrateSetValue 
  } = useForm({
    defaultValues: {
      name: '',
      type: '',
      material: '',
      thickness: '',
      manufacturer: '',
      printing_side: 'surface',
      use_white_ink: false,
      finish: 'standard',
      metallic_intensity: undefined,
      surface_quality: '',
      color: ''
    }
  });

  // State for new substrate condition
  const [newSubstrateCondition, setNewSubstrateCondition] = useState({
    name: '',
    substrate_id: null,
    use_pack_type: false,
    pack_type: '',
    measurement_settings: {},
    spectral_data: null,
    lab: null,
    ch: null,
    color_hex: '#FFFFFF'
  });

  // State for fetched ink condition with imported_tints
  const [inkConditionData, setInkConditionData] = useState(null);

  // Normalize legacy ink records into current form shape
  const normalizeInkRecord = (rec) => {
    if (!rec) return rec;
    const normalized = { ...rec };
    // Derive appearance_type from legacy booleans if missing
    normalized.appearance_type = rec.appearance_type || (rec.opaque ? 'opaque' : (rec.metallic ? 'metallic' : 'standard'));
    // Fallbacks for other fields
    if (!normalized.curve) normalized.curve = 'as_measured';
    // The RPC function now returns ink_type correctly, no auto-mapping needed
    // Ensure numeric types
    if (normalized.opacity_left !== null && normalized.opacity_left !== undefined) {
      normalized.opacity_left = Number(normalized.opacity_left);
    }
    if (normalized.metallic_gloss !== null && normalized.metallic_gloss !== undefined) {
      normalized.metallic_gloss = Number(normalized.metallic_gloss);
    }
    return normalized;
  };

  // Watch for form changes after save
  const watchedValues = watch();
  useEffect(() => {
    if (isNewSaved && isDirty) {
      setHasChangesAfterSave(true);
    }
  }, [watchedValues, isNewSaved, isDirty]);

  // Ensure correct tab is active when not in full-add mode
  useEffect(() => {
    if (!isFullAddMode && activeTab === 'condition') {
      setActiveTab('conditions');
    }
  }, [isFullAddMode, activeTab]);

  // Reset saved states when form changes are detected
  useEffect(() => {
    if (isDirty && inkInfoSaved) {
      setInkInfoSaved(false);
    }
  }, [isDirty, inkInfoSaved]);

  const fetchInkBooks = useCallback(async () => {
    if (!profile?.organization_id) return;
    
    const { data, error } = await supabase
      .from('ink_books')
      .select('id, name')
      .eq('organization_id', profile.organization_id)
      .order('name');

    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch ink books.', variant: 'destructive' });
    } else {
      setInkBooks(data || []);
      // Automatically set the first book as default for new inks
      if (isNew && data && data.length > 0 && !watch('book_id')) {
        setValue('book_id', data[0].id);
      }
    }
  }, [profile?.organization_id, toast, isNew, setValue, watch]);

  const fetchInk = useCallback(async (id) => {
    if (!id) {
      
      return;
    }
    
    
    setLoading(true);
    
    // First try to get ink from context (faster, optimistically updated)
    const inkFromContext = allInks.find(ink => ink.id === id);
    if (inkFromContext) {
      
      const normalized = normalizeInkRecord(inkFromContext);
      setInk(normalized);
      setOriginalInk(normalized);
      setLoading(false);
      return;
    }
    
    // Fallback to database query if not in context
    console.log('📡 Fetching ink from database (fallback):', id);
    const { data, error } = await supabase
      .from('inks')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    console.log('fetchInk result:', { data, error });
    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch ink data.', variant: 'destructive' });
      navigate('/assets/inks');
    } else if (!data) {
      const fallbackId = allInks && allInks.length > 0 ? allInks[0].id : null;
      toast({ 
        title: 'Ink not found', 
        description: fallbackId ? 'Opened the first available ink instead.' : 'Returning to inks list.', 
        variant: 'destructive' 
      });
      if (fallbackId) {
        navigate(`/assets/inks/${fallbackId}`, { replace: true });
      } else {
        navigate('/assets/inks');
      }
    }
    setLoading(false);
    
  }, [navigate, reset, toast, allInks]);

  // Memoized effect to prevent unnecessary re-runs
  const shouldFetchInkBooks = useMemo(() => {
    return profile?.organization_id && inkBooks.length === 0;
  }, [profile?.organization_id, inkBooks.length]);

  useEffect(() => {
    if (shouldFetchInkBooks) {
      fetchInkBooks();
    }
  }, [shouldFetchInkBooks, fetchInkBooks]);

  // Memoized effect for ink fetching
  const shouldFetchInk = useMemo(() => {
    return !isNew && inkId && (!ink || ink.id !== inkId);
  }, [isNew, inkId, ink]);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      reset({
        name: '',
        type: '',
        material: '',
        print_process: '',
        ink_type: '',
        curve: 'as_measured',
        opaque: false,
        opacity_left: 50,
        metallic: false,
        metallic_gloss: 50,
      });
      setInk(null);
      setOriginalInk(null);
      setIsNewSaved(false);
      setHasChangesAfterSave(false);
    } else if (shouldFetchInk) {
      fetchInk(inkId);
    }
}, [isNew, shouldFetchInk, inkId, fetchInk, reset]);

  // Reset form with ink data when ink is loaded
  useEffect(() => {
    if (ink && !isNew) {
      console.log('🔄 Populating form with ink data:', ink);
      // Use ink_type as the primary field now
      reset(ink);
    }
  }, [ink, isNew, reset]);
  
  // Fetch full substrate details (including any imported data) once a substrate exists
  useEffect(() => {
    const id = editingSubstrate?.id || newSubstrateIdToSelect;
    if (!id) return;
    let isMounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('substrates')
          .select('*, substrate_conditions(*)')
          .eq('id', id)
          .maybeSingle();
        if (data && isMounted) {
          setEditingSubstrate(prev => ({ ...(prev || {}), ...data }));
        }
      } catch (e) {
        console.warn('Could not fetch full substrate details:', e);
      }
    })();
    return () => { isMounted = false; };
  }, [editingSubstrate?.id, newSubstrateIdToSelect]);

  // Fetch ink condition data (including imported_tints) for full-add mode
  useEffect(() => {
    if (!fullAddConditionId) return;
    let isMounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('ink_conditions')
          .select('*')
          .eq('id', fullAddConditionId)
          .maybeSingle();
        if (data && isMounted) {
          setInkConditionData(data);
        }
      } catch (e) {
        console.warn('Could not fetch ink condition data:', e);
      }
    })();
    return () => { isMounted = false; };
  }, [fullAddConditionId]);
  
  const onSubmitUpdate = async (formData) => {
    console.log('onSubmitUpdate called with formData:', formData);
    console.log('profileLoading:', profileLoading, 'profile:', profile);
    console.log('isNew:', isNew);
    
    if (profileLoading || !profile) {
      console.log('Profile loading or missing, aborting');
      toast({ title: 'Error', description: 'You must be logged in to perform this action.', variant: 'destructive' });
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      console.log('No active Supabase session, aborting update');
      toast({ title: 'Sign in required', description: 'Please sign in and try again.', variant: 'destructive' });
      return;
    }
    try {
      let result;
      const submissionData = {
        ...formData,
      };

      // Remove fields not in inks table or managed server-side
      delete submissionData.book_id; // legacy, no longer used
      delete submissionData.conditions; // avoid schema error from non-existent column
      delete submissionData.associationId;
      delete submissionData.displayName;
      delete submissionData.created_at;
      delete submissionData.updated_at;
      delete submissionData.organization_id; // organization_id should not be updated

      const fieldsToNullify = ['type', 'material', 'print_process', 'ink_type', 'series'];
      fieldsToNullify.forEach(field => {
        // Only nullify truly empty strings, not undefined values that might be valid
        if (submissionData[field] === '') {
          submissionData[field] = null;
        }
      });
      // Sanitize optional numeric fields that may come from UI as {_type:'undefined'}
      const sanitizeOptional = (v) => (v && typeof v === 'object' && v._type === 'undefined' ? null : v);
      submissionData.opacity_left = sanitizeOptional(submissionData.opacity_left);
      submissionData.metallic_gloss = sanitizeOptional(submissionData.metallic_gloss);
      submissionData.series = sanitizeOptional(submissionData.series);

      console.log('submissionData before save:', submissionData);

      if (isNew) {
        // Add organization_id for new inks only
        submissionData.organization_id = profile?.organization_id;
        delete submissionData.id;
        console.log('Inserting new ink:', submissionData);
        result = await supabase.from('inks').insert([submissionData]).select().single();
      } else {
        if (!inkId) {
          throw new Error("Ink ID is missing for update.");
        }
        console.log('Updating existing ink:', inkId, submissionData);
        result = await supabase.from('inks').update(submissionData).eq('id', inkId).select().maybeSingle();
      }

      console.log('Save result:', result);
      const { data, error } = result;

      if (error) {
        console.error('Save error:', error);
        throw error;
      }

      console.log('Save successful, data:', data);
      toast({
        title: 'Success!',
        description: `Ink ${isNew ? 'created' : 'updated'} successfully.`,
      });

      if (isNew && data) {
        console.log('Adding optimistic ink to list');
        optimisticAddInk(data);
        console.log('Navigating to new ink:', data.id);
        setIsNewSaved(false); // Reset to behave like normal existing ink
        setHasChangesAfterSave(false);
        await forceRefresh(); // Ensure data is refreshed before navigation
        navigate(`/assets/inks/${data.id}`, { replace: true });
      } else if (data) {
        console.log('Optimistically updating ink in list');
        // Update the ink data
        optimisticUpdateInk(data);
        setInk(data);
         setOriginalInk(data);
         setInkInfoSaved(true); // Mark ink info as saved
      }
      
      return true; // Return success
    } catch (error) {
      console.error('onSubmitUpdate error:', error);
      toast({
        title: 'Error',
        description: `Failed to ${isNew ? 'create' : 'update'} ink. ${error.message}`,
        variant: 'destructive',
      });
      return false; // Return failure
    }
  };

  const onSubmitNew = async (formData) => {
    if (profileLoading || !profile) {
      toast({ title: 'Error', description: 'You must be logged in to perform this action.', variant: 'destructive' });
      return false;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      toast({ title: 'Sign in required', description: 'Please sign in and try again.', variant: 'destructive' });
      return false;
    }
    
    // Check if the name is the same as the original ink
    if (originalInk && formData.name === originalInk.name) {
        toast({ 
            title: 'Different name required', 
            description: 'If you wish to create a new ink, please use a different name than the existing ink.', 
            variant: 'destructive' 
        });
        return false;
    }

    try {
      const submissionData = {
        ...formData,
        organization_id: profile.organization_id,
      };

      // Remove fields not in inks table or managed server-side
      delete submissionData.book_id; // legacy, no longer used
      delete submissionData.conditions;
      delete submissionData.associationId;
      delete submissionData.displayName;
      delete submissionData.created_at;
      delete submissionData.updated_at;

      const fieldsToNullify = ['type', 'material', 'print_process', 'ink_type', 'series'];
      fieldsToNullify.forEach(field => {
        if (submissionData[field] === '' || submissionData[field] === undefined) {
          submissionData[field] = null;
        }
      });

      delete submissionData.id;
      const result = await supabase.from('inks').insert([submissionData]).select().single();

      const { data, error } = result;

      if (error) throw error;

      toast({
        title: 'Success!',
        description: 'New ink created successfully.',
      });

      if (data) {
        console.log('Adding optimistic ink to list for new save');
        // Add ink with empty conditions array for optimistic update
         optimisticAddInk({ ...data, conditions: [] });
         setInkInfoSaved(true); // Mark ink info as saved
        await forceRefresh(); // Ensure data is refreshed before navigation
        navigate(`/assets/inks/${data.id}`, { replace: true });
      }
      
      return true; // Return success
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to create new ink. ${error.message}`,
        variant: 'destructive',
      });
      return false; // Return failure
    }
  };

  const handleCancel = async () => {
    if (isNew) {
      // Ensure data is refreshed before navigating back to the inks list
      await forceRefresh();
      navigate('/assets/inks');
    } else {
      if (originalInk) {
        reset(originalInk);
      }
    }
  };

  const handleDone = async () => {
    // Ensure data is refreshed before navigating back to the inks list
    await forceRefresh();
    navigate('/assets/inks');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Define mode configuration for root breadcrumb
  const { appMode } = useAppContext();
  const modeConfig = {
    assets: { label: 'Color Assets', href: '/assets/dashboard' },
    matching: { label: 'Matching Jobs', href: '/color-matches' },
    admin: { label: 'Admin', href: '/admin/my-company' },
  };
  const rootConfig = modeConfig[appMode] || modeConfig.assets;

  const breadcrumbItems = [
    { label: 'Inks', href: '/assets/inks' },
    { label: isNew ? 'New Ink' : (ink?.name || 'Edit Ink') },
  ];
  
  const watchedName = watch('name');
  const pageTitle = isNew ? 'New Ink' : (ink?.name || 'Edit Ink');

  
  if (loading) {
    
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading ink data...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{pageTitle} - Color KONTROL</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col h-full p-4 sm:p-6 lg:p-8"
      >
        <form className="flex flex-col h-full">
          {isNew ? (
            <InkDetailHeader
              isNew={isNew}
              inkName={watchedName}
              handleSaveNew={handleSubmit(onSubmitNew)}
              saving={isSubmitting}
              onCancel={() => navigate('/assets/inks')}
              requiredFieldsFilled={!!(watchedName && watch('print_process') && watch('ink_type'))}
            />
          ) : (
            <div className="mb-4">
              <Breadcrumb items={breadcrumbItems} />
              <div className="flex items-center gap-4 mt-2">
                <div className="w-10 h-10 rounded-md border border-gray-200 flex items-center justify-center bg-blue-50">
                  <Droplet className="w-6 h-6 text-blue-600" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">{watchedName || pageTitle}</h1>
              </div>
            </div>
          )}
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col">
            <TabsList className="mb-2 self-start">
               <TabsTrigger 
                 value="info" 
                 className={`${
                   (!inkInfoSaved && (!watch('name') || !watch('print_process') || !watch('ink_type')))
                     ? 'data-[state=active]:bg-red-100 data-[state=active]:text-red-900 data-[state=inactive]:text-red-600'
                     : ''
                 }`}
               >
                {isFullAddMode ? "Ink" : "Info"}
              </TabsTrigger>
              {isFullAddMode ? (
                 <TabsTrigger 
                   value="condition"
                   className={`${
                     (!conditionSaved && conditionRequiredFieldsMissing)
                       ? 'data-[state=active]:bg-red-100 data-[state=active]:text-red-900 data-[state=inactive]:text-red-600'
                       : ''
                   }`}
                 >
                  Ink Condition
                </TabsTrigger>
              ) : (
                <TabsTrigger value="conditions" disabled={isNew}>Conditions</TabsTrigger>
              )}
              {((creatingNewSubstrate || hasCreatedSubstrateTabs) || activeTab === 'substrate') && (
                 <TabsTrigger 
                   value="substrate"
                   className={`${
                     (!substrateSaved && substrateRequiredFieldsMissing)
                       ? 'data-[state=active]:bg-red-100 data-[state=active]:text-red-900 data-[state=inactive]:text-red-600'
                       : ''
                   }`}
                 >
                  Substrate
                </TabsTrigger>
              )}
              {((creatingNewSubstrateCondition || hasCreatedSubstrateTabs) || activeTab === 'substrate-condition') && (
                <TabsTrigger value="substrate-condition">Substrate Condition</TabsTrigger>
              )}
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="flex-grow">
              <InkInfoTab
                register={register}
                control={control}
                errors={errors}
                watch={watch}
                setValue={setValue}
                inkBooks={inkBooks}
                disabled={false}
                isNew={isNew}
                onSave={handleSubmit(onSubmitUpdate)}
              />
            </TabsContent>
            {isFullAddMode ? (
              <TabsContent value="condition" className="flex-grow">
                <InkConditionFormTab 
                  inkId={inkId}
                  conditionId={fullAddConditionId}
                  cxfData={fullAddCxfData}
                  newSubstrateIdToSelect={newSubstrateIdToSelect}
                   onConditionSaved={() => {
                     setConditionSaved(true); // Mark condition as saved
                     // Set active tab to conditions before navigating
                     setActiveTab('conditions');
                     // Navigate back to normal mode after saving
                     navigate(`/assets/inks/${inkId}`);
                   }}
                  onCreationModeChange={({ creatingNewSubstrate, creatingNewSubstrateCondition }) => {
                    console.debug('Creation mode change:', { creatingNewSubstrate, creatingNewSubstrateCondition });
                    setCreatingNewSubstrate(creatingNewSubstrate);
                    setCreatingNewSubstrateCondition(creatingNewSubstrateCondition);
                    
                    // Set sticky state when substrate tabs are created
                    if (creatingNewSubstrate || creatingNewSubstrateCondition) {
                      setHasCreatedSubstrateTabs(true);
                    }
                  }}
                  onRequestActiveTab={(tab) => {
                    console.debug('Tab request received:', tab);
                    if (tab === 'substrate') {
                      goToTab('substrate', 'substrate');
                    } else if (tab === 'substrate-condition') {
                      goToTab('substrate-condition', 'substrate-condition');
                    } else {
                      setActiveTab(tab);
                    }
                  }}
                   onValidationChange={(isValid) => {
                     setConditionRequiredFieldsMissing(!isValid);
                     // Reset saved state when validation changes (meaning form was modified)
                     if (conditionSaved) {
                       setConditionSaved(false);
                     }
                   }}
                   creatingNewSubstrate={creatingNewSubstrate || (hasCreatedSubstrateTabs && activeTab !== 'substrate')}
                   creatingNewSubstrateCondition={creatingNewSubstrateCondition || (hasCreatedSubstrateTabs && activeTab !== 'substrate-condition')}
                />
              </TabsContent>
            ) : (
              <TabsContent value="conditions" className="flex-grow">
                {!isNew && <InkConditionsTab inkId={inkId} />}
              </TabsContent>
            )}
            
            {((creatingNewSubstrate || hasCreatedSubstrateTabs) || activeTab === 'substrate') && (
              <TabsContent value="substrate" className="flex-grow">
                <SubstrateInfoTab
                            register={substrateRegister}
                            control={substrateControl}
                            errors={substrateErrors}
                            watch={substrateWatch}
                            setValue={substrateSetValue}
                            isNew={!editingSubstrate}
                            substrate={editingSubstrate}
                            onSubmitUpdate={editingSubstrate ? async (data) => {
                              try {
                                // Sanitize form data - only include allowed columns
                                const submissionData = {
                                  name: data.name,
                                  type: data.type || null,
                                  material: data.material || null,
                                  manufacturer: data.manufacturer?.trim() || null,
                                  printing_side: data.printing_side ? data.printing_side.toLowerCase() : 'surface',
                                  use_white_ink: Boolean(data.use_white_ink),
                                  finish: data.finish || 'standard',
                                  surface_quality: data.surface_quality || null,
                                  color: (data.color && String(data.color).trim() !== '') ? data.color : null,
                                  organization_id: profile.organization_id
                                };

                                // Handle numeric fields with proper null handling
                                if (data.thickness !== undefined && data.thickness !== '' && data.thickness !== null) {
                                  submissionData.thickness = Number(data.thickness);
                                }
                                if (data.weight !== undefined && data.weight !== '' && data.weight !== null) {
                                  submissionData.weight = Number(data.weight);
                                }
                                if (data.ink_adhesion !== undefined && data.ink_adhesion !== '' && data.ink_adhesion !== null) {
                                  submissionData.ink_adhesion = Number(data.ink_adhesion);
                                }

                                // Only include metallic_intensity if finish is metallic
                                if (data.finish === 'metallic' && data.metallic_intensity !== undefined && data.metallic_intensity !== '' && data.metallic_intensity !== null) {
                                  submissionData.metallic_intensity = Number(data.metallic_intensity);
                                } else {
                                  submissionData.metallic_intensity = null;
                                }

                                // Update existing substrate
                                const { data: updatedSubstrate, error } = await supabase
                                  .from('substrates')
                                  .update(submissionData)
                                  .eq('id', editingSubstrate.id)
                                  .select()
                                  .single();

                                if (error) throw error;

                                // Optimistically update in substrates list
                                optimisticUpdateSubstrate(updatedSubstrate);

                                toast({
                                  title: "Success",
                                  description: "Substrate updated successfully",
                                });

                                // Update the editing substrate state
                                setEditingSubstrate(updatedSubstrate);
                              } catch (error) {
                                console.error('Error updating substrate:', error);
                                toast({
                                  title: "Error",
                                  description: error.message || "Failed to update substrate",
                                  variant: "destructive"
                                });
                              }
                            } : undefined}
                            onSubmitNew={async (data, options = {}) => {
                              try {
                                // Sanitize form data - only include allowed columns
                                const submissionData = {
                                  name: data.name,
                                  type: data.type || null,
                                  material: data.material || null,
                                  manufacturer: data.manufacturer?.trim() || null,
                                  printing_side: data.printing_side ? data.printing_side.toLowerCase() : 'surface',
                                  use_white_ink: Boolean(data.use_white_ink),
                                  finish: data.finish || 'standard',
                                  surface_quality: data.surface_quality || null,
                                  color: (data.color && String(data.color).trim() !== '') ? data.color : null,
                                  organization_id: profile.organization_id
                                };

                                // Handle numeric fields with proper null handling
                                if (data.thickness !== undefined && data.thickness !== '' && data.thickness !== null) {
                                  submissionData.thickness = Number(data.thickness);
                                }
                                if (data.weight !== undefined && data.weight !== '' && data.weight !== null) {
                                  submissionData.weight = Number(data.weight);
                                }
                                if (data.ink_adhesion !== undefined && data.ink_adhesion !== '' && data.ink_adhesion !== null) {
                                  submissionData.ink_adhesion = Number(data.ink_adhesion);
                                }

                                // Only include metallic_intensity if finish is metallic
                                if (data.finish === 'metallic' && data.metallic_intensity !== undefined && data.metallic_intensity !== '' && data.metallic_intensity !== null) {
                                  submissionData.metallic_intensity = Number(data.metallic_intensity);
                                } else {
                                  submissionData.metallic_intensity = null;
                                }

                                // Create new substrate
                                const { data: newSubstrate, error } = await supabase
                                  .from('substrates')
                                  .insert([submissionData])
                                  .select()
                                  .single();

                                if (error) throw error;

                                // Optimistically add to substrates list
                                optimisticAddSubstrate({ ...newSubstrate, conditions: [] });

                                 // Set the newly created substrate ID for the ink condition form
                                 setNewSubstrateIdToSelect(newSubstrate.id);

                                 // Set editing substrate so future saves use update path
                                 setEditingSubstrate(newSubstrate);

                                 toast({
                                   title: "Success",
                                   description: "Substrate created successfully",
                                 });

                                  setCreatingNewSubstrate(false);
                                  setSubstrateSaved(true); // Mark substrate as saved
                                 
                                 // Only navigate to condition tab if not prevented (i.e., not from card save)
                                 if (!options.preventTabNavigation) {
                                   setActiveTab('condition');
                                 }
                              } catch (error) {
                                console.error('Error creating substrate:', error);
                                toast({
                                  title: "Error",
                                  description: error.message || "Failed to create substrate",
                                  variant: "destructive"
                                });
                              }
                            }}
                            onCancel={() => {
                              setCreatingNewSubstrate(false);
                              setActiveTab('condition');
                            }}
                             onValidationChange={(isValid) => {
                               setSubstrateRequiredFieldsMissing(!isValid);
                               // Reset saved state when validation changes (meaning form was modified)
                               if (substrateSaved) {
                                 setSubstrateSaved(false);
                               }
                             }}
                          />
              </TabsContent>
            )}
            
            {((creatingNewSubstrateCondition || hasCreatedSubstrateTabs) || activeTab === 'substrate-condition') && (
              <TabsContent value="substrate-condition" className="flex-grow">
                <Card>
                  <CardHeader
                    subtitle="Create a new substrate condition for this ink"
                    onEdit={() => {}}
                    onSave={() => {
                      // Handle substrate condition save
                      console.log('Save substrate condition');
                    }}
                    onCancel={() => {
                      setCreatingNewSubstrateCondition(false);
                      setActiveTab('condition');
                    }}
                    showEdit={false}
                    showLearn={false}
                    isEditing={true}
                    canSave={true}
                    saving={false}
                    editDisabled={false}
                    hasRequiredFields={true}
                    requiredFieldsFilled={true}
                  />
                  <div className="px-6 pb-6">
                    <SubstrateConditionFormTab
                      condition={newSubstrateCondition}
                      onConditionChange={(updates) => {
                        setNewSubstrateCondition(prev => ({ ...prev, ...updates }));
                      }}
                      onDataChange={(updates) => {
                        setNewSubstrateCondition(prev => ({ ...prev, ...updates }));
                      }}
                      canEdit={true}
                      isNew={true}
                      onNameChange={(e) => {
                        const value = e?.target ? e.target.value : e;
                        setNewSubstrateCondition(prev => ({ ...prev, name: value }));
                      }}
                      onPackTypeChange={(pack_type) => {
                        setNewSubstrateCondition(prev => ({ ...prev, pack_type }));
                      }}
                      onMeasurementControlsChange={(measurement_settings) => {
                        setNewSubstrateCondition(prev => ({ ...prev, measurement_settings }));
                      }}
                      parentSubstrate={editingSubstrate ? {
                        ...editingSubstrate,
                        // Override with live form values to ensure current selections are reflected
                        printing_side: substrateWatch('printing_side') || editingSubstrate.printing_side || 'surface',
                        use_white_ink: substrateWatch('use_white_ink') !== undefined ? substrateWatch('use_white_ink') : editingSubstrate.use_white_ink || false,
                        name: substrateWatch('name') || editingSubstrate.name || '',
                        surface_quality: substrateWatch('surface_quality') || editingSubstrate.surface_quality || null,
                        // Include imported_tints from ink condition data if available
                        imported_tints: inkConditionData?.imported_tints || editingSubstrate.imported_tints,
                      } : {
                        printing_side: substrateWatch('printing_side') || 'surface',
                        use_white_ink: substrateWatch('use_white_ink') || false,
                        name: substrateWatch('name') || '',
                        surface_quality: substrateWatch('surface_quality') || null,
                        // Include imported_tints from ink condition data for new substrates
                        imported_tints: inkConditionData?.imported_tints,
                      }}
                      constructionDetails={constructionDetails}
                      setConstructionDetails={setConstructionDetails}
                      onOptimisticUpdate={async (substrateId, conditionData) => {
                        try {
                          // Create new substrate condition
                          const { data: newCondition, error } = await supabase
                            .from('substrate_conditions')
                            .insert([{
                              ...conditionData,
                              substrate_id: substrateId,
                              organization_id: profile.organization_id
                            }])
                            .select()
                            .single();

                          if (error) throw error;

                          // Optimistically add to substrate conditions list
                          optimisticAddSubstrateCondition(substrateId, newCondition);

                          toast({
                            title: "Success",
                            description: "Substrate condition created successfully",
                          });

                          setCreatingNewSubstrateCondition(false);
                          setActiveTab('condition');
                        } catch (error) {
                          console.error('Error creating substrate condition:', error);
                          toast({
                            title: "Error",
                            description: error.message || "Failed to create substrate condition",
                            variant: "destructive"
                          });
                        }
                      }}
                    />
                  </div>
                </Card>
              </TabsContent>
            )}
            <TabsContent value="history" className="flex-grow" key="history-tab">
              <Card>
                <CardHeader
                  title="History"
                  subtitle="View changes and updates to this ink"
                  showEdit={false}
                  showLearn={false}
                  isEditing={false}
                  canSave={false}
                  saving={false}
                />
                <div className="px-6 pb-6">
                  {activeTab === 'history' && inkId && inkId !== 'new' ? (
                    <LoadingErrorBoundary>
                      <HistoryTab assetType="Ink" assetId={inkId} />
                    </LoadingErrorBoundary>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      History will be available after saving this ink
                    </div>
                  )}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </motion.div>
    </>
  );
};

export default InkDetail;