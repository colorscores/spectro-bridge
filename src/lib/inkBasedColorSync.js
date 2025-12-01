import { supabase } from '@/integrations/supabase/client';
import { computeColorHex } from './objectSpecificColorCalculation';

/**
 * Sync ink-based color hex values with their linked ink conditions
 */
export async function syncInkBasedColorHex(colorId, inkConditionId, orgDefaults, astmTables) {
  if (!colorId || !inkConditionId) return null;
  
  try {
    // Fetch the ink condition with current data
    const { data: inkCondition, error: inkError } = await supabase
      .from('ink_conditions')
      .select('*')
      .eq('id', inkConditionId)
      .single();
    
    if (inkError || !inkCondition) {
      console.error('Error fetching ink condition for sync:', inkError);
      return null;
    }
    
    // Calculate the correct hex for this ink condition
    const activeDataMode = inkCondition.ui_state?.active_data_mode || 'imported';
    const correctHex = computeColorHex(
      { from_ink_condition_id: inkConditionId, inkCondition },
      orgDefaults,
      astmTables
    );
    
    // Update the color's hex if it's different
    const { data: updatedColor, error: updateError } = await supabase
      .from('colors')
      .update({ hex: correctHex })
      .eq('id', colorId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating ink-based color hex:', updateError);
      return null;
    }
    
    console.log('Synced ink-based color hex:', {
      colorId,
      inkConditionId,
      activeDataMode,
      correctHex
    });
    
    return updatedColor;
    
  } catch (error) {
    console.error('Error in syncInkBasedColorHex:', error);
    return null;
  }
}

/**
 * Batch sync all ink-based colors for an organization
 */
export async function batchSyncInkBasedColors(organizationId, orgDefaults, astmTables) {
  if (!organizationId) return { updated: 0, errors: [] };
  
  try {
    // Fetch all ink-based colors for the organization
    const { data: inkBasedColors, error: fetchError } = await supabase
      .from('colors')
      .select('id, hex, from_ink_condition_id')
      .eq('organization_id', organizationId)
      .not('from_ink_condition_id', 'is', null);
    
    if (fetchError) {
      console.error('Error fetching ink-based colors:', fetchError);
      return { updated: 0, errors: [fetchError] };
    }
    
    const results = { updated: 0, errors: [] };
    
    for (const color of inkBasedColors) {
      try {
        const result = await syncInkBasedColorHex(
          color.id,
          color.from_ink_condition_id,
          orgDefaults,
          astmTables
        );
        
        if (result) {
          results.updated++;
        }
      } catch (error) {
        results.errors.push({ colorId: color.id, error });
      }
    }
    
    console.log('Batch sync ink-based colors completed:', results);
    return results;
    
  } catch (error) {
    console.error('Error in batchSyncInkBasedColors:', error);
    return { updated: 0, errors: [error] };
  }
}