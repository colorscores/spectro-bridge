import React, { useState } from 'react';
import { Loader2, Save, Edit, X, ChevronDown, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SaveConfirmationDialog from '@/components/ui/save-confirmation-dialog';

const PrinterDetailHeader = ({ 
  isNew, 
  printerName,
  originalName,
  handleSaveUpdate, 
  handleSaveNew, 
  saving, 
  isEditMode, 
  showEditButton, 
  onEdit, 
  onCancel,
  isDirty
}) => {
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  
  const nameHasChanged = originalName && printerName && originalName !== printerName;

  if (isNew) {
    return (
      <Button onClick={handleSaveNew} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HardDrive className="mr-2 h-4 w-4" />}
        Create Printer
      </Button>
    );
  }

  if (isEditMode) {
    return (
      <>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={onCancel}
            disabled={saving}
          >
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
          assetType="Printer"
          assetName={printerName}
          onConfirm={() => {
            setShowSaveAsDialog(false);
            handleSaveNew();
          }}
        />
      </>
    );
  }

  if (showEditButton) {
    return (
      <Button onClick={onEdit}>
        <Edit className="mr-2 h-4 w-4" />
        Edit
      </Button>
    );
  }

  return null;
};

export default PrinterDetailHeader;