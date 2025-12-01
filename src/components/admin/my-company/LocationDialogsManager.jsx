import React from 'react';
import AddLocationDialog from '@/components/admin/my-company/AddLocationDialog';
import EditLocationDialog from '@/components/admin/my-company/EditLocationDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const LocationDialogsManager = ({
  dialogs,
  closeDialog,
  activeItems,
  organization,
  onRefresh,
  onDelete,
}) => {
  return (
    <>
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
    </>
  );
};

export default LocationDialogsManager;