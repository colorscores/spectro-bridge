import { supabase } from '@/integrations/supabase/client';
import { computeSubstrateConditionHex } from '@/lib/objectSpecificColorCalculation';

/**
 * Utility to recalculate and update stored color_hex values for substrate conditions
 * This ensures consistency between spectral data, Lab values, and stored hex
 */
export const updateSubstrateConditionColors = async (organizationId, astmTables) => {
  if (!organizationId || !astmTables?.length) {
    console.warn('Missing organization ID or ASTM tables for color migration');
    return;
  }

  try {
    // Get organization defaults
    const { data: org } = await supabase
      .from('organizations')
      .select('default_illuminant, default_observer, default_astm_table')
      .eq('id', organizationId)
      .single();

    if (!org) {
      console.warn('Organization not found for color migration');
      return;
    }

    const illuminant = org.default_illuminant || 'D50';
    const observer = org.default_observer || '2';
    const tableNumber = org.default_astm_table || '5';

    // Get all substrate conditions for this organization
    const { data: conditions } = await supabase
      .from('substrate_conditions')
      .select(`
        id, 
        spectral_data, 
        lab_l, 
        lab_a, 
        lab_b, 
        lab_illuminant,
        color_hex,
        substrates!inner(organization_id)
      `)
      .eq('substrates.organization_id', organizationId);

    if (!conditions?.length) {
      console.log('No substrate conditions found for migration');
      return;
    }

    const updates = [];

    for (const condition of conditions) {
      let newColorHex = null;

      // Use standardized color calculation approach
      try {
        const conditionObject = {
          spectral_data: condition.spectral_data,
          lab_l: condition.lab_l,
          lab_a: condition.lab_a,
          lab_b: condition.lab_b,
          lab_illuminant: condition.lab_illuminant,
          color_hex: condition.color_hex
        };
        
        const orgDefaults = {
          default_illuminant: illuminant,
          default_observer: observer,
          default_astm_table: tableNumber
        };
        
        newColorHex = computeSubstrateConditionHex(conditionObject, orgDefaults, astmTables);
      } catch (error) {
        console.warn(`Error calculating color for condition ${condition.id}:`, error);
      }

      // Only update if we calculated a new hex and it's different from stored
      if (newColorHex && newColorHex !== condition.color_hex) {
        updates.push({
          id: condition.id,
          color_hex: newColorHex
        });
      }
    }

    // Batch update the conditions
    if (updates.length > 0) {
      console.log(`Updating ${updates.length} substrate condition colors`);
      
      for (const update of updates) {
        await supabase
          .from('substrate_conditions')
          .update({ color_hex: update.color_hex })
          .eq('id', update.id);
      }

      console.log('Substrate condition color migration completed');
    } else {
      console.log('No substrate condition colors need updating');
    }

  } catch (error) {
    console.error('Error during substrate color migration:', error);
    throw error;
  }
};

/**
 * Calculate and return the D65 hex color for a substrate condition
 * This is used when saving substrate conditions to ensure consistent color_hex values
 */
export const calculateSubstrateConditionHex = (condition, orgDefaults, astmTables) => {
  if (!condition || !orgDefaults) return null;

  const illuminant = orgDefaults.default_illuminant || 'D50';
  const observer = orgDefaults.default_observer || '2';
  const tableNumber = orgDefaults.default_astm_table || '5';

  // Use standardized color calculation approach
  try {
    const resolvedDefaults = {
      default_illuminant: illuminant,
      default_observer: observer,
      default_astm_table: tableNumber
    };
    
    return computeSubstrateConditionHex(condition, resolvedDefaults, astmTables);
  } catch (error) {
    console.warn('Error calculating color:', error);
    return null;
  }

  return null;
};