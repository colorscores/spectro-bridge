import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { updateJobStatusBasedOnMatches } from '@/lib/matchJobStatusLogic';
import { useQueryClient } from '@tanstack/react-query';

export function useOptimizedMatchData() {
  const { matchId, colorId } = useParams();
  const queryClient = useQueryClient();
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [basicInfo, setBasicInfo] = useState(null); // For progressive loading
  const [isCurrentlyFetching, setIsCurrentlyFetching] = useState(false);

  // Helper to coerce Lab values to numbers (RPC may return strings)
  const toNum = (v) => v == null ? null : (isFinite(Number(v)) ? Number(v) : null);

  // Optimized fetch function using the new get_match_request_details RPC
  const fetchOptimizedMatchData = useCallback(async () => {
    if (!matchId || !colorId) return;
    
    // Prevent duplicate fetches (React StrictMode protection)
    if (isCurrentlyFetching) {
      console.log('🔄 Fetch already in progress, skipping duplicate call');
      return;
    }
    
    setIsCurrentlyFetching(true);
    setLoading(true);
    
    console.time('⏱️ get_match_request_details');
    try {
      // Use the new RPC function that returns a complete JSON payload
      const { data: requestDetails, error: rpcError } = await supabase.rpc(
        'get_match_request_details', 
        { p_match_request_id: matchId }
      );
      
      if (rpcError) {
        console.error('RPC Error:', rpcError);
        throw rpcError;
      }

      // Normalize RPC response - handle both single object and array formats
      const isArrayFormat = Array.isArray(requestDetails);
      const isSingleObjectFormat = requestDetails && !isArrayFormat && requestDetails.colors;
      
      let normalizedMatchRequest;
      let normalizedColors = [];
      
      if (isSingleObjectFormat) {
        // New format: single object with nested colors array
        console.log('✅ RPC returned single object format with', requestDetails.colors?.length || 0, 'colors');
        
        normalizedMatchRequest = {
          id: requestDetails.id,
          name: requestDetails.name,
          match_request_name: requestDetails.name,
          job_id: requestDetails.job_id,
          status: requestDetails.status,
          created_at: requestDetails.created_at,
          updated_at: requestDetails.updated_at,
          organization_id: requestDetails.organization_id,
          organization_name: requestDetails.organization_name,
          requestor_organization_name: requestDetails.requestor_organization_name,
          requestor_org_name: requestDetails.requestor_organization_name,
          shared_with_org_id: requestDetails.shared_with_org_id || null,
          shared_with_org_name: requestDetails.shared_with_org_name || requestDetails.shared_with || null,
          shared_with: requestDetails.shared_with_org_name || requestDetails.shared_with || null,
          shared_with_location_name: requestDetails.shared_with_location_name || null,
          routed_to_org_id: requestDetails.routed_to_org_id || null,
          routed_to_org_name: requestDetails.routed_to_org_name || requestDetails.routed_to || null,
          routed_to: requestDetails.routed_to_org_name || requestDetails.routed_to || null,
          routed_to_location_name: requestDetails.routed_to_location_name || null,
          print_condition: requestDetails.print_condition,
          print_condition_name: requestDetails.print_condition_name || requestDetails.print_condition,
          print_process: requestDetails.print_process,
          substrate: requestDetails.substrate,
          quality_set_id: requestDetails.quality_set_id,
          quality_set: requestDetails.quality_set || null,
          location_name: requestDetails.location_name || requestDetails.location,
          location: requestDetails.location_name || requestDetails.location,
          due_date: requestDetails.due_date,
          project_id: requestDetails.project_id,
          routing_chain: requestDetails.routing_chain,
          is_routed: requestDetails.is_routed,
        };
        
        normalizedColors = (requestDetails.colors || []).map(c => {
          const mm = c.match_measurement || {};
          const cid = c.id || mm.color_id || null;
          return {
            id: cid,
            color_id: cid,
            name: c.name || mm.name || null,
            hex: c.hex || null,
            lab_l: toNum(c.lab_l ?? c.lab?.L),
            lab_a: toNum(c.lab_a ?? c.lab?.a ?? c.lab?.A),
            lab_b: toNum(c.lab_b ?? c.lab?.b ?? c.lab?.B),
            lab_illuminant: c.lab_illuminant ?? null,
            lab_observer: c.lab_observer ?? null,
            lab_table: c.lab_table ?? null,
            spectral_data: c.spectral_data ?? null,
            match_measurement: mm,
            match_measurement_state: mm.match_measurement_state || null,
            measurement_id: mm.id || null,
            status: mm.status || null,
          };
        });
      } else {
        // Legacy format: array of flattened rows
        const rows = isArrayFormat ? requestDetails : (requestDetails ? [requestDetails] : []);
        
        if (rows.length === 0) {
          console.warn('No match request found or access denied');
          toast({
            title: "Access denied or request not found",
            description: "You may not have permission to view this match request.",
            variant: "destructive"
          });
          return;
        }

        console.log('✅ Match request RPC returned', rows.length, 'rows (legacy format)');
        
        const first = rows[0] || {};
        normalizedMatchRequest = {
          id: first.match_request_id,
          name: first.match_request_name,
          match_request_name: first.match_request_name,
          job_id: first.match_request_name, // The job ID IS the match request name
          status: first.match_request_status,
          created_at: first.match_request_created_at,
          updated_at: first.match_request_updated_at,
          organization_id: first.match_request_organization_id,
          organization_name: first.match_request_organization_name,
          requestor_organization_name: first.match_request_organization_name || first.organization_name,
          requestor_org_name: first.match_request_organization_name || first.organization_name,
          shared_with_org_id: first.shared_with_org_id || null,
          shared_with_org_name: first.shared_with_org_name || null,
          shared_with: first.shared_with_org_name || first.shared_with || null,
          shared_with_location_name: first.shared_with_location_name || null,
          routed_to_org_id: first.routed_to_org_id || null,
          routed_to_org_name: first.routed_to_org_name || null,
          routed_to: first.routed_to_org_name || first.routed_to || null,
          routed_to_location_name: first.routed_to_location_name || null,
          print_condition: first.match_request_print_condition,
          print_condition_name: first.print_condition_name || first.match_request_print_condition,
          print_process: first.print_condition_print_process || first.match_request_print_process,
          substrate: first.print_condition_substrate || first.match_request_substrate,
          quality_set_id: first.match_request_quality_set_id,
          quality_set: first.quality_set || null,
          location_name: first.location_name,
          location: first.location_name,
          due_date: first.due_date,
          project_id: first.project_id,
          routing_chain: first.routing_chain,
          is_routed: first.is_routed,
        };
        
        normalizedColors = rows.map(r => {
          const mm = r.match_measurement || {};
          const cid = mm.color_id || r.match_request_color_id || null;
          return {
            id: cid,
            color_id: cid,
            name: r.match_request_color_name || mm.name || null,
            hex: r.match_request_color_hex || null,
            lab_l: toNum(r.match_request_color_lab_l),
            lab_a: toNum(r.match_request_color_lab_a),
            lab_b: toNum(r.match_request_color_lab_b),
            lab_illuminant: r.match_request_color_lab_illuminant ?? null,
            lab_observer: r.match_request_color_lab_observer ?? null,
            lab_table: r.match_request_color_lab_table ?? null,
            spectral_data: r.match_request_color_spectral_data ?? null,
            match_measurement: mm,
            match_measurement_state: mm.match_measurement_state || null,
            measurement_id: mm.id || null,
            status: mm.status || null,
          };
        });
      }
      
      console.log('🔍 [useOptimizedMatchData] Normalized colors:', normalizedColors.map(c => ({ id: c.id, name: c.name })));
      
      // Find the specific color in the normalized colors array
      const targetColor = normalizedColors.find(c => (c.id || c.color_id) === colorId);
      
      if (!targetColor) {
        const availableIds = normalizedColors.map(c => c.id || c.color_id).filter(Boolean);
        console.warn(`❌ Color ${colorId} not found in match request ${matchId}. Available IDs:`, availableIds);
        // Continue anyway to allow auto-creation logic to run
      }

      // Fetch color measurements including spectral_data for Lab derivation
      const { data: colorMeasurements, error: measurementsError } = await supabase
        .from('color_measurements')
        .select('id,mode,lab,spectral_data,created_at')
        .eq('color_id', colorId)
        .order('created_at', { ascending: false });

      if (measurementsError) {
        console.warn('Could not fetch color measurements:', measurementsError);
      }

      // Get match measurement details from the RPC color object if present
      const matchMeasurementFromRPC = targetColor?.match_measurement || null;
      
      console.log('🔍 [useOptimizedMatchData] Match measurement from RPC:', matchMeasurementFromRPC ? { id: matchMeasurementFromRPC.id, status: matchMeasurementFromRPC.status } : 'none');

      // Check if RPC measurement needs enrichment
      let matchMeasurement = matchMeasurementFromRPC;
      let enrichmentSource = 'rpc';
      
      const needsEnrichment = matchMeasurement && (
        !matchMeasurement.match_measurement_state ||
        !matchMeasurement.quality_set_id ||
        (matchMeasurement.lab_l == null && matchMeasurement.lab_a == null && matchMeasurement.lab_b == null && !matchMeasurement.spectral_data)
      );
      
      if (needsEnrichment) {
        console.log('🔍 [useOptimizedMatchData] RPC measurement incomplete, enriching from DB:', matchMeasurement.id);
        const { data: fullMm, error: mmErr } = await supabase
          .from('match_measurements')
          .select('id,status,match_measurement_state,matched_hex,lab_l,lab_a,lab_b,reference_lab_l,reference_lab_a,reference_lab_b,matched_color_data,quality_set_id,ink_condition_id,match_location,match_print_process,matched_by_name,created_at,is_routed,spectral_data')
          .eq('id', matchMeasurement.id)
          .maybeSingle();
        
        if (!mmErr && fullMm) {
          matchMeasurement = { ...matchMeasurement, ...fullMm };
          enrichmentSource = 'enriched_by_db';
          console.log('✅ [useOptimizedMatchData] Enriched measurement with state:', matchMeasurement.match_measurement_state);
        }
      } else if (!matchMeasurement) {
        // No measurement from RPC, fetch or create
        const { data: mmRow, error: mmErr } = await supabase
          .from('match_measurements')
          .select('id,status,match_measurement_state,matched_hex,lab_l,lab_a,lab_b,reference_lab_l,reference_lab_a,reference_lab_b,matched_color_data,quality_set_id,ink_condition_id,match_location,match_print_process,matched_by_name,created_at,is_routed,spectral_data')
          .eq('match_request_id', matchId)
          .eq('color_id', colorId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!mmErr && mmRow) {
          matchMeasurement = mmRow;
          enrichmentSource = 'db_fetch';
        } else if (!mmRow) {
          // Auto-create match measurement if it doesn't exist
          console.log('🔨 [useOptimizedMatchData] Creating match measurement for:', { matchId, colorId });
          const { data: newMeasurement, error: createError } = await supabase
            .from('match_measurements')
            .insert({
              match_request_id: matchId,
              color_id: colorId,
              match_measurement_state: 'draft',
              status: 'New'
            })
            .select('id,status,match_measurement_state,matched_hex,lab_l,lab_a,lab_b,reference_lab_l,reference_lab_a,reference_lab_b,matched_color_data,quality_set_id,ink_condition_id,match_location,match_print_process,matched_by_name,created_at,is_routed,spectral_data')
            .single();
          
          if (!createError && newMeasurement) {
            console.log('✅ [useOptimizedMatchData] Created match measurement:', newMeasurement.id);
            matchMeasurement = newMeasurement;
            enrichmentSource = 'created';
          } else {
            console.error('❌ [useOptimizedMatchData] Failed to create match measurement:', createError);
          }
        }
      }
      
      console.log('🔍 [useOptimizedMatchData] Measurement source:', enrichmentSource);

      // Ensure we have a fully-populated measurement
      let fullMatchMeasurement = matchMeasurement || null;
      if (matchMeasurement && (!matchMeasurement.matched_color_data || matchMeasurement.matched_hex == null)) {
        const { data: fullData, error: matchError } = await supabase
          .from('match_measurements')
          .select('id,status,match_measurement_state,matched_hex,lab_l,lab_a,lab_b,reference_lab_l,reference_lab_a,reference_lab_b,matched_color_data,quality_set_id,ink_condition_id,match_location,match_print_process,matched_by_name,created_at,is_routed,spectral_data')
          .eq('id', matchMeasurement.id)
          .maybeSingle();
        if (!matchError && fullData) {
          fullMatchMeasurement = fullData;
        }
      }

      if (fullMatchMeasurement) {
        console.log('🔍 [useOptimizedMatchData] Effective match measurement:', {
          id: fullMatchMeasurement.id,
          has_matched_color_data: !!fullMatchMeasurement.matched_color_data,
          has_lab_values: !!(fullMatchMeasurement.lab_l != null && fullMatchMeasurement.lab_a != null && fullMatchMeasurement.lab_b != null),
          has_spectral_data: !!(fullMatchMeasurement.spectral_data || fullMatchMeasurement?.matched_color_data?.spectralData),
          quality_set_id: fullMatchMeasurement.quality_set_id
        });
        
        // ROOT CAUSE FIX: Compute Lab from spectral if Lab is zero but spectral exists
        const mcd = fullMatchMeasurement.matched_color_data;
        if (mcd) {
          const isZeroLab = mcd.lab && mcd.lab.L === 0 && mcd.lab.a === 0 && mcd.lab.b === 0;
          const hasSpectral = !!(mcd.spectral_data || mcd.spectralData);
          
          if (isZeroLab && hasSpectral) {
            try {
              console.log('[useOptimizedMatchData] Detected zero Lab with spectral - computing from spectral');
              const { spectralToLabASTME308 } = require('@/lib/colorUtils');
              
              const illuminant = mcd.illuminant || 'D50';
              const observer = mcd.observer || '2';
              const spectralData = mcd.spectral_data || mcd.spectralData;
              
              // Normalize observer and illuminant to match database format
              const normObs = String(observer || '').replace(/[^0-9]/g, '');
              const normIll = String(illuminant || '').toUpperCase().trim();
              
              // Fetch ASTM weighting table (using table 5, the standard default)
              const { data: astmData } = await supabase
                .from('astm_e308_tables')
                .select('*')
                .eq('illuminant_name', normIll)
                .eq('observer', normObs)
                .eq('table_number', 5)
                .maybeSingle();
              
              if (astmData) {
                const computedLab = spectralToLabASTME308(spectralData, illuminant, observer, astmData);
                if (computedLab && typeof computedLab.L === 'number' && isFinite(computedLab.L)) {
                  // Update matched_color_data with computed Lab
                  fullMatchMeasurement.matched_color_data.lab = computedLab;
                  console.log('[useOptimizedMatchData] ✅ Computed Lab from spectral:', computedLab);
                }
              } else {
                console.warn('[useOptimizedMatchData] No ASTM data found for:', { normIll, normObs, table: 5 });
              }
            } catch (error) {
              console.warn('[useOptimizedMatchData] Failed to compute Lab from spectral:', error);
            }
          }
        }
      }
      let qualitySet = null;
      let qualitySetSource = 'none';

      // ONLY source: match_measurements.quality_set_id
      // NO FALLBACKS - this is a quality measurement system
      if (fullMatchMeasurement?.quality_set_id) {
        console.log('🔍 Fetching quality set from match_measurements.quality_set_id:', fullMatchMeasurement.quality_set_id);
        try {
          // Use get_shared_quality_set_details which handles cross-org access for shared matches
          const { data: qsData, error: qsErr } = await supabase.rpc('get_shared_quality_set_details', {
            qs_id: fullMatchMeasurement.quality_set_id,
            match_request_id: matchId
          });
          
          if (qsErr) {
            console.error('❌ Failed to fetch quality set:', qsErr);
            toast({
              title: "Quality set error",
              description: "Could not load the assigned quality set for this match.",
              variant: "destructive"
            });
          } else if (!qsData) {
            console.warn('⚠️ Quality set not found or access denied:', fullMatchMeasurement.quality_set_id);
            toast({
              title: "Quality set not accessible",
              description: "The quality set assigned to this match could not be accessed.",
              variant: "destructive"
            });
          } else {
            qualitySet = { ...qsData, source: 'match_measurement' };
            qualitySetSource = 'match_measurement';
            console.log('✅ Got quality set from match_measurements:', {
              id: qualitySet.id,
              name: qualitySet.name,
              source: 'match_measurement',
              rulesCount: (qualitySet.quality_rules || qualitySet.rules || []).length
            });
          }
        } catch (qsErr) {
          console.error('❌ Exception fetching quality set:', qsErr);
          toast({
            title: "Quality set error",
            description: "An error occurred while loading the quality set.",
            variant: "destructive"
          });
        }
      } else {
        console.log('ℹ️ No quality_set_id assigned to this match measurement');
      }

      // Add source information to quality set for UI display
      if (qualitySet && !qualitySet.source) {
        qualitySet.source = qualitySetSource;
      }

      // Enhance match measurement with Lab values from spectral data if needed
      let enhancedMatchMeasurement = fullMatchMeasurement || matchMeasurement;
      if (enhancedMatchMeasurement?.matched_color_data?.spectralData && 
          (enhancedMatchMeasurement.lab_l == null || enhancedMatchMeasurement.lab_a == null || enhancedMatchMeasurement.lab_b == null)) {
        console.log('🔍 [useOptimizedMatchData] Attempting to extract Lab from spectral data for quality assessment');
        
        try {
          // Use the spectral calculations hook logic directly
          const spectralData = enhancedMatchMeasurement.matched_color_data.spectralData;
          
          // Calculate Lab from spectral data using D50/2°/Table 5 (standard defaults)
          if (spectralData && typeof spectralData === 'object') {
            // For now, we'll rely on the useResolvedLab hook to handle this
            // The key is ensuring the matched_color_data is available to QualitySetDisplay
            console.log('✅ [useOptimizedMatchData] Spectral data available for Lab calculation');
          }
        } catch (error) {
          console.warn('⚠️ [useOptimizedMatchData] Error checking spectral data:', error);
        }
      }

      const processedData = {
        matchRequest: normalizedMatchRequest,
        color: {
          id: colorId,
          name: targetColor?.name || 'Unknown Color',
          hex: targetColor?.hex || '#cccccc',
          lab_l: targetColor?.lab_l,
          lab_a: targetColor?.lab_a,
          lab_b: targetColor?.lab_b,
          status: targetColor?.status || 'Production',
          organization_id: normalizedMatchRequest.organization_id,
          created_at: normalizedMatchRequest.created_at
        },
        matchMeasurement: enhancedMatchMeasurement,
        colorMeasurements: colorMeasurements || [],
        qualitySet: qualitySet,
        printConditionDetails: null,
        hasMatchData: !!enhancedMatchMeasurement
      };
      
      console.log('✅ [useOptimizedMatchData] Processed data ready:', {
        hasMatchRequest: !!processedData.matchRequest,
        hasColor: !!processedData.color,
        hasMeasurement: !!processedData.matchMeasurement,
        colorName: processedData.color.name
      });

      // Set basic info first for progressive loading
      setBasicInfo({
        matchRequest: processedData.matchRequest,
        color: processedData.color,
        qualitySet: processedData.qualitySet,
        printConditionDetails: processedData.printConditionDetails,
      });

      // Set full data
      setMatchData(processedData);
      console.timeEnd('⏱️ get_match_request_details');
    } catch (error) {
      console.error("Error fetching optimized match data:", error);
      console.timeEnd('⏱️ get_match_request_details');
      toast({
        title: "Error loading match data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setIsCurrentlyFetching(false);
    }
  }, [matchId, colorId]); // Only depend on the IDs

  // Use ref to store latest fetch function to avoid stale closures
  const fetchRef = React.useRef();
  fetchRef.current = fetchOptimizedMatchData;

  // Use effect with stable dependencies to prevent infinite re-renders
  useEffect(() => {
    if (matchId && colorId) {
      fetchOptimizedMatchData();
    }
  }, [matchId, colorId]); // Only re-run when IDs change, not when the function changes

  // Set up real-time subscription for match measurement updates
  useEffect(() => {
    if (!matchId || !colorId) return;

    console.log('🔄 Setting up real-time subscription for match updates');
    
    const channel = supabase
      .channel(`match-updates-${matchId}-${colorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_measurements',
          filter: `match_request_id=eq.${matchId}`
        },
        (payload) => {
          console.log('🔄 Real-time update received:', payload);
          // Only react to changes for the current color
          const changedColorId = payload.new?.color_id || payload.old?.color_id;
          if (changedColorId !== colorId) return;
          
          // Invalidate related queries to ensure fresh data
          queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
          queryClient.invalidateQueries({ queryKey: ['match-requests'] });
          
          // Refresh the data if it's an update or insert - USE REF to avoid dependency
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            console.log('🔄 Triggering data refresh due to match measurement change');
            setTimeout(() => {
              fetchRef.current?.();
            }, 100); // Small delay to ensure DB consistency
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [matchId, colorId, queryClient]); // Remove fetchOptimizedMatchData from dependencies

  // Derived values for backward compatibility
  const matchRequest = matchData?.matchRequest || basicInfo?.matchRequest;
  const color = matchData?.color || basicInfo?.color;
  
  // Attach measurements to color object for component compatibility
  const selectedColor = color ? {
    ...color,
    measurements: matchData?.colorMeasurements || []
  } : null;

  // Debug loaded match creation
  console.log('🔍 [useOptimizedMatchData] Creating loadedMatch:', {
    hasMatchData: !!matchData,
    hasMatchMeasurement: !!matchData?.matchMeasurement,
    hasMatchedColorData: !!matchData?.matchMeasurement?.matched_color_data,
    hasLabValues: !!(matchData?.matchMeasurement?.lab_l != null && 
                     matchData?.matchMeasurement?.lab_a != null && 
                     matchData?.matchMeasurement?.lab_b != null),
    matchMeasurement: matchData?.matchMeasurement ? {
      id: matchData.matchMeasurement.id,
      status: matchData.matchMeasurement.status,
      matched_hex: matchData.matchMeasurement.matched_hex,
      lab_l: matchData.matchMeasurement.lab_l,
      lab_a: matchData.matchMeasurement.lab_a,
      lab_b: matchData.matchMeasurement.lab_b,
      hasMatchedColorData: !!matchData.matchMeasurement.matched_color_data
    } : null
  });

  // Fetch ink condition data if needed
  const [inkConditionData, setInkConditionData] = useState(null);
  
  useEffect(() => {
    const fetchInkCondition = async () => {
      const mm = matchData?.matchMeasurement;
      
      // Only fetch if we have an ink_condition_id but no matched_color_data or lab values
      if (mm?.ink_condition_id && 
          !mm.matched_color_data && 
          (mm.lab_l == null || mm.lab_a == null || mm.lab_b == null)) {
        
        console.log('🔍 [useOptimizedMatchData] Fetching ink condition:', mm.ink_condition_id);
        
        const { data: inkCondition, error } = await supabase
          .from('ink_conditions')
          .select('*')
          .eq('id', mm.ink_condition_id)
          .single();
        
        if (error) {
          console.error('❌ [useOptimizedMatchData] Error fetching ink condition:', error);
          setInkConditionData(null);
        } else {
          console.log('✅ [useOptimizedMatchData] Fetched ink condition:', inkCondition);
          setInkConditionData(inkCondition);
        }
      } else {
        setInkConditionData(null);
      }
    };
    
    fetchInkCondition();
  }, [matchData?.matchMeasurement?.ink_condition_id, matchData?.matchMeasurement?.matched_color_data]);

  // Construct loadedMatch with Lab synthesis from hex when needed
  const loadedMatch = (() => {
    const mm = matchData?.matchMeasurement;
    if (!mm) return null;

    // Priority 1: matched_color_data exists
    if (mm.matched_color_data) {
      const mcd = mm.matched_color_data;
      const result = {
        ...mcd,
        status: mm.status,
        match_measurement_state: mm.match_measurement_state,
        is_routed: mm.is_routed,
        quality_set_id: mm.quality_set_id,
        ink_condition_id: mm.ink_condition_id,
        hasActualData: true
      };
      
      // Check if matched_color_data has Lab values (may have been computed earlier in fetchOptimizedMatchData)
      const hasLab = (mcd.lab && typeof mcd.lab === 'object' && typeof mcd.lab.L === 'number') || 
                     (typeof mcd.lab_l === 'number' && typeof mcd.lab_a === 'number' && typeof mcd.lab_b === 'number');
      const hasSpectral = !!(mcd.spectral_data || mcd.spectralData);
      const hasHex = !!(mcd.hex || mcd.matched_hex);
      
      // If matched_color_data lacks Lab/spectral but has hex, synthesize Lab for quality assessment
      if (!hasLab && !hasSpectral && hasHex) {
        try {
          const { hexToLab } = require('@/lib/colorUtils');
          const syntheticLab = hexToLab(mcd.hex || mcd.matched_hex, 'D50');
          if (syntheticLab && typeof syntheticLab.L === 'number') {
            result.lab = syntheticLab;
            console.log('[loadedMatch] Synthesized Lab from matched hex:', syntheticLab);
          }
        } catch (error) {
          console.warn('[loadedMatch] Failed to synthesize Lab from hex:', error);
        }
      }
      
      return result;
    }
    
    // Priority 2: Direct Lab values from match_measurement
    if (mm.lab_l != null && mm.lab_a != null && mm.lab_b != null) {
      return {
        name: 'Saved Match',
        lab: { L: mm.lab_l, a: mm.lab_a, b: mm.lab_b },
        hex: mm.matched_hex,
        status: mm.status,
        match_measurement_state: mm.match_measurement_state,
        is_routed: mm.is_routed,
        quality_set_id: mm.quality_set_id,
        ink_condition_id: mm.ink_condition_id,
        hasActualData: true
      };
    }
    
    // Priority 3: Ink condition data
    if (inkConditionData) {
      return {
        name: inkConditionData.name,
        hex: inkConditionData.color_hex,
        colorHex: inkConditionData.color_hex,
        imported_tints: inkConditionData.imported_tints,
        adapted_tints: inkConditionData.adapted_tints,
        spectral_data: inkConditionData.spectral_data,
        lab: inkConditionData.lab,
        active_data_mode: inkConditionData.active_data_mode || 
                          inkConditionData.ui_state?.active_data_mode || 
                          inkConditionData.measurement_settings?.preferred_data_mode || 
                          'imported',
        status: mm.status,
        match_measurement_state: mm.match_measurement_state,
        is_routed: mm.is_routed,
        quality_set_id: mm.quality_set_id,
        ink_condition_id: mm.ink_condition_id,
        hasActualData: true,
        fromInkCondition: true
      };
    }
    
    return null;
  })();

  console.log('✅ [useOptimizedMatchData] Final loadedMatch:', loadedMatch);

  const handleSaveMatch = async (matchDataToSave) => {
    if (!matchDataToSave || !color) {
      toast({
        title: "No match to save",
        description: "Please load a match color before saving.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Get existing match measurement to preserve quality_set_id if not provided
      const { data: existingMatch } = await supabase
        .from('match_measurements')
        .select('quality_set_id')
        .eq('match_request_id', matchId)
        .eq('color_id', colorId)
        .single();

      const upsertData = {
        match_request_id: matchId,
        color_id: colorId,
        status: 'Saved',
        matched_hex: matchDataToSave.hex || matchDataToSave.colorHex,
        matched_color_data: matchDataToSave,
        quality_set_id: matchDataToSave.quality_set_id || existingMatch?.quality_set_id,
        // Set role-specific match_measurement_state based on routing context
        match_measurement_state: matchRequest?.routed_to_org_id ? 'saved-by-routed-to' : 'saved-by-shared-with',
        
        // 🎯 Phase 4: Store the full measurements array with mode info
        measurements: matchDataToSave.measurements || null,
        
        // Store primary mode spectral data for backward compatibility and fast access
        spectral_data: matchDataToSave.spectralData || matchDataToSave.spectral_data || null,
        
        // 🎯 Phase 4: Store the measurement mode used (extract from measurements or use direct value)
        measurement_mode: matchDataToSave.measurementMode || 
                         matchDataToSave.measurement_mode || 
                         (matchDataToSave.measurements && matchDataToSave.measurements[0]?.mode) ||
                         null
      };
      
      // Extract Lab from matchDataToSave, respecting active_data_mode for ink conditions
      if (matchDataToSave.lab && matchDataToSave.lab.L != null) {
        upsertData.lab_l = Number(matchDataToSave.lab.L);
        upsertData.lab_a = Number(matchDataToSave.lab.a);
        upsertData.lab_b = Number(matchDataToSave.lab.b);
      }

      if (matchDataToSave.ink_condition_id) {
        upsertData.ink_condition_id = matchDataToSave.ink_condition_id;
        
        // PHASE 1: Always include active_data_mode in matched_color_data
        // Default to 'imported' if not explicitly set
        const activeDataMode = matchDataToSave.active_data_mode || 'imported';
        console.log('💾 Phase 1 - Saving active_data_mode:', activeDataMode, 'to matched_color_data');
        
        upsertData.matched_color_data = {
          ...matchDataToSave,
          active_data_mode: activeDataMode
        };
      }
      
      // Set matched_by_name to current user's organization name
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;
        if (user?.id) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('organization_id, organizations(name)')
            .eq('id', user.id)
            .single();
          
          const orgName = prof?.organizations?.name;
          if (orgName) {
            upsertData.matched_by_name = orgName;
          }
        }
      } catch (e) {
        console.warn('⚠️ Could not resolve matched_by_name:', e?.message || e);
      }
      
      const { data: savedData, error } = await supabase
        .from('match_measurements')
        .upsert(upsertData, { onConflict: 'match_request_id, color_id' })
        .select()
        .single();
        
      if (error) throw error;
      
      toast({
        title: "✅ Match Saved",
        description: "Your match has been saved."
      });
      
      // Update job status and refresh data
      await updateJobStatusBasedOnMatches(matchId);
      await fetchOptimizedMatchData();

    } catch (error) {
      toast({
        title: "Error saving match",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Optimized refresh function that reuses the same fetch logic
  const refreshData = useCallback(() => {
    // Reset states and refetch
    setLoading(true);
    setMatchData(null);
    setBasicInfo(null);
    
    // Trigger fresh fetch
    if (matchId && colorId) {
      fetchOptimizedMatchData();
    }
  }, [matchId, colorId, fetchOptimizedMatchData]);

  return {
    matchId,
    colorId,
    matchRequest,
    color,
    selectedColor, // Add selectedColor with measurements attached
    matchData,
    basicInfo,
    loading,
    loadedMatch,
    qualitySet: matchData?.qualitySet,
    colorMeasurements: matchData?.colorMeasurements || [],
    printConditionDetails: matchData?.printConditionDetails,
    handleSaveMatch,
    refreshData: refreshData
  };
}
