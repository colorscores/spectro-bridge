import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bug, Settings } from 'lucide-react';
import FileImportDebugPanel from './FileImportDebugPanel';

const DebugModeToggle = () => {
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // Only show debug toggle in development or when explicitly enabled
  const isDevelopment = import.meta.env.DEV;
  const debugEnabled = isDevelopment || window.location.search.includes('debug=true') || window.location.search.includes('similarDebug=true');
  
  if (!debugEnabled) return null;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40">
        <Button
          onClick={() => setShowDebugPanel(true)}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border-orange-200"
        >
          <Bug className="w-4 h-4" />
          Debug
          <Badge variant="secondary" className="text-xs">
            FILE
          </Badge>
        </Button>
      </div>
      
      <FileImportDebugPanel 
        isOpen={showDebugPanel} 
        onClose={() => setShowDebugPanel(false)}
      />
    </>
  );
};

export default DebugModeToggle;