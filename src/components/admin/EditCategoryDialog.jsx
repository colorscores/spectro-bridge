import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { buildCategoryTree, getDescendantIds } from '@/lib/categoryUtils';

const EditCategoryDialog = ({ isOpen, setIsOpen, categoryToEdit, existingCategories, onCategoryUpdated, editMode = false }) => {
  const [categoryName, setCategoryName] = useState('');
  const [selectedParent, setSelectedParent] = useState(null);
  

  useEffect(() => {
    if (categoryToEdit) {
      setCategoryName(categoryToEdit.name);
      setSelectedParent(categoryToEdit.parent_id ? String(categoryToEdit.parent_id) : 'none');
    }
  }, [categoryToEdit]);

  const handleUpdateCategory = async () => {
    if (!categoryName.trim()) {
      toast({ title: 'Validation Error', description: 'Category name cannot be empty.', variant: 'destructive' });
      return;
    }

    const parent_id = selectedParent === 'none' ? null : (isNaN(Number(selectedParent)) ? selectedParent : Number(selectedParent));

    if (editMode) {
      // In edit mode, just update local state and close dialog
      const updatedCategory = {
        ...categoryToEdit,
        name: categoryName.trim(),
        parent_id
      };
      onCategoryUpdated(updatedCategory);
      setIsOpen(false);
      return;
    }

    // Original save logic for standalone mode
    const { data, error } = await supabase
      .from('categories')
      .update({ 
        name: categoryName.trim(),
        parent_id
      })
      .eq('id', categoryToEdit.id);

    if (error) {
      toast({ title: 'Error updating category', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success!', description: 'Category has been updated.' });
      onCategoryUpdated();
      setIsOpen(false);
    }
  };

  const availableParents = useMemo(() => {
    if (!categoryToEdit) return [];
    const categoryTree = buildCategoryTree(existingCategories);
    const descendantIds = getDescendantIds(categoryToEdit.id, categoryTree);
    const unselectableIds = new Set([categoryToEdit.id, ...descendantIds]);
    
    return existingCategories.filter(c => !unselectableIds.has(c.id));
  }, [categoryToEdit, existingCategories]);

  if (!categoryToEdit) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="parent" className="text-right">Parent</Label>
            <Select value={selectedParent} onValueChange={setSelectedParent}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a parent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Top-level)</SelectItem>
                {availableParents.map(cat => (
                  <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateCategory}>{editMode ? 'OK' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditCategoryDialog;