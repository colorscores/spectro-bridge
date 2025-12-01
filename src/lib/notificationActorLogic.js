// Notification Actor Resolution Logic
// Uses the same role determination as matchStatusLogic for consistency

/**
 * Maps match measurement state to the organization role that performed the action
 * [state][viewer_role] -> actor_role
 * 
 * This matrix defines WHO performed the action that triggered the notification
 * based on the state and from the perspective of the viewer
 */
export const STATE_ACTOR_MATRIX = {
  'sent-to-shared-with-for-approval': {
    'requestor': 'routed-to',    // routed-to sent match to shared-with
    'shared-with': 'routed-to',  // routed-to sent match to you
    'routed-to': 'routed-to',    // you sent the match
  },
  'sent-to-requestor-for-approval': {
    'requestor': 'shared-with',  // shared-with sent match to you
    'shared-with': 'shared-with', // you sent the match
    'routed-to': 'shared-with',  // shared-with forwarded your match
  },
  'approved-by-shared-with': {
    'requestor': 'shared-with',  // shared-with approved (pending your approval)
    'shared-with': 'shared-with', // you approved
    'routed-to': 'shared-with',  // shared-with approved your match
  },
  'approved-by-requestor': {
    'requestor': 'requestor',    // you approved
    'shared-with': 'requestor',  // requestor approved your match
    'routed-to': 'requestor',    // requestor approved the match
  },
  'rejected-by-shared-with': {
    'requestor': 'shared-with',  // shared-with rejected
    'shared-with': 'shared-with', // you rejected
    'routed-to': 'shared-with',  // shared-with rejected your match
  },
  'rejected-by-requestor': {
    'requestor': 'requestor',    // you rejected
    'shared-with': 'requestor',  // requestor rejected your match
    'routed-to': 'requestor',    // requestor rejected (not visible to routed-to)
  },
  'sent-to-routed-to': {
    'requestor': 'shared-with',  // shared-with routed the job
    'shared-with': 'shared-with', // you routed the job
    'routed-to': 'shared-with',  // shared-with routed to you
  },
  'routed-by-shared-with': {
    'requestor': 'shared-with',  // shared-with routed
    'shared-with': 'shared-with', // you routed
    'routed-to': 'shared-with',  // shared-with routed to you
  }
};

/**
 * Determines the viewer's role based on their organization ID and the notification metadata
 * @param {uuid} viewerOrgId - The organization ID of the viewing user
 * @param {Object} metadata - Notification metadata containing org IDs
 * @returns {string} - The viewer's role: 'requestor', 'shared-with', 'routed-to', or 'unknown'
 */
export const getViewerRole = (viewerOrgId, metadata) => {
  if (!viewerOrgId || !metadata) return 'unknown';

  // Extract org IDs from metadata
  const requestorOrgId = metadata.requestor_org_id || metadata.organization_id;
  const sharedWithOrgId = metadata.shared_with_org_id;
  const routedToOrgId = metadata.routed_to_org_id;

  // Determine role by comparing viewer's org ID
  if (viewerOrgId === requestorOrgId) return 'requestor';
  if (viewerOrgId === sharedWithOrgId) return 'shared-with';
  if (viewerOrgId === routedToOrgId) return 'routed-to';

  return 'unknown';
};

/**
 * Gets the actor organization name for a notification
 * @param {string} state - The match measurement state
 * @param {string} viewerRole - The viewer's role (requestor, shared-with, routed-to)
 * @param {Object} metadata - Notification metadata containing organization names
 * @returns {string} - The name of the organization that performed the action
 */
export const getNotificationActor = (state, viewerRole, metadata) => {
  if (!state || !viewerRole || !metadata) {
    return metadata?.actor_org_name || 'A partner';
  }

  // Get the actor role from the matrix
  const actorRole = STATE_ACTOR_MATRIX[state]?.[viewerRole];
  
  if (!actorRole) {
    // Fallback to metadata if state not in matrix
    return metadata.actor_org_name || 'A partner';
  }

  // Map actor role to organization name
  const roleToOrgNameMap = {
    'requestor': metadata.requestor_org_name,
    'shared-with': metadata.shared_with_org_name,
    'routed-to': metadata.routed_to_org_name
  };

  const actorOrgName = roleToOrgNameMap[actorRole];
  
  // Fallback to generic actor_org_name or default
  return actorOrgName || metadata.actor_org_name || 'A partner';
};

/**
 * Resolves the correct actor organization name for display in a notification
 * This is the main entry point that should be used by notification formatting code
 * 
 * @param {uuid} viewerOrgId - The organization ID of the viewing user
 * @param {Object} metadata - Notification metadata
 * @returns {string} - The resolved actor organization name
 */
export const resolveNotificationActor = (viewerOrgId, metadata) => {
  if (!metadata) return 'A partner';

  // Get the state from metadata
  const state = metadata.state || metadata.match_measurement_state;
  
  if (!state) {
    // No state available, use stored actor_org_name or fallback
    return metadata.actor_org_name || 'A partner';
  }

  // Determine viewer's role
  const viewerRole = getViewerRole(viewerOrgId, metadata);

  // Get the correct actor based on state and viewer role
  return getNotificationActor(state, viewerRole, metadata);
};
