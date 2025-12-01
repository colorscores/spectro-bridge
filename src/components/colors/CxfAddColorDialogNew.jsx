import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/context/ProfileContext";
import { toast } from "@/hooks/use-toast";

const CxfAddColorDialog = ({ isOpen, setIsOpen, cxfColors = [], onColorsAdded }) => {
  const { profile } = useProfile();
  const [selectedColorIds, setSelectedColorIds] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectColor = (colorId, isSelected) => {
    setSelectedColorIds(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(colorId);
      } else {
        newSet.delete(colorId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      setSelectedColorIds(new Set(cxfColors.map(color => color.id)));
    } else {
      setSelectedColorIds(new Set());
    }
  };

  const handleCancel = () => {
    setSelectedColorIds(new Set());
    setIsOpen(false);
  };

  const handleImport = async () => {
    if (selectedColorIds.size === 0) {
      toast({
        title: "No colors selected",
        description: "Please select at least one color to import.",
        variant: "destructive"
      });
      return;
    }

    if (!profile?.organization_id || !profile?.id) {
      toast({
        title: 'Error',
        description: 'User profile not available.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedColors = cxfColors.filter(color => selectedColorIds.has(color.id));
      const colorsToInsert = selectedColors.map(color => ({
        name: color.name || color.colorName || 'Unnamed Color',
        hex: color.hex || color.displayHex || '#000000',
        type: 'master',
        measurements: color.measurements ? color.measurements.map(measurement => ({
          mode: measurement.mode || 'M0',
          spectral_data: measurement.spectral_data,
          lab: measurement.lab
        })) : []
      }));

      const { error } = await supabase.rpc('import_cxf_colors', {
        p_colors_data: colorsToInsert,
        p_organization_id: profile.organization_id,
        p_user_id: profile.id,
      });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: `${selectedColors.length} colors have been imported.`,
      });

      if (onColorsAdded) {
        onColorsAdded();
      }

      handleCancel();
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = selectedColorIds.size;
  const totalCount = cxfColors.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import CxF Colors</DialogTitle>
          <DialogDescription>
            Select the colors you want to import from the CxF file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {cxfColors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No colors found in the CxF file.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedCount} of {totalCount} colors selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAll(selectedCount === 0)}
                >
                  {selectedCount === totalCount ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="grid gap-2 max-h-96 overflow-auto">
                {cxfColors.map((color) => (
                  <div key={color.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <input
                      type="checkbox"
                      checked={selectedColorIds.has(color.id)}
                      onChange={(e) => handleSelectColor(color.id, e.target.checked)}
                      className="h-4 w-4"
                    />
                    <div
                      className="w-8 h-8 rounded border"
                      style={{ backgroundColor: color.hex || color.displayHex || '#000000' }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        {color.name || color.colorName || 'Unnamed Color'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {color.hex || color.displayHex || '#000000'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isSubmitting || selectedCount === 0}
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin">⏳</span>
                Importing...
              </>
            ) : (
              `Import ${selectedCount} Color${selectedCount !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CxfAddColorDialog;