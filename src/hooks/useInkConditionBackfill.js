import { useState } from 'react';
import { backfillInkConditionMeasurements } from '@/lib/inkConditionBackfill';
import { toast } from 'react-hot-toast';

/**
 * Hook to manually trigger backfill for an ink condition
 */
export const useInkConditionBackfill = () => {
  // Add safety check for hook usage
  let isBackfilling, setIsBackfilling;
  try {
    [isBackfilling, setIsBackfilling] = useState(false);
  } catch (error) {
    console.error('useInkConditionBackfill: React hooks not available, using fallback', error);
    return {
      triggerBackfill: async () => false,
      isBackfilling: false
    };
  }

  const triggerBackfill = async (conditionId) => {
    if (!conditionId) {
      toast.error('No condition ID provided for backfill');
      return false;
    }

    setIsBackfilling(true);
    try {
      const success = await backfillInkConditionMeasurements(conditionId);
      if (success) {
        toast.success('Successfully backfilled measurements - mode switching should now work');
        // Trigger a page refresh to see the changes
        window.location.reload();
      } else {
        toast.error('Failed to backfill measurements');
      }
      return success;
    } catch (error) {
      console.error('Error in triggerBackfill:', error);
      toast.error(`Backfill error: ${error.message}`);
      return false;
    } finally {
      setIsBackfilling(false);
    }
  };

  return {
    triggerBackfill,
    isBackfilling
  };
};