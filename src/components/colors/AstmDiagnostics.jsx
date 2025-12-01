import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { spectralToLabASTME308 } from '@/lib/colorUtils';

const number = (v) => (v == null ? null : Number(v));

const format = (v, digits = 4) =>
  (v == null || !Number.isFinite(v) ? '—' : Number(v).toFixed(digits));

const safeSpectral = (obj) => {
  if (!obj || typeof obj !== 'object') return {};
  // keys are wavelengths as strings: { "360": 0.02, ... }
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const wl = Number(k);
    if (Number.isFinite(wl)) out[wl] = Number(v) || 0;
  }
  return out;
};

const computeRawXYZ = (spectral, tableRows) => {
  let sumX = 0, sumY = 0, sumZ = 0;
  for (const row of tableRows) {
    const wl = Number(row.wavelength);
    const S = spectral[wl] ?? 0;
    sumX += S * Number(row.x_factor);
    sumY += S * Number(row.y_factor);
    sumZ += S * Number(row.z_factor);
  }
  return { X: sumX, Y: sumY, Z: sumZ };
};

const computeTableSums = (tableRows) => {
  return tableRows.reduce(
    (acc, r) => {
      acc.sum_x += Number(r.x_factor);
      acc.sum_y += Number(r.y_factor);
      acc.sum_z += Number(r.z_factor);
      acc.rows += 1;
      acc.min_wl = Math.min(acc.min_wl, Number(r.wavelength));
      acc.max_wl = Math.max(acc.max_wl, Number(r.wavelength));
      return acc;
    },
    { sum_x: 0, sum_y: 0, sum_z: 0, rows: 0, min_wl: Infinity, max_wl: -Infinity }
  );
};

const AstmDiagnostics = ({ colorId, controls }) => {
  const { astmTables, loading: astmLoading } = useAstmTablesCache();
  const [measurement, setMeasurement] = useState(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [astmDataInput, setAstmDataInput] = useState('');
  const [showAstmTools, setShowAstmTools] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('astmTools') === '1';
  });

  const appendLog = (msg) => setLog((l) => [...l, `[${new Date().toISOString()}] ${msg}`]);

  // Default ASTM parameters from controls or fallback
  const defaultIlluminant = controls?.illuminant || 'D50';
  const defaultObserver = controls?.observer || '2';
  const defaultTable = controls?.table || '5';

  // Latest measurement with spectral data
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('color_measurements')
          .select('id, spectral_data, lab, illuminant, observer, created_at')
          .eq('color_id', colorId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (active) setMeasurement(data || null);
      } catch (e) {
        console.error('Failed to load measurement', e);
      }
    };
    load();
    return () => { active = false; };
  }, [colorId]);

  const selectedTableRows = useMemo(() => {
    if (!Array.isArray(astmTables)) return [];
    const ill = defaultIlluminant;
    const obs = String(defaultObserver);
    const tbl = Number(defaultTable);
    return astmTables.filter(
      (r) => r.illuminant_name === ill && String(r.observer) === obs && Number(r.table_number) === tbl
    );
  }, [astmTables, defaultIlluminant, defaultObserver, defaultTable]);

  const tableStats = useMemo(() => (selectedTableRows.length ? computeTableSums(selectedTableRows) : null), [selectedTableRows]);

  const spectralObj = useMemo(() => safeSpectral(measurement?.spectral_data), [measurement?.spectral_data]);

  const rawXYZ = useMemo(() => (selectedTableRows.length ? computeRawXYZ(spectralObj, selectedTableRows) : null), [spectralObj, selectedTableRows]);

  const computedLab = useMemo(() => {
    if (!selectedTableRows.length || !spectralObj || Object.keys(spectralObj).length === 0) return null;
    try {
      // spectralToLabASTME308 internally handles proper k-normalization
      const lab = spectralToLabASTME308(spectralObj, selectedTableRows);
      return lab;
    } catch (e) {
      console.warn('Lab compute failed', e);
      return null;
    }
  }, [spectralObj, selectedTableRows]);

  // Handle importing ASTM data
  const runAstmImport = async () => {
    setRunning(true);
    setLog([]);
    try {
      if (!astmDataInput.trim()) {
        appendLog('Error: Please provide ASTM data');
        return;
      }

      appendLog('Starting ASTM data import...');
      
      // Parse the input data (support JSON, CSV, and tab-separated)
      let parsedData;
      try {
        // Try JSON first
        parsedData = JSON.parse(astmDataInput);
        appendLog(`Parsed ${parsedData.length} rows from JSON`);
      } catch {
        // If JSON fails, try to parse as CSV or tab-separated
        const lines = astmDataInput.trim().split('\n');
        
        // Check if it's tab-separated by looking at the first line
        const firstLine = lines[0];
        const isTabSeparated = firstLine.includes('\t');
        const separator = isTabSeparated ? '\t' : ',';
        
        appendLog(`Detected ${isTabSeparated ? 'tab' : 'comma'} separated format`);
        
        const headers = firstLine.split(separator).map(h => h.trim());
        appendLog(`Headers: ${headers.join(', ')}`);
        
        // Handle special case where first row might be wavelengths and subsequent rows are X, Y, Z values
        if (headers.every(h => !isNaN(h) && h !== '')) {
          // This looks like wavelengths in the header
          const wavelengths = headers.map(h => parseInt(h));
          appendLog(`Detected wavelengths: ${wavelengths[0]}-${wavelengths[wavelengths.length-1]}nm`);
          
          parsedData = [];
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(separator).map(v => v.trim());
            const rowType = values[0]; // X, Y, or Z
            
            if (['X', 'Y', 'Z'].includes(rowType)) {
              for (let j = 1; j < values.length && j <= wavelengths.length; j++) {
                const wavelength = wavelengths[j-1];
                const factor = parseFloat(values[j]) || 0;
                
                // Find existing row for this wavelength or create new one
                let existingRow = parsedData.find(r => r.wavelength === wavelength);
                if (!existingRow) {
                  existingRow = {
                    illuminant_name: defaultIlluminant,
                    observer: defaultObserver,
                    table_number: parseInt(defaultTable),
                    wavelength: wavelength,
                    x_factor: 0,
                    y_factor: 0,
                    z_factor: 0
                  };
                  parsedData.push(existingRow);
                }
                
                // Set the appropriate factor
                if (rowType === 'X') existingRow.x_factor = factor;
                else if (rowType === 'Y') existingRow.y_factor = factor;
                else if (rowType === 'Z') existingRow.z_factor = factor;
              }
            }
          }
          appendLog(`Created ${parsedData.length} wavelength rows from matrix format`);
        } else {
          // Standard CSV/TSV format with column headers
          parsedData = lines.slice(1).map(line => {
            const values = line.split(separator).map(v => v.trim());
            const row = {};
            headers.forEach((header, i) => {
              const value = values[i];
              // Convert numeric values
              if (!isNaN(value) && value !== '') {
                row[header] = Number(value);
              } else {
                row[header] = value;
              }
            });
            return row;
          });
          appendLog(`Parsed ${parsedData.length} rows from standard ${isTabSeparated ? 'TSV' : 'CSV'}`);
          
          // Check if this is wide format with wavelength columns (360, 370, etc.) as properties
          const wavelengthColumns = headers.filter(h => /^\d{3,4}$/.test(h)).sort((a, b) => parseInt(a) - parseInt(b));
          
          if (wavelengthColumns.length > 10) {
            appendLog(`Wide format detected with ${wavelengthColumns.length} wavelength columns`);
            
            const longFormatData = [];
            parsedData.forEach((row, rowIndex) => {
              // Check if this row has a type indicator in the first wavelength column
              const firstWlColumn = wavelengthColumns[0];
              const rowTypeIndicator = row[firstWlColumn];
              
              if (['X', 'Y', 'Z'].includes(rowTypeIndicator)) {
                // This row contains factor values for X, Y, or Z
                wavelengthColumns.forEach(wlStr => {
                  const wavelength = parseInt(wlStr);
                  const factorValue = row[wlStr];
                  
                  if (factorValue !== undefined && factorValue !== null && factorValue !== '' && !isNaN(factorValue)) {
                    // Find existing row for this wavelength or create new one
                    let existingRow = longFormatData.find(r => r.wavelength === wavelength);
                    if (!existingRow) {
                      existingRow = {
                        illuminant_name: row.illuminant_name || defaultIlluminant,
                        observer: row.observer || defaultObserver,
                        table_number: row.table_number || parseInt(defaultTable),
                        wavelength: wavelength,
                        x_factor: 0,
                        y_factor: 0,
                        z_factor: 0,
                        white_point_x: row.WP,
                        white_point_y: row.WP,
                        white_point_z: row.WP
                      };
                      longFormatData.push(existingRow);
                    }
                    
                    // Set the appropriate factor
                    if (rowTypeIndicator === 'X') existingRow.x_factor = factorValue;
                    else if (rowTypeIndicator === 'Y') existingRow.y_factor = factorValue;
                    else if (rowTypeIndicator === 'Z') existingRow.z_factor = factorValue;
                  }
                });
              }
            });
            
            if (longFormatData.length > 0) {
              parsedData = longFormatData;
              appendLog(`Transformed wide format to ${parsedData.length} long format rows`);
            }
          }
        }
      }

      // Apply default illuminant/observer/table to rows that don't have them
      parsedData = parsedData.map(row => ({
        illuminant_name: row.illuminant_name || defaultIlluminant,
        observer: row.observer || defaultObserver,
        table_number: row.table_number || parseInt(defaultTable),
        wavelength: row.wavelength,
        x_factor: row.x_factor || 0,
        y_factor: row.y_factor || 0,
        z_factor: row.z_factor || 0,
        ...row
      }));

      appendLog(`Using target table: ${defaultIlluminant}/${defaultObserver}/Table ${defaultTable}`);

      // Set the ASTM data
      const { setAstmData } = await import('@/scripts/loadOfficialAstmData');
      setAstmData(parsedData);
      appendLog('ASTM data set for import');
      
      // Import and execute the update script
      const { executeAstmUpdate } = await import('@/scripts/executeAstmUpdate');
      const result = await executeAstmUpdate();
      
      appendLog(`ASTM import completed: ${JSON.stringify(result)}`);
      
      // Force reload the ASTM cache
      const cacheMod = await import('@/utils/clearCachesForNewAstm');
      await cacheMod.clearCachesForNewAstm();
      appendLog('Cache cleared and tables reloaded');
      
      setAstmDataInput('');
      appendLog('✅ ASTM data imported successfully!');
    } catch (error) {
      console.error('[ASTM-IMPORT] Failed:', error);
      appendLog(`❌ Failed to import ASTM data: ${error.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">ASTM E308 Diagnostics</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowAstmTools(!showAstmTools)}
          >
            {showAstmTools ? 'Hide' : 'Show'} Import Tools
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Settings Display */}
        <div>
          <h4 className="font-medium mb-2">Current Measurement Settings</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Target Table: <span className="font-mono">{defaultIlluminant}/{defaultObserver}/Table {defaultTable}</span></div>
          </div>
        </div>

        {/* ASTM Import Tools */}
        {showAstmTools && (
          <div className="space-y-3 p-3 border rounded-md bg-muted/50">
            <h4 className="font-medium text-sm">Import ASTM E308 Weights</h4>
            <div className="text-xs text-muted-foreground mb-2">
              Importing to: <span className="font-mono font-medium">{defaultIlluminant}/{defaultObserver}/Table {defaultTable}</span>
            </div>
            <textarea
              value={astmDataInput}
              onChange={(e) => setAstmDataInput(e.target.value)}
              placeholder="Paste ASTM data (JSON, CSV, or tab-separated matrix format)..."
              className="w-full h-32 text-xs font-mono p-2 border rounded resize-none"
              disabled={running}
            />
            <Button 
              onClick={runAstmImport} 
              disabled={running || !astmDataInput.trim()}
              size="sm"
              className="w-full"
            >
              {running ? 'Importing...' : `Import ASTM Data → ${defaultIlluminant}/${defaultObserver}/T${defaultTable}`}
            </Button>
          </div>
        )}
        {/* Table Statistics */}
        <div>
          <h4 className="font-medium mb-2">Table {selectedTableRows.length ? `${selectedTableRows[0]?.illuminant_name}/${selectedTableRows[0]?.observer}/T${selectedTableRows[0]?.table_number}` : `${defaultIlluminant}/${defaultObserver}/T${defaultTable}` } Statistics</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Rows: {format(tableStats?.rows || 0, 0)}</div>
            <div>Wavelength Range: {format(tableStats?.min_wl || 0, 0)} - {format(tableStats?.max_wl || 0, 0)} nm</div>
            <div>Sum X: {format(tableStats?.sum_x || 0, 6)}</div>
            <div>Sum Y: {format(tableStats?.sum_y || 0, 6)}</div>
            <div>Sum Z: {format(tableStats?.sum_z || 0, 6)}</div>
          </div>
        </div>

        {/* Raw XYZ Values */}
        <div>
          <h4 className="font-medium mb-2">Raw XYZ (Latest Measurement)</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>X: {format(rawXYZ?.X || 0, 4)}</div>
            <div>Y: {format(rawXYZ?.Y || 0, 4)}</div>
            <div>Z: {format(rawXYZ?.Z || 0, 4)}</div>
          </div>
        </div>

        {/* Computed Lab Values */}
        <div>
          <h4 className="font-medium mb-2">Computed Lab Values</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>L*: {format(computedLab?.L, 2)}</div>
            <div>a*: {format(computedLab?.a, 2)}</div>
            <div>b*: {format(computedLab?.b, 2)}</div>
          </div>
        </div>

        {/* Processing Log */}
        {log.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Processing Log</h4>
            <div className="bg-muted p-3 rounded-md text-xs font-mono max-h-32 overflow-y-auto">
              {log.map((entry, i) => (
                <div key={i}>{entry}</div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AstmDiagnostics;
