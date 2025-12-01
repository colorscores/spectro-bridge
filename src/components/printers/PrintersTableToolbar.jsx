import React from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Search, Filter, Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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

const PrintersTableToolbar = ({
  searchTerm,
  onSearchTermChange,
  numSelected,
  numConditionsSelected,
  onEditClick,
  onDeleteClick,
  onFilterClick,
  onCalibrateClick,
  isFilterOpen,
  filterActive
}) => {
  const isActionsDisabled = numSelected === 0;
  const isEditDisabled = numSelected !== 1;
  const canCalibrate = numConditionsSelected === 1 && numSelected === numConditionsSelected;

  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-background">
      <div className="flex items-center gap-0.5 flex-1">
        <TooltipProvider>
          <ActionIconButton icon={Pencil} label="Edit" disabled={isEditDisabled} onClick={onEditClick} />
          <ActionIconButton icon={Trash2} label="Delete" disabled={isActionsDisabled} onClick={onDeleteClick} />
        </TooltipProvider>
        <Button
          variant="default"
          size="sm"
          onClick={onCalibrateClick}
          disabled={!canCalibrate}
          className="ml-2 bg-blue-600 hover:bg-blue-700"
        >
          <Settings className="mr-2 h-4 w-4" />
          Calibrate Printer
        </Button>
        {numSelected > 0 && (
          <>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              {`${numSelected} selected`}
            </span>
          </>
        )}
      </div>

      <div className="flex-1 flex justify-center px-4">
        <div className="w-full max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input
            placeholder="Search printers..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="w-full pl-10"
          />
        </div>
      </div>

      <div className="flex items-center justify-end flex-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onFilterClick}
          className={cn(
            "border-gray-300",
            (isFilterOpen || filterActive) && "bg-blue-50 border-blue-300 text-blue-700"
          )}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>
    </div>
  );
};

export default PrintersTableToolbar;