import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

const ShareMatchDialog = ({ isOpen, setIsOpen, onConfirm, partnerName, requestorOrgName, actionType }) => {
  // Determine the target organization based on the action type
  const targetOrgName = actionType === 'sent-to-requestor-for-approval' ? requestorOrgName : partnerName;
  const shareText = `Your Match is going to be shared with ${targetOrgName}. As soon as you send your match, it is no longer available to edit.`;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md p-8">
        <DialogHeader className="items-center">
          <div className="bg-blue-100 rounded-full p-3 mb-4">
            <Bell className="h-8 w-8 text-blue-600" />
          </div>
          <DialogTitle className="text-2xl font-bold">Share Match</DialogTitle>
          <DialogDescription className="text-center text-gray-500 mt-2">
            {shareText}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 grid grid-cols-2 gap-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Share Match</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareMatchDialog;