import React, { useCallback } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { CheckSquare, Square, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSolidColorFromCondition } from '@/lib/wedgeUtils';
import { getInkConditionDisplayColor } from '@/lib/inkConditionUtils';

const InkConditionRow = ({ condition, inkId, selectedItems, setSelectedItems, indentationLevel = 0, onRowClick, isActive, getSubstrateConditionColor }) => {
  const navigate = useNavigate();

  const isSelected = selectedItems.conditions.has(condition.id);
  
  const handleSelect = useCallback((checked) => {
    setSelectedItems(prev => {
        const newConditions = new Set(prev.conditions);
        if (checked) {
            newConditions.add(condition.id);
        } else {
            newConditions.delete(condition.id);
        }
        return { ...prev, conditions: newConditions };
    });
  }, [condition.id, setSelectedItems]);

  const handleRowClickInternal = (e) => {
    const isCheckbox = e.target.closest('[role="checkbox"]');
    const isButton = e.target.closest('button');
    if (isCheckbox || isButton) return;
    onRowClick(); // This will toggle row highlighting and flyout
  };

  const handleViewClick = (e) => {
    e.stopPropagation();
    navigate(`/assets/inks/${inkId}/conditions/${condition.id}`);
  };

  const indentationClasses = {
    0: '',
    1: 'ml-4',
    2: 'ml-8',
  };

  // Use the utility function to get consistent color calculation
  const solidColorHex = getInkConditionDisplayColor(condition);
  
  // Get substrate condition color using the helper function
  const substrateColorHex = getSubstrateConditionColor ? 
    getSubstrateConditionColor(condition?.substrate_condition) : 
    condition?.substrate_color_hex || condition?.substrate_color || condition?.substrateCondition?.color_hex || condition?.substrate_condition_color || '#f5f5f5';

  return (
    <TableRow
      className={cn(
        "h-12 cursor-pointer",
        isActive ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50"
      )}
      onClick={handleRowClickInternal}
      data-state={isActive ? 'selected' : ''}
    >
      <TableCell className="w-[50px] py-2 px-4">
        <Checkbox checked={isSelected} onCheckedChange={handleSelect} onClick={(e) => e.stopPropagation()}/>
      </TableCell>
      <TableCell className="w-[50px] py-2 px-4">
        <div className={cn("flex items-center", indentationClasses[indentationLevel])}>
        </div>
      </TableCell>
      <TableCell className="w-[50px] py-2 px-4 text-center">
        <div className="flex items-center justify-center" style={{ width: '48px', margin: '0 auto' }}>
          <div 
            className="w-8 h-8 rounded-full border border-border z-10 relative flex-shrink-0" 
            style={{ backgroundColor: solidColorHex }}
          />
          <div 
            className="w-8 h-8 rounded-md border border-border -ml-4 flex-shrink-0" 
            style={{ backgroundColor: substrateColorHex }}
          />
        </div>
      </TableCell>
      <TableCell className="py-2 px-4 pl-6 text-sm font-medium text-gray-900 w-1/2">
        <span className="font-medium text-gray-900" title={condition.displayName || condition.name}>{condition.displayName || condition.name}</span>
      </TableCell>
      <TableCell className="py-2 px-4 text-sm text-gray-500 w-1/4">
        {condition.pack_type && <Badge variant="secondary">{condition.pack_type}</Badge>}
        {condition.is_part_of_structure && condition.substrateConditionName && (
          <span className="ml-2 text-xs text-muted-foreground">{condition.substrateConditionName}</span>
        )}
      </TableCell>
      <TableCell className="text-right text-gray-500 py-2 px-4 w-1/4">
        {condition.updated_at ? format(new Date(condition.updated_at), 'MMM d, yyyy') : 'N/A'}
      </TableCell>
    </TableRow>
  );
};

export default InkConditionRow;