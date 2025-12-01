import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

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

const PrintConditionsTableToolbar = ({
  searchTerm,
  onSearchTermChange,
  numSelected,
  onDeleteClick,
  onFilterClick,
  isFilterOpen = false,
  isFilterActive = false,
}) => {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-gray-50/50">
      <div className="flex items-center gap-2 flex-1">
        <TooltipProvider>
          <div className="flex items-center gap-1">
            <TooltipIconButton
              icon={Trash2}
              label="Delete"
              onClick={onDeleteClick}
              disabled={numSelected === 0}
            />
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
              placeholder="Search Print Conditions..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="h-8 w-full focus-visible:ring-offset-0"
            />
          </div>
          <Button variant={isFilterActive ? "secondary" : "outline"} size="sm" className="h-8" onClick={onFilterClick}>
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
        {/* Filter button now appears in center next to search */}
      </div>
    </div>
  );
};

export default PrintConditionsTableToolbar;