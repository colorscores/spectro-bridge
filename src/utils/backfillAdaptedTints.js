// Utility to backfill missing adapted_tints for ink conditions that should have them
import { supabase } from '@/integrations/supabase/client';
import { adaptTintsToSubstrate } from '@/lib/colorUtils/tintAdaptation';
import { normalizeTints, getTintPercentage } from '@/lib/tintsUtils';

export const backfillAdaptedTintsForCondition = async (conditionId) => {
  console.log('🔄 Starting backfill for condition:', conditionId);
  
  try {
    // Fetch the ink condition with substrate data
    const { data: condition, error: conditionError } = await supabase
      .from('ink_conditions')
      .select('*')
      .eq('id', conditionId)
      .single();
      
    if (conditionError || !condition) {
      console.error('Failed to fetch condition:', conditionError);
      return { success: false, error: 'Condition not found' };
    }
    
    // Check if already has adapted_tints
    if (condition.adapted_tints && condition.adapted_tints.length > 0) {
      console.log('✅ Condition already has adapted_tints');
      return { success: true, message: 'Already has adapted_tints' };
    }
    
    // Check if has substrate_condition and imported_tints
    if (!condition.substrate_condition || !condition.imported_tints) {
      console.log('❌ Missing substrate_condition or imported_tints');
      return { success: false, error: 'Missing required data' };
    }
    
    // Fetch substrate condition data
    const { data: substrateData, error: substrateError } = await supabase
      .from('substrate_conditions')
      .select('spectral_data, lab, ch, color_hex')
      .eq('id', condition.substrate_condition)
      .single();
      
    if (substrateError || !substrateData?.spectral_data) {
      console.error('Failed to fetch substrate spectral data:', substrateError);
      return { success: false, error: 'Substrate spectral data not found' };
    }
    
    // Fetch ASTM tables
    const { data: astmTables, error: astmError } = await supabase
      .from('astm_e308_tables')
      .select('*');
      
    if (astmError || !astmTables?.length) {
      console.error('Failed to fetch ASTM tables:', astmError);
      return { success: false, error: 'ASTM tables not found' };
    }
    
    // Normalize imported tints and extract substrate spectral data
    const normalizedImportedTints = normalizeTints(condition.imported_tints);
    const importedSubstrateSpectral = normalizedImportedTints.find(t => getTintPercentage(t) === 0)?.spectral_data || {};
    const targetSubstrateSpectral = substrateData.spectral_data;
    
    console.log('📊 DIAGNOSTIC - Substrate spectral comparison:', {
      imported_400nm: importedSubstrateSpectral['400'],
      target_400nm: targetSubstrateSpectral['400'],
      substrate_condition_id: condition.substrate_condition,
      are_identical: importedSubstrateSpectral['400'] === targetSubstrateSpectral['400'],
      imported_points: Object.keys(importedSubstrateSpectral).length,
      target_points: Object.keys(targetSubstrateSpectral).length
    });
    
    // Compute adapted tints
    const measurementSettings = condition.measurement_settings || {};
    const adaptedTints = adaptTintsToSubstrate(
      normalizedImportedTints,
      importedSubstrateSpectral,
      targetSubstrateSpectral,
      {
        astmTables,
        selectedMode: measurementSettings.mode || measurementSettings.measurement_mode || 'M0',
        measurementControls: {
          mode: measurementSettings.mode || measurementSettings.measurement_mode || 'M0',
          illuminant: measurementSettings.illuminant || 'D50',
          observer: measurementSettings.observer || '2',
          table: measurementSettings.table || '5'
        }
      }
    );
    
    if (!adaptedTints || adaptedTints.length === 0) {
      console.error('❌ Failed to compute adapted_tints');
      return { success: false, error: 'Adaptation failed' };
    }
    
    console.log('✅ Computed adapted_tints:', adaptedTints.length, 'tints');
    console.log('📊 Adapted tint percentages:', adaptedTints.map(t => getTintPercentage(t)));
    
    // Update the condition with adapted_tints and data mode preferences
    const updatePayload = {
      adapted_tints: adaptedTints,
      ui_state: {
        ...condition.ui_state,
        active_data_mode: 'adapted',
        backfilled_at: new Date().toISOString()
      },
      measurement_settings: {
        ...condition.measurement_settings,
        preferred_data_mode: 'adapted',
        illuminant: 'D50',
        observer: '2',
        table: '5'
      }
    };
    
    const { error: updateError } = await supabase
      .from('ink_conditions')
      .update(updatePayload)
      .eq('id', conditionId);
      
    if (updateError) {
      console.error('Failed to update condition:', updateError);
      return { success: false, error: 'Update failed' };
    }
    
    console.log('✅ Successfully backfilled adapted_tints and set data mode to adapted');
    return { 
      success: true, 
      message: `Backfilled ${adaptedTints.length} adapted tints`,
      adaptedTintsCount: adaptedTints.length
    };
    
  } catch (error) {
    console.error('❌ Backfill error:', error);
    return { success: false, error: error.message };
  }
};

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.backfillAdaptedTints = backfillAdaptedTintsForCondition;
}