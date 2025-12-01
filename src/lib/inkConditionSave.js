import { supabase } from '@/integrations/supabase/client';
import { dbSafeTints } from '@/lib/safePlainJson';
import { getSolidColorHex } from '@/lib/colorUtils/solidColorExtractor';

/**
 * Save ink condition with adaptation data
 * Handles both substrate_condition (for inks) and print_condition (for colors)
 * 
 * @param {Object} params
 * @param {string} params.inkConditionId - ID of ink_condition to update
 * @param {Array} params.importedTints - Original imported tints (required)
 * @param {Array|null} params.adaptedTints - Adapted tints (null if not adapted)
 * @param {string} params.preferredDataMode - 'imported' or 'adapted'
 * @param {Object} params.measurementControls - Measurement settings object
 * @param {string|null} params.substrateConditionId - For ink conditions (UUID from substrate_conditions)
 * @param {string|null} params.printConditionId - For colors (UUID from print_conditions)
 * @param {string} params.organizationId - Organization UUID
 * @param {Object} params.orgDefaults - Organization defaults for color calculation
 * @param {Array} params.astmTables - ASTM tables for color calculation
 * 
 * @returns {Promise<{success: boolean, data: object|null, error: Error|null}>}
 */
export async function saveInkConditionWithAdaptation({
  inkConditionId,
  importedTints,
  adaptedTints,
  preferredDataMode,
  measurementControls,
  substrateConditionId = null,
  printConditionId = null,
  organizationId,
  orgDefaults = null,
  astmTables = null
}) {
  try {
    // 1. Sanitize tints for database storage - preserve array structure
    const safeTints = dbSafeTints(importedTints);
    const safeAdaptedTints = adaptedTints?.length ? dbSafeTints(adaptedTints) : null;
    
    // 2. Calculate solid color hex from appropriate array
    const sourceCondition = {
      imported_tints: safeTints,
      adapted_tints: safeAdaptedTints,
      color_hex: null // Will be calculated
    };
    
    let solidHex = null;
    if (orgDefaults && astmTables?.length) {
      solidHex = getSolidColorHex(sourceCondition, preferredDataMode, orgDefaults, astmTables);
    } else {
      // Fallback: extract from tints directly
      const sourceArray = preferredDataMode === 'adapted' && safeAdaptedTints 
        ? safeAdaptedTints 
        : safeTints;
      const solidTint = sourceArray?.find(t => (t.tintPercentage || t.tint_percentage || t.percentage) === 100);
      solidHex = solidTint?.colorHex || solidTint?.color_hex || solidTint?.hex || '#808080';
    }
    
    // 3. Build base update object
    const update = {
      imported_tints: safeTints,
      adapted_tints: safeAdaptedTints,
      color_hex: solidHex,
      measurement_settings: {
        ...measurementControls,
        preferred_data_mode: preferredDataMode
      },
      ui_state: {
        active_data_mode: preferredDataMode,
        last_saved_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };
    
    // 4. Add substrate reference based on context
    if (substrateConditionId) {
      // For ink conditions: link to substrate_conditions table
      update.substrate_condition = substrateConditionId;
      
      // Fetch substrate_id from substrate_conditions
      const { data: sc } = await supabase
        .from('substrate_conditions')
        .select('substrate_id')
        .eq('id', substrateConditionId)
        .maybeSingle();
      
      if (sc?.substrate_id) {
        update.substrate_id = sc.substrate_id;
      }
    } else if (printConditionId) {
      // For colors: link via print_conditions
      // Get substrate info from print_condition
      const { data: pc } = await supabase
        .from('print_conditions')
        .select('substrate_condition_id, substrate_id')
        .eq('id', printConditionId)
        .maybeSingle();
      
      if (pc) {
        // Only set substrate_condition if print condition explicitly links to one
        if (pc.substrate_condition_id) {
          update.substrate_condition = pc.substrate_condition_id;
        }
        if (pc.substrate_id) {
          update.substrate_id = pc.substrate_id;
        }
      }
      
      // Note: substrate_condition may remain null if print_condition doesn't link to one
      // This is intentional - print conditions have their own spectral_data
    }
    
    // 5. Execute update
    const { data, error } = await supabase
      .from('ink_conditions')
      .update(update)
      .eq('id', inkConditionId)
      .select()
      .maybeSingle();
    
    if (error) {
      throw error;
    }
    
    if (!data) {
      console.warn('[saveInkConditionWithAdaptation] Update succeeded but no row returned (likely RLS policy). Proceeding.');
    }
    
    // 6. For colors: also update color_print_condition_associations
    if (printConditionId) {
      // Get color_id from ink_condition
      const { data: colorData } = await supabase
        .from('colors')
        .select('id')
        .eq('from_ink_condition_id', inkConditionId)
        .maybeSingle();
      
      if (colorData?.id) {
        await supabase
          .from('color_print_condition_associations')
          .upsert({
            color_id: colorData.id,
            print_condition_id: printConditionId,
            organization_id: organizationId,
            preferred_data_mode: preferredDataMode,
            is_adapted: preferredDataMode === 'adapted',
            adapted_at: preferredDataMode === 'adapted' ? new Date().toISOString() : null
          }, {
            onConflict: 'color_id,print_condition_id'
          });
      }
    }
    
    return { success: true, data, error: null };
    
  } catch (error) {
    console.error('❌ Save failed:', error);
    return { success: false, data: null, error };
  }
}
