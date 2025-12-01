import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { importAstmWeights, parseAstmCsv } from '@/utils/importAstmWeights';
import { Settings } from 'lucide-react';

const WeightingFunctionImport = () => {
  const [csvData, setCsvData] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [illuminant, setIlluminant] = useState('D50');
  const [observer, setObserver] = useState('2');
  const [table, setTable] = useState('5');
  const { toast } = useToast();

  const handleImport = async () => {
    if (!csvData.trim()) {
      toast({
        title: "No data provided",
        description: "Please paste CSV data before importing",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    try {
      // Parse CSV data with selected measurement settings
      const rows = parseAstmCsv(csvData.trim(), illuminant, observer, table);
      const result = await importAstmWeights(rows);
      toast({
        title: "Import successful",
        description: `Imported ${illuminant}/${observer}/T${table} - ${result.processed_rows} rows with ${result.combinations} combinations`,
      });
      setCsvData('');
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed", 
        description: error.message || "Failed to import weighting function data",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Import Weighting Functions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Import Target Settings */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Illuminant</label>
            <Select value={illuminant} onValueChange={setIlluminant}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="C">C</SelectItem>
                <SelectItem value="D50">D50</SelectItem>
                <SelectItem value="D65">D65</SelectItem>
                <SelectItem value="F2">F2</SelectItem>
                <SelectItem value="F7">F7</SelectItem>
                <SelectItem value="F11">F11</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Observer</label>
            <Select value={observer} onValueChange={setObserver}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2°</SelectItem>
                <SelectItem value="10">10°</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Table</label>
            <Select value={table} onValueChange={setTable}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">T5 (360-780nm, 43 points)</SelectItem>
                <SelectItem value="6">T6 (370-780nm, 42 points)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Target Display */}
        <div className="bg-muted/50 p-3 rounded-md">
          <span className="text-sm font-medium text-muted-foreground">
            Target: {illuminant}/{observer}/T{table}
          </span>
        </div>
        
        <Textarea
          value={csvData}
          onChange={(e) => setCsvData(e.target.value)}
          placeholder="Paste ASTM E308 CSV data here..."
          className="min-h-[100px] font-mono text-sm"
        />
        <Button 
          onClick={handleImport}
          disabled={isImporting || !csvData.trim()}
          className="w-full"
        >
          {isImporting ? 'Importing...' : 'Import Weighting Function Data'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default WeightingFunctionImport;