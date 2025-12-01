import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';

export const usePartners = () => {
    const { profile } = useProfile();
    const queryClient = useQueryClient();
    
    const query = useQuery({
        queryKey: ['partners', profile?.organization_id],
        queryFn: async () => {
            if (!profile?.organization_id) return [];
            
            console.log('Fetching partners for org:', profile.organization_id);
            
            const { data, error } = await supabase.rpc('get_partners_for_org', {
                p_org_id: profile.organization_id,
            });

            console.log('Partners RPC response:', { data, error });

            if (error) throw error;
            return data || [];
        },
        enabled: !!profile?.organization_id,
        staleTime: 30000, // Cache for 30 seconds
    });

    // Realtime subscription for partner connection changes
    useEffect(() => {
        if (!profile?.organization_id) return;
        
        console.log('Setting up realtime subscription for partners:', profile.organization_id);
        
    const channel = supabase
        .channel('partner-connections-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'partners',
                filter: `organization_id=eq.${profile.organization_id}`
            },
            (payload) => {
                console.log('Partner connection changed (as owner):', payload);
                // Invalidate to refetch
                queryClient.invalidateQueries({ 
                    queryKey: ['partners', profile.organization_id] 
                });
            }
        )
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'partners',
                filter: `partner_organization_id=eq.${profile.organization_id}`
            },
            (payload) => {
                console.log('Partner connection changed (as partner):', payload);
                // Invalidate to refetch
                queryClient.invalidateQueries({ 
                    queryKey: ['partners', profile.organization_id] 
                });
            }
        )
        .subscribe();
        
        return () => {
            console.log('Cleaning up realtime subscription for partners');
            supabase.removeChannel(channel);
        };
    }, [profile?.organization_id, queryClient]);

    return {
        partners: query.data || [],
        partnersLoading: query.isLoading,
        partnersError: query.error?.message || null,
        refetchPartners: query.refetch,
    };
};