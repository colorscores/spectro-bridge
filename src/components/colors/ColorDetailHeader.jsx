import React from 'react';
import { Loader2, Edit, X, HardDrive, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ColorDetailHeader = ({
  isNew,
  isEditing = false,
  showEditButton,
  onEdit,
  onCancel,
  onSaveNew,
  onSave,
  saving,
  requiredFieldsFilled = true,
  onPrintColorCard,
}) => {
  // Show Save/Cancel ONLY for new colors
  if (isNew && (isEditing || isNew)) {
    return (
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button onClick={isNew ? onSaveNew : onSave} disabled={saving || (isNew && !requiredFieldsFilled)}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <HardDrive className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </div>
    );
  }

  // Show Print Color Card button for existing colors
  if (!isNew && onPrintColorCard) {
    return (
      <div className="flex gap-2">
        <Button variant="outline" onClick={onPrintColorCard}>
          <Printer className="mr-2 h-4 w-4" />
          Print Color Card
        </Button>
      </div>
    );
  }

  return null;
};

export default ColorDetailHeader;
