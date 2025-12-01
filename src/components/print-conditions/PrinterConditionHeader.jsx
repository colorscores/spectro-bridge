import React, { useState } from 'react';
import { Loader2, Save, Edit, X, ChevronDown, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SaveConfirmationDialog from '@/components/ui/save-confirmation-dialog';

const PrinterConditionHeader = ({ 
  isNew, 
  conditionName,
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
  
  const nameHasChanged = originalName && conditionName && originalName !== conditionName;

  if (showEditButton) {
    return (
      <Button onClick={onEdit} variant="default">
        <Edit className="mr-2 h-4 w-4" />
        Edit
      </Button>
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
          assetType="Printer Condition"
          assetName={conditionName}
          onConfirm={() => {
            setShowSaveAsDialog(false);
            handleSaveNew();
          }}
        />
      </>
    );
  }

  return null;
};

export default PrinterConditionHeader;