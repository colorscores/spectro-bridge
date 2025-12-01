import React from 'react';
import { TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { labToHexD65 } from '@/lib/colorUtils';

const SubstrateConditionRow = ({ condition, isSelected, isActive, onSelect, onRowClick }) => {
  const handleRowClickInternal = (e) => {
    const isCheckbox = e.target.closest('[role="checkbox"]');
    if (isCheckbox) return;
    onRowClick();
  };

  const stopPropagation = (e) => e.stopPropagation();

  // Fast display color: prefer stored hex, then lab values
  const displayColor = condition?.color_hex
    || (condition?.lab ? labToHexD65(condition.lab.L, condition.lab.a, condition.lab.b) : null)
    || '#f3f4f6';

  return (
    <>
      <TableCell
        className={cn(
          "w-[50px] p-4",
          isActive ? "bg-blue-50" : "hover:bg-gray-50"
        )}
        onClick={stopPropagation}
      >
        <Checkbox checked={isSelected} onCheckedChange={onSelect} />
      </TableCell>
      <TableCell
        className={cn(
          "w-[50px] p-4 cursor-pointer",
          isActive ? "bg-blue-50" : "hover:bg-gray-50"
        )}
        onClick={handleRowClickInternal}
      >
        <div className="h-8 w-8" />
      </TableCell>
      <TableCell
        className={cn(
          "w-[50px] p-4 cursor-pointer",
          isActive ? "bg-blue-50" : "hover:bg-gray-50"
        )}
        onClick={handleRowClickInternal}
      >
        <div>
          <div className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 border border-border"
            style={{ backgroundColor: displayColor }}>
          </div>
        </div>
      </TableCell>
      <TableCell
        className={cn(
          "p-4 cursor-pointer w-1/2",
          isActive ? "bg-blue-50" : "hover:bg-gray-50"
        )}
        onClick={handleRowClickInternal}
      >
        <span className="font-medium text-gray-900" title={condition.displayName || condition.name}>{condition.displayName || condition.name}</span>
      </TableCell>
      <TableCell
        className={cn(
          "p-4 text-gray-600 cursor-pointer w-1/4",
          isActive ? "bg-blue-50" : "hover:bg-gray-50"
        )}
        onClick={handleRowClickInternal}
      >
        {condition.pack_type && <Badge variant="secondary">{condition.pack_type}</Badge>}
      </TableCell>
      <TableCell
        className={cn(
          "text-right text-muted-foreground p-4 cursor-pointer w-1/4",
          isActive ? "bg-blue-50" : "hover:bg-gray-50"
        )}
        onClick={handleRowClickInternal}
      >
        {condition.updated_at ? format(new Date(condition.updated_at), 'MMM d, yyyy') : 'N/A'}
      </TableCell>
    </>
  );
};

export default SubstrateConditionRow;