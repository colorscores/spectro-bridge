import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { buildCategoryTree, flattenCategoryTree } from '@/lib/categoryUtils';

// Cache for organization data
const orgDataCache = new Map();

export const useOrganizationLogic = (organizationId) => {
  const { user } = useAuth();
  
  const [organization, setOrganization] = useState(null);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [dialogs, setDialogs] = useState({
    addCategory: false,
    addTag: false,
    editCategory: false,
    editTag: false,
    addLocation: false,
    editLocation: false,
    deleteConfirmation: { isOpen: false, type: null, id: null },
    tagDeleteConfirmation: { isOpen: false, id: null, associations: null, loading: false },
  });

  const [activeItems, setActiveItems] = useState({
    categoryToEdit: null,
    tagToEdit: null,
    locationToEdit: null,
    activeActionId: null,
  });

  const [parentCategoryTags, setParentCategoryTags] = useState([]);

  const openDialog = (dialogName, payload = null) => {
    setDialogs(prev => ({ ...prev, [dialogName]: true }));
    if (payload) {
      if (dialogName === 'editCategory') setActiveItems(prev => ({ ...prev, categoryToEdit: payload, activeActionId: payload.id }));
      if (dialogName === 'editTag') setActiveItems(prev => ({ ...prev, tagToEdit: payload, activeActionId: payload.id }));
      if (dialogName === 'editLocation') setActiveItems(prev => ({ ...prev, locationToEdit: payload, activeActionId: payload.id }));
    }
  };

  const closeDialog = (dialogName) => {
    setDialogs(prev => ({ ...prev, [dialogName]: false }));
    setActiveItems(prev => ({ 
      ...prev, 
      categoryToEdit: null, 
      tagToEdit: null, 
      locationToEdit: null, 
      activeActionId: null 
    }));
  };
  
  const openDeleteConfirmation = (e, type, id) => {
    e.stopPropagation();
    setActiveItems(prev => ({ ...prev, activeActionId: id }));
    setDialogs(prev => ({...prev, deleteConfirmation: { isOpen: true, type, id }}));
  };

  const closeDeleteConfirmation = () => {
    setDialogs(prev => ({...prev, deleteConfirmation: { isOpen: false, type: null, id: null }}));
    setActiveItems(prev => ({ ...prev, activeActionId: null }));
  }

  const closeTagDeleteConfirmation = () => {
    setDialogs(prev => ({...prev, tagDeleteConfirmation: { isOpen: false, id: null, associations: null, loading: false }}));
    setActiveItems(prev => ({ ...prev, activeActionId: null }));
  }

  const fetchData = useCallback(async (orgId, retryCount = 0) => {
    console.log(`useOrganizationLogic - fetchData called with orgId: ${orgId}, retry: ${retryCount}`);
    
    // Check cache first
    const cacheKey = `org_${orgId}`;
    const cached = orgDataCache.get(cacheKey);
    const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
    
    // Use cache if it's less than 5 minutes old and we're not retrying
    if (cached && cacheAge < 5 * 60 * 1000 && retryCount === 0) {
      console.log('useOrganizationLogic - Using cached data (fresh) — revalidating in background');
      setOrganization(cached.organization);
      setLocations(cached.locations || []);
      setCategories(cached.categories || []);
      setTags(cached.tags || []);
      if (!selectedCategory && cached.categories?.length > 0) {
        const brandsCategory = cached.categories.find(c => c.name === 'Brands');
        setSelectedCategory(brandsCategory || cached.categories[0]);
      }
      setLoading(false);
      // Stale-while-revalidate: refresh in background to pick up any changes
      setTimeout(() => {
        fetchData(orgId, 1);
      }, 0);
      return;
    }
    
    setLoading(true);
    
    try {
      const queries = [
        supabase.from('organizations').select('*, profiles(id, role)').eq('id', orgId).single(),
        supabase.from('organization_locations').select('*').eq('organization_id', orgId).order('name'),
        supabase.from('categories').select('*').eq('organization_id', orgId).order('name'),
        supabase.from('tags').select('*, category:categories(name, parent_id)').eq('organization_id', orgId).order('name')
      ];

      console.log('useOrganizationLogic - Executing parallel queries...');
      const [orgRes, locationsRes, categoriesRes, tagsRes] = await Promise.all(queries);

      console.log('useOrganizationLogic - Query results:', { 
        org: !!orgRes.data, 
        locations: locationsRes.data?.length, 
        categories: categoriesRes.data?.length, 
        tags: tagsRes.data?.length,
        orgError: orgRes.error?.message,
        locationsError: locationsRes.error?.message,
        categoriesError: categoriesRes.error?.message,
        tagsError: tagsRes.error?.message
      });

      if (orgRes.error) {
        console.error('useOrganizationLogic - Organization query error:', orgRes.error);
        // Use cached data if available on error
        if (cached) {
          console.log('useOrganizationLogic - Using cached data due to error');
          setOrganization(cached.organization);
          setLocations(cached.locations || []);
          setCategories(cached.categories || []);
          setTags(cached.tags || []);
          toast({ 
            title: 'Using cached data', 
            description: 'Could not fetch latest data, showing previously loaded information.',
            variant: 'default' 
          });
          setLoading(false);
          return;
        }
        throw orgRes.error;
      }

      const newData = {
        organization: orgRes.data,
        locations: locationsRes.error ? [] : locationsRes.data,
        categories: categoriesRes.error ? [] : categoriesRes.data,
        tags: tagsRes.error ? [] : tagsRes.data,
        timestamp: Date.now()
      };

      // Update cache
      orgDataCache.set(cacheKey, newData);

      setOrganization(newData.organization);

      if (locationsRes.error) {
        console.warn('useOrganizationLogic - Locations query error:', locationsRes.error);
        setLocations(cached?.locations || []); // Fallback to cached data
      } else {
        setLocations(newData.locations);
      }

      if (categoriesRes.error) {
        console.warn('useOrganizationLogic - Categories query error:', categoriesRes.error);
        setCategories(cached?.categories || []);
      } else {
        setCategories(newData.categories);
        if (!selectedCategory && newData.categories.length > 0) {
          const brandsCategory = newData.categories.find(c => c.name === 'Brands');
          setSelectedCategory(brandsCategory || newData.categories[0]);
        }
      }

      if (tagsRes.error) {
        console.warn('useOrganizationLogic - Tags query error:', tagsRes.error);
        setTags(cached?.tags || []);
      } else {
        setTags(newData.tags);
      }

      console.log('useOrganizationLogic - All data fetched successfully');
    } catch (error) {
      console.error('useOrganizationLogic - fetchData error:', error);
      
      // Use cached data if available
      if (cached) {
        console.log('useOrganizationLogic - Using cached data due to error');
        setOrganization(cached.organization);
        setLocations(cached.locations || []);
        setCategories(cached.categories || []);
        setTags(cached.tags || []);
        toast({ 
          title: 'Connection error', 
          description: 'Using previously loaded data. Some information may be outdated.',
          variant: 'destructive' 
        });
        setLoading(false);
        return;
      }
      
      // Retry logic for transient errors
      if (retryCount < 2 && (error.message?.includes('network') || error.message?.includes('timeout') || error.message?.includes('fetch'))) {
        console.log(`useOrganizationLogic - Retrying fetchData (attempt ${retryCount + 1})`);
        setTimeout(() => fetchData(orgId, retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      
      toast({ 
        title: 'Error loading organization data', 
        description: `${error.message}. Please refresh the page to try again.`,
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }, [toast, selectedCategory]);

  useEffect(() => {
    if (organizationId) {
      console.log('useOrganizationLogic - Fetching data for organization:', organizationId);
      fetchData(organizationId);
    } else {
      setLoading(false);
      toast({ 
        title: 'Invalid Organization', 
        description: 'No organization ID provided.',
        variant: 'destructive' 
      });
    }
  }, [organizationId, fetchData, toast]);

  const refreshData = useCallback(async (type) => {
    console.log(`refreshData called for type: ${type}, organization:`, organization);
    
    if (!organizationId) return;
    
    // Invalidate cache when explicitly refreshing
    const cacheKey = `org_${organizationId}`;
    orgDataCache.delete(cacheKey);
    
    let error;
    if (type === 'organization') {
      console.log('Fetching fresh organization data from database...');
      const { data, error: orgError } = await supabase.from('organizations').select('*, profiles(id, role)').eq('id', organizationId).single();
      error = orgError;
      if (!error) {
        console.log('Fresh organization data received:', data);
        setOrganization(data);
        // Update cache with fresh data
        const cached = orgDataCache.get(cacheKey) || {};
        orgDataCache.set(cacheKey, {
          ...cached,
          organization: data,
          timestamp: Date.now()
        });
      } else {
        console.log('Error fetching organization data:', orgError);
      }
    } else if (type === 'categories') {
      const { data, error: catError } = await supabase.from('categories').select('*').eq('organization_id', organizationId).order('name');
      error = catError;
      if (!error) {
        setCategories(data);
        if (selectedCategory) {
          const stillExists = data.find(c => c.id === selectedCategory.id);
          if (!stillExists) setSelectedCategory(data.length > 0 ? data[0] : null);
        } else if (data.length > 0) {
          setSelectedCategory(data[0]);
        }
        // Update cache
        const cached = orgDataCache.get(cacheKey) || {};
        orgDataCache.set(cacheKey, {
          ...cached,
          categories: data,
          timestamp: Date.now()
        });
      }
    } else if (type === 'tags') {
      const { data, error: tagError } = await supabase.from('tags').select('*, category:categories(name, parent_id)').eq('organization_id', organizationId).order('name');
      error = tagError;
      if (!error) {
        setTags(data);
        // Update cache
        const cached = orgDataCache.get(cacheKey) || {};
        orgDataCache.set(cacheKey, {
          ...cached,
          tags: data,
          timestamp: Date.now()
        });
      }
    } else if (type === 'locations') {
      const { data, error: locError } = await supabase.from('organization_locations').select('*').eq('organization_id', organizationId).order('name');
      error = locError;
      if (!error) {
        setLocations(data);
        // Update cache
        const cached = orgDataCache.get(cacheKey) || {};
        orgDataCache.set(cacheKey, {
          ...cached,
          locations: data,
          timestamp: Date.now()
        });
      }
    }
    if (error) toast({ title: `Error refreshing ${type}`, description: error.message, variant: 'destructive' });
  }, [toast, selectedCategory, organizationId, organization]);

  // Refetch data when user returns to the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && organizationId) {
        console.log('Page became visible, refetching organization data');
        refreshData('organization');
      }
    };

    const handleFocus = () => {
      if (organizationId) {
        console.log('Window focused, refetching organization data');
        refreshData('organization');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [organizationId, refreshData]);

  useEffect(() => {
    const fetchParentTags = async () => {
      if (selectedCategory?.parent_id && organizationId) {
        const { data, error } = await supabase
          .from('tags')
          .select('id, name')
          .eq('category_id', selectedCategory.parent_id)
          .eq('organization_id', organizationId);
        if (error) toast({ title: 'Error fetching parent tags', description: error.message, variant: 'destructive' });
        setParentCategoryTags(data || []);
      } else {
        setParentCategoryTags([]);
      }
    };
    fetchParentTags();
  }, [selectedCategory, organizationId, toast]);

  const handleOrgTypeChange = async (newTypes) => {
    if (!organization) return;
    const originalTypes = organization.type;
    setOrganization(prev => ({...prev, type: newTypes}));
    const { error } = await supabase.from('organizations').update({ type: newTypes }).eq('id', organization.id);
    if (error) {
      toast({ title: 'Error updating organization types', description: error.message, variant: 'destructive' });
      setOrganization(prev => ({...prev, type: originalTypes}));
    } else {
      toast({ title: 'Success!', description: 'Organization types updated.' });
    }
  };

  const handleDelete = async () => {
    const { type, id } = dialogs.deleteConfirmation;
    let table, dependentTable, foreignKey;
    if (type === 'category') { table = 'categories'; dependentTable = 'tags'; foreignKey = 'category_id'; }
    else if (type === 'tag') { table = 'tags'; }
    else if (type === 'location') { table = 'organization_locations'; }
    else return;

    if (dependentTable) {
      const { count, error: countError } = await supabase.from(dependentTable).select('*', { count: 'exact', head: true }).eq(foreignKey, id);
      if (countError || count > 0) {
        toast({ title: `Cannot delete ${type}`, description: countError?.message || `This ${type} has ${count} associated items. Please remove them first.`, variant: 'destructive' });
        closeDeleteConfirmation();
        return;
      }
    }

    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      toast({ title: `Error deleting ${type}`, description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success!', description: `The ${type} has been deleted.` });
      if (type === 'category') refreshData('categories');
      else if (type === 'tag') refreshData('tags');
      else if (type === 'location') refreshData('locations');
    }
    closeDeleteConfirmation();
  };

  const checkTagAssociations = async (tagId) => {
    setDialogs(prev => ({...prev, tagDeleteConfirmation: { ...prev.tagDeleteConfirmation, loading: true }}));
    
    try {
      const [colorsRes, usersRes, hierarchiesRes] = await Promise.all([
        supabase.from('tag_associations').select('*', { count: 'exact', head: true }).eq('tag_id', tagId),
        supabase.from('user_sharing_tags').select('*', { count: 'exact', head: true }).eq('tag_id', tagId),
        supabase.from('tag_hierarchies').select('*', { count: 'exact', head: true }).eq('parent_tag_id', tagId)
      ]);

      const associations = {
        colors: colorsRes.count || 0,
        users: usersRes.count || 0, 
        childTags: hierarchiesRes.count || 0
      };

      setDialogs(prev => ({
        ...prev, 
        tagDeleteConfirmation: { 
          isOpen: true, 
          id: tagId, 
          associations, 
          loading: false 
        }
      }));
    } catch (error) {
      toast({ title: 'Error checking associations', description: error.message, variant: 'destructive' });
      setDialogs(prev => ({...prev, tagDeleteConfirmation: { isOpen: false, id: null, associations: null, loading: false }}));
    }
  };

  const handleTagDelete = async () => {
    if (!dialogs.tagDeleteConfirmation.isOpen || !organizationId) return;

    const { id: tagId, associations } = dialogs.tagDeleteConfirmation;
    setDialogs(prev => ({...prev, tagDeleteConfirmation: { ...prev.tagDeleteConfirmation, loading: true }}));
    
    try {
      // Get tag name for user feedback
      const { data: tagData } = await supabase
        .from('tags')
        .select('name')
        .eq('id', tagId)
        .single();
      
      const tagName = tagData?.name || 'Unknown Tag';
      
      // Fallback: Direct database deletion for tags with no associations
      const totalAssociations = (associations?.colors || 0) + (associations?.users || 0) + (associations?.childTags || 0);
      
      if (totalAssociations === 0) {
        // Safe to delete directly - no associations
        const { error: hierarchyError } = await supabase
          .from('tag_hierarchies')
          .delete()
          .or(`tag_id.eq.${tagId},parent_tag_id.eq.${tagId}`);

        if (hierarchyError) {
          throw hierarchyError;
        }

        const { error: deleteError } = await supabase
          .from('tags')
          .delete()
          .eq('id', tagId);

        if (deleteError) {
          throw deleteError;
        }

        toast({
          title: "Success",
          description: `Tag "${tagName}" deleted successfully.`,
        });
        closeTagDeleteConfirmation();
        refreshData('tags');
      } else {
        throw new Error(`Cannot delete tag with ${totalAssociations} associations. Please remove associations first.`);
      }
    } catch (error) {
      console.error('Tag deletion error:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Unable to delete tag. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDialogs(prev => ({...prev, tagDeleteConfirmation: { ...prev.tagDeleteConfirmation, loading: false }}));
    }
  };

  const derivedState = useMemo(() => ({
    filteredTags: selectedCategory ? tags.filter(tag => tag.category_id === selectedCategory.id) : [],
    displayedCategories: flattenCategoryTree(buildCategoryTree(categories)),
    showBelongsTo: !!selectedCategory?.parent_id,
    parentCategory: selectedCategory?.parent_id ? categories.find(c => c.id === selectedCategory.parent_id) : null,
    orgAdmins: organization?.profiles?.filter(p => p.role === 'Admin' || p.role === 'Superadmin').length || 0,
    orgUsers: organization?.profiles?.length || 0,
  }), [selectedCategory, tags, categories, organization]);

  return {
    user,
    organization, setOrganization,
    categories,
    tags,
    locations,
    selectedCategory, setSelectedCategory,
    loading,
    dialogs, openDialog, closeDialog, openDeleteConfirmation,
    activeItems,
    parentCategoryTags,
    refreshData,
    handleOrgTypeChange,
    handleDelete,
    closeTagDeleteConfirmation,
    checkTagAssociations,
    handleTagDelete,
    ...derivedState,
  };
};