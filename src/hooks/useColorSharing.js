import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

export const useColorSharing = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get colors shared with a specific partner
  const getColorsSharedWithPartner = useCallback(async (orgId, partnerId) => {
    if (!orgId || !partnerId) return [];

    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_colors_shared_with_partner', {
        p_org_id: orgId,
        p_partner_id: partnerId
      });

      if (rpcError) throw rpcError;

      return (data || []).map(row => row.color_id);
    } catch (err) {
      console.error('Failed to get colors shared with partner:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Validate if colors are shared with a partner (real-time database query)
  const validateColorsSharedWithPartner = useCallback(async (colorIds, partnerId, orgId) => {
    if (!colorIds?.length || !partnerId || !orgId) {
      return { all_shared: true, shared_count: 0, unshared_count: 0 };
    }

    console.log('🔍 validateColorsSharedWithPartner (REAL-TIME) called with:', { colorIds, partnerId, orgId });

    setLoading(true);
    setError(null);

    try {
      // Use the new real-time validation function that bypasses cache
      const { data, error: rpcError } = await supabase.rpc('validate_colors_shared_with_partner_realtime', {
        p_color_ids: colorIds,
        p_partner_id: partnerId,
        p_org_id: orgId
      });

      console.log('🔍 validate_colors_shared_with_partner_realtime response:', { data, error: rpcError });

      if (rpcError) throw rpcError;

      return data || { all_shared: false, shared_count: 0, unshared_count: colorIds.length };
    } catch (err) {
      console.error('Failed to validate colors shared with partner (real-time):', err);
      setError(err.message);
      
      // Fallback to regular validation if real-time fails
      console.log('🔄 Falling back to regular validation...');
      try {
        const { data: fallbackData, error: fallbackError } = await supabase.rpc('validate_colors_shared_with_partner', {
          p_color_ids: colorIds,
          p_partner_id: partnerId,
          p_org_id: orgId
        });
        
        if (fallbackError) throw fallbackError;
        return fallbackData || { all_shared: false, shared_count: 0, unshared_count: colorIds.length };
      } catch (fallbackErr) {
        console.error('Fallback validation also failed:', fallbackErr);
        return { all_shared: false, shared_count: 0, unshared_count: colorIds.length };
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getColorsSharedWithPartner,
    validateColorsSharedWithPartner,
  };
};