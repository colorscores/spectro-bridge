import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import UserWizard from '@/components/admin/users/UserWizard';

const AddUserDialog = ({ isOpen, setIsOpen, onUserAdded }) => {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
        </DialogHeader>
        <UserWizard
          onComplete={onUserAdded}
        />
      </DialogContent>
    </Dialog>
  );
};

export default AddUserDialog;