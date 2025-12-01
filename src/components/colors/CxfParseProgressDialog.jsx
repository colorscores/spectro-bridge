import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

const CxfParseProgressDialog = ({ parseProgress }) => {
  if (!parseProgress) return null;

  return (
    <Dialog open={!!parseProgress}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Processing CXF File</DialogTitle>
          <DialogDescription>
            Please wait while we parse your CXF file...
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="capitalize">{parseProgress.stage}</span>
              <span>{parseProgress.progress}%</span>
            </div>
            <Progress value={parseProgress.progress} className="h-2" />
          </div>
          
          {parseProgress.processed && parseProgress.total && (
            <div className="text-sm text-muted-foreground text-center">
              Processed {parseProgress.processed} of {parseProgress.total} objects
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CxfParseProgressDialog;