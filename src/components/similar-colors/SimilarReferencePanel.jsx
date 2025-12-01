import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/customSupabaseClient';
import { labToHexD65, extractSpectralData } from '@/lib/colorUtils';
import { useSpectralCalculations } from '@/hooks/useSpectralCalculations';
import { getSolidSpectralData } from '@/lib/colorUtils/spectralDataHelpers';
import { normalizeTints } from '@/lib/tintsUtils';

// Normalize illuminant name to key format expected by labToHex
const normalizeIlluminantKey = (illuminantName) => {
  if (!illuminantName) return 'D50';
  
  // Map common illuminant names to their keys
  const illuminantMap = {
    'D50': 'D50',
    'D65': 'D65',
    'A': 'A',
    'C': 'C',
    'E': 'E',
    'F2': 'F2',
    'F7': 'F7',
    'F11': 'F11'
  };
  
  // Try direct match first
  if (illuminantMap[illuminantName]) {
    return illuminantMap[illuminantName];
  }
  
  // Try to extract key from longer names
  const normalizedName = illuminantName.toUpperCase();
  for (const [key, value] of Object.entries(illuminantMap)) {
    if (normalizedName.includes(key)) {
      return value;
    }
  }
  
  // Default fallback
  return 'D50';
};

// Helper to coerce values to numbers (handles string Lab values)
const toNum = (v) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const parsed = parseFloat(v);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const SimilarReferencePanel = ({ color, controls, standards, activeDataMode, onLabUpdate, isCalculating = false }) => {
  // CRITICAL: Track if color is missing but NEVER return early before hooks
  const noColor = !color;
  
  // Validate controls object structure
  const safeControls = controls || {};
  
  const [localStandards, setLocalStandards] = useState({
    illuminants: [],
    observers: [],
    astmTables: [],
    loading: true,
  });

  const [enrichedColor, setEnrichedColor] = useState(null);
  const [currentHex, setCurrentHex] = useState(null);
  const [inkSolidTint, setInkSolidTint] = useState(null);
  const lastHexRef = useRef(null);
  
  // Use external standards if provided, otherwise use local
  const effectiveStandards = standards || localStandards;

  // Fetch measurement standards only if not provided externally
  useEffect(() => {
    if (standards) return; // Skip if external standards are provided
    
    const fetchStandards = async () => {
      try {
        const [illuminantsRes, observersRes, astmTablesRes] = await Promise.all([
          supabase.from('illuminants').select('*'),
          supabase.from('observers').select('*'),
          supabase.from('astm_e308_tables').select('*')
        ]);

        if (illuminantsRes.error) throw illuminantsRes.error;
        if (observersRes.error) throw observersRes.error;
        if (astmTablesRes.error) throw astmTablesRes.error;

        setLocalStandards({
          illuminants: illuminantsRes.data,
          observers: observersRes.data,
          astmTables: astmTablesRes.data,
          loading: false,
        });
      } catch (error) {
        console.error('Error fetching measurement standards:', error);
        setLocalStandards(s => ({ ...s, loading: false }));
      }
    };
    fetchStandards();
  }, [standards]);

  // Fetch color measurements and top-level Lab data if not available
  useEffect(() => {
    if (noColor) {
      setEnrichedColor(null);
      return;
    }

    // Short-circuit if we have precomputed data or sufficient existing data
    if (color.precomputedHex || 
        (Array.isArray(color.measurements) && color.measurements.length > 0 && 
         (color.measurements[0].spectral_data || color.measurements[0].lab))) {
      setEnrichedColor(color);
      return;
    }

    // If color has measurements and top-level Lab, use it as-is
    if (Array.isArray(color.measurements) && color.measurements.length > 0 && 
        color.lab_l !== undefined && color.lab_a !== undefined && color.lab_b !== undefined) {
      setEnrichedColor(color);
      return;
    }

    // Fetch both measurements and top-level Lab data
    const fetchColorData = async () => {
      try {
        // Fetch measurements and top-level Lab in parallel
        const [measurementsRes, topLabRes] = await Promise.all([
          supabase
            .from('colors_with_full_details')
            .select('id, measurements')
            .eq('id', color.id)
            .single(),
          supabase
            .from('colors')
            .select('lab_l, lab_a, lab_b')
            .eq('id', color.id)
            .single()
        ]);

        // Combine all data
        const measurements = measurementsRes.data?.measurements || [];
        const topLab = topLabRes.data || {};
        
        setEnrichedColor({
          ...color,
          measurements,
          lab_l: topLab.lab_l ?? color.lab_l,
          lab_a: topLab.lab_a ?? color.lab_a,
          lab_b: topLab.lab_b ?? color.lab_b
        });
      } catch (error) {
        console.error('Error fetching reference color data:', error);
        // Fallback to color_measurements table for measurements only
        try {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('color_measurements')
            .select('mode, lab, spectral_data')
            .eq('color_id', color.id);

          if (fallbackError) throw fallbackError;

          setEnrichedColor({
            ...color,
            measurements: fallbackData || []
          });
        } catch (fallbackError) {
          console.error('Fallback measurement fetch failed:', fallbackError);
          setEnrichedColor(color);
        }
      }
    };

    fetchColorData();
  }, [color?.id]);

  // Fetch ink solid tint if this is an ink-based color
  useEffect(() => {
    if (!enrichedColor?.from_ink_condition_id) {
      setInkSolidTint(null);
      return;
    }

    const fetchInkSolidTint = async () => {
      try {
        const { data, error } = await supabase
          .from('ink_conditions')
          .select('spectral_data, lab, ch, imported_tints')
          .eq('id', enrichedColor.from_ink_condition_id)
          .maybeSingle();

        if (error) throw error;
        
        if (!data) {
          setInkSolidTint(null);
          return;
        }

        const tints = normalizeTints(data?.imported_tints);
        const solidTint = tints?.find(t => t?.tintPercentage === 100 || t?.tint_percentage === 100);
        
        if (solidTint) {
          setInkSolidTint(solidTint);
        }
      } catch (error) {
        console.error('Error fetching ink solid tint:', error);
        setInkSolidTint(null);
      }
    };

    fetchInkSolidTint();
  }, [enrichedColor?.from_ink_condition_id]);

  // Extract spectral data for useSpectralCalculations hook
  const spectralData = useMemo(() => {
    if (noColor || !enrichedColor) return null;

    const mode = safeControls?.mode || 'M0';
    
    console.log('SimilarReferencePanel - Spectral data selection:', {
      colorId: enrichedColor?.id,
      activeDataMode,
      mode,
      hasFromInkCondition: !!enrichedColor.from_ink_condition_id,
      hasImportedTints: Array.isArray(enrichedColor?.imported_tints)
    });

    // Ink-based colors: use activeDataMode to guide selection
    if (enrichedColor.from_ink_condition_id || Array.isArray(enrichedColor?.imported_tints)) {
      // 🎯 Phase 2: Use correct tints based on activeDataMode
      if (activeDataMode === 'adapted') {
        const adaptedTints = normalizeTints(enrichedColor?.adapted_tints);
        const adapted = getSolidSpectralData(enrichedColor, 'adapted', adaptedTints, inkSolidTint, { mode });
        console.log('SimilarReferencePanel - Adapted data result:', { found: !!adapted?.spectralData });
        if (adapted?.spectralData && Object.keys(adapted.spectralData).length > 0) return adapted.spectralData;
        
        // Fallback to imported if adapted not available
        const importedTints = normalizeTints(enrichedColor?.imported_tints);
        const imported = getSolidSpectralData(enrichedColor, 'imported', importedTints, inkSolidTint, { mode });
        console.log('SimilarReferencePanel - Imported fallback result:', { found: !!imported?.spectralData });
        if (imported?.spectralData && Object.keys(imported.spectralData).length > 0) return imported.spectralData;
      } else if (activeDataMode === 'imported') {
        const importedTints = normalizeTints(enrichedColor?.imported_tints);
        const imported = getSolidSpectralData(enrichedColor, 'imported', importedTints, inkSolidTint, { mode });
        console.log('SimilarReferencePanel - Imported data result:', { found: !!imported?.spectralData });
        if (imported?.spectralData && Object.keys(imported.spectralData).length > 0) return imported.spectralData;
        
        // No fallback to adapted when explicitly requesting imported
      } else {
        // Default behavior when activeDataMode is null/undefined
        const adaptedTints = normalizeTints(enrichedColor?.adapted_tints);
        const adapted = getSolidSpectralData(enrichedColor, 'adapted', adaptedTints, inkSolidTint, { mode });
        if (adapted?.spectralData && Object.keys(adapted.spectralData).length > 0) return adapted.spectralData;
        
        const importedTints = normalizeTints(enrichedColor?.imported_tints);
        const imported = getSolidSpectralData(enrichedColor, 'imported', importedTints, inkSolidTint, { mode });
        if (imported?.spectralData && Object.keys(imported.spectralData).length > 0) return imported.spectralData;
      }
    }

    // Non-ink or fallback: choose measurement matching mode, then any
    const ms = Array.isArray(enrichedColor?.measurements) ? enrichedColor.measurements : [];
    const m = ms.find(m => (m?.mode === mode) && m?.spectral_data && Object.keys(m.spectral_data || {}).length > 0)
             || ms.find(m => m?.spectral_data && Object.keys(m.spectral_data || {}).length > 0);
    console.log('SimilarReferencePanel - Measurement fallback:', { found: !!m?.spectral_data });
    if (m?.spectral_data) return m.spectral_data;

    // Last resort: generic extractor
    console.log('SimilarReferencePanel - Using generic extractor as last resort');
    return extractSpectralData(enrichedColor, 'SimilarReferencePanel');
  }, [noColor, enrichedColor, controls?.mode, activeDataMode, inkSolidTint]);

  // Use the proven spectral calculations hook with safe controls
  const calculations = useSpectralCalculations(
    spectralData,
    safeControls?.illuminant || 'D50',
    safeControls?.observer || '2',
    safeControls?.table || '5'
  );

  // Calculate hex color from Lab values and notify parent
  useEffect(() => {
    const labValues = calculations.lab;
    
    // If we have calculated Lab values, use them
    if (labValues && Number.isFinite(labValues.L) && Number.isFinite(labValues.a) && Number.isFinite(labValues.b)) {
      try {
        const illuminantKey = normalizeIlluminantKey(safeControls?.illuminant);
        const hex = labToHexD65(labValues.L, labValues.a, labValues.b, illuminantKey);
        setCurrentHex(hex);
        lastHexRef.current = hex;
        
        // Notify parent of updated Lab and hex values
        if (onLabUpdate) {
          onLabUpdate({
            lab: labValues,
            hex: hex
          });
        }
      } catch (error) {
        console.error('Error converting Lab to hex:', error);
        // keep previous hex to avoid flash
      }
      return;
    }

    // Fallback to stored Lab values if spectral calculation unavailable
    if (enrichedColor && 
        Number.isFinite(enrichedColor.lab_l) && 
        Number.isFinite(enrichedColor.lab_a) && 
        Number.isFinite(enrichedColor.lab_b)) {
      try {
        const illuminantKey = normalizeIlluminantKey(safeControls?.illuminant);
        const fallbackHex = labToHexD65(enrichedColor.lab_l, enrichedColor.lab_a, enrichedColor.lab_b, illuminantKey);
        setCurrentHex(fallbackHex);
        lastHexRef.current = fallbackHex;
        
        // Notify parent with stored Lab values
        if (onLabUpdate) {
          onLabUpdate({
            lab: { L: enrichedColor.lab_l, a: enrichedColor.lab_a, b: enrichedColor.lab_b },
            hex: fallbackHex
          });
        }
      } catch (error) {
        console.error('Error converting stored Lab to hex:', error);
      }
      return;
    }

    // Fallback to measurement Lab (e.g., selected wedge without spectral)
    if (Array.isArray(enrichedColor?.measurements)) {
      const mLab = enrichedColor.measurements.find(m => m?.lab && Number.isFinite(m.lab.L) && Number.isFinite(m.lab.a) && Number.isFinite(m.lab.b))?.lab;
      if (mLab) {
        try {
          const illuminantKey = normalizeIlluminantKey(safeControls?.illuminant);
          const measHex = labToHexD65(mLab.L, mLab.a, mLab.b, illuminantKey);
          setCurrentHex(measHex);
          lastHexRef.current = measHex;
          if (onLabUpdate) {
            onLabUpdate({ lab: mLab, hex: measHex });
          }
        } catch (error) {
          console.error('Error converting measurement Lab to hex:', error);
        }
        return;
      }
    }
  }, [calculations.lab, safeControls?.illuminant, onLabUpdate, enrichedColor]);

  // Render fallback UI if no color provided (but hooks already called above)
  if (noColor) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-white border-b border-r p-4 flex items-center h-16">
          <h3 className="text-lg font-semibold text-gray-800">Reference</h3>
        </div>
        <div className="flex-grow flex items-center justify-center p-6">
          <p className="text-muted-foreground">No reference color selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-r p-4 flex items-center h-16">
        <h3 className="text-lg font-semibold text-gray-800">Reference</h3>
      </div>
      <div className="flex-grow">
        <div 
          className="h-full flex items-end p-6"
          style={{ 
            backgroundColor: currentHex || lastHexRef.current || 'transparent'
          }}
        >
          <div className="bg-black bg-opacity-40 p-3 rounded-lg text-white">
            <h2 className="text-sm font-semibold mb-2">Reference</h2>
            <p className="text-lg font-bold">{enrichedColor?.name || color?.name}</p>
            <p className="font-mono text-sm mt-1">
              Lab: {calculations.lab && Number.isFinite(calculations.lab.L) && Number.isFinite(calculations.lab.a) && Number.isFinite(calculations.lab.b)
                ? `${calculations.lab.L.toFixed(2)}, ${calculations.lab.a.toFixed(2)}, ${calculations.lab.b.toFixed(2)}`
                : isCalculating
                ? 'Calculating...'
                : (enrichedColor && Number.isFinite(enrichedColor.lab_l) && Number.isFinite(enrichedColor.lab_a) && Number.isFinite(enrichedColor.lab_b))
                ? `${enrichedColor.lab_l.toFixed(2)}, ${enrichedColor.lab_a.toFixed(2)}, ${enrichedColor.lab_b.toFixed(2)} (stored)`
                : (Array.isArray(enrichedColor?.measurements) && Number.isFinite(enrichedColor?.measurements?.[0]?.lab?.L) && Number.isFinite(enrichedColor?.measurements?.[0]?.lab?.a) && Number.isFinite(enrichedColor?.measurements?.[0]?.lab?.b))
                ? `${enrichedColor.measurements[0].lab.L.toFixed(2)}, ${enrichedColor.measurements[0].lab.a.toFixed(2)}, ${enrichedColor.measurements[0].lab.b.toFixed(2)} (stored)`
                : spectralData ? 'Calculating...' : 'No Lab data'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimilarReferencePanel;