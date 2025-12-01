import { useState, useEffect } from 'react';
import { sdebug, isSimilarDebugEnabled } from '@/lib/similarDebug';
import { spectralToLabASTME308, labToChromaHue } from '@/lib/colorUtils';
import { supabase } from '@/integrations/supabase/client';

// PHASE 2 OPTIMIZATION: Accept pre-fetched ASTM tables to avoid redundant DB queries
// Hook to calculate Lab and CH values from spectral data using ASTM E308 tables
export const useSpectralCalculations = (
  spectralData, 
  illuminant = 'D50', 
  observer = '2', 
  tableNumber = '5',
  preFetchedAstmTables = null // New parameter for centralized cache
) => {

  const [calculations, setCalculations] = useState({ lab: null, ch: null });
  const [astmTables, setAstmTables] = useState([]);
  const [loading, setLoading] = useState(false);

  // PHASE 2: Use pre-fetched tables if available, otherwise fetch from DB
  useEffect(() => {
    // If pre-fetched tables are provided, use them directly
    if (preFetchedAstmTables && Array.isArray(preFetchedAstmTables)) {
      setAstmTables(preFetchedAstmTables);
      setLoading(false);
      return;
    }

    // Fallback: Fetch from DB if no pre-fetched tables (backward compatibility)
    let cancelled = false;
    const fetchAstm = async () => {
      setLoading(true);
      try {
        const normalizedObserver = String(observer).replace('°', '');
        const tableNo = String(tableNumber);
        const { data, error } = await supabase
          .from('astm_e308_tables')
          .select('*')
          .eq('table_number', tableNo)
          .eq('illuminant_name', illuminant)
          .eq('observer', normalizedObserver);
        if (error) throw error;
        if (!cancelled) setAstmTables(data || []);
      } catch (e) {
        if (!cancelled) setAstmTables([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAstm();
    return () => { cancelled = true; };
  }, [illuminant, observer, tableNumber, preFetchedAstmTables]);

  useEffect(() => {
    if (!spectralData || loading || !astmTables?.length) {
      setCalculations({ lab: null, ch: null });
      return;
    }

    // Normalize spectral data input
    let normalizedSpectralData = spectralData;
    
    // If it's a string, try to parse it
    if (typeof spectralData === 'string') {
      try {
        normalizedSpectralData = JSON.parse(spectralData);
      } catch (error) {
        console.warn('Failed to parse spectral data string:', error);
        setCalculations({ lab: null, ch: null });
        return;
      }
    }

    // If it's not an object after parsing, bail out
    if (!normalizedSpectralData || typeof normalizedSpectralData !== 'object') {
      setCalculations({ lab: null, ch: null });
      return;
    }

    // Strip "nm" suffix from keys and coerce numeric string values to numbers
    const cleanedSpectralData = {};
    Object.entries(normalizedSpectralData).forEach(([key, value]) => {
      const cleanKey = String(key).replace(/nm$/i, '');
      const numericKey = Number(cleanKey);
      const numericValue = typeof value === 'number'
        ? value
        : (typeof value === 'string' ? Number(value.replace(',', '.').trim()) : NaN);
      if (!isNaN(numericKey) && !isNaN(numericValue)) {
        cleanedSpectralData[numericKey] = numericValue;
      }
    });

    console.log('[MAIN-UI useSpectralCalculations] 🔵 SPECTRAL DATA INPUT:', {
      spectralDataType: typeof spectralData,
      normalizedType: typeof normalizedSpectralData,
      originalKeys: Object.keys(normalizedSpectralData).slice(0, 5),
      cleanedKeys: Object.keys(cleanedSpectralData).slice(0, 5),
      cleanedKeysCount: Object.keys(cleanedSpectralData).length,
      firstThreeValues: Object.keys(cleanedSpectralData).slice(0, 3).map(k => `${k}:${cleanedSpectralData[k]}`),
      illuminant,
      observer,
      tableNumber
    });

    // If no valid points after normalization, bail early
    if (!Object.keys(cleanedSpectralData).length) {
      if (isSimilarDebugEnabled()) sdebug.warn('useSpectralCalculations: No valid spectral points after normalization', { keys: Object.keys(normalizedSpectralData || {}) });
      setCalculations({ lab: null, ch: null });
      return;
    }

    try {
      // Check if debug tracing is enabled
      const urlParams = new URLSearchParams(window.location.search);
      const traceE308 = urlParams.get('traceE308') === '1';
      
      if (traceE308) {
        console.log('🔍 useSpectralCalculations debug:', {
          spectralDataType: typeof spectralData,
          spectralDataKeys: Object.keys(cleanedSpectralData).slice(0, 5),
          illuminant,
          observer,
          tableNumber,
          astmTablesCount: astmTables.length
        });
      }

      // Normalize observer and illuminant for table lookup
      const normalizedObserver = observer.replace('°', '');
      const normalizedIlluminant = illuminant;

      // Find matching ASTM table for illuminant/observer/table combination
      let weightingTable = astmTables.filter(row => 
        row.illuminant_name === normalizedIlluminant && 
        row.observer === normalizedObserver &&
        String(row.table_number) === String(tableNumber)
      );

      // If no match found, try with original observer format
      if (!weightingTable?.length && observer !== normalizedObserver) {
        weightingTable = astmTables.filter(row => 
          row.illuminant_name === normalizedIlluminant && 
          row.observer === observer &&
          String(row.table_number) === String(tableNumber)
        );
      }

      if (!weightingTable?.length) {
        if (isSimilarDebugEnabled() || traceE308) {
          const logData = { 
            illuminant: normalizedIlluminant, 
            observer: normalizedObserver,
            originalObserver: observer,
            table: tableNumber,
            availableTables: astmTables.slice(0, 5).map(t => ({ 
              illuminant: t.illuminant_name, 
              observer: t.observer, 
              table: t.table_number 
            }))
          };
          if (traceE308) console.warn('❌ No ASTM table found:', logData);
          if (isSimilarDebugEnabled()) sdebug.warn('useSpectralCalculations: No ASTM table found', logData);
        }
        setCalculations({ lab: null, ch: null });
        return;
      }

      if (isSimilarDebugEnabled() || traceE308) {
        const wls = Object.keys(cleanedSpectralData || {}).map(Number).filter(n => !isNaN(n)).sort((a,b)=>a-b);
        const stats = wls.length ? { count: wls.length, range: `${wls[0]}-${wls[wls.length-1]}` } : { count: 0 };
        const logData = { illuminant: normalizedIlluminant, observer: normalizedObserver, table: tableNumber, spectral: stats, rows: weightingTable.length };
        if (traceE308) console.info('🔬 Preparing ASTM E308 calculation:', logData);
        if (isSimilarDebugEnabled()) sdebug.info('useSpectralCalculations: preparing E308', logData);
      }

      // Calculate Lab from spectral data using ASTM E308
      const lab = spectralToLabASTME308(cleanedSpectralData, weightingTable);
      
      if (lab && [lab.L, lab.a, lab.b].every(v => typeof v === 'number' && Number.isFinite(v)) && !(lab.L === 0 && lab.a === 0 && lab.b === 0)) {
        // Calculate Chroma and Hue from Lab
        const ch = labToChromaHue(lab.L, lab.a, lab.b);
        
        if (isSimilarDebugEnabled() || traceE308) {
          const wls = Object.keys(cleanedSpectralData || {}).map(Number).filter(n => !isNaN(n)).sort((a,b)=>a-b);
          const stats = wls.length ? { count: wls.length, range: `${wls[0]}-${wls[wls.length-1]}` } : { count: 0 };
          const logData = { 
            illuminant: normalizedIlluminant, 
            observer: normalizedObserver, 
            table: tableNumber,
            spectral: stats,
            lab: { L: lab.L.toFixed(2), a: lab.a.toFixed(2), b: lab.b.toFixed(2) },
            ch: { C: ch.C.toFixed(2), h: ch.h.toFixed(2) }
          };
          if (traceE308) console.info('✅ Lab calculation successful:', logData);
          if (isSimilarDebugEnabled()) sdebug.info('useSpectralCalculations: calculated Lab successfully', logData);
        }
        
        setCalculations({
          lab: {
            L: lab.L,
            a: lab.a,
            b: lab.b
          },
          ch: {
            C: ch.C,
            h: ch.h
          }
        });
      } else {
        if (isSimilarDebugEnabled() || traceE308) {
          const logData = { 
            illuminant: normalizedIlluminant, 
            observer: normalizedObserver, 
            table: tableNumber,
            labResult: lab 
          };
          if (traceE308) console.warn('❌ Lab calculation failed:', logData);
          if (isSimilarDebugEnabled()) sdebug.warn('useSpectralCalculations: Lab calculation failed', logData);
        }
        setCalculations({ lab: null, ch: null });
      }
    } catch (error) {
      console.error('Error calculating Lab/CH from spectral data:', error);
      setCalculations({ lab: null, ch: null });
    }
  }, [spectralData, illuminant, observer, tableNumber, loading, astmTables]);

  return calculations;
};