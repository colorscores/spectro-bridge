import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// ============================================================================
// NEW: Simple routing using self-describing metadata (Phase 2)
// ============================================================================

/**
 * NEW: Routes notifications using self-describing metadata (scope + colors)
 * Returns null if metadata doesn't have new fields (triggers legacy fallback)
 */
const getNotificationRouteNew = (notification) => {
  const { metadata } = notification;
  
  // Check for new self-describing metadata
  if (!metadata?.scope) {
    return null; // Signal to use legacy routing
  }
  
  console.log('[Routing NEW] Using self-describing metadata:', { scope: metadata.scope, colorCount: metadata.colors?.length });
  
  // Match/Job notifications with explicit scope
  if (metadata.scope === 'color') {
    return {
      route: `/color-matches/${metadata.match_request_id}/matching/${metadata.color_id}`,
      appMode: 'matching',
      navSelection: '/color-matches'
    };
  }
  
  if (metadata.scope === 'job') {
    return {
      route: `/color-matches/${metadata.match_request_id}`,
      appMode: 'matching',
      navSelection: '/color-matches'
    };
  }
  
  return null;
};

// ============================================================================
// LEGACY: Complex routing (kept for rollback compatibility)
// ============================================================================

/**
 * LEGACY: Resolves color-in-job notification routing deterministically
 */
const resolveColorInJobRoute = async (metadata) => {
  console.log('🎯 Resolving color-in-job notification:', metadata);
  
  // Direct match context: both IDs present
  if (metadata?.match_request_id && metadata?.color_id) {
    console.log('✅ Direct match context found');
    return {
      route: `/color-matches/${metadata.match_request_id}/matching/${metadata.color_id}`,
      appMode: 'matching',
      navSelection: '/color-matches'
    };
  }
  
  // Measurement lookup: find match context via measurement ID
  if (metadata?.match_measurement_id) {
    console.log('🔍 Looking up match context via measurement ID');
    try {
      const { data: measurement } = await supabase
        .from('match_measurements')
        .select('color_id, match_request_id')
        .eq('id', metadata.match_measurement_id)
        .maybeSingle();
        
      if (measurement) {
        console.log('✅ Found match context via measurement');
        return {
          route: `/color-matches/${measurement.match_request_id}/matching/${measurement.color_id}`,
          appMode: 'matching',
          navSelection: '/color-matches'
        };
      }
    } catch (error) {
      console.error('❌ Measurement lookup failed:', error);
    }
  }
  
  console.error('❌ Cannot resolve color-in-job route - insufficient data');
  return null;
};

/**
 * LEGACY: Classifies notification type into routing categories
 */
export const classifyNotification = (type) => {
  if (type?.startsWith('job_') || type?.startsWith('job_status_')) return 'job';
  if (type === 'match_measurement' || type?.includes('measurement')) return 'color';
  if (type?.startsWith('color_') || type === 'partner_share_update') return 'color';
  if (type?.startsWith('match_') || ['match_request', 'match_update', 'match_approved', 'sent-to-shared-with-for-approval', 'sent-to-requestor-for-approval'].includes(type)) return 'job';
  if (type?.startsWith('partner_')) return 'partner';
  return 'unknown';
};

/**
 * MAIN ENTRY POINT: Try new routing, fall back to legacy
 */
export const getNotificationRoute = async (notification) => {
  const { type, metadata } = notification;
  
  // ===== PHASE 2: Try new self-describing routing first =====
  const newRoute = getNotificationRouteNew(notification);
  if (newRoute) {
    console.log('[Routing] ✅ Using NEW self-describing routing:', newRoute);
    return newRoute;
  }
  
  console.log('[Routing] ⏭️ Falling back to LEGACY routing');
  
  // ===== Partner notifications (unchanged) =====
  if (type?.startsWith('partner_')) {
    return {
      route: '/admin/partners',
      appMode: 'admin',
      navSelection: '/admin/partners'
    };
  }
  
  // Color sharing notifications (unchanged)
  if (type === 'partner_share_update') {
    return {
      route: '/colors',
      appMode: 'colors',
      navSelection: '/colors'
    };
  }
  
  // ===== LEGACY ROUTING (for old notifications) =====
  return getNotificationRouteLegacy(notification);
};

/**
 * LEGACY: Original complex routing logic (kept for backward compatibility)
 */
const getNotificationRouteLegacy = async (notification) => {
  const { type, metadata } = notification;

  // Deterministic color-in-job routing
  if (metadata?.match_measurement_id || (metadata?.match_request_id && metadata?.color_id)) {
    const colorRoute = await resolveColorInJobRoute(metadata);
    if (colorRoute) {
      return colorRoute;
    }
    toast({
      title: 'Navigation Error',
      description: 'Unable to navigate to color - insufficient or invalid notification data',
      variant: 'destructive',
    });
    return null;
  }

  // Category-based routing
  const category = classifyNotification(type);
  
  switch (category) {
    case 'job':
      // Special case: approval notifications with single color should deep-link to color-in-match page
      if (metadata?.match_request_id && (type === 'sent-to-shared-with-for-approval' || type === 'sent-to-requestor-for-approval')) {
        const colors = metadata?.colors || metadata?.routed_colors || [];
        if (colors.length === 1) {
          console.log('🎯 Single color approval notification - routing to color-in-match page');
          return {
            route: `/color-matches/${metadata.match_request_id}/matching/${colors[0].id}`,
            appMode: 'matching',
            navSelection: '/color-matches'
          };
        }
      }
      
      // Job status notifications go to job details page
      if (metadata?.match_request_id) {
        return {
          route: `/color-matches/${metadata.match_request_id}`,
          appMode: 'matching',
          navSelection: '/color-matches'
        };
      }
      
      // Lookup matchId via jobId
      if (metadata?.job_id) {
        try {
          const { data: matchRequest } = await supabase
            .from('match_requests')
            .select('id')
            .eq('job_id', metadata.job_id)
            .maybeSingle();
            
          if (matchRequest) {
            return {
              route: `/color-matches/${matchRequest.id}`,
              appMode: 'matching',
              navSelection: '/color-matches'
            };
          }
        } catch (error) {
          console.error('❌ Error looking up match request by job_id:', error);
        }
      }
      
      return {
        route: '/color-matches',
        appMode: 'matching',
        navSelection: '/color-matches'
      };
    
    case 'color':
      // Color-in-job notifications: resolve deterministically
      const colorRoute = await resolveColorInJobRoute(metadata);
      if (colorRoute) {
        return colorRoute;
      }
      
      // Failed to resolve - show error and don't navigate
      toast({
        title: "Navigation Error",
        description: "Unable to navigate to color - insufficient notification data",
        variant: "destructive"
      });
      console.error('❌ Color notification routing failed - insufficient data');
      return null;
    
    case 'partner':
      return {
        route: '/admin/partners',
        appMode: 'admin',
        navSelection: '/admin/partners'
      };
    
    default:
      return {
        route: '/dashboard',
        appMode: 'matching',
        navSelection: null
      };
  }
};

/**
 * Main navigation handler for notifications
 */
export const handleNotificationNavigation = async (notification, navigate, setAppMode, setNavGroupSelections) => {
  try {
    const routeInfo = await getNotificationRoute(notification);
    
    // If routing failed, don't navigate
    if (!routeInfo) {
      console.log('❌ Navigation cancelled - routing failed');
      return;
    }
    
    console.log('✅ Navigating to:', routeInfo);
    
    // Set app mode and navigation memory
    setAppMode(routeInfo.appMode);
    if (routeInfo.navSelection) {
      setNavGroupSelections(prev => ({
        ...prev,
        [routeInfo.appMode]: routeInfo.navSelection
      }));
    }
    
    // Navigate to the route
    navigate(routeInfo.route);
    
  } catch (error) {
    console.error('❌ Error in notification navigation:', error);
    // Fallback navigation
    navigate('/dashboard');
  }
};
