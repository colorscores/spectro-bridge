import React, { useState } from 'react';
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
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from 'react-hot-toast';
import { invalidateTagCache } from '@/components/colors/AssignTagsDialog';

const AddTagDialog = ({ isOpen, onOpenChange, onTagAdded, categoryId, organizationId, categoryName, editMode = false }) => {
  const [tagName, setTagName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dialogTitle = categoryName ? `Add new ${categoryName} tag` : 'Add New Tag';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tagName.trim()) {
      toast.error('Tag name cannot be empty.');
      return;
    }
    if (!categoryId) {
      toast.error('A category must be selected.');
      return;
    }
    if (!organizationId) {
      toast.error('Organization not found.');
      return;
    }

    if (editMode) {
      // In edit mode, just create local tag and pass to callback
      const newTag = {
        id: `temp-${Date.now()}`, // temporary ID
        name: tagName.trim(),
        category_id: categoryId,
        organization_id: organizationId,
        isNew: true
      };
      onTagAdded(newTag);
      setTagName('');
      onOpenChange(false);
      return;
    }

    // Original save logic for standalone mode
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('tags')
        .insert([{ name: tagName, category_id: categoryId, organization_id: organizationId }]);
      
      if (error) {
        throw error;
      }
      
      toast.success('Tag added successfully!');
      // Invalidate tag cache so new tag appears in AssignTagsDialog
      invalidateTagCache(organizationId);
      setTagName('');
      onTagAdded();
      onOpenChange(false);
    } catch (error) {
      toast.error(`Error adding tag: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            Create a new tag for the selected category.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., 'Brand A'"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : (editMode ? 'OK' : 'Add Tag')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTagDialog;