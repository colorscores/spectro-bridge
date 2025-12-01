import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle, XCircle, Info, FileText, TestTube } from 'lucide-react';
import { useCxfParser } from '@/hooks/useCxfParser';

const FileImportDebugPanel = ({ isOpen, onClose }) => {
  const [diagnostics, setDiagnostics] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [isTestingFile, setIsTestingFile] = useState(false);

  // Always call hooks - React rules require this
  const { runDiagnostics, testWithSampleFile, detectLovableEnvironment } = useCxfParser();

  // Early return after hooks
  if (!isOpen) return null;

  const handleRunDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const results = await runDiagnostics();
      setDiagnostics(results);
    } catch (error) {
      console.error('Diagnostics failed:', error);
      setDiagnostics({ error: error.message });
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const handleTestSampleFile = async () => {
    setIsTestingFile(true);
    try {
      const results = await testWithSampleFile();
      setTestResults(results);
    } catch (error) {
      console.error('Sample file test failed:', error);
      setTestResults({ success: false, error: error.message });
    } finally {
      setIsTestingFile(false);
    }
  };

  const renderStatusIcon = (status) => {
    if (status === true) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === false) return <XCircle className="w-4 h-4 text-red-500" />;
    return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  };

  const renderDiagnosticsResults = () => {
    if (!diagnostics) return null;
    
    if (diagnostics.error) {
      return (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Diagnostics Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{diagnostics.error}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="mt-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              FileReader API Tests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span>API Available</span>
              <div className="flex items-center gap-2">
                {renderStatusIcon(diagnostics.fileReaderTests?.apiAvailable)}
                <Badge variant={diagnostics.fileReaderTests?.apiAvailable ? "default" : "destructive"}>
                  {diagnostics.fileReaderTests?.apiAvailable ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span>Can Create Instance</span>
              <div className="flex items-center gap-2">
                {renderStatusIcon(diagnostics.fileReaderTests?.canCreateInstance)}
                <Badge variant={diagnostics.fileReaderTests?.canCreateInstance ? "default" : "destructive"}>
                  {diagnostics.fileReaderTests?.canCreateInstance ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span>Can Read Blob</span>
              <div className="flex items-center gap-2">
                {renderStatusIcon(diagnostics.fileReaderTests?.canReadBlob)}
                <Badge variant={diagnostics.fileReaderTests?.canReadBlob ? "default" : "destructive"}>
                  {diagnostics.fileReaderTests?.canReadBlob ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span>Can Read File</span>
              <div className="flex items-center gap-2">
                {renderStatusIcon(diagnostics.fileReaderTests?.canReadFile)}
                <Badge variant={diagnostics.fileReaderTests?.canReadFile ? "default" : "destructive"}>
                  {diagnostics.fileReaderTests?.canReadFile ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Lovable Environment</span>
              <Badge variant={detectLovableEnvironment() ? "default" : "secondary"}>
                {detectLovableEnvironment() ? "Detected" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Secure Context</span>
              <Badge variant={diagnostics.securityContext?.isSecureContext ? "default" : "destructive"}>
                {diagnostics.securityContext?.isSecureContext ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Protocol</span>
              <Badge variant="outline">
                {diagnostics.securityContext?.protocol}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>In iframe</span>
              <Badge variant={diagnostics.fileReaderTests?.environment?.inIframe ? "secondary" : "outline"}>
                {diagnostics.fileReaderTests?.environment?.inIframe ? "Yes" : "No"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>File Input Tests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Can Set Properties</span>
              <div className="flex items-center gap-2">
                {renderStatusIcon(diagnostics.fileInputTests?.canSetProperties)}
                <Badge variant={diagnostics.fileInputTests?.canSetProperties ? "default" : "destructive"}>
                  {diagnostics.fileInputTests?.canSetProperties ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span>Can Trigger Click</span>
              <div className="flex items-center gap-2">
                {renderStatusIcon(diagnostics.fileInputTests?.canTriggerClick)}
                <Badge variant={diagnostics.fileInputTests?.canTriggerClick ? "default" : "destructive"}>
                  {diagnostics.fileInputTests?.canTriggerClick ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTestResults = () => {
    if (!testResults) return null;

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${testResults.success ? 'text-green-600' : 'text-red-600'}`}>
            {testResults.success ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            Sample File Test Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {testResults.success ? (
            <div className="space-y-2">
              <p className="text-sm text-green-600">✓ Sample file processed successfully!</p>
              <div className="text-xs text-muted-foreground">
                <p>Colors found: {testResults.result?.colors?.length || 0}</p>
                {testResults.result?.diagnostics && (
                  <p>Missing modes: {testResults.result.diagnostics.missingModes || 0}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-red-600">✗ Sample file test failed</p>
              <p className="text-xs text-muted-foreground">{testResults.error}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[90vh]">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TestTube className="w-5 h-5" />
              File Import Debug Panel
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </CardTitle>
          <CardDescription>
            Diagnose file import issues and test functionality in the current environment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button 
                onClick={handleRunDiagnostics}
                disabled={isRunningDiagnostics}
                className="flex items-center gap-2"
              >
                <Info className="w-4 h-4" />
                {isRunningDiagnostics ? 'Running Diagnostics...' : 'Run Diagnostics'}
              </Button>
              
              <Button 
                onClick={handleTestSampleFile}
                disabled={isTestingFile}
                variant="outline"
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                {isTestingFile ? 'Testing Sample...' : 'Test Sample File'}
              </Button>
            </div>

            <Separator />

            <ScrollArea className="max-h-96">
              {renderDiagnosticsResults()}
              {renderTestResults()}
              
              {!diagnostics && !testResults && (
                <div className="text-center py-8 text-muted-foreground">
                  <TestTube className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Click "Run Diagnostics" to analyze your environment</p>
                  <p className="text-sm mt-2">This will help identify file import issues</p>
                </div>
              )}
            </ScrollArea>

            <Separator />
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p>This debug panel helps identify platform-specific file import restrictions.</p>
              <p>Environment: {detectLovableEnvironment() ? 'Lovable' : 'Other'}</p>
              <p>Timestamp: {new Date().toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FileImportDebugPanel;