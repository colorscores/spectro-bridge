import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ActivityTable from '@/components/activity/ActivityTable';
import CenteredListToolbar from '@/components/common/CenteredListToolbar';
import ActivityFilterPane from '@/components/activity/ActivityFilterPane';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';


const Activity = () => {
  // Inline useActivityData logic to avoid React dispatcher issues
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const formatActivityDate = useCallback((date) => {
    if (!date) return 'Unknown';
    return format(new Date(date), 'MMM dd, yyyy h:mm a');
  }, []);

  const fetchActivityData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const allActivities = [];

      // Get current user's organization context with timeout
      const { data: { user }, error: userError } = await Promise.race([
        supabase.auth.getUser(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth timeout')), 3000)
        )
      ]);

      if (userError || !user) {
        console.log('Activity: No user or auth error, skipping activity fetch');
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
        console.log('Activity: No profile or organization, skipping activity fetch');
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
        .limit(50);

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
        .limit(30);

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
        .limit(40);

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
        .limit(50);

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

      setActivities(sortedActivities);
    } catch (err) {
      console.warn('Activity: Error fetching activity data, using empty state:', err.message);
      setError(err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [formatActivityDate]);

  useEffect(() => {
    let mounted = true;
    let channels = [];

    const safeSetupActivity = async () => {
      try {
        if (mounted) {
          await fetchActivityData();
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
                    fetchActivityData().catch(err => 
                      console.warn(`Activity: Subscription refetch failed for ${table}:`, err.message)
                    );
                  }
                }
              )
              .subscribe();
            channels.push(channel);
            return channel;
          } catch (err) {
            console.warn(`Activity: Failed to setup ${name} subscription:`, err.message);
            return null;
          }
        };

        setupChannel('match-requests', 'match_requests');
        setupChannel('match-measurements', 'match_measurements', 'UPDATE');
        setupChannel('partners', 'partners');
        setupChannel('colors', 'colors', 'INSERT');
        setupChannel('notifications', 'notifications', 'INSERT');

      } catch (err) {
        console.warn('Activity: Setup failed:', err.message);
      }
    };

    safeSetupActivity();

    return () => {
      mounted = false;
      channels.forEach(channel => {
        try {
          if (channel) supabase.removeChannel(channel);
        } catch (err) {
          console.warn('Activity: Cleanup error:', err.message);
        }
      });
    };
  }, [fetchActivityData]);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Inline activity filters to avoid cross-react dispatcher issues
  const [filterRows, setFilterRows] = useState([]);

  const getDefaultOperator = useCallback((property) => {
    switch (property) {
      case 'activity':
      case 'type':
        return 'is';
      case 'user':
      case 'company':
      case 'receiver':
        return 'includes';
      case 'date':
        return 'between';
      default:
        return '';
    }
  }, []);

  const addFilterRow = useCallback(() => {
    setFilterRows(prev => ([
      ...prev,
      { id: Date.now(), property: '', operator: '', values: [] }
    ]));
  }, []);

  const removeFilterRow = useCallback((id) => {
    setFilterRows(prev => prev.filter(row => row.id !== id));
  }, []);

  const changeFilterRow = useCallback((id, field, value) => {
    setFilterRows(prev => prev.map(row => {
      if (row.id === id) {
        const updates = { [field]: value };
        if (field === 'property') {
          updates.values = [];
          updates.operator = getDefaultOperator(value);
        }
        return { ...row, ...updates };
      }
      return row;
    }));
  }, [getDefaultOperator]);

  const clearFilters = useCallback(() => setFilterRows([]), []);

  const generateFilterOptions = useCallback((list) => {
    const options = { activity: new Set(), user: new Set(), company: new Set(), receiver: new Set(), type: new Set() };
    (list || []).forEach(a => {
      if (a.activity) options.activity.add(a.activity);
      if (a.user) options.user.add(a.user);
      if (a.company) options.company.add(a.company);
      if (a.receiver) options.receiver.add(a.receiver);
      if (a.type) options.type.add(a.type);
    });
    return {
      activity: Array.from(options.activity).sort(),
      user: Array.from(options.user).sort(),
      company: Array.from(options.company).sort(),
      receiver: Array.from(options.receiver).sort(),
      type: Array.from(options.type).sort()
    };
  }, []);

  const applyFilters = useCallback((list) => {
    if (!filterRows.length) return list;
    return (list || []).filter(activity =>
      filterRows.every(filter => {
        if (!filter.property || !filter.operator) return true;
        const value = activity[filter.property];
        const filterValues = filter.values || [];
        switch (filter.operator) {
          case 'is':
            return filterValues.length === 0 || filterValues.includes(value);
          case 'is not':
            return filterValues.length === 0 || !filterValues.includes(value);
          case 'includes':
            return filterValues.length === 0 || filterValues.some(fv => value?.toLowerCase().includes(fv.toLowerCase()));
          case 'excludes':
            return filterValues.length === 0 || !filterValues.some(fv => value?.toLowerCase().includes(fv.toLowerCase()));
          case 'between': {
            if (!filter.startDate || !filter.endDate) return true;
            const d = new Date(activity.created_at || activity.date);
            return d >= new Date(filter.startDate) && d <= new Date(filter.endDate);
          }
          case 'on': {
            if (!filter.startDate) return true;
            const onDate = new Date(activity.created_at || activity.date).toDateString();
            return onDate === new Date(filter.startDate).toDateString();
          }
          case 'before':
            if (!filter.startDate) return true;
            return new Date(activity.created_at || activity.date) < new Date(filter.startDate);
          case 'after':
            if (!filter.startDate) return true;
            return new Date(activity.created_at || activity.date) > new Date(filter.startDate);
          default:
            return true;
        }
      })
    );
  }, [filterRows]);

  const isFilterActive = filterRows.length > 0;

  const filterOptions = useMemo(() => 
    generateFilterOptions(activities), 
    [activities, generateFilterOptions]
  );

  const filteredActivities = useMemo(() => {
    // First apply filters
    let result = applyFilters(activities);
    
    // Then apply search
    const term = (search || '').toLowerCase().trim();
    if (term) {
      result = result.filter(a => [a.activity, a.user, a.company, a.receiver, a.date]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(term))
      );
    }
    
    return result;
  }, [activities, search, applyFilters]);
    return (
      <>
      <Helmet>
        <title>Activity - BCN</title>
        <meta name="description" content="View recent activity and track changes." />
      </Helmet>
      <div className="flex flex-col h-full px-6 pt-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
        </div>
        <div className="flex-1 flex min-h-0 min-w-0 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex-1 flex flex-col bg-white border border-border rounded-lg overflow-hidden"
          >
            <div className="flex flex-col min-h-0 pt-6 space-y-6">
              <div className="px-6">
                <CenteredListToolbar
                  searchValue={search}
                  onSearchChange={setSearch}
                  placeholder="Search activity..."
                  rightChildren={
                    <Button 
                      variant={isFilterActive ? "secondary" : "outline"}
                      size="sm"
                      className="h-8"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter className="mr-2 h-4 w-4" />
                      Filter
                      {showFilters ? (
                        <ChevronUp className="ml-2 h-4 w-4" />
                      ) : (
                        <ChevronDown className="ml-2 h-4 w-4" />
                      )}
                    </Button>
                  }
                />
              </div>
              <ActivityFilterPane
                show={showFilters}
                filterRows={filterRows}
                onAddFilter={addFilterRow}
                onRemoveFilter={removeFilterRow}
                onChangeFilter={changeFilterRow}
                onClearFilters={clearFilters}
                filterOptions={filterOptions}
              />
              <div className="flex-1 overflow-auto">
                <div className="px-6 pb-6">
                  <ActivityTable activities={filteredActivities} loading={loading} error={error} />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      </>
    );
};

export default Activity;