import React from 'react';

const AdaptStep3Summary = ({ formData, resolvedNames, sourceInkCondition }) => {
  return (
    <div className="space-y-6 p-6">
      <h3 className="text-lg font-semibold">Summary</h3>
      
      <div className="p-4 border rounded-lg bg-muted/50 space-y-2 text-sm">
        <p><strong>Source Ink:</strong> {sourceInkCondition?.inks?.name || 'Unknown'}</p>
        <p><strong>Source Condition:</strong> {sourceInkCondition?.name || 'Unknown'}</p>
        <p><strong>Source Substrate:</strong> {sourceInkCondition?.substrates?.name || 'Unknown'}</p>
        
        <div className="h-px bg-border my-3"></div>
        
        <p><strong>Target Substrate:</strong> {resolvedNames?.substrateName || formData.assignedSubstrate || 'Not specified'}</p>
        <p><strong>Target Condition:</strong> {resolvedNames?.substrateConditionName || 'Not specified'}</p>
        <p><strong>New Ink Condition Name:</strong> {resolvedNames?.inkConditionName || 'Not specified'}</p>
        <p><strong>Version:</strong> {formData.version || 1}</p>
      </div>
    </div>
  );
};

export default AdaptStep3Summary;
