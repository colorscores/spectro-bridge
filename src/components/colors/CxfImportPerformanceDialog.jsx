import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

const CxfImportPerformanceDialog = ({ isTransforming, parseProgress }) => {
  if (!isTransforming && !parseProgress) return null;

  const isTransformStep = isTransforming && !parseProgress;
  
  return (
    <Dialog open={true}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isTransformStep ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                Processing Colors
              </>
            ) : parseProgress?.stage === 'complete' ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                Parsing Complete
              </>
            ) : (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                Parsing CXF File
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isTransformStep ? (
              'Transforming and validating color data for import...'
            ) : parseProgress?.stage === 'complete' ? (
              'File parsing completed successfully!'
            ) : (
              'Please wait while we parse your CXF file...'
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Parse Progress */}
          {parseProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="capitalize">{parseProgress.stage}</span>
                <span>{parseProgress.progress}%</span>
              </div>
              <Progress value={parseProgress.progress} className="h-2" />
              
              {parseProgress.processed && parseProgress.total && (
                <div className="text-sm text-muted-foreground text-center">
                  Processed {parseProgress.processed} of {parseProgress.total} objects
                </div>
              )}
            </div>
          )}

          {/* Transform Progress */}
          {isTransformStep && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Transforming colors</span>
                <span>Processing...</span>
              </div>
              <Progress value={null} className="h-2" />
              <div className="text-sm text-muted-foreground text-center">
                Converting color data and filtering invalid entries
              </div>
            </div>
          )}

          {/* Platform warning for slow processing */}
          {(isTransformStep || parseProgress?.stage === 'parsing') && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-700">
                <strong>Large files may take time to process.</strong> This is normal behavior when importing files with many colors.
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CxfImportPerformanceDialog;