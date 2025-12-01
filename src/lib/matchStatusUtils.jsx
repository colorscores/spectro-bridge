import React from 'react';
import { Save, Clock, CheckCircle, XCircle, Send, Play, RotateCcw, Eye, ArrowRight, Archive } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';


// Helper function to get organization role in match request
const getOrgRole = (matchRequest, userOrgId, measurement, userOrgName) => {
  if (!matchRequest || !userOrgId) return 'unknown';
  
  // Check if user is the requestor
  if (userOrgId === matchRequest.organization_id) {
    return 'requestor';
  }
  
  // Check if user is shared-with recipient  
  if (userOrgId === matchRequest.shared_with_org_id) {
    return 'shared-with';
  }
  
  // Check if user is routed-to recipient
  if (userOrgId === matchRequest.routed_to_org_id) {
    return 'routed-to';
  }
  
  return 'unknown';
};

// Map roles to matrix roles  
const mapToMatrixRole = (role) => {
  switch (role) {
    case 'requestor':
      return 'requestor';
    case 'shared-with':
      return 'shared-with';
    case 'routed-to':
      return 'routed-to';
    default:
      return 'shared-with';
  }
};

// Role-Based Status Matrix - supports different displays per role
const STATUS_MATRIX = {
  'empty': {
    'requestor': { text: 'New', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-gray-500' },
    'shared-with': { text: 'New', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-gray-500' },
    'routed-to': { text: 'New', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-gray-500' },
    'default': { text: 'New', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-gray-500' }
  },
  'saved-by-shared-with': {
    'requestor': { text: 'In Progress', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'shared-with': { text: 'Saved', icon: <Save className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'routed-to': null, // N/A - should not be shown
    'default': { text: 'In Progress', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-blue-600' }
  },
  'saved-by-routed-to': {
    'requestor': { text: 'In Progress', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'shared-with': { text: 'In Progress', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'routed-to': { text: 'Saved', icon: <Save className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'default': { text: 'In Progress', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-blue-600' }
  },
  'sent-to-requestor-for-approval': {
    'requestor': { text: 'Waiting for Approval', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'shared-with': { text: 'Sent for Approval', icon: <Send className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'routed-to': { text: 'Approved', icon: <CheckCircle className="h-4 w-4 mr-2" />, color: 'text-green-600' },
    'default': { text: 'Sent for Approval', icon: <Send className="h-4 w-4 mr-2" />, color: 'text-blue-600' }
  },
  'sent-to-shared-with-for-approval': {
    'requestor': { text: 'In Progress', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'shared-with': { text: 'Waiting for Approval', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'routed-to': { text: 'Sent for Approval', icon: <Send className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'default': { text: 'Sent for Approval', icon: <Send className="h-4 w-4 mr-2" />, color: 'text-blue-600' }
  },
  'routed-by-shared-with': {
    'requestor': { text: 'In Progress', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'shared-with': { text: 'Routed', icon: <ArrowRight className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'routed-to': { text: 'New', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'default': { text: 'Routed', icon: <ArrowRight className="h-4 w-4 mr-2" />, color: 'text-blue-600' }
  },
  'approved-by-shared-with': {
    'requestor': { text: 'In Progress', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-green-600' },
    'shared-with': { text: 'Routed Match Approved', icon: <CheckCircle className="h-4 w-4 mr-2" />, color: 'text-green-600' },
    'routed-to': { text: 'Approved', icon: <CheckCircle className="h-4 w-4 mr-2" />, color: 'text-green-600' },
    'default': { text: 'Routed Match Approved', icon: <CheckCircle className="h-4 w-4 mr-2" />, color: 'text-green-600' }
  },
  'approved-by-requestor': {
    'requestor': { text: 'Approved', icon: <CheckCircle className="h-4 w-4 mr-2" />, color: 'text-green-600' },
    'shared-with': { text: 'Approved', icon: <CheckCircle className="h-4 w-4 mr-2" />, color: 'text-green-600' },
    'routed-to': { text: 'Approved', icon: <CheckCircle className="h-4 w-4 mr-2" />, color: 'text-green-600' },
    'default': { text: 'Approved', icon: <CheckCircle className="h-4 w-4 mr-2" />, color: 'text-green-600' }
  },
  'approved-by-routed-to': {
    'requestor': { text: 'In Progress', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-green-600' },
    'shared-with': { text: 'Approved', icon: <CheckCircle className="h-4 w-4 mr-2" />, color: 'text-green-600' },
    'routed-to': { text: 'Approved', icon: <CheckCircle className="h-4 w-4 mr-2" />, color: 'text-green-600' },
    'default': { text: 'Approved', icon: <CheckCircle className="h-4 w-4 mr-2" />, color: 'text-green-600' }
  },
  'rejected-by-shared-with': {
    'requestor': { text: 'In Progress', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-red-600' },
    'shared-with': { text: 'Routed Match Rejected', icon: <XCircle className="h-4 w-4 mr-2" />, color: 'text-red-600' },
    'routed-to': { text: 'Rejected', icon: <XCircle className="h-4 w-4 mr-2" />, color: 'text-red-600' },
    'default': { text: 'Routed Match Rejected', icon: <XCircle className="h-4 w-4 mr-2" />, color: 'text-red-600' }
  },
  'rejected-by-requestor': {
    'requestor': { text: 'Rejected', icon: <XCircle className="h-4 w-4 mr-2" />, color: 'text-red-600' },
    'shared-with': { text: 'Rejected', icon: <XCircle className="h-4 w-4 mr-2" />, color: 'text-red-600' },
    'routed-to': null, // N/A - should not be shown
    'default': { text: 'Rejected', icon: <XCircle className="h-4 w-4 mr-2" />, color: 'text-red-600' }
  },
  'rematch-by-shared-with': {
    'requestor': { text: 'In Re-match', icon: <RotateCcw className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'shared-with': { text: 'In Re-match', icon: <RotateCcw className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'routed-to': { text: 'In Re-match', icon: <RotateCcw className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'default': { text: 'In Re-match', icon: <RotateCcw className="h-4 w-4 mr-2" />, color: 'text-blue-600' }
  },
  'rematch-by-routed-to': {
    'requestor': { text: 'In Progress', icon: <Clock className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'shared-with': { text: 'In Re-match', icon: <RotateCcw className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'routed-to': { text: 'In Re-match', icon: <RotateCcw className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'default': { text: 'In Re-match', icon: <RotateCcw className="h-4 w-4 mr-2" />, color: 'text-blue-600' }
  },
  'sent-by-shared-with': {
    'requestor': { text: 'Sent for Approval', icon: <Send className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'shared-with': { text: 'Sent for Approval', icon: <Send className="h-4 w-4 mr-2" />, color: 'text-blue-600' },
    'routed-to': { text: 'Approved', icon: <CheckCircle className="h-4 w-4 mr-2" />, color: 'text-green-600' },
    'default': { text: 'Sent for Approval', icon: <Send className="h-4 w-4 mr-2" />, color: 'text-blue-600' }
  }
};

// Button Matrix - uses real state names as button types for direct state transitions
const BUTTON_MATRIX = {
  card: {
    'empty': {
      'routed-to': [
        { type: 'start-matching', label: 'Start Matching', variant: 'default' }
      ],
      'shared-with': [
        { type: 'start-matching', label: 'Start Matching', variant: 'default' }
      ],
      'requestor': [],
      'default': []
    },
    'routed-by-shared-with': {
      'routed-to': [
        { type: 'start-matching', label: 'Start Matching', variant: 'default' }
      ],
      'shared-with': [],
      'requestor': [],
      'default': []
    },
    'saved-by-routed-to': {
      'routed-to': [
        { type: 'review', label: 'Review', variant: 'outline' },
        { type: 'sent-to-shared-with-for-approval', label: 'Send for Approval', variant: 'default' }
      ],
      'shared-with': [],
      'requestor': [],
      'default': []
    },
    'sent-to-shared-with-for-approval': {
      'routed-to': [
        { type: 'review', label: 'Review', variant: 'default' }
      ],
      'shared-with': [
        { type: 'review', label: 'Review', variant: 'outline' },
        { type: 'approved-by-shared-with', label: 'Approve', variant: 'default' }
      ],
      'requestor': [],
      'default': []
    },
    'approved-by-shared-with': {
      'routed-to': [
        { type: 'review', label: 'Review', variant: 'default' }
      ],
      'shared-with': [
        { type: 'review', label: 'Review', variant: 'outline' },
        { type: 'sent-to-requestor-for-approval', label: 'Send for Approval', variant: 'default' }
      ],
      'requestor': [],
      'default': []
    },
    'rejected-by-shared-with': {
      'routed-to': [
        { type: 'review', label: 'Review', variant: 'outline' },
        { type: 'rematch-by-shared-with', label: 'Re-match', variant: 'default' }
      ],
      'shared-with': [
        { type: 'review', label: 'Review', variant: 'outline' },
        { type: 'rematch-by-shared-with', label: 'Re-match', variant: 'default' }
      ],
      'requestor': [],
      'default': []
    },
    'rematch-by-routed-to': {
      'routed-to': [
        { type: 'review', label: 'Continue Re-match', variant: 'outline' },
        { type: 'sent-to-shared-with-for-approval', label: 'Send for Approval', variant: 'default' }
      ],
      'shared-with': [],
      'requestor': [],
      'default': []
    },
    'approved-by-requestor': {
      'routed-to': [
        { type: 'review', label: 'Review', variant: 'default' }
      ],
      'shared-with': [
        { type: 'review', label: 'Review', variant: 'default' }
      ],
      'requestor': [
        { type: 'review', label: 'Review', variant: 'outline' }
      ],
      'default': []
    },
    'rejected-by-requestor': {
      'routed-to': [
        { type: 'review', label: 'Review', variant: 'default' }
      ],
      'shared-with': [
        { type: 'review', label: 'Review', variant: 'outline' },
        { type: 'rematch-by-shared-with', label: 'Re-match', variant: 'default' }
      ],
      'requestor': [
        { type: 'review', label: 'Review', variant: 'outline' }
      ],
      'default': []
    },
    'saved-by-shared-with': {
      'shared-with': [
        { type: 'review', label: 'Review', variant: 'outline' },
        { type: 'sent-to-requestor-for-approval', label: 'Send for Approval', variant: 'default' }
      ],
      'routed-to': [],
      'requestor': [],
      'default': []
    },
    'sent-to-requestor-for-approval': {
      'shared-with': [
        { type: 'review', label: 'Review', variant: 'default' }
      ],
      'requestor': [
        { type: 'review', label: 'Review', variant: 'outline' },
        { type: 'approved-by-requestor', label: 'Approve', variant: 'default' }
      ],
      'routed-to': [
        { type: 'review', label: 'Review', variant: 'default' }
      ],
      'default': []
    },
    'rematch-by-shared-with': {
      'shared-with': [
        { type: 'review', label: 'Continue Re-match', variant: 'default' }
      ],
      'routed-to': [
        { type: 'review', label: 'Continue Re-match', variant: 'default' }
      ],
      'requestor': [],
      'default': []
    },
    'sent-by-shared-with': {
      'routed-to': [
        { type: 'review', label: 'Review', variant: 'default' }
      ],
      'shared-with': [],
      'requestor': [],
      'default': []
    }
  },
  header: {
    'empty': {
      'routed-to': [
        { type: 'saved-by-routed-to', label: 'Save', variant: 'outline' },
        { type: 'sent-to-shared-with-for-approval', label: 'Send for Approval', variant: 'default' }
      ],
      'shared-with': [
        { type: 'saved-by-shared-with', label: 'Save', variant: 'outline' },
        { type: 'sent-to-requestor-for-approval', label: 'Send for Approval', variant: 'default' }
      ],
      'requestor': [],
      'default': []
    },
    'saved-by-routed-to': {
      'routed-to': [
        { type: 'sent-to-shared-with-for-approval', label: 'Send for Approval', variant: 'default' }
      ],
      'shared-with': [],
      'requestor': [],
      'default': []
    },
    'rejected-by-shared-with': {
      'routed-to': [
        { type: 'rematch-by-shared-with', label: 'Re-match', variant: 'default' }
      ],
      'shared-with': [
        { type: 'rematch-by-shared-with', label: 'Re-match', variant: 'default' }
      ],
      'requestor': [],
      'default': []
    },
    'rematch-by-routed-to': {
      'routed-to': [
        { type: 'saved-by-routed-to', label: 'Save', variant: 'outline' },
        { type: 'sent-to-shared-with-for-approval', label: 'Send for Approval', variant: 'default' }
      ],
      'shared-with': [],
      'requestor': [],
      'default': []
    },
    'routed-by-shared-with': {
      'routed-to': [
        { type: 'saved-by-routed-to', label: 'Save', variant: 'outline' },
        { type: 'sent-to-shared-with-for-approval', label: 'Send for Approval', variant: 'default' }
      ],
      'shared-with': [],
      'requestor': [],
      'default': []
    },
    'saved-by-shared-with': {
      'shared-with': [
        { type: 'sent-to-requestor-for-approval', label: 'Send for Approval', variant: 'default' }
      ],
      'routed-to': [],
      'requestor': [],
      'default': []
    },
    'rejected-by-requestor': {
      'shared-with': [
        { type: 'rematch-by-shared-with', label: 'Start re-matching', variant: 'default' }
      ],
      'routed-to': [],
      'requestor': [],
      'default': []
    },
    'rematch-by-shared-with': {
      'shared-with': [
        { type: 'saved-by-shared-with', label: 'Save', variant: 'outline' },
        { type: 'sent-to-requestor-for-approval', label: 'Send for Approval', variant: 'default' }
      ],
      'routed-to': [
        { type: 'saved-by-routed-to', label: 'Save', variant: 'outline' },
        { type: 'sent-to-shared-with-for-approval', label: 'Send for Approval', variant: 'default' }
      ],
      'requestor': [],
      'default': []
    },
    'sent-to-shared-with-for-approval': {
      'shared-with': [
        { type: 'approved-by-shared-with', label: 'Approve', variant: 'default' },
        { type: 'rejected-by-shared-with', label: 'Reject', variant: 'destructive' }
      ],
      'routed-to': [],
      'requestor': [],
      'default': []
    },
    'approved-by-shared-with': {
      'shared-with': [
        { type: 'sent-to-requestor-for-approval', label: 'Send for Approval', variant: 'default' }
      ],
      'routed-to': [],
      'requestor': [],
      'default': []
    },
    'sent-to-requestor-for-approval': {
      'requestor': [
        { type: 'approved-by-requestor', label: 'Approve', variant: 'default' },
        { type: 'rejected-by-requestor', label: 'Reject', variant: 'destructive' }
      ],
      'shared-with': [],
      'routed-to': [
        { type: 'review', label: 'Review', variant: 'default' }
      ],
      'default': []
    }
  }
};

// Get status display for a specific organization's match - strict state-based approach
const getMatchStatus = (matchMeasurementState, userRole) => {
  if (!matchMeasurementState || !userRole) {
    return { text: 'No State', icon: null, color: 'text-gray-500' };
  }

  const stateConfig = STATUS_MATRIX[matchMeasurementState];
  if (!stateConfig) {
    return { text: 'Unknown State', icon: null, color: 'text-gray-500' };
  }

  const roleConfig = stateConfig[userRole] || stateConfig['default'];
  if (!roleConfig) {
    return { text: 'No Status', icon: null, color: 'text-gray-500' };
  }

  return roleConfig;
};

// Get buttons for a specific organization's match - strict state-based approach  
const getMatchButtons = (matchMeasurementState, userRole, isHeaderButtons = false) => {
  if (!matchMeasurementState || !userRole) {
    return [];
  }

  const buttonContext = isHeaderButtons ? 'header' : 'card';
  const stateConfig = BUTTON_MATRIX[buttonContext][matchMeasurementState];
  if (!stateConfig) {
    return [];
  }

  const roleButtons = stateConfig[userRole] || stateConfig['default'];
  return roleButtons || [];
};

// Public function to get status display for a specific organization's match
const getColorMatchStatusForOrg = (matchMeasurementState, matchRequest, userOrgId, measurement, userOrgName) => {
  const orgRole = getOrgRole(matchRequest, userOrgId, measurement, userOrgName);
  const matrixRole = mapToMatrixRole(orgRole);
  
  // Use the raw match_measurement_state directly (no normalization)
  const measurementState = measurement?.match_measurement_state || matchMeasurementState || 'empty';
  
  console.log('🔍 Status Debug:', {
    measurementId: measurement?.id,
    measurementState,
    orgRole,
    matrixRole,
    userOrgId,
    userOrgName
  });
  
  return getMatchStatus(measurementState, matrixRole);
};

// Public function to get action buttons for a specific organization's match
const getColorMatchButtonsForOrg = (matchMeasurementState, matchRequest, userOrgId, measurement, userOrgName) => {
  const orgRole = getOrgRole(matchRequest, userOrgId, measurement, userOrgName);
  const matrixRole = mapToMatrixRole(orgRole);
  
  // Use the raw match_measurement_state directly (no normalization) 
  const measurementState = measurement?.match_measurement_state || matchMeasurementState || 'empty';
  
  return getMatchButtons(measurementState, matrixRole);
};

/**
 * Determines if the Measure Match and Import Match buttons should be visible
 * Based on whether the user has "Save" or "Send for Approval" buttons (actively matching)
 */
export const shouldShowMeasureImport = (matchMeasurementState, userRole) => {
  const matrixRole = mapToMatrixRole(userRole);
  const headerButtons = BUTTON_MATRIX.header?.[matchMeasurementState]?.[matrixRole] 
    || BUTTON_MATRIX.header?.[matchMeasurementState]?.['default'] 
    || [];
  
  // Show if they have Save or Send for Approval buttons (actively matching)
  return headerButtons.some(btn => btn.type === 'saved-by-shared-with' || 
                                    btn.type === 'saved-by-routed-to' ||
                                    btn.type === 'sent-to-requestor-for-approval' ||
                                    btn.type === 'sent-to-shared-with-for-approval');
};

/**
 * Public API to determine Measure/Import button visibility for an organization
 */
export const shouldShowMeasureImportForOrg = (matchRequest, measurement, userOrgId, userOrgName) => {
  const role = getOrgRole(matchRequest, userOrgId, measurement, userOrgName);
  const state = measurement?.match_measurement_state || 'empty';
  return shouldShowMeasureImport(state, role);
};

// Public function to get header action buttons for a specific organization's match  
const getMatchingHeaderButtonsForOrg = (matchMeasurementState, matchRequest, userOrgId, measurement, userOrgName) => {
  const orgRole = getOrgRole(matchRequest, userOrgId, measurement, userOrgName);
  const matrixRole = mapToMatrixRole(orgRole);
  
  // Use the raw match_measurement_state directly (no normalization)
  const measurementState = measurement?.match_measurement_state || matchMeasurementState || 'empty';
  
  return getMatchButtons(measurementState, matrixRole, true);
};

// Helper: Overdue check using EST date-only string comparison
const isOverdueInESTByDateString = (dueDateString) => {
  if (!dueDateString) return false;
  const todayEstString = formatInTimeZone(new Date(), 'America/New_York', 'yyyy-MM-dd');
  const dueDateStringOnly = String(dueDateString).split('T')[0];
  return dueDateStringOnly < todayEstString;
};

const getJobStatusForOrg = (matchRequest, userOrgId) => {
  if (!matchRequest?.colors || matchRequest.colors.length === 0) {
    return 'New';
  }

  // Check for archived status first (takes precedence over everything)
  if (matchRequest.status === 'Archived') {
    return 'Archived';
  }

  const orgRole = getOrgRole(matchRequest, userOrgId);
  
  // Count matches by state patterns, not status strings
  let newCount = 0;
  let inProgressCount = 0;
  let completeCount = 0;

  matchRequest.colors.forEach(color => {
    const measurementState = color.match_measurement_state || color.match_measurement?.match_measurement_state || 'empty';
    
    // Categorize based on measurement state
    if (measurementState === 'empty' || measurementState.includes('rematch-by-')) {
      newCount++;
    } else if (measurementState.includes('saved-by-') || 
               measurementState.includes('sent-') && measurementState.includes('-for-approval')) {
      inProgressCount++;
    } else if (measurementState.includes('approved-by-') || 
               measurementState.includes('rejected-by-')) {
      completeCount++;
    } else {
      // Default to new for unknown states
      newCount++;
    }
  });

  // Determine overall job status
  let status;
  if (completeCount === matchRequest.colors.length) {
    status = 'Complete';
  } else if (inProgressCount > 0 || completeCount > 0) {
    status = 'In Progress';
  } else {
    status = 'New';
  }

// Check for overdue status (override unless job is Complete)
if (status !== 'Complete' && matchRequest.due_date) {
  if (isOverdueInESTByDateString(matchRequest.due_date)) {
    return 'Overdue';
  }
}


  return status;
};

export { 
  getJobStatusForOrg, 
  getOrgRole, 
  getMatchStatus, 
  getMatchButtons, 
  getColorMatchStatusForOrg,
  getColorMatchButtonsForOrg,
  getMatchingHeaderButtonsForOrg,
  STATUS_MATRIX, 
  BUTTON_MATRIX 
};
