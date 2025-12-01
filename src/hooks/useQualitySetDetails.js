import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Hook to fetch quality set details given a quality set ID
 * This uses the same logic as useOptimizedMatchData to ensure consistency
 * 
 * @param {string} qualitySetId - The ID of the quality set to fetch
 * @returns {object} - Query result with data, loading, error states
 */
export function useQualitySetDetails(qualitySetId) {
  return useQuery({
    queryKey: ['quality-set-details', qualitySetId],
    queryFn: async () => {
      if (!qualitySetId) return null;
      
      console.log('[useQualitySetDetails] Fetching quality set:', qualitySetId);
      
      try {
        const { data: qsData, error: qsErr } = await supabase.rpc('get_quality_set_details', {
          qs_id: qualitySetId,
        });
        
        if (qsErr) {
          console.error('[useQualitySetDetails] Error fetching quality set:', qsErr);
          throw qsErr;
        }
        
        if (!qsData) {
          console.warn('[useQualitySetDetails] No quality set found for ID:', qualitySetId);
          return null;
        }
        
        console.log('[useQualitySetDetails] Successfully fetched quality set:', {
          id: qsData.id,
          name: qsData.name,
          rulesCount: (qsData.quality_rules || qsData.rules || []).length
        });
        
        return { ...qsData, source: 'authoritative' };
      } catch (error) {
        console.error('[useQualitySetDetails] Exception fetching quality set:', error);
        throw error;
      }
    },
    enabled: !!qualitySetId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}