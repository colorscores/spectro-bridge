import React, { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { UploadCloud, CheckCircle, Palette, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { extractColorsFromImage, hexToRgb } from '@/lib/colorUtils';

const ColorBox = ({ color, isSelected, onSelect }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={() => onSelect(color.id)}
      className={`relative w-full pt-[100%] rounded-lg cursor-pointer overflow-hidden transition-all duration-200 transform hover:scale-105 ${
        isSelected ? 'ring-4 ring-blue-500 ring-offset-2' : 'ring-1 ring-gray-200'
      }`}
      style={{ backgroundColor: color.hex }}
    >
      {isSelected && (
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-white" />
        </div>
      )}
    </motion.div>
  );
};

const SynthesizeColors = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [extractedColors, setExtractedColors] = useState([]);
  const [selectedColors, setSelectedColors] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result);
        setIsLoading(true);
        // Simulate async color extraction
        setTimeout(() => {
          const colors = extractColorsFromImage(reader.result);
          setExtractedColors(colors);
          setIsLoading(false);
        }, 1500);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleColorSelection = (colorId) => {
    setSelectedColors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(colorId)) {
        newSet.delete(colorId);
      } else {
        newSet.add(colorId);
      }
      return newSet;
    });
  };

  const handleAddColors = async () => {
    if (selectedColors.size === 0) {
      toast({ title: 'No colors selected', description: 'Please select at least one color to add.', variant: 'destructive' });
      return;
    }

    setIsAdding(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      if (!profile) throw new Error('Could not find user organization.');

      const colorsToAdd = extractedColors
        .filter(c => selectedColors.has(c.id))
        .map(c => ({
          name: `Synthesized Color ${c.hex.toUpperCase()}`,
          hex: c.hex,
          organization_id: profile.organization_id,
          created_by: user.id,
          last_edited_by: user.id,
          standard_type: 'master', // Default to master
        }));
      
      const { error } = await supabase.from('colors').insert(colorsToAdd);
      if (error) throw error;
      
      toast({
        title: 'Success!',
        description: `${colorsToAdd.length} new color(s) have been added to your library.`,
      });
      navigate('/assets/colors');
    } catch (error) {
      toast({
        title: 'Error adding colors',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Synthesize Colors - Brand Asset Management</title>
        <meta name="description" content="Generate new colors from an image." />
      </Helmet>
      <div className="p-4 sm:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6">
             <Button variant="ghost" onClick={() => navigate('/assets/colors')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Colors
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Synthesize New Colors</h1>
            <p className="mt-2 text-lg text-gray-600">Upload an image to extract a beautiful color palette.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left side: Uploader */}
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 h-[400px]">
              {imageUrl ? (
                <div className="relative w-full h-full">
                  <img-replace src={imageUrl} alt="Uploaded preview" class="w-full h-full object-contain rounded-md" />
                  <Button onClick={() => document.getElementById('image-upload').click()} className="absolute bottom-4 right-4">
                    Change Image
                  </Button>
                </div>
              ) : (
                <>
                  <UploadCloud className="w-16 h-16 text-gray-400" />
                  <h3 className="mt-4 text-xl font-semibold text-gray-700">Upload an image</h3>
                  <p className="mt-1 text-sm text-gray-500">Drag and drop or click to upload</p>
                  <Button onClick={() => document.getElementById('image-upload').click()} className="mt-6">
                    Select File
                  </Button>
                </>
              )}
              <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>

            {/* Right side: Palette */}
            <div className="p-8 border border-gray-200 rounded-lg bg-white shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <Palette className="w-8 h-8 text-blue-600" />
                <h2 className="text-2xl font-semibold text-gray-800">Extracted Palette</h2>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-[280px]">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                  <p className="mt-4 text-gray-500">Extracting colors...</p>
                </div>
              ) : extractedColors.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 mb-6">
                    {extractedColors.map(color => (
                      <ColorBox
                        key={color.id}
                        color={color}
                        isSelected={selectedColors.has(color.id)}
                        onSelect={toggleColorSelection}
                      />
                    ))}
                  </div>
                   <Button onClick={handleAddColors} disabled={isAdding || selectedColors.size === 0} className="w-full text-lg py-6">
                    {isAdding ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Adding Colors...</>
                    ) : (
                      `Add ${selectedColors.size} Selected Color(s)`
                    )}
                  </Button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-[280px] text-center">
                  <p className="text-gray-500">Your extracted color palette will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default SynthesizeColors;