import { useMemo, useEffect, useState } from 'react';
import { computeDynamicDisplayColor } from '@/lib/objectSpecificColorCalculation';
import { supabase } from '@/integrations/supabase/client';

/**
 * Centralized hook for calculating consistent substrate colors
 * Returns original measurement Lab values for display consistency with detail page
 * Priority: Spectral data (using measurement controls) > Lab values (from condition.lab) > stored values
 */
export const useSubstrateColorCalculation = (condition, orgDefaults, measurementControls = {}) => {
  const [astmTables, setAstmTables] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const fetchAstm = async () => {
      try {
        const { data } = await supabase
          .from('astm_e308_tables')
          .select('*');
        if (!cancelled) setAstmTables(data || []);
      } catch (e) {
        if (!cancelled) setAstmTables([]);
      }
    };
    fetchAstm();
    return () => { cancelled = true; };
  }, []);


  const calculatedColor = useMemo(() => {
    if (!condition) return null;

    // Use measurement controls first, then fall back to organization defaults
    const effectiveOrgDefaults = {
      default_illuminant: measurementControls?.illuminant || orgDefaults?.default_illuminant || 'D50',
      default_observer: measurementControls?.observer || orgDefaults?.default_observer || '2',
      default_astm_table: measurementControls?.table || orgDefaults?.default_astm_table || '5'
    };

    try {
      // Use computeDynamicDisplayColor to respect user-selected measurement controls
      const hex = computeDynamicDisplayColor(
        condition,
        orgDefaults || effectiveOrgDefaults,
        astmTables,
        measurementControls
      );
      
      if (hex && hex !== '#E5E7EB') {
        return {
          hex: hex,
          source: 'computed',
          originalLab: condition.lab || (condition.lab_l !== null ? { L: condition.lab_l, a: condition.lab_a, b: condition.lab_b } : null),
          displayIlluminant: condition.lab_illuminant || effectiveOrgDefaults.default_illuminant
        };
      }
    } catch (error) {
      console.warn('Error calculating substrate color:', error);
    }

    // Fallback: Use stored color_hex if available and valid
    if (condition.color_hex && !condition.color_hex.includes('AN') && !condition.color_hex.includes('NaN')) {
      return {
        hex: condition.color_hex,
        source: 'stored',
        originalLab: condition.lab || (condition.lab_l !== null ? { L: condition.lab_l, a: condition.lab_a, b: condition.lab_b } : null),
        displayIlluminant: condition.lab_illuminant
      };
    }

    return null;
  }, [condition, orgDefaults, measurementControls, astmTables]);

  return calculatedColor;
};