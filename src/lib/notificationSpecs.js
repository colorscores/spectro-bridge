// Notification specifications and rules for consolidation

import { normalizeColors } from './colorNormalization';

/**
 * Defines how to generate entity keys for consolidation
 */
export const getEntityKey = (notification) => {
  const typeStr = String(notification?.type || '');
  const md = notification?.metadata || {};

  // Normalize common identifiers from multiple possible fields
  const jobId = md.job_id || notification.job_id;
  const matchId = md.match_request_id || md.request_id;
  const measurementId = md.measurement_id || md.match_measurement_id || md.measure_id;
  const colorId = (
    md.color_id ||
    md.match_color_id ||
    md.measurement_color_id ||
    md.color?.id ||
    (Array.isArray(md.colors) && md.colors.length === 1
      ? (md.colors[0].id || md.colors[0].color_id || md.colors[0].hex)
      : undefined) ||
    md.color_hex ||
    md.hex
  );

  const isMatchWorkflow = (
    typeStr.includes('match') ||
    typeStr.includes('measurement') ||
    md.receiver_role === 'shared-with' ||
    md.receiver_role === 'routed-to'
  );

  // Detect routed context for unified consolidation
  const isRoutedContext = (
    typeStr.includes('routed') ||
    md.receiver_role === 'routed-to' ||
    md.action === 'routed_to'
  );

  // CRITICAL FIX: Unify all routed notifications under a single key
  if (isRoutedContext && jobId) {
    const receiverOrg = md.routed_to_org_id || notification.organization_id;
    if (receiverOrg) {
      return `routed:${jobId}:${receiverOrg}`;
    }
    return `routed:${jobId}`;
  }

  // Match-related notifications: Use color_id or measurement_id for specific grouping
  if (isMatchWorkflow) {
    // For specific color actions, group by match + color to avoid cross-color pollution
    if (matchId && colorId && (typeStr.includes('rejected') || typeStr.includes('approved') || md.receiver_status)) {
      return `match:${matchId}:color:${colorId}`;
    }
    // For shared-with and routed-to contexts without specific color, group by match only
    if ((md.receiver_role === 'shared-with' || md.receiver_role === 'routed-to') && matchId) {
      
      return `match:${matchId}`;
    }
    if (matchId && (colorId || measurementId)) {
      const dim = colorId ? `color:${colorId}` : `measurement:${measurementId}`;
      
      return `match:${matchId}:${dim}`;
    }
    if (jobId && (colorId || measurementId)) {
      const dim = colorId ? `color:${colorId}` : `measurement:${measurementId}`;
      
      return `job:${jobId}:${dim}`;
    }
    if (matchId) return `match:${matchId}`;
    if (jobId) return `job:${jobId}`;
  }

  // Job-related notifications consolidate by job_id (+ color when present)
  if (typeStr.includes('job')) {
    if (jobId && colorId) return `job:${jobId}:color:${colorId}`;
    if (jobId && measurementId) return `job:${jobId}:measurement:${measurementId}`;
    if (jobId) return `job:${jobId}`;
  }

  // Color-related notifications consolidate by color_id (fallback to match_request_id)
  if (typeStr.includes('color')) {
    if (colorId) return `color:${colorId}`;
    if (matchId) return `match:${matchId}:colors`;
  }

  // Partner notifications consolidate by organization pair
  if (typeStr.includes('partner')) {
    const orgId = md.organization_id;
    const partnerOrgId = md.partner_org_id || md.shared_with_org_id;
    if (orgId && partnerOrgId) return `partner:${orgId}:${partnerOrgId}`;
  }

  // Default: unique per notification
  return `unique:${notification.id}`;
};

/**
 * Defines state priority for consolidation (higher number = higher priority)
 */
export const getStatePriority = (notification) => {
  const { type, metadata = {} } = notification;
  
  // Match workflow priorities
  if (type === 'match_approved' || metadata.receiver_status === 'Approved') {
    return 100; // Highest priority - final state
  }
  
  if (type === 'match_rejected' || metadata.receiver_status === 'Rejected') {
    return 90; // High priority - final state
  }
  
  if (type === 'sent-to-shared-with-for-approval' || type === 'sent-to-requestor-for-approval') {
    return 80; // Medium-high priority - active state
  }
  
  if (type === 'match_measurement') {
    // Higher priority for approved match_measurement notifications
    if (metadata.status === 'Approved' || metadata.receiver_status === 'Approved') {
      return 100; // Highest priority - same as match_approved
    }
    return 70; // Medium priority - progress state
  }

  if (type === 'match_update') {
    return 60; // Medium priority - general update
  }
  
  if (type === 'match_request' || type === 'job_new') {
    return 50; // Medium priority - initial state
  }
  
  // CRITICAL FIX: Color-aware routed notifications have higher priority
  if (type === 'job_routed' || type === 'match_routed') {
    return 78; // Higher than job_status_routed
  }
  
  // Job status priorities
  if (type === 'job_status_completed') {
    return 100; // Final state
  }
  
  if (type === 'job_status_rejected') {
    return 90; // Final state
  }
  
  if (type === 'job_status_approved') {
    return 85; // Near-final state
  }
  
  if (type === 'job_status_working') {
    return 75; // Active state
  }
  
  if (type === 'job_status_pending_approval') {
    return 70; // Waiting state
  }
  
  if (type === 'job_status_routed') {
    return 65; // Progress state
  }
  
  if (type === 'job_status_new') {
    return 60; // Initial state
  }
  
  // Color workflow priorities
  if (type === 'color_approved') {
    return 100; // Final state
  }
  
  if (type === 'color_rejected') {
    return 90; // Final state
  }
  
  if (type === 'color_shared') {
    return 60; // Initial state
  }
  
  if (type === 'color_updated') {
    return 70; // Progress state
  }
  
  // Default priority
  return 50;
};

/**
 * Helper function to safely read from either Map or object caches
 */
function getFromCache(cache, key) {
  if (!cache || !key) return [];
  
  // Handle Map objects
  if (cache.get && typeof cache.get === 'function') {
    return cache.get(key) || [];
  }
  
  // Handle plain objects
  if (typeof cache === 'object') {
    return cache[key] || [];
  }
  
  return [];
}

// Robust helper functions for cache lookups (handles string/number key variations)
const getFromMap = (map, key) => {
  if (!map || key == null) return null;
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

// Helper function to filter colors by routing status
const filterColorsByRouted = (colors, isRouted) => {
  if (!colors || !Array.isArray(colors)) return [];
  return colors.filter(color => Boolean(color.is_routed) === isRouted);
};

/**
 * SIMPLIFIED: Determines which colors to display for consolidated notifications
 * Single color for approvals, routed-only for routed contexts
 */
export const resolveConsolidatedColors = (notifications, colorCaches = { byMatchRequest: new Map(), byJobId: new Map() }) => {
  if (!notifications || notifications.length === 0) return [];
  
  const primaryNotification = notifications[0];
  const metadata = primaryNotification?.metadata || {};
  

  // RULE 1: Single color for individual approvals (highest priority)
  if (metadata.color_id) {
    
    
    // Look in existing arrays first
    if (Array.isArray(metadata.colors)) {
      const found = metadata.colors.find(c => (c.id || c.color_id) === metadata.color_id);
      if (found) {
        
        return normalizeColors([found]);
      }
    }
    if (Array.isArray(metadata.routed_colors)) {
      const found = metadata.routed_colors.find(c => (c.id || c.color_id) === metadata.color_id);
      if (found) {
        
        return normalizeColors([found]);
      }
    }
    
    // Try caches before falling back to gray
    const tryCachedByMatch = metadata.match_request_id && hasInMap(colorCaches.byMatchRequest, metadata.match_request_id)
      ? getFromMap(colorCaches.byMatchRequest, metadata.match_request_id)
      : null;
    const tryCachedByJob = metadata.job_id && hasInMap(colorCaches.byJobId, metadata.job_id)
      ? getFromMap(colorCaches.byJobId, metadata.job_id)
      : null;
    const fromCaches = ([])
      .concat(Array.isArray(tryCachedByMatch) ? tryCachedByMatch : [])
      .concat(Array.isArray(tryCachedByJob) ? tryCachedByJob : []);
    if (fromCaches.length > 0) {
      const found = fromCaches.find(c => (c.id || c.color_id) === metadata.color_id);
      if (found) {
        
        return normalizeColors([found]);
      }
    }
    
    // CRITICAL: For color-specific notifications, don't fallback to gray placeholder
    // Return empty array to let the UI layer handle the color lookup
    
    return [];
  }

  // RULE 2: For approvals and submissions, show single color if available
  const isApproval = primaryNotification.type === 'match_approved' || 
                   primaryNotification.type === 'sent-to-shared-with-for-approval' ||
                   primaryNotification.type === 'sent-to-requestor-for-approval' ||
                   (primaryNotification.type === 'match_measurement' && 
                    (metadata.status === 'Approved' || metadata.receiver_status === 'Approved')) ||
                   (primaryNotification.type === 'match_measurement' && 
                    (metadata.status === 'Submitted' || metadata.receiver_status === 'Submitted' || 
                     metadata.match_measurement_state?.includes('sent-to')));
  
  if (isApproval) {
    
    
    // Prefer routed colors for approvals
    if (Array.isArray(metadata.routed_colors) && metadata.routed_colors.length > 0) {
      return normalizeColors([metadata.routed_colors[0]]); // Just the first one
    }
    
    if (Array.isArray(metadata.colors) && metadata.colors.length > 0) {
      return normalizeColors([metadata.colors[0]]); // Just the first one
    }
  }

    // RULE 3: For routed contexts, show only routed colors
    const isRoutedContext = metadata.receiver_role?.toLowerCase() === 'routed-to' || 
                           metadata.role?.toLowerCase() === 'routed-to' ||
                           primaryNotification.type?.includes('routed') ||
                           primaryNotification.type === 'job_routed' ||
                           primaryNotification.type === 'job_status_routed';
    
    
    if (isRoutedContext) {
      
      
      // Prefer metadata.routed_colors when present
      if (Array.isArray(metadata.routed_colors) && metadata.routed_colors.length > 0) {
        
        return normalizeColors(metadata.routed_colors);
      }
      
      // Filter regular colors for routed ones
      if (Array.isArray(metadata.colors)) {
        const routedOnly = metadata.colors.filter(c => c.is_routed === true);
        if (routedOnly.length > 0) {
          
          return normalizeColors(routedOnly);
        }
      }
      
      // Cache fallback - prioritize routed-by-job cache for job-level routed notifications
      if (metadata.job_id && hasInMap(colorCaches.byRoutedJobId, metadata.job_id)) {
        const cached = getFromMap(colorCaches.byRoutedJobId, metadata.job_id);
        if (cached && cached.length > 0) {
          
          return normalizeColors(cached);
        }
      }
      
      // CRITICAL FALLBACK: For job_routed notifications without explicit routed flags,
      // show all available colors to prevent empty bubbles
      if (primaryNotification.type === 'job_routed' && Array.isArray(metadata.colors) && metadata.colors.length > 0) {
        
        return normalizeColors(metadata.colors.map(c => ({ ...c, is_routed: true })));
      }
      
      // CRITICAL FIX: In routed context with no routed colors, return empty array
      
      return [];
    }

  // RULE 4: Default - show all available colors
  if (Array.isArray(metadata.colors) && metadata.colors.length > 0) {
    
    return normalizeColors(metadata.colors);
  }

  // RULE 5: Cache fallback (using robust lookup)
  if (metadata.match_request_id && hasInMap(colorCaches.byMatchRequest, metadata.match_request_id)) {
    const cached = getFromMap(colorCaches.byMatchRequest, metadata.match_request_id);
    if (cached && cached.length > 0) {
      return normalizeColors(cached);
    }
  }

  if (metadata.job_id && hasInMap(colorCaches.byJobId, metadata.job_id)) {
    const cached = getFromMap(colorCaches.byJobId, metadata.job_id);
    if (cached && cached.length > 0) {
      
      return normalizeColors(cached);
    }
  }
  
  if (metadata.match_request_id && hasInMap(colorCaches.byMatchRequest, metadata.match_request_id)) {
    const cached = getFromMap(colorCaches.byMatchRequest, metadata.match_request_id);
    if (cached && cached.length > 0) {
      
      return normalizeColors(cached);
    }
  }

  
  return [];
};

/**
 * Defines how to resolve organization names for consolidated notifications
 */
export const resolveConsolidatedOrgName = (notifications) => {
  if (notifications.length === 0) return 'A partner';
  
  // Use the highest priority notification for org resolution
  const primaryNotification = notifications[0];
  const { metadata = {}, type = '' } = primaryNotification;
  
  // Special handling for partner notifications
  if (type === 'partner_status' || type === 'partner_invite') {
    // For partner notifications, prioritize showing the partner's name
    if (metadata.partner_org_name || metadata.partner_organization_name) {
      return metadata.partner_org_name || metadata.partner_organization_name;
    }
  }
  
  // Special handling for specific approval notifications
  if (type === 'sent-to-shared-with-for-approval') {
    return metadata.routed_to_org_name || metadata.sender_org_name || 'A partner';
  }
  
  if (type === 'sent-to-requestor-for-approval') {
    return metadata.shared_with_org_name || metadata.sender_org_name || 'A partner';
  }
  
  // Priority order for organization name resolution
  let orgNameKeys = [];
  // Special case: match_request should display the sender (requestor)
  if (type === 'match_request') {
    orgNameKeys = [
      'requestor_org_name',
      'actor_org_name',
      'sender_org_name',
      'from_org_name',
      'organization_name',
      'shared_with_org_name',
      'routed_to_org_name',
      'owner_org_name',
      'inviter_org_name',
      'brand_org_name'
    ];
  } else if (type === 'job_routed') {
    // Special case: job_routed should display the shared-with organization (the one doing the routing)
    orgNameKeys = [
      'shared_with_org_name',
      'actor_org_name',
      'routed_to_org_name',
      'requestor_org_name',
      'sender_org_name',
      'from_org_name',
      'brand_org_name',
      'inviter_org_name',
      'owner_org_name',
      'organization_name'
    ];
  } else {
    const isJobType = type.startsWith('job_status_') || type === 'job_new' || type.startsWith('job_');
    if (isJobType) {
      // For job-related notifications, prefer the shared-with organization (destination)
      orgNameKeys = [
        'shared_with_org_name',
        'routed_to_org_name',
        'actor_org_name',
        'requestor_org_name',
        'sender_org_name',
        'from_org_name',
        'brand_org_name',
        'inviter_org_name',
        'owner_org_name',
        'organization_name'
      ];
    } else {
      orgNameKeys = [
        'actor_org_name',
        'requestor_org_name', 
        'shared_with_org_name',
        'routed_to_org_name',
        'sender_org_name',
        'from_org_name',
        'brand_org_name',
        'inviter_org_name',
        'owner_org_name',
        'organization_name'
      ];
    }
  }
  
  for (const key of orgNameKeys) {
    if (metadata[key] && metadata[key] !== 'undefined') {
      return metadata[key];
    }
  }
  
  return 'A partner';
};

/**
 * SIMPLIFIED: Returns basic consolidation rules
 */
export const getConsolidationRules = (notifications) => {
  if (!notifications || notifications.length === 0) {
    return { title: 'Unknown', showLatestOnly: true };
  }
  
  const primaryType = notifications[0]?.type;
  const metadata = notifications[0]?.metadata || {};
  
  // Simplified categorization
  if (primaryType?.includes('match') || primaryType?.includes('job')) {
    return {
      title: metadata.job_id ? `Job #${metadata.job_id}` : 'Match Request',
      showLatestOnly: true
    };
  }
  
  if (primaryType?.includes('color')) {
    return {
      title: 'Color Update', 
      showLatestOnly: true
    };
  }
  
  return {
    title: 'Notification',
    showLatestOnly: true
  };
};