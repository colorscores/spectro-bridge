import { supabase } from '@/lib/customSupabaseClient';
import { calculateInkConditionColorHex } from '@/lib/colorUtils/inkConditionColorHex';

/**
 * Backfill color_hex for ink conditions that have spectral data but no or incorrect color_hex
 */
export const backfillInkConditionColors = async (organizationId, orgDefaults, astmTables) => {
  try {
    console.log('🔄 Starting ink condition color backfill for organization:', organizationId);

    // Fetch ink conditions that need color backfill
    const { data: conditions, error: fetchError } = await supabase
      .from('ink_conditions')
      .select(`
        id, name, color_hex, imported_tints, adapted_tints, lab,
        measurement_settings, ui_state,
        inks!inner(organization_id)
      `)
      .eq('inks.organization_id', organizationId)
      .or('color_hex.is.null,color_hex.eq.#808080,color_hex.eq.#f3f4f6');

    if (fetchError) {
      console.error('Failed to fetch ink conditions for backfill:', fetchError);
      throw fetchError;
    }

    if (!conditions || conditions.length === 0) {
      console.log('No ink conditions need color backfill');
      return { updated: 0, errors: [] };
    }

    console.log(`Found ${conditions.length} ink conditions that need color backfill`);

    let updated = 0;
    const errors = [];

    for (const condition of conditions) {
      try {
        // Calculate the correct color_hex using unified approach
        // Try imported mode first, then adapted mode  
        let newColorHex = calculateInkConditionColorHex(
          condition,
          'imported',
          orgDefaults,
          astmTables
        );
        
        // If imported mode doesn't work, try adapted mode
        if (!newColorHex || newColorHex === '#f3f4f6' || newColorHex === '#808080') {
          newColorHex = calculateInkConditionColorHex(
            condition,
            'adapted',
            orgDefaults,
            astmTables
          );
        }

        if (newColorHex && newColorHex !== condition.color_hex) {
          const { error: updateError } = await supabase
            .from('ink_conditions')
            .update({ 
              color_hex: newColorHex,
              updated_at: new Date().toISOString()
            })
            .eq('id', condition.id);

          if (updateError) {
            errors.push({ id: condition.id, error: updateError.message });
          } else {
            updated++;
            console.log(`✅ Updated color_hex for condition ${condition.name}: ${newColorHex}`);
          }
        }
      } catch (error) {
        errors.push({ id: condition.id, error: error.message });
      }
    }

    console.log(`✅ Backfill complete: ${updated} updated, ${errors.length} errors`);
    return { updated, errors };
  } catch (error) {
    console.error('Ink condition color backfill failed:', error);
    throw error;
  }
};

/**
 * Backfill a single ink condition's color_hex
 */
export const backfillSingleInkConditionColor = async (conditionId, orgDefaults, astmTables) => {
  try {
    // Fetch the ink condition
    const { data: condition, error: fetchError } = await supabase
      .from('ink_conditions')
      .select('*')
      .eq('id', conditionId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch ink condition for backfill:', fetchError);
      throw fetchError;
    }

    // Calculate the correct color_hex
    const newColorHex = calculateInkConditionColorHex(
      condition,
      'imported', // Default to imported mode for backfill
      orgDefaults,
      astmTables
    );

    if (newColorHex) {
      const { error: updateError } = await supabase
        .from('ink_conditions')
        .update({ 
          color_hex: newColorHex,
          updated_at: new Date().toISOString()
        })
        .eq('id', conditionId);

      if (updateError) {
        console.error('Failed to update ink condition color_hex:', updateError);
        throw updateError;
      }

      console.log(`✅ Updated color_hex for condition ${condition.name}: ${newColorHex}`);
      return newColorHex;
    }

    return condition.color_hex;
  } catch (error) {
    console.error('Single ink condition color backfill failed:', error);
    throw error;
  }
};