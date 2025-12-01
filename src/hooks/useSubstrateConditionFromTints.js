import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { generateSubstrateConditionName } from '@/lib/substrateConditionNaming';
import { removeZeroTints } from '@/lib/zeroTintUtils';
import { processSubstrateConditionFromImportedTints } from '@/lib/substrateConditionProcessing';

export const useSubstrateConditionFromTints = () => {
  const [isCreating, setIsCreating] = useState(false);

  const createSubstrateConditionFromTints = async (inkConditionId, substrateId, organizationId) => {
    setIsCreating(true);
    try {
      console.log('Creating substrate condition from imported tints...', {
        inkConditionId,
        substrateId,
        organizationId
      });

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
          title: "Error Creating Substrate Condition",
          description: error.message || "Failed to create substrate condition",
          variant: "destructive",
        });
        return null;
      }

      // Resolve to full substrate condition row if only ID is returned
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

      // Try to auto-name the substrate condition
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
            version: createdCondition?.version
          });

          if (autoName) {
            await supabase
              .from('substrate_conditions')
              .update({ name: autoName })
              .eq('id', createdCondition.id);
            createdCondition = { ...createdCondition, name: autoName };
            console.log('✅ Substrate condition auto-named:', autoName);
          }
        }
      } catch (e) {
        console.warn('Auto-naming substrate condition failed (non-fatal):', e);
      }

      // Update ink condition name automatically now that substrate_condition is linked
      try {
        console.log('🔄 Calling update_ink_condition_name_auto after substrate creation');
        const { data: updatedName, error: nameUpdateError } = await supabase.rpc('update_ink_condition_name_auto', { p_condition_id: inkConditionId });
        if (nameUpdateError) {
          console.warn('Failed to auto-update ink condition name:', nameUpdateError);
        } else {
          console.log('✅ Ink condition name auto-updated to:', updatedName);
        }
      } catch (e) {
        console.warn('Failed to auto-update ink condition name (non-fatal):', e);
      }

      // Process the substrate condition to extract spectral data
      try {
        console.log('🔄 Processing substrate condition for spectral data extraction');
        await processSubstrateConditionFromImportedTints(createdCondition.id, inkConditionId);
        console.log('✅ Substrate condition spectral data processed successfully');
      } catch (e) {
        console.warn('Failed to process substrate condition spectral data (non-fatal):', e);
      }

      // Note: Destructive 0% tint cleanup removed to prevent data loss

console.log('Successfully created substrate condition:', createdCondition);
toast({
  title: "Substrate Condition Created",
  description: createdCondition?.name ? `Substrate condition "${createdCondition.name}" created from imported tints` : "Substrate condition created from imported tints",
});
      
      return createdCondition; // Returns the new substrate condition row or at least its ID
    } catch (error) {
      console.error('Failed to create substrate condition:', error);
      toast({
        title: "Error Creating Substrate Condition",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createSubstrateConditionFromTints,
    isCreating
  };
};