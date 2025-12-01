
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Badge } from '@/components/ui/badge';
import { v4 as uuidv4 } from 'uuid';
import MatchingJobsFilterPane from '@/components/matching/MatchingJobsFilterPane';
import { useRoleAccess } from '@/hooks/useRoleAccess';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowUpDown, Trash2, Filter, ChevronDown, ChevronUp, Archive, Clock, CheckCircle, XCircle, Send, RotateCcw, Forward, Plus } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';

import { getJobStatusForOrg, getColorMatchStatusForOrg, getOrgRole } from '@/lib/matchStatusUtils';
import { updateJobStatusBasedOnMatches } from '@/lib/matchJobStatusLogic';
import { Skeleton } from '@/components/ui/skeleton';
import Breadcrumb from '@/components/Breadcrumb';
import CenteredListToolbar from '@/components/common/CenteredListToolbar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import ColorPossessionBadge from '@/components/matching/ColorPossessionBadge';
import StatusIcon from '@/components/matching/StatusIcon';

const ActiveFilterIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 .78 1.63L15 14v4a1 1 0 0 1-.55.89l-4 2A1 1 0 0 1 9 20v-6L3.22 6.63A1 1 0 0 1 3 6V5z" />
  </svg>
);

const StatusIndicator = ({ status }) => {
  // For overdue status, show badge with red dot
  if (status === 'Overdue') {
    return (
      <Badge variant="overdue" className="gap-1.5 bg-destructive text-destructive-foreground">
        <div className="w-2 h-2 rounded-full bg-destructive-foreground"></div>
        {status}
      </Badge>
    );
  }

  // For archived status, show grayed out with archive icon
  if (status === 'Archived') {
    return (
      <div className="flex items-center text-muted-foreground">
        <Archive className="w-4 h-4 mr-2" />
        <span>{status}</span>
      </div>
    );
  }

  // For other statuses, keep original design
  const statusConfig = {
    'New': { color: 'bg-gray-400' },
    'In Progress': { color: 'bg-blue-500' },
    'Pending Approval': { color: 'bg-yellow-500' },
    'Complete': { color: 'bg-green-500' },
    'Re-Match Required': { color: 'bg-orange-500' },
    'Routed': { color: 'bg-purple-500' },
  };

  const config = statusConfig[status] || { color: 'bg-gray-400' };

  return (
    <div className="flex items-center">
      <div className={`w-2 h-2 rounded-full mr-2 ${config.color}`}></div>
      <span className="text-gray-800">{status}</span>
    </div>
  );
};

const ColorCircleWithTooltip = ({ color, index, totalColors, matchRequest, userOrgId, userOrgName }) => {
  // Create proper measurement object with is_routed and match_measurement_state
  const measurement = {
    is_routed: color.is_routed || false,
    match_measurement_state: color.match_measurement_state || 'empty',
    ...color.match_measurement
  };
  
  const statusInfo = getColorMatchStatusForOrg(color.status, matchRequest, userOrgId, measurement, userOrgName);
  const safeStatusText = statusInfo?.text || 'New';
  
  return (
    <TooltipProvider key={index}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className="w-6 h-6 rounded-full border-2 border-white cursor-pointer hover:scale-110 transition-transform" 
            style={{ 
              backgroundColor: color.hex, 
              zIndex: totalColors - index 
            }}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-sm">
            <div className="font-medium">{color.name}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Match Status: {safeStatusText}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ColorMatches = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, loading: profileLoading } = useProfile();
  const [organizationName, setOrganizationName] = useState(null);
  const { isSuperadmin } = useRoleAccess();
  const [matchRequests, setMatchRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [colors, setColors] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const lastRealtimeEventAt = React.useRef(null);
  const probeTimeoutRef = React.useRef(null);
  const fetchTimeoutRef = useRef(null);
  
  // Load organization name (inline to avoid external hook issues)
  useEffect(() => {
    let active = true;
    const loadOrg = async () => {
      if (!profile?.organization_id) { if (active) setOrganizationName(null); return; }
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', profile.organization_id)
          .single();
        if (!active) return;
        if (error) { setOrganizationName(null); return; }
        setOrganizationName(data?.name || null);
      } catch {
        if (active) setOrganizationName(null);
      }
    };
    loadOrg();
    return () => { active = false; };
  }, [profile?.organization_id]);

  // Inline filter functionality (to avoid React dispatcher issues)
  const [filterRows, setFilterRows] = useState([]);

  const addFilterRow = useCallback(() => {
    setFilterRows(prev => [...prev, { id: uuidv4(), property: '', value: null }]);
  }, []);

  const removeFilterRow = useCallback((id) => {
    setFilterRows(prev => prev.filter(row => row.id !== id));
  }, []);

  const changeFilterRow = useCallback((id, updates) => {
    setFilterRows(prev => prev.map(row => 
      row.id === id ? { ...row, ...updates } : row
    ));
  }, []);

  const clearFilters = useCallback(() => {
    setFilterRows([]);
  }, []);

  const applyFilters = useCallback((list) => {
    if (!Array.isArray(list)) return [];
    if (filterRows.length === 0) return list;

    let filtered = [...list];

    filterRows.forEach(row => {
      if (!row.property || row.value === null || row.value === undefined) return;

      // Job Status filter
      if (row.property === 'jobStatus' && Array.isArray(row.value) && row.value.length > 0) {
        filtered = filtered.filter(req => row.value.includes(req.calculatedStatus));
      }

      // Match Status filter
      if (row.property === 'matchStatus' && Array.isArray(row.value) && row.value.length > 0) {
        filtered = filtered.filter(req => 
          req.colors?.some(color => row.value.includes(color.status))
        );
      }

      // Printer Location filter
      if (row.property === 'printerLocation' && row.value) {
        filtered = filtered.filter(req => {
          const locationStr = `${req.shared_with} - ${req.location}`;
          return locationStr === row.value;
        });
      }

      // Match Colors filter
      if (row.property === 'matchColors' && Array.isArray(row.value) && row.value.length > 0) {
        filtered = filtered.filter(req =>
          req.colors?.some(color => row.value.includes(color.id))
        );
      }

      // Date Shared filter
      if (row.property === 'dateShared' && row.value?.start && row.value?.end) {
        filtered = filtered.filter(req => {
          if (!req.date_shared) return false;
          return req.date_shared >= row.value.start && req.date_shared <= row.value.end;
        });
      }

      // Due Date filter
      if (row.property === 'dueDate' && row.value?.start && row.value?.end) {
        filtered = filtered.filter(req => {
          if (!req.due_date) return false;
          return req.due_date >= row.value.start && req.due_date <= row.value.end;
        });
      }
    });

    return filtered;
  }, [filterRows]);

  const generateFilterOptions = useCallback((matchRequests, colors) => {
    // Generate unique printer location options
    const locationSet = new Set();
    matchRequests?.forEach(req => {
      if (req.shared_with && req.location) {
        locationSet.add(`${req.shared_with} - ${req.location}`);
      }
    });
    const printerLocationOptions = Array.from(locationSet).map(loc => ({ value: loc, label: loc }));

    // Match color options
    const matchColorOptions = (colors || []).map(color => ({
      value: color.id,
      label: color.name
    }));

    return { printerLocationOptions, matchColorOptions };
  }, []);

  const isFilterActive = useMemo(() => {
    return filterRows.some(row => {
      if (!row.property) return false;
      if (Array.isArray(row.value)) return row.value.length > 0;
      if (row.value && typeof row.value === 'object') {
        return row.value.start && row.value.end;
      }
      return row.value !== null && row.value !== undefined && row.value !== '';
    });
  }, [filterRows]);

  // Parse URL parameters and initialize filters on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || '');
      const rows = [];
      
      // Parse jobStatus parameter (e.g., ?jobStatus=Overdue or ?jobStatus=Pending,Overdue)
      const jobStatusParam = params.get('jobStatus');
      if (jobStatusParam) {
        const statuses = jobStatusParam.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length > 0) {
          rows.push({ 
            id: uuidv4(), 
            property: 'jobStatus', 
            value: statuses 
          });
        }
      }
      
      // Parse matchStatus parameter (e.g., ?matchStatus=Match Requested)
      const matchStatusParam = params.get('matchStatus');
      if (matchStatusParam) {
        const statuses = matchStatusParam.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length > 0) {
          rows.push({ 
            id: uuidv4(), 
            property: 'matchStatus', 
            value: statuses 
          });
        }
      }
      
      // Apply parsed filters
      if (rows.length > 0) {
        setFilterRows(rows);
        setIsFilterOpen(true); // Auto-open filter pane to show active filters
      }
    } catch (error) {
      console.warn('Error parsing URL parameters:', error);
    }
  }, [location.search]); // Only run when URL search params change

  const fetchMatchRequests = useCallback(async () => {
    setLoading(true);
    try {
      // Use the corrected RPC function
      const matchRequestsRes = await supabase.rpc('get_match_requests_for_current_user');
      
      if (matchRequestsRes.error) throw matchRequestsRes.error;
      
      setMatchRequests(matchRequestsRes.data || []);
      
      // Fetch colors separately for filters
      if (profile?.organization_id) {
        const colorsRes = await supabase
          .from('colors')
          .select('id, name, hex')
          .eq('organization_id', profile.organization_id);
        
        if (!colorsRes.error) {
          setColors(colorsRes.data || []);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching match requests:', error);
      toast({
        title: 'Error fetching data',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id, profileLoading]);

  const debouncedFetchMatchRequests = useCallback(async (source, delay = 500) => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    fetchTimeoutRef.current = setTimeout(async () => {
      const eventTime = new Date().toISOString();
      const currentDataCount = matchRequests.length;
      lastRealtimeEventAt.current = Date.now();

      console.log(`🔔 [${source}] Fetching after debounce`, {
        timestamp: eventTime,
        delay
      });

      const fetchStartTime = performance.now();
      await fetchMatchRequests();

      const fetchEndTime = performance.now();
      const fetchDuration = fetchEndTime - fetchStartTime;

      console.log('✅ fetchMatchRequests completed:', {
        source,
        durationMs: fetchDuration.toFixed(2),
        previousDataCount: currentDataCount,
        newDataCount: matchRequests.length,
      });
    }, delay);
  }, [fetchMatchRequests, matchRequests.length]);

  useEffect(() => {
    if (!profileLoading) {
      fetchMatchRequests();
    }
  }, [profileLoading, fetchMatchRequests]);

  // Real-time subscriptions for live updates with RLS-compliant filters
  useEffect(() => {
    if (!profile?.organization_id) return;

    console.log('🔌 Setting up realtime subscriptions for match_requests', {
      orgId: profile.organization_id,
    });

    // Single channel with RLS-compliant filters for all match request scenarios
    const channel = supabase
      .channel(`match-requests-org-${profile.organization_id}`)
      // Match requests owned by this org
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_requests',
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        (payload) => debouncedFetchMatchRequests('OWNED', 300)
      )
      // Match requests shared with this org
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_requests',
          filter: `shared_with_org_id=eq.${profile.organization_id}`,
        },
        (payload) => debouncedFetchMatchRequests('SHARED', 300)
      )
      // Match requests routed to this org
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_requests',
          filter: `routed_to_org_id=eq.${profile.organization_id}`,
        },
        (payload) => debouncedFetchMatchRequests('ROUTED', 300)
      )
      // Match measurements changes (insert/update/delete)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_measurements',
        },
        async (payload) => {
          console.log('Match measurement changed, recalculating job status...', {
            measurementId: payload.new?.id || payload.old?.id,
            match_request_id: payload.new?.match_request_id || payload.old?.match_request_id,
            eventType: payload.eventType,
          });
          const reqId = payload.new?.match_request_id || payload.old?.match_request_id;
          if (reqId) {
            await updateJobStatusBasedOnMatches(reqId);
            // Wait longer (800ms) to ensure DB status update has propagated
            debouncedFetchMatchRequests('MEASUREMENTS_STATUS_UPDATE', 800);
          } else {
            debouncedFetchMatchRequests('MEASUREMENTS', 500);
          }
        }
      );

    channel.subscribe((status) => {
      console.log('📡 Realtime channel status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('✅ Subscribed to match-requests with RLS filters');
        if (probeTimeoutRef.current) clearTimeout(probeTimeoutRef.current);
        probeTimeoutRef.current = setTimeout(() => {
          if (!lastRealtimeEventAt.current) {
            console.warn('⏳ No realtime events after 5s - running probe fetch');
            fetchMatchRequests();
          }
        }, 5000);
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('❌ Realtime channel error');
      }
      if (status === 'TIMED_OUT') {
        console.warn('⚠️ Realtime channel timed out');
      }
      if (status === 'CLOSED') {
        console.error('🔴 Realtime channel CLOSED - possible RLS violation');
      }
    });

    return () => {
      console.log('🔌 Cleaning up realtime subscriptions');
      if (probeTimeoutRef.current) {
        clearTimeout(probeTimeoutRef.current);
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id, fetchMatchRequests]);

  const handleRowClick = (matchId) => {
    navigate(`/color-matches/${matchId}`);
  };

  const showToast = (event) => {
    event.stopPropagation();
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  // Memoize calculated statuses for performance
  const requestsWithCalculatedStatus = useMemo(() => {
    return (matchRequests || []).map(request => {
      const calculatedStatus = getJobStatusForOrg(request, profile?.organization_id, organizationName);
      
      // Console warning for status mismatches (temporary debugging aid)
      if (request.status !== calculatedStatus) {
        console.warn(`Status mismatch for job ${request.job_id}: DB="${request.status}" vs Calculated="${calculatedStatus}"`);
      }
      
      return {
        ...request,
        calculatedStatus
      };
    });
  }, [matchRequests, profile?.organization_id, organizationName]);

  const filteredRequests = useMemo(() => {
    let filtered = requestsWithCalculatedStatus || [];
    
    // Apply custom filters first (now using calculated status)
    filtered = applyFilters(filtered);
    
    // Then apply search term (now includes calculated status)
    const term = (searchTerm || '').toLowerCase().trim();
    if (term) {
      filtered = filtered.filter((r) =>
        [r.job_id, r.project_id, r.shared_with, r.location, r.print_condition, r.calculatedStatus,
         r.date_shared, r.due_date]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term))
      );
    }
    
    return filtered;
  }, [requestsWithCalculatedStatus, searchTerm, applyFilters]);

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(filteredRequests.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRequest = (requestId, checked) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(requestId);
    } else {
      newSelected.delete(requestId);
    }
    setSelectedIds(newSelected);
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      const idsToDelete = Array.from(selectedIds);
      
      const { error } = await supabase
        .rpc('delete_match_requests_cascade', { p_match_request_ids: idsToDelete });

      if (error) throw error;

      // Update local state by removing deleted requests
      setMatchRequests(prev => prev.filter(request => !selectedIds.has(request.id)));
      
      // Clear selection
      setSelectedIds(new Set());

      toast({
        title: `Successfully deleted ${idsToDelete.length} match request${idsToDelete.length > 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Error deleting match requests:', error);
      toast({
        title: 'Error deleting match requests',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const isAllSelected = filteredRequests.length > 0 && selectedIds.size === filteredRequests.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < filteredRequests.length;

  const TableHeaderButton = ({ children }) => (
    <Button variant="ghost" className="text-muted-foreground hover:text-foreground p-0 h-auto font-semibold">
      {children}
      <ArrowUpDown className="ml-2 h-3 w-3" />
    </Button>
  );

  const formatDate = (dateString) => dateString ? dateString.replace(/-/g, '.') : '-';

  const handleToggleFilter = () => {
    setIsFilterOpen(!isFilterOpen);
  };

  const filterOptions = useMemo(() => 
    generateFilterOptions(requestsWithCalculatedStatus, colors), 
    [requestsWithCalculatedStatus, colors, generateFilterOptions]
  );

  return (
    <>
      <Helmet>
        <title>Color Matches - Spectral Color Tool</title>
        <meta name="description" content="Review and manage your color match requests." />
      </Helmet>
      <div className="flex flex-col h-full px-6 pt-6 space-y-6">
        <Breadcrumb />
        

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex min-h-0"
        >
          <div className="flex-1 flex flex-col min-h-0 bg-white border border-border rounded-lg overflow-hidden">
            <div className="flex-none pt-6 space-y-6">
              <div className="px-6">
                <CenteredListToolbar
                  searchValue={searchTerm}
                  onSearchChange={setSearchTerm}
                  placeholder="Search Jobs..."
                  leftChildren={
                    isSuperadmin ? (
                      <>
                        <TooltipProvider>
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={handleDelete} 
                                  disabled={selectedIds.size === 0}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete ({selectedIds.size})</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete ({selectedIds.size})</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                        <Separator orientation="vertical" className="h-6 mx-2" />
                      </>
                    ) : null
                  }
                  rightChildren={
                    <div className="flex items-center gap-2">
                      <Button 
                        variant={isFilterActive ? "secondary" : "outline"} 
                        size="sm" 
                        className="h-8 w-[120px]" 
                        onClick={handleToggleFilter}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            {isFilterActive ? (
                              <ActiveFilterIcon className="h-4 w-4 text-primary" />
                            ) : (
                              <Filter className="h-4 w-4" />
                            )}
                            <span>Filter</span>
                          </div>
                          {isFilterOpen ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </Button>
                    </div>
                  }
                  farRightChildren={
                    isFilterOpen ? (
                      <div className="flex items-center gap-2">
                        {isFilterActive && (
                          <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>
                            Clear filters
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8" 
                          onClick={addFilterRow}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null
                  }
                />
              </div>
            
            {/* Filter Pane */}
            <MatchingJobsFilterPane
              open={isFilterOpen}
              rows={filterRows}
              onAddRow={addFilterRow}
              onRemoveRow={removeFilterRow}
              onChangeRow={changeFilterRow}
              onClear={clearFilters}
              {...filterOptions}
            />
            </div>
            
            {/* Table container */}
            <ErrorBoundary fallbackMessage="Error loading color matches table. Please refresh the page.">
              <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
                <div className="overflow-x-auto">
                  <Table className="min-w-[800px]">
      <TableHeader className="sticky top-0 z-20 bg-background shadow-sm">
        <TableRow className="hover:bg-transparent h-14 items-center">
                        {isSuperadmin && (
                          <TableHead className="w-12 p-4">
                            <Checkbox
                              checked={isAllSelected}
                              onCheckedChange={handleSelectAll}
                              ref={checkbox => {
                                if (checkbox) checkbox.indeterminate = isIndeterminate;
                              }}
                              aria-label="Select all"
                            />
                          </TableHead>
                        )}
                        <TableHead className="p-4"><TableHeaderButton>Job ID</TableHeaderButton></TableHead>
                        <TableHead className="hidden lg:table-cell p-4"><TableHeaderButton>Project ID</TableHeaderButton></TableHead>
                        <TableHead className="hidden md:table-cell p-4">
                          <TableHeaderButton>
                            {(() => {
                              // Determine the column header based on user's role in the match requests
                              const sampleRequest = filteredRequests[0];
                              if (!sampleRequest || !profile?.organization_id) return 'Shared By';
                              
                              const userRole = getOrgRole(sampleRequest, profile.organization_id, null, organizationName);
                              return userRole === 'requestor' ? 'Shared With' : 'Shared By';
                            })()}
                          </TableHeaderButton>
                        </TableHead>
                        <TableHead className="hidden xl:table-cell p-4"><TableHeaderButton>Location</TableHeaderButton></TableHead>
                        <TableHead className="hidden xl:table-cell p-4"><TableHeaderButton>Print Condition</TableHeaderButton></TableHead>
                        <TableHead className="hidden xl:table-cell p-4"><TableHeaderButton>Date Shared</TableHeaderButton></TableHead>
                        <TableHead className="hidden lg:table-cell p-4"><TableHeaderButton>Due on</TableHeaderButton></TableHead>
                        <TableHead className="hidden md:table-cell p-4">Colors</TableHead>
                        <TableHead className="p-4">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading || profileLoading ? (
                           Array.from({ length: 5 }).map((_, index) => (
                               <TableRow key={index}>
                                   <TableCell colSpan={10} className="lg:colSpan-8 md:colSpan-6">
                                       <Skeleton className="h-8 w-full" />
                                   </TableCell>
                               </TableRow>
                           ))
                      ) : filteredRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="lg:colSpan-8 md:colSpan-6 text-center py-8">
                            <div className="text-muted-foreground">
                               {matchRequests.length === 0 ? (
                                 <div>
                                   <h3 className="font-medium mb-2">No Matching Jobs</h3>
                                   <p className="text-sm">
                                     To Create a Matching job, select the colors you wish to have matched on the{' '}
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         navigate('/colors');
                                       }}
                                       className="text-primary hover:text-primary/80 underline font-medium"
                                     >
                                       Colors page
                                     </button>
                                     {' '}and click <strong>Request Color Match</strong>
                                   </p>
                                 </div>
                              ) : (
                                <div>
                                  <h3 className="font-medium mb-2">No results match your filters</h3>
                                  <p className="text-sm">Try adjusting your search or filters to find what you're looking for.</p>
                                  {isFilterActive && (
                                    <Button variant="outline" size="sm" className="mt-2" onClick={clearFilters}>
                                      Clear All Filters
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRequests.map((request) => (
                          <TableRow 
                            key={request.id} 
                            className="h-14 cursor-pointer group hover:bg-gray-50"
                            onClick={() => handleRowClick(request.id)}
                          >
                            {isSuperadmin && (
                              <TableCell className="w-12 p-4" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedIds.has(request.id)}
                                  onCheckedChange={(checked) => handleSelectRequest(request.id, checked)}
                                  aria-label={`Select ${request.job_id}`}
                                />
                              </TableCell>
                            )}
                            <TableCell className="font-medium text-gray-900 p-4">{request.job_id}</TableCell>
                            <TableCell className="text-gray-600 hidden lg:table-cell p-4">{request.project_id || '-'}</TableCell>
                            <TableCell className="font-medium text-gray-800 hidden md:table-cell">
                              {(() => {
                                // Show appropriate organization name based on user's role
                                if (!profile?.organization_id) return request.shared_with;
                                
                                const userRole = getOrgRole(request, profile.organization_id, null, organizationName);
                                if (userRole === 'requestor') {
                                  // User is requestor, show who it's shared with
                                  return request.shared_with;
                                } else {
                                  // User is recipient, show who requested it (organization name)
                                  return request.requestor_organization_name || organizationName;
                                }
                              })()}
                            </TableCell>
                            <TableCell className="text-gray-600 hidden xl:table-cell">{request.location}</TableCell>
                            <TableCell className="text-gray-600 hidden xl:table-cell">{request.print_condition}</TableCell>
                            <TableCell className="text-gray-600 hidden xl:table-cell">{formatDate(request.date_shared)}</TableCell>
                            <TableCell className="text-gray-600 hidden lg:table-cell">{formatDate(request.due_date)}</TableCell>
              <TableCell className="hidden md:table-cell">
                {(() => {
                  // Determine user's role in this match request
                  const userOrgId = profile?.organization_id;
                  const isRequestor = request.match_request_organization_id === userOrgId;
                  const isSharedWith = request.shared_with_org_id === userOrgId;
                  const isRoutedTo = request.routed_to_org_id === userOrgId;

                  // Filter colors based on user's role
                  const displayColors = (() => {
                    const allColors = request.colors || [];
                    
                    // Requestor sees all colors
                    if (isRequestor) return allColors;
                    
                    // Shared-with org sees all colors (even if some are routed onwards)
                    if (isSharedWith) return allColors;
                    
                    // Routed-to org only sees colors that were routed to them
                    if (isRoutedTo) {
                      return allColors.filter(color => color.is_routed === true);
                    }
                    
                    // Fallback: show all colors
                    return allColors;
                  })();
                  
                  return (
                    <div className="flex items-center -space-x-2">
                      {displayColors.slice(0, 5).map((color, index) => (
                        <ColorCircleWithTooltip 
                          key={index} 
                          color={color} 
                          index={index}
                          totalColors={displayColors.length}
                          matchRequest={request}
                          userOrgId={profile?.organization_id}
                          userOrgName={organizationName}
                        />
                      ))}
                      {displayColors.length > 5 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600" style={{ zIndex: 0 }}>
                                +{displayColors.length - 5}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <div className="text-sm">
                                {displayColors.slice(5).map((color, idx) => (
                                  <div key={idx} className="flex items-center gap-2 py-1">
                                    <div 
                                      className="w-3 h-3 rounded-full border border-white"
                                      style={{ backgroundColor: color.hex }}
                                    />
                                    <span>{color.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      ({getColorMatchStatusForOrg(color.status, request, profile?.organization_id, {
                                        is_routed: color.is_routed || false,
                                        match_measurement_state: color.match_measurement_state || 'empty',
                                        ...color.match_measurement
                                      }, organizationName).text})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  );
                })()}
              </TableCell>
                            <TableCell>
                              <StatusIndicator status={request.calculatedStatus} />
                            </TableCell>
                          </TableRow>
                        ))
                       )}
                      </TableBody>
                   </Table>
                 </div>
               </div>
            </ErrorBoundary>
           </div>
         </motion.div>
       </div>
     </>
   );
 };
export default ColorMatches;
