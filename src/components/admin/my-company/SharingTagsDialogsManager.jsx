import React from 'react';
import AddCategoryDialog from '@/components/admin/AddCategoryDialog';
import EditCategoryDialog from '@/components/admin/EditCategoryDialog';
import AddTagDialog from '@/components/admin/AddTagDialog';
import EditTagDialog from '@/components/admin/EditTagDialog';

const SharingTagsDialogsManager = ({
  dialogs,
  closeDialog,
  activeItems,
  categories,
  selectedCategory,
  parentCategoryTags,
  parentCategory,
  organization,
  onCategoryAdded,
  onCategoryUpdated,
  onTagAdded,
  onTagUpdated,
  editMode = false
}) => {
  return (
    <>
      <AddCategoryDialog 
        isOpen={dialogs.addCategory} 
        setIsOpen={(open) => { if (!open) closeDialog('addCategory'); }} 
        existingCategories={categories} 
        onCategoryAdded={onCategoryAdded} 
        organizationId={organization?.id}
        editMode={editMode}
      />
      <EditCategoryDialog 
        isOpen={dialogs.editCategory} 
        setIsOpen={(open) => { if (!open) closeDialog('editCategory'); }} 
        categoryToEdit={activeItems.categoryToEdit} 
        existingCategories={categories} 
        onCategoryUpdated={onCategoryUpdated}
        editMode={editMode}
      />
      <AddTagDialog 
        isOpen={dialogs.addTag} 
        onOpenChange={() => closeDialog('addTag')} 
        onTagAdded={onTagAdded} 
        categoryId={selectedCategory?.id} 
        categoryName={selectedCategory?.name}
        organizationId={organization?.id}
        editMode={editMode}
      />
      {activeItems.tagToEdit && (
        <EditTagDialog 
          isOpen={dialogs.editTag} 
          setIsOpen={(open) => { if (!open) closeDialog('editTag'); }} 
          tagToEdit={activeItems.tagToEdit} 
          parentCategory={parentCategory}
          parentCategoryTags={parentCategoryTags}
          onTagUpdated={onTagUpdated}
          editMode={editMode}
        />
      )}
    </>
  );
};

export default SharingTagsDialogsManager;