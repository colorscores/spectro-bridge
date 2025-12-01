import { useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Hook to handle pure match state updates without status dependencies
 */
export const useMatchStatusUpdater = () => {
  let updating = false;

  // New primary function for setting match states directly - wrapped in useCallback for stability
  const setMatchState = useCallback(async (measurementId, measurementState, onSuccess) => {
    if (!measurementId || measurementId === 'undefined') {
      console.error('[StateUpdater] Invalid measurementId:', measurementId);
      toast({
        title: 'Error',
        description: 'Invalid measurement ID provided',
        variant: 'destructive',
      });
      return { success: false, error: 'Invalid measurement ID' };
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(measurementId)) {
      console.error('[StateUpdater] Invalid UUID format for measurementId:', measurementId);
      toast({
        title: 'Error',
        description: 'Invalid measurement ID format. Please refresh and try again.',
        variant: 'destructive',
      });
      return { success: false, error: 'Invalid UUID format' };
    }

    if (!measurementState) {
      console.error('[StateUpdater] Missing measurementState:', measurementState);
      toast({
        title: 'Error',
        description: 'Measurement state is required',
        variant: 'destructive',
      });
      return { success: false, error: 'Measurement state is required' };
    }

    updating = true;

    try {
      console.log('📝 Setting match state via RPC:', { measurementId, measurementState });
      
      const { data, error } = await supabase.rpc('set_match_state', {
        p_measurement_id: measurementId,
        p_new_measurement_state: measurementState
      });

      if (error) {
        console.error('❌ RPC failed:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('❌ RPC returned error:', data?.error);
        throw new Error(data?.error || 'Failed to set match state');
      }

      console.log('✅ RPC state update successful:', data);

      // Get match request ID for callback
      const { data: measurement } = await supabase
        .from('match_measurements')
        .select('match_request_id, color_id')
        .eq('id', measurementId)
        .maybeSingle();

      // Success notification
      toast({
        title: 'Success',
        description: 'Match state updated successfully',
      });

      // Send approval email if state requires approval
      if (measurementState.includes('for-approval')) {
        try {
          console.log('📧 Sending approval email:', {
            measurementId,
            matchRequestId: measurement?.match_request_id,
            state: measurementState
          });
          
          const { error: emailError } = await supabase.functions.invoke(
            'send-match-approval-email',
            { 
              body: { 
                measurementId: measurementId,
                matchRequestId: measurement?.match_request_id 
              } 
            }
          );
          
          if (emailError) {
            console.warn('⚠️ Failed to send approval email:', emailError);
            // Don't fail the whole operation - email is supplementary
          } else {
            console.log('✅ Approval email sent successfully');
          }
        } catch (err) {
          console.warn('⚠️ Email service error:', err);
        }
      }

      // Enhanced callback for better invalidation and real-time sync
      onSuccess?.(measurement, measurementId, measurementState);
      
      // Broadcast using centralized manager
      try {
        const { realtimeManager } = await import('@/lib/realtimeManager');
        
        const payload = {
          match_request_id: measurement?.match_request_id,
          color_id: measurement?.color_id,
          measurement_id: measurementId,
          measurement_state: measurementState,
          timestamp: Date.now(),
        };
        
        console.log('📡 Broadcasting through realtime manager:', payload);
        
        const success = await realtimeManager.broadcast('match-state-updated', payload);
        
        if (success) {
          console.log('✅ Broadcast sent successfully');
        } else {
          console.warn('⚠️ Broadcast failed - will rely on database triggers');
        }

        // Send targeted notification refresh to intended recipient
        const { data: matchRequest } = await supabase
          .from('match_requests')
          .select('organization_id, shared_with_org_id, routed_to_org_id')
          .eq('id', measurement?.match_request_id)
          .maybeSingle();

        if (matchRequest) {
          const targetOrgId = 
            measurementState === 'sent-to-shared-with-for-approval' 
              ? matchRequest.shared_with_org_id 
              : measurementState === 'sent-to-requestor-for-approval'
              ? matchRequest.organization_id
              : null;

          if (targetOrgId) {
            console.log(`📡 Sending targeted refresh to org: ${targetOrgId}`);
            await realtimeManager.broadcast('force-notification-refresh', {
              organization_id: targetOrgId,
              matchRequestId: measurement?.match_request_id,
              timestamp: Date.now()
            });
          }
        }
      } catch (e) {
        console.warn('⚠️ Broadcast of match-state-updated failed:', e);
      }
      
      return { success: true, result: measurement };
    } catch (error) {
      console.error('❌ Failed to set match state:', {
        measurementId,
        measurementState,
        error: error.message,
        code: error.code,
        details: error.details
      });

      // Enhanced error handling with specific messages
      let errorMessage = 'Failed to update match state';
      
      if (error.message?.includes('Not authenticated')) {
        errorMessage = 'Please log in to update match state.';
      } else if (error.message?.includes('not authorized') || error.message?.includes('permission')) {
        errorMessage = 'You do not have permission to update this match state.';
      } else if (error.message?.includes('not found')) {
        errorMessage = 'Match measurement not found. Please refresh the page and try again.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      } else {
        errorMessage = `State update failed: ${error.message}`;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });

      return { success: false, error: error.message };
    } finally {
      updating = false;
    }
  }, []); // Empty deps - this function doesn't depend on external state

  // Legacy function for backward compatibility - delegates to setMatchState
  const updateMatchStatus = async (measurementId, newStatus, newMeasurementState = null, onSuccess) => {
    if (newMeasurementState) {
      return setMatchState(measurementId, newMeasurementState, onSuccess);
    }
    
    console.error('[StateUpdater] updateMatchStatus called without measurementState - this should not happen in the new system');
    return { success: false, error: 'Measurement state is required' };
  };

  // State-based action functions - use explicit measurement states
  const approveMatch = useCallback(async (measurementId, onSuccess) => {
    // Get context to determine who is approving
    const { data: measurement } = await supabase
      .from('match_measurements')
      .select(`
        match_request_id,
        match_requests(
          organization_id,
          shared_with_org_id,
          routed_to_org_id
        )
      `)
      .eq('id', measurementId)
      .maybeSingle();

    if (!measurement?.match_requests) {
      console.error('Could not determine match request details for approval');
      return { success: false, error: 'Could not determine match context' };
    }

    // Get current user's org to determine approval type
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user?.id)
      .maybeSingle();

    const userOrgId = profile?.organization_id;
    const mr = measurement.match_requests;

    if (!userOrgId) {
      console.error('Could not determine user organization for approval');
      return { success: false, error: 'Could not determine user organization' };
    }

    let approvalState;
    let receiverOrgId;
    
    if (userOrgId === mr.organization_id) {
      approvalState = 'approved-by-requestor';
      receiverOrgId = mr.shared_with_org_id;
    } else if (userOrgId === mr.shared_with_org_id) {
      approvalState = 'approved-by-shared-with';
      receiverOrgId = mr.routed_to_org_id || mr.organization_id;
    } else if (userOrgId === mr.routed_to_org_id) {
      approvalState = 'approved-by-routed-to';
      receiverOrgId = mr.shared_with_org_id;
    } else {
      console.error('User organization does not match any role in match request');
      return { success: false, error: 'User not authorized to approve this match' };
    }

    const result = await setMatchState(measurementId, approvalState, onSuccess);
    
    // Send targeted notification refresh to receiver
    if (result.success && receiverOrgId) {
      try {
        const { realtimeManager } = await import('@/lib/realtimeManager');
        console.log(`📡 Sending approval notification to receiver org: ${receiverOrgId}`);
        await realtimeManager.broadcast('force-notification-refresh', {
          organization_id: receiverOrgId,
          matchRequestId: measurement.match_request_id,
          action: 'approval',
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn('⚠️ Failed to broadcast approval notification:', e);
      }
    }
    
    return result;
  }, [setMatchState]);

  const rejectMatch = useCallback(async (measurementId, onSuccess) => {
    // Get context to determine who is rejecting
    const { data: measurement } = await supabase
      .from('match_measurements')
      .select(`
        match_request_id,
        match_requests(
          organization_id,
          shared_with_org_id,
          routed_to_org_id
        )
      `)
      .eq('id', measurementId)
      .maybeSingle();

    if (!measurement?.match_requests) {
      console.error('Could not determine match request details for rejection');
      return { success: false, error: 'Could not determine match context' };
    }

    // Get current user's org to determine rejection type
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user?.id)
      .maybeSingle();

    const userOrgId = profile?.organization_id;
    const mr = measurement.match_requests;

    if (!userOrgId) {
      console.error('Could not determine user organization for rejection');
      return { success: false, error: 'Could not determine user organization' };
    }

    let rejectionState;
    let receiverOrgId;
    
    if (userOrgId === mr.organization_id) {
      rejectionState = 'rejected-by-requestor';
      receiverOrgId = mr.routed_to_org_id || mr.shared_with_org_id;
    } else if (userOrgId === mr.shared_with_org_id) {
      rejectionState = 'rejected-by-shared-with';
      receiverOrgId = mr.routed_to_org_id || mr.organization_id;
    } else if (userOrgId === mr.routed_to_org_id) {
      rejectionState = 'rejected-by-routed-to';
      receiverOrgId = mr.shared_with_org_id || mr.organization_id;
    } else {
      console.error('User organization does not match any role in match request');
      return { success: false, error: 'User not authorized to reject this match' };
    }

    const result = await setMatchState(measurementId, rejectionState, onSuccess);
    
    // Send targeted notification refresh to receiver
    if (result.success && receiverOrgId) {
      try {
        const { realtimeManager } = await import('@/lib/realtimeManager');
        console.log(`📡 Sending rejection notification to receiver org: ${receiverOrgId}`);
        await realtimeManager.broadcast('force-notification-refresh', {
          organization_id: receiverOrgId,
          matchRequestId: measurement.match_request_id,
          action: 'rejection',
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn('⚠️ Failed to broadcast rejection notification:', e);
      }
    }
    
    return result;
  }, [setMatchState]);

  const sendForApproval = useCallback(async (measurementId, onSuccess) => {
    // Get context to determine where to send for approval
    const { data: measurement } = await supabase
      .from('match_measurements')
      .select(`
        match_requests(
          organization_id,
          shared_with_org_id,
          routed_to_org_id
        )
      `)
      .eq('id', measurementId)
      .maybeSingle();

    if (!measurement?.match_requests) {
      console.error('Could not determine match request details');
      return { success: false, error: 'Could not determine match context' };
    }

    // Get current user's org to determine where to send
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user?.id)
      .maybeSingle();

    const userOrgId = profile?.organization_id;
    const mr = measurement.match_requests;

    if (!userOrgId) {
      console.error('Could not determine user organization for send for approval');
      return { success: false, error: 'Could not determine user organization' };
    }

    let sendState;
    if (userOrgId === mr.routed_to_org_id) {
      // Routed-to org sending to shared-with for approval
      sendState = 'sent-to-shared-with-for-approval';
    } else if (userOrgId === mr.shared_with_org_id) {
      // Shared-with org sending to requestor for approval
      sendState = 'sent-to-requestor-for-approval';
    } else {
      console.error('User organization not authorized to send for approval');
      return { success: false, error: 'User not authorized to send for approval' };
    }

    return setMatchState(measurementId, sendState, onSuccess);
  }, [setMatchState]);

  const saveMatch = useCallback(async (measurementId, onSuccess) => {
    // Get context to determine who is saving
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user?.id)
      .maybeSingle();

    const { data: measurement } = await supabase
      .from('match_measurements')
      .select(`
        match_requests(
          organization_id,
          shared_with_org_id,
          routed_to_org_id
        )
      `)
      .eq('id', measurementId)
      .maybeSingle();

    const userOrgId = profile?.organization_id;
    const mr = measurement?.match_requests;

    if (!userOrgId) {
      console.error('Could not determine user organization for save');
      return { success: false, error: 'Could not determine user organization' };
    }

    let saveState;
    if (userOrgId === mr?.routed_to_org_id) {
      saveState = 'saved-by-routed-to';
    } else if (userOrgId === mr?.shared_with_org_id) {
      saveState = 'saved-by-shared-with';
    } else {
      console.error('User organization not authorized to save match');
      return { success: false, error: 'User not authorized to save this match' };
    }

    return setMatchState(measurementId, saveState, onSuccess);
  }, [setMatchState]);

  const sendToRequestor = useCallback(async (measurementId, onSuccess) => {
    // Send to requestor for approval
    return setMatchState(measurementId, 'sent-to-requestor-for-approval', onSuccess);
  }, [setMatchState]);

  const rematchBySharedWith = useCallback(async (measurementId, onSuccess) => {
    console.log('[StateUpdater] rematchBySharedWith called with:', measurementId);
    if (!measurementId || measurementId === 'undefined') {
      console.error('[StateUpdater] Invalid measurementId provided:', measurementId);
      toast({
        title: 'Error',
        description: 'Cannot start rematch: Invalid measurement ID',
        variant: 'destructive',
      });
      return { success: false, error: 'Invalid measurement ID' };
    }
    return setMatchState(measurementId, 'rematch-by-shared-with', onSuccess);
  }, [setMatchState]);

  const rematchByRoutedTo = useCallback(async (measurementId, onSuccess) => {
    console.log('[StateUpdater] rematchByRoutedTo called with:', measurementId);
    if (!measurementId || measurementId === 'undefined') {
      console.error('[StateUpdater] Invalid measurementId provided:', measurementId);
      toast({
        title: 'Error',
        description: 'Cannot start rematch: Invalid measurement ID',
        variant: 'destructive',
      });
      return { success: false, error: 'Invalid measurement ID' };
    }
    return setMatchState(measurementId, 'rematch-by-routed-to', onSuccess);
  }, [setMatchState]);

  return {
    updating,
    // Primary new function
    setMatchState,
    // Legacy function for backward compatibility
    updateMatchStatus,
    // State-based action functions
    approveMatch,
    rejectMatch,
    sendForApproval,
    saveMatch,
    sendToRequestor,
    rematchBySharedWith,
    rematchByRoutedTo,
  };
};
