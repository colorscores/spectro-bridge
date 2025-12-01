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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

const AddCategoryDialog = ({ isOpen, setIsOpen, existingCategories, onCategoryAdded, organizationId, editMode = false }) => {
  
  const [categoryName, setCategoryName] = useState('');
  const [connectToParent, setConnectToParent] = useState(false);
  const [parentCategoryId, setParentCategoryId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateCategory = async () => {
    if (!categoryName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Category name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    if (connectToParent && !parentCategoryId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a parent category.',
        variant: 'destructive',
      });
      return;
    }

    if (!organizationId) {
      toast({
        title: 'Validation Error',
        description: 'Organization ID is missing.',
        variant: 'destructive',
      });
      return;
    }

    if (editMode) {
      // In edit mode, just create local category and pass to callback
      const newCategory = {
        id: `temp-${Date.now()}`, // temporary ID
        name: categoryName.trim(),
        parent_id: connectToParent ? parentCategoryId : null,
        organization_id: organizationId,
        isNew: true
      };
      onCategoryAdded(newCategory);
      handleClose();
      return;
    }

    // Original save logic for standalone mode
    setIsSubmitting(true);

    const categoryData = {
      name: categoryName,
      parent_id: connectToParent ? parentCategoryId : null,
      organization_id: organizationId,
    };

    const { data, error } = await supabase
      .from('categories')
      .insert([categoryData])
      .select();

    setIsSubmitting(false);

    if (error) {
      toast({
        title: 'Error creating category',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success!',
        description: `Category "${categoryName}" has been created.`,
      });
      onCategoryAdded();
      handleClose();
    }
  };

  const handleClose = () => {
    setCategoryName('');
    setConnectToParent(false);
    setParentCategoryId(null);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Add new Category</DialogTitle>
          <DialogDescription className="text-center">
            Please enter the category details below
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="category-name">New Category</Label>
            <Input
              id="category-name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Business Units"
            />
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="connect-parent"
                checked={connectToParent}
                onCheckedChange={(checked) => setConnectToParent(!!checked)}
                disabled={existingCategories.length === 0}
              />
              <Label htmlFor="connect-parent" className="font-normal">Connect to Parent Category</Label>
            </div>
            <Select
              value={parentCategoryId == null ? '' : String(parentCategoryId)}
              onValueChange={(value) => setParentCategoryId(isNaN(Number(value)) ? value : Number(value))}
              disabled={!connectToParent || existingCategories.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select parent" />
              </SelectTrigger>
              <SelectContent>
                {existingCategories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleCreateCategory} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : (editMode ? 'OK' : 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddCategoryDialog;