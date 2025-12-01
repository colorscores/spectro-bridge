import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProfile } from '@/context/ProfileContext';
import { formatDistanceToNow } from 'date-fns';
import { getEntityKey, getStatePriority } from '@/lib/notificationSpecs';

// Performance optimization: disable debug logging
const DEBUG_NOTIFICATIONS = false;

// ============================================================================
// PHASE 3: Feature flag for new consolidation logic (instant rollback)
// ============================================================================
const USE_NEW_CONSOLIDATION = true; // Set to false to rollback instantly
import { 
  Bell, 
  ClipboardList, 
  CheckCircle, 
  CheckCircle2,
  FileText, 
  Info, 
  Briefcase, 
  Palette, 
  UserPlus, 
  Clock, 
  AlertTriangle 
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { shouldShowColorBubbles, extractNotificationColors } from '@/lib/notificationUtils';
import { consolidateNotifications } from '@/lib/notificationConsolidator';
import { debug } from '@/lib/debugUtils';

const NotificationsContext = createContext();

export const NotificationsProvider = ({ children }) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  
  if (DEBUG_NOTIFICATIONS) {
    console.log('[NotificationsProvider] Rendering with:', {
      hasUser: !!user,
      userId: user?.id,
      hasProfile: !!profile,
      orgId: profile?.organization_id
    });
  }
  
  // Don't crash if contexts aren't available - just provide safe defaults
  const queryClient = useQueryClient();
  
  
  const [notifications, setNotifications] = useState([]);
  const [reads, setReads] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [colorsByMatchRequest, setColorsByMatchRequest] = useState(new Map());
  const [colorsByJobId, setColorsByJobId] = useState(new Map());
  const [colorsByRoutedJobId, setColorsByRoutedJobId] = useState(new Map());
  const [orgCache, setOrgCache] = useState({});

  // SIMPLIFIED: Basic notification normalization
  const normalizeNotifications = (list) => {
    return (list || []).map((n) => {
      let rawMd = {};
      try {
        rawMd = typeof n?.metadata === 'string' ? JSON.parse(n.metadata) : (n?.metadata || {});
      } catch (e) {
        if (DEBUG_NOTIFICATIONS) console.warn('Notifications: invalid metadata JSON', { id: n?.id, metadata: n?.metadata });
        rawMd = {};
      }
      
      // Normalize IDs to numbers when possible for consistent Map/Object lookups
      const toNum = (val) => (val === undefined || val === null || val === '' || isNaN(Number(val)) ? val : Number(val));

      // Extract color_id deterministically (do NOT infer from colors array)
      const colorId = rawMd.color_id || 
                     rawMd.match_color_id || 
                     rawMd.measurement_color_id ||
                     null;

      return {
        ...n,
        metadata: {
          ...rawMd,
          // Normalize key fields for consolidation
          match_request_id: toNum(rawMd.match_request_id || rawMd.request_id),
          job_id: toNum(rawMd.job_id || n.job_id),
          color_id: colorId
        }
      };
    });
  };

  const fetchAll = async () => {
    if (DEBUG_NOTIFICATIONS) {
      console.log('[NotificationsContext] fetchAll called:', { 
        hasUser: !!user, 
        hasProfile: !!profile, 
        orgId: profile?.organization_id 
      });
    }
    
    if (!user || !profile?.organization_id) {
      if (DEBUG_NOTIFICATIONS) console.log('[NotificationsContext] Skipping fetch - missing user or org');
      return;
    }
    
    setLoading(true);
    try {
      // Fetch latest org-scoped notifications with explicit org filter
      const { data: notifs, error: notifsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (DEBUG_NOTIFICATIONS) {
        console.log('[NotificationsContext] Fetched notifications:', { 
          count: notifs?.length, 
          error: notifsError,
          sample: notifs?.[0]
        });
      }

      if (notifsError) {
        if (DEBUG_NOTIFICATIONS) console.error('Error fetching notifications:', notifsError);
      }

      const { data: readRows, error: readsError } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id);

      if (DEBUG_NOTIFICATIONS) {
        console.log('[NotificationsContext] Fetched reads:', { 
          count: readRows?.length, 
          error: readsError 
        });
      }

      if (readsError) {
        if (DEBUG_NOTIFICATIONS) console.error('Error fetching notification reads:', readsError);
      }

      // Normalize first so enrichment functions work with consistent metadata objects
      const normalized = normalizeNotifications(notifs || []);

      // Immediately set basic state so UI can render fast
      setNotifications(normalized);
      setReads(new Set((readRows || []).map(r => r.notification_id)));

      // Enrich data in the background without blocking first paint
      ;(async () => {
        try {
          await fetchColorsForMatchRequests(normalized);
          await enrichColorIdsFromMeasurements(normalized);
          await enrichMatchUpdateNotifications(normalized);
          await enrichJobRoutedNotifications(normalized);

          // Trigger re-render with enriched notifications
          setNotifications([...normalized]);
        } catch (e) {
          if (DEBUG_NOTIFICATIONS) console.warn('Notifications enrichment failed (non-blocking):', e);
        }
      })();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user?.id, profile?.organization_id]);

  // Fetch organization cache for ID-based name resolution
  useEffect(() => {
    if (!user) return;
    
    const fetchOrganizations = async () => {
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name');
        
        if (error) {
          console.error('Error fetching organizations:', error);
          return;
        }
        
        if (data) {
          const cache = data.reduce((acc, org) => {
            acc[org.id] = org.name;
            return acc;
          }, {});
          console.log('🏢 Organization cache loaded:', cache);
          setOrgCache(cache);
        }
      } catch (err) {
        console.error('Error building org cache:', err);
      }
    };
    
    fetchOrganizations();
  }, [user]);

  // Subscribe to centralized realtime manager with debouncing
  useEffect(() => {
    if (!user || !profile?.organization_id) return;

    let realtimeManagerSubscription = null;
    let debounceTimer = null;

    const debouncedFetchAll = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchAll, 300);
    };

    const initRealtimeSubscription = async () => {
      try {
        const { realtimeManager } = await import('@/lib/realtimeManager');
        
        realtimeManagerSubscription = realtimeManager.subscribe('notifications-context', (event, payload) => {
          console.log('🌐 Broadcast event received:', event, payload);
          
          if (event === 'force-notification-refresh') {
            // Supabase may wrap broadcast data; payload is normalized by realtimeManager, but handle both
            const eventData = payload?.payload || payload;
            const targetOrgId = eventData?.organization_id;
            
            console.log('🔍 Checking force-notification-refresh:', {
              targetOrgId,
              myOrgId: profile.organization_id,
              match: targetOrgId === profile.organization_id
            });
            
            if (!targetOrgId) {
              console.log('⚠️ Missing targetOrgId in payload; fetching to be safe');
              debouncedFetchAll();
            } else if (targetOrgId === profile.organization_id) {
              console.log('✅ force-notification-refresh for our org, fetching...');
              debouncedFetchAll();
            } else {
              console.log('⏭️ force-notification-refresh for different org, ignoring');
            }
          } else if (event === 'match-state-updated') {
            debouncedFetchAll();
          }
        });
      } catch (error) {
        if (DEBUG_NOTIFICATIONS) console.error('❌ Failed to subscribe to realtime manager:', error);
      }
    };

    initRealtimeSubscription();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (realtimeManagerSubscription) {
        realtimeManagerSubscription();
      }
    };
  }, [user?.id, profile?.organization_id]);

  // Realtime: org-scoped postgres_changes listener only
  useEffect(() => {
    if (!user || !profile?.organization_id || profile.organization_id === 'undefined') return;
    
    let debounceTimer = null;
    const debouncedFetchAll = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('🔔 Fetching notifications after database change');
        fetchAll();
      }, 500);
    };
    
    // Multi-listener approach for cross-session notification delivery
    const channel = supabase
      .channel('global-notifications-broadcast')
      // Listener 1: notifications INSERT (for new notifications)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          console.log('🔔 notifications INSERT received:', payload.new);
          if (payload.new?.organization_id === profile.organization_id) {
            console.log('✅ INSERT for our org, fetching...');
            debouncedFetchAll();
          }
        }
      )
      // Listener 2: notifications UPDATE (for consolidation/status changes)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          console.log('🔔 notifications UPDATE received:', payload.new);
          if (payload.new?.organization_id === profile.organization_id) {
            console.log('✅ UPDATE for our org, fetching...');
            debouncedFetchAll();
          }
        }
      )
      // Listener 3: match_requests UPDATE (for routed-to / shared-with events)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'match_requests'
        },
        (payload) => {
          console.log('🔔 match_requests UPDATE received:', payload.new);
          const isRoutedTo = payload.new?.routed_to_org_id === profile.organization_id;
          const isSharedWith = payload.new?.shared_with_org_id === profile.organization_id;
          
          if (isRoutedTo || isSharedWith) {
            console.log(`✅ match_requests UPDATE - ${isRoutedTo ? 'routed-to' : 'shared-with'} our org, fetching...`);
            debouncedFetchAll();
          }
        }
      )
      // Listener 4: match_measurements UPDATE (for state changes that trigger notifications)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'match_measurements'
        },
        (payload) => {
          console.log('🔔 match_measurements UPDATE received:', payload.new);
          // Debounced refresh to handle any measurement state changes
          debouncedFetchAll();
        }
      )
      .subscribe((status) => {
        console.log(`📡 Notifications channel status: ${status}`);
        
        // On successful subscription, fetch immediately to catch any missed events
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscribed - fetching current notifications...');
          fetchAll();
        }
      });

    return () => {
      console.log('🧹 Cleaning up postgres notifications subscription');
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.organization_id]);


  // ============================================================================
  // PHASE 3: Consolidate notifications (with feature flag)
  // ============================================================================
  
  const consolidatedNotifications = useMemo(() => {
    if (USE_NEW_CONSOLIDATION) {
      console.log('[Consolidation] ✅ Using NEW self-describing consolidation');
      return consolidateNotificationsNew(notifications);
    } else {
      console.log('[Consolidation] ⏭️ Using LEGACY consolidation with color caches');
      const colorCaches = {
        byMatchRequest: colorsByMatchRequest,
        byJobId: colorsByJobId,
        byRoutedJobId: colorsByRoutedJobId
      };
      return consolidateNotifications(notifications, colorCaches);
    }
  }, [notifications, colorsByMatchRequest, colorsByJobId, colorsByRoutedJobId]);
  
  /**
   * NEW: Simple consolidation using self-describing metadata
   */
  function consolidateNotificationsNew(notifications) {
    if (!notifications || notifications.length === 0) return [];
    
    // Group by entity
    const grouped = notifications.reduce((acc, notification) => {
      const key = getEntityKey(notification);
      if (!acc[key]) acc[key] = [];
      acc[key].push(notification);
      return acc;
    }, {});
    
    // Consolidate each group
    return Object.values(grouped)
      .map(group => {
        // Sort by priority and time
        const sorted = group.sort((a, b) => {
          const priorityDiff = getStatePriority(b) - getStatePriority(a);
          if (priorityDiff !== 0) return priorityDiff;
          return new Date(b.created_at) - new Date(a.created_at);
        });
        
        const primary = sorted[0];
        
        // Colors are already in metadata - just use them!
        return {
          ...primary,
          consolidatedCount: group.length,
          consolidatedFrom: group.map(n => n.id),
          colors: primary.metadata?.colors || [] // NEW: Direct from metadata
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  // Filter out dismissed (read) notifications from consolidated results
  const visibleNotifications = useMemo(() => {
    const visible = consolidatedNotifications.filter(n => {
      // Check if ALL of the original notifications were read (only hide if fully read)
      const originalIds = n.consolidatedFrom || [n.id];
      return !originalIds.every(id => reads.has(id));
    });
    
    // Debug logging
    if (DEBUG_NOTIFICATIONS) {
      console.log('[NotificationsContext] Debug:', {
        totalNotifications: notifications.length,
        consolidatedCount: consolidatedNotifications.length,
        visibleCount: visible.length,
        readsSetSize: reads.size,
        sampleConsolidated: consolidatedNotifications[0],
        sampleVisible: visible[0]
      });
    }
    
    return visible;
  }, [consolidatedNotifications, reads, notifications.length]);

  const unreadCount = useMemo(() => {
    return visibleNotifications.length;
  }, [visibleNotifications]);


  const markAsRead = async (ids) => {
    if (!user || !ids?.length) return;
    
    const rows = ids.map(id => ({ 
      notification_id: id, 
      user_id: user.id, 
      read_at: new Date().toISOString() 
    }));
    
    try {
      await supabase.from('notification_reads').upsert(rows, { 
        onConflict: 'notification_id,user_id' 
      });
      
      // Immediate optimistic update - this makes the bubble update instantly
      setReads(prev => new Set([...prev, ...ids]));
    } catch (error) {
      console.error('❌ Error marking notifications as read:', error);
      // Revert optimistic update on error
      setReads(prev => {
        const newReads = new Set(prev);
        ids.forEach(id => newReads.delete(id));
        return newReads;
      });
    }
  };

  const dismiss = async (idOrIds) => markAsRead(Array.isArray(idOrIds) ? idOrIds : [idOrIds]);

  // Cache colors for match requests that don't have them in metadata
  const fetchColorsForMatchRequests = async (notifications) => {
    // A) By match_request_id (existing)
    const matchRequestIds = notifications
      .filter(n => n.metadata?.match_request_id && (!n.metadata?.colors || n.metadata.colors.length === 0))
      .map(n => n.metadata.match_request_id)
      .filter((id, index, arr) => arr.indexOf(id) === index);

    // B) By job_id for any notifications that include a job reference (broadened)
    const jobIds = notifications
      .filter(n => n.metadata?.job_id)
      .map(n => n.metadata.job_id)
      .filter((id, index, arr) => arr.indexOf(id) === index);

    if (matchRequestIds.length === 0 && jobIds.length === 0) return;

    

    try {
      // 1) Resolve job_ids -> match_request_ids (for routed jobs)
      let jobIdToRequestIds = new Map();
      if (jobIds.length > 0) {
        const { data: jobRequests, error: jobReqErr } = await supabase
          .from('match_requests')
          .select('id, job_id')
          .in('job_id', jobIds);
        if (jobReqErr) {
          if (DEBUG_NOTIFICATIONS) console.error('Error fetching match_requests by job_id:', jobReqErr);
        } else {
          jobRequests?.forEach(r => {
            const arr = jobIdToRequestIds.get(r.job_id) || [];
            arr.push(r.id);
            jobIdToRequestIds.set(r.job_id, arr);
          });
        }
      }

      // Combine all match_request_ids to fetch measurements once
      const allRequestIds = [
        ...matchRequestIds,
        ...Array.from(jobIdToRequestIds.values()).flat()
      ];

      if (allRequestIds.length === 0) return;

      // Build caches
      const newByRequest = new Map(colorsByMatchRequest);
      const newByJob = new Map(colorsByJobId);
      const newRoutedByJob = new Map(colorsByRoutedJobId);
      // Temporary map to aggregate routed-only colors by match_request
      const routedByRequest = new Map();

      // 1) Fetch routed measurement colors (existing path)
      const { data: measurements, error } = await supabase
        .from('match_measurements')
        .select(`
          match_request_id,
          colors:color_id (
            id,
            name,
            hex,
            lab_l,
            lab_a,
            lab_b
          )
        `)
        .in('match_request_id', allRequestIds)
        .eq('is_routed', true);

      if (error) {
        if (DEBUG_NOTIFICATIONS) console.error('Error fetching match measurements colors:', error);
      } else {
        measurements?.forEach(m => {
          if (!m.colors || !m.match_request_id) return;

          // Normalize color and stamp routed flag
          const colorObj = { ...m.colors, is_routed: true };

          // By match_request_id (all routed measurement colors)
          const existingReq = newByRequest.get(m.match_request_id) || [];
          if (!existingReq.find(c => c.id === colorObj.id)) existingReq.push(colorObj);
          newByRequest.set(m.match_request_id, existingReq);

          // Track routed-only colors per request for later job aggregation
          const routedArr = routedByRequest.get(m.match_request_id) || [];
          if (!routedArr.find(c => c.id === colorObj.id)) routedArr.push(colorObj);
          routedByRequest.set(m.match_request_id, routedArr);
        });
      }

      // 2) Pre-filter accessible match_request_ids to avoid authorization errors
      const { data: accessibleRequests, error: accessError } = await supabase
        .from('match_requests')
        .select('id')
        .in('id', allRequestIds);

      const accessibleRequestIds = accessibleRequests?.map(r => r.id) || [];
      
      if (accessError) {
        if (DEBUG_NOTIFICATIONS) console.error('Error checking accessible match requests:', accessError);
      }

      // Skip color fetching on initial dashboard load to prevent blocking
      if (accessibleRequestIds.length === 0) {
        if (DEBUG_NOTIFICATIONS) console.log('🔍 No accessible requests found, skipping color fetching');
        return { byRequest: newByRequest, byId: {} };
      }

      // Add timeout protection for notification color fetching
      const timeoutMs = 1200;
      const colorFetchPromise = Promise.all(
        accessibleRequestIds.map(id => supabase.rpc('get_match_request_colors', { p_match_request_id: id }))
      );
      const timeoutPromise = new Promise((resolve) => 
        setTimeout(() => {
          if (DEBUG_NOTIFICATIONS) console.warn('🚨 Notification color fetch timed out, using partial data');
          resolve([]); // Return empty array instead of rejecting
        }, timeoutMs)
      );

      const rpcResults = await Promise.race([colorFetchPromise, timeoutPromise]) || [];

      rpcResults.forEach((res, idx) => {
        const reqId = accessibleRequestIds[idx];
        if (!res || res.error) {
          // Handle timeout or RPC errors gracefully
          if (res?.error) {
            if (DEBUG_NOTIFICATIONS) console.error('RPC error for request:', { reqId, error: res.error });
          }
          return;
        }
        const rpcColors = Array.isArray(res.data) ? res.data : (res.data?.colors || []);
        (rpcColors || []).forEach(c => {
          const existingReq = newByRequest.get(reqId) || [];
          const colorId = c.id || c.color_id || c.hex;
          if (!colorId) return;
          if (!existingReq.find(ec => ec.id === colorId)) {
            existingReq.push({
              id: colorId,
              name: c.name || c.color_name || c.hex || 'Unnamed Color',
              hex: c.hex || c.color_hex || '#000000',
              lab_l: c.lab_l, lab_a: c.lab_a, lab_b: c.lab_b,
              is_routed: false
            });
          }
          newByRequest.set(reqId, existingReq);
        });
      });

      // 3) Populate job_id cache by aggregating request colors
      for (const [jobId, reqIds] of jobIdToRequestIds.entries()) {
        const existingJob = newByJob.get(jobId) || [];
        const existingRoutedJob = newRoutedByJob.get(jobId) || [];
        reqIds.forEach(rid => {
          const reqColors = newByRequest.get(rid) || [];
          reqColors.forEach(col => {
            if (!existingJob.find(c => c.id === col.id)) existingJob.push(col);
          });
          const routedReqColors = routedByRequest.get(rid) || [];
          routedReqColors.forEach(col => {
            if (!existingRoutedJob.find(c => c.id === col.id)) existingRoutedJob.push(col);
          });
        });
        newByJob.set(jobId, existingJob);
        if (existingRoutedJob.length > 0) newRoutedByJob.set(jobId, existingRoutedJob);
      }


      setColorsByMatchRequest(newByRequest);
      setColorsByJobId(newByJob);
      setColorsByRoutedJobId(newRoutedByJob);
    } catch (error) {
      if (DEBUG_NOTIFICATIONS) console.error('Error in fetchColorsForMatchRequests:', error);
    }
  };

  // Enrich color_id from measurement_id for notifications missing color_id
  const enrichColorIdsFromMeasurements = async (notifications) => {
    const items = (notifications || []).filter(n => {
      const md = n?.metadata || {};
      return !md.color_id && (md.measurement_id || md.match_measurement_id || md.measure_id);
    });
    if (items.length === 0) return;
    const ids = [...new Set(items.map(n => n.metadata.measurement_id || n.metadata.match_measurement_id || n.metadata.measure_id).filter(Boolean))];
    try {
      const { data, error } = await supabase
        .from('match_measurements')
        .select('id, color_id, match_request_id')
        .in('id', ids);
      if (error) {
        if (DEBUG_NOTIFICATIONS) console.error('Error fetching color_ids by measurements:', error);
        return;
      }
      const byId = new Map((data || []).map(row => [row.id, { color_id: row.color_id, match_request_id: row.match_request_id }]));
      items.forEach(n => {
        const md = n.metadata || {};
        const mid = md.measurement_id || md.match_measurement_id || md.measure_id;
        const row = byId.get(mid);
        if (row?.color_id && !md.color_id) {
          n.metadata = { ...md, color_id: row.color_id };
        }
      });
      
    } catch (e) {
      if (DEBUG_NOTIFICATIONS) console.error('Error enriching color_id from measurement:', e);
    }
  };

  // Enrich match_update and approval notifications with organization data
  const enrichMatchUpdateNotifications = async (notifications) => {
    const enrichableNotifications = notifications.filter(n => 
      [
        'match_update', 
        'match_approved', 
        'sent-to-shared-with-for-approval', 
        'sent-to-requestor-for-approval', 
        'match_request', 
        'job_routed',
        'approved-by-requestor',
        'approved-by-shared-with',
        'approved-by-routed-to',
        'rejected-by-requestor',
        'rejected-by-shared-with',
        'rejected-by-routed-to'
      ].includes(n.type) && 
      n.metadata?.match_request_id
    );
    
    if (enrichableNotifications.length === 0) return;

    const matchRequestIds = [...new Set(enrichableNotifications.map(n => n.metadata.match_request_id))];
    
    

    try {
      // Get organization info from match_requests table
      const { data: matchRequests, error } = await supabase
        .from('match_requests')
        .select(`
          id,
          job_id,
          organization_id,
          shared_with_org_id,
          routed_to_org_id,
          organizations:organization_id (name),
          shared_with_orgs:shared_with_org_id (name),
          routed_to_orgs:routed_to_org_id (name)
        `)
        .in('id', matchRequestIds);

      if (error) {
        if (DEBUG_NOTIFICATIONS) console.error('Error fetching match request details:', error);
        return;
      }

      // Build organization mapping
      const orgInfoMap = new Map();
      matchRequests?.forEach(mr => {
        orgInfoMap.set(mr.id, {
          job_id: mr.job_id,
          requestor_org_name: mr.organizations?.name,
          shared_with_org_name: mr.shared_with_orgs?.name,
          routed_to_org_name: mr.routed_to_orgs?.name
        });
      });

      // Update notifications with enriched data + fetch colors for routed notifications
      enrichableNotifications.forEach(notification => {
        const orgInfo = orgInfoMap.get(notification.metadata.match_request_id);
        if (orgInfo) {
          // Determine the actor organization based on receiver_role
          let actorOrgName = 'A partner';
          
          if (notification.metadata.receiver_role === 'requestor') {
            // If requestor is receiving, either shared-with or routed-to is the actor
            actorOrgName = orgInfo.shared_with_org_name || orgInfo.routed_to_org_name || 'A partner';
          } else if (notification.metadata.receiver_role === 'shared-with') {
            // If shared-with is receiving, requestor is likely the actor
            actorOrgName = orgInfo.requestor_org_name || 'A partner';
          } else if (notification.metadata.receiver_role === 'routed-to') {
            // If routed-to is receiving, shared-with is likely the actor
            actorOrgName = orgInfo.shared_with_org_name || 'A partner';
          }

          // Enrich the notification metadata
          notification.metadata = {
            ...notification.metadata,
            actor_org_name: actorOrgName,
            job_id: orgInfo.job_id,
            requestor_org_name: orgInfo.requestor_org_name,
            shared_with_org_name: orgInfo.shared_with_org_name,
            routed_to_org_name: orgInfo.routed_to_org_name
          };
        }
      });

      // Colors will be resolved from caches in getColorsForConsolidatedNotification
      // after enrichColorIdsFromMeasurements populates the specific color_id

      
    } catch (error) {
      if (DEBUG_NOTIFICATIONS) console.error('Error enriching match_update notifications:', error);
    }
  };


  // Enrich job routed notifications (ensure shared-with org appears as actor for routed-to recipients)
  const enrichJobRoutedNotifications = async (notifications) => {
    const enrichable = (notifications || []).filter(n =>
      (
        n.type === 'job_routed' ||
        n.type === 'job_new' ||
        (n.type && n.type.startsWith('job_status_')) ||
        n.metadata?.receiver_role === 'routed-to'
      ) &&
      !!n.metadata?.job_id
    );
    if (enrichable.length === 0) return;

    const jobIds = [...new Set(enrichable.map(n => n.metadata.job_id).filter(Boolean))];
    try {
      const { data: matchRequests, error } = await supabase
        .from('match_requests')
        .select(`
          id,
          job_id,
          organization_id,
          shared_with_org_id,
          routed_to_org_id,
          organizations:organization_id (name),
          shared_with_orgs:shared_with_org_id (name),
          routed_to_orgs:routed_to_org_id (name)
        `)
        .in('job_id', jobIds);

      if (error) {
        if (DEBUG_NOTIFICATIONS) console.error('Error fetching match requests for job routed enrichment:', error);
        return;
      }

    const byJob = new Map();
    (matchRequests || []).forEach(mr => {
      byJob.set(String(mr.job_id), {
        requestor_org_name: mr.organizations?.name,
        shared_with_org_name: mr.shared_with_orgs?.name,
        routed_to_org_name: mr.routed_to_orgs?.name
      });
    });

    enrichable.forEach(n => {
      const info = byJob.get(String(n.metadata.job_id));
        if (!info) return;

        // For job status updates, actor should be the organization the job was sent to
        let actorOrgName;
        if (n.type && n.type.startsWith('job_status_')) {
          const dest = info.shared_with_org_name || info.routed_to_org_name;
          actorOrgName = dest || n.metadata.actor_org_name || 'A partner';
        } else {
          // For routed-to receivers, actor is the shared-with org that routed the job
          actorOrgName = (n.metadata?.receiver_role === 'routed-to')
            ? (info.shared_with_org_name || info.requestor_org_name || n.metadata.actor_org_name || 'A partner')
            : (n.metadata.actor_org_name || info.requestor_org_name || info.shared_with_org_name || 'A partner');
        }

        n.metadata = {
          ...n.metadata,
          actor_org_name: actorOrgName,
          requestor_org_name: info.requestor_org_name,
          shared_with_org_name: info.shared_with_org_name,
          routed_to_org_name: info.routed_to_org_name
        };
      });

      
    } catch (e) {
      if (DEBUG_NOTIFICATIONS) console.error('Error enriching job_routed notifications:', e);
    }
  };

  // Helper function to check if user is admin
  const isAdmin = (role) => role === 'Admin' || role === 'Superadmin';

  const iconsByType = {
    match_request: Briefcase,
    match_measurement: Bell,
    match_sent_for_approval: Palette,
    'sent-to-shared-with-for-approval': Palette,
    'sent-to-requestor-for-approval': Palette,
    match_routed: Briefcase,
    match_rejected: AlertTriangle,
    match_approved: Palette,
    'approved-by-requestor': CheckCircle2,
    'approved-by-shared-with': CheckCircle2,
    'approved-by-routed-to': CheckCircle2,
    'rejected-by-requestor': AlertTriangle,
    'rejected-by-shared-with': AlertTriangle,
    'rejected-by-routed-to': AlertTriangle,
    job_new: Briefcase,
    job_routed: Briefcase,  // Add missing mapping for routed jobs
    job_status_new: Briefcase,
    job_status_routed: Briefcase,
    job_status_working: Briefcase,
    job_status_pending_approval: Briefcase,
    job_status_completed: Briefcase,
    job_status_approved: Briefcase,
    job_status_rejected: Briefcase,
    job_status_overdue: Briefcase,
    color_approved: CheckCircle,
    color_rejected: AlertTriangle,
    color_shared: Palette,
    color_updated: Palette,
    partner_invite: UserPlus,
    partner_status: Info,
    partner_share_update: Palette,
    match_update: Bell,
    default: Bell
  };

  const getIconColor = (type, status) => {
    // Color coding based on notification type and status
    if (type?.startsWith('job_status_')) {
      switch (status) {
        case 'completed':
        case 'approved':
          return 'text-green-600';
        case 'working':
        case 'pending_approval':
          return 'text-blue-600';
        case 'rejected':
          return 'text-red-600';
        default:
          return 'text-blue-600';
      }
    }
    
    switch (type) {
      case 'match_request':
      case 'match_measurement':
      case 'match_sent_for_approval':
      case 'sent-to-shared-with-for-approval':
      case 'sent-to-requestor-for-approval':
        return 'text-blue-600';
      case 'match_routed':
        return 'text-orange-600';
      case 'match_rejected':
        return 'text-red-600';
      case 'match_approved':
        return 'text-green-600';
      case 'approved-by-requestor':
      case 'approved-by-shared-with':
      case 'approved-by-routed-to':
        return 'text-green-600';
      case 'rejected-by-requestor':
      case 'rejected-by-shared-with':
      case 'rejected-by-routed-to':
        return 'text-red-600';
      case 'color_approved':
        return 'text-green-600';
      case 'color_rejected':
        return 'text-red-600';
      case 'partner_invite':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  // Build a plain object cache keyed by match_request_id to avoid Map issues in JSX
  const colorCaches = useMemo(() => {
    const obj = {};
    try {
      if (colorsByMatchRequest && typeof colorsByMatchRequest.forEach === 'function') {
        colorsByMatchRequest.forEach((arr, id) => { obj[id] = arr; });
      } else if (colorsByMatchRequest?.entries) {
        for (const [id, arr] of colorsByMatchRequest.entries()) {
          obj[id] = arr;
        }
      }
    } catch (e) {
      if (DEBUG_NOTIFICATIONS) console.warn('colorCaches build failed, falling back to empty object', e);
    }
    return obj;
  }, [colorsByMatchRequest]);

  // Robust helper functions for cache lookups (handles string/number key variations)
  const getFromMap = (map, key) => {
    if (!map || key == null) return null;
    // Map support
    if (map.has && map.has(key)) return map.get(key);
    if (map.has && map.has(String(key))) return map.get(String(key));
    const numKey = Number(key);
    if (map.has && !isNaN(numKey) && map.has(numKey)) return map.get(numKey);
    // Plain object support
    if (typeof map === 'object') {
      if (key in map) return map[key];
      if (String(key) in map) return map[String(key)];
      if (!isNaN(numKey) && numKey in map) return map[numKey];
    }
    return null;
  };

  const hasInMap = (map, key) => {
    if (!map || key == null) return false;
    if (map.has) return map.has(key) || map.has(String(key)) || (!isNaN(Number(key)) && map.has(Number(key)));
    if (typeof map === 'object') return (key in map) || (String(key) in map) || (!isNaN(Number(key)) && (Number(key) in map));
    return false;
  };

  // Enhanced colors getter with fallback to cached colors (routed-aware)
  const getColorsForConsolidatedNotification = (notification) => {
    const metadata = notification.metadata || {};

    // PRIORITY 0: Early return for specific color_id lookups to prevent cross-color contamination
    if (metadata.color_id) {
      
      
      // Search in metadata arrays first
      if (Array.isArray(metadata.colors)) {
        const found = metadata.colors.find(c => (c.id || c.color_id) === metadata.color_id);
        if (found) {
          
          return [found];
        }
      }
      if (Array.isArray(metadata.routed_colors)) {
        const found = metadata.routed_colors.find(c => (c.id || c.color_id) === metadata.color_id);
        if (found) {
          
          return [found];
        }
      }
      
      // Search in caches using local helpers
      if (metadata.match_request_id && hasInMap(colorsByMatchRequest, metadata.match_request_id)) {
        const matchColors = getFromMap(colorsByMatchRequest, metadata.match_request_id) || [];
        const found = matchColors.find(c => (c.id || c.color_id) === metadata.color_id);
        if (found) {
          
          return [found];
        }
      }
      if (metadata.job_id && hasInMap(colorsByJobId, metadata.job_id)) {
        const jobColors = getFromMap(colorsByJobId, metadata.job_id) || [];
        const found = jobColors.find(c => (c.id || c.color_id) === metadata.color_id);
        if (found) {
          
          return [found];
        }
      }
      
      
    }

    // Local fallback helpers to avoid ReferenceError in any bundling scenario
    const _getFromMap = (map, key) => {
      if (!map || key == null) return null;
      if (map.has && map.has(key)) return map.get(key);
      if (map.has && map.has(String(key))) return map.get(String(key));
      const numKey = Number(key);
      if (map.has && !isNaN(numKey) && map.has(numKey)) return map.get(numKey);
      if (typeof map === 'object') {
        if (key in map) return map[key];
        if (String(key) in map) return map[String(key)];
        if (!isNaN(numKey) && numKey in map) return map[numKey];
      }
      return null;
    };
    const _hasInMap = (map, key) => {
      if (!map || key == null) return false;
      if (map.has) return map.has(key) || map.has(String(key)) || (!isNaN(Number(key)) && map.has(Number(key)));
      if (typeof map === 'object') return (key in map) || (String(key) in map) || (!isNaN(Number(key)) && (Number(key) in map));
      return false;
    };
    
    // Check if THIS SPECIFIC notification is about routing
    // DO NOT check job-level or match-level caches - each notification is immutable
    const hasRoutedInMetadataColors = Array.isArray(metadata.colors) && metadata.colors.some(c => c?.is_routed === true);

    const isApprovalType = notification.type === 'sent-to-shared-with-for-approval' || notification.type === 'sent-to-requestor-for-approval';

    // CRITICAL: Only use notification-specific indicators, never cross-notification caches
    const isRoutedContext = Boolean(
      isApprovalType ||
      notification.type === 'job_routed' ||  // Explicit routed notification type
      notification.type === 'match_routed' ||  // Explicit routed notification type
      metadata.receiver_role?.toLowerCase() === 'routed-to' ||  // Explicit receiver role
      metadata.is_routed === true ||  // Explicit routed flag
      metadata.action === 'routed_to' ||  // Explicit action
      hasRoutedInMetadataColors  // Colors in THIS notification have routed flags
    );
    
    
    // Priority 1: For job_routed notifications, always use metadata.colors directly (no complex lookups needed)
    if (notification.type === 'job_routed' && Array.isArray(metadata.colors) && metadata.colors.length > 0) {
      
      return metadata.colors;
    }
    
    // Priority 2: routed_colors from metadata (for other routed notifications)
    if (Array.isArray(metadata.routed_colors) && metadata.routed_colors.length > 0) {
      
      return metadata.routed_colors;
    }
    
    // Priority 3: metadata.colors (return as-is, don't merge from caches)
    if (Array.isArray(metadata.colors) && metadata.colors.length > 0) {
      // Each notification is immutable - return exactly what was stored at creation time
      return metadata.colors;
    }
    
    // Priority 3: For routed context, try byRoutedJobId first (using robust lookup)
    if (isRoutedContext && metadata.job_id && _hasInMap(colorsByRoutedJobId, metadata.job_id)) {
      const routedColors = _getFromMap(colorsByRoutedJobId, metadata.job_id);
      if (routedColors && Array.isArray(routedColors) && routedColors.length > 0) {
        
        return routedColors;
      }
    }
    
    // Priority 4: Fallback to match request colors (using robust lookup)
    if (metadata.match_request_id && _hasInMap(colorsByMatchRequest, metadata.match_request_id)) {
      const matchColors = _getFromMap(colorsByMatchRequest, metadata.match_request_id) || [];
      if (isRoutedContext) {
        // Filter for routed colors only
        const routedMatchColors = matchColors.filter(color => color?.is_routed === true);
        if (routedMatchColors.length > 0) {
          
          return routedMatchColors;
        }
        
        // CRITICAL FIX: In routed context with no routed colors, return empty array
        
        return [];
      }
      
      return matchColors;
    }
    
    // Priority 5: Try job cache (non-routed) using robust lookup
    if (metadata.job_id && _hasInMap(colorsByJobId, metadata.job_id)) {
      const jobColors = _getFromMap(colorsByJobId, metadata.job_id) || [];
      if (isRoutedContext) {
        // In routed context, only show colors marked as routed
        const routedJobColors = jobColors.filter(color => color?.is_routed === true);
        if (routedJobColors.length > 0) {
          
          return routedJobColors;
        }
        
        return [];
      }
      
      return jobColors;
    }
    
    
    return [];
  };

  // Process consolidated notifications for dashboard display - without data fetching side effects
  // Resolve organization name from ID with fallback to stored name
  const resolveOrgName = (orgId, fallbackName) => {
    if (!orgId) {
      console.log('⚠️ resolveOrgName: no orgId provided, using fallback:', fallbackName);
      return fallbackName || 'Unknown Organization';
    }
    const resolved = orgCache[orgId] || fallbackName || 'Unknown Organization';
    console.log('🔍 resolveOrgName:', { orgId, fallbackName, resolved, cacheHas: !!orgCache[orgId] });
    return resolved;
  };

  const processedNotifications = useMemo(() => {
    const processed = visibleNotifications.map(n => {
      const meta = n?.metadata || {};
      const type = n?.type || '';
      const status = meta.status;

      // SIMPLIFIED: No complex actor resolution - trust database values
      // Enhanced color resolution (UNCHANGED - keeps working)
      const resolvedColors = getColorsForConsolidatedNotification(n);
      
      return {
        id: n.id,
        created_at: n.created_at,
        // Use database title and message directly (already formatted by trigger)
        title: n.title || 'Notification',
        description: n.message || '',
        message: n.message || '', // Alias for components that use 'message'
        time: n?.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : '',
        type,
        metadata: meta, // Pass through as-is (no complex manipulation)
        icon: meta.receiver_role === 'routed-to' ? Briefcase : (iconsByType[type] || Bell),
        iconColor: getIconColor(type, status),
        onDismiss: () => dismiss(n.id),
        _raw: n,
        
        // Enhanced display properties with resolved colors (UNCHANGED)
        jobId: meta.job_id || meta.match_request_id,
        colorCount: resolvedColors.length || meta.color_count || 0,
        colors: resolvedColors, // ✅ Color enrichment still works!
        status,
        notificationCategory: (type.startsWith('job_') || type.startsWith('job_status_') || type === 'match_request' || type === 'match_update' || type === 'match_measurement') ? 'job' : 
                             (type.startsWith('color_') || type === 'partner_share_update') ? 'color' : 'general',
        
        // Consolidation metadata (UNCHANGED)
        entityKey: n.entityKey,
        originalCount: n.originalCount,
        consolidatedFrom: n.consolidatedFrom
      };
    });

    return processed;
  }, [visibleNotifications, dismiss, orgCache]);

  const value = {
    notifications: visibleNotifications,
    processedNotifications,
    unreadCount,
    markAsRead,
    dismiss,
    refresh: fetchAll,
    loading,
    getColorsForNotification: getColorsForConsolidatedNotification,
    orgCache,
    resolveOrgName
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotificationsContext = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    // Return safe defaults instead of throwing error - prevents crashes
    if (DEBUG_NOTIFICATIONS) console.warn('useNotificationsContext called outside provider, returning defaults');
    return {
      notifications: [],
      processedNotifications: [],
      unreadCount: 0,
      markAsRead: () => {},
      dismiss: () => {},
      refresh: () => {},
      loading: false,
      getColorsForNotification: () => []
    };
  }
  return context;
};