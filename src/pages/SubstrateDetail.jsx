import React, { useState, useEffect, useCallback } from 'react';
    import { Helmet } from 'react-helmet-async';
    import { useParams, useNavigate } from 'react-router-dom';
    import { useForm } from 'react-hook-form';
    import { motion } from 'framer-motion';
    import { Save, Loader2, Layers, ChevronDown } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
    import { toast } from '@/hooks/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SubstrateInfoTab from '@/components/substrates/info-tab/SubstrateInfoTab';
import SubstrateConditionsTab from '@/components/substrates/SubstrateConditionsTab';

import HistoryTab from '@/components/common/HistoryTab';
import { useProfile } from '@/context/ProfileContext';
import { useAppContext } from '@/context/AppContext';
    import Breadcrumb from '@/components/Breadcrumb';
    import { getSubstrateIconColor } from '@/lib/colorUtils';

const SubstrateDetail = () => {
  const { substrateId } = useParams();
  const navigate = useNavigate();
  
  const { profile, loading: profileLoading } = useProfile();
  const { appMode } = useAppContext(); // Moved to top to fix hook order
  const isNew = !substrateId || substrateId === 'new';
      
      const { register, handleSubmit, setValue, watch, control, formState: { errors, isSubmitting, isDirty }, reset } = useForm({
        defaultValues: {
          name: '',
          type: null,
          material: null,
          color: '',
          surface_quality: null,
          printing_side: 'surface',
          use_white_ink: false,
          // finish and metallic_intensity removed - not in substrates table
          contrast: '',
          ink_adhesion: 100,
          notes: '',
          weight: '',
          thickness: '',
        }
      });
      const [loading, setLoading] = useState(!isNew);
      const [substrate, setSubstrate] = useState(null);
  const [originalSubstrate, setOriginalSubstrate] = useState(null);

      const fetchSubstrate = useCallback(async (id) => {
        console.log('🔍 Fetching substrate with ID:', id);
        setLoading(true);
        const { data, error } = await supabase
          .from('substrates')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        console.log('🔍 Substrate fetch result:', { data, error, id });

        if (error) {
          console.error('❌ Error fetching substrate:', error);
          toast({ title: 'Error', description: 'Failed to fetch substrate data.', variant: 'destructive' });
          navigate('/assets/substrates');
        } else if (data) {
          const normalized = { ...data, printing_side: (data.printing_side || 'surface').toLowerCase() };
          setSubstrate(normalized);
          setOriginalSubstrate(normalized);
          reset(normalized);
        } else {
          console.error('❌ Substrate not found for ID:', id);
          toast({ title: 'Error', description: 'Substrate not found.', variant: 'destructive' });
          navigate('/assets/substrates');
        }
        setLoading(false);
      }, [navigate, reset, toast]);

      useEffect(() => {
        console.log('🔍 SubstrateDetail useEffect triggered:', { substrateId, isNew, profileLoading, profile: !!profile });
        if (isNew) {
          setLoading(false);
          reset({
            name: '',
            type: null,
            material: null,
            color: '',
            surface_quality: null,
            printing_side: 'surface',
            use_white_ink: false,
            // finish and metallic_intensity removed - not in substrates table
            contrast: '',
            ink_adhesion: 100,
            notes: '',
            weight: '',
            thickness: '',
          });
          setSubstrate(null);
          setOriginalSubstrate(null);
        } else if (profile) {
          console.log('🔍 SubstrateDetail - Authenticated user, about to fetch substrate:', substrateId);
          fetchSubstrate(substrateId);
        } else if (!profileLoading && !profile) {
          console.log('🔍 SubstrateDetail - User not authenticated, skipping fetch');
        }
      }, [substrateId, isNew, fetchSubstrate, reset, profile, profileLoading]);
      
      const onSubmitUpdate = async (formData) => {
        if (profileLoading || !profile) {
            toast({ title: 'Error', description: 'You must be logged in to perform this action.', variant: 'destructive' });
            return;
        }
        try {
          let result;
          const submissionData = {
            ...formData,
            organization_id: profile.organization_id,
            last_modified_by: profile.id,
          };

          // Sanitize numeric fields - convert NaN or empty strings to null
          const numericFields = ['weight', 'thickness', 'ink_adhesion'];
          numericFields.forEach(field => {
            if (submissionData[field] === '' || submissionData[field] === undefined || 
                submissionData[field] === null || isNaN(submissionData[field])) {
              submissionData[field] = null;
            } else if (typeof submissionData[field] === 'string') {
              const parsed = parseFloat(submissionData[field]);
              submissionData[field] = isNaN(parsed) ? null : parsed;
            }
          });

          // Remove deprecated logic for metallic_intensity
          // metallic_intensity column doesn't exist in substrates table

          // Normalize printing_side capitalization
          if (submissionData.printing_side) {
            submissionData.printing_side = submissionData.printing_side.charAt(0).toUpperCase() + 
              submissionData.printing_side.slice(1).toLowerCase();
          }

          const fieldsToNullify = ['type', 'material', 'surface_quality', 'contrast'];
          fieldsToNullify.forEach(field => {
            if (submissionData[field] === '' || submissionData[field] === undefined || submissionData[field] === null) {
              submissionData[field] = null;
            }
          });

          // Remove deprecated columns
          delete submissionData.color;
          delete submissionData.finish;
          delete submissionData.metallic_intensity;

          if (isNew) {
            delete submissionData.id;
            result = await supabase.from('substrates').insert([submissionData]).select().single();
          } else {
            if (!substrateId) {
              throw new Error("Substrate ID is missing for update.");
            }
            result = await supabase.from('substrates').update(submissionData).eq('id', substrateId).select().single();
          }

          const { data, error } = result;

          if (error) throw error;

          toast({
            title: 'Success!',
            description: `Substrate ${isNew ? 'created' : 'updated'} successfully.`,
          });

          if (isNew && data) {
            navigate(`/assets/substrates/${data.id}`, { replace: true });
          } else if (data) {
            fetchSubstrate(data.id);
          }
        } catch (error) {
          toast({
            title: 'Error',
            description: `Failed to ${isNew ? 'create' : 'update'} substrate. ${error.message}`,
            variant: 'destructive',
          });
        }
      };

      const onSubmitNew = async (formData) => {
        console.log('🔍 SubstrateDetail.onSubmitNew - Initial checks:', {
          profileLoading,
          profile: profile ? { id: profile.id, organization_id: profile.organization_id } : null
        });

        if (profileLoading || !profile) {
            console.error('🚫 SubstrateDetail.onSubmitNew - Authentication issue:', { profileLoading, profile });
            toast({ 
              title: 'Authentication Error', 
              description: 'You must be logged in to perform this action. Please refresh the page and try again.', 
              variant: 'destructive' 
            });
            return;
        }

        if (!profile.organization_id) {
            console.error('🚫 SubstrateDetail.onSubmitNew - Missing organization:', profile);
            toast({ 
              title: 'Organization Error', 
              description: 'Your profile is missing organization information. Please contact support.', 
              variant: 'destructive' 
            });
            return;
        }
        
        // Check if the name is the same as the original substrate
        if (originalSubstrate && formData.name === originalSubstrate.name) {
            toast({ 
                title: 'Different name required', 
                description: 'If you wish to create a new substrate, please use a different name than the existing substrate.', 
                variant: 'destructive' 
            });
            return;
        }

        try {
          console.log('🔍 SubstrateDetail.onSubmitNew - Profile check:', {
            profileLoading,
            profile: profile ? { id: profile.id, organization_id: profile.organization_id } : null,
            authUser: profile?.id
          });

          const submissionData = {
            ...formData,
            organization_id: profile.organization_id,
            last_modified_by: profile.id,
          };

          console.log('🔍 SubstrateDetail.onSubmitNew - Submission data:', {
            organization_id: submissionData.organization_id,
            last_modified_by: submissionData.last_modified_by,
            name: submissionData.name
          });

          // Sanitize numeric fields - convert NaN or empty strings to null
          const numericFields = ['weight', 'thickness', 'ink_adhesion'];
          numericFields.forEach(field => {
            if (submissionData[field] === '' || submissionData[field] === undefined || 
                submissionData[field] === null || isNaN(submissionData[field])) {
              submissionData[field] = null;
            } else if (typeof submissionData[field] === 'string') {
              const parsed = parseFloat(submissionData[field]);
              submissionData[field] = isNaN(parsed) ? null : parsed;
            }
          });

          // Remove deprecated logic for metallic_intensity
          // metallic_intensity column doesn't exist in substrates table

          // Normalize printing_side capitalization
          if (submissionData.printing_side) {
            submissionData.printing_side = submissionData.printing_side.charAt(0).toUpperCase() + 
              submissionData.printing_side.slice(1).toLowerCase();
          }

          const fieldsToNullify = ['type', 'material', 'surface_quality', 'contrast'];
          fieldsToNullify.forEach(field => {
            if (submissionData[field] === '' || submissionData[field] === undefined || submissionData[field] === null) {
              submissionData[field] = null;
            }
          });

          // Remove deprecated columns
          delete submissionData.color;
          delete submissionData.finish;
          delete submissionData.metallic_intensity;

          delete submissionData.id;
          
          console.log('🚀 SubstrateDetail.onSubmitNew - About to insert:', submissionData);
          const result = await supabase.from('substrates').insert([submissionData]).select().single();

          const { data, error } = result;

          if (error) {
            console.error('💥 SubstrateDetail.onSubmitNew - Insert failed:', error);
            throw error;
          }

          console.log('✅ SubstrateDetail.onSubmitNew - Insert successful:', data);

          toast({
            title: 'Success!',
            description: 'New substrate created successfully.',
          });

          if (data) {
            navigate(`/assets/substrates/${data.id}`, { replace: true });
          }
        } catch (error) {
          toast({
            title: 'Error',
            description: `Failed to create new substrate. ${error.message}`,
            variant: 'destructive',
          });
        }
      };

      const handleCancel = () => {
        if (isNew) {
          navigate('/assets/substrates');
        } else {
          if (originalSubstrate) reset(originalSubstrate);
        }
      };

      if (loading) {
        return (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        );
      }

      // Define mode configuration for root breadcrumb
      const modeConfig = {
        assets: { label: 'Color Assets', href: '/assets/dashboard' },
        matching: { label: 'Matching Jobs', href: '/color-matches' },
        admin: { label: 'Admin', href: '/admin/my-company' },
      };
      const rootConfig = modeConfig[appMode] || modeConfig.assets;

      const breadcrumbItems = [
        { label: 'Substrates', href: '/assets/substrates' },
        { label: isNew ? 'New Substrate' : (substrate?.name || 'Edit Substrate') },
      ];
      
      const watchedName = watch('name');
      const watchedColor = watch('color');
      const pageTitle = isNew ? 'New Substrate' : (substrate?.name || 'Edit Substrate');
      
      // Get background color based on substrate color (same as in SubstrateRow)
      const getSubstrateBackgroundColor = (color) => {
        const colorMap = {
          White: '#ffffff',
          Clear: '#f3f4f6',
          Brown: '#92400e',
          Silver: '#d1d5db',
          Gray: '#6b7280',
        };
        return colorMap[color] || '#f3f4f6';
      };
      
      const backgroundColor = getSubstrateBackgroundColor(watchedColor);
      const iconColorClass = getSubstrateIconColor(backgroundColor);

      return (
        <>
          <Helmet>
            <title>{pageTitle} - Color KONTROL</title>
          </Helmet>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col min-h-0 p-4 sm:p-6 lg:p-8"
          >
            <form className="flex flex-col min-h-0 flex-1">
              <div className="max-w-6xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <Breadcrumb items={breadcrumbItems} />
                    <div className="mt-2 flex items-center gap-4">
                      <div 
                        className="w-10 h-10 rounded-md border border-gray-200 flex items-center justify-center"
                        style={{ backgroundColor }}
                      >
                        <Layers className={`w-6 h-6 transition-colors duration-300 ${iconColorClass}`} />
                      </div>
                      <h1 className="text-2xl font-bold text-gray-900">{watchedName || pageTitle}</h1>
                    </div>
                  </div>
                  {isNew && (
                    <div className="flex items-center gap-2">
                      <Button onClick={handleCancel} variant="outline" type="button">
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSubmit(onSubmitNew)} 
                        disabled={!watchedName?.trim() || !watch('type') || !watch('material') || !watch('surface_quality')}
                        type="button"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                    </div>
                  )}
                </div>
                
                <Tabs defaultValue="info" className="flex-grow flex flex-col min-h-0">
                  <TabsList className="mb-4 self-start">
                    <TabsTrigger value="info">Info</TabsTrigger>
                    <TabsTrigger value="conditions" disabled={isNew}>Conditions</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                  </TabsList>

                  <TabsContent value="info" className="flex-grow min-h-0 overflow-y-auto">
                    <SubstrateInfoTab
                      register={register}
                      control={control}
                      errors={errors}
                      watch={watch}
                      setValue={setValue}
                      isNew={isNew}
                      substrate={substrate}
                      onSubmitUpdate={onSubmitUpdate}
                      onSubmitNew={onSubmitNew}
                      onCancel={handleCancel}
                    />
                  </TabsContent>
                  <TabsContent value="conditions" className="flex-grow min-h-0 overflow-y-auto">
                    {!isNew && <SubstrateConditionsTab substrateId={substrateId} />}
                  </TabsContent>
                  <TabsContent value="history" className="flex-grow min-h-0 overflow-y-auto">
                    <HistoryTab assetType="Substrate" assetId={substrateId} />
                  </TabsContent>
                </Tabs>
              </div>
            </form>
          </motion.div>
        </>
      );
    };

    export default SubstrateDetail;