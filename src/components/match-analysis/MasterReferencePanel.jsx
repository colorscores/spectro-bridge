
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { labToHexD65, extractSpectralData } from '@/lib/colorUtils';
import { useSpectralCalculations } from '@/hooks/useSpectralCalculations';
import { getSolidSpectralData } from '@/lib/colorUtils/spectralDataHelpers';
import { normalizeTints } from '@/lib/tintsUtils';

const MasterReferencePanel = ({ color, controls = {}, standards, isCalculating = false }) => {
  const [localStandards, setLocalStandards] = useState({
    illuminants: [],
    observers: [],
    astmTables: [],
    loading: true,
  });

  const [inkSolidTint, setInkSolidTint] = useState(null);
  
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

  // Fetch ink solid tint if this is an ink-based color
  useEffect(() => {
    if (!color?.from_ink_condition_id) {
      setInkSolidTint(null);
      return;
    }

    const fetchInkSolidTint = async () => {
      try {
        const { data, error } = await supabase
          .from('ink_conditions')
          .select('spectral_data, lab, ch, imported_tints')
          .eq('id', color.from_ink_condition_id)
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
  }, [color?.from_ink_condition_id]);

  // Extract spectral data for useSpectralCalculations hook
  const spectralData = useMemo(() => {
    if (!color) return null;

    const mode = controls?.mode || 'M0';

    // Ink-based colors: prefer adapted (DB) solid, then imported solid
    if (color.from_ink_condition_id || Array.isArray(color?.imported_tints)) {
      // 🎯 Phase 2: Try adapted first with adapted_tints
      const adaptedTints = normalizeTints(color?.adapted_tints);
      const adapted = getSolidSpectralData(color, 'adapted', adaptedTints, inkSolidTint, { mode });
      if (adapted?.spectralData && Object.keys(adapted.spectralData).length > 0) return adapted.spectralData;
      
      // Fall back to imported with imported_tints
      const importedTints = normalizeTints(color?.imported_tints);
      const imported = getSolidSpectralData(color, 'imported', importedTints, inkSolidTint, { mode });
      if (imported?.spectralData && Object.keys(imported.spectralData).length > 0) return imported.spectralData;
    }

    // Non-ink or fallback: choose measurement matching mode, then any
    const ms = Array.isArray(color?.measurements) ? color.measurements : [];
    const m = ms.find(m => (m?.mode === mode) && m?.spectral_data && Object.keys(m.spectral_data || {}).length > 0)
             || ms.find(m => m?.spectral_data && Object.keys(m.spectral_data || {}).length > 0);
    if (m?.spectral_data) return m.spectral_data;

    // Last resort: generic extractor
    return extractSpectralData(color, 'MasterReferencePanel');
  }, [color, controls?.mode, inkSolidTint]);

  // Use the proven spectral calculations hook
  const calculations = useSpectralCalculations(
    spectralData,
    controls?.illuminant || 'D50',
    controls?.observer || '2',
    controls?.table || '5'
  );

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-r p-4 pb-4">
        <h3 className="text-lg font-semibold text-gray-800">Reference</h3>
      </div>
      <div className="flex-grow">
        <div 
          className="h-full flex items-end p-6"
          style={{ 
            backgroundColor: calculations.lab 
              ? labToHexD65(calculations.lab.L, calculations.lab.a, calculations.lab.b, controls?.illuminant || 'D50') 
              : color && Number.isFinite(color.lab_l) && Number.isFinite(color.lab_a) && Number.isFinite(color.lab_b)
              ? labToHexD65(color.lab_l, color.lab_a, color.lab_b, controls?.illuminant || 'D50')
              : color?.hex || 'transparent'
          }}
        >
          <div className="bg-black bg-opacity-40 p-3 rounded-lg text-white">
            <h2 className="text-sm font-semibold mb-2">Reference</h2>
            <p className="text-lg font-bold">{color.name}</p>
            <p className="font-mono text-sm mt-1">
              Lab: {isCalculating
                ? 'Calculating...'
                : calculations.lab 
                ? `${calculations.lab.L.toFixed(2)}, ${calculations.lab.a.toFixed(2)}, ${calculations.lab.b.toFixed(2)}`
                : color && Number.isFinite(color.lab_l) && Number.isFinite(color.lab_a) && Number.isFinite(color.lab_b)
                ? `${color.lab_l.toFixed(2)}, ${color.lab_a.toFixed(2)}, ${color.lab_b.toFixed(2)} (stored)`
                : spectralData ? 'Calculating...' : 'No Lab data'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasterReferencePanel;
