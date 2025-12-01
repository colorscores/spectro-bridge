import React from 'react';
import { Loader2, X, HardDrive } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb';
import { Button } from '@/components/ui/button';

const PrintConditionHeader = ({ 
  isNew, 
  conditionName,
  handleSaveNew, 
  saving, 
  onCancel 
}) => {
  const breadcrumbItems = [
    { label: 'Print Conditions', href: '/print-conditions' },
    { label: isNew ? 'New Print Condition' : (conditionName || 'Print Condition') },
  ];

  // For new items, show save/cancel buttons
  if (isNew) {
    return (
      <div className="flex items-center justify-between mb-6">
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="mt-2">
            <h1 className="text-2xl font-bold text-gray-900">
              New Print Condition
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onCancel} variant="outline">
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSaveNew} disabled={saving || !conditionName?.trim()}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <HardDrive className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>
    );
  }

  // For existing items, only show breadcrumb and title (no edit controls)
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <Breadcrumb items={breadcrumbItems} />
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-gray-900">
            {conditionName || 'Print Condition'}
          </h1>
        </div>
      </div>
    </div>
  );
};

export default PrintConditionHeader;