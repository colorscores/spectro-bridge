import React from 'react';
import AddCategoryDialog from '@/components/admin/AddCategoryDialog';
import EditCategoryDialog from '@/components/admin/EditCategoryDialog';
import AddTagDialog from '@/components/admin/AddTagDialog';
import EditTagDialog from '@/components/admin/EditTagDialog';
import AddLocationDialog from '@/components/admin/my-company/AddLocationDialog';
import EditLocationDialog from '@/components/admin/my-company/EditLocationDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2 } from 'lucide-react';

const DialogsManager = ({
  dialogs,
  closeDialog,
  activeItems,
  categories,
  selectedCategory,
  parentCategoryTags,
  parentCategory,
  organization,
  onRefresh,
  onDelete,
  onTagDelete,
  closeTagDeleteConfirmation,
}) => {
  return (
    <>
      <AddCategoryDialog 
        isOpen={dialogs.addCategory} 
        setIsOpen={() => closeDialog('addCategory')} 
        existingCategories={categories} 
        onCategoryAdded={() => onRefresh('categories')} 
        organizationId={organization?.id}
      />
      <EditCategoryDialog 
        isOpen={dialogs.editCategory} 
        setIsOpen={() => closeDialog('editCategory')} 
        categoryToEdit={activeItems.categoryToEdit} 
        existingCategories={categories} 
        onCategoryUpdated={() => onRefresh('categories')} 
      />
      <AddTagDialog 
        isOpen={dialogs.addTag} 
        onOpenChange={() => closeDialog('addTag')} 
        onTagAdded={() => onRefresh('tags')} 
        categoryId={selectedCategory?.id} 
        categoryName={selectedCategory?.name}
        organizationId={organization?.id}
      />
      {activeItems.tagToEdit && (
        <EditTagDialog 
          isOpen={dialogs.editTag} 
          setIsOpen={() => closeDialog('editTag')} 
          tagToEdit={activeItems.tagToEdit} 
          parentCategory={parentCategory}
          parentCategoryTags={parentCategoryTags}
          onTagUpdated={() => onRefresh('tags')}
        />
      )}
      <AddLocationDialog 
        isOpen={dialogs.addLocation} 
        setIsOpen={() => closeDialog('addLocation')} 
        organizationId={organization?.id}
        onLocationAdded={() => onRefresh('locations')}
      />
      <EditLocationDialog
        isOpen={dialogs.editLocation}
        setIsOpen={() => closeDialog('editLocation')}
        locationToEdit={activeItems.locationToEdit}
        onLocationUpdated={() => onRefresh('locations')}
      />
      <AlertDialog open={dialogs.deleteConfirmation.isOpen} onOpenChange={isOpen => !isOpen && closeDialog('deleteConfirmation')}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {dialogs.deleteConfirmation.type}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => closeDialog('deleteConfirmation')}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={dialogs.tagDeleteConfirmation.isOpen} onOpenChange={isOpen => !isOpen && closeTagDeleteConfirmation()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag and Associations</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {dialogs.tagDeleteConfirmation.loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Checking associations...</span>
                </div>
              ) : dialogs.tagDeleteConfirmation.associations ? (
                <>
                  <p>Deleting this tag will also remove it from:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li><strong>{dialogs.tagDeleteConfirmation.associations.colors}</strong> colors</li>
                    <li><strong>{dialogs.tagDeleteConfirmation.associations.users}</strong> user sharing settings</li>
                    <li><strong>{dialogs.tagDeleteConfirmation.associations.childTags}</strong> child tag relationships</li>
                  </ul>
                  <p className="text-red-600 font-medium">This action cannot be undone.</p>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeTagDeleteConfirmation} disabled={dialogs.tagDeleteConfirmation.loading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={onTagDelete} 
              className="bg-red-600 hover:bg-red-700"
              disabled={dialogs.tagDeleteConfirmation.loading || !dialogs.tagDeleteConfirmation.associations}
            >
              {dialogs.tagDeleteConfirmation.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DialogsManager;