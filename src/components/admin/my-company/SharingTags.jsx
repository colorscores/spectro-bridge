import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TagsTable from './TagsTable';
import AddTagDialog from '../AddTagDialog';
import EditTagDialog from '../EditTagDialog';
import { Skeleton } from '@/components/ui/skeleton';

const SharingTags = () => {
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(null);
  const [isAddTagDialogOpen, setIsAddTagDialogOpen] = useState(false);
  const [isEditTagDialogOpen, setIsEditTagDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (categoriesError) throw categoriesError;
      setCategories(categoriesData);
      
      if (categoriesData.length > 0) {
        const firstCategoryId = categoriesData[0].id;
        setActiveTab(firstCategoryId);
        const { data: tagsData, error: tagsError } = await supabase
          .from('tags')
          .select('*')
          .eq('category_id', firstCategoryId)
          .order('name');
        if (tagsError) throw tagsError;
        setTags(tagsData);
      } else {
        setTags([]);
      }
    } catch (error) {
      toast.error(`Error fetching data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTabChange = async (categoryId) => {
    setActiveTab(categoryId);
    setLoading(true);
    try {
      const { data: tagsData, error: tagsError } = await supabase
        .from('tags')
        .select('*')
        .eq('category_id', categoryId)
        .order('name');
      if (tagsError) throw tagsError;
      setTags(tagsData);
    } catch (error) {
      toast.error(`Error fetching tags: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    setIsAddTagDialogOpen(true);
  };
  
  const handleEditTag = (tag) => {
    setSelectedTag(tag);
    setIsEditTagDialogOpen(true);
  };

  const handleDeleteTag = async (tagToDelete) => {
    // eslint-disable-next-line no-restricted-globals
    if (confirm(`Are you sure you want to delete the tag "${tagToDelete.name}"?`)) {
      try {
        await supabase.from('tag_hierarchies').delete().or(`tag_id.eq.${tagToDelete.id},parent_tag_id.eq.${tagToDelete.id}`);
        await supabase.from('tags').delete().eq('id', tagToDelete.id);
        toast.success('Tag deleted successfully.');
        fetchData(); // Refresh data
      } catch (error) {
        toast.error(`Error deleting tag: ${error.message}`);
      }
    }
  };

  const onTagAdded = () => {
    handleTabChange(activeTab);
  };

  const onTagEdited = () => {
    handleTabChange(activeTab);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sharing Tags</CardTitle>
        <CardDescription>Manage tags used for sharing assets and information with partners.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && categories.length === 0 ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              {categories.map((category) => (
                <TabsTrigger key={category.id} value={category.id}>
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {categories.map((category) => (
              <TabsContent key={category.id} value={category.id}>
                {loading ? (
                  <Skeleton className="h-64 w-full mt-4" />
                ) : (
                  <TagsTable 
                    tags={tags.filter(t => t.category_id === category.id)}
                    onAdd={handleAddTag}
                    onEdit={handleEditTag}
                    onDelete={handleDeleteTag}
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
      <AddTagDialog 
        isOpen={isAddTagDialogOpen}
        onOpenChange={setIsAddTagDialogOpen}
        onTagAdded={onTagAdded}
        categoryId={activeTab}
      />
      {selectedTag && (
        <EditTagDialog
          isOpen={isEditTagDialogOpen}
          setIsOpen={setIsEditTagDialogOpen}
          tagToEdit={selectedTag}
          onTagUpdated={onTagEdited}
        />
      )}
    </Card>
  );
};

export default SharingTags;