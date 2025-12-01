import { supabase } from '@/integrations/supabase/client';
import { normalizeTints } from '@/lib/tintsUtils';

/**
 * Backfills available_modes for substrate conditions that have imported_tints but missing available_modes
 */
export const backfillSubstrateConditionModes = async (substrateConditionId = null) => {
  try {
    console.log('🔄 Starting substrate condition modes backfill...');

    // Build query - either for specific condition or all conditions missing available_modes
    let query = supabase
      .from('substrate_conditions')
      .select('id, imported_tints, measurement_settings');

    if (substrateConditionId) {
      query = query.eq('id', substrateConditionId);
    } else {
      // Only get conditions that have imported_tints but missing available_modes
      query = query
        .not('imported_tints', 'is', null)
        .or('measurement_settings.is.null,measurement_settings.not.cs.{"available_modes"}');
    }

    const { data: conditions, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch substrate conditions: ${fetchError.message}`);
    }

    if (!conditions || conditions.length === 0) {
      console.log('✅ No substrate conditions need mode backfill');
      return { updated: 0, total: 0 };
    }

    console.log(`🔍 Found ${conditions.length} substrate conditions to backfill`);

    let updatedCount = 0;

    for (const condition of conditions) {
      try {
        if (!condition.imported_tints) {
          console.log(`⚠️ Skipping condition ${condition.id} - no imported_tints`);
          continue;
        }

        // Extract available modes from imported_tints
        const normalizedTints = normalizeTints(condition.imported_tints);
        const availableModes = new Set();

        normalizedTints.forEach(tint => {
          // Check measurements array for mode
          if (tint.measurements && Array.isArray(tint.measurements)) {
            tint.measurements.forEach(measurement => {
              if (measurement.mode) {
                availableModes.add(measurement.mode);
              }
            });
          }
          // Also check direct mode property
          if (tint.mode) {
            availableModes.add(tint.mode);
          }
        });

        if (availableModes.size === 0) {
          console.log(`⚠️ No modes found in condition ${condition.id}`);
          continue;
        }

        // Update measurement_settings with available_modes
        const currentSettings = condition.measurement_settings || {};
        const updatedSettings = {
          ...currentSettings,
          available_modes: Array.from(availableModes)
        };

        const { error: updateError } = await supabase
          .from('substrate_conditions')
          .update({ measurement_settings: updatedSettings })
          .eq('id', condition.id);

        if (updateError) {
          console.error(`❌ Failed to update condition ${condition.id}:`, updateError);
          continue;
        }

        console.log(`✅ Updated condition ${condition.id} with modes:`, Array.from(availableModes));
        updatedCount++;

      } catch (conditionError) {
        console.error(`❌ Error processing condition ${condition.id}:`, conditionError);
        continue;
      }
    }

    console.log(`✅ Backfill completed: ${updatedCount}/${conditions.length} conditions updated`);
    return { updated: updatedCount, total: conditions.length };

  } catch (error) {
    console.error('❌ Error in substrate condition modes backfill:', error);
    throw error;
  }
};

/**
 * Backfills the current substrate condition specifically
 */
export const backfillCurrentSubstrateCondition = async () => {
  const currentConditionId = '1a009524-9946-4df0-82f1-90a8d16856f6';
  return await backfillSubstrateConditionModes(currentConditionId);
};