import React from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Rows, Book, Search, Plus, Minus, BookX, Download, GitBranch } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import ViewSelector from '@/components/common/ViewSelector';
import { useCanEdit } from '@/hooks/useCanEdit';

const ActionIconButton = ({ icon: Icon, label, disabled, onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={onClick}
        className="h-9 w-9"
      >
        <Icon className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>{label}</p>
    </TooltipContent>
  </Tooltip>
);

const InksTableToolbar = ({ 
  numSelected, 
  selectedItems,
  onDelete, 
  onEdit, 
  onAdapt,
  currentView, 
  onViewChange, 
  searchTerm, 
  onSearchTermChange,
  onAddToBookClick,
  onRemoveFromBookClick,
  onDeleteBookClick,
  onExportClick
}) => {
  const isActionsDisabled = numSelected === 0;
  const isEditDisabled = numSelected !== 1;
  const isAdaptDisabled = selectedItems?.conditions?.size !== 1;
  const canEdit = useCanEdit();

  const inkViews = [
    { value: 'flat', label: 'List View', icon: Rows },
    { value: 'book', label: 'Book View', icon: Book },
  ];

  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-gray-50/50">
      <div className="flex items-center gap-2 flex-1">
        <TooltipProvider>
          <div className="flex items-center gap-1">
            {canEdit && <ActionIconButton icon={Pencil} label="Edit" disabled={isEditDisabled} onClick={onEdit} />}
            {canEdit && <ActionIconButton icon={GitBranch} label="Adapt" disabled={isAdaptDisabled} onClick={onAdapt} />}
            {canEdit && <ActionIconButton icon={Trash2} label="Delete" disabled={isActionsDisabled} onClick={() => {
              console.log('🗑️ Delete button clicked', { numSelected, isActionsDisabled, canEdit });
              onDelete();
            }} />}
            <ActionIconButton icon={Download} label="Export" disabled={isActionsDisabled} onClick={onExportClick} />
            {canEdit && <ActionIconButton icon={Plus} label="Add to Book" disabled={isActionsDisabled} onClick={onAddToBookClick} />}
            {canEdit && currentView === 'book' && (
              <>
                <ActionIconButton icon={Minus} label="Remove from Book" disabled={isActionsDisabled} onClick={onRemoveFromBookClick} />
                <ActionIconButton icon={BookX} label="Delete Book" disabled={isActionsDisabled} onClick={onDeleteBookClick} />
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
              placeholder="Search inks..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="h-8 w-full focus-visible:ring-offset-0"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-1 justify-end">
        <ViewSelector 
          options={inkViews} 
          value={currentView} 
          onChange={onViewChange} 
        />
      </div>
    </div>
  );
};

export default InksTableToolbar;