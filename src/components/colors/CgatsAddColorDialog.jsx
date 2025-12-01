import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';

const CgatsAddColorDialog = ({ isOpen, setIsOpen, cgatsColors = [], onSuccess, onImport, onColorsAdded }) => {
  const [isUploading, setIsUploading] = useState(false);
  const { profile } = useProfile();

  const handleImport = async () => {
    if (!cgatsColors || cgatsColors.length === 0) {
      toast.error('No colors to import.');
      return;
    }

    setIsUploading(true);
    toast.loading('Importing colors...');

    try {
      if (typeof onImport === 'function') {
        await onImport(cgatsColors);
      } else {
        // Fallback local import logic
        const colorsToInsert = cgatsColors.map(c => ({
          name: c.name,
          hex: c.hex,
          type: 'dependent',
          measurements: [{
            mode: 'M0',
            spectral_data: c.spectral,
            lab: c.lab,
            tint_percentage: 100
          }]
        }));

        const { data, error } = await supabase.rpc('import_cxf_colors', {
          p_colors_data: colorsToInsert,
          p_organization_id: profile.organization_id,
          p_user_id: profile.id,
        });

        if (error) throw error;
      }

      toast.dismiss();
      toast.success(`Successfully imported ${cgatsColors.length} colors.`);
      if (typeof onSuccess === 'function') onSuccess();
      if (typeof onColorsAdded === 'function') onColorsAdded();
      handleClose();
    } catch (error) {
      toast.dismiss();
      toast.error(`Error importing colors: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setIsUploading(false);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import Colors from CGATS</DialogTitle>
          <DialogDescription>
            {cgatsColors && cgatsColors.length > 0
              ? `Ready to import ${cgatsColors.length} colors.`
              : 'No parsed CGATS colors available.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {cgatsColors && cgatsColors.length > 0 && (
            <div className="mt-4 p-2 bg-green-50 border border-green-200 rounded-md text-center">
              <p className="text-sm text-green-700 font-medium">
                Ready to import {cgatsColors.length} colors.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>Cancel</Button>
          <Button onClick={handleImport} disabled={isUploading || !cgatsColors || cgatsColors.length === 0}>
            {isUploading ? 'Importing...' : `Import ${cgatsColors?.length || 0} Colors`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CgatsAddColorDialog;