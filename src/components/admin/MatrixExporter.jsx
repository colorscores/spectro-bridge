import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Upload, FileSpreadsheet, FileJson, AlertTriangle } from 'lucide-react';
import { 
  exportMatrices, 
  downloadMatricesAsCSV, 
  importMatrices, 
  USAGE_INSTRUCTIONS 
} from '@/lib/matrixExporter';

const MatrixExporter = () => {
  const [exportData, setExportData] = useState(null);
  const [importData, setImportData] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);

  const handleExport = () => {
    try {
      const data = exportMatrices();
      setExportData(data);
      setError(null);
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    }
  };

  const handleDownloadCSV = () => {
    try {
      downloadMatricesAsCSV();
      setError(null);
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    }
  };

  const handleImport = () => {
    try {
      const data = JSON.parse(importData);
      const result = importMatrices(data);
      setImportResult(result);
      setError(null);
    } catch (err) {
      setError(`Import failed: ${err.message}`);
    }
  };

  const previewData = exportData ? JSON.stringify(exportData, null, 2) : '';

  return (
    <div className="space-y-6 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Matrix Export/Import Tool</h2>
        <p className="text-muted-foreground">
          Export and import the status and button matrices that control the color matching workflow.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Matrices
          </CardTitle>
          <CardDescription>
            Export the current status and button matrices for review and editing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline">
              <FileJson className="h-4 w-4 mr-2" />
              Generate Export
            </Button>
            <Button onClick={handleDownloadCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Download CSV Files
            </Button>
          </div>

          {exportData && (
            <div className="space-y-4">
              <h4 className="font-medium">Export Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-muted p-3 rounded">
                  <div className="font-medium">Status States</div>
                  <div className="text-2xl font-bold">{exportData.statusMatrix.length}</div>
                </div>
                <div className="bg-muted p-3 rounded">
                  <div className="font-medium">Card Buttons</div>
                  <div className="text-2xl font-bold">{exportData.cardButtonMatrix.length}</div>
                </div>
                <div className="bg-muted p-3 rounded">
                  <div className="font-medium">Header Buttons</div>
                  <div className="text-2xl font-bold">{exportData.headerButtonMatrix.length}</div>
                </div>
                <div className="bg-muted p-3 rounded">
                  <div className="font-medium">Role Mappings</div>
                  <div className="text-2xl font-bold">{exportData.roleMapping.length}</div>
                </div>
              </div>

              <details className="border rounded p-4">
                <summary className="cursor-pointer font-medium mb-2">View JSON Export</summary>
                <Textarea
                  value={previewData}
                  readOnly
                  className="font-mono text-xs"
                  rows={20}
                />
              </details>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Matrices
          </CardTitle>
          <CardDescription>
            Import updated matrices from JSON format (use with caution in production)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Importing changes will affect the entire matching workflow. Test thoroughly before deploying to production.
            </AlertDescription>
          </Alert>

          <div>
            <label className="block text-sm font-medium mb-2">
              Paste JSON Export Data
            </label>
            <Textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="Paste your JSON export data here..."
              className="font-mono text-xs"
              rows={10}
            />
          </div>

          <Button 
            onClick={handleImport} 
            disabled={!importData.trim()}
            variant="destructive"
          >
            Import Matrices
          </Button>

          {importResult && (
            <Alert>
              <AlertDescription>
                Import successful! {Object.keys(importResult.statusMatrix).length} status states 
                and {Object.keys(importResult.buttonMatrix.card).length + Object.keys(importResult.buttonMatrix.header).length} button configurations imported.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Instructions</CardTitle>
          <CardDescription>
            Guidelines for working with the exported matrices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-4 rounded overflow-auto whitespace-pre-wrap">
            {USAGE_INSTRUCTIONS}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default MatrixExporter;