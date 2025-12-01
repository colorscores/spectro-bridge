import React, { useState } from 'react';
import { Loader2, Save, Edit, X, ChevronDown, HardDrive } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SaveConfirmationDialog from '@/components/ui/save-confirmation-dialog';

const SubstrateConditionHeader = ({ 
  isNew, 
  conditionName, 
  originalName,
  parentSubstrate,
  handleSaveUpdate, 
  handleSaveNew, 
  saving, 
  isEditMode, 
  canEdit, 
  showEditButton, 
  hasUnsavedChanges, 
  onEdit, 
  onCancel 
}) => {
  
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  
  const nameHasChanged = originalName && conditionName && originalName !== conditionName;
  
  const breadcrumbItems = [
    { label: 'Substrates', href: '/assets/substrates' },
    { label: parentSubstrate?.name, href: `/assets/substrates/${parentSubstrate?.id}` },
    { label: isNew ? 'New Condition' : (conditionName || 'Edit Condition') },
  ];

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <Breadcrumb items={breadcrumbItems} />
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-gray-900">
            {isNew ? 'New Substrate Condition' : (conditionName || 'Substrate Condition')}
          </h1>
          <p className="text-sm text-gray-600">
            For substrate: <span className="font-medium text-gray-800">{parentSubstrate?.name}</span> • Print Side: <span className="font-medium text-gray-800 capitalize">{parentSubstrate?.printing_side}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {showEditButton && (
          <Button onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
        {(isNew || isEditMode) && (
          <>
            <Button onClick={onCancel} variant="outline">
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            {isNew ? (
              <Button 
                onClick={handleSaveNew} 
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <HardDrive className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <HardDrive className="mr-2 h-4 w-4" />
                    )}
                    Save
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSaveUpdate}>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </DropdownMenuItem>
                  {nameHasChanged && (
                    <DropdownMenuItem onClick={() => setShowSaveAsDialog(true)}>
                      <Save className="mr-2 h-4 w-4" />
                      Save as...
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
        
        <SaveConfirmationDialog
          open={showSaveAsDialog}
          onOpenChange={setShowSaveAsDialog}
          assetType="Substrate Condition"
          assetName={conditionName}
          onConfirm={() => {
            setShowSaveAsDialog(false);
            handleSaveNew();
          }}
        />
      </div>
    </div>
  );
};

export default SubstrateConditionHeader;