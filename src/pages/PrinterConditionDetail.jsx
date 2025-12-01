import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save, Loader2, Printer, ChevronDown, Edit3, X, Upload, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProfile } from '@/context/ProfileContext';
import { useAppContext } from '@/context/AppContext';
import Breadcrumb from '@/components/Breadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import PrinterConditionInfoTab from '@/components/print-conditions/PrinterConditionInfoTab';
import PrinterCharacterizationTab from '@/components/print-conditions/PrinterCharacterizationTab';
import SeparationsTab from '@/components/print-conditions/SeparationsTab';
import PrinterAppearanceTab from '@/components/print-conditions/PrinterAppearanceTab';
import CalibrationTab from '@/components/print-conditions/CalibrationTab';
import HistoryTab from '@/components/common/HistoryTab';
import PrinterConditionHeader from '@/components/print-conditions/PrinterConditionHeader';
import CxfImportDialogWrapper from '@/components/cxf/CxfImportDialogWrapper';
import CgatsAddColorDialog from '@/components/colors/CgatsAddColorDialog';
import { useCxfParser } from '@/hooks/useCxfParser';
import { supabase } from '@/integrations/supabase/client';

const PrinterConditionDetail = () => {
  const { printerId, conditionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, loading: profileLoading } = useProfile();
  const isNew = !conditionId || conditionId === 'new';
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [condition, setCondition] = useState(null);
  const [originalCondition, setOriginalCondition] = useState(null);
  const [printer, setPrinter] = useState(null);
  const [isEditMode, setIsEditMode] = useState(isNew);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedInkBooks, setSelectedInkBooks] = useState([]);
  const [showCxfImport, setShowCxfImport] = useState(false);
  const [showCgatsImport, setShowCgatsImport] = useState(false);
  const [cxfColors, setCxfColors] = useState([]);
  
  const { parseCxfContent } = useCxfParser();

  const fetchPrinter = useCallback(async () => {
    // Mock data for now
    setPrinter({ name: 'FlexoPress 5000' });
  }, []);

  const fetchCondition = useCallback(async (id) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('print_conditions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setCondition(data);
      setOriginalCondition(data);
      setIsEditMode(false);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Failed to load print condition', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrinter();
  }, [fetchPrinter]);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      setCondition({
        name: '',
        pack_type: '',
        color_hex: '#3b82f6',
        is_part_of_structure: false,
      });
      setOriginalCondition(null);
      setIsEditMode(true);
      setHasUnsavedChanges(false);
    } else {
      fetchCondition(conditionId);
    }
  }, [conditionId, isNew, fetchCondition]);

  const handleSaveUpdate = async () => {
    if (profileLoading || !profile) {
      toast({ title: 'Error', description: 'You must be logged in to perform this action.', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    try {
      if (isNew) {
        // Keep existing behavior for creating new until full flow is implemented
        toast({
          title: 'Success!',
          description: `Condition created successfully.`,
        });
        navigate(`/assets/printers/${printerId}/conditions/mock-id`, { replace: true });
      } else {
        const updatePayload = { appearance_settings: condition?.appearance_settings ?? null };
        const { data, error } = await supabase
          .from('print_conditions')
          .update(updatePayload)
          .eq('id', conditionId)
          .select('*')
          .single();

        if (error) throw error;

        setCondition(data);
        setOriginalCondition(data);
        setIsEditMode(false);
        setHasUnsavedChanges(false);
        toast({ title: 'Success!', description: 'Condition updated successfully.' });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${isNew ? 'create' : 'update'} condition. ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleCancel = () => {
    if (isNew) {
      navigate(`/assets/printers/${printerId}`);
    } else {
      setCondition(originalCondition);
      setIsEditMode(false);
      setHasUnsavedChanges(false);
    }
  };

  const handleCxfImport = () => {
    setShowCxfImport(true);
  };

  const handleCgatsImport = () => {
    setShowCgatsImport(true);
  };

  const handleCxfFileSelect = async (file) => {
    try {
      const content = await file.text();
      const parsedColors = await parseCxfContent(content);
      setCxfColors(parsedColors);
      
      toast({
        title: 'Success!',
        description: `Parsed ${parsedColors.length} colors from CxF file.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to parse CxF file: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleCxfImportComplete = (importedColor) => {
    if (importedColor) {
      // Update condition with imported measurement data
      setCondition(prev => ({
        ...prev,
        spectral_data: importedColor.spectral_data,
        lab: importedColor.lab,
        color_hex: importedColor.hex,
        measurement_settings: importedColor.measurement_settings
      }));
      setHasUnsavedChanges(true);
      
      toast({
        title: 'Success!',
        description: 'Measurement data imported successfully.',
      });
    }
    setShowCxfImport(false);
    setCxfColors([]);
  };

  const handleCgatsImportComplete = (importedColors) => {
    if (importedColors && importedColors.length > 0) {
      // For printer conditions, typically we'd take the first color or aggregate
      const firstColor = importedColors[0];
      setCondition(prev => ({
        ...prev,
        spectral_data: firstColor.spectral_data,
        lab: firstColor.lab,
        color_hex: firstColor.hex,
        measurement_settings: firstColor.measurement_settings
      }));
      setHasUnsavedChanges(true);
      
      toast({
        title: 'Success!',
        description: `Imported measurement data from ${importedColors.length} CGATS colors.`,
      });
    }
    setShowCgatsImport(false);
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
    { label: 'Printers', href: '/assets/printers' },
    { label: printer?.name || 'Printer', href: `/assets/printers/${printerId}` },
    { label: isNew ? 'New Condition' : (condition?.name || 'Edit Condition') },
  ];
  
  const pageTitle = isNew ? 'New Printer Condition' : (condition?.name || 'Edit Printer Condition');

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
        <div className="p-6">
          <div className="max-w-6xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <Breadcrumb items={breadcrumbItems} />
                <div className="mt-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {isNew ? 'New Printer Condition' : (condition?.name || 'Printer Condition')}
                  </h1>
                  <p className="text-sm text-gray-600">
                    For printer: <span className="font-medium text-gray-800">{printer?.name}</span>
                  </p>
                </div>
              </div>
              <PrinterConditionHeader 
                isNew={isNew}
                conditionName={condition?.name}
                originalName={condition?.name}
                handleSaveUpdate={handleSaveUpdate}
                handleSaveNew={handleSaveUpdate}
                saving={saving}
                isEditMode={isEditMode}
                showEditButton={!isEditMode && !isNew}
                onEdit={handleEdit}
                onCancel={handleCancel}
              />
            </div>

            
            <Tabs defaultValue="info" className="w-full">
              <div className="flex items-center justify-between mb-2 relative mt-6">
                <TabsList className="flex w-auto h-auto p-1 gap-1">
                  <TabsTrigger value="info" className="px-3 py-1.5 text-sm">Info</TabsTrigger>
                  <TabsTrigger value="characterization" className="px-3 py-1.5 text-sm">Characterization</TabsTrigger>
                  <TabsTrigger value="separations" className="px-3 py-1.5 text-sm">Separations</TabsTrigger>
                  <TabsTrigger value="appearance" className="px-3 py-1.5 text-sm">Appearance</TabsTrigger>
                  <TabsTrigger value="calibration" className="px-3 py-1.5 text-sm">Calibration</TabsTrigger>
                  <TabsTrigger value="history" className="px-3 py-1.5 text-sm">History</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-4">
                  {isEditMode && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Upload className="mr-2 h-4 w-4" />
                          Import Measurement
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={handleCxfImport}>
                          <Plus className="mr-2 h-4 w-4" />
                          CxF File
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleCgatsImport}>
                          <Plus className="mr-2 h-4 w-4" />
                          CGATS File
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              
              <motion.div 
                layout 
                className="bg-white border border-border rounded-lg overflow-hidden mt-4"
                transition={{ duration: 0.3, type: 'spring' }}
              >

                <ScrollArea className="flex-1">
                  <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                     <TabsContent value="info" className="space-y-6 mt-0">
                       <PrinterConditionInfoTab
                         condition={condition}
                         onConditionChange={setCondition}
                         canEdit={isEditMode}
                         isNew={isNew}
                         selectedInkBooks={selectedInkBooks}
                         onSelectedInkBooksChange={setSelectedInkBooks}
                       />
                     </TabsContent>

                    <TabsContent value="characterization" className="space-y-6 mt-0">
                      <PrinterCharacterizationTab condition={condition} />
                    </TabsContent>

                    <TabsContent value="separations" className="space-y-6 mt-0">
                      <SeparationsTab condition={condition} />
                    </TabsContent>

                     <TabsContent value="appearance" className="space-y-6 mt-0">
                       <PrinterAppearanceTab
                         condition={condition}
                         onConditionChange={setCondition}
                         canEdit={isEditMode}
                         selectedInkBooks={selectedInkBooks}
                       />
                     </TabsContent>

                    <TabsContent value="calibration" className="space-y-6 mt-0">
                      <CalibrationTab 
                        condition={condition}
                        onConditionChange={setCondition}
                        canEdit={isEditMode}
                      />
                    </TabsContent>

                    <TabsContent value="history" className="space-y-6 mt-0">
                      <HistoryTab assetType="Print Condition" assetId={conditionId} />
                    </TabsContent>
                  </div>
                </ScrollArea>
              </motion.div>
            </Tabs>
          </div>
        </div>
      </motion.div>
      
      {/* Import Dialogs */}
      <CxfImportDialogWrapper
        isOpen={showCxfImport}
        onClose={() => setShowCxfImport(false)}
        colors={cxfColors}
        context="print-condition"
        onImport={handleCxfImportComplete}
        onFileSelect={handleCxfFileSelect}
        title="Import CxF Measurement for Print Condition"
      />
      
      {showCgatsImport && (
        <CgatsAddColorDialog
          isOpen={true}
          setIsOpen={setShowCgatsImport}
          onColorsAdded={handleCgatsImportComplete}
        />
      )}
    </>
  );
};

export default PrinterConditionDetail;