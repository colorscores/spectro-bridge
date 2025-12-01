import { supabase } from '@/integrations/supabase/client';
import { computeDefaultDisplayColor } from '@/lib/colorUtils';

/**
 * Repair substrate conditions that have invalid hex colors like #ANANAN
 * This fixes the immediate issue caused by incorrect color calculation
 */
export const repairInvalidSubstrateConditionColors = async (organizationId) => {
  try {
    console.log('🔧 Starting repair of invalid substrate condition colors for org:', organizationId);

    // Get organization defaults
    const { data: org } = await supabase
      .from('organizations')
      .select('default_illuminant, default_observer, default_astm_table')
      .eq('id', organizationId)
      .single();

    if (!org) {
      throw new Error('Organization not found');
    }

    const orgDefaults = {
      default_illuminant: org.default_illuminant || 'D50',
      default_observer: org.default_observer || '2',
      default_astm_table: org.default_astm_table || '5'
    };

    // Load ASTM tables
    const { data: astmTables } = await supabase
      .from('astm_e308_tables')
      .select('*');

    if (!astmTables?.length) {
      throw new Error('No ASTM tables found');
    }

    // Find substrate conditions with invalid hex colors
    const { data: conditions } = await supabase
      .from('substrate_conditions')
      .select(`
        id,
        color_hex,
        spectral_data,
        lab,
        lab_l,
        lab_a, 
        lab_b,
        lab_illuminant,
        substrates!inner(organization_id)
      `)
      .eq('substrates.organization_id', organizationId)
      .or('color_hex.like.%AN%,color_hex.like.%NaN%,color_hex.is.null');

    if (!conditions?.length) {
      console.log('✅ No invalid substrate condition colors found');
      return { repaired: 0, errors: [] };
    }

    console.log(`🔍 Found ${conditions.length} substrate conditions with invalid colors`);

    const repairs = [];
    const errors = [];

    for (const condition of conditions) {
      try {
        console.log(`🔧 Repairing condition ${condition.id} with hex: ${condition.color_hex}`);

        // Use the standardized color calculation
        const newHex = computeDefaultDisplayColor(condition, orgDefaults, astmTables);

        if (newHex && newHex !== condition.color_hex) {
          repairs.push({
            id: condition.id,
            oldHex: condition.color_hex,
            newHex: newHex
          });

          // Update the condition
          await supabase
            .from('substrate_conditions')
            .update({ color_hex: newHex })
            .eq('id', condition.id);

          console.log(`✅ Repaired ${condition.id}: ${condition.color_hex} → ${newHex}`);
        } else {
          console.log(`⚠️ Could not calculate valid hex for condition ${condition.id}`);
          errors.push({
            id: condition.id,
            error: 'Could not calculate valid hex color'
          });
        }
      } catch (error) {
        console.error(`❌ Error repairing condition ${condition.id}:`, error);
        errors.push({
          id: condition.id,
          error: error.message
        });
      }
    }

    console.log(`🎉 Repair completed: ${repairs.length} repaired, ${errors.length} errors`);

    return {
      repaired: repairs.length,
      repairs,
      errors
    };

  } catch (error) {
    console.error('❌ Error during substrate condition repair:', error);
    throw error;
  }
};

/**
 * Helper to check for and repair a single substrate condition
 */
export const repairSingleSubstrateCondition = async (conditionId) => {
  try {
    const { data: condition } = await supabase
      .from('substrate_conditions')
      .select(`
        id,
        color_hex,
        spectral_data,
        lab,
        lab_l,
        lab_a,
        lab_b,
        lab_illuminant,
        substrates!inner(
          organization_id,
          organizations!inner(
            default_illuminant,
            default_observer,
            default_astm_table
          )
        )
      `)
      .eq('id', conditionId)
      .single();

    if (!condition) {
      throw new Error('Substrate condition not found');
    }

    // Check if hex is invalid
    const isInvalid = !condition.color_hex || 
                     condition.color_hex.includes('AN') || 
                     condition.color_hex.includes('NaN') ||
                     condition.color_hex.length < 4;

    if (!isInvalid) {
      console.log('✅ Substrate condition color is already valid');
      return { repaired: false, reason: 'Already valid' };
    }

    const orgDefaults = condition.substrates.organizations;

    // Load ASTM tables
    const { data: astmTables } = await supabase
      .from('astm_e308_tables')
      .select('*');

    // Calculate new hex
    const newHex = computeDefaultDisplayColor(condition, orgDefaults, astmTables);

    if (!newHex) {
      throw new Error('Could not calculate valid hex color');
    }

    // Update the condition
    await supabase
      .from('substrate_conditions')
      .update({ color_hex: newHex })
      .eq('id', conditionId);

    console.log(`✅ Repaired single condition: ${condition.color_hex} → ${newHex}`);

    return {
      repaired: true,
      oldHex: condition.color_hex,
      newHex: newHex
    };

  } catch (error) {
    console.error('❌ Error repairing single substrate condition:', error);
    throw error;
  }
};