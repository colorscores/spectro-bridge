// Utility functions for notification handling
import { resolveNotificationActor } from './notificationActorLogic';

/**
 * SIMPLIFIED: Get display title and message, preferring database values
 * Only formats if database values are missing (legacy notifications)
 */
export const getNotificationDisplay = (notification, viewerOrgId = null) => {
  const title = notification.title || notification._raw?.title;
  const message = notification.message || notification.description || notification._raw?.message;
  
  // If we have both from database, use them
  if (title && message) {
    return { title, message };
  }
  
  // Otherwise fall back to formatting (legacy support)
  return formatStandardizedNotificationMessage(
    notification.type, 
    notification.metadata || {},
    [],
    viewerOrgId
  );
};

/**
 * Determines if a notification should show color bubbles
 * @param {string} notificationType - The notification type
 * @returns {boolean} - Whether to show color bubbles
 */
export const shouldShowColorBubbles = (notificationType, metadata = {}) => {
  const colorBubbleTypes = [
    // Job status notifications from database triggers
    'job_new',
    'job_routed',
    'job_status_new',
    'job_status_routed',
    'job_status_pending_approval',
    'job_status_approved', 
    'job_status_working',
    'job_status_completed',
    'job_status_overdue',
    'job_status_rejected',
    
    // Match request notifications
    'match_request',
    'match_request_shared',
    'match_update',
    'match_measurement',
    'match_measurement_update',
    'match_routed',
    'sent-to-shared-with-for-approval',
    'sent-to-requestor-for-approval',
    'match_sent_for_approval',
    'match_rejected',
    'match_approved',
    'approved-by-requestor',
    'approved-by-shared-with',
    'approved-by-routed-to',
    'rejected-by-requestor',
    'rejected-by-shared-with',
    'rejected-by-routed-to',
    
    // Color notifications
    'color_shared',
    'color_approved',
    'color_rejected',
    'color_updated',
    
    // Partner notifications with colors
    'partner_share_update'
  ];
  
  // Check for routed notifications specifically - enhanced to catch job_routed type
  if (metadata?.receiver_role?.toLowerCase() === 'routed-to' || 
      metadata?.role?.toLowerCase() === 'routed-to' ||
      notificationType === 'job_routed' ||
      notificationType === 'match_routed' ||
      notificationType === 'job_status_routed') {
    return true;
  }
  
  return colorBubbleTypes.includes(notificationType) || 
         notificationType?.startsWith('job_status_') || 
         notificationType?.startsWith('color_');
};

/**
 * Extracts colors from notification data consistently
 * @param {Object} notification - The notification object
 * @returns {Array} - Array of color objects
 */
export const extractNotificationColors = (notification) => {
  // All notifications (including routed ones) now store colors in the standard colors field
  const colors = notification?.metadata?.colors || [];
  console.log('🎨 extractNotificationColors:', {
    type: notification?.type,
    notificationId: notification?.id,
    metadataKeys: Object.keys(notification?.metadata || {}),
    hasColors: !!colors.length,
    colorsCount: colors.length,
    firstColor: colors[0]?.hex,
    rawColors: colors
  });
  return Array.isArray(colors) ? colors : [];
};

/**
 * Formats notification message using standardized format
 * @param {string} type - The notification type
 * @param {Object} metadata - The notification metadata
 * @param {Array} resolvedColors - Resolved colors from cache/metadata
 * @param {uuid} viewerOrgId - The organization ID of the viewing user (optional)
 * @returns {Object} - Formatted title and message
 */
export const formatStandardizedNotificationMessage = (type, metadata = {}, resolvedColors = [], viewerOrgId = null) => {
  // Resolve the correct actor organization based on viewer role and state
  let actorOrgName = 'A partner';
  
  if (viewerOrgId && metadata.state) {
    // Use the actor resolution logic based on matrices
    actorOrgName = resolveNotificationActor(viewerOrgId, metadata);
  } else {
    // Fallback to stored values
    actorOrgName = metadata.resolved_actor_org_name || metadata.actor_org_name || 'A partner';
  }
  
  const colorCount = resolvedColors.length || metadata.color_count || metadata.colors_routed || 0;
  const jobId = metadata.job_id || metadata.match_request_id;
  const status = metadata.status;

  // Job status notifications
  if (type?.startsWith('job_status_')) {
    // For any job updates, show the shared-with org (destination) first, else routed-to
    const destinationOrgName = metadata.shared_with_org_name || metadata.routed_to_org_name;
    const actorName = destinationOrgName || metadata.actor_org_name || actorOrgName;

    const simpleTitle = `Matching Job Update: ${actorName}`;
    let description = jobId ? `${actorName} has updated your job #${jobId}` : `${actorName} has updated your job`;

    if (colorCount > 0) {
      description += ` with ${colorCount} color${colorCount !== 1 ? 's' : ''}`;
    }

    return { title: simpleTitle, message: description };
  }

  // Legacy job types and routed notifications
  if (type === 'job_new' || type === 'match_request' || metadata.receiver_role === 'routed-to') {
    // Handle routed notifications with special formatting
    if (metadata.receiver_role === 'routed-to') {
      const routedByOrgName = metadata.shared_with_org_name 
        || metadata.from_org_name 
        || metadata.sender_org_name 
        || metadata.organization_name 
        || metadata.actor_org_name 
        || actorOrgName;
      const simpleTitle = `Matches Routed: ${routedByOrgName}`;
      const description = jobId ? `${routedByOrgName} has routed you a matching job #${jobId}` : `${routedByOrgName} has routed you a matching job`;
      const fullDescription = colorCount > 0 ? `${description} with ${colorCount} color${colorCount !== 1 ? 's' : ''}` : description;
      return { title: simpleTitle, message: fullDescription };
    }
    
    // Use already-resolved actor name from context
    const matchRequestActorName = actorOrgName;

    const simpleTitle = `New Matching Job: ${matchRequestActorName}`;
    const description = jobId ? `${matchRequestActorName} has sent you a new matching job #${jobId}` : `${matchRequestActorName} has sent you a new matching job`;
    const fullDescription = colorCount > 0 ? `${description} with ${colorCount} color${colorCount !== 1 ? 's' : ''}` : description;
    return { title: simpleTitle, message: fullDescription };
  }

  // Job routed notification - enhanced with correct organization resolution
  if (type === 'job_routed') {
    // Check if this notification is going to the requestor (receiver_role !== 'routed-to')
    if (metadata.receiver_role !== 'routed-to') {
      // Notification to requestor: shared-with has routed colors
      const sharedWithOrgName = metadata.shared_with_org_name 
        || metadata.actor_org_name 
        || metadata.from_org_name 
        || actorOrgName;
      const simpleTitle = jobId ? `Job ${jobId} is now In Progress` : 'Job is now In Progress';
      const description = jobId ? `${sharedWithOrgName} has updated your matching job ${jobId}` : `${sharedWithOrgName} has updated your matching job`;
      return { title: simpleTitle, message: description };
    }
    
    // Notification to routed-to org: they're receiving the routed job
    const routedByOrgName = metadata.actor_org_name 
      || metadata.shared_with_org_name 
      || metadata.from_org_name 
      || metadata.sender_org_name 
      || metadata.organization_name 
      || metadata.requestor_org_name 
      || actorOrgName;
    const simpleTitle = `Matches Routed: ${routedByOrgName}`;
    const description = jobId ? `${routedByOrgName} has routed you a matching job #${jobId}` : `${routedByOrgName} has routed you a matching job`;
    const fullDescription = colorCount > 0 ? `${description} with ${colorCount} color${colorCount !== 1 ? 's' : ''}` : description;
    return { title: simpleTitle, message: fullDescription };
  }

  // Color notifications
  if (type?.startsWith('color_')) {
    const actionMap = {
      'color_approved': 'approved your colors',
      'color_rejected': 'rejected your colors',
      'color_shared': 'shared colors with you',
      'color_updated': 'updated your shared colors'
    };

    const action = actionMap[type] || 'updated colors';
    const simpleTitle = `Color Update: ${actorOrgName}`;
    const description = `${actorOrgName} has ${action}`;
    const fullDescription = colorCount > 0 ? `${description} (${colorCount} color${colorCount !== 1 ? 's' : ''})` : description;
    return { title: simpleTitle, message: fullDescription };
  }

  // Partner notifications
  if (type === 'partner_invite') {
    const simpleTitle = `Partner Invite: ${actorOrgName}`;
    const description = `${actorOrgName} has invited you to their network`;
    return { title: simpleTitle, message: description };
  }

  if (type === 'partner_status') {
    // For partner status notifications, show the partner org name (who they're connecting to)
    const partnerOrgName = metadata.partner_org_name || metadata.partner_organization_name || actorOrgName;
    const simpleTitle = `Partner Update: ${partnerOrgName}`;
    const description = `${partnerOrgName} has updated partnership status`;
    const fullDescription = status ? `${description} to ${status}` : description;
    return { title: simpleTitle, message: fullDescription };
  }

  if (type === 'partner_share_update') {
    const simpleTitle = `Shared Colors: ${actorOrgName}`;
    const description = `${actorOrgName} has updated your shared colors`;
    const tagName = metadata.tag_name;
    const fullDescription = tagName ? `${description} via tag ${tagName}` : description;
    return { title: simpleTitle, message: fullDescription };
  }

  // Match notifications (legacy)
  if (type === 'match_update') {
    // Check if this is an approval override
    if (metadata.receiver_status === 'Approved' || (metadata.new_state && metadata.new_state.includes('approved'))) {
      // Format like match_approved with enhanced org name resolution
      let approverName = actorOrgName;
      if (metadata.new_state === 'approved-by-shared-with') {
        approverName = metadata.shared_with_org_name || 
                       metadata.approver_org_name || 
                       metadata.from_org_name || 
                       metadata.organization_name || 
                       metadata.actor_org_name || 
                       metadata.requestor_org_name || 
                       'A partner';
      } else if (metadata.new_state === 'approved-by-requestor') {
        approverName = metadata.requestor_org_name || 
                       metadata.approver_org_name || 
                       metadata.from_org_name || 
                       metadata.organization_name || 
                       metadata.actor_org_name || 
                       'A partner';
      }
      
      const simpleTitle = `Match Approved: ${approverName}`;
      const colorName = metadata.color_name ? ` for ${metadata.color_name}` : '';
      const description = jobId ? 
        `${approverName} has approved your match${colorName} for job #${jobId}` : 
        `${approverName} has approved your match${colorName}`;
      return { title: simpleTitle, message: description };
    }
    
    const simpleTitle = `Match Update: ${actorOrgName}`;
    let description = `${actorOrgName} has updated your match`;
    
    // Add more specific context based on receiver_status
    if (metadata.receiver_status) {
      const statusActionMap = {
        'Rejected': 'rejected your color match',
        'New': 'sent you a new match',
        'Working': 'is working on your match',
        'Completed': 'completed your match'
      };
      
      const specificAction = statusActionMap[metadata.receiver_status];
      if (specificAction) {
        description = `${actorOrgName} ${specificAction}`;
      }
    }
    
    // Add job ID if available
    if (jobId) {
      description += ` for Job #${jobId}`;
    }
    
    // Add color count if available
    if (colorCount > 0) {
      description += ` with ${colorCount} color${colorCount !== 1 ? 's' : ''}`;
    }
    
    return { title: simpleTitle, message: description };
  }

  if (type === 'match_measurement') {
    // SIMPLIFIED: Handle as approval if status indicates approval
    if (metadata.status === 'Approved' || metadata.receiver_status === 'Approved') {
      // Extract correct approving organization name
      const approvingOrg = metadata.actor_org_name || 
                          metadata.organization_name || 
                          metadata.requestor_org_name || 
                          actorOrgName || 'Partner';
      
      const colorName = metadata.color_name ? ` (${metadata.color_name})` : '';
      const simpleTitle = `Match Approved${colorName}`;
      const description = jobId ? 
        `${approvingOrg} approved your match in job #${jobId}` : 
        `${approvingOrg} approved your match`;
      return { title: simpleTitle, message: description };
    }
  }

  // Legacy match approval notification - handle both old and new types
  if (type === 'match_sent_for_approval' || type === 'sent-to-shared-with-for-approval' || type === 'sent-to-requestor-for-approval') {
    // Determine sender based on available organization names
    let senderName = 'A partner';
    
    if (type === 'sent-to-shared-with-for-approval') {
      // Routed-to org sending to shared-with for approval
      senderName = metadata.routed_to_org_name || metadata.sender_org_name || 'A partner';
    } else if (type === 'sent-to-requestor-for-approval') {
      // Shared-with org sending to requestor for approval  
      senderName = metadata.shared_with_org_name || metadata.sender_org_name || 'A partner';
    } else {
      // Legacy type - determine sender based on available metadata
      senderName = metadata.shared_with_org_name || 
                   metadata.routed_to_org_name || 
                   metadata.sender_org_name || 
                   metadata.organization_name || 
                   metadata.actor_org_name || 
                   'A partner';
    }
    
    const simpleTitle = `Match Sent: ${senderName}`;
    const colorName = metadata.color_name ? ` for ${metadata.color_name}` : '';
    const description = jobId ? 
      `${senderName} has submitted a new match${colorName} for your approval in job #${jobId}` : 
      `${senderName} has submitted a new match${colorName} for your approval`;
    return { title: simpleTitle, message: description };
  }
  
  // Legacy match_routed and new job_routed notifications
  if (type === 'match_routed' || type === 'job_routed') {
    const routedByOrgName = metadata.actor_org_name 
      || metadata.shared_with_org_name 
      || metadata.from_org_name 
      || metadata.sender_org_name 
      || metadata.organization_name 
      || metadata.requestor_org_name 
      || actorOrgName;
    const simpleTitle = `Matches Routed: ${routedByOrgName}`;
    const description = jobId ? `${routedByOrgName} has routed you a matching job #${jobId}` : `${routedByOrgName} has routed you a matching job`;
    const fullDescription = colorCount > 0 ? `${description} with ${colorCount} color${colorCount !== 1 ? 's' : ''}` : description;
    return { title: simpleTitle, message: fullDescription };
  }
  
  if (type === 'match_rejected') {
    const simpleTitle = `Match Rejected: ${actorOrgName}`;
    const description = jobId ? `${actorOrgName} has rejected your match for job#${jobId}` : `${actorOrgName} has rejected your match`;
    return { title: simpleTitle, message: description };
  }
  
  if (type === 'match_approved') {
    // Enhanced org name resolution with broader fallbacks to prevent "A partner"
    let approverName = actorOrgName;
    
    // Handle different approval states, with fallback to 'state' if 'new_state' is missing
    const approvalState = metadata.new_state || metadata.state;
    
    if (approvalState === 'approved-by-shared-with') {
      approverName = metadata.shared_with_org_name || 
                     metadata.approver_org_name || 
                     metadata.from_org_name || 
                     metadata.organization_name || 
                     metadata.actor_org_name || 
                     metadata.requestor_org_name || 
                     metadata.routed_to_org_name || 
                     metadata.receiver_org_name || 
                     actorOrgName || 
                     'A partner';
    } else if (approvalState === 'approved-by-requestor') {
      approverName = metadata.requestor_org_name || 
                     metadata.approver_org_name || 
                     metadata.from_org_name || 
                     metadata.organization_name || 
                     metadata.actor_org_name || 
                     metadata.shared_with_org_name || 
                     metadata.routed_to_org_name || 
                     metadata.receiver_org_name || 
                     actorOrgName || 
                     'A partner';
    } else {
      // Fallback for unknown states - use the most reliable organization name available
      approverName = metadata.actor_org_name || 
                     metadata.requestor_org_name || 
                     metadata.shared_with_org_name || 
                     metadata.approver_org_name || 
                     metadata.from_org_name || 
                     metadata.organization_name || 
                     metadata.routed_to_org_name || 
                     metadata.receiver_org_name || 
                     actorOrgName || 
                     'A partner';
    }
    
    const simpleTitle = `Match Approved: ${approverName}`;
    const colorName = metadata.color_name ? ` for ${metadata.color_name}` : '';
    const description = jobId ? 
      `${approverName} has approved your match${colorName} for job #${jobId}` : 
      `${approverName} has approved your match${colorName}`;
    return { title: simpleTitle, message: description };
  }

  // Default fallback
  return {
    title: metadata.title || 'Notification',
    message: metadata.message || 'You have a new notification'
  };
};