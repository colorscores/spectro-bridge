import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export const useActivityData = () => {
  const [activities, setActivities] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingRemaining, setLoadingRemaining] = React.useState(false);
  const [error, setError] = React.useState(null);

  const formatActivityDate = (date) => {
    if (!date) return 'Unknown';
    return format(new Date(date), 'MMM dd, yyyy h:mm a');
  };

  // Helper function to fetch and process activities with configurable limits
  const fetchActivityDataWithLimits = React.useCallback(async (limits = {}) => {
    const allActivities = [];
    const {
      matchRequestsLimit = 50,
      partnersLimit = 30,
      colorsLimit = 40,
      notificationsLimit = 50
    } = limits;

      // Get current user's organization context with timeout
      const { data: { user }, error: userError } = await Promise.race([
        supabase.auth.getUser(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth timeout')), 3000)
        )
      ]);

      if (userError || !user) {
        console.log('useActivityData: No user or auth error, skipping activity fetch');
        setActivities([]);
        return;
      }

      const { data: currentProfile, error: profileError } = await Promise.race([
        supabase
          .from('profiles')
          .select('organization_id, organization:organizations(name)')
          .eq('id', user.id)
          .maybeSingle(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile timeout')), 3000)
        )
      ]);

      if (profileError || !currentProfile?.organization_id) {
        console.log('useActivityData: No profile or organization, skipping activity fetch');
        setActivities([]);
        return;
      }

      const userOrgId = currentProfile.organization_id;
      const userOrgName = currentProfile.organization?.name;

    // 1. Fetch Match Request activities with enhanced user data
    const { data: matchRequests } = await supabase
      .from('match_requests')
      .select(`
        *,
        organization:organizations!match_requests_organization_id_fkey(name),
        measurements:match_measurements(id, status, created_at, updated_at, matched_by_name)
      `)
      .order('created_at', { ascending: false })
      .limit(matchRequestsLimit);

      if (matchRequests) {
        matchRequests.forEach(request => {
          const isCreatedByUserOrg = request.organization_id === userOrgId;
          const isSharedWithUserOrg = request.shared_with === userOrgName;
          
          // Only show match requests relevant to current user's organization
          if (!isCreatedByUserOrg && !isSharedWithUserOrg) return;

          // Match request activity - show different text based on perspective
          if (isCreatedByUserOrg) {
            allActivities.push({
              id: `mr-created-${request.id}`,
              activity: 'Match Request Created',
              user: `${request.organization?.name || 'Unknown'} Team`,
              company: request.organization?.name || 'Unknown',
              receiver: request.shared_with || '-',
              date: formatActivityDate(request.created_at),
              details: `Job ${request.job_id}`,
              type: 'match_request',
              metadata: { matchRequestId: request.id }
            });
          }
          
          if (isSharedWithUserOrg && !isCreatedByUserOrg) {
            allActivities.push({
              id: `mr-received-${request.id}`,
              activity: 'Match Request Received',
              user: `${request.organization?.name || 'Unknown'} Team`,
              company: request.organization?.name || 'Unknown',
              receiver: userOrgName || '-',
              date: formatActivityDate(request.created_at),
              details: `Job ${request.job_id}`,
              type: 'match_request',
              metadata: { matchRequestId: request.id }
            });
          }

          // Match measurements status updates - show for both organizations involved
          if (request.measurements && (isCreatedByUserOrg || isSharedWithUserOrg)) {
            request.measurements.forEach(measurement => {
              if (measurement.status && measurement.status !== 'New') {
                allActivities.push({
                  id: `mm-${measurement.id}-${measurement.updated_at}`,
                  activity: `Match Measurement ${measurement.status}`,
                  user: measurement.matched_by_name || `${request.organization?.name || 'Unknown'} Team`,
                  company: request.organization?.name || 'Unknown',
                  receiver: request.shared_with || '-',
                  date: formatActivityDate(measurement.updated_at),
                  details: `Job ${request.job_id}`,
                  type: 'match_measurement',
                  metadata: { matchRequestId: request.id, measurementId: measurement.id }
                });
              }
            });
          }
        });
      }

    // 2. Fetch Partner activities - only for current user's organization
    const { data: partners } = await supabase
      .from('partners')
      .select(`
        *,
        organization:organizations!partners_organization_id_fkey(name),
        partner_org:organizations!partners_partner_organization_id_fkey(name)
      `)
      .or(`organization_id.eq.${userOrgId},partner_organization_id.eq.${userOrgId}`)
      .order('created_at', { ascending: false })
      .limit(partnersLimit);

      if (partners) {
        partners.forEach(partner => {
          allActivities.push({
            id: `p-${partner.id}`,
            activity: `Partner Connection ${partner.status}`,
            user: `${partner.organization?.name || 'Unknown'} Team`,
            company: partner.organization?.name || 'Unknown',
            receiver: `${partner.partner_org?.name || 'Unknown'}, ${partner.partner_location || 'Unknown Location'}`,
            date: formatActivityDate(partner.created_at),
            details: `Status: ${partner.status}`,
            type: 'partner',
            metadata: { partnerId: partner.id }
          });
        });
      }

    // 3. Fetch Color activities (recent additions) - only for current user's organization
    const { data: colors } = await supabase
      .from('colors')
      .select(`
        *,
        organization:organizations!colors_organization_id_fkey(name),
        creator:profiles!colors_created_by_fkey(full_name)
      `)
      .eq('organization_id', userOrgId)
      .order('created_at', { ascending: false })
      .limit(colorsLimit);

      if (colors) {
        colors.forEach(color => {
          allActivities.push({
            id: `c-${color.id}`,
            activity: 'Color Added',
            user: color.creator?.full_name || `${color.organization?.name || 'Unknown'} Team`,
            company: color.organization?.name || 'Unknown',
            receiver: '-',
            date: formatActivityDate(color.created_at),
            details: color.name,
            type: 'color',
            metadata: { colorId: color.id }
          });
        });
      }

    // 4. Fetch Recent Notifications for system events - only for current user's organization
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('organization_id', userOrgId)
      .order('created_at', { ascending: false })
      .limit(notificationsLimit);

      if (notifications) {
        notifications.forEach(notification => {
          // Show match request status updates (e.g., Sent, Saved, Approved, Rejected)
          if (notification.type === 'match_update') {
            const status = notification.metadata?.status || notification.title?.replace('Match Request ', '') || 'Updated';
            allActivities.push({
              id: `n-${notification.id}`,
              activity: `Match Request ${status}`,
              user: notification.metadata?.owner_org_name || notification.title || 'System Team',
              company: notification.metadata?.owner_org_name || 'System',
              receiver: notification.metadata?.printer_org_name || '-',
              date: formatActivityDate(notification.created_at),
              details: notification.metadata?.job_id ? `Job ${notification.metadata.job_id}` : notification.message,
              type: 'match_request_status',
              metadata: { notificationId: notification.id, matchRequestId: notification.metadata?.match_request_id }
            });
          }
        });
      }

    // Sort all activities by date (most recent first)
    const sortedActivities = allActivities.sort((a, b) => {
      const getDate = (activity) => {
        // Prefer the notification timestamp when present (status updates)
        if (activity.metadata?.notificationId) {
          const notif = notifications?.find(n => n.id === activity.metadata.notificationId);
          return new Date(notif?.created_at || 0);
        }
        if (activity.metadata?.measurementId) {
          // Find measurement updated_at via matchRequests array
          const match = matchRequests?.find(m => m.id === activity.metadata.matchRequestId);
          const meas = match?.measurements?.find(mm => mm.id === activity.metadata.measurementId);
          return new Date(meas?.updated_at || 0);
        }
        if (activity.metadata?.matchRequestId) {
          const match = matchRequests?.find(m => m.id === activity.metadata.matchRequestId);
          return new Date(match?.created_at || 0);
        }
        if (activity.metadata?.partnerId) {
          const partner = partners?.find(p => p.id === activity.metadata.partnerId);
          return new Date(partner?.created_at || 0);
        }
        if (activity.metadata?.colorId) {
          const color = colors?.find(c => c.id === activity.metadata.colorId);
          return new Date(color?.created_at || 0);
        }
        return new Date(0);
      };
      return getDate(b) - getDate(a);
    });

    return sortedActivities;
  }, []);

  // Stage 1: Fast initial load (first 20 items)
  const fetchInitialActivity = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const sortedActivities = await fetchActivityDataWithLimits({
        matchRequestsLimit: 10,
        partnersLimit: 5,
        colorsLimit: 3,
        notificationsLimit: 10
      });

      // Take first 20 items
      setActivities(sortedActivities.slice(0, 20));
      setLoading(false);

      // Trigger Stage 2 in background after a brief delay
      setTimeout(() => {
        fetchRemainingActivity();
      }, 100);

    } catch (err) {
      console.warn('useActivityData: Error fetching initial activity, using empty state:', err.message);
      setError(err);
      setActivities([]);
      setLoading(false);
    }
  }, []);

  // Stage 2: Background full load (remaining items)
  const fetchRemainingActivity = React.useCallback(async () => {
    try {
      setLoadingRemaining(true);

      const sortedActivities = await fetchActivityDataWithLimits({
        matchRequestsLimit: 100,
        partnersLimit: 100,
        colorsLimit: 50,
        notificationsLimit: 100
      });

      // Merge with existing activities (deduplicate by id)
      setActivities(prevActivities => {
        const existingIds = new Set(prevActivities.map(a => a.id));
        const newActivities = sortedActivities.filter(a => !existingIds.has(a.id));
        
        return [...prevActivities, ...newActivities]
          .sort((a, b) => {
            // Simple date comparison using the formatted date string
            return new Date(b.date) - new Date(a.date);
          });
      });

      setLoadingRemaining(false);
    } catch (err) {
      console.warn('useActivityData: Error fetching remaining activity:', err.message);
      setLoadingRemaining(false);
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    let channels = [];

    const safeSetupActivity = async () => {
      try {
        if (mounted) {
          await fetchInitialActivity();
        }

        // Only set up subscriptions if component is still mounted
        if (!mounted) return;

        // Set up real-time subscriptions with error handling
        const setupChannel = (name, table, event = '*') => {
          try {
            const channel = supabase
              .channel(`activity-${name}`)
              .on('postgres_changes', 
                { event, schema: 'public', table },
                () => {
                  if (mounted) {
                    fetchInitialActivity().catch(err => 
                      console.warn(`useActivityData: Subscription refetch failed for ${table}:`, err.message)
                    );
                  }
                }
              )
              .subscribe();
            channels.push(channel);
            return channel;
          } catch (err) {
            console.warn(`useActivityData: Failed to setup ${name} subscription:`, err.message);
            return null;
          }
        };

        setupChannel('match-requests', 'match_requests');
        setupChannel('match-measurements', 'match_measurements', 'UPDATE');
        setupChannel('partners', 'partners');
        setupChannel('colors', 'colors', 'INSERT');
        setupChannel('notifications', 'notifications', 'INSERT');

      } catch (err) {
        console.warn('useActivityData: Setup failed:', err.message);
      }
    };

    safeSetupActivity();

    return () => {
      mounted = false;
      channels.forEach(channel => {
        try {
          if (channel) supabase.removeChannel(channel);
        } catch (err) {
          console.warn('useActivityData: Cleanup error:', err.message);
        }
      });
    };
  }, [fetchInitialActivity]);

  return { activities, loading, loadingRemaining, error, refetch: fetchInitialActivity };

};
