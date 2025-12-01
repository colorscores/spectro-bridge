import { supabase } from '@/lib/customSupabaseClient';
import { calculateInkConditionColorHex } from '@/lib/colorUtils/inkConditionColorHex';

/**
 * Utility to backfill missing color_hex values for ink conditions
 */
export const backfillInkConditionColors = async (organizationId, orgDefaults, astmTables) => {
  try {
    console.log('🔄 Starting ink condition color backfill for organization:', organizationId);

    // Find ink conditions with missing or invalid color_hex values
    const { data: conditions, error: fetchError } = await supabase
      .from('ink_conditions')
      .select(`
        *,
        inks!inner(organization_id)
      `)
      .eq('inks.organization_id', organizationId)
      .or('color_hex.is.null,color_hex.eq.#f3f4f6,color_hex.eq.#E5E7EB');

    if (fetchError) {
      throw fetchError;
    }

    if (!conditions || conditions.length === 0) {
      console.log('✅ No ink conditions need color_hex backfill');
      return 0;
    }

    console.log(`🔄 Found ${conditions.length} ink conditions needing color_hex backfill`);

    // Calculate and update color_hex for each condition
    const updates = [];
    for (const condition of conditions) {
      const preferredDataMode = condition.measurement_settings?.preferred_data_mode || 
                               orgDefaults?.default_measurement_mode || 
                               (condition.spectral_data && Object.keys(condition.spectral_data).length > 0 ? 'adapted' : 'imported');

      const newColorHex = calculateInkConditionColorHex(
        condition,
        preferredDataMode,
        orgDefaults,
        astmTables
      );

      updates.push({
        id: condition.id,
        color_hex: newColorHex,
        updated_at: new Date().toISOString()
      });

      console.log(`🎨 Calculated color_hex for condition ${condition.id}:`, {
        newColorHex,
        preferredDataMode,
        hasImportedTints: condition.imported_tints?.length || 0
      });
    }

    // Bulk update the conditions
    const { error: updateError } = await supabase
      .from('ink_conditions')
      .upsert(updates, { onConflict: 'id' });

    if (updateError) {
      throw updateError;
    }

    console.log(`✅ Successfully backfilled color_hex for ${updates.length} ink conditions`);
    return updates.length;
  } catch (error) {
    console.error('Failed to backfill ink condition colors:', error);
    throw error;
  }
};

/**
 * Check and report on ink conditions with missing color_hex values
 */
export const auditInkConditionColors = async (organizationId) => {
  try {
    const { data: conditions, error } = await supabase
      .from('ink_conditions')
      .select(`
        id,
        color_hex,
        inks!inner(organization_id)
      `)
      .eq('inks.organization_id', organizationId);

    if (error) throw error;

    const missing = conditions.filter(c => !c.color_hex || c.color_hex === '#f3f4f6' || c.color_hex === '#E5E7EB');
    const valid = conditions.filter(c => c.color_hex && c.color_hex !== '#f3f4f6' && c.color_hex !== '#E5E7EB');

    return {
      total: conditions.length,
      valid: valid.length,
      missing: missing.length,
      missingIds: missing.map(c => c.id)
    };
  } catch (error) {
    console.error('Failed to audit ink condition colors:', error);
    throw error;
  }
};