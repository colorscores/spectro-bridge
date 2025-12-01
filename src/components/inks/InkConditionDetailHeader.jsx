import React, { useState } from 'react';
import { Loader2, Save, Edit, X, ChevronDown, HardDrive } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SaveConfirmationDialog from '@/components/ui/save-confirmation-dialog';

const InkConditionDetailHeader = ({ 
  isNew, 
  conditionName,
  originalName,
  inkName,
  handleSaveUpdate, 
  handleSaveNew, 
  saving, 
  isEditMode, 
  showEditButton, 
  onEdit, 
  onCancel,
  onSaveAsColor,
  requiredFieldsFilled
}) => {
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  
  const nameHasChanged = originalName && conditionName && originalName !== conditionName;

  const breadcrumbItems = [
    { label: 'Inks', href: '/assets/inks' },
    { label: inkName || 'Ink', href: `/assets/inks/${isNew ? 'new' : ''}` },
    { label: isNew ? 'New Ink Condition' : (conditionName || 'Ink Condition') },
  ];

  if (isNew) {
    return (
      <div className="flex items-center justify-between mb-6">
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="mt-2">
            <h1 className="text-2xl font-bold text-gray-900">
              New Ink Condition
            </h1>
            <p className="text-sm text-gray-600">
              For ink: <span className="font-medium text-gray-800">{inkName || 'Loading...'}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onCancel} variant="outline">
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSaveNew} disabled={saving || !requiredFieldsFilled}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>
    );
  }
  
  if (isEditMode) {
    return (
      <>
        <div className="flex items-center gap-2">
          <Button onClick={onCancel} variant="outline">
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          {isNew ? (
            <Button 
              onClick={handleSaveNew} 
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HardDrive className="mr-2 h-4 w-4" />}
              Create
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HardDrive className="mr-2 h-4 w-4" />}
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
        </div>
        
        <SaveConfirmationDialog
          open={showSaveAsDialog}
          onOpenChange={setShowSaveAsDialog}
          assetType="Ink Condition"
          assetName={conditionName}
          onConfirm={() => {
            setShowSaveAsDialog(false);
            handleSaveNew();
          }}
        />
      </>
    );
  }

  // For existing conditions, no page-level header
  return null;
};

export default InkConditionDetailHeader;