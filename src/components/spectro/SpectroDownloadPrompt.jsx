import React from 'react';
import { motion } from 'framer-motion';
import { Download, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Prompt shown when Spectro Bridge is not installed
 * Provides download link and installation instructions
 */
const SpectroDownloadPrompt = ({ downloadUrl, onRetry }) => {
  const handleDownload = () => {
    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-600 dark:text-amber-400">
          Spectro Bridge Not Detected
        </AlertTitle>
        <AlertDescription className="text-muted-foreground">
          To use a spectrophotometer, you need to install the Spectro Bridge desktop application.
        </AlertDescription>
      </Alert>

      <div className="bg-card rounded-lg border border-border p-4 space-y-4">
        <h4 className="font-medium text-foreground">Installation Steps</h4>
        
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Download the Spectro Bridge installer for your platform</li>
          <li>Run the installer and follow the setup wizard</li>
          <li>Launch Spectro Bridge from your Applications folder</li>
          <li>Accept the security certificate when prompted in your browser</li>
          <li>Connect your spectrophotometer via USB</li>
        </ol>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleDownload} className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Download Spectro Bridge
          </Button>
          
          <Button variant="outline" onClick={onRetry}>
            Retry Connection
          </Button>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          <span>Supported devices: X-Rite i1Pro, i1Pro2, i1Pro3</span>
        </div>
      </div>
    </motion.div>
  );
};

export default SpectroDownloadPrompt;
