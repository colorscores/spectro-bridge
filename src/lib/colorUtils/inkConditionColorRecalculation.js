import { supabase } from '@/lib/customSupabaseClient';
import { calculateInkConditionColorHex, bulkRecalculateInkConditionColorHex } from './inkConditionColorHex';

/**
 * Recalculate and update color_hex for all ink conditions when data mode changes
 */
export const recalculateInkConditionColors = async (inkId, activeDataMode, orgDefaults, astmTables) => {
  try {
    console.log('🔄 Recalculating ink condition colors for data mode change:', {
      inkId,
      activeDataMode,
      hasOrgDefaults: !!orgDefaults,
      hasAstmTables: !!astmTables
    });

    // Fetch all conditions for this ink
    const { data: conditions, error: fetchError } = await supabase
      .from('ink_conditions')
      .select('*')
      .eq('ink_id', inkId);

    if (fetchError) {
      console.error('Failed to fetch ink conditions:', fetchError);
      throw fetchError;
    }

    if (!conditions || conditions.length === 0) {
      console.log('No conditions found for ink:', inkId);
      return [];
    }

    // Bulk recalculate color_hex values
    const updatedConditions = await bulkRecalculateInkConditionColorHex(
      supabase,
      conditions,
      activeDataMode,
      orgDefaults,
      astmTables
    );

    console.log('✅ Successfully recalculated color_hex for conditions:', {
      inkId,
      conditionsUpdated: updatedConditions.length,
      activeDataMode
    });

    return updatedConditions;
  } catch (error) {
    console.error('Failed to recalculate ink condition colors:', error);
    throw error;
  }
};

/**
 * Recalculate color_hex for a single ink condition and store it in the database
 */
export const recalculateSingleConditionColor = async (conditionId, activeDataMode, orgDefaults, astmTables) => {
  try {
    // Fetch the condition
    const { data: condition, error: fetchError } = await supabase
      .from('ink_conditions')
      .select('*')
      .eq('id', conditionId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch ink condition:', fetchError);
      throw fetchError;
    }

    // Calculate new color_hex using the proper pipeline
    const newColorHex = calculateInkConditionColorHex(condition, activeDataMode, orgDefaults, astmTables);

    // Step 6: Save computed hex value as color_hex
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

    console.log('✅ Successfully recalculated and stored color_hex for condition:', {
      conditionId,
      newColorHex,
      activeDataMode
    });

    return newColorHex;
  } catch (error) {
    console.error('Failed to recalculate single condition color:', error);
    throw error;
  }
};

/**
 * Batch recalculate color_hex for multiple inks when org defaults change
 */
export const recalculateOrganizationInkColors = async (organizationId, orgDefaults, astmTables) => {
  try {
    console.log('🔄 Recalculating all ink condition colors for organization:', {
      organizationId,
      hasOrgDefaults: !!orgDefaults,
      hasAstmTables: !!astmTables
    });

    // Fetch all ink conditions for the organization
    const { data: conditions, error: fetchError } = await supabase
      .from('ink_conditions')
      .select(`
        *,
        inks!inner(organization_id)
      `)
      .eq('inks.organization_id', organizationId);

    if (fetchError) {
      console.error('Failed to fetch organization ink conditions:', fetchError);
      throw fetchError;
    }

    if (!conditions || conditions.length === 0) {
      console.log('No conditions found for organization:', organizationId);
      return [];
    }

    // Process in batches to avoid overwhelming the database
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < conditions.length; i += batchSize) {
      batches.push(conditions.slice(i, i + batchSize));
    }

    const allUpdatedConditions = [];
    for (const batch of batches) {
      const updatedBatch = await bulkRecalculateInkConditionColorHex(
        supabase,
        batch,
        null, // Use default data mode from condition settings
        orgDefaults,
        astmTables
      );
      allUpdatedConditions.push(...updatedBatch);
    }

    console.log('✅ Successfully recalculated color_hex for organization:', {
      organizationId,
      conditionsUpdated: allUpdatedConditions.length,
      batchesProcessed: batches.length
    });

    return allUpdatedConditions;
  } catch (error) {
    console.error('Failed to recalculate organization ink colors:', error);
    throw error;
  }
};