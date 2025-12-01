// Pure utility functions for match status logic - NO JSX/React dependencies
import { isOverdueInESTByDateString } from './matchJobStatusLogic';

// Role determination functions
export const getOrgRole = (matchRequest, userOrgId, measurement, userOrgName) => {
  // Routed measurement check first
  if (measurement?.is_routed) {
    if (matchRequest.routed_to_org_id === userOrgId) {
      return 'routed-to';
    }
  }

  // Standard role checks
  if (matchRequest.organization_id === userOrgId) {
    return 'requestor';
  }
  
  if (matchRequest.shared_with_org_id === userOrgId) {
    return 'shared-with';
  }
  
  if (matchRequest.routed_to_org_id === userOrgId) {
    return 'routed-to';
  }
  
  return 'unknown';
};

export const mapToMatrixRole = (role) => {
  const roleMapping = {
    'requestor': 'requestor',
    'shared-with': 'shared-with',
    'routed-to': 'routed-to',
    'unknown': 'default'
  };
  return roleMapping[role] || 'default';
};

// Status configuration - pure data objects without JSX
export const STATUS_MATRIX = {
  'empty': {
    'requestor': { text: 'New', iconType: 'Clock', color: 'text-gray-600' },
    'shared-with': { text: 'New', iconType: 'Clock', color: 'text-gray-600' },
    'routed-to': { text: 'New', iconType: 'Clock', color: 'text-gray-600' },
    'default': { text: 'New', iconType: 'Clock', color: 'text-gray-600' }
  },
  'routed-by-shared-with': {
    'requestor': { text: 'In Progress', iconType: 'Clock', color: 'text-blue-600' },
    'shared-with': { text: 'Routed', iconType: 'Forward', color: 'text-purple-600' },
    'routed-to': { text: 'New', iconType: 'Clock', color: 'text-gray-600' },
    'default': { text: 'Routed', iconType: 'Forward', color: 'text-purple-600' }
  },
  'saved-by-shared-with': {
    'requestor': { text: 'In Progress', iconType: 'Clock', color: 'text-blue-600' },
    'shared-with': { text: 'Saved', iconType: 'Save', color: 'text-blue-600' },
    'routed-to': null,
    'default': { text: 'In Progress', iconType: 'Clock', color: 'text-blue-600' }
  },
  'saved-by-routed-to': {
    'requestor': { text: 'In Progress', iconType: 'Clock', color: 'text-blue-600' },
    'shared-with': { text: 'In Progress', iconType: 'Clock', color: 'text-blue-600' },
    'routed-to': { text: 'In Progress', iconType: 'Clock', color: 'text-blue-600' },
    'default': { text: 'In Progress', iconType: 'Clock', color: 'text-blue-600' }
  },
  'sent-to-shared-with-for-approval': {
    'requestor': { text: 'Pending Approval', iconType: 'Clock', color: 'text-yellow-600' },
    'shared-with': { text: 'Pending Approval', iconType: 'Clock', color: 'text-yellow-600' },
    'routed-to': { text: 'Sent for Approval', iconType: 'Send', color: 'text-blue-600' },
    'default': { text: 'Pending Approval', iconType: 'Clock', color: 'text-yellow-600' }
  },
  'approved-by-shared-with': {
    'requestor': { text: 'Pending Approval', iconType: 'Clock', color: 'text-yellow-600' },
    'shared-with': { text: 'Approved', iconType: 'CheckCircle', color: 'text-green-600' },
    'routed-to': { text: 'Approved', iconType: 'CheckCircle', color: 'text-green-600' },
    'default': { text: 'Approved', iconType: 'CheckCircle', color: 'text-green-600' }
  },
  'sent-to-requestor-for-approval': {
    'requestor': { text: 'Pending Approval', iconType: 'Clock', color: 'text-yellow-600' },
    'shared-with': { text: 'Sent for Approval', iconType: 'Send', color: 'text-blue-600' },
    'routed-to': { text: 'Approved', iconType: 'CheckCircle', color: 'text-green-600' },
    'default': { text: 'Pending Approval', iconType: 'Clock', color: 'text-yellow-600' }
  },
  'approved-by-requestor': {
    'requestor': { text: 'Approved', iconType: 'CheckCircle', color: 'text-green-600' },
    'shared-with': { text: 'Approved', iconType: 'CheckCircle', color: 'text-green-600' },
    'routed-to': { text: 'Approved', iconType: 'CheckCircle', color: 'text-green-600' },
    'default': { text: 'Approved', iconType: 'CheckCircle', color: 'text-green-600' }
  },
  'rejected-by-shared-with': {
    'requestor': { text: 'Re-Match Required', iconType: 'XCircle', color: 'text-red-600' },
    'shared-with': { text: 'Routed Match Rejected', iconType: 'XCircle', color: 'text-red-600' },
    'routed-to': { text: 'Rejected', iconType: 'XCircle', color: 'text-red-600' },
    'default': { text: 'Routed Match Rejected', iconType: 'XCircle', color: 'text-red-600' }
  },
  'rejected-by-requestor': {
    'requestor': { text: 'Rejected', iconType: 'XCircle', color: 'text-red-600' },
    'shared-with': { text: 'Rejected', iconType: 'XCircle', color: 'text-red-600' },
    'routed-to': null,
    'default': { text: 'Rejected', iconType: 'XCircle', color: 'text-red-600' }
  },
  'rematch-by-shared-with': {
    'requestor': { text: 'In Re-match', iconType: 'RotateCcw', color: 'text-blue-600' },
    'shared-with': { text: 'In Re-match', iconType: 'RotateCcw', color: 'text-blue-600' },
    'routed-to': { text: 'In Re-match', iconType: 'RotateCcw', color: 'text-blue-600' },
    'default': { text: 'In Re-match', iconType: 'RotateCcw', color: 'text-blue-600' }
  },
  'rematch-by-routed-to': {
    'requestor': { text: 'In Progress', iconType: 'Clock', color: 'text-blue-600' },
    'shared-with': { text: 'In Re-match', iconType: 'RotateCcw', color: 'text-blue-600' },
    'routed-to': { text: 'In Re-match', iconType: 'RotateCcw', color: 'text-blue-600' },
    'default': { text: 'In Re-match', iconType: 'RotateCcw', color: 'text-blue-600' }
  },
  'sent-by-shared-with': {
    'requestor': { text: 'Sent for Approval', iconType: 'Send', color: 'text-blue-600' },
    'shared-with': { text: 'Sent for Approval', iconType: 'Send', color: 'text-blue-600' },
    'routed-to': { text: 'Approved', iconType: 'CheckCircle', color: 'text-green-600' },
    'default': { text: 'Sent for Approval', iconType: 'Send', color: 'text-blue-600' }
  }
};

// Button configuration - pure data objects
export const BUTTON_MATRIX = {
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
    }
    // ... more button configurations would go here
  }
};

// Core status retrieval functions
export const getMatchStatus = (matchMeasurementState, userRole) => {
  const statusMatrix = STATUS_MATRIX[matchMeasurementState];
  if (!statusMatrix) {
    return { text: 'Unknown', iconType: 'Clock', color: 'text-gray-600' };
  }

  const roleStatus = statusMatrix[userRole];
  if (roleStatus === null) {
    return null;
  }

  return roleStatus || statusMatrix['default'] || { text: 'Unknown', iconType: 'Clock', color: 'text-gray-600' };
};

export const getMatchButtons = (matchMeasurementState, userRole, isHeaderButtons = false) => {
  const context = isHeaderButtons ? 'header' : 'card';
  const buttonMatrix = BUTTON_MATRIX[context];
  
  if (!buttonMatrix || !buttonMatrix[matchMeasurementState]) {
    return [];
  }

  const roleButtons = buttonMatrix[matchMeasurementState][userRole];
  return roleButtons || buttonMatrix[matchMeasurementState]['default'] || [];
};

// Public API functions
export const getColorMatchStatusForOrg = (status, matchRequest, userOrgId, measurement, userOrgName) => {
  const orgRole = getOrgRole(matchRequest, userOrgId, measurement, userOrgName);
  const matrixRole = mapToMatrixRole(orgRole);
  
  const matchMeasurementState = measurement?.match_measurement_state || 'empty';
  return getMatchStatus(matchMeasurementState, matrixRole);
};

export const getColorMatchButtonsForOrg = (status, matchRequest, userOrgId, measurement, userOrgName) => {
  const orgRole = getOrgRole(matchRequest, userOrgId, measurement, userOrgName);
  const matrixRole = mapToMatrixRole(orgRole);
  
  const matchMeasurementState = measurement?.match_measurement_state || 'empty';
  return getMatchButtons(matchMeasurementState, matrixRole, false);
};

export const getMatchingHeaderButtonsForOrg = (status, matchRequest, userOrgId, measurement, userOrgName) => {
  const orgRole = getOrgRole(matchRequest, userOrgId, measurement, userOrgName);
  const matrixRole = mapToMatrixRole(orgRole);
  
  const matchMeasurementState = measurement?.match_measurement_state || 'empty';
  return getMatchButtons(matchMeasurementState, matrixRole, true);
};

// Job status logic
export const getJobStatusForOrg = (matchRequest, userOrgId) => {
  if (!matchRequest) return 'Unknown';
  
  // Check if overdue first
  if (matchRequest.due_date && isOverdueInESTByDateString(matchRequest.due_date)) {
    return 'Overdue';
  }

  const status = matchRequest.status || 'New';
  
  // Handle archived status
  if (status === 'Archived') {
    return 'Archived';
  }

  // Map other statuses
  const statusMapping = {
    'New': 'New',
    'In Progress': 'In Progress',
    'Pending Approval': 'Pending Approval',
    'Approved': 'Complete',
    'Re-Match Required': 'Re-Match Required',
    'Routed': 'Routed'
  };

  return statusMapping[status] || status;
};