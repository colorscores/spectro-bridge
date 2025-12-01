import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { generateSubstrateConditionName } from '@/lib/substrateConditionNaming';
import { processSubstrateConditionFromImportedTints } from '@/lib/substrateConditionProcessing';

export const createSubstrateConditionFromTints = async (inkConditionId, substrateId, organizationId) => {
  try {
    const { data, error } = await supabase.rpc(
      'create_substrate_condition_from_imported_tints',
      {
        p_ink_condition_id: inkConditionId,
        p_substrate_id: substrateId,
        p_organization_id: organizationId
      }
    );

    if (error) {
      console.error('Error creating substrate condition:', error);
      toast({
        title: 'Error Creating Substrate Condition',
        description: error.message || 'Failed to create substrate condition',
        variant: 'destructive',
      });
      return null;
    }

    let createdCondition = null;
    if (data && typeof data === 'string') {
      const { data: row, error: rowError } = await supabase
        .from('substrate_conditions')
        .select('*')
        .eq('id', data)
        .single();
      createdCondition = rowError ? { id: data } : row;
    } else if (data && typeof data === 'object') {
      createdCondition = data;
    }

    try {
      const { data: substrate, error: subErr } = await supabase
        .from('substrates')
        .select('id, name, printing_side, use_white_ink')
        .eq('id', substrateId)
        .maybeSingle();

      if (!subErr && substrate && createdCondition?.id) {
        const autoName = generateSubstrateConditionName({
          substrateName: substrate.name,
          printSide: substrate.printing_side,
          useWhiteInk: !!substrate.use_white_ink,
          laminateEnabled: false,
          varnishEnabled: false,
          version: createdCondition?.version,
        });

        if (autoName) {
          await supabase
            .from('substrate_conditions')
            .update({ name: autoName })
            .eq('id', createdCondition.id);
          createdCondition = { ...createdCondition, name: autoName };
        }
      }
    } catch (e) {
      console.warn('Auto-naming substrate condition failed (non-fatal):', e);
    }

    try {
      await supabase.rpc('update_ink_condition_name_auto', { p_condition_id: inkConditionId });
    } catch (e) {
      console.warn('Failed to auto-update ink condition name (non-fatal):', e);
    }

    // Ensure spectral/Lab/CH are extracted from imported tints (0% substrate tint)
    try {
      if (createdCondition?.id) {
        console.log('🔄 Processing substrate condition spectral data from imported tints');
        await processSubstrateConditionFromImportedTints(createdCondition.id, inkConditionId);
        console.log('✅ Substrate condition spectral data processed');
      }
    } catch (e) {
      console.warn('Failed to process substrate condition spectral data (non-fatal):', e);
    }

    toast({
      title: 'Substrate Condition Created',
      description: createdCondition?.name ? `Substrate condition "${createdCondition.name}" created from imported tints` : 'Substrate condition created from imported tints',
    });

    return createdCondition;
  } catch (err) {
    console.error('Failed to create substrate condition:', err);
    toast({
      title: 'Error Creating Substrate Condition',
      description: err.message || 'An unexpected error occurred',
      variant: 'destructive',
    });
    return null;
  }
};
