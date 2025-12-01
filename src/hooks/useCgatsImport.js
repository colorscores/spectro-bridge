import { useState, useRef, useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { parseCgats } from '@/lib/cgatsParser';
import { useProfile } from '@/context/ProfileContext';

import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { computeDefaultDisplayColor } from '@/lib/colorUtils';

export const useCgatsImport = (onSuccessCallback) => {
  const { profile } = useProfile();
  const licenses = useMemo(() => {
    if (!profile?.organization) return { libraries: { plan: 'Free' } };
    return {
      libraries: { plan: profile.organization.color_libraries_license || 'Free' }
    };
  }, [profile?.organization?.color_libraries_license]);
  const { astmTables } = useAstmTablesCache();
  const fileInputRef = useRef(null);
  const [isCgatsAddOpen, setIsCgatsAddOpen] = useState(false);
  const [cgatsColors, setCgatsColors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [fileMetadata, setFileMetadata] = useState(null);
  const [showLargeFileWarning, setShowLargeFileWarning] = useState(false);
  const [processingStage, setProcessingStage] = useState(null);

  const handleAddCgatsClick = () => {
    // Clear any previous colors before opening file picker
    setCgatsColors([]);
    setIsCgatsAddOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Calculate file metadata
    const fileSizeKB = (file.size / 1024).toFixed(2);
    const estimatedColors = Math.floor(file.size / 150); // Rough estimate: ~150 bytes per color
    const isLargeFile = file.size > 500000 || estimatedColors > 1000;
    
    setFileMetadata({
      name: file.name,
      sizeKB: fileSizeKB,
      estimatedColors,
      isLarge: isLargeFile
    });
    
    if (isLargeFile) {
      setShowLargeFileWarning(true);
    }
    
    setProcessingStage('reading');
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setProcessingStage('parsing');
        setIsTransforming(true);
        const content = e.target.result;
        const parsedColors = parseCgats(content);
         if (parsedColors.length === 0) {
          throw new Error("No valid color data found in the file.");
        }
        setCgatsColors(parsedColors);
        setIsCgatsAddOpen(true);
      } catch (error) {
        toast({
          title: 'Error Parsing File',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
        setIsTransforming(false);
        setShowLargeFileWarning(false);
        setProcessingStage(null);
      }
    };
    reader.readAsText(file);
    if (event.target) {
      event.target.value = '';
    }
  };
  
  const handleAddColorsFromCgats = async (colorsToAdd) => {
    if (!profile || !profile.organization_id || !profile.id) {
      toast({ title: 'Error', description: 'User profile not available.', variant: 'destructive' });
      return;
    }

    // Check color limit for free library accounts
    if (licenses.libraries?.plan === 'Free') {
      try {
        const { count, error } = await supabase
          .from('colors')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id);

        if (error) throw error;

        const currentCount = count || 0;
        const newTotal = currentCount + colorsToAdd.length;

        if (newTotal > 20) {
          toast({
            title: 'Color Limit Exceeded',
            description: `Free library accounts are limited to 20 colors. You currently have ${currentCount} colors and are trying to add ${colorsToAdd.length} more. Please upgrade your library license.`,
            variant: 'destructive'
          });
          return;
        }
      } catch (error) {
        console.error('Error checking color count:', error);
        toast({ title: 'Error', description: 'Failed to check color limit.', variant: 'destructive' });
        return;
      }
    }

    try {
        const orgDefaults = profile?.organization || {};
        const colorsToInsert = colorsToAdd.map(c => {
          const source = {};
          if (c.spectral) source.spectral_data = c.spectral;
          if (c.lab) {
            source.lab_l = c.lab.L;
            source.lab_a = c.lab.a;
            source.lab_b = c.lab.b;
            source.lab_illuminant = c.lab.illuminant || 'D50';
          }
          const result = computeDefaultDisplayColor(source, orgDefaults, astmTables);
          const hex = result?.hex || '#E5E7EB';
          return ({
            name: c.name,
            hex,
            type: 'dependent',
            measurements: [{
              mode: 'M0',
              spectral_data: c.spectral,
              lab: c.lab,
              tint_percentage: 100
            }]
          });
        });

      const { error } = await supabase.rpc('import_cxf_colors', {
        p_colors_data: colorsToInsert,
        p_organization_id: profile.organization_id,
        p_user_id: profile.id,
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Success!',
        description: `${colorsToAdd.length} colors have been added to your library.`,
      });
      setIsCgatsAddOpen(false);
      setCgatsColors([]);
      if (onSuccessCallback) {
        // Assuming the callback is for refetching data
        onSuccessCallback();
      }
    } catch (error) {
      toast({
        title: 'Error Adding Colors',
        description: error.message,
        variant: 'destructive',
      });
    }
  };


  return {
    fileInputRef,
    isCgatsAddOpen,
    cgatsColors,
    setIsCgatsAddOpen,
    handleAddCgatsClick,
    handleFileChange,
    handleAddColorsFromCgats,
    isLoading,
    isTransforming,
    fileMetadata,
    showLargeFileWarning,
    setShowLargeFileWarning,
    processingStage,
  };
};