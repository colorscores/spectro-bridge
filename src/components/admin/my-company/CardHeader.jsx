import React from 'react';
import { Edit2, GraduationCap, Check, X, Loader2 } from 'lucide-react';

const CardHeader = ({ 
  title, 
  subtitle, 
  onEdit, 
  onSave,
  onCancel,
  onLearn,
  showEdit = true,
  showLearn = true,
  isEditing = false,
  canSave = true,
  saving = false,
  editDisabled = false,
  editTooltip = null,
  className = "",
  hasRequiredFields = false,
  requiredFieldsFilled = true
}) => {
  return (
    <div className={`flex flex-row items-center justify-between space-y-0 px-6 pt-4 pb-6 ${className}`}>
      <div>
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold leading-none tracking-tight">{title}</h3>
          {showLearn && (
            <button type="button"
              onClick={onLearn}
              className="text-muted-foreground hover:text-primary transition-colors p-1 rounded"
              aria-label="Learn about this feature"
            >
              <GraduationCap className="h-4 w-4" />
            </button>
          )}
        </div>
      {subtitle && (
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      )}
    </div>
    {(showEdit || isEditing) && (
      <div className="flex items-center gap-2">
          {!isEditing ? (
            <button type="button"
              onClick={onEdit}
              disabled={editDisabled || (hasRequiredFields && !requiredFieldsFilled)}
              className={`w-8 h-8 rounded-full text-white flex items-center justify-center transition-colors ${
                editDisabled || (hasRequiredFields && !requiredFieldsFilled)
                  ? 'bg-blue-500 cursor-not-allowed opacity-75' 
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
              title={editTooltip || (editDisabled ? 'Make changes to enable editing' : hasRequiredFields && !requiredFieldsFilled ? 'Complete required fields to enable editing' : 'Edit this section')}
              aria-label="Edit this section"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button type="button"
                onClick={onCancel}
                disabled={saving || (hasRequiredFields && !requiredFieldsFilled)}
                className={`w-8 h-8 rounded-full text-white flex items-center justify-center transition-colors ${
                  hasRequiredFields && !requiredFieldsFilled
                    ? 'bg-red-500 cursor-not-allowed opacity-50'
                    : 'bg-red-500 hover:bg-red-600 disabled:opacity-50'
                }`}
                title="Cancel changes"
                aria-label="Cancel changes"
              >
                <X className="h-4 w-4" />
              </button>
              <button type="button"
                onClick={onSave}
                disabled={!canSave || saving}
                className={`w-8 h-8 rounded-full text-white flex items-center justify-center transition-colors ${
                  hasRequiredFields && !requiredFieldsFilled
                    ? 'bg-green-500 cursor-not-allowed opacity-50'
                    : 'bg-green-500 hover:bg-green-600 disabled:bg-green-500 disabled:hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
                title={hasRequiredFields && !requiredFieldsFilled ? 'Complete required fields to save' : 'Save changes'}
                aria-label="Save changes"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CardHeader;