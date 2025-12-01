import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle } from 'lucide-react';

const CgatsImportProgressDialog = ({ isLoading, isTransforming }) => {
  if (!isLoading && !isTransforming) return null;

  return (
    <Dialog open={true}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            Processing CGATS File
          </DialogTitle>
          <DialogDescription>
            {isLoading ? 'Reading file...' : 'Transforming and validating color data...'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{isLoading ? 'Loading' : 'Processing'}</span>
              <span>Please wait...</span>
            </div>
            <Progress value={null} className="h-2" />
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-700">
              <strong>Large files may take time to process.</strong> This is normal behavior when importing files with many colors.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CgatsImportProgressDialog;
