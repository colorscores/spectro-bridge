// Notification consolidation engine

import { 
  getEntityKey, 
  getStatePriority, 
  resolveConsolidatedColors,
  resolveConsolidatedOrgName,
  getConsolidationRules
} from './notificationSpecs';
import { formatStandardizedNotificationMessage } from './notificationUtils';
import { normalizeColors } from './colorNormalization';

/**
 * Consolidates notifications by logical entity, showing only the most relevant state
 * @param {Array} notifications - Raw notifications from database
 * @param {Object} colorCaches - Color caches by match_request_id and job_id
 * @returns {Array} - Consolidated notifications ready for display
 */
export const consolidateNotifications = (notifications, colorCaches = { byMatchRequest: new Map(), byJobId: new Map() }) => {
  if (!notifications || notifications.length === 0) {
    return [];
  }
  
  
  // Group notifications by entity key
  const entityGroups = new Map();
  
  notifications.forEach(notification => {
    const entityKey = getEntityKey(notification);
    
    if (!entityGroups.has(entityKey)) {
      entityGroups.set(entityKey, []);
    }
    
    entityGroups.get(entityKey).push(notification);
  });
  
  
  // Consolidate each group
  const consolidated = [];
  
  for (const [entityKey, groupNotifications] of entityGroups.entries()) {
    const consolidatedNotification = consolidateGroup(groupNotifications, colorCaches);
    
    if (consolidatedNotification) {
      consolidated.push(consolidatedNotification);
    }
  }
  
  // Sort by created_at descending (newest first)
  consolidated.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  
  return consolidated;
};

/**
 * Consolidates a group of notifications for the same entity
 */
const consolidateGroup = (notifications, colorCaches) => {
  if (notifications.length === 0) return null;
  
  // Sort by priority (highest first), then by created_at (newest first)
  notifications.sort((a, b) => {
    const priorityDiff = getStatePriority(b) - getStatePriority(a);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  
  const primaryNotification = notifications[0];
  
  // SIMPLIFIED: Resolve consolidated data
  const consolidatedColors = resolveConsolidatedColors(notifications, colorCaches);
  const consolidatedOrgName = resolveConsolidatedOrgName(notifications);
  
  // SIMPLIFIED: Create enriched metadata with deterministic actor name
  const enrichedMetadata = {
    ...primaryNotification.metadata,
    actor_org_name: consolidatedOrgName || primaryNotification.metadata?.actor_org_name || 'Partner',
    colors: consolidatedColors.map(color => ({
      ...color,
      // Preserve is_routed flag for routed contexts, set true for single color approvals in routed contexts
      is_routed: color.is_routed || (consolidatedColors.length === 1 && (
        primaryNotification.metadata?.receiver_role?.toLowerCase() === 'routed-to' ||
        primaryNotification.type?.includes('routed')
      ))
    }))
  };
  
  // Format the notification message
  const { title, message } = formatStandardizedNotificationMessage(
    primaryNotification.type,
    enrichedMetadata,
    consolidatedColors
  );
  
  // SIMPLIFIED: Create consolidated notification
  const consolidated = {
    ...primaryNotification,
    title,
    message,
    metadata: enrichedMetadata,
    
    // Minimal consolidation metadata
    originalCount: notifications.length,
    consolidatedFrom: notifications.map(n => n.id),
    entityKey: getEntityKey(primaryNotification)
  };
  
  
  return consolidated;
};

/**
 * Validates consolidation integrity (for debugging)
 */
export const validateConsolidation = (original, consolidated) => {
  const issues = [];
  
  // Check that we haven't lost notifications
  const originalIds = new Set(original.map(n => n.id));
  const consolidatedIds = new Set(consolidated.flatMap(n => n.consolidatedFrom || [n.id]));
  
  if (originalIds.size !== consolidatedIds.size) {
    issues.push(`ID count mismatch: original ${originalIds.size}, consolidated ${consolidatedIds.size}`);
  }
  
  // Check for missing IDs
  for (const id of originalIds) {
    if (!consolidatedIds.has(id)) {
      issues.push(`Missing notification ID: ${id}`);
    }
  }
  
  // Check for duplicate IDs
  const consolidatedIdArray = consolidated.flatMap(n => n.consolidatedFrom || [n.id]);
  const duplicates = consolidatedIdArray.filter((id, index) => consolidatedIdArray.indexOf(id) !== index);
  if (duplicates.length > 0) {
    issues.push(`Duplicate IDs in consolidation: ${duplicates.join(', ')}`);
  }
  
  return issues;
};
