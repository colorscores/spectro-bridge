import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import UserWizard from '@/components/admin/users/UserWizard';

const EditUserTagsDialog = ({ isOpen, setIsOpen, user, onUserUpdated }) => {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit User Sharing Tags</DialogTitle>
        </DialogHeader>
        <UserWizard
          user={user}
          onComplete={onUserUpdated}
          startOnStep={2} // Assuming this prop indicates starting from Sharing Tags step
        />
      </DialogContent>
    </Dialog>
  );
};

export default EditUserTagsDialog;