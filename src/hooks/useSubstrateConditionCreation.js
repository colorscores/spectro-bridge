import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { generateSubstrateConditionName } from '@/lib/substrateConditionNaming';
import { removeZeroTints } from '@/lib/zeroTintUtils';
import { fixSubstrateCondition } from '@/lib/substrateConditionFixer';

export const useSubstrateConditionCreation = () => {
  // Add safety check for hook usage
  let isCreating, setIsCreating;
  try {
    [isCreating, setIsCreating] = useState(false);
  } catch (error) {
    console.error('useSubstrateConditionCreation: React hooks not available, using fallback', error);
    return {
      createSubstrateConditionFromImportedTints: async () => null,
      isCreating: false
    };
  }

  const createSubstrateConditionFromImportedTints = async (inkConditionId, substrateId, organizationId) => {
    setIsCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_substrate_condition_from_imported_tints', {
        p_ink_condition_id: inkConditionId,
        p_substrate_id: substrateId,
        p_organization_id: organizationId
      });

      if (error) {
        console.error('Error creating substrate condition:', error);
        const errorMessage = error.message || 'An unexpected error occurred while creating the substrate condition.';
        toast({
          title: "Error Creating Substrate Condition",
          description: errorMessage,
          variant: "destructive",
        });
        return null;
      }

      // The RPC may return either the new ID (string) or the full row (json)
      let createdCondition = null;
      if (data && typeof data === 'string') {
        const { data: row, error: rowError } = await supabase
          .from('substrate_conditions')
          .select('*')
          .eq('id', data)
          .single();
        if (rowError) {
          console.warn('Created substrate condition but failed to fetch full row:', rowError);
          createdCondition = { id: data };
        } else {
          createdCondition = row;
        }
      } else if (data && typeof data === 'object') {
        createdCondition = data;
      }

      // Process the substrate condition to calculate color values
      try {
        const { processSubstrateConditionFromImportedTints } = await import('@/lib/substrateConditionProcessing');
        await processSubstrateConditionFromImportedTints(createdCondition.id, inkConditionId);
        console.log('✅ Successfully processed substrate condition color data');
      } catch (processError) {
        console.warn('Failed to process substrate condition color data:', processError);
        // Continue - the condition was created, just without processed color
      }

      // Try to auto-name the substrate condition based on substrate details (best-effort)
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

      // Ensure ink condition name is updated to reflect the linked substrate condition
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

      // Note: Destructive 0% tint cleanup removed to prevent data loss

      // Process the substrate condition data if it was created successfully
      if (createdCondition?.id) {
        try {
          console.log('🔄 Processing substrate condition data from imported tints...');
          await fixSubstrateCondition(createdCondition.id);
          console.log('✅ Substrate condition data processing completed');
        } catch (error) {
          console.warn('⚠️ Failed to process substrate condition data (non-fatal):', error);
          // Don't fail the creation, just log the warning
        }
      }

      toast({
        title: "Substrate Condition Created",
        description: createdCondition?.name ? `Created: ${createdCondition.name}` : "Successfully created substrate condition from imported measurement data.",
      });

      return createdCondition;
    } catch (error) {
      console.error('Error creating substrate condition:', error);
      toast({
        title: "Error Creating Substrate Condition",
        description: "An unexpected error occurred while creating the substrate condition.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createSubstrateConditionFromImportedTints,
    isCreating
  };
};