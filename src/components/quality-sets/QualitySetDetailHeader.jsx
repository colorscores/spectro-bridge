import React, { useState } from 'react';

import { Loader2, Save, Edit, X, ChevronDown, HardDrive } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import SaveConfirmationDialog from '@/components/ui/save-confirmation-dialog';

const QualitySetDetailHeader = ({ 
  isNew, 
  qualitySetName, 
  originalName,
  handleSaveUpdate, 
  handleSaveNew, 
  saving, 
  isEditMode, 
  showEditButton, 
  onEdit, 
  onCancel 
}) => {
  
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  
  const nameHasChanged = originalName && qualitySetName && originalName !== qualitySetName;
  
  const breadcrumbItems = [
    { label: 'Quality Sets', href: '/quality-sets' },
    { label: isNew ? 'New Quality Set' : (qualitySetName || 'Quality Set') },
  ];

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <Breadcrumb items={breadcrumbItems} />
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-gray-900">
            {isNew ? 'New Quality Set' : (qualitySetName || 'Quality Set')}
          </h1>
        </div>
      </div>
      {isNew && (
        <div className="flex items-center gap-2">
          <Button onClick={onCancel} variant="outline">
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button 
            onClick={handleSaveNew} 
            disabled={saving || !qualitySetName?.trim()}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
          
          <SaveConfirmationDialog
            open={showSaveAsDialog}
            onOpenChange={setShowSaveAsDialog}
            assetType="Quality Set"
            assetName={qualitySetName}
            onConfirm={() => {
              setShowSaveAsDialog(false);
              handleSaveNew();
            }}
          />
        </div>
      )}
    </div>
  );
};

export default QualitySetDetailHeader;