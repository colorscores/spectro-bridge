import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ViewSelectorButton = ({ icon: Icon, label, isActive, onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className={cn(
          'h-9 w-9 text-muted-foreground transition-colors duration-200',
          isActive ? 'bg-blue-100 text-blue-700 hover:bg-blue-100/90' : 'hover:bg-accent/50 hover:text-accent-foreground'
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="sr-only">{label}</span>
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>{label}</p>
    </TooltipContent>
  </Tooltip>
);

const ViewSelector = ({ options, value, onChange }) => {
  if (!options) {
    return null;
  }
  
  return (
    <div className="flex items-center justify-end gap-1 p-1 bg-gray-100 rounded-md">
      <TooltipProvider>
        {options.map((option) => (
          <ViewSelectorButton
            key={option.value}
            icon={option.icon}
            label={option.label}
            isActive={value === option.value}
            onClick={() => onChange(option.value)}
          />
        ))}
      </TooltipProvider>
    </div>
  );
};

export default ViewSelector;