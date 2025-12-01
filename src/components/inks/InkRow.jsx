import React, { useMemo, useCallback } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Eye, Droplet, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSolidColorHexFromConditions } from '@/lib/colorUtils/solidColorExtractor';

const InkRow = ({ ink, isExpanded, onToggleExpand, selectedItems, setSelectedItems, indentationLevel = 0, onRowClick, isActive, bookId, associationId }) => {
  const navigate = useNavigate();

  const selectionState = useMemo(() => {
    // For book view, use association-based ID, for flat view use ink ID
    const inkSelectionId = bookId ? `${ink.id}::${bookId}` : ink.id;
    const isInkSelected = selectedItems.inks.has(inkSelectionId);
    
    // Only consider ink selection for checkbox state, not conditions
    return isInkSelected ? 'checked' : 'unchecked';
  }, [ink, selectedItems, bookId]);
  
  const handleSelect = useCallback((checked) => {
    setSelectedItems(prev => {
      const newInks = new Set(prev.inks);

      // For book view, use association-based ID, for flat view use ink ID
      const inkSelectionId = bookId ? `${ink.id}::${bookId}` : ink.id;

      if (checked) {
        newInks.add(inkSelectionId);
      } else {
        newInks.delete(inkSelectionId);
      }
      return { ...prev, inks: newInks, conditions: prev.conditions };
    });
  }, [ink, setSelectedItems, bookId]);


  const handleRowClickInternal = (e) => {
    const isCheckbox = e.target.closest('[role="checkbox"]');
    const isButton = e.target.closest('button');
    if (isCheckbox || isButton) return;
    onRowClick(); // This will toggle row highlighting and flyout
  };

  const handleViewClick = (e) => {
    e.stopPropagation();
    navigate(`/assets/inks/${ink.id}`);
  };

  const handleToggleClick = (e) => {
    e.stopPropagation();
    onToggleExpand(ink.id);
  };

// ALWAYS use on-substrate solid color for thumbnail - never the selected wedge
  const backgroundColor = useMemo(() => {
    return getSolidColorHexFromConditions(ink.conditions || []);
  }, [ink.conditions]);
  
  // Get icon color based on background brightness
  const getIconColorFromHex = (hex) => {
    if (!hex) return 'text-gray-500';
    
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Use white text for dark backgrounds, gray for light backgrounds
    return luminance < 0.5 ? 'text-white' : 'text-gray-500';
  };

  const iconColorClass = getIconColorFromHex(backgroundColor);

  const indentationClasses = {
    0: '',
    1: 'ml-4',
  };

  return (
    <TableRow
      className={cn(
        "h-14 cursor-pointer group",
        isActive ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50"
      )}
      onClick={handleRowClickInternal}
      data-state={isActive ? 'selected' : 'unchecked'}
    >
      <TableCell className="w-[50px] p-4">
        <Checkbox
          checked={selectionState === 'checked'}
          data-state={selectionState}
          onCheckedChange={handleSelect}
          onClick={(e) => e.stopPropagation()}
        />
      </TableCell>
      <TableCell className="w-[50px] p-4">
        <div className={cn("flex items-center", indentationClasses[indentationLevel])}>
          <Button variant="ghost" size="icon" onClick={handleToggleClick} className="w-9 h-9">
            {ink.conditions && ink.conditions.length > 0 ? (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : <div className="w-4 h-4" />}
          </Button>
        </div>
      </TableCell>
      <TableCell className="w-[50px] p-4 text-center">
        <div className="flex items-center justify-center" style={{ width: '48px', margin: '0 auto' }}>
        <div 
            className="h-8 w-full rounded-md border border-border flex items-center justify-center"
            style={{ backgroundColor }}
          >
            <Droplet className={cn("h-4 w-4", iconColorClass)} />
          </div>
        </div>
      </TableCell>
      <TableCell className="p-4 pl-6 whitespace-nowrap text-sm w-1/2">
        <span className="font-medium text-gray-900">{ink.name}</span>
      </TableCell>
      <TableCell className="p-4 whitespace-nowrap text-sm text-gray-600 w-1/4">{ink.print_process}</TableCell>
      <TableCell className="text-right text-muted-foreground p-4 w-1/4">
        {ink.updated_at ? format(new Date(ink.updated_at), 'MMM d, yyyy') : 'N/A'}
      </TableCell>
    </TableRow>
  );
};

export default InkRow;