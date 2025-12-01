import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/hooks/use-toast';

const ChangeColorTypeDialog = ({ isOpen, setIsOpen, selectedColors, onTypeChanged }) => {
  const [standardType, setStandardType] = useState('master');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSaveChanges = async () => {
    if (selectedColors.length === 0) {
      toast({ title: 'No colors selected', description: 'Please select at least one color.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.rpc('update_color_standard_type', {
      p_color_ids: selectedColors.map(c => c.id),
      p_standard_type: standardType,
    });

    if (error) {
      console.error('Error updating color types:', error);
      toast({ title: 'Error updating color types', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success!', description: `${selectedColors.length} color(s) have been updated.` });
      onTypeChanged();
      setIsOpen(false);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Color Type</DialogTitle>
          <DialogDescription>
            Change the standard type for the {selectedColors.length} selected color(s).
            Note: Changing to 'Dependent' will not assign a master. Edit individual colors to assign a master.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Type</Label>
            <RadioGroup 
              value={standardType} 
              onValueChange={setStandardType} 
              className="col-span-3 flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="master" id="bulk-master" />
                <Label htmlFor="bulk-master">Master</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dependent" id="bulk-dependent" />
                <Label htmlFor="bulk-dependent">Dependent</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSaveChanges} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChangeColorTypeDialog;