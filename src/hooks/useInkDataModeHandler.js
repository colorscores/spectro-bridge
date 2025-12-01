import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { recalculateInkConditionColors } from '@/lib/colorUtils/inkConditionColorRecalculation';
import { useProfile } from '@/context/ProfileContext';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { toast } from 'react-hot-toast';

/**
 * Hook to handle data mode changes and trigger color hex recalculation
 */
export const useInkDataModeHandler = (activeDataMode) => {
  const { profile } = useProfile();
  const { astmTables } = useAstmTablesCache();

  const recalculateColorsForDataMode = useCallback(async (newDataMode) => {
    if (!profile?.organization_id || !astmTables) {
      console.log('🔄 Skipping color recalculation - missing org or ASTM tables');
      return;
    }

    try {
      console.log('🔄 Starting ink color recalculation for data mode change:', {
        newDataMode,
        organizationId: profile.organization_id
      });

      // Get organization defaults
      const { data: orgDefaults } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single();

      if (!orgDefaults) {
        console.warn('⚠️ No organization defaults found');
        return;
      }

      // Get all inks for the organization
      const { data: inks } = await supabase
        .from('inks')
        .select('id')
        .eq('organization_id', profile.organization_id);

      if (!inks || inks.length === 0) {
        console.log('ℹ️ No inks found for organization');
        return;
      }

      // Recalculate colors for each ink
      let totalUpdated = 0;
      for (const ink of inks) {
        const updatedConditions = await recalculateInkConditionColors(
          ink.id,
          newDataMode,
          orgDefaults,
          astmTables
        );
        totalUpdated += updatedConditions.length;
      }

      console.log('✅ Completed ink color recalculation:', {
        newDataMode,
        inksProcessed: inks.length,
        conditionsUpdated: totalUpdated
      });

      if (totalUpdated > 0) {
        toast.success(`Updated ${totalUpdated} ink condition colors for ${newDataMode} mode`);
      }
    } catch (error) {
      console.error('Failed to recalculate colors for data mode change:', error);
      toast.error('Failed to update ink colors');
    }
  }, [profile?.organization_id, astmTables]);

  return {
    recalculateColorsForDataMode
  };
};