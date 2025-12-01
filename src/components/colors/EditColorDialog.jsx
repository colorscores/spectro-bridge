import React, { useState, useEffect, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/context/ProfileContext';
import { useAppContext } from '@/context/AppContext';

const EditColorDialog = ({ isOpen, setIsOpen, color, onColorEdited, allColors }) => {
  const { profile } = useProfile();
  const { updateColorOptimistically, refetch } = useAppContext();
  const [name, setName] = useState('');
  const [standardType, setStandardType] = useState('master');
  const [masterColorId, setMasterColorId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && color) {
      setName(color.name || '');
      setStandardType(color.standard_type || 'master');
      setMasterColorId(color.master_color_id || null);
    }
  }, [color, isOpen]);

  const masterColors = useMemo(() => 
    allColors.filter(c => c.standard_type === 'master' && c.id !== color?.id),
    [allColors, color]
  );

  const handleTypeChange = (type) => {
    setStandardType(type);
    if (type === 'master') {
      setMasterColorId(null);
    } else {
      if (!masterColorId && masterColors.length > 0) {
        setMasterColorId(masterColors[0].id);
      }
    }
  };

  const handleSaveChanges = async () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Color name cannot be empty.', variant: 'destructive' });
      return;
    }

    if (standardType === 'dependent' && !masterColorId) {
      toast({ title: 'Error', description: 'A dependent color must be linked to a master color.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    const updateData = {
      name: name.trim(),
      standard_type: standardType,
      master_color_id: standardType === 'dependent' ? masterColorId : null,
      last_edited_by: profile?.id,
      updated_at: new Date().toISOString(),
    };

    // Apply optimistic update BEFORE database call for instant UI feedback
    if (updateColorOptimistically && color.id) {
      console.log('📝 EditColorDialog: Applying optimistic update for color name change');
      updateColorOptimistically(color.id, updateData);
    }

    const { error } = await supabase
      .from('colors')
      .update(updateData)
      .eq('id', color.id);

    if (error) {
      console.error('Error updating color:', error);
      toast({ title: 'Error updating color', description: error.message, variant: 'destructive' });
      
      // Refetch to revert the optimistic update on error
      if (refetch) refetch();
    } else {
      try {
        // Ensure materialized view reflects latest changes immediately
        await supabase.rpc('refresh_colors_with_full_details');
      } catch (e) {
        console.warn('MV refresh failed (continuing):', e?.message || e);
      }
      toast({ title: 'Success!', description: 'Color has been updated.' });
      setIsOpen(false);
    }
    setIsSubmitting(false);
  };

  if (!color) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Color</DialogTitle>
          <DialogDescription>Make changes to the color details below.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="col-span-3" 
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Type</Label>
            <RadioGroup 
              value={standardType} 
              onValueChange={handleTypeChange} 
              className="col-span-3 flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="master" id="master" />
                <Label htmlFor="master">Master</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dependent" id="dependent" />
                <Label htmlFor="dependent">Dependent</Label>
              </div>
            </RadioGroup>
          </div>
          {standardType === 'dependent' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="master-color" className="text-right">
                Master Color
              </Label>
              <Select 
                value={masterColorId || ''} 
                onValueChange={(value) => setMasterColorId(value)}
              >
                <SelectTrigger id="master-color" className="col-span-3">
                  <SelectValue placeholder="Select a master color" />
                </SelectTrigger>
                <SelectContent>
                  {masterColors.map((master) => (
                    <SelectItem key={master.id} value={master.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: master.hex }} />
                        {master.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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

export default EditColorDialog;