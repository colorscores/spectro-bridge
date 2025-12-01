import { useState } from 'react';
import { backfillSingleInkConditionColor } from '@/utils/inkConditionColorBackfill';
import { useProfile } from '@/context/ProfileContext';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { toast } from 'react-hot-toast';

/**
 * Hook to manually trigger color backfill for an ink condition
 */
export const useInkConditionColorBackfill = () => {
  const [isBackfilling, setIsBackfilling] = useState(false);
  const { profile } = useProfile();
  const { data: astmTables } = useAstmTablesCache();

  const triggerColorBackfill = async (conditionId) => {
    if (!conditionId) {
      toast.error('No condition ID provided for color backfill');
      return false;
    }

    if (!profile?.organization_id) {
      toast.error('User organization not found');
      return false;
    }

    setIsBackfilling(true);
    try {
      const orgDefaults = {
        default_illuminant: profile.organization_id ? 'D50' : 'D50',
        default_observer: profile.organization_id ? '2' : '2',
        default_astm_table: profile.organization_id ? '5' : '5'
      };

      const newColorHex = await backfillSingleInkConditionColor(conditionId, orgDefaults, astmTables);
      
      if (newColorHex) {
        toast.success('Successfully recalculated ink condition color');
        // Trigger a page refresh to see the changes
        window.location.reload();
        return true;
      } else {
        toast.error('Failed to calculate ink condition color');
        return false;
      }
    } catch (error) {
      console.error('Error in triggerColorBackfill:', error);
      toast.error(`Color backfill error: ${error.message}`);
      return false;
    } finally {
      setIsBackfilling(false);
    }
  };

  return {
    triggerColorBackfill,
    isBackfilling
  };
};