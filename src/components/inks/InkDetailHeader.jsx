import React, { useState } from 'react';
import { Loader2, Save, Edit, X, ChevronDown, HardDrive } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SaveConfirmationDialog from '@/components/ui/save-confirmation-dialog';

const InkDetailHeader = ({ 
  isNew, 
  inkName,
  originalName,
  handleSaveUpdate, 
  handleSaveNew, 
  saving, 
  isEditMode, 
  showEditButton, 
  onEdit, 
  onCancel,
  isDirty,
  requiredFieldsFilled
}) => {
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  
  const nameHasChanged = originalName && inkName && originalName !== inkName;

  const breadcrumbItems = [
    { label: 'Inks', href: '/assets/inks' },
    { label: isNew ? 'New Ink' : (inkName || 'Ink') },
  ];

  if (isNew) {
    return (
      <div className="flex items-center justify-between mb-6">
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="mt-2">
            <h1 className="text-2xl font-bold text-gray-900">
              New Ink
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={saving || !isDirty}>
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
        </div>
        
        <SaveConfirmationDialog
          open={showSaveAsDialog}
          onOpenChange={setShowSaveAsDialog}
          assetType="Ink"
          assetName={inkName}
          onConfirm={() => {
            setShowSaveAsDialog(false);
            handleSaveNew();
          }}
        />
      </>
    );
  }


  // For existing inks, no page-level header
  return null;
};

export default InkDetailHeader;