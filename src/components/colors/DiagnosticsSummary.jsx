import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const DiagnosticsSummary = ({ diagnostics }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!diagnostics) return null;

  const { fileReader, fileInput, parseResults, environment } = diagnostics;
  
  // Read directly from expected keys (now provided by runFileSystemDiagnostics)
  const fileReaderStatus = fileReader?.success;
  const fileInputStatus = fileInput?.success;
  const hasIssues = fileReaderStatus === false || fileInputStatus === false;
  
  console.log('🔍 DiagnosticsSummary render:', { 
    fileReaderStatus, 
    fileInputStatus, 
    hasIssues, 
    parseResults,
    rawDiagnostics: diagnostics 
  });
  
  // Only show diagnostic summary if there are actual issues or parse results to display
  if (!hasIssues && !parseResults) return null;
  const isLovableEnv = environment?.isLovableEnvironment;

  return (
    <Card className="mb-4 border-l-4 border-l-blue-500">
      <CardContent className="p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-0 h-auto font-medium text-left w-full justify-start"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
          Import Diagnostics
          {hasIssues && <AlertTriangle className="w-4 h-4 ml-2 text-amber-500" />}
        </Button>

        {isExpanded && (
          <div className="mt-3 space-y-3 text-sm">
            {/* Platform Status */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                Platform Status
                {isLovableEnv && <Info className="w-4 h-4 text-blue-500" title="Running in Lovable environment" />}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  {fileReaderStatus === true ? 
                    <CheckCircle className="w-3 h-3 text-green-500" /> : 
                    fileReaderStatus === false ?
                    <AlertTriangle className="w-3 h-3 text-red-500" /> :
                    <Info className="w-3 h-3 text-gray-500" />
                  }
                  FileReader API: {fileReaderStatus === true ? 'Available' : fileReaderStatus === false ? 'Issues detected' : 'Unknown'}
                </div>
                
                <div className="flex items-center gap-2">
                  {fileInputStatus === true ? 
                    <CheckCircle className="w-3 h-3 text-green-500" /> : 
                    fileInputStatus === false ?
                    <AlertTriangle className="w-3 h-3 text-red-500" /> :
                    <Info className="w-3 h-3 text-gray-500" />
                  }
                  File Input: {fileInputStatus === true ? 'Working' : fileInputStatus === false ? 'Issues detected' : 'Unknown'}
                </div>
              </div>
              
              {isLovableEnv && (
                <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  Running in Lovable environment - file size limits and performance may be restricted
                </div>
              )}
            </div>

            {/* Parse Results */}
            {parseResults && (
              <div className="space-y-2">
                <h4 className="font-medium">Parse Results</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-semibold text-lg">{parseResults.totalFound}</div>
                    <div className="text-muted-foreground">Found</div>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="font-semibold text-lg text-green-700">{parseResults.imported}</div>
                    <div className="text-muted-foreground">Imported</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <div className="font-semibold text-lg text-blue-700">{parseResults.hasSpectralData}</div>
                    <div className="text-muted-foreground">With Spectral</div>
                  </div>
                  <div className="text-center p-2 bg-amber-50 rounded">
                    <div className="font-semibold text-lg text-amber-700">{parseResults.needsModeSelection}</div>
                    <div className="text-muted-foreground">Need Mode</div>
                  </div>
                </div>
                
                {parseResults.filtered > 0 && (
                  <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    {parseResults.filtered} colors were filtered out due to missing data (no name, color values, or measurements)
                  </div>
                )}
              </div>
            )}

            {/* Warnings */}
            {hasIssues && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                ⚠️ Platform limitations detected. If import fails, try a smaller file or contact support.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DiagnosticsSummary;