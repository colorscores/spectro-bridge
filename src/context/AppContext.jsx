import React, { createContext, useContext, useMemo, useState, useEffect, useRef, startTransition } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
// Removed useProfile to avoid circular import
import { supabase } from '@/lib/customSupabaseClient';

// Performance: Disable debug logging in production
const DEBUG_COLORS = false;

// Increased limit to support large color libraries (e.g., Superbrand with 1900+ colors)
const MAX_INITIAL_COLORS = 5000;
// Small util: chunk array to avoid long URLs in PostgREST
const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
};
const fetchColorLibrary = async (orgId) => {
  if (!orgId) {
    if (DEBUG_COLORS) console.log('🚫 fetchColorLibrary called with empty orgId');
    return { colors: [], color_books: [], color_book_associations: [] };
  }
  if (DEBUG_COLORS) console.log('🎯 fetchColorLibrary EXECUTED for org:', orgId);
  if (DEBUG_COLORS) console.log('📡 Starting color library fetch with bulk queries...');

  // Prefer direct SELECT with RLS so partner-shared colors are included
  try {
    if (DEBUG_COLORS) console.log('🟢 Trying direct SELECT on colors with RLS...');
    // Page through colors to bypass PostgREST 1000-row limit
    const pageSize = 1000; // PostgREST hard cap per request
    const MAX_TOTAL_COLORS = 10000; // safety cap
    let start = 0;
    let colorRows = [];
    let colorErr = null;
    while (true) {
      const { data: page, error } = await supabase
        .from('colors')
        .select(`
          id,name,hex,standard_type,master_color_id,
          created_at,updated_at,organization_id
        `)
        .order('updated_at', { ascending: false })
        .order('id', { ascending: true })
        .range(start, start + pageSize - 1);
      if (error) { colorErr = error; break; }
      const rows = Array.isArray(page) ? page : [];
      colorRows = colorRows.concat(rows);
      if (rows.length < pageSize || colorRows.length >= MAX_TOTAL_COLORS) break;
      start += pageSize;
    }

    if (!colorErr && Array.isArray(colorRows)) {
      if (DEBUG_COLORS) console.log('✅ Fetched', colorRows.length, 'colors');
      
      // Extract IDs for bulk fetches
      const colorIds = colorRows.map(c => c.id).filter(Boolean);
      const orgIds = Array.from(new Set(colorRows.map(c => c.organization_id).filter(Boolean)));

      // Parallelize all bulk fetches for performance
      const [orgsResult, colorBooksResult, partnersResult] = await Promise.all([
        orgIds.length > 0 
          ? supabase.from('organizations').select('id,name').in('id', orgIds)
          : { data: [] },
        supabase.from('color_books').select('id,name,created_at,updated_at,organization_id').eq('organization_id', orgId),
        // Fetch partner relationships to check download restrictions
        supabase.from('partners')
          .select('organization_id,partner_organization_id,allow_download')
          .or(`organization_id.eq.${orgId},partner_organization_id.eq.${orgId}`)
          .in('status', ['connected', 'accepted'])
      ]);

// Fetch associations in chunks to avoid long URL limits
// RLS policies ensure only authorized data is returned
if (DEBUG_COLORS) console.log('📚 Fetching associations in chunks...');
const colorIdChunks = chunkArray(colorIds, 150);
// Tag associations
const tagAssocResponses = colorIds.length > 0
  ? await Promise.all(colorIdChunks.map(ids => 
      supabase.from('tag_associations').select('id,color_id,tag_id').in('color_id', ids).order('id', { ascending: true })
    ))
  : [];
// Measurements
const measurementResponses = colorIds.length > 0
  ? await Promise.all(colorIdChunks.map(ids => 
      supabase.from('color_measurements').select('id,color_id,mode').in('color_id', ids).order('id', { ascending: true })
    ))
  : [];
const tagAssocRows = (tagAssocResponses || []).reduce((acc, res) => acc.concat(res?.data || []), []);
const measurementRows = (measurementResponses || []).reduce((acc, res) => acc.concat(res?.data || []), []);

      // Color book associations - paginate across all relevant orgs to bypass 1000-row cap
      const pageSizeAssoc = 1000;
      let colorBookAssocRows = [];
      const assocOrgIds = (orgIds && orgIds.length > 0) ? orgIds : [orgId];
      for (const oid of assocOrgIds) {
        let start = 0;
        while (true) {
          const { data: page, error } = await supabase
            .from('color_book_associations')
            .select('id,color_id,book_id,organization_id,created_at')
            .eq('organization_id', oid)
            .order('id', { ascending: true })
            .range(start, start + pageSizeAssoc - 1);
          if (error) {
            console.warn('⚠️ Error fetching color_book_associations page:', error.message);
            break;
          }
          const rows = Array.isArray(page) ? page : [];
          colorBookAssocRows = colorBookAssocRows.concat(rows);
          if (rows.length < pageSizeAssoc) break;
          start += pageSizeAssoc;
        }
      }

      console.log('🔍 Fetched measurements:', measurementRows.length, 'for', colorIds.length, 'colors');
      if (measurementRows.length > 0) {
        console.log('📊 Sample measurements:', measurementRows.slice(0, 3));
      }
      
      if (DEBUG_COLORS) console.log('✅ Fetched associations:', tagAssocRows.length, 'tags,', measurementRows.length, 'measurements,', colorBookAssocRows.length, 'book links');

      // Build org map
      const orgMap = new Map();
      (orgsResult.data || []).forEach(o => orgMap.set(o.id, o.name));

      // Build partner download restriction map
      // Key: color_owner_org_id, Value: is_download_restricted (boolean)
      const downloadRestrictionMap = new Map();
      (partnersResult.data || []).forEach(p => {
        // If current org is the partner (receiving colors), check if download is allowed
        if (p.partner_organization_id === orgId) {
          downloadRestrictionMap.set(p.organization_id, !p.allow_download);
        }
      });

      // Build tag association map and collect tag IDs
      const tagAssocMap = new Map();
      const tagIdSet = new Set();
      (tagAssocRows || []).forEach(ta => {
        if (!tagAssocMap.has(ta.color_id)) tagAssocMap.set(ta.color_id, []);
        tagAssocMap.get(ta.color_id).push(ta.tag_id);
        tagIdSet.add(ta.tag_id);
      });

      // Fetch tag names in chunks if needed
      let tagNameMap = new Map();
      const tagIds = Array.from(tagIdSet);
      if (tagIds.length > 0) {
        const tagChunks = chunkArray(tagIds, 150);
        const tagPromises = tagChunks.map(ids => supabase.from('tags').select('id,name').in('id', ids));
        const tagResponses = await Promise.all(tagPromises);
        tagResponses.forEach(res => (res.data || []).forEach(t => tagNameMap.set(t.id, t.name)));
      }

      // Build measurement map
      const measurementMap = new Map();
      (measurementRows || []).forEach(m => {
        if (!measurementMap.has(m.color_id)) measurementMap.set(m.color_id, []);
        measurementMap.get(m.color_id).push({ id: m.id, mode: m.mode });
      });
      console.log('📊 Measurement map built:', measurementMap.size, 'colors have measurements');
      const firstColorWithMeasurement = Array.from(measurementMap.entries())[0];
      if (firstColorWithMeasurement) {
        console.log('📋 Sample map entry:', {
          colorId: firstColorWithMeasurement[0],
          measurements: firstColorWithMeasurement[1]
        });
      }

      // Combine all data
      const colorsWithModes = colorRows.map(c => {
        // RLS ensures only authorized tags are returned
        const tagIds = tagAssocMap.get(c.id) || [];
        const tags = tagIds
          .map(tagId => ({ id: tagId, name: tagNameMap.get(tagId) }))
          .filter(tag => tag.name);
        
        const measurements = measurementMap.get(c.id) || [];

        // Check if color is download-restricted based on partner settings
        const is_download_restricted = downloadRestrictionMap.get(c.organization_id) === true;

        return {
          ...c,
          owner_org_name: orgMap.get(c.organization_id) || null,
          tags,
          measurements,
          is_download_restricted
        };
      });
      
      const sampleColor = colorsWithModes.find(c => c.measurements?.length > 0);
      if (sampleColor) {
        console.log('✅ Sample color with measurements after mapping:', {
          name: sampleColor.name,
          id: sampleColor.id,
          measurementCount: sampleColor.measurements.length,
          modes: sampleColor.measurements.map(m => m.mode)
        });
      } else {
        console.warn('⚠️ No colors found with measurements after mapping');
      }
      
      const result = { 
        colors: colorsWithModes, 
        color_books: colorBooksResult.data || [], 
        color_book_associations: colorBookAssocRows
      };
      if (DEBUG_COLORS) console.log('✅ Direct SELECT completed with', result.colors.length, 'colors,', result.color_books.length, 'books,', result.color_book_associations.length, 'associations');
      return result;
    }

    // If direct SELECT fails or returns null, fall back to RPC
    const timeoutMs = 6000; // Reduced timeout to 6 seconds for responsiveness
    if (DEBUG_COLORS) console.log('⏱️ Direct SELECT unavailable, starting RPC with 6s timeout...');
    const rpcPromise = supabase.rpc('get_color_library_for_org', { p_org_id: orgId });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('RPC_TIMEOUT')), timeoutMs));
    const rpcResult = await Promise.race([rpcPromise, timeoutPromise]);

    if (rpcResult?.error) {
      console.warn('🚨 RPC error occurred:', rpcResult.error.message);
      throw rpcResult.error;
    }

    if (rpcResult?.data) {
      if (DEBUG_COLORS) console.log('🔍 RPC Response structure:', rpcResult.data);
      if (DEBUG_COLORS) console.log('🔍 RPC keys:', Object.keys(rpcResult.data || {}));
      const rpcData = rpcResult.data.get_color_library_for_org || rpcResult.data;
      const rpcColors = Array.isArray(rpcData?.colors) ? rpcData.colors : [];
      const rpcBooks = Array.isArray(rpcData?.color_books) ? rpcData.color_books : [];
      const rpcAssociations = Array.isArray(rpcData?.associations) ? rpcData.associations : [];

      // Enrich with owner org names
      const orgIds = Array.from(new Set(rpcColors.map(c => c.organization_id).filter(Boolean)));
      let orgMap = new Map();
      if (orgIds.length) {
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id,name')
          .in('id', orgIds);
        (orgs || []).forEach(o => orgMap.set(o.id, o.name));
      }

      let colorsWithModes = rpcColors.map(c => ({
        ...c,
        owner_org_name: c.owner_org_name || orgMap.get(c.organization_id) || null,
        measurements: Array.isArray(c.measurements) ? c.measurements : []
      }));

      colorsWithModes = colorsWithModes.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

      const result = { 
        colors: colorsWithModes, 
        color_books: rpcBooks, 
        color_book_associations: rpcAssociations 
      };
      if (DEBUG_COLORS) console.log('✅ Color library (RPC) fetched:', result.colors.length, 'colors');
      return result;
    }
  } catch (rpcErr) {
    if (rpcErr.message === 'RPC_TIMEOUT') {
      console.error('🕐 RPC timed out after 15 seconds - the query is too complex');
      console.error('💡 Consider optimizing the get_color_library_for_org RPC function');
    } else {
      console.warn('⚠️ RPC color fetch failed:', rpcErr.message);
    }

    // Fallback: use basic color library RPC (returns a flat array of colors)
    try {
      const basicRes = await supabase.rpc('get_basic_color_library_for_org', { p_org_id: orgId });
      if (!basicRes.error && Array.isArray(basicRes.data)) {
        // Enrich with owner org name if not supplied
        const orgIds = Array.from(new Set(basicRes.data.map(c => c.organization_id).filter(Boolean)));
        let orgMap = new Map();
        if (orgIds.length) {
          const { data: orgs } = await supabase
            .from('organizations')
            .select('id,name')
            .in('id', orgIds);
          (orgs || []).forEach(o => orgMap.set(o.id, o.name));
        }

        const colorsWithModes = basicRes.data.map(c => ({
          ...c,
          owner_org_name: c.owner_org_name || orgMap.get(c.organization_id) || null,
          measurements: Array.isArray(c.measurements) ? c.measurements : []
        }));
        return { colors: colorsWithModes, color_books: [], color_book_associations: [] };
      }
    } catch (fallbackErr) {
      console.warn('⚠️ Fallback RPC also failed:', fallbackErr.message);
    }
    
    // Provide empty data but maintain proper structure
    return { colors: [], color_books: [], color_book_associations: [] };
  }

  // If we get here, RPC returned no data
  if (DEBUG_COLORS) console.warn('⚠️ RPC returned no data');
  return { colors: [], color_books: [], color_book_associations: [] };
};

const AppContext = createContext({
  colors: [],
  colorBooks: [],
  associations: [],
  loading: true,
  error: null,
  refetch: () => {},
  appMode: 'matching',
  setAppMode: () => {},
  navGroupSelections: {},
  setNavGroupSelections: () => {},
  optimisticUpdateColor: () => {},
});

export const AppProvider = ({ children }) => {
  // Remove useProfile dependency to break circular dependency
  const [profile, setProfile] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);
  const location = useLocation();
  
  // Detect initial appMode from current URL path
  const getInitialAppMode = () => {
    if (typeof window === 'undefined') return 'matching';
    const path = window.location.pathname;
    
    // Use the same logic as useNavMemory to determine group from path
    const navConfig = {
      matching: [
        { path: '/dashboard' },
        { path: '/colors' },
        { path: '/color-matches' },
        { path: '/print-conditions' },
        { path: '/quality-sets' },
        { path: '/activity' },
      ],
      admin: [
        { path: '/admin/dashboard' },
        { path: '/admin/my-company' },
        { path: '/admin/users' },
        { path: '/admin/organizations' },
        { path: '/admin/partners' },
        { path: '/admin/integrations' },
      ],
      assets: [
        { path: '/assets/dashboard' },
        { path: '/assets/printers' },
        { path: '/assets/inks' },
        { path: '/assets/substrates' },
        { path: '/assets/testcharts' },
        { path: '/assets/curves' },
        { path: '/assets/characterizations' },
        { path: '/assets/profiles' },
      ],
    };
    
    for (const [group, items] of Object.entries(navConfig)) {
      if (items.some(i => path.startsWith(i.path))) {
        if (DEBUG_COLORS) console.log('🎯 Initial appMode detected from URL:', group, 'for path:', path);
        return group;
      }
    }
    
    if (DEBUG_COLORS) console.log('🎯 No appMode match found for path:', path, 'defaulting to matching');
    return 'matching';
  };
  
  const [appMode, setAppMode] = useState(getInitialAppMode);
  const [navGroupSelections, setNavGroupSelections] = useState({});
  const [profileLoading, setProfileLoading] = useState(true);
  const queryClient = useQueryClient();
  const [orgSwitchPending, setOrgSwitchPending] = useState(false);

  // Listen for profile from ProfileProvider via context events
  useEffect(() => {
    const handleProfileUpdate = (event) => {
      if (event.detail) {
        setProfile(event.detail.profile);
        setOrganizationId(event.detail.profile?.organization_id);
        setProfileLoading(event.detail.loading || false);
      }
    };
    window.addEventListener('profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('profile-updated', handleProfileUpdate);
  }, []);

  // Expose React Query client globally for cross-context cache control
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.queryClient = queryClient;
    }
    return () => {
      if (typeof window !== 'undefined' && window.queryClient === queryClient) {
        delete window.queryClient;
      }
    };
  }, [queryClient]);

  // React to profile/org changes (natural cascade from auth sign-out)
  useEffect(() => {
    if (!profile && !organizationId) {
      console.log('🧹 AppContext: Profile and org cleared, cleaning up queries');
      startTransition(() => {
        queryClient.removeQueries({ queryKey: ['colors'], exact: false });
      });
    }
  }, [profile, organizationId, queryClient]);

  // Fallback: ensure organizationId is derived even if the profile-updated event is missed
  useEffect(() => {
    if (organizationId) return;
    // After a short delay, try to resolve the org id directly from Supabase
    const timer = setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setProfileLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('id, organization_id')
          .eq('id', user.id)
          .maybeSingle();
        if (error) {
          console.warn('AppContext fallback profile fetch error:', error.message);
        }
        if (data?.organization_id) {
          setOrganizationId(data.organization_id);
          setProfile(prev => ({ ...(prev || {}), id: data.id, organization_id: data.organization_id }));
        }
      } catch (e) {
        console.warn('AppContext fallback exception:', e);
      } finally {
        // Prevent indefinite loading if the event never arrives
        setProfileLoading(false);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [organizationId]);
  // Real-time subscriptions for comprehensive live updates
  const debounceTimeoutRef = useRef(null);
  const partnerDebounceTimeoutRef = useRef(null);
  const colorsDebounceTimeoutRef = useRef(null);
  const matchDebounceTimeoutRef = useRef(null);
  
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('live-updates-channel')
      // Partners table changes
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'partners'
        },
        (payload) => {
          if (colorsDebounceTimeoutRef.current) clearTimeout(colorsDebounceTimeoutRef.current);
          colorsDebounceTimeoutRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['colors', organizationId] });
          }, 1000);
        }
      )
      // Colors table changes
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'colors'
        },
        (payload) => {
          if (colorsDebounceTimeoutRef.current) clearTimeout(colorsDebounceTimeoutRef.current);
          colorsDebounceTimeoutRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['colors', organizationId] });
          }, 500);
        }
      )
      // Color books table changes
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'color_books'
        },
        (payload) => {
          if (colorsDebounceTimeoutRef.current) clearTimeout(colorsDebounceTimeoutRef.current);
          colorsDebounceTimeoutRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['colors', organizationId] });
          }, 500);
        }
      )
      // Color book associations table changes
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'color_book_associations'
        },
        (payload) => {
          if (colorsDebounceTimeoutRef.current) clearTimeout(colorsDebounceTimeoutRef.current);
          colorsDebounceTimeoutRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['colors', organizationId] });
          }, 500);
        }
      )
      // Tag associations changes (for partner sharing)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'tag_associations'
        },
        (payload) => {
          console.log('🏷️ Tag association change detected:', payload);
          
          // Only invalidate cache for partner-related tag changes
          const newRecord = payload.new || payload.old;
          if (newRecord?.partner_id) {
            if (DEBUG_COLORS) console.log('🎯 Partner-related tag change - scheduling cache invalidation');
            
            // Debounce cache invalidation to prevent excessive refetches
            if (debounceTimeoutRef.current) {
              clearTimeout(debounceTimeoutRef.current);
            }
            
            debounceTimeoutRef.current = setTimeout(() => {
              console.log('🔄 Invalidating color library cache due to partner sharing changes');
              queryClient.invalidateQueries({ queryKey: ['colors', organizationId] });
            }, 1000);
          }
        }
      )
      // Match requests table changes
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'match_requests'
        },
        (payload) => {
          console.log('🎯 Match request change detected:', payload);
          
          if (matchDebounceTimeoutRef.current) {
            clearTimeout(matchDebounceTimeoutRef.current);
          }
          
          matchDebounceTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Invalidating match queries cache due to match request changes');
            queryClient.invalidateQueries({ queryKey: ['match-requests'] });
            queryClient.invalidateQueries({ queryKey: ['match-request-details'] });
          }, 1000);
        }
      )
      // Match measurements table changes
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'match_measurements'
        },
        (payload) => {
          console.log('📏 Match measurement change detected:', payload);
          
          if (matchDebounceTimeoutRef.current) {
            clearTimeout(matchDebounceTimeoutRef.current);
          }
          
          matchDebounceTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Invalidating match queries cache due to measurement changes');
            queryClient.invalidateQueries({ queryKey: ['match-requests'] });
            queryClient.invalidateQueries({ queryKey: ['match-request-details'] });
            queryClient.invalidateQueries({ queryKey: ['match-measurement'] });
          }, 1000);
        }
      )
      .subscribe();

    // Removed duplicate global-match-updates channel - consolidated in App.jsx

    return () => {
      console.log('🔄 Cleaning up all realtime subscriptions');
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (partnerDebounceTimeoutRef.current) {
        clearTimeout(partnerDebounceTimeoutRef.current);
      }
      if (colorsDebounceTimeoutRef.current) {
        clearTimeout(colorsDebounceTimeoutRef.current);
      }
      if (matchDebounceTimeoutRef.current) {
        clearTimeout(matchDebounceTimeoutRef.current);
      }
      supabase.removeChannel(channel);
      if (typeof broadcastChannel !== 'undefined' && broadcastChannel) {
        try {
          supabase.removeChannel(broadcastChannel);
        } catch (e) {
          console.warn('🔇 broadcastChannel not available to remove');
        }
      }
    };
  }, [organizationId, queryClient]);

  // Force debug on mount to check query state
  React.useEffect(() => {
    console.log('🔧 AppProvider mounted/organizationId updated - Query Debug:', {
      organizationId: organizationId || 'NOT SET',
      profileLoading,
      queryEnabled: !!organizationId && !profileLoading,
      hasProfile: !!profile
    });
    
    // Force query execution check
    if (organizationId && !profileLoading) {
      console.log('🚀 SHOULD BE FETCHING COLOR LIBRARY NOW for org:', organizationId);
      
      // Removed forced invalidation to prevent duplicate fetches
    }
  }, [organizationId, profileLoading, profile, queryClient]);

  // Determine if we need the color library based on current route
  const needsColorLibrary = useMemo(() => {
    const path = location.pathname;
    // Only fetch colors on routes that actually need them
    const colorRoutes = ['/dashboard', '/colors', '/assets/colors', '/color-matches', '/print-conditions', '/quality-sets'];
    const needsColors = colorRoutes.some(route => path.startsWith(route)) || 
                        path.includes('/color/') || // Color detail pages
                        path.includes('/match-request/'); // Match request details
    
    if (!needsColors) {
      console.log('🚫 Skipping color library fetch for route:', path);
    }
    return needsColors;
  }, [location.pathname]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['colors', organizationId],
    queryFn: () => {
      console.log('🚀 Fetching color library for org:', organizationId);
      return fetchColorLibrary(organizationId);
    },
    enabled: !!organizationId && !profileLoading && needsColorLibrary, // Only run when needed
    staleTime: 15 * 60 * 1000, // 15 minutes cache
    gcTime: 30 * 60 * 1000, // 30 minutes in cache
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Always refetch on mount to handle login scenarios
    retry: 0, // Reduced retries to eliminate 24+ second delays
    retryDelay: 1000, // Simple 1 second delay if retry occurs
    refetchInterval: false, // Disable automatic refetching
    refetchIntervalInBackground: false,
  });

  // Log query state changes (only in development)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Query state changed:', {
        isLoading,
        hasData: !!data,
        colorsCount: data?.colors?.length || 0,
        booksCount: data?.color_books?.length || 0,
        error: error?.message || 'none'
      });
    }
  }, [isLoading, data, error]);

  // End org switch pending once new data finishes loading for current org
  useEffect(() => {
    if (organizationId && !isLoading && data !== undefined) {
      setOrgSwitchPending(false);
    }
  }, [organizationId, isLoading, data]);

  // Critical: Reset state immediately when organizationId changes to prevent stale data display
  const prevOrgIdRef = useRef(organizationId);
  useEffect(() => {
    if (prevOrgIdRef.current !== organizationId && prevOrgIdRef.current !== undefined) {
      console.log('🔄 Organization changed from', prevOrgIdRef.current, 'to', organizationId);
      console.log('🗑️ Clearing old organization color cache');

      // While switching, hide any stale data
      setOrgSwitchPending(true);
      
      // Remove queries for the previous organization
      queryClient.removeQueries({ 
        queryKey: ['colors', prevOrgIdRef.current],
        exact: true 
      });
    }
    prevOrgIdRef.current = organizationId;
  }, [organizationId, queryClient]);

  // Optimistic update function for tags
  const updateColorTagsOptimistically = (colorIds, newTags) => {
    queryClient.setQueryData(['colors', organizationId], (oldData) => {
      if (!oldData?.colors) return oldData;
      
      return {
        ...oldData,
        colors: oldData.colors.map(color => {
          if (colorIds.includes(color.id)) {
            return {
              ...color,
              tags: newTags
            };
          }
          return color;
        })
      };
    });
    
    // Force a re-render by invalidating (but not refetching) the query
    queryClient.invalidateQueries({ 
      queryKey: ['colors', organizationId], 
      refetchType: 'none' // Don't refetch, just mark as stale and trigger re-render
    });
  };

  // Optimistic update function for color properties
  const updateColorOptimistically = (colorId, updates) => {
    console.log('🎨 Optimistic color update triggered:', { colorId, updates: typeof updates === 'object' ? Object.keys(updates) : updates });
    
    // Ensure updated_at changes so downstream memo/signature recomputes
    const updatesWithTimestamp = {
      ...(updates || {}),
      updated_at: (updates && Object.prototype.hasOwnProperty.call(updates, 'updated_at'))
        ? updates.updated_at
        : new Date().toISOString(),
    };
    
    queryClient.setQueryData(['colors', organizationId], (oldData) => {
      if (!oldData?.colors) {
        console.log('⚠️ No colors data in cache to update optimistically');
        return oldData;
      }
      
      console.log('✅ Applying optimistic update to colors cache');
      const updatedColors = oldData.colors.map(color => {
        if (color.id === colorId) {
          // Handle both full color objects and partial updates
          const isFullColorObject = updates && typeof updates === 'object' && updates.id;
          
          if (isFullColorObject) {
            console.log('📋 Handling full color object update');
            return { ...color, ...updatesWithTimestamp };
          } else {
            console.log('🔧 Handling partial updates:', Object.keys(updates || {}));
            return { ...color, ...updatesWithTimestamp };
          }
        }
        return color;
      });
      
      // Return a NEW object reference to ensure React Query detects the change
      return {
        ...oldData,
        colors: updatedColors
      };
    });
    
    // Force a re-render by invalidating (but not refetching) the query
    // This ensures components using this data will re-render with the optimistic update
    queryClient.invalidateQueries({ 
      queryKey: ['colors', organizationId], 
      refetchType: 'none' // Don't refetch, just mark as stale and trigger re-render
    });
    
    console.log('✨ Optimistic update complete and query invalidated');
  };

  // Optimistic removal of colors (returns a rollback function)
  const removeColorsOptimistically = (colorIds) => {
    const queryKey = ['colors', organizationId];
    const previous = queryClient.getQueryData(queryKey);

    queryClient.setQueryData(queryKey, (oldData) => {
      if (!oldData?.colors) return oldData;
      return {
        ...oldData,
        colors: oldData.colors.filter(c => !colorIds.includes(c.id))
      };
    });

    return () => {
      queryClient.setQueryData(queryKey, previous);
    };
  };

  // Optimistic addition of colors
  const addColorsOptimistically = (newColors) => {
    console.log('🚀 Adding colors optimistically:', newColors.length);
    const queryKey = ['colors', organizationId];
    
    queryClient.setQueryData(queryKey, (oldData) => {
      // Handle case where cache is empty or undefined
      if (!oldData) {
        console.log('📝 Cache was empty, creating initial structure');
        return {
          colors: newColors.map(color => ({ ...color, _optimistic: true })),
          color_books: [],
          color_book_associations: []
        };
      }
      
      // Add optimistic marker and add to beginning of list
      const optimisticColors = newColors.map(color => ({ ...color, _optimistic: true }));
      const updatedColors = [...optimisticColors, ...(oldData.colors || [])];
      
      console.log('✅ Optimistic colors added to cache:', optimisticColors.length);
      
      return {
        ...oldData,
        colors: updatedColors
      };
    });
  };
  // Simplified refetch function - use only invalidateQueries to avoid double-fetch
  const debugRefetch = async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('AppContext - Manual refetch triggered');
    }

    try {
      // Just invalidate - React Query will refetch automatically
      await queryClient.invalidateQueries({ queryKey: ['colors', organizationId] });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('AppContext - Cache invalidated successfully');
      }
    } catch (error) {
      console.error('AppContext - Refetch failed:', error);
      throw error;
    }
  };

  // Improved loading state logic - depend on organizationId rather than profile object
  const isProfileReady = !profileLoading && !!organizationId;
  const isWaitingForProfile = profileLoading || !organizationId;
  const isLoadingData = isLoading && isProfileReady;
  const overallLoading = isWaitingForProfile || isLoadingData;

  const value = useMemo(() => ({
    colors: orgSwitchPending ? [] : (data?.colors || []),
    colorBooks: orgSwitchPending ? [] : (data?.color_books || []),
    associations: orgSwitchPending ? [] : (data?.color_book_associations || []),
    loading: overallLoading || orgSwitchPending,
    error: error?.message || null,
    refetch: debugRefetch,
    refetchColors: debugRefetch, // Alias for compatibility
    updateColorTagsOptimistically,
    updateColorOptimistically,
    removeColorsOptimistically,
    addColorsOptimistically,
    appMode,
    setAppMode,
    navGroupSelections,
    setNavGroupSelections,
  }), [data, overallLoading, error, debugRefetch, updateColorTagsOptimistically, updateColorOptimistically, removeColorsOptimistically, appMode, navGroupSelections, orgSwitchPending]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    // Return safe defaults instead of throwing to prevent provider timing crashes
    return {
      colors: [],
      colorBooks: [],
      associations: [],
      loading: false,
      error: null,
      refetch: async () => {},
      refetchColors: async () => {},
      updateColorTagsOptimistically: () => {},
      updateColorOptimistically: () => {},
      removeColorsOptimistically: () => {},
      addColorsOptimistically: () => {},
      appMode: 'matching',
      setAppMode: () => {},
      navGroupSelections: {},
      setNavGroupSelections: () => {},
    };
  }
  return context;
};

// Removed re-export to avoid circular imports
// export { usePartners } from '@/hooks/usePartners';