
import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileDown, Trash2, Tags, Pencil, Copy, ChevronsRightLeft, Book, Filter, ListTree, Rows, GitMerge, ChevronDown, ChevronUp } from 'lucide-react';
import ViewSelector from '@/components/common/ViewSelector';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useCanEdit } from '@/hooks/useCanEdit';
import { useProfile } from '@/context/ProfileContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';

const TooltipIconButton = ({ icon: Icon, label, onClick, disabled, className }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        disabled={disabled}
        className={className}
      >
        <Icon className="h-4 w-4" />
        <span className="sr-only">{label}</span>
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>{label}</p>
    </TooltipContent>
  </Tooltip>
);

const ActiveFilterIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 .78 1.63L15 14v4a1 1 0 0 1-.55.89l-4 2A1 1 0 0 1 9 20v-6L3.22 6.63A1 1 0 0 1 3 6V5z" />
  </svg>
);

const ColorsTableToolbar = ({
  searchTerm,
  onSearchTermChange,
  viewMode,
  setViewMode,
  numSelected,
  selectedColors = [], // Add selectedColors prop
  onEditClick,
  onTagClick,
  onDeleteClick,
  onAddToBookClick,
  onRemoveFromBookClick,
  onChangeTypeClick,
  onRemoveDuplicatesClick,
  onDeleteBookClick,
  onToggleFilter,
  onMergeModesClick,
  canMergeModes,
  isFilterOpen,
  isFilterActive,
  onExportClick,
}) => {
  const isBookView = viewMode === 'book';
  const canEdit = useCanEdit();
  const { profile } = useProfile();
  const { canEdit: hasRolePermission } = useRoleAccess();
  const canEditSelectedColors = Boolean(
    hasRolePermission &&
    profile?.organization_id &&
    Array.isArray(selectedColors) &&
    selectedColors.length > 0 &&
    selectedColors.every(c => c?.organization_id === profile.organization_id)
  );

  // Check if any selected color is download-restricted (shared from a partner with allow_download = false)
  const hasDownloadRestrictedColors = useMemo(() => {
    if (!Array.isArray(selectedColors) || selectedColors.length === 0) return false;
    if (!profile?.organization_id) return false;
    
    // Colors are download-restricted if they're shared FROM another org WITH allow_download = false
    // We need to check if the color's owner org has a partner relationship with download restrictions
    return selectedColors.some(color => {
      // If the color belongs to our org, it's not download-restricted
      if (color?.organization_id === profile.organization_id) return false;
      
      // If color is from another org (shared), check if it has download restriction flag
      // This flag would be added by the colors query when joining with partners table
      return color?.is_download_restricted === true;
    });
  }, [selectedColors, profile?.organization_id]);
  const viewOptions = [
    { value: 'flat', label: 'Flat View', icon: Rows },
    { value: 'book', label: 'Book View', icon: Book },
    { value: 'dependent', label: 'Dependent View', icon: ListTree },
  ];
  
  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-gray-50/50">
      <div className="flex items-center gap-2 flex-1">
        <TooltipProvider>
          <div className="flex items-center gap-1">
            {!isBookView && (
              <>
                {canEdit && (
                  <TooltipIconButton
                    icon={Pencil}
                    label={canEditSelectedColors ? "Edit" : "Cannot edit shared colors"}
                    onClick={onEditClick}
                    disabled={numSelected !== 1 || !canEditSelectedColors}
                  />
                )}
                <TooltipIconButton
                  icon={Tags}
                  label={canEditSelectedColors ? "Tag" : "Cannot tag shared colors"}
                  onClick={onTagClick}
                  disabled={numSelected === 0 || !canEditSelectedColors}
                />
                {canEdit && (
                  <>
                    <TooltipIconButton
                      icon={ChevronsRightLeft}
                      label={canEditSelectedColors ? "Change Type" : "Cannot change type of shared colors"}
                      onClick={onChangeTypeClick}
                      disabled={numSelected === 0 || !canEditSelectedColors}
                    />
                    <TooltipIconButton
                      icon={Book}
                      label={canEditSelectedColors ? "Add to Book" : "Cannot add shared colors to book"}
                      onClick={onAddToBookClick}
                      disabled={numSelected === 0 || !canEditSelectedColors}
                    />
                    <TooltipIconButton
                      icon={Copy}
                      label={canEditSelectedColors ? "Remove Duplicates" : "Cannot remove duplicates from shared colors"}
                      onClick={onRemoveDuplicatesClick}
                      disabled={numSelected < 2 || !canEditSelectedColors}
                    />
                    <TooltipIconButton
                      icon={GitMerge}
                      label={canEditSelectedColors ? "Merge Modes" : "Cannot merge modes of shared colors"}
                      onClick={onMergeModesClick}
                      disabled={!canMergeModes || !canEditSelectedColors}
                    />
                    <TooltipIconButton
                      icon={Trash2}
                      label={canEditSelectedColors ? "Delete" : "Cannot delete shared colors"}
                      onClick={onDeleteClick}
                      disabled={numSelected === 0 || !canEditSelectedColors}
                    />
                  </>
                )}
                <TooltipIconButton
                  icon={FileDown}
                  label={hasDownloadRestrictedColors ? "Cannot export download-restricted colors" : "Export"}
                  onClick={onExportClick}
                  disabled={numSelected === 0 || hasDownloadRestrictedColors}
                />
              </>
            )}
            {isBookView && (
              <>
                <TooltipIconButton
                  icon={Tags}
                  label={canEditSelectedColors ? "Tag" : "Cannot tag shared colors"}
                  onClick={onTagClick}
                  disabled={numSelected === 0 || !canEditSelectedColors}
                />
                {canEdit && (
                  <>
                    <TooltipIconButton
                      icon={Trash2}
                      label={canEditSelectedColors ? "Remove from Book" : "Cannot remove shared colors from book"}
                      onClick={onRemoveFromBookClick}
                      disabled={numSelected === 0 || !canEditSelectedColors}
                    />
                    <TooltipIconButton
                      icon={Book}
                      label="Delete Book"
                      onClick={onDeleteBookClick}
                      disabled={numSelected === 0}
                    />
                  </>
                )}
                <TooltipIconButton
                  icon={FileDown}
                  label={hasDownloadRestrictedColors ? "Cannot export download-restricted colors" : "Export"}
                  onClick={onExportClick}
                  disabled={numSelected === 0 || hasDownloadRestrictedColors}
                />
              </>
            )}
          </div>
        </TooltipProvider>
        <Separator orientation="vertical" className="h-6 mx-2" />
        {numSelected > 0 && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {numSelected} selected
          </span>
        )}
      </div>

      <div className="flex-1 flex justify-center px-4">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Input
              placeholder="Search Colors..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="h-8 w-full focus-visible:ring-offset-0"
            />
          </div>
          <Button variant={isFilterActive ? "secondary" : "outline"} size="sm" className="h-8" onClick={onToggleFilter}>
            {isFilterActive ? (
              <ActiveFilterIcon className="mr-2 h-4 w-4 text-primary" />
            ) : (
              <Filter className="mr-2 h-4 w-4" />
            )}
            Filter
            {isFilterOpen ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-1 justify-end">
        <ViewSelector options={viewOptions} value={viewMode} onChange={setViewMode} />
      </div>
    </div>
  );
};

export default ColorsTableToolbar;
  