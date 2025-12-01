import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from 'react-hot-toast';
import CategoriesTable from './CategoriesTable';
import TagsTable from './TagsTable';
import SharingTagsDialogsManager from './SharingTagsDialogsManager';
import { invalidateTagCache } from '@/components/colors/AssignTagsDialog';
import { buildCategoryHierarchy } from '@/lib/categoryUtils';

// Helper to validate UUIDs
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const toId = (x) => {
  if (!x) return null;
  if (typeof x === 'string') return x.trim() || null;
  return x?.value || x?.id || null;
};
const normalizeIds = (arr) => (Array.isArray(arr) ? arr.map(toId).filter(Boolean) : []);

const SharingTagsManager = forwardRef(({ 
  organization, 
  editing, 
  onStateChange,
  onEditComplete 
}, ref) => {
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [filteredTags, setFilteredTags] = useState([]);
  const [displayedCategories, setDisplayedCategories] = useState([]);
  const [parentCategory, setParentCategory] = useState(null);
  const [parentCategoryTags, setParentCategoryTags] = useState([]);
  const [showBelongsTo, setShowBelongsTo] = useState(false);
  
  // Derive selected category from id to avoid ref churn
  const selectedCategory = React.useMemo(() => (
    categories.find(c => c.id === selectedCategoryId) || null
  ), [categories, selectedCategoryId]);
  
  // Dialog states
  const [dialogs, setDialogs] = useState({
    addCategory: false,
    editCategory: false,
    addTag: false,
    editTag: false,
  });
  const [activeItems, setActiveItems] = useState({
    categoryToEdit: null,
    tagToEdit: null,
  });

  // Track pending changes
  const [pendingChanges, setPendingChanges] = useState({
    categories: [], // new/modified categories
    tags: [], // new/modified tags
    deletedCategories: [],
    deletedTags: []
  });

  const fetchData = useCallback(async () => {
    if (!organization?.id) return;
    
    setLoading(true);
    try {
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('organization_id', organization.id)
        .order('name');
      if (categoriesError) throw categoriesError;
      
      // Fetch tags
      const { data: tagsData, error: tagsError } = await supabase
        .from('tags')
        .select('*')
        .eq('organization_id', organization.id)
        .order('name');
      if (tagsError) throw tagsError;

      setCategories(categoriesData || []);
      setTags(tagsData || []);
      
      if (categoriesData && categoriesData.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(categoriesData[0].id);
      }
    } catch (error) {
      toast.error(`Error fetching data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

// Effect 1: Build hierarchy and manage selectedCategoryId
  useEffect(() => {
    if (!categories.length) {
      setDisplayedCategories([]);
      if (selectedCategoryId) setSelectedCategoryId(null);
      return;
    }

    const displayedCats = buildCategoryHierarchy(categories);
    setDisplayedCategories(displayedCats);

    if (!selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
      return;
    }

    // If current selection no longer exists, select first available
    if (!categories.some(c => c.id === selectedCategoryId)) {
      setSelectedCategoryId(categories[0]?.id ?? null);
    }
  }, [categories, selectedCategoryId]);
  

  // Effect 2: Handle selectedCategory changes - filter tags and find parent
  useEffect(() => {
    if (!selectedCategory) {
      setFilteredTags([]);
      setParentCategory(null);
      setShowBelongsTo(false);
      setParentCategoryTags([]);
      return;
    }

    // Filter tags for selected category
    const categoryTags = tags.filter(tag => tag.category_id === selectedCategory.id);
    setFilteredTags(categoryTags);

    // Check if selected category has parent
    if (selectedCategory.parent_id) {
      const parent = categories.find(cat => cat.id === selectedCategory.parent_id);
      setParentCategory(parent);
      setShowBelongsTo(true);
      
      // Get parent category tags
      const parentTags = tags.filter(tag => tag.category_id === parent?.id);
      setParentCategoryTags(parentTags);
    } else {
      setParentCategory(null);
      setShowBelongsTo(false);
      setParentCategoryTags([]);
    }
  }, [selectedCategory, tags, categories]);


  // Notify parent of changes
  useEffect(() => {
    const hasChanges = pendingChanges.categories.length > 0 || 
                      pendingChanges.tags.length > 0 ||
                      pendingChanges.deletedCategories.length > 0 ||
                      pendingChanges.deletedTags.length > 0;
    
    onStateChange && onStateChange(hasChanges, pendingChanges);
  }, [pendingChanges, onStateChange]);

  const openDialog = (type, item = null) => {
    setDialogs(prev => ({ ...prev, [type]: true }));
    if (item) {
      if (type === 'editCategory') {
        setActiveItems(prev => ({ ...prev, categoryToEdit: item }));
      } else if (type === 'editTag') {
        setActiveItems(prev => ({ ...prev, tagToEdit: item }));
      }
    }
  };

  const closeDialog = (type) => {
    setDialogs(prev => ({ ...prev, [type]: false }));
    if (type === 'editCategory') {
      setActiveItems(prev => ({ ...prev, categoryToEdit: null }));
    } else if (type === 'editTag') {
      setActiveItems(prev => ({ ...prev, tagToEdit: null }));
    }
  };

  const handleCategoryAdded = (newCategory) => {
    // Normalize parent_id to a simple ID string (or leave temp id)
    const normalizedCategory = {
      ...newCategory,
      parent_id: toId(newCategory.parent_id) || null,
    };
    
    if (normalizedCategory.isNew) {
      // Add to pending changes
      setPendingChanges(prev => ({
        ...prev,
        categories: [...prev.categories, normalizedCategory]
      }));
      // Update local state and select only if it's the first category
      setCategories(prev => {
        const next = [...prev, normalizedCategory];
        if (prev.length === 0) {
          setSelectedCategoryId(normalizedCategory.id);
        }
        return next;
      });
    } else {
      // Refresh data for standalone mode
      fetchData();
    }
  };

  const handleCategoryUpdated = (updatedCategory) => {
    const normalized = {
      ...updatedCategory,
      parent_id: toId(updatedCategory.parent_id) || null,
    };
    if (editing) {
      // Update in pending changes
      setPendingChanges(prev => ({
        ...prev,
        categories: prev.categories.some(c => c.id === normalized.id)
          ? prev.categories.map(c => c.id === normalized.id ? normalized : c)
          : [...prev.categories, normalized]
      }));
      // Update local state
      setCategories(prev => prev.map(c => c.id === normalized.id ? normalized : c));
    } else {
      // Refresh data for standalone mode
      fetchData();
    }
  };

  const handleTagAdded = (newTag) => {
    const normalizedTag = {
      ...newTag,
      category_id: toId(newTag.category_id),
      pendingParentTags: normalizeIds(newTag.pendingParentTags),
    };
    if (normalizedTag.isNew) {
      // Add to pending changes
      setPendingChanges(prev => ({
        ...prev,
        tags: [...prev.tags, normalizedTag]
      }));
      // Update local state
      setTags(prev => [...prev, normalizedTag]);
    } else {
      // Refresh data for standalone mode
      fetchData();
    }
  };

  const handleTagUpdated = (updatedTag) => {
    const normalized = {
      ...updatedTag,
      pendingParentTags: normalizeIds(updatedTag.pendingParentTags),
    };
    if (editing) {
      // Update in pending changes
      setPendingChanges(prev => ({
        ...prev,
        tags: prev.tags.some(t => t.id === normalized.id)
          ? prev.tags.map(t => t.id === normalized.id ? normalized : t)
          : [...prev.tags, normalized]
      }));
      
      // Convert pending parent tag IDs to names for display
      let displayParentNames = [];
      if (normalized.pendingParentTags) {
        displayParentNames = normalized.pendingParentTags.map(parentTagId => {
          const parentTag = tags.find(t => t.id === parentTagId);
          return parentTag ? parentTag.name : parentTagId;
        });
      }
      
      // Update local state with display parent names for immediate UI feedback
      setTags(prev => prev.map(t => 
        t.id === normalized.id ? { 
          ...t, 
          ...normalized,
          displayParentTags: displayParentNames
        } : t
      ));
    } else {
      // Refresh data for standalone mode
      fetchData();
    }
  };

  const handleCategoryDelete = (categoryId) => {
    if (editing) {
      setPendingChanges(prev => ({
        ...prev,
        deletedCategories: [...prev.deletedCategories, categoryId],
        categories: prev.categories.filter(c => c.id !== categoryId)
      }));
      setCategories(prev => {
        const next = prev.filter(c => c.id !== categoryId);
        if (selectedCategoryId === categoryId) {
          setSelectedCategoryId(next[0]?.id ?? null);
        }
        return next;
      });
    }
  };

  const handleTagDelete = (tagId) => {
    if (editing) {
      setPendingChanges(prev => ({
        ...prev,
        deletedTags: [...prev.deletedTags, tagId],
        tags: prev.tags.filter(t => t.id !== tagId)
      }));
      setTags(prev => prev.filter(t => t.id !== tagId));
    }
  };

  // Save all pending changes
  const saveChanges = async () => {
    try {
      // Maps for resolving temporary IDs to real UUIDs
      const tempToRealCategoryId = new Map();
      const tempToRealTagId = new Map();

      // Normalize all pending objects into pure ID strings
      const cats = pendingChanges.categories.map(c => ({
        ...c,
        id: toId(c.id) || c.id,
        parent_id: toId(c.parent_id) || null,
        organization_id: toId(c.organization_id) || c.organization_id,
      }));
      const tagsP = pendingChanges.tags.map(t => ({
        ...t,
        id: toId(t.id) || t.id,
        category_id: toId(t.category_id),
        organization_id: toId(t.organization_id) || t.organization_id,
        pendingParentTags: normalizeIds(t.pendingParentTags),
      }));
      const delCats = pendingChanges.deletedCategories.map(toId);
      const delTags = pendingChanges.deletedTags.map(toId);

      // 1) Create new categories first (without unresolved parents)
      for (const category of cats.filter(c => c.isNew)) {
        const parentRaw = toId(category.parent_id);
        const categoryData = {
          name: category.name,
          parent_id: (parentRaw && isUuid(parentRaw)) ? parentRaw : null,
          organization_id: toId(category.organization_id),
        };
        const { data: insertedCat, error: insertCatErr } = await supabase
          .from('categories')
          .insert([categoryData])
          .select('id')
          .maybeSingle();
        if (insertCatErr) throw insertCatErr;
        const newIdForCat = insertedCat?.id; // handle maybeSingle
        if (newIdForCat) tempToRealCategoryId.set(category.id, newIdForCat);
      }

      // 1b) Update existing categories (map possible temp parent refs)
      for (const category of cats.filter(c => !c.isNew)) {
        const mappedParent = toId(category.parent_id);
        const finalParentId = (mappedParent && isUuid(mappedParent)) 
          ? mappedParent 
          : (mappedParent ? tempToRealCategoryId.get(mappedParent) : null);
        const { error: updateCatErr } = await supabase
          .from('categories')
          .update({ name: category.name, parent_id: finalParentId })
          .eq('id', category.id);
        if (updateCatErr) throw updateCatErr;
      }

      // 1c) Fix parent references for newly inserted categories now that we have IDs
      for (const category of cats.filter(c => c.isNew)) {
        const newId = tempToRealCategoryId.get(category.id);
        const parentRawFix = toId(category.parent_id);
        const mappedParent = parentRawFix
          ? (isUuid(parentRawFix) ? parentRawFix : (tempToRealCategoryId.get(parentRawFix) || null))
          : null;
        if (mappedParent) {
          const { error: fixParentErr } = await supabase
            .from('categories')
            .update({ parent_id: mappedParent })
            .eq('id', newId);
          if (fixParentErr) throw fixParentErr;
        }
      }

      // 2) Insert new tags (map category if temp)
      for (const tag of tagsP.filter(t => t.isNew)) {
        const catRaw = toId(tag.category_id);
        const mappedCategoryId = isUuid(catRaw)
          ? catRaw
          : (tempToRealCategoryId.get(catRaw) || null);
        const tagData = {
          name: tag.name,
          category_id: mappedCategoryId,
          organization_id: toId(tag.organization_id),
        };
        const { data: insertedTag, error: insertTagErr } = await supabase
          .from('tags')
          .insert([tagData])
          .select('id')
          .maybeSingle();
        if (insertTagErr) throw insertTagErr;
        const newIdForTag = insertedTag?.id;
        if (newIdForTag) tempToRealTagId.set(tag.id, newIdForTag);
      }

      // 3) Update existing tags (name only for now)
      for (const tag of tagsP.filter(t => !t.isNew)) {
        const { error: nameUpdateError } = await supabase
          .from('tags')
          .update({ name: tag.name })
          .eq('id', tag.id);
        if (nameUpdateError) throw nameUpdateError;
      }

      // 4) Handle tag hierarchies in a separate pass for ALL tags that specify parents
      for (const tag of tagsP.filter(t => t.pendingParentTags !== undefined)) {
        const finalTagId = isUuid(tag.id) ? tag.id : tempToRealTagId.get(tag.id);
        if (!finalTagId) continue; // safety

        // Always reset relationships for tags that provided parent list
        await supabase.from('tag_hierarchies').delete().eq('tag_id', finalTagId);

        const parentIds = normalizeIds(tag.pendingParentTags);
        const mappedParents = parentIds
          .map(pid => (isUuid(pid) ? pid : tempToRealTagId.get(pid)))
          .filter(Boolean);
        if (mappedParents.length > 0) {
          const rows = mappedParents.map(parentId => ({ tag_id: finalTagId, parent_tag_id: parentId }));
          const { error: hierarchyError } = await supabase
            .from('tag_hierarchies')
            .insert(rows);
          if (hierarchyError) throw hierarchyError;
        }
      }

      // 5) Delete categories (skip temps and invalid)
      for (const rawCategoryId of delCats) {
        const categoryId = toId(rawCategoryId);
        if (!categoryId || !isUuid(categoryId) || categoryId.toString().startsWith('temp-')) continue;
        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('id', categoryId);
        if (error) throw error;
      }

      // 6) Delete tags (skip temps and invalid)
      for (const rawTagId of delTags) {
        const tagId = toId(rawTagId);
        if (!tagId || !isUuid(tagId) || tagId.toString().startsWith('temp-')) continue;
        await supabase.from('tag_hierarchies').delete().or(`tag_id.eq.${tagId},parent_tag_id.eq.${tagId}`);
        const { error } = await supabase
          .from('tags')
          .delete()
          .eq('id', tagId);
        if (error) throw error;
      }

      // Invalidate tag cache
      if (organization?.id) {
        invalidateTagCache(organization.id);
      }

      // Clear pending changes
      setPendingChanges({
        categories: [],
        tags: [],
        deletedCategories: [],
        deletedTags: []
      });

      // Refresh data
      await fetchData();

      toast.success('Changes saved successfully!');
      onEditComplete && onEditComplete();
    } catch (error) {
      toast.error(`Error saving changes: ${error.message}`);
      throw error;
    }
  };

  // Discard all pending changes
  const discardChanges = () => {
    setPendingChanges({
      categories: [],
      tags: [],
      deletedCategories: [],
      deletedTags: []
    });
    fetchData(); // Reload original data
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    saveChanges,
    discardChanges
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 h-full">
        <CategoriesTable
          displayedCategories={displayedCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategoryId}
          onAddCategory={editing ? () => openDialog('addCategory') : undefined}
          onEditCategory={editing ? (category) => openDialog('editCategory', category) : undefined}
          onDeleteCategory={editing ? handleCategoryDelete : undefined}
          editing={editing}
        />
      </div>
      <div className="lg:col-span-2 h-full">
        <TagsTable
          tags={filteredTags}
          loading={loading}
          showBelongsTo={showBelongsTo}
          parentCategoryName={parentCategory?.name}
          onAdd={editing ? () => openDialog('addTag') : undefined}
          onEdit={editing ? (tag) => openDialog('editTag', tag) : undefined}
          onDelete={editing ? handleTagDelete : undefined}
          editing={editing}
          onEditComplete={onEditComplete}
        />
      </div>
      
      <SharingTagsDialogsManager
        dialogs={dialogs}
        closeDialog={closeDialog}
        activeItems={activeItems}
        categories={categories}
        selectedCategory={selectedCategory}
        parentCategoryTags={parentCategoryTags}
        parentCategory={parentCategory}
        organization={organization}
        onCategoryAdded={handleCategoryAdded}
        onCategoryUpdated={handleCategoryUpdated}
        onTagAdded={handleTagAdded}
        onTagUpdated={handleTagUpdated}
        editMode={editing}
      />
    </div>
  );
});

export { SharingTagsManager };
export default SharingTagsManager;