import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { MultiSelect } from '@/components/ui/multi-select';
import { invalidateTagCache } from '@/components/colors/AssignTagsDialog';

// Helper functions for UUID validation
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const isTempId = (v) => typeof v === 'string' && v.startsWith('temp-');
const toId = (x) => {
  if (!x) return null;
  if (typeof x === 'string') return x.trim() || null;
  return x?.value || x?.id || null;
};
const normalizeIds = (arr) => (Array.isArray(arr) ? arr.map(toId).filter(Boolean) : []);

const EditTagDialog = ({ isOpen, setIsOpen, tagToEdit, onTagUpdated, parentCategory, parentCategoryTags, editMode = false }) => {
  const [tagName, setTagName] = useState('');
  const [selectedParentTags, setSelectedParentTags] = useState([]);
  

  useEffect(() => {
    if (!isOpen || !tagToEdit) {
      setTagName('');
      setSelectedParentTags([]);
      return;
    }
    
    setTagName(tagToEdit.name);

    // Skip Supabase fetch for temp IDs or in edit mode
    const shouldSkipFetch = editMode || !isUuid(tagToEdit.id) || isTempId(tagToEdit.id);

    if (shouldSkipFetch) {
      setSelectedParentTags(normalizeIds(tagToEdit.pendingParentTags));
      return;
    }

    const fetchCurrentParents = async () => {
      const { data, error } = await supabase
        .from('tag_hierarchies')
        .select('parent_tag_id')
        .eq('tag_id', tagToEdit.id);
      
      if (data) {
        setSelectedParentTags(data.map(item => item.parent_tag_id));
      }
      if (error) {
        toast({ title: 'Error fetching parent tags', description: error.message, variant: 'destructive' });
      }
    };

    fetchCurrentParents();
  }, [isOpen, tagToEdit?.id, editMode]);

  const handleUpdateTag = async () => {
    if (!tagName.trim()) {
      toast({ title: 'Validation Error', description: 'Tag name cannot be empty.', variant: 'destructive' });
      return;
    }

    if (editMode) {
      // In edit mode, just update local state and close dialog
      const updatedTag = {
        ...tagToEdit,
        name: tagName.trim(),
        pendingParentTags: normalizeIds(selectedParentTags)
      };
      onTagUpdated(updatedTag);
      setIsOpen(false);
      return;
    }

    // Original save logic for standalone mode
    const { error: nameUpdateError } = await supabase
      .from('tags')
      .update({ name: tagName.trim() })
      .eq('id', tagToEdit.id);

    if (nameUpdateError) {
      toast({ title: 'Error updating tag name', description: nameUpdateError.message, variant: 'destructive' });
      return;
    }

    try {
      await supabase.from('tag_hierarchies').delete().eq('tag_id', tagToEdit.id);
      
      if (selectedParentTags.length > 0) {
        const normalizedParents = normalizeIds(selectedParentTags);
        const newHierarchies = normalizedParents.map(parentId => ({
          tag_id: tagToEdit.id,
          parent_tag_id: parentId,
        }));
        const { error: hierarchyError } = await supabase
          .from('tag_hierarchies')
          .insert(newHierarchies);
        if (hierarchyError) throw hierarchyError;
      }
      
      toast({ title: 'Success!', description: 'Tag has been updated.' });
      // Invalidate tag cache so updated tag appears correctly in AssignTagsDialog
      if (tagToEdit?.organization_id) {
        invalidateTagCache(tagToEdit.organization_id);
      }
      onTagUpdated();
      setIsOpen(false);
    } catch (error) {
       toast({ title: 'Error updating tag association', description: error.message, variant: 'destructive' });
    }
  };

  if (!tagToEdit) return null;

  const parentTagOptions = parentCategoryTags.map(tag => ({
    value: tag.id,
    label: tag.name,
  }));

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Tag</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" value={tagName} onChange={(e) => setTagName(e.target.value)} className="col-span-3" />
          </div>
          {parentCategory && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="parent-tag" className="text-right">Belongs To ({parentCategory.name})</Label>
              <div className="col-span-3">
                <MultiSelect
                  options={parentTagOptions}
                  selected={selectedParentTags}
                  onChange={(vals) => setSelectedParentTags(normalizeIds(vals))}
                  placeholder="Select parent tags..."
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateTag}>{editMode ? 'OK' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditTagDialog;