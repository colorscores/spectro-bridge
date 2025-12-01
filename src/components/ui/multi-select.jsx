import React, { useState, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

export const MultiSelect = ({ options, selected, onChange, className, placeholder = 'Select options...', disabled = false, isLoading = false }) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Normalize selected to always be an array to prevent crashes
  const normalizedSelected = Array.isArray(selected) ? selected : [];

  // Prevent accidental close while interacting inside content
  const interactingRef = useRef(false);

  const handleUnselect = (value) => {
    if (disabled) return; // Don't allow changes when disabled
    onChange(normalizedSelected.filter((s) => s !== value));
  };

  const handleSelect = (value) => {
    if (disabled) return; // Don't allow changes when disabled
    if (normalizedSelected.includes(value)) {
      handleUnselect(value);
    } else {
      onChange([...normalizedSelected, value]);
    }
  };

  // Deterministic checkbox change handler avoids double toggles and respects disabled
  const handleCheckboxChange = (value, nextChecked) => {
    if (disabled) return;

    if (nextChecked === true) {
      if (!normalizedSelected.includes(value)) {
        onChange([...normalizedSelected, value]);
      }
    } else {
      // Treat false or "indeterminate" as uncheck
      if (normalizedSelected.includes(value)) {
        onChange(normalizedSelected.filter((s) => s !== value));
      }
    }
  };


  const selectedOptions = options.filter(option => normalizedSelected.includes(option.value));

  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Popover modal open={open} onOpenChange={(next) => { if (!next && interactingRef.current) return; setOpen(next); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between h-auto min-h-[40px]', disabled && 'opacity-70 cursor-not-allowed', className)}
        >
          <div className="flex gap-1 flex-wrap items-center">
            {selectedOptions.length > 0 ? (
              selectedOptions.map((option) => (
                <Badge
                  variant="secondary"
                  key={option.value}
                  className="mr-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleUnselect(option.value);
                  }}
                >
                  {option.label}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground font-normal">{placeholder}</span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 ml-2 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseDownCapture={() => { interactingRef.current = true; }}
        onMouseUp={() => { setTimeout(() => { interactingRef.current = false }, 0); }}
        className="w-[--radix-popover-trigger-width] p-0 bg-background z-[1000] shadow-md border rounded-md" align="start">
        <div className="p-2">
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <ScrollArea className="max-h-60">
          <div className="p-2">
            {isLoading ? (
              <p className="text-center text-sm text-muted-foreground p-4">Loading...</p>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                  onClick={() => {
                    if (disabled) return;
                    handleCheckboxChange(option.value, !normalizedSelected.includes(option.value));
                  }}
                  onKeyDown={(e) => {
                    if (disabled) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCheckboxChange(option.value, !normalizedSelected.includes(option.value));
                    }
                  }}
                  role="option"
                  aria-selected={normalizedSelected.includes(option.value)}
                  tabIndex={0}
                >
                  <Checkbox
                    id={`multiselect-${option.value}`}
                    checked={normalizedSelected.includes(option.value)}
                    onCheckedChange={(checked) => handleCheckboxChange(option.value, checked)}
                    disabled={disabled}
                  />
                  <span className="text-sm font-medium leading-none flex-1 cursor-pointer">
                    {option.label}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-sm text-muted-foreground p-4">No results found.</p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};