import { toast } from '@/hooks/use-toast';
import { cxfParser } from '@/lib/cxfParser';
import { debug } from '@/lib/debugUtils';
import { supabase } from '@/integrations/supabase/client';

// Global progress state for sharing across instances
let currentParseProgress = null;
const progressListeners = new Set();

const updateProgress = (progress) => {
  currentParseProgress = progress;
  progressListeners.forEach(listener => listener(progress));
};

/**
 * CxF parsing utility that can be used safely in any context (NO React hooks).
 * Keeps internal mutable state and exposes imperative helpers.
 * Export name preserved to avoid touching call sites.
 */
export const useCxfParser = () => {
  // Internal, non-reactive state (safe outside React dispatcher)
  const state = {
    isLoading: false,
    parsedColors: [],
    astmTables: [],
    fileInputRef: { current: null },
    parseProgress: null,
    fileMetadata: null,
  };

  const setIsLoading = (val) => { state.isLoading = val; };
  const setParsedColors = (val) => { state.parsedColors = Array.isArray(val) ? val : []; };

  const ensureAstmTables = async () => {
    if (Array.isArray(state.astmTables) && state.astmTables.length > 0) return;
    try {
      const { data } = await supabase
        .from('astm_e308_tables')
        .select('*')
        .eq('table_number', 5)
        .eq('illuminant_name', 'D50')
        .eq('observer', '2');
      state.astmTables = data || [];
    } catch (e) {
      state.astmTables = [];
    }
  };

  const triggerFileInput = () => {
    console.log('[CxFParser] Triggering file input');
    state.fileInputRef.current?.click?.();
  };

  const resetState = () => {
    console.log('[CxFParser] Resetting state');
    setIsLoading(false);
    setParsedColors([]);
    state.parseProgress = null;
    state.fileMetadata = null;
    updateProgress(null);
  };

  const handleFileChange = async (event, onSuccess, onError) => {
    const file = event?.target?.files?.[0];
    if (!file) {
      debug.warn('[CxF Parser] No file selected');
      return;
    }

    // Calculate file metadata for large file warning
    const fileSizeKB = (file.size / 1024).toFixed(2);
    const estimatedColors = Math.floor(file.size / 200); // Rough estimate for CXF
    const isLargeFile = file.size > 500000 || estimatedColors > 500; // Lower threshold for earlier warning
    
    state.fileMetadata = {
      name: file.name,
      sizeKB: fileSizeKB,
      estimatedColors,
      isLarge: isLargeFile
    };

    await ensureAstmTables();

    console.log('[CxF Parser] Starting file processing, current loading state:', state.isLoading);
    debug.log('[CxF Parser] Starting file processing with enhanced debugging');
    setIsLoading(true);

    try {
      let xmlContent;

      try {
        xmlContent = await readFileAsText(file);
        debug.log('[CxF Parser] Primary file read successful');
      } catch (primaryError) {
        debug.warn('[CxF Parser] Primary file read failed, trying fallback:', primaryError.message);
        try {
          xmlContent = await readFileAsTextFallback(file);
          debug.log('[CxF Parser] Fallback file read successful');
        } catch (fallbackError) {
          debug.error('[CxF Parser] All file reading methods failed:', {
            primaryError: primaryError.message,
            fallbackError: fallbackError.message
          });
          throw new Error(`File reading failed: ${primaryError.message}. Fallback also failed: ${fallbackError.message}`);
        }
      }

      if (!xmlContent || typeof xmlContent !== 'string') {
        throw new Error('Invalid file content received');
      }

      if (!xmlContent.trim().startsWith('<?xml') && !xmlContent.includes('<CxF')) {
        throw new Error('File does not appear to be a valid CxF XML file');
      }

      debug.log('[CxF Parser] Starting XML parsing');
      const parseStartTime = Date.now();

      const parsingOptions = {
        astmTables: state.astmTables || [],
        orgDefaults: {}, // Avoid ProfileContext coupling here
        onProgress: (progress) => {
          state.parseProgress = progress;
          updateProgress(progress);
        }
      };

      const parseResult = cxfParser.parse(xmlContent, parsingOptions);
      const parseTime = Date.now() - parseStartTime;

      const colors = parseResult.colors || parseResult; // Backward compatibility
      const needsModeSelection = parseResult.needsModeSelection || false;

      // Sanitize: Remove placeholder Lab values when spectral data exists
      const sanitized = colors?.map(color => {
        const cleanMeasurements = color.measurements?.map(measurement => {
          const hasSpectral = measurement.spectral_data && Object.keys(measurement.spectral_data).length > 0;
          const isPlaceholderLab = measurement.lab && measurement.lab.L === 50 && measurement.lab.a === 0 && measurement.lab.b === 0;
          if (hasSpectral && isPlaceholderLab) {
            console.log(`[CXF-SANITIZE] Removed placeholder Lab from ${color.name || 'Unknown'} measurement`);
            const { lab, ...cleanMeasurement } = measurement;
            return cleanMeasurement;
          }
          return measurement;
        });
        return { ...color, measurements: cleanMeasurements };
      }) || colors;

      debug.log('[CxF Parser] XML parsing completed:', {
        parseTime: `${parseTime}ms`,
        colorsFound: sanitized?.length || 0,
        needsModeSelection
      });

      setParsedColors(sanitized);

      if (colors?.length > 0) {
        debug.log('[CxF Parser] Parse successful, calling success callback');
        if (onSuccess) onSuccess(colors, needsModeSelection);
        else toast({ title: 'CXF parsed', description: `Parsed ${colors.length} colors.` });
      } else {
        const err = new Error('Could not parse any colors from the file.');
        debug.error('[CxF Parser] No colors parsed from file');
        if (onError) onError(err);
        else toast({ title: 'Parse error', description: err.message, variant: 'destructive' });
      }
    } catch (error) {
      debug.error('[CxF Parser] Complete operation failed:', {
        error: error.message,
        stack: error.stack,
        fileName: file?.name,
        fileSize: file?.size
      });

      if (onError) onError(error);
      else toast({ title: 'Error parsing CxF', description: `${error.message}${detectLovableEnvironment() ? ' (Lovable environment detected)' : ''}`, variant: 'destructive' });
    } finally {
      console.log('[CxF Parser] Finally block - resetting loading state');
      setIsLoading(false);
      if (event?.target) event.target.value = '';
      debug.log('[CxF Parser] File processing completed');
    }
  };

  const parseContent = async (xmlContent) => {
    await ensureAstmTables();
    setIsLoading(true);
    try {
      const parsingOptions = {
        astmTables: state.astmTables || [],
        orgDefaults: {},
      };
      const parseResult = cxfParser.parse(xmlContent, parsingOptions);
      const colors = parseResult.colors || parseResult;
      const needsModeSelection = parseResult.needsModeSelection || false;
      setParsedColors(colors);
      if (!colors || colors.length === 0) throw new Error('Could not parse any colors from the content.');
      return { colors, needsModeSelection };
    } finally {
      setIsLoading(false);
    }
  };

  const applyDefaultMeasurementMode = (colors, defaultMode) => {
    return cxfParser.applyDefaultMeasurementMode(colors, defaultMode);
  };

  const clearParsedColors = () => {
    console.log('[CxFParser] Clearing parsed colors');
    setParsedColors([]);
  };

  const runDiagnostics = async () => {
    debug.log('[CxF Parser] Running file system diagnostics...');
    const { runFileSystemDiagnostics } = await import('@/lib/fileTestUtils');
    return await runFileSystemDiagnostics();
  };

  const testWithSampleFile = async () => {
    debug.log('[CxF Parser] Testing with sample CxF file...');
    const { createTestCxfFile } = await import('@/lib/fileTestUtils');
    const testFile = createTestCxfFile();
    try {
      const content = await readFileAsText(testFile);
      const parsingOptions = {
        astmTables: state.astmTables || [],
        orgDefaults: {},
      };
      const parseResult = cxfParser.parse(content, parsingOptions);
      const result = { colors: parseResult.colors || parseResult };
      debug.log('[CxF Parser] Sample file test successful:', result);
      return { success: true, result };
    } catch (error) {
      debug.error('[CxF Parser] Sample file test failed:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    // Expose ref-like object
    fileInputRef: state.fileInputRef,
    // Expose current values via getters
    get isLoading() { return state.isLoading; },
    get parsedColors() { return state.parsedColors; },
    get parseProgress() { return state.parseProgress; },
    get fileMetadata() { return state.fileMetadata; },
    // Imperative helpers
    triggerFileInput,
    handleFileChange,
    parseContent,
    parseCxfContent: parseContent, // backward compatibility
    applyDefaultMeasurementMode,
    clearParsedColors,
    resetState,
    // Debug utilities
    runDiagnostics,
    testWithSampleFile,
    detectLovableEnvironment,
    // Progress subscription
    subscribeToProgress: (listener) => {
      progressListeners.add(listener);
      return () => progressListeners.delete(listener);
    },
  };
};

// Enhanced file reading with detailed debugging and fallback strategies
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    debug.log('[CxF Parser] Starting file read operation:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      lastModified: file.lastModified,
      userAgent: navigator.userAgent,
      isLovableEnvironment: detectLovableEnvironment()
    });

    if (!window.FileReader) {
      const error = new Error('FileReader API not available in this environment');
      debug.error('[CxF Parser] FileReader API check failed:', error);
      reject(error);
      return;
    }

    const maxFileSize = detectLovableEnvironment() ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxFileSize) {
      const error = new Error(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds limit (${(maxFileSize / 1024 / 1024).toFixed(1)}MB)`);
      debug.error('[CxF Parser] File size check failed:', error);
      reject(error);
      return;
    }

    const reader = new FileReader();
    let readStartTime = Date.now();

    reader.onloadstart = () => { debug.log('[CxF Parser] File read started'); };
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const progress = (e.loaded / e.total) * 100;
        debug.log(`[CxF Parser] File read progress: ${progress.toFixed(1)}%`);
      }
    };

    reader.onload = (e) => {
      const readTime = Date.now() - readStartTime;
      const result = e.target.result;
      debug.log('[CxF Parser] File read completed:', {
        readTime: `${readTime}ms`,
        contentLength: result?.length || 0,
        contentType: typeof result,
        firstChars: result?.substring(0, 100) || 'No content'
      });
      if (!result || typeof result !== 'string') {
        const error = new Error('File reading returned invalid result');
        debug.error('[CxF Parser] Invalid file content:', { result, type: typeof result });
        reject(error);
        return;
      }
      if (result.length === 0) {
        const error = new Error('File appears to be empty');
        debug.error('[CxF Parser] Empty file detected');
        reject(error);
        return;
      }
      resolve(result);
    };

    reader.onerror = (e) => {
      const readTime = Date.now() - readStartTime;
      const error = new Error(`FileReader error: ${e.target?.error?.message || 'Unknown error'}`);
      debug.error('[CxF Parser] File read error:', {
        error: e.target?.error,
        readTime: `${readTime}ms`,
        readyState: reader.readyState,
        environment: detectLovableEnvironment() ? 'Lovable' : 'Other'
      });
      reject(error);
    };

    reader.onabort = () => {
      const error = new Error('File reading was aborted');
      debug.error('[CxF Parser] File read aborted');
      reject(error);
    };

    try {
      reader.readAsText(file, 'UTF-8');
    } catch (syncError) {
      debug.error('[CxF Parser] Synchronous FileReader error:', syncError);
      reject(new Error(`Failed to start file reading: ${syncError.message}`));
    }
  });
}

function readFileAsTextFallback(file) {
  debug.log('[CxF Parser] Attempting fallback file reading method');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target.result;
      debug.log('[CxF Parser] Fallback read completed:', {
        contentLength: result?.length || 0,
        encoding: 'auto-detect'
      });
      resolve(result);
    };
    reader.onerror = (e) => {
      debug.error('[CxF Parser] Fallback read failed:', e.target?.error);
      reject(new Error(`Fallback FileReader error: ${e.target?.error?.message || 'Unknown error'}`));
    };
    try {
      reader.readAsText(file);
    } catch (error) {
      reject(new Error(`Fallback read failed: ${error.message}`));
    }
  });
}

function detectLovableEnvironment() {
  try {
    const indicators = [
      window.location.hostname.includes('lovable.dev'),
      window.location.hostname.includes('lovable.app'),
      document.querySelector('meta[name="lovable"]'),
      window.__LOVABLE_ENV__,
      window.parent !== window && window.location.hostname !== window.parent.location.hostname
    ];
    const isLovable = indicators.some(Boolean);
    debug.log('[CxF Parser] Environment detection:', {
      hostname: window.location.hostname,
      isLovable,
      inIframe: window.parent !== window,
      indicators
    });
    return isLovable;
  } catch (error) {
    debug.warn('[CxF Parser] Environment detection failed:', error);
    return false;
  }
}
