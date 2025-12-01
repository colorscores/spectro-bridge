import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle, FileText } from 'lucide-react';

const LargeFileWarningDialog = ({ 
  isOpen, 
  fileMetadata, 
  currentStage, // 'reading' | 'parsing' | 'transforming'
  progress // percentage if available
}) => {
  if (!isOpen) return null;
  
  const stageMessages = {
    reading: 'Reading file contents...',
    parsing: 'Parsing color data...',
    transforming: 'Processing and validating colors...'
  };
  
  return (
    <Dialog open={isOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {fileMetadata?.isLarge ? 'Processing Large File' : 'Processing File'}
          </DialogTitle>
          <DialogDescription>
            {fileMetadata?.name || 'Processing...'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {fileMetadata?.isLarge && (
            <div className="flex items-start gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-xs text-foreground">
                <strong>Large file detected ({fileMetadata.sizeKB} KB)</strong>
                <br />
                Estimated ~{fileMetadata.estimatedColors} colors. Processing may take 10-30 seconds.
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                {stageMessages[currentStage] || 'Processing...'}
              </span>
              {progress && <span>{progress}%</span>}
            </div>
            <Progress value={progress || null} className="h-2" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LargeFileWarningDialog;
