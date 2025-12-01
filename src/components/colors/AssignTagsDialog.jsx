
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MultiSelect } from '@/components/ui/multi-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from 'react-hot-toast';
import { useProfile } from '@/context/ProfileContext';
import { useAppContext } from '@/context/AppContext';
import { Label } from '@/components/ui/label';

// Simple cache for tags per organization to avoid refetching
const tagCache = new Map();

// Export function to invalidate the tag cache
export const invalidateTagCache = (organizationId) => {
  if (organizationId) {
    tagCache.delete(organizationId);
  } else {
    // Clear all if no specific org ID
    tagCache.clear();
  }
};

const AssignTagsDialog = ({ isOpen, onOpenChange, selectedColors, onTagsAssigned }) => {
  const { profile } = useProfile();
  const { updateColorTagsOptimistically } = useAppContext();
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [operationMode, setOperationMode] = useState('add');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const colorIds = useMemo(() => (selectedColors || []).map(c => c.id), [selectedColors]);

  const isDependentSelection = useMemo(() => {
    if (!selectedColors || selectedColors.length === 0) return false;
    return selectedColors.every(c => (c.standard_type || '').toLowerCase() === 'dependent');
  }, [selectedColors]);

  // Create a lookup map to normalize tag IDs to objects
  const tagLookup = useMemo(() => {
    const map = new Map();
    for (const opt of tags) {
      const id = opt.value;
      const [maybeCategory, maybeName] = String(opt.label || '').split(' / ');
      const name = maybeName || maybeCategory || '';
      const categoryName = opt.group || maybeCategory || 'Uncategorized';
      map.set(id, { id, name, category_name: categoryName });
    }
    return map;
  }, [tags]);

  // Helper to normalize a tag value (ID or object) to an object
  const normalizeToObject = useCallback((val) => {
    if (val && typeof val === 'object') return val;
    return tagLookup.get(val) || (val ? { id: val } : null);
  }, [tagLookup]);

  // Helper to remove duplicate tags by ID
  const uniqById = useCallback((arr) => {
    const seen = new Set();
    const out = [];
    for (const t of arr) {
      if (!t || !t.id) continue;
      if (!seen.has(t.id)) {
        seen.add(t.id);
        out.push(t);
      }
    }
    return out;
  }, []);

  const fetchTags = useCallback(async () => {
    if (!profile?.organization_id) return;
    
    // Check cache first
    const cacheKey = profile.organization_id;
    if (tagCache.has(cacheKey)) {
      setTags(tagCache.get(cacheKey));
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, category:categories(name)')
        .order('name', { ascending: true });

      if (error) throw error;

      const formattedTags = data.map(tag => ({
        value: tag.id,
        label: `${tag.category?.name || 'Uncategorized'} / ${tag.name}`,
        group: tag.category?.name || 'Uncategorized',
      }));
      
      // Cache the result for 5 minutes
      tagCache.set(cacheKey, formattedTags);
      setTimeout(() => tagCache.delete(cacheKey), 5 * 60 * 1000);
      
      setTags(formattedTags);
    } catch (error) {
      toast.error(`Failed to fetch tags: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.organization_id]);

  const fetchCurrentTags = useCallback(async () => {
    if (!colorIds || colorIds.length === 0) {
      setSelectedTags([]);
      return;
    }
    
    // Only fetch current tags for "Remove tags" mode
    if (operationMode !== 'remove') {
      setSelectedTags([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tag_associations')
        .select('color_id, tag_id')
        .in('color_id', colorIds);

      if (error) throw error;

      if (data.length > 0) {
        const tagsByColor = data.reduce((acc, { color_id, tag_id }) => {
          if (!acc[color_id]) {
            acc[color_id] = new Set();
          }
          acc[color_id].add(tag_id);
          return acc;
        }, {});

        const colorIdKeys = Object.keys(tagsByColor);
        if (colorIdKeys.length > 0) {
          let commonTags = new Set(tagsByColor[colorIdKeys[0]]);
          for (let i = 1; i < colorIdKeys.length; i++) {
            const currentTags = tagsByColor[colorIdKeys[i]];
            commonTags = new Set([...commonTags].filter(tagId => currentTags.has(tagId)));
          }
          setSelectedTags(Array.from(commonTags));
        } else {
          setSelectedTags([]);
        }
      } else {
        setSelectedTags([]);
      }
    } catch (error) {
      toast.error(`Failed to fetch current tags: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [colorIds, operationMode]);

  useEffect(() => {
    if (isOpen) {
      // Always invalidate cache when dialog opens to ensure fresh data
      if (profile?.organization_id) {
        invalidateTagCache(profile.organization_id);
      }
      fetchTags();
      fetchCurrentTags();
    }
  }, [isOpen, fetchTags, fetchCurrentTags, profile?.organization_id]);

  // Clear selected tags when operation mode changes
  useEffect(() => {
    if (operationMode === 'add') {
      setSelectedTags([]);
    } else if (operationMode === 'remove') {
      fetchCurrentTags();
    } else if (operationMode === 'remove_all') {
      setSelectedTags([]);
    }
  }, [operationMode, fetchCurrentTags]);

  const getOperationDescription = () => {
    switch (operationMode) {
      case 'add':
        return `Add tags to the selected ${colorIds.length} color(s). Existing tags will be preserved.`;
      case 'remove':
        return `Remove specific tags from the selected ${colorIds.length} color(s). Other tags will be preserved.`;
      case 'remove_all':
        return `Remove all tags from the selected ${colorIds.length} color(s). This action cannot be undone.`;
      default:
        return `Manage tags for the selected ${colorIds.length} color(s).`;
    }
  };

  const getButtonText = () => {
    if (isSubmitting) {
      switch (operationMode) {
        case 'add': return 'Adding...';
        case 'remove': return 'Removing...';
        case 'remove_all': return 'Removing All...';
        default: return 'Processing...';
      }
    }
    switch (operationMode) {
      case 'add': return 'Add Tags';
      case 'remove': return 'Remove Tags';
      case 'remove_all': return 'Remove All Tags';
      default: return 'Save Changes';
    }
  };

  const handleSubmit = async () => {
    if (!profile?.organization_id || !profile?.id) {
      toast.error('You must be logged in to assign tags.');
      return;
    }

    // Validate that tags are selected for add/remove operations
    if ((operationMode === 'add' || operationMode === 'remove') && selectedTags.length === 0) {
      toast.error(`Please select tags to ${operationMode}.`);
      return;
    }

    setIsSubmitting(true);
    
    const progressToast = toast.loading(getButtonText().replace(/\.\.\.$/, 'ing...'));
    
    try {
      console.log(`[AssignTagsDialog] Submitting ${operationMode} operation:`, {
        colorIds: colorIds.length,
        selectedTags: selectedTags.length,
        operationMode
      });

      // OPTIMISTIC UPDATE: Update the UI before the database operation
      // Calculate what the new tags should be for each color
      let optimisticTags;
      if (operationMode === 'add') {
        // For add mode, we'll add the new tags to existing tags
        // Note: The actual tag merge happens in the updateColorTagsOptimistically function
        optimisticTags = selectedTags;
      } else if (operationMode === 'remove') {
        // For remove mode, we'll remove the selected tags
        optimisticTags = selectedTags; // These will be removed
      } else if (operationMode === 'remove_all') {
        // For remove all, set to empty array
        optimisticTags = [];
      }

      // Apply optimistic update with normalized objects
      if (updateColorTagsOptimistically) {
        console.log('[AssignTagsDialog] Applying optimistic update:', { operationMode, colorIds: colorIds.length });
        colorIds.forEach(colorId => {
          const currentColor = selectedColors.find(c => c.id === colorId);
          const currentTagsRaw = currentColor?.tags || [];
          const currentTagObjects = currentTagsRaw
            .map(normalizeToObject)
            .filter(Boolean);

          let newTagObjects = [];
          if (operationMode === 'add') {
            const addedObjects = selectedTags.map(id => normalizeToObject(id)).filter(Boolean);
            newTagObjects = uniqById([...currentTagObjects, ...addedObjects]);
          } else if (operationMode === 'remove') {
            const idsToRemove = new Set(selectedTags);
            newTagObjects = currentTagObjects.filter(t => !idsToRemove.has(t.id));
          } else {
            // Remove all
            newTagObjects = [];
          }

          updateColorTagsOptimistically([colorId], newTagObjects);
        });
      }

      // Call the edge function with operation mode
      const { data, error } = await supabase.functions.invoke('assign-tags', {
        body: {
          color_ids: colorIds,
          tag_ids: selectedTags,
          organization_id: profile.organization_id,
          user_id: profile.id,
          operation_mode: operationMode
        }
      });

      if (error) throw error;

      console.log(`[AssignTagsDialog] Operation successful:`, data);

      // Success message based on operation mode
      let successMessage;
      switch (operationMode) {
        case 'add':
          successMessage = `Added ${selectedTags.length} tag(s) to ${colorIds.length} color(s)`;
          break;
        case 'remove':
          successMessage = `Removed ${selectedTags.length} tag(s) from ${colorIds.length} color(s)`;
          break;
        case 'remove_all':
          successMessage = `Cleared all tags from ${colorIds.length} color(s)`;
          break;
        default:
          successMessage = `Tags updated for ${colorIds.length} color(s)`;
      }
      
      toast.success(successMessage, { id: progressToast });
      
      // Close dialog - optimistic update already handled UI, no need to refetch
      onOpenChange(false);
    } catch (error) {
      console.error('Tag assignment failed:', error);
      
      const actionType = operationMode === 'remove_all' ? 'clearing all tags' : `${operationMode}ing tags`;
      toast.error(`Failed ${actionType}: ${error.message}`, { id: progressToast });
      
      // On error, call onTagsAssigned if provided to trigger refetch for rollback
      if (typeof onTagsAssigned === 'function') {
        onTagsAssigned();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>
            {getOperationDescription()}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Operation</Label>
            <RadioGroup value={operationMode} onValueChange={setOperationMode} className="flex flex-row space-x-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="add" id="add" />
                <Label htmlFor="add" className="text-sm cursor-pointer">Add tags</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="remove" id="remove" />
                <Label htmlFor="remove" className="text-sm cursor-pointer">Remove tags</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="remove_all" id="remove_all" />
                <Label htmlFor="remove_all" className="text-sm cursor-pointer">Remove all tags</Label>
              </div>
            </RadioGroup>
          </div>
          
          {operationMode !== 'remove_all' && (
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {operationMode === 'add' ? 'Tags to Add' : 'Tags to Remove'}
              </Label>
              <MultiSelect
                options={tags}
                selected={selectedTags}
                onChange={setSelectedTags}
                isLoading={isLoading}
                placeholder={operationMode === 'add' ? 'Select tags to add...' : 'Select tags to remove...'}
                className="w-full"
                isGrouped={true}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || isLoading || (operationMode !== 'remove_all' && selectedTags.length === 0)}
          >
            {getButtonText()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignTagsDialog;
