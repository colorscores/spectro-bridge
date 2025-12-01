import React from 'react';
import { Button } from '@/components/ui/button';
import Breadcrumb from '@/components/Breadcrumb';
import { getMatchingHeaderButtonsForOrg } from '@/lib/matchStatusUtils.jsx';

const MatchingHeader = ({ 
  breadcrumbItems, 
  jobId, 
  onSave, 
  onSendForApproval, 
  isActionDisabled, 
  loadedMatch, 
  onApprove, 
  onReject, 
  onSendToRequestor,
  onRematchBySharedWith,
  onRematchByRoutedTo,
  onSetState, // New prop for pure state-based actions
  onShowShareDialog, // New prop for showing share confirmation dialog
  matchRequest,
  userOrgId,
  matchName
}) => {
  // Use only match_measurement_state - no status dependencies
  const measurementState = loadedMatch?.match_measurement_state;
  
  // Get buttons based on pure state
  console.debug('🔘 [MatchingHeader] Button determination:', {
    measurementState,
    matchRequestOrgId: matchRequest?.organization_id,
    sharedWithOrgId: matchRequest?.shared_with_org_id,
    routedToOrgId: matchRequest?.routed_to_org_id,
    userOrgId,
    loadedMatchId: loadedMatch?.id,
    isRouted: loadedMatch?.is_routed
  });
  
  let headerButtons = getMatchingHeaderButtonsForOrg(measurementState, matchRequest, userOrgId, loadedMatch);

  const handleButtonClick = async (buttonObj) => {
    if (isActionDisabled) return;
    
    const buttonType = buttonObj.type;

    // Check if this is a "Send for Approval" action that needs confirmation dialog
    const isApprovalAction = buttonType === 'sent-to-shared-with-for-approval' || 
                            buttonType === 'sent-to-requestor-for-approval';
    
    if (isApprovalAction && onShowShareDialog) {
      // Show confirmation dialog first, don't change state yet
      onShowShareDialog(buttonType);
      return;
    }

    // Handle other state-based actions directly
    if (onSetState && buttonType !== 'review') {
      await onSetState(buttonType);
      return;
    }

    // Handle review button - opens detail view but doesn't change state
    if (buttonType === 'review') {
      // Review button functionality would be handled by parent component
      console.log('Review button clicked - should navigate to detail view');
      return;
    }

    console.warn('Unhandled button type:', buttonType);
  };

  return (
    <header className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Breadcrumb items={breadcrumbItems} />
        </div>
        <div className="flex items-center space-x-2">
          {headerButtons.map((button, index) => (
            <Button
              key={index}
              variant={button.variant}
              onClick={() => handleButtonClick(button)}
              disabled={
                isActionDisabled ||
                button.disabled ||
                (measurementState?.includes('saved-by-') && button.type === 'save')
              }
              className={button.bgColor}
            >
              {button.label}
            </Button>
          ))}
        </div>
      </div>
    </header>
  );
};

export default MatchingHeader;
