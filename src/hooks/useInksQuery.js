import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/context/ProfileContext';
import { useInksData } from '@/context/InkContext';

/**
 * React Query hook for inks data with optimistic updates
 * Works alongside InkContext for comprehensive state management
 */
export const useInksQuery = () => {
  const { profile } = useProfile();
  const { allInks, inkBooks, loading: contextLoading, optimisticAddInk, optimisticUpdateInk, optimisticDeleteInk } = useInksData();
  const queryClient = useQueryClient();

  // Main inks query - mainly for React Query cache management
  const inksQuery = useQuery({
    queryKey: ['inks', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .rpc('get_inks_for_organization', { p_org_id: profile.organization_id });
      
      if (error) {
        console.error('get_inks_for_organization failed:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!profile?.organization_id,
    staleTime: 30000, // 30 seconds
    // Use data from context if available to avoid loading states
    initialData: () => allInks.length > 0 ? allInks : undefined,
  });

  // Create ink mutation with optimistic updates
  const createInkMutation = useMutation({
    mutationFn: async (inkData) => {
      const { data, error } = await supabase
        .from('inks')
        .insert([{
          ...inkData,
          organization_id: profile?.organization_id
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: async (newInk) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['inks', profile?.organization_id] });
      
      // Create optimistic ink
      const optimisticInk = {
        id: `temp-${Date.now()}`,
        ...newInk,
        organization_id: profile?.organization_id,
        conditions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Add to context optimistically
      optimisticAddInk(optimisticInk);
      
      return { optimisticInk };
    },
    onSuccess: (data) => {
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['inks'] });
      queryClient.invalidateQueries({ queryKey: ['ink-books'] });
    },
    onError: (error, variables, context) => {
      console.error('Failed to create ink:', error);
      // Context real-time updates will handle the revert
      queryClient.invalidateQueries({ queryKey: ['inks'] });
    },
  });

  // Update ink mutation with optimistic updates
  const updateInkMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('inks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['inks', profile?.organization_id] });
      
      // Update context optimistically
      const updatedInk = { id, ...updates, updated_at: new Date().toISOString() };
      optimisticUpdateInk(updatedInk);
      
      return { inkId: id, updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inks'] });
    },
    onError: (error, variables) => {
      console.error('Failed to update ink:', error);
      queryClient.invalidateQueries({ queryKey: ['inks'] });
    },
  });

  // Delete ink mutation with optimistic updates
  const deleteInkMutation = useMutation({
    mutationFn: async (inkId) => {
      const { error } = await supabase
        .from('inks')
        .delete()
        .eq('id', inkId);
      
      if (error) throw error;
      return inkId;
    },
    onMutate: async (inkId) => {
      await queryClient.cancelQueries({ queryKey: ['inks', profile?.organization_id] });
      
      // Remove from context optimistically
      optimisticDeleteInk(inkId);
      
      return { inkId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inks'] });
      queryClient.invalidateQueries({ queryKey: ['ink-books'] });
    },
    onError: (error, variables) => {
      console.error('Failed to delete ink:', error);
      queryClient.invalidateQueries({ queryKey: ['inks'] });
    },
  });

  return {
    // Data from context (preferred) with React Query as backup
    inks: allInks.length > 0 ? allInks : (inksQuery.data || []),
    inkBooks: inkBooks,
    isLoading: contextLoading || inksQuery.isLoading,
    error: inksQuery.error,
    
    // Mutations
    createInk: createInkMutation.mutateAsync,
    updateInk: updateInkMutation.mutateAsync,
    deleteInk: deleteInkMutation.mutateAsync,
    
    // Loading states
    isCreating: createInkMutation.isPending,
    isUpdating: updateInkMutation.isPending,
    isDeleting: deleteInkMutation.isPending,
    
    // Manual refetch
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['inks'] });
      queryClient.invalidateQueries({ queryKey: ['ink-books'] });
    },
  };
};

export default useInksQuery;