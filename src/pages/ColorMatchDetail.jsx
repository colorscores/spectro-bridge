import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle, Clock, FileQuestion, Save, Share2, Check, Eye, Download, XCircle, Send, StickyNote } from 'lucide-react';
import DraggableModal from '@/components/ui/draggable-modal';
import ShareMatchDialog from '@/components/ShareMatchDialog';
import RouteMatchesWizard from '@/components/matching/RouteMatchesWizard';
import { getColorMatchStatusForOrg, getJobStatusForOrg, getColorMatchButtonsForOrg, getMatchingHeaderButtonsForOrg } from '@/lib/matchStatusUtils.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import Breadcrumb from '@/components/Breadcrumb';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { computeDefaultDisplayColor, isValidDisplayColor } from '@/lib/colorUtils';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { resolveActiveDataMode } from '@/lib/colorUtils/resolveActiveDataMode';

import MultiFormatExportDialog from '@/components/export/MultiFormatExportDialog';
import QualitySetDisplay from '@/components/matching/QualitySetDisplay';
import { useScrollLockFix } from '@/hooks/useScrollLockFix';
import { useMatchStatusUpdater } from '@/hooks/useMatchStatusUpdater';
import { useQualitySetDetails } from '@/hooks/useQualitySetDetails';

const DetailItem = ({ label, value }) => (
  <div>
    <p className="text-sm font-medium text-gray-500">{label}</p>
    <p className="text-base text-gray-800">{value}</p>
  </div>
);


const ColorStandardCard = ({ color, matchId, onShare, onApprove, onSendForApproval, onRematchBySharedWith, onRematchByRoutedTo, onSetState, isRequestor, matchRequestId, matchRequest, pendingStatus, isUpdating, matchMeasurements }) => {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { astmTables } = useAstmTablesCache();
  
  // Get the authoritative quality set using the quality_set_id from match measurement
  const authoritativeQualitySetId = color.match_measurement?.quality_set_id || color.quality_set_id;
  const { data: authoritativeQualitySet, isLoading: qualitySetLoading } = useQualitySetDetails(authoritativeQualitySetId);

  // Get organization defaults for color computation
  const orgDefaults = profile?.organization || {};

  const handleReview = () => {
    // Use the same pattern as the rest of the file for consistent color ID access
    const colorId = color?.id ?? color?.color_id;

    if (!colorId) {
      console.error('[ColorStandardCard] No valid color ID found:', color);
      toast({
        title: 'Error',
        description: 'Unable to navigate - color ID not found',
        variant: 'destructive',
      });
      return;
    }

    // Navigate to matching page - measurement will be auto-created if it doesn't exist
    const targetPath = `/color-matches/${matchId}/matching/${colorId}`;
    
    console.log('[ColorStandardCard] handleReview called:', {
      colorId,
      matchId,
      targetPath,
      currentLocation: window.location.href,
      navigateFunction: typeof navigate
    });
    
    // Ensure we have a valid navigate function
    if (typeof navigate !== 'function') {
      console.error('[ColorStandardCard] Navigate function not available');
      return;
    }
    
    try {
      // Use relative navigation to stay within iframe context
      navigate(targetPath, { replace: false });
      console.log('[ColorStandardCard] Navigation initiated successfully to:', targetPath);
    } catch (error) {
      console.error('[ColorStandardCard] Navigation failed:', error);
    }
  };

  // Build merged measurement object that includes all relevant fields
  const colorKey = color?.id ?? color?.color_id;
  const mergedMeasurement = {
    ...color.match_measurement,
    // Include top-level match_measurement fields that might be missing from nested object
    match_measurement_state: color.match_measurement_state || color.match_measurement?.match_measurement_state,
    is_routed: color.is_routed || color.match_measurement?.is_routed,
    status: color.match_measurement?.status || color.status
  };

  // Use pure match_measurement_state - no status dependencies
  const measurementState = color.match_measurement_state || color.match_measurement?.match_measurement_state;
  
  // Debug logging to track state updates
  console.log(`[ColorStandardCard] Color ${colorKey}:`, {
    match_measurement_state: measurementState,
    mergedMeasurement
  });

  const statusInfo = getColorMatchStatusForOrg(measurementState, matchRequest, profile?.organization_id, mergedMeasurement);
  
  // Diagnostic logging for routed match status determination
  console.log('[ColorStandardCard] Status determination:', {
    colorName: color?.name,
    measurementState,
    matchRequestOrgId: matchRequest?.organization_id,
    sharedWithOrgId: matchRequest?.shared_with_org_id,
    routedToOrgId: matchRequest?.routed_to_org_id,
    userOrgId: profile?.organization_id,
    statusInfo,
    mergedMeasurement: {
      id: mergedMeasurement?.id,
      match_measurement_state: mergedMeasurement?.match_measurement_state,
      is_routed: mergedMeasurement?.is_routed
    }
  });

  const handleButtonClick = (button) => {
    console.log(`[ColorStandardCard] Button clicked: ${button.type} for color:`, color?.name);
    console.log('[ColorStandardCard] Current context:', {
      windowLocation: window.location.href,
      isInIframe: window.self !== window.top,
      navigateAvailable: typeof navigate === 'function'
    });
    
    if (button.type === 'review') {
      console.log('[ColorStandardCard] Executing review navigation...');
      handleReview();
      return;
    }
    
    if (button.type === 'share') {
      onShare(color);
      return;
    }
    
    if (button.type === 'start-matching' || button.type === 'start-re-matching' || button.type === 're-match' || button.type === 'start-re-match') {
      handleReview();
      return;
    }

    // Special handling for rematch buttons - they need to change state AND navigate
    if (button.type === 'rematch-by-routed-to' || button.type === 'rematch-by-shared-with') {
      if (onSetState) {
        const measurementId = color.match_measurement?.id;
        if (measurementId) {
          console.log('[ColorStandardCard] Executing rematch with state change:', {
            measurementId,
            buttonType: button.type,
            currentState: measurementState
          });
          
          // Change state first, then navigate
          onSetState(measurementId, button.type).then((result) => {
            console.log('[ColorStandardCard] State change result:', result);
            if (result?.success) {
              console.log('[ColorStandardCard] State change successful, navigating...');
              handleReview();
            } else {
              console.error('[ColorStandardCard] State change failed, navigation aborted');
            }
          }).catch((error) => {
            console.error('[ColorStandardCard] State change error:', error);
          });
        } else {
          console.error('[ColorStandardCard] No measurement ID available for rematch');
        }
      }
      return;
    }

    // For other state-changing buttons, use direct state transition
    if (onSetState) {
      const measurementId = color.match_measurement?.id;
      if (measurementId) {
        onSetState(measurementId, button.type);
      } else {
        console.error('[ColorStandardCard] No measurement ID available for state change');
      }
    }
  };

  // Compute matched color hex dynamically
  const matchedHex = useMemo(() => {
    // 🔍 DIAGNOSTIC: Log color object before processing
    console.log('🔍 [DEBUG] ColorStandardCard color object:', {
      colorKeys: Object.keys(color),
      hasId: !!color?.id,
      hasColorId: !!color?.color_id,
      id: color?.id,
      color_id: color?.color_id,
      name: color?.name,
      fullColor: color
    });
    
    // Use id or color_id (normalized response includes both)
    const colorId = color?.id ?? color?.color_id;
    
    console.log('[ColorStandardCard] Computing matchedHex:', {
      colorId: colorId,
      colorName: color?.name,
      hasMatchMeasurements: !!matchMeasurements,
      measurementsCount: matchMeasurements?.length,
      hasAstmTables: !!astmTables?.length,
    });

    // Don't compute during loading states
    if (!matchMeasurements || !Array.isArray(matchMeasurements)) {
      console.log('[ColorStandardCard] No measurements array, returning fallback');
      return '#E5E7EB';
    }

    const mm = matchMeasurements.find(m => m.color_id === colorId);
    if (!mm) {
      console.log('[ColorStandardCard] No measurement found for color:', colorId);
      return '#E5E7EB';
    }

    console.log('[ColorStandardCard] Found measurement:', {
      id: mm.id,
      hasMatchedColorData: !!mm.matched_color_data,
      hasSpectralData: !!mm.spectral_data,
      hasLabData: mm.lab_l != null,
      matched_hex: mm.matched_hex,
    });

    // Build color object for computation
    const matchColorObj = mm.matched_color_data || 
      (mm.spectral_data ? { spectral_data: mm.spectral_data } : null) ||
      (mm.lab_l != null ? { lab: { L: mm.lab_l, a: mm.lab_a, b: mm.lab_b } } : null);

    // Resolve the correct active data mode
    const activeDataMode = mm.matched_color_data 
      ? resolveActiveDataMode(mm.matched_color_data)
      : 'imported';

    // Compute dynamic hex if possible - NOW WITH CORRECT DATA MODE
    const result = matchColorObj && astmTables?.length
      ? computeDefaultDisplayColor(matchColorObj, orgDefaults, astmTables, activeDataMode)
      : null;
    const computedHex = result?.hex || null;

    console.log('[ColorStandardCard] Computed hex:', computedHex);

    // Get stored hex values
    const storedHex = mm.matched_color_data?.hex || 
      mm.matched_color_data?.displayHex || 
      mm.matched_color_data?.colorHex || 
      mm.matched_hex;

    console.log('[ColorStandardCard] Stored hex:', storedHex);

    // Return best available hex
    const finalHex = isValidDisplayColor(computedHex) ? computedHex : 
           (isValidDisplayColor(storedHex) ? storedHex : '#E5E7EB');
    
    console.log('[ColorStandardCard] Final matchedHex:', finalHex);
    return finalHex;
  }, [
    matchMeasurements, 
    color?.color_id, 
    astmTables?.length,
    orgDefaults?.default_illuminant, 
    orgDefaults?.default_observer, 
    orgDefaults?.default_astm_table
  ]);

  return (
    <motion.div
      layout
      className="w-full max-w-[480px] min-w-[320px]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden flex flex-col border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-300">
        <div className="h-16 flex" style={{ minHeight: '64px' }}>
          <div 
            className="w-1/2 h-full" 
            style={{ backgroundColor: color.hex || '#E5E7EB' }}
            data-color-type="reference"
            data-hex={color.hex || '#E5E7EB'}
            title={`Reference: ${color.hex || 'No color'}`}
          />
          <div 
            className="w-1/2 h-full" 
            style={{ backgroundColor: matchedHex }}
            data-color-type="matched"
            data-hex={matchedHex}
            title={`Matched: ${matchedHex}`}
          />
        </div>
        <CardHeader className="p-4">
          <CardTitle
            className="text-lg font-bold text-gray-800 min-h-[60px]"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {color.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex-grow">
            <QualitySetDisplay 
              qualitySetId={authoritativeQualitySetId} 
              qualitySet={authoritativeQualitySet || color.quality_set}
              matchMeasurement={mergedMeasurement}
              matchRequestId={matchRequestId} 
              colorId={color?.id ?? color?.color_id} 
            />
          </div>
        </CardContent>
        <CardFooter className="border-t border-gray-200 mt-auto px-4 py-3 min-h-[44px] flex justify-between items-center">
            <div className="flex items-center">
                <span className={`inline-flex items-center gap-2 leading-none text-sm font-medium ${statusInfo.color}`}>
                  {statusInfo.icon}
                  {statusInfo.text}
                </span>
              </div>
             <div className="flex items-center h-9 space-x-2">
                {getColorMatchButtonsForOrg(measurementState, matchRequest, profile?.organization_id, mergedMeasurement).map((button, index) => (
                   <Button
                     key={index}
                     variant={button.variant}
                     size="sm"
                     disabled={isUpdating}
                     onClick={() => handleButtonClick(button)}
                    >
                      {button.label}
                    </Button>
                  ))}
              </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

const JobDetailHeader = ({ matchRequest }) => {
  const { profile } = useProfile();
  const [resolvedLocationName, setResolvedLocationName] = useState(null);
  const [receiverOrgName, setReceiverOrgName] = useState(null);
  const [requestorOrgName, setRequestorOrgName] = useState(null);

  const matchesAvailable = matchRequest.colors?.filter(c => {
    const measurementState = c.match_measurement_state || c.match_measurement?.match_measurement_state;
    return measurementState?.includes('sent-') && measurementState?.includes('-for-approval') || 
           measurementState?.includes('approved-by-');
  }).length || 0;
  const totalMatches = matchRequest.colors?.length || 0;

  // Extract latest routing notes from routing_chain
  const getLatestRoutingNotes = () => {
    if (!matchRequest?.routing_chain || !Array.isArray(matchRequest.routing_chain) || matchRequest.routing_chain.length === 0) {
      return null;
    }
    
    // Get the most recent routing entry (last in array)
    const latestRouting = matchRequest.routing_chain[matchRequest.routing_chain.length - 1];
    return latestRouting?.notes || null;
  };

  const routingNotes = getLatestRoutingNotes();

  // Determine user's role in the match request
  const getUserRole = () => {
    if (!profile?.organization_id || !matchRequest) return 'unknown';
    
    if (matchRequest.organization_id === profile.organization_id) {
      return 'requestor';
    }
    
    if (matchRequest.shared_with_org_id === profile.organization_id) {
      return 'shared_with';
    }
    
    if (matchRequest.routed_to_org_id === profile.organization_id) {
      return 'routed_to';
    }
    
    return 'viewer';
  };
  
  const userRole = getUserRole();
  const isReceiver = userRole === 'shared_with' || userRole === 'routed_to';
  const isRouted = matchRequest?.is_routed || matchRequest?.routed_from_organization_id;

  // Debug logging for header display issue
  console.log('🔍 JobDetailHeader Debug:', {
    userRole,
    profileOrgId: profile?.organization_id,
    profileOrgName: profile?.organization?.name,
    matchRequestOrgId: matchRequest?.organization_id,
    matchRequestSharedWith: matchRequest?.shared_with,
    matchRequestSharedWithOrgId: matchRequest?.shared_with_org_id,
    matchRequestRoutedTo: matchRequest?.routed_to,
    matchRequestRoutedToOrgId: matchRequest?.routed_to_org_id,
    receiverOrgName,
    requestorOrgName,
    resolvedLocationName,
    matchRequest: matchRequest
  });

  // Use pre-resolved names from RPC with no additional API calls needed
  useEffect(() => {
    if (matchRequest) {
      // Use correct field names from RPC response
      setReceiverOrgName(matchRequest.shared_with || matchRequest.routed_to);
      setRequestorOrgName(matchRequest.requestor_organization_name);
    } else {
      setReceiverOrgName(null);
      setRequestorOrgName(null);
    }
  }, [matchRequest?.shared_with, matchRequest?.routed_to, matchRequest?.requestor_organization_name]);

  // Use correct field name from RPC response
  useEffect(() => {
    setResolvedLocationName(matchRequest?.location || null);
  }, [matchRequest?.location]);

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        <div className="col-span-1 md:col-span-2 space-y-4">
          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {userRole === 'requestor' ? 'Requested to' : 'Requested by'}
                </p>
                <p className="text-base text-gray-800">
                  {userRole === 'shared_with' ? (requestorOrgName || 'N/A') : (receiverOrgName || 'N/A')}
                </p>
              </div>
              {userRole !== 'shared_with' && (
                <DetailItem label="Location" value={resolvedLocationName || 'N/A'} />
              )}
              <DetailItem label="Print Condition" value={matchRequest.print_condition_name || matchRequest.print_condition || 'N/A'} />
            </div>
            <div className="space-y-4">
              <DetailItem label="Due date" value={matchRequest.due_date} />
              <DetailItem label="Project ID" value={matchRequest.project_id || ''} />
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                {(() => {
                  const jobStatus = getJobStatusForOrg(matchRequest, profile?.organization_id);
                  const isOverdue = jobStatus === 'Overdue';
                  return (
                    <Badge 
                      variant="outline" 
                      className={isOverdue ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-blue-100 text-blue-800 border-blue-200"}
                    >
                      <span className={`h-2 w-2 rounded-full mr-2 ${isOverdue ? "bg-destructive" : "bg-blue-500"}`}></span>
                      {jobStatus}
                    </Badge>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-1">
          <Card className="shadow-md">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 mr-4">
                  <Eye className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Matches Available</p>
                  <p className="text-2xl font-bold text-gray-800">{`${matchesAvailable}/${totalMatches}`}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const ColorMatchDetail = () => {
  // ALL hooks must be called unconditionally at the top
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  
  const [isSharing, setIsSharing] = useState(false);
  const [colorToShare, setColorToShare] = useState(null);
  const [isRoutingWizardOpen, setIsRoutingWizardOpen] = useState(false);
  const [pendingStatuses, setPendingStatuses] = useState({});
  const [isCxfExportOpen, setIsCxfExportOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);

  // Use the correct state-based functions from the hook  
  const { updating, setMatchState, approveMatch, sendForApproval, rematchBySharedWith, rematchByRoutedTo } = useMatchStatusUpdater();

  // Monitor dialog states for scroll lock management
  const dialogStates = {
    shareDialog: isSharing,
    routingWizard: isRoutingWizardOpen,
    cxfExport: isCxfExportOpen,
    notesModal: isNotesModalOpen,
  };
  
  const { forceUnlockScroll } = useScrollLockFix(dialogStates);

  // Performance monitoring
  useEffect(() => {
    console.time('⏱️ ColorMatchDetail render');
    return () => console.timeEnd('⏱️ ColorMatchDetail render');
  }, []);

  useEffect(() => {
    console.log('🔍 ColorMatchDetail mount/update:', {
      matchId,
      timestamp: Date.now()
    });
  }, [matchId]);

  // Debug logging for route parameters
  console.log('🎯 ColorMatchDetail loaded with matchId:', matchId);

  // Handler for direct state updates
  const handleSetState = async (measurementId, targetState) => {
    try {
      console.log('[ColorMatchDetail] Setting state:', { measurementId, targetState });
      const result = await setMatchState(measurementId, targetState, () => {
        // Success callback - invalidate queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
        queryClient.invalidateQueries({ queryKey: ['match-requests'] });
      });
      console.log('[ColorMatchDetail] State change completed with result:', result);
      return result;
    } catch (error) {
      console.error('[ColorMatchDetail] Failed to set state:', error);
      return { success: false, error: error.message };
    }
  };

  // Handler for header button clicks
  const handleHeaderButtonClick = async (button, color) => {
    console.log('[ColorMatchDetail] Header button clicked:', button.type, 'for color:', color?.name);
    
    if (!color?.match_measurement?.id) {
      console.error('[ColorMatchDetail] No measurement ID available for header button action');
      toast({
        title: 'Error',
        description: 'No measurement data available',
        variant: 'destructive',
      });
      return;
    }

    const measurementId = color.match_measurement.id;

    // Handle "Save" button - changes state to saved-by-routed-to
    if (button.type === 'save') {
      await handleSetState(measurementId, 'saved-by-routed-to');
      return;
    }

    // Handle "Send for Approval" button - saves data, shows confirmation, then changes state
    if (button.type === 'sent-to-shared-with-for-approval') {
      try {
        // First save the data
        await handleSetState(measurementId, 'saved-by-routed-to');
        
        // Then show confirmation dialog
        setColorToShare(color);
        setIsSharing(true);
      } catch (error) {
        console.error('[ColorMatchDetail] Failed to save before approval:', error);
        toast({
          title: 'Error',
          description: 'Failed to save match before sending for approval',
          variant: 'destructive',
        });
      }
      return;
    }

    // Default state change for other buttons
    await handleSetState(measurementId, button.type);
  };


  // Additional cleanup when dialogs close
  useEffect(() => {
    if (!isSharing && !isRoutingWizardOpen && !isCxfExportOpen && !isNotesModalOpen) {
      // Ensure scroll is unlocked when all dialogs are closed
      const timer = setTimeout(forceUnlockScroll, 150);
      return () => clearTimeout(timer);
    }
  }, [isSharing, isRoutingWizardOpen, isCxfExportOpen, isNotesModalOpen, forceUnlockScroll]);

  // Real-time subscription for match measurements updates
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel('match-measurements-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_measurements',
          filter: `match_request_id=eq.${matchId}`,
        },
        (payload) => {
          console.info('[ColorMatchDetail] Real-time update:', payload);
          console.info('[ColorMatchDetail] Current match request colors before update:', matchRequest?.colors);
          
          // Clear pending statuses for the affected color
          if (payload.new?.color_id) {
            setPendingStatuses(prev => {
              const newState = { ...prev };
              delete newState[payload.new.color_id];
              return newState;
            });
          }
          
          // Invalidate and refetch match request details - this is the key query that feeds the cards
          queryClient.invalidateQueries({ 
            queryKey: ['match-request-details', matchId],
            // Force refetch immediately
            exact: true 
          });
          
          // Also invalidate broader match requests query
          queryClient.invalidateQueries({ queryKey: ['match-requests'] });
          
          // Invalidate quality set queries for affected colors
          if (payload.new?.color_id) {
            queryClient.invalidateQueries({ 
              queryKey: ['shared-quality-set-details', payload.new.quality_set_id, matchId] 
            });
            queryClient.invalidateQueries({ 
              queryKey: ['match-measurement', matchId, payload.new.color_id, payload.new.quality_set_id] 
            });
          }

          // Force a refetch of the match request details to ensure cards update
          setTimeout(() => {
            queryClient.refetchQueries({ 
              queryKey: ['match-request-details', matchId],
              exact: true 
            });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, queryClient]);

  const fetchMatchRequestDetails = async () => {
    console.log('🔍 Fetching match request details for matchId:', matchId);
    
    // Use the correct RPC that returns detailed match_measurement data
    const { data: requestDetails, error: rpcError } = await supabase.rpc(
      'get_match_request_details',
      { p_match_request_id: matchId }
    );
    
    if (rpcError) {
      console.error('❌ Failed to fetch match request details:', rpcError);
      throw new Error(rpcError.message);
    }

    // The RPC now returns a single JSON object with a colors array
    const data = requestDetails;

    if (!data || !data.id) {
      console.error('❌ No match request found for matchId:', matchId);
      throw new Error('Match request not found');
    }

    console.log('📋 Match request data from RPC:', {
      id: data.id,
      totalColors: (data.colors || []).length,
      isRouted: data.is_routed
    });

    // Colors are already filtered by the RPC based on user's role
    const colorsFromRPC = (data.colors || []).map(color => ({
      id: color.id,
      color_id: color.id,
      name: color.name,
      hex: color.hex,
      lab_l: color.lab_l,
      lab_a: color.lab_a,
      lab_b: color.lab_b,
      is_download_restricted: color.is_download_restricted,
      match_measurement: color.match_measurement
    }));

    console.log('📋 Colors from RPC:', {
      totalColors: colorsFromRPC.length,
      routedColors: colorsFromRPC.filter(c => c.match_measurement?.is_routed).length
    });

    const normalizedMatchRequest = {
      id: data.id,
      job_id: data.job_id,
      organization_id: data.organization_id,
      requestor_organization_name: data.requestor_organization_name,
      originating_organization_id: data.organization_id,
      initial_receiver_organization_name: data.organization_name,
      current_recipient_organization_id: data.shared_with_org_id || data.routed_to_org_id,
      shared_with: data.shared_with_org_name,
      shared_with_org_id: data.shared_with_org_id,
      shared_with_location_name: data.shared_with_location_name,
      routed_to: data.routed_to_org_name,
      routed_to_org_id: data.routed_to_org_id,
      routed_to_location_name: data.routed_to_location_name,
      print_condition: data.print_condition,
      print_process: data.print_process,
      status: data.status,
      location: data.location,
      due_date: data.due_date,
      date_shared: data.date_shared,
      routing_chain: data.routing_chain,
      is_routed: data.is_routed,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    // Enrich nested match_measurement objects to ensure state/quality/Lab data are present
    const enrichedColors = await Promise.all((colorsFromRPC || []).map(async (c) => {
      const colorId = c?.id ?? c?.color_id ?? c?.match_measurement?.color_id ?? null;
      let mm = c.match_measurement || null;

      const missingLab = (mm?.lab_l == null || mm?.lab_a == null || mm?.lab_b == null)
        && !mm?.spectral_data 
        && !(mm?.matched_color_data && (mm.matched_color_data.spectralData || mm.matched_color_data.lab));
      const needsEnrichment = !!mm && (
        !mm.match_measurement_state ||
        !mm.quality_set_id ||
        missingLab
      );

      try {
        if (needsEnrichment && mm?.id) {
          const { data: fullMm } = await supabase
            .from('match_measurements')
            .select('id,status,match_measurement_state,matched_hex,lab_l,lab_a,lab_b,reference_lab_l,reference_lab_a,reference_lab_b,matched_color_data,quality_set_id,ink_condition_id,match_location,match_print_process,matched_by_name,created_at,is_routed,spectral_data,color_id')
            .eq('id', mm.id)
            .maybeSingle();
          if (fullMm) mm = { ...mm, ...fullMm };
        } else if (!mm && colorId) {
          const { data: mmRow } = await supabase
            .from('match_measurements')
            .select('id,status,match_measurement_state,matched_hex,lab_l,lab_a,lab_b,reference_lab_l,reference_lab_a,reference_lab_b,matched_color_data,quality_set_id,ink_condition_id,match_location,match_print_process,matched_by_name,created_at,is_routed,spectral_data,color_id')
            .eq('match_request_id', matchId)
            .eq('color_id', colorId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (mmRow) mm = mmRow;
        }
      } catch (e) {
        console.warn('⚠️ Enrichment failed for color', colorId, e);
      }

      const match_measurement_state = mm?.match_measurement_state ?? c.match_measurement_state ?? null;

      return {
        ...c,
        id: c?.id ?? c?.color_id ?? mm?.color_id ?? colorId,
        color_id: c?.color_id ?? c?.id ?? mm?.color_id ?? colorId,
        match_measurement: mm || c.match_measurement || null,
        match_measurement_state,
      };
    }));

    normalizedMatchRequest.colors = enrichedColors;

    console.log('✅ Successfully loaded and normalized match request:', {
      matchId,
      totalColors: normalizedMatchRequest.colors.length,
      sampleColor: normalizedMatchRequest.colors[0],
      hasNestedMeasurement: !!normalizedMatchRequest.colors[0]?.match_measurement,
      measurementId: normalizedMatchRequest.colors[0]?.match_measurement?.id
    });

    return normalizedMatchRequest;
  };

  const { data: matchRequest, isLoading, error } = useQuery({
    queryKey: ['match-request-details', matchId],
    queryFn: fetchMatchRequestDetails,
    staleTime: 0, // Force immediate refetch
    cacheTime: 0, // Don't cache
  });

  // Extract match measurements for easier access
  const matchMeasurements = useMemo(() => {
    if (!matchRequest?.colors) return [];
    
    console.log('🔍 [DEBUG] Building matchMeasurements from nested structure:', {
      totalColors: matchRequest.colors.length,
      sampleColor: matchRequest.colors[0],
      hasMatchMeasurement: !!matchRequest.colors[0]?.match_measurement,
      matchMeasurementId: matchRequest.colors[0]?.match_measurement?.id
    });
    
    // Extract from NESTED match_measurement structure
    const measurements = matchRequest.colors
      .filter(color => color.match_measurement?.id) // Use nested object
      .map(color => {
        const mm = color.match_measurement || {};
        const lab = mm.lab || {};
        return {
          id: mm.id,
          color_id: mm.color_id ?? color.color_id ?? color.id,
          matched_color_data: mm.matched_color_data,
          spectral_data: mm.spectral_data,
          lab_l: mm.lab_l ?? lab.L ?? null,
          lab_a: mm.lab_a ?? lab.a ?? null,
          lab_b: mm.lab_b ?? lab.b ?? null,
          matched_hex: mm.matched_hex,
          status: mm.status,
          is_routed: mm.is_routed,
          match_measurement_state: mm.match_measurement_state ?? color.match_measurement_state,
          match_location: mm.match_location,
          match_print_process: mm.match_print_process,
          match_substrate: mm.match_substrate,
          observer: mm.observer,
          illuminant: mm.illuminant,
          measurement_mode: mm.measurement_mode ?? mm.mode,
        };
      });
      
    console.log('🔍 [DEBUG] Built matchMeasurements:', {
      count: measurements.length,
      sampleMeasurement: measurements[0]
    });
    
    return measurements;
  }, [matchRequest?.colors]);

  // Defensive deduplication of colors to prevent duplicate cards
  const uniqueColors = useMemo(() => {
    if (!matchRequest?.colors) return [];
    
    const colorMap = new Map();
    matchRequest.colors.forEach(color => {
      const colorId = color?.id ?? color?.color_id;
      if (colorId && !colorMap.has(colorId)) {
        colorMap.set(colorId, color);
      }
    });
    
    const deduplicatedColors = Array.from(colorMap.values());
    console.log(`[ColorMatchDetail] Deduplicated colors: ${matchRequest.colors.length} → ${deduplicatedColors.length}`);
    console.log('[ColorMatchDetail] 🔍 DEBUG - Sample color:', deduplicatedColors[0]);
    console.log('[ColorMatchDetail] 🔍 DEBUG - is_download_restricted values:', 
      deduplicatedColors.map(c => ({ 
        id: c.id, 
        name: c.name,
        is_download_restricted: c.is_download_restricted,
        type: typeof c.is_download_restricted 
      }))
    );
    return deduplicatedColors;
  }, [matchRequest?.colors]);

  // Helper function to get measurement ID from color object
  const getMeasurementId = (color) => {
    return color.match_measurement?.id || color.measurement_id;
  };

  // Helper function to ensure measurement exists for operations
  const ensureMeasurementExists = async (color) => {
    let measurementId = getMeasurementId(color);
    
    if (!measurementId) {
      // Try to look up measurement by match_request_id and color_id
      const colorId = color?.id ?? color?.color_id;
      if (!colorId) {
        throw new Error('Color ID not found');
      }
      
      const { data: measurements, error } = await supabase
        .from('match_measurements')
        .select('id')
        .eq('match_request_id', matchId)
        .eq('color_id', colorId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('[ColorMatchDetail] Measurement lookup failed:', error);
        throw new Error('Failed to locate measurement ID');
      }
      
      measurementId = measurements?.[0]?.id;
      if (!measurementId) {
        throw new Error('No measurement found for this color match');
      }
    }
    
    return measurementId;
  };

  const handleShare = (color) => {
    setColorToShare(color);
    setIsSharing(true);
  };

  const handleConfirmShare = async () => {
    if (!colorToShare) return;
    
    try {
      const measurementId = await ensureMeasurementExists(colorToShare);
      
      // Use sendForApproval which determines the correct state based on who is sending
      // - routed-to → shared-with: uses 'sent-to-shared-with-for-approval'
      // - shared-with → requestor: uses 'sent-to-requestor-for-approval'
      await sendForApproval(measurementId, (data, measId, state) => {
        queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
        queryClient.invalidateQueries({ queryKey: ['match-requests'] });
        // Invalidate quality set queries
        if (colorToShare?.match_measurement?.quality_set_id) {
          queryClient.invalidateQueries({ 
            queryKey: ['shared-quality-set-details', colorToShare.match_measurement.quality_set_id, matchId] 
          });
        }
      });

      setIsSharing(false);
      setColorToShare(null);
    } catch (error) {
      console.error('[ColorMatchDetail] Share failed:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to share match',
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async (color) => {
    try {
      const measurementId = await ensureMeasurementExists(color);
      
      await approveMatch(measurementId, (data, measId, state) => {
        queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
        queryClient.invalidateQueries({ queryKey: ['match-requests'] });
        // Invalidate quality set queries
        if (color?.match_measurement?.quality_set_id) {
          queryClient.invalidateQueries({ 
            queryKey: ['shared-quality-set-details', color.match_measurement.quality_set_id, matchId] 
          });
        }
      });
    } catch (error) {
      console.error('[ColorMatchDetail] Approve failed:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve match',
        variant: 'destructive',
      });
    }
  };

  const handleSendForApproval = async (color) => {
    console.log(`[ColorMatchDetail] handleSendForApproval called for color:`, color?.name);
    try {
      const measurementId = await ensureMeasurementExists(color);
      
      await sendForApproval(measurementId, (data, measId, state) => {
        queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
        queryClient.invalidateQueries({ queryKey: ['match-requests'] });
        // Invalidate quality set queries
        if (color?.match_measurement?.quality_set_id) {
          queryClient.invalidateQueries({ 
            queryKey: ['shared-quality-set-details', color.match_measurement.quality_set_id, matchId] 
          });
        }
      });
    } catch (error) {
      console.error('[ColorMatchDetail] Send for approval failed:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send for approval',
        variant: 'destructive',
      });
    }
  };

  const handleRematchBySharedWith = async (color) => {
    try {
      const measurementId = await ensureMeasurementExists(color);
      
      await rematchBySharedWith(measurementId, (data, measId, state) => {
        const colorKey = color?.id ?? color?.color_id;
        // Optimistically update cache to reflect rematch state
        queryClient.setQueryData(['match-request-details', matchId], (prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            colors: (prev.colors || []).map((c) => {
              const cid = c?.id ?? c?.color_id;
              if (cid === colorKey) {
                const nextState = 'rematch-by-shared-with';
                return {
                  ...c,
                  match_measurement_state: nextState,
                  match_measurement: {
                    ...(c.match_measurement || {}),
                    match_measurement_state: nextState,
                  },
                };
              }
              return c;
            }),
          };
          console.info('[ColorMatchDetail] Cache updated for rematch-by-shared-with', { colorId: colorKey });
          return updated;
        });

        // Still invalidate to get server truth
        queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
        queryClient.invalidateQueries({ queryKey: ['match-requests'] });
        // Invalidate quality set queries
        if (color?.match_measurement?.quality_set_id) {
          queryClient.invalidateQueries({ 
            queryKey: ['shared-quality-set-details', color.match_measurement.quality_set_id, matchId] 
          });
        }
      });
    } catch (error) {
      console.error('[ColorMatchDetail] Rematch by shared-with failed:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to request rematch',
        variant: 'destructive',
      });
    }
  };

  const handleRematchByRoutedTo = async (color) => {
    try {
      const measurementId = await ensureMeasurementExists(color);
      
      await rematchByRoutedTo(measurementId, (data, measId, state) => {
        const colorKey = color?.id ?? color?.color_id;
        // Optimistically update cache to reflect rematch state
        queryClient.setQueryData(['match-request-details', matchId], (prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            colors: (prev.colors || []).map((c) => {
              const cid = c?.id ?? c?.color_id;
              if (cid === colorKey) {
                const nextState = 'rematch-by-routed-to';
                return {
                  ...c,
                  match_measurement_state: nextState,
                  match_measurement: {
                    ...(c.match_measurement || {}),
                    match_measurement_state: nextState,
                  },
                };
              }
              return c;
            }),
          };
          console.info('[ColorMatchDetail] Cache updated for rematch-by-routed-to', { colorId: colorKey });
          return updated;
        });

        // Still invalidate to get server truth
        queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
        queryClient.invalidateQueries({ queryKey: ['match-requests'] });
        // Invalidate quality set queries
        if (color?.match_measurement?.quality_set_id) {
          queryClient.invalidateQueries({ 
            queryKey: ['shared-quality-set-details', color.match_measurement.quality_set_id, matchId] 
          });
        }
      });
    } catch (error) {
      console.error('[ColorMatchDetail] Rematch by routed-to failed:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to request rematch',
        variant: 'destructive',
      });
    }
  };

  const buildReferenceCsv = () => {
    const headers = ['Job ID','Color ID','Color Name','Color Hex','L','a','b','Status'];
    const rows = (matchRequest?.colors || []).map(c => [
      matchRequest?.job_id || '',
      (c?.id ?? c?.color_id) || '',
      c.name || '',
      c.hex || '',
      c.lab?.L ?? '',
      c.lab?.a ?? '',
      c.lab?.b ?? '',
      c.match_measurement_state || c.match_measurement?.match_measurement_state || 'empty'
    ]);
    const escape = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
    };
    return [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  };

  const handleDownloadReferences = () => {
    try {
      const csv = buildReferenceCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job-${matchRequest?.job_id}-references.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Downloaded', description: 'Color reference data CSV exported.' });
    } catch (e) {
      toast({ title: 'Download failed', description: e.message || 'Could not export data', variant: 'destructive' });
    }
  };

  // Defensive check: Show loading UI if profile is not ready (AFTER all hooks are called)
  if (!profile || !profile.organization_id) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 h-full flex flex-col">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-40 w-full mb-8" />
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-80 w-full" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="flex items-center justify-center h-full text-red-500">Error: {error.message}</div>;
  }

  const isRequestor = profile?.organization_id === matchRequest?.organization_id;

  // Latest routing notes for popover
  const routingNotes = (Array.isArray(matchRequest?.routing_chain) && matchRequest.routing_chain.length > 0)
    ? (matchRequest.routing_chain[matchRequest.routing_chain.length - 1]?.notes || null)
    : null;

  return (
    <>
      <Helmet><title>{matchRequest?.job_id ? `Color Match Job: ${matchRequest.job_id} - Spectral` : 'Color Match Job - Spectral'}</title></Helmet>
      
      <div className="p-6 h-full flex flex-col">
        <div className="mb-6">
          <Breadcrumb
            items={[
              { label: 'Matching Jobs', href: '/color-matches' },
              { label: `Job: ${matchRequest?.job_id || 'Unknown'}` }
            ]}
          />
        </div>

        <JobDetailHeader matchRequest={matchRequest} />

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Colors ({matchRequest?.colors?.length || 0})
          </h2>

          <div className="flex gap-2">
            {/* Header buttons for rematch states */}
            {(() => {
              // Get measurement state from first color with a measurement
              const firstColorWithMeasurement = matchRequest?.colors?.find(c => c.match_measurement);
              const measurementState = firstColorWithMeasurement?.match_measurement?.match_measurement_state;
              
              if (measurementState && (measurementState === 'rematch-by-shared-with' || measurementState === 'rematch-by-routed-to')) {
                const headerButtons = getMatchingHeaderButtonsForOrg(measurementState, matchRequest, profile?.organization_id, firstColorWithMeasurement?.match_measurement);
                
                return headerButtons.map((button, index) => {
                  // Differentiated disabled logic based on button type
                  let isDisabled;
                  if (button.type === 'saved-by-routed-to') {
                    // Save button: disabled when updating, no sample loaded, or no changes to save
                    // For now, we'll just require sample loaded (can enhance with change detection later)
                    isDisabled = updating || !firstColorWithMeasurement?.match_measurement?.id;
                  } else if (button.type === 'sent-to-shared-with-for-approval') {
                    // Send for Approval button: only disabled when updating or no sample loaded
                    isDisabled = updating || !firstColorWithMeasurement?.match_measurement?.id;
                  } else {
                    // Default logic for other buttons
                    isDisabled = updating || !firstColorWithMeasurement?.match_measurement?.id;
                  }

                  return (
                    <Button
                      key={index}
                      variant={button.variant}
                      size="sm"
                      disabled={isDisabled}
                      onClick={() => handleHeaderButtonClick(button, firstColorWithMeasurement)}
                    >
                      {button.label}
                    </Button>
                  );
                });
              }
              return null;
            })()}
            {/* Only show Route Matches for shared_with users, not routed_to users */}
            {profile?.organization_id === matchRequest?.shared_with_org_id && !matchRequest?.is_routed && (
              <Button onClick={() => setIsRoutingWizardOpen(true)} variant="outline" size="sm">
                Route Matches
              </Button>
            )}
            {routingNotes && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsNotesModalOpen(true)}
              >
                <StickyNote className="w-4 h-4 mr-2" />
                Notes
              </Button>
            )}
            {/* Only show Download References if no colors are download-restricted */}
            {(() => {
              const hasRestrictedColors = uniqueColors.some(c => c.is_download_restricted === true);
              console.log('[ColorMatchDetail] 🔍 Button check:', { 
                hasRestrictedColors, 
                uniqueColorsCount: uniqueColors.length,
                restrictedColors: uniqueColors.filter(c => c.is_download_restricted === true).map(c => c.name)
              });
              return !hasRestrictedColors;
            })() && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                   <Button variant="outline" size="sm">
                     <Download className="w-4 h-4 mr-2" />
                     Download References
                   </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDownloadReferences}>
                    <FileQuestion className="w-4 h-4 mr-2" />
                    CSV (Data)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsCxfExportOpen(true)}>
                    <Share2 className="w-4 h-4 mr-2" />
                    CxF (Spectral)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="grid gap-6 flex-1 overflow-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {uniqueColors.map((color) => (
             <ColorStandardCard
               key={`${color?.id ?? color?.color_id}-${color?.match_measurement?.id ?? 'no-meas'}`}
               color={color}
               matchId={matchId}
               onShare={handleShare}
               onApprove={handleApprove}
               onSendForApproval={handleSendForApproval}
               onRematchBySharedWith={handleRematchBySharedWith}
               onRematchByRoutedTo={handleRematchByRoutedTo}
               onSetState={handleSetState}
               isRequestor={isRequestor}
               matchRequestId={matchId}
               matchRequest={matchRequest}
               pendingStatus={pendingStatuses[color?.id ?? color?.color_id]}
               isUpdating={updating}
               matchMeasurements={matchMeasurements}
             />
          ))}
        </div>

        {isSharing && (
          <ShareMatchDialog
            isOpen={isSharing}
            onClose={() => {
              setIsSharing(false);
              setColorToShare(null);
            }}
            onConfirm={handleConfirmShare}
            colorName={colorToShare?.name}
            partnerName={matchRequest?.shared_with}
            jobId={matchRequest?.job_id}
          />
        )}

        {isRoutingWizardOpen && (
          <RouteMatchesWizard
            open={isRoutingWizardOpen}
            onOpenChange={setIsRoutingWizardOpen}
            matchRequest={matchRequest}
            onRouted={() => {
              setIsRoutingWizardOpen(false);
              queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
              queryClient.invalidateQueries({ queryKey: ['match-requests'] });
            }}
          />
        )}

        <MultiFormatExportDialog
          isOpen={isCxfExportOpen}
          setIsOpen={setIsCxfExportOpen}
          references={matchRequest?.colors || []}
          measurementsByColorId={{}}
          inkConditionsData={[]}
          title={`Export Job ${matchRequest?.job_id || 'References'}`}
        />
        
        <DraggableModal
          isOpen={isNotesModalOpen}
          onClose={() => setIsNotesModalOpen(false)}
          title="Routing Notes"
        >
          <p className="text-sm text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto mb-4">
            {routingNotes}
          </p>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setIsNotesModalOpen(false)}>
              OK
            </Button>
          </div>
        </DraggableModal>
      </div>
    </>
  );
};

export default ColorMatchDetail;
