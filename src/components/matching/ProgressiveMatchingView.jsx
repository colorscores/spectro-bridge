import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UploadCloud } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useLiveDeltaE } from '@/hooks/useLiveDeltaE';
import { computeDynamicDisplayColor } from '@/lib/objectSpecificColorCalculation';
import { getSolidSpectralData } from '@/lib/colorUtils/spectralDataHelpers';
import { resolveActiveDataMode } from '@/lib/colorUtils/resolveActiveDataMode';
import { supabase } from '@/lib/customSupabaseClient';

// Helper function to derive Lab values from various sources
const deriveLabFrom = (entity) => {
  if (!entity) return null;

  // 1) Direct LAB fields from entity itself
  const directLab = entity.lab || entity.reference_lab ||
    (entity.lab_l != null && entity.lab_a != null && entity.lab_b != null 
      ? { L: Number(entity.lab_l), a: Number(entity.lab_a), b: Number(entity.lab_b) } 
      : null) ||
    (entity.L != null && entity.a != null && entity.b != null 
      ? { L: Number(entity.L), a: Number(entity.a), b: Number(entity.b) } 
      : null);
  
  if (directLab) {
    // Guard against placeholder Lab when spectral data exists
    const isPlaceholder = directLab.L === 50 && directLab.a === 0 && directLab.b === 0;
    if (isPlaceholder && entity.spectral_data) return null;
    return directLab;
  }

  // 2) Check measurements array (prefer M1 if present, then M2)
  const measurements = Array.isArray(entity.measurements) ? entity.measurements : null;
  if (measurements && measurements.length) {
    const isM1 = (v) => String(v || '').toUpperCase() === 'M1';
    const isM2 = (v) => String(v || '').toUpperCase() === 'M2';
    const preferred =
      measurements.find((m) => isM1(m.mode) || isM1(m.measurement_condition) || isM1(m.condition)) ||
      measurements.find((m) => isM2(m.mode) || isM2(m.measurement_condition) || isM2(m.condition)) ||
      measurements[0];

    if (preferred && preferred.lab) {
      // Guard against placeholder Lab when spectral data exists
      const isPlaceholder = preferred.lab.L === 50 && preferred.lab.a === 0 && preferred.lab.b === 0;
      if (isPlaceholder && preferred.spectral_data) return null;
      return preferred.lab;
    }
    if (preferred && preferred.lab_l != null && preferred.lab_a != null && preferred.lab_b != null) {
      return { L: Number(preferred.lab_l), a: Number(preferred.lab_a), b: Number(preferred.lab_b) };
    }
  }

  return null;
};

const ColorPanel = ({ title, color, isMaster = false, measurementControls = null, orgDefaults = null, astmTables = [] }) => {
  // Get the spectral data from the preferred measurement for hook usage
  const preferredSpectralData = useMemo(() => {
    // Determine effective data mode using consistent utility
    const effectiveMode = resolveActiveDataMode(color);
    
    // Check if this is an ink condition (has imported_tints or adapted_tints)
    const hasImportedTints = Array.isArray(color?.imported_tints) && color.imported_tints.length > 0;
    const hasAdaptedTints = Array.isArray(color?.adapted_tints) && color.adapted_tints.length > 0;
    const isInkCondition = hasImportedTints || hasAdaptedTints;
    
    console.log('🔵 ColorPanel preferredSpectralData: Checking color structure', {
      colorName: color?.name,
      effectiveMode,
      isInkCondition,
      hasImportedTints,
      hasAdaptedTints,
      hasActiveDataMode: !!color?.active_data_mode,
      hasMeasurements: !!color?.measurements
    });
    
    if (isInkCondition) {
      // 🎯 Phase 4: Use correct tints and mode based on effectiveMode
      const tintsToUse = effectiveMode === 'adapted'
        ? (color?.adapted_tints || [])
        : (color?.imported_tints || []);
      
      // Use getSolidSpectralData to respect the stored active_data_mode and mode
      const result = getSolidSpectralData(
        color,
        effectiveMode,
        tintsToUse,
        null,
        { mode: measurementControls?.mode, strictAdapted: true }
      );
      
      if (result?.spectralData) {
        console.log('🎯 Phase 4: ColorPanel using spectral data with mode', {
          colorName: color?.name,
          effectiveMode,
          source: result.source,
          mode: result.mode,
          spectralPoints: Object.keys(result.spectralData).length
        });
        return result.spectralData;
      }
      
      console.warn('⚠️ ColorPanel: getSolidSpectralData returned null for ink condition', {
        colorName: color?.name,
        effectiveMode,
        hasImportedTints,
        hasAdaptedTints,
        hasSpectralData: !!color?.spectral_data
      });
    }
    
    // Original logic for reference colors and backward compatibility
    if (measurementControls && color?.measurements) {
      const measurements = Array.isArray(color.measurements) ? color.measurements : [];
      const modeKey = measurementControls.mode?.toUpperCase();
      const modeMatches = modeKey
        ? measurements.filter((m) => (m.mode || m.measurement_condition || m.condition)?.toUpperCase() === modeKey)
        : measurements;
        
      const spectralMeasurement = modeMatches.find(m => m?.spectral_data) || measurements.find(m => m?.spectral_data);
      if (spectralMeasurement?.spectral_data) {
        console.log('🔵 ColorPanel: Using measurements array spectral_data for', color?.name);
        return spectralMeasurement.spectral_data;
      }
    }
    
    // Fall back to root-level spectral_data (for backward compatibility)
    if (color?.spectral_data && Object.keys(color.spectral_data).length > 0) {
      console.log('🔵 ColorPanel: Using root-level spectral_data for', color?.name);
      return color.spectral_data;
    }
    
    return null;
  }, [color?.measurements, color?.spectral_data, color?.imported_tints, color?.adapted_tints, color?.active_data_mode, color?.ui_state?.active_data_mode, measurementControls?.mode, color?.name]);
  
  // Calculate live hex and Lab using ONLY computeDynamicDisplayColor
  const colorData = useMemo(() => {
    if (!orgDefaults || !astmTables?.length || !color) {
      return { 
        hex: color?.hex || color?.color_hex || '#E5E7EB',
        lab: deriveLabFrom(color)
      };
    }
    
    const effectiveMode = resolveActiveDataMode(color);
    
    const result = computeDynamicDisplayColor(
      color,
      orgDefaults,
      astmTables,
      measurementControls || {},
      effectiveMode
    );
    
    console.log('🟢 ColorPanel: Using computeDynamicDisplayColor for:', color?.name || 'unnamed', {
      result,
      effectiveMode,
      hasControls: !!measurementControls
    });
    
    return result;
  }, [color, orgDefaults, astmTables, measurementControls]);

  const liveHex = colorData.hex;
  
  // Calculate live Lab values with fallbacks
  const liveLab = useMemo(() => {
    // First, use the Lab value from computeDynamicDisplayColor (available via colorData)
    // This ensures consistency between hex and Lab
    if (colorData.lab) {
      return colorData.lab;
    }
    
    // For ink conditions, use getSolidSpectralData which respects activeDataMode and mode
    const isInkCondition = (color?.imported_tints?.length > 0) || (color?.adapted_tints?.length > 0);
    
    if (isInkCondition && measurementControls) {
      const effectiveDataMode = resolveActiveDataMode(color);
      
      // 🎯 Phase 4: Use correct tints and mode based on effectiveDataMode
      const tintsToUse = effectiveDataMode === 'adapted'
        ? (color?.adapted_tints || [])
        : (color?.imported_tints || []);
      
      const solidData = getSolidSpectralData(
        color,
        effectiveDataMode,
        tintsToUse,
        null,
        { mode: measurementControls.mode, strictAdapted: true }
      );
      
      if (solidData?.lab) {
        console.log('🎯 Phase 4: ColorPanel liveLab with mode', {
          colorName: color?.name,
          effectiveDataMode,
          mode: solidData.mode || measurementControls.mode,
          lab: solidData.lab,
          source: solidData.source
        });
        return solidData.lab;
      }
    }
    
    // If no controls or no measurements, fall back to any static LAB on the entity
    if (!measurementControls || !color?.measurements) {
      return deriveLabFrom(color);
    }

    const measurements = Array.isArray(color.measurements) ? color.measurements : [];

    // Narrow to measurements matching the selected mode first (if provided)
    const modeKey = measurementControls.mode?.toUpperCase();
    const modeMatches = modeKey
      ? measurements.filter((m) => (m.mode || m.measurement_condition || m.condition)?.toUpperCase() === modeKey)
      : measurements;

    // Fall back to static LAB on a mode-matching measurement
    const staticFromMode = modeMatches.find((m) => m?.lab || (m?.lab_l != null && m?.lab_a != null && m?.lab_b != null));
    if (staticFromMode?.lab) {
      // Guard against placeholder Lab when spectral data exists
      const isPlaceholder = staticFromMode.lab.L === 50 && staticFromMode.lab.a === 0 && staticFromMode.lab.b === 0;
      if (isPlaceholder && staticFromMode.spectral_data) {
        // Skip placeholder Lab, fall through to next option
      } else {
        return {
          L: staticFromMode.lab.L ?? staticFromMode.lab.l,
          a: staticFromMode.lab.a ?? staticFromMode.lab.A,
          b: staticFromMode.lab.b ?? staticFromMode.lab.B,
        };
      }
    }
    if (staticFromMode && staticFromMode.lab_l != null) {
      return { L: Number(staticFromMode.lab_l), a: Number(staticFromMode.lab_a), b: Number(staticFromMode.lab_b) };
    }

    // Final fallback: any static LAB derivable from the color
    return deriveLabFrom(color);
  }, [color, measurementControls, colorData]);

  // Debug label showing effective mode and source
  const debugInfo = useMemo(() => {
    if (process.env.NODE_ENV !== 'production' && color) {
      const effectiveMode = resolveActiveDataMode(color);
      const hasImportedTints = Array.isArray(color?.imported_tints) && color.imported_tints.length > 0;
      const hasAdaptedTints = Array.isArray(color?.adapted_tints) && color.adapted_tints.length > 0;
      const isInkCondition = hasImportedTints || hasAdaptedTints;
      
      if (isInkCondition) {
        // 🎯 Phase 2: Use correct tints based on effectiveMode
        const tintsToUse = effectiveMode === 'adapted'
          ? (color?.adapted_tints || [])
          : (color?.imported_tints || []);
        
        const result = getSolidSpectralData(
          color,
          effectiveMode,
          tintsToUse,
          null,
          { mode: measurementControls?.mode, strictAdapted: true }
        );
        return { mode: effectiveMode, source: result?.source || 'none' };
      }
    }
    return null;
  }, [color, measurementControls]);

  return (
    <Card className={`h-full flex flex-col overflow-hidden ${isMaster ? 'rounded-r-none' : 'rounded-l-none'}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {debugInfo && (
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {debugInfo.mode} · {debugInfo.source}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between p-0">
        <div className="flex-grow p-6 flex flex-col justify-between" style={{ backgroundColor: liveHex }}>
          <div>
            <p className="font-bold text-lg text-white text-shadow-sm">{color?.name || 'No color selected'}</p>
          </div>
          <p className="text-white text-shadow-sm self-end">
            {(() => {
              if (!liveLab) return '';
              
              const { L, a, b } = liveLab;
              if (L == null || a == null || b == null || 
                  Number.isNaN(Number(L)) || Number.isNaN(Number(a)) || Number.isNaN(Number(b))) {
                return '';
              }
              return `Lab: ${Number(L).toFixed(1)}, ${Number(a).toFixed(1)}, ${Number(b).toFixed(1)}`;
            })()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

const EmptyMatchPanel = ({ onImportClick, onFileDrop }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/xml': ['.xml'],
      'text/xml': ['.xml'],
      'application/x-cxf': ['.cxf']
    },
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFileDrop(acceptedFiles[0]);
      }
    }
  });

  return (
    <Card className="h-full flex flex-col overflow-hidden rounded-l-none">
      <CardHeader>
        <CardTitle>Match</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between p-0">
        <div className="p-6 h-full">
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center h-full border-2 border-dashed rounded-lg text-center p-8 cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-blue-500 hover:bg-gray-50'
            }`}
            onClick={onImportClick}
          >
            <input {...getInputProps()} />
            <UploadCloud className={`h-12 w-12 mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className={`font-medium ${isDragActive ? 'text-blue-600' : 'text-gray-600'}`}>
              {isDragActive ? 'Drop CXF file here' : 'Import CXF file or drag & drop'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ProgressiveMatchingView = ({ 
  matchData, 
  basicInfo, 
  loadedMatch, 
  loading, 
  onImportClick,
  onFileDrop,
  loadedMatchData = null,
  measurementControls = null,
  orgDefaults = null,
  astmTables = []
}) => {
  const [displayedMatch, setDisplayedMatch] = useState(null);

  // Progressive enhancement of match data
  useEffect(() => {
    // Always prioritize loadedMatchData if it exists (newly imported CxF)
    if (loadedMatchData) {
      setDisplayedMatch(loadedMatchData);
      return;
    }

    // Check if we're in a rematch state or empty state - if so, force empty match panel
    const measurementState = matchData?.matchMeasurement?.match_measurement_state;
    const isEmptyOrRematchState = measurementState === 'empty' || 
                                  measurementState === 'rematch-by-shared-with' ||
                                  measurementState === 'rematch-by-routed-to';
    if (isEmptyOrRematchState) {
      setDisplayedMatch(null);
      return;
    }

    if (loadedMatch) {
      setDisplayedMatch(loadedMatch);
    } else if (matchData?.matchMeasurement && 
               matchData.matchMeasurement.lab_l != null &&
               matchData.matchMeasurement.lab_a != null &&
               matchData.matchMeasurement.lab_b != null) {
      // Create match from Lab values
        setDisplayedMatch({
          name: 'Saved Match',
          lab: {
            L: matchData.matchMeasurement.lab_l,
            a: matchData.matchMeasurement.lab_a,
            b: matchData.matchMeasurement.lab_b
          },
          hex: matchData.matchMeasurement.matched_hex
        });
    }
  }, [loadedMatchData, loadedMatch, matchData]);

  // Show basic info immediately while detailed data loads
  const referenceColor = useMemo(() => {
    const baseColor = matchData?.color || basicInfo?.color;
    if (!baseColor) {
      // Create minimal reference color from measurements if available
      const colorMeasurements = matchData?.colorMeasurements || [];
      const preferredMeasurement = colorMeasurements.find(m => 
        String(m.mode || '').toUpperCase() === 'M1'
      ) || colorMeasurements[0];
      
      if (preferredMeasurement?.lab) {
        return {
          id: 'reference-from-measurements',
          name: 'Reference Color',
          hex: '#cccccc',
          measurements: colorMeasurements,
          lab: preferredMeasurement.lab
        };
      }
      return null;
    }
    
    // Attach measurements to reference color for Lab derivation
    const colorMeasurements = matchData?.colorMeasurements || [];
    return {
      ...baseColor,
      measurements: colorMeasurements
    };
  }, [matchData?.color, basicInfo?.color, matchData?.colorMeasurements]);

  if (!referenceColor && loading) {
    return (
      <div className="grid grid-cols-2 flex-grow gap-0">
        <Card className="h-full flex flex-col overflow-hidden rounded-r-none">
          <CardHeader>
            <CardTitle>Reference</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            <Skeleton className="w-full h-full" />
          </CardContent>
        </Card>
        <Card className="h-full flex flex-col overflow-hidden rounded-l-none">
          <CardHeader>
            <CardTitle>Match</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            <Skeleton className="w-full h-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div 
      className="grid grid-cols-2 flex-grow"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <ColorPanel 
        title="Reference" 
        color={referenceColor} 
        isMaster 
        measurementControls={measurementControls}
        orgDefaults={orgDefaults}
        astmTables={astmTables}
      />
      {displayedMatch ? (
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <ColorPanel 
            title="Match" 
            color={{
              ...displayedMatch,
              name: displayedMatch.name || 'Color Match'
            }} 
            measurementControls={measurementControls}
            orgDefaults={orgDefaults}
            astmTables={astmTables}
          />
        </motion.div>
      ) : (
        <EmptyMatchPanel onImportClick={onImportClick} onFileDrop={onFileDrop} />
      )}
    </motion.div>
  );
};

export default React.memo(ProgressiveMatchingView);