import React from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Rows, Book, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import ViewSelector from '@/components/common/ViewSelector';

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

const SubstratesTableToolbar = ({
  searchTerm,
  onSearchTermChange,
  viewMode,
  setViewMode,
  numSelected,
  onEditClick,
  onDeleteClick,
}) => {
  const isActionsDisabled = numSelected === 0;
  const isEditDisabled = numSelected !== 1;

  const substrateViews = [
    { value: 'list', label: 'List View', icon: Rows },
    { value: 'grouped', label: 'Grouped View', icon: Book },
  ];

  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-gray-50/50">
      <div className="flex items-center gap-2 flex-1">
        <TooltipProvider>
          <div className="flex items-center gap-1">
            <ActionIconButton icon={Pencil} label="Edit" disabled={isEditDisabled} onClick={onEditClick} />
            <ActionIconButton icon={Trash2} label="Delete" disabled={isActionsDisabled} onClick={onDeleteClick} />
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
              placeholder="Search substrates..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="h-8 w-full focus-visible:ring-offset-0"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-1 justify-end">
        <ViewSelector
          views={substrateViews}
          currentView={viewMode}
          onViewChange={setViewMode}
        />
      </div>
    </div>
  );
};

export default SubstratesTableToolbar;