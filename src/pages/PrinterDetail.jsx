import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Save, Loader2, Printer, ChevronDown, Edit, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PrinterInfoTab from '@/components/printers/PrinterInfoTab';
import PrinterConditionsTab from '@/components/printers/PrinterConditionsTab';
import PrinterDetailHeader from '@/components/printers/PrinterDetailHeader';
import { useProfile } from '@/context/ProfileContext';
import { useAppContext } from '@/context/AppContext';
import Breadcrumb from '@/components/Breadcrumb';

const PrinterDetail = () => {
  const { printerId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, loading: profileLoading } = useProfile();
  const { appMode } = useAppContext();
  const isNew = !printerId || printerId === 'new';
  
  const { register, handleSubmit, setValue, watch, control, formState: { errors, isSubmitting, isDirty }, reset } = useForm({
    defaultValues: {
      name: '',
      type: '',
      manufacturer: '',
      print_process: '',
      calibrated: false,
    }
  });
  const [loading, setLoading] = useState(!isNew);
  const [printer, setPrinter] = useState(null);
  const [originalPrinter, setOriginalPrinter] = useState(null);
  const [isEditMode, setIsEditMode] = useState(isNew);

  const fetchPrinter = useCallback(async (id) => {
    setLoading(true);
    // For now, we'll use mock data since we don't have a printers table yet
    const mockPrinter = {
      id,
      name: 'FlexoPress 5000',
      type: 'Flexo',
      manufacturer: 'FlexoPrint Inc.',
      print_process: 'Flexographic',
      calibrated: true,
      organization_id: profile?.organization_id
    };
    
    setPrinter(mockPrinter);
    setOriginalPrinter(mockPrinter);
    reset(mockPrinter);
    setLoading(false);
  }, [reset, profile?.organization_id]);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      reset({
        name: '',
        type: '',
        manufacturer: '',
        print_process: '',
        calibrated: false,
      });
      setPrinter(null);
      setOriginalPrinter(null);
    } else {
      fetchPrinter(printerId);
    }
  }, [printerId, isNew, fetchPrinter, reset]);
  
  const onSubmitUpdate = async (formData) => {
    if (profileLoading || !profile) {
        toast({ title: 'Error', description: 'You must be logged in to perform this action.', variant: 'destructive' });
        return;
    }
    try {
      // Mock save for now
      toast({
        title: 'Success!',
        description: `Printer ${isNew ? 'created' : 'updated'} successfully.`,
      });

      if (isNew) {
        navigate(`/assets/printers/mock-id`, { replace: true });
      } else {
        // Update the printer data and exit edit mode
        setPrinter(formData);
        setOriginalPrinter(formData);
        setIsEditMode(false);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${isNew ? 'create' : 'update'} printer. ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const onSubmitNew = async (formData) => {
    if (profileLoading || !profile) {
        toast({ title: 'Error', description: 'You must be logged in to perform this action.', variant: 'destructive' });
        return;
    }
    
    if (originalPrinter && formData.name === originalPrinter.name) {
        toast({ 
            title: 'Different name required', 
            description: 'If you wish to create a new printer, please use a different name than the existing printer.', 
            variant: 'destructive' 
        });
        return;
    }

    try {
      // Mock save for now
      toast({
        title: 'Success!',
        description: 'New printer created successfully.',
      });

      navigate(`/assets/printers/mock-new-id`, { replace: true });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to create new printer. ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleCancel = () => {
    if (originalPrinter) {
      reset(originalPrinter);
    }
    setIsEditMode(false);
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
    { label: 'Printers', href: '/assets/printers' },
    { label: isNew ? 'New Printer' : (printer?.name || 'Edit Printer') },
  ];
  
  const watchedName = watch('name');
  const pageTitle = isNew ? 'New Printer' : (printer?.name || 'Edit Printer');

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
          <div className="mb-4">
            <Breadcrumb items={breadcrumbItems} />
            <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-md border border-gray-200 flex items-center justify-center bg-blue-50">
                    <Printer className="w-6 h-6 text-blue-600" />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight">{watchedName || pageTitle}</h1>
                </div>
                <PrinterDetailHeader 
                  isNew={isNew}
                  printerName={watchedName}
                  originalName={originalPrinter?.name}
                  handleSaveUpdate={handleSubmit(onSubmitUpdate)}
                  handleSaveNew={handleSubmit(onSubmitNew)}
                  saving={isSubmitting}
                  isEditMode={isEditMode}
                  showEditButton={!isEditMode && !isNew}
                  onEdit={handleEdit}
                  onCancel={handleCancel}
                  isDirty={isDirty}
                />
            </div>
          </div>
          
          <Tabs defaultValue="info" className="flex-grow flex flex-col">
            <TabsList className="mb-2 self-start">
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="conditions" disabled={isNew}>Conditions</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="flex-grow">
              <PrinterInfoTab
                register={register}
                control={control}
                errors={errors}
                watch={watch}
                setValue={setValue}
                disabled={!isEditMode}
              />
            </TabsContent>
            <TabsContent value="conditions" className="flex-grow">
              {!isNew && <PrinterConditionsTab printerId={printerId} />}
            </TabsContent>
          </Tabs>
        </form>
      </motion.div>
    </>
  );
};

export default PrinterDetail;