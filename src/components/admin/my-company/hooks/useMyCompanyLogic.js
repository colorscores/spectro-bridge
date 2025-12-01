import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProfile } from '@/context/ProfileContext';
import { buildCategoryTree, flattenCategoryTree } from '@/lib/categoryUtils';
import { debug } from '@/lib/debugUtils';
import { invalidateTagCache } from '@/components/colors/AssignTagsDialog';

// Cache for organization data
const orgDataCache = new Map();

export const useMyCompanyLogic = () => {
  // using direct toast fn
  const { user } = useAuth();
  const { profile, loading: profileLoading, refreshProfile } = useProfile();
  
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
    debug.log(`fetchData called with orgId: ${orgId}, retry: ${retryCount}`);
    
    // Check cache first
    const cacheKey = `org_${orgId}`;
    const cached = orgDataCache.get(cacheKey);
    const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
    
    // Use cache if it's less than 5 minutes old and we're not retrying
    if (cached && cacheAge < 5 * 60 * 1000 && retryCount === 0) {
      debug.log('Using cached data (fresh) — revalidating in background');
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

      debug.time('parallel-queries');
      const [orgRes, locationsRes, categoriesRes, tagsRes] = await Promise.all(queries);


      if (orgRes.error) {
        console.error('useMyCompanyLogic - Organization query error:', orgRes.error);
        // Use cached data if available on error
        if (cached) {
          debug.warn('Using cached data due to error');
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
        console.warn('useMyCompanyLogic - Locations query error:', locationsRes.error);
        setLocations(cached?.locations || []); // Fallback to cached data
      } else {
        setLocations(newData.locations);
      }

      if (categoriesRes.error) {
        console.warn('useMyCompanyLogic - Categories query error:', categoriesRes.error);
        setCategories(cached?.categories || []);
      } else {
        setCategories(newData.categories);
        if (!selectedCategory && newData.categories.length > 0) {
          const brandsCategory = newData.categories.find(c => c.name === 'Brands');
          setSelectedCategory(brandsCategory || newData.categories[0]);
        }
      }

      if (tagsRes.error) {
        console.warn('useMyCompanyLogic - Tags query error:', tagsRes.error);
        setTags(cached?.tags || []);
      } else {
        setTags(newData.tags);
      }

      debug.timeEnd('parallel-queries');
    } catch (error) {
      console.error('useMyCompanyLogic - fetchData error:', error);
      
      // Use cached data if available
      if (cached) {
        debug.warn('Using cached data due to error');
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
        debug.log(`Retrying fetchData (attempt ${retryCount + 1})`);
        setTimeout(() => fetchData(orgId, retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      
      toast({ 
        title: 'Error loading company data', 
        description: `${error.message}. Please refresh the page to try again.`,
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }, [toast, selectedCategory]);

  useEffect(() => {
    const getOrgIdAndFetchData = async () => {
      if (!user) {
        
        setLoading(false);
        return;
      }

      // Wait for profile to be loaded from ProfileContext
      if (profileLoading) {
        
        return;
      }
      
      if (!profile) {
        
        // Trigger a profile refresh and wait for the effect dependencies to rerun
        try { refreshProfile?.(); } catch (_) {}
        // Keep loading state while profile initializes; avoid noisy toasts
        setLoading(true);
        return;
      }
      
      try {
        if (profile.organization_id) {
          
          await fetchData(profile.organization_id);
        } else {
          
          setLoading(false);
          toast({ 
            title: 'No Organization Assigned', 
            description: 'Your profile is not associated with any organization. Please contact an administrator to assign your organization.',
            variant: 'destructive' 
          });
        }
      } catch (error) {
        console.error('useMyCompanyLogic - Error in getOrgIdAndFetchData:', error);
        toast({ title: 'Error loading company data', description: error.message, variant: 'destructive' });
        setLoading(false);
      }
    };
    
    getOrgIdAndFetchData();
  }, [user, profile, profileLoading, fetchData, toast]);

  const refreshData = useCallback(async (type) => {
    
    
    // Invalidate cache when explicitly refreshing
    if (organization) {
      const cacheKey = `org_${organization.id}`;
      orgDataCache.delete(cacheKey);
    }
    
    let error;
    if (type === 'organization' && organization) {
      
      const { data, error: orgError } = await supabase.from('organizations').select('*, profiles(id, role)').eq('id', organization.id).single();
      error = orgError;
      if (!error) {
        
        setOrganization(data);
        // Update cache with fresh data
        const cacheKey = `org_${organization.id}`;
        const cached = orgDataCache.get(cacheKey) || {};
        orgDataCache.set(cacheKey, {
          ...cached,
          organization: data,
          timestamp: Date.now()
        });
      } else {
        
      }
    } else if (type === 'categories' && organization) {
      const { data, error: catError } = await supabase.from('categories').select('*').eq('organization_id', organization.id).order('name');
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
        const cacheKey = `org_${organization.id}`;
        const cached = orgDataCache.get(cacheKey) || {};
        orgDataCache.set(cacheKey, {
          ...cached,
          categories: data,
          timestamp: Date.now()
        });
      }
    } else if (type === 'tags' && organization) {
      const { data, error: tagError } = await supabase.from('tags').select('*, category:categories(name, parent_id)').eq('organization_id', organization.id).order('name');
      error = tagError;
      if (!error) {
        setTags(data);
        // Update cache
        const cacheKey = `org_${organization.id}`;
        const cached = orgDataCache.get(cacheKey) || {};
        orgDataCache.set(cacheKey, {
          ...cached,
          tags: data,
          timestamp: Date.now()
        });
      }
    } else if (type === 'locations' && organization) {
      const { data, error: locError } = await supabase.from('organization_locations').select('*').eq('organization_id', organization.id).order('name');
      error = locError;
      if (!error) {
        setLocations(data);
        // Update cache
        const cacheKey = `org_${organization.id}`;
        const cached = orgDataCache.get(cacheKey) || {};
        orgDataCache.set(cacheKey, {
          ...cached,
          locations: data,
          timestamp: Date.now()
        });
      }
    }
    if (error) toast({ title: `Error refreshing ${type}`, description: error.message, variant: 'destructive' });
  }, [toast, selectedCategory, organization]);

  // Refetch data when user returns to the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && organization?.id) {
        
        refreshData('organization');
      }
    };

    const handleFocus = () => {
      if (organization?.id) {
        
        refreshData('organization');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [organization?.id, refreshData]);

  useEffect(() => {
    const fetchParentTags = async () => {
      if (selectedCategory?.parent_id && organization?.id) {
        const { data, error } = await supabase
          .from('tags')
          .select('id, name')
          .eq('category_id', selectedCategory.parent_id)
          .eq('organization_id', organization.id);
        if (error) toast({ title: 'Error fetching parent tags', description: error.message, variant: 'destructive' });
        setParentCategoryTags(data || []);
      } else {
        setParentCategoryTags([]);
      }
    };
    fetchParentTags();
  }, [selectedCategory, organization, toast]);

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
    if (!dialogs.tagDeleteConfirmation.isOpen || !organization) return;

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
      
      // Try Edge Function first
      try {
        const { data, error } = await supabase.functions.invoke('purge-tag', {
          body: {
            tagId: tagId,
            organizationId: organization.id
          }
        });

        if (!error && data?.success) {
          toast({
            title: "Success",
            description: `Deleting "${tagName}" in background...`,
          });
          closeTagDeleteConfirmation();
          // Invalidate tag cache immediately for better UX
          invalidateTagCache(organization.id);
          setTimeout(() => {
            refreshData('tags');
            toast({
              title: "Complete",
              description: `Tag "${tagName}" deleted successfully.`,
            });
          }, 2000);
          return;
        }
      } catch (edgeError) {
        console.log('Edge function failed, using fallback method:', edgeError);
      }

      // Fallback: Direct database deletion for tags with no associations
      const totalAssociations = (associations?.colors || 0) + (associations?.users || 0) + (associations?.childTags || 0);
      
      if (totalAssociations === 0) {
        // Safe to delete directly - no associations
        const { error: hierarchyError } = await supabase
          .from('tag_hierarchies')
          .delete()
          .or(`tag_id.eq.${tagId},parent_tag_id.eq.${tagId}`);

        if (hierarchyError) {
          console.error('Error deleting tag hierarchies:', hierarchyError);
        }

        const { error: deleteError } = await supabase
          .from('tags')
          .delete()
          .eq('id', tagId)
          .eq('organization_id', organization.id);

        if (deleteError) {
          throw deleteError;
        }

        toast({
          title: "Success",
          description: `Tag "${tagName}" deleted successfully.`,
        });
        // Invalidate tag cache so deleted tag is removed from AssignTagsDialog
        invalidateTagCache(organization.id);
        closeTagDeleteConfirmation();
        refreshData('tags');
      } else {
        throw new Error(`Cannot delete tag: ${associations?.colors || 0} color(s), ${associations?.users || 0} user(s), ${associations?.childTags || 0} child tag(s) associated.`);
      }

    } catch (error) {
      console.error('Error in tag deletion:', error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred while deleting the tag.",
        variant: "destructive",
      });
    } finally {
      setDialogs(prev => ({...prev, tagDeleteConfirmation: { ...prev.tagDeleteConfirmation, loading: false }}));
    }
  };

  const handleDelete = async () => {
    const { type, id } = dialogs.deleteConfirmation;
    
    if (type === 'tag') {
      closeDeleteConfirmation();
      await checkTagAssociations(id);
      return;
    }
    
    let table, dependentTable, foreignKey;
    if (type === 'category') { table = 'categories'; dependentTable = 'tags'; foreignKey = 'category_id'; }
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
      else if (type === 'location') refreshData('locations');
    }
    closeDeleteConfirmation();
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
    dialogs, openDialog, closeDialog, openDeleteConfirmation, closeTagDeleteConfirmation,
    activeItems,
    parentCategoryTags,
    refreshData,
    handleOrgTypeChange,
    handleDelete,
    handleTagDelete,
    ...derivedState,
  };
};