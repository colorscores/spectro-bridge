import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

const ColorSharingValidationDialog = ({ 
  isOpen, 
  onClose, 
  partnerName, 
  partnerLocation,
  unsharedCount,
  totalCount 
}) => {
  const partnerDisplayName = partnerLocation ? 
    `${partnerName} - ${partnerLocation}` : 
    partnerName;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <DialogTitle>Color Sharing Issue</DialogTitle>
          </div>
          <DialogDescription className="mt-2">
            Your Match Request for <strong>{partnerDisplayName}</strong> contains colors that are not shared with them.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="text-sm">
              <span className="font-medium">Total colors:</span> {totalCount}
            </div>
            <div className="text-sm">
              <span className="font-medium">Colors not shared:</span> {unsharedCount}
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground mt-4">
            Use the filters in the Colors list to see what colors are shared, or update the color/partner tags to make additional colors visible.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ColorSharingValidationDialog;