import React, { useMemo } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { labToHexD65 } from '@/lib/colorUtils';
import { useProfile } from '@/context/ProfileContext';

const PrintConditionRow = ({ condition, isSelected, isActive, onSelect, onRowClick }) => {
  const { profile } = useProfile();
  
  // Calculate display color from LAB or spectral data
  const displayColor = useMemo(() => {
    // Priority 1: Use condition.lab values if available
    if (condition.lab && typeof condition.lab === 'object' && 
        typeof condition.lab.L === 'number' && typeof condition.lab.a === 'number' && typeof condition.lab.b === 'number') {
      try {
        // Get organization defaults for illuminant
        const orgDefaults = profile?.organization;
        const sourceIlluminant = orgDefaults?.default_illuminant || 'D50';
        return labToHexD65(condition.lab.L, condition.lab.a, condition.lab.b, sourceIlluminant);
      } catch (error) {
        console.warn('Error converting LAB to hex for print condition:', error);
      }
    }
    
    // Priority 2: Use legacy database Lab columns
    if (condition.lab_l !== null && condition.lab_a !== null && condition.lab_b !== null) {
      try {
        const orgDefaults = profile?.organization;
        const sourceIlluminant = orgDefaults?.default_illuminant || 'D50';
        return labToHexD65(condition.lab_l, condition.lab_a, condition.lab_b, sourceIlluminant);
      } catch (error) {
        console.warn('Error converting legacy LAB to hex for print condition:', error);
      }
    }
    
    // Fallback: Use stored color_hex or default
    return condition.color_hex || '#f3f4f6';
  }, [condition, profile?.organization]);

  const handleRowClickInternal = (e) => {
    const isCheckbox = e.target.closest('[role="checkbox"]');
    if (isCheckbox) return;
    onRowClick();
  };

  const stopPropagation = (e) => e.stopPropagation();

  return (
    <TableRow className={cn(isActive ? "bg-blue-50" : "")}>
      <TableCell
        className="w-[50px] p-4"
        onClick={stopPropagation}
      >
        <Checkbox checked={isSelected} onCheckedChange={onSelect} />
      </TableCell>
      <TableCell
        className="w-[50px] p-4 cursor-pointer"
        onClick={handleRowClickInternal}
      >
        <div className="h-8 w-8" />
      </TableCell>
      <TableCell
        className="w-[50px] p-4 cursor-pointer"
        onClick={handleRowClickInternal}
      >
        <div>
          <div className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 border border-gray-200"
            style={{ backgroundColor: displayColor }}>
          </div>
        </div>
      </TableCell>
      <TableCell
        style={{ width: 'calc(40% - 100px)' }}
        className="p-4 cursor-pointer"
        onClick={handleRowClickInternal}
      >
        <span className="font-medium text-gray-700 truncate">{condition.name}</span>
      </TableCell>
      <TableCell
        style={{ width: '20%' }}
        className="p-4 text-gray-600 cursor-pointer"
        onClick={handleRowClickInternal}
      >
        {condition.print_process && <Badge variant="outline">{condition.print_process}</Badge>}
      </TableCell>
      <TableCell
        style={{ width: '20%' }}
        className="p-4 text-gray-600 cursor-pointer"
        onClick={handleRowClickInternal}
      >
        {condition.pack_type && <Badge variant="secondary">{condition.pack_type}</Badge>}
      </TableCell>
      <TableCell
        className="text-right text-gray-500 p-4 cursor-pointer"
        style={{ width: '20%' }}
        onClick={handleRowClickInternal}
      >
        {condition.updated_at ? format(new Date(condition.updated_at), 'MMM d, yyyy') : 'N/A'}
      </TableCell>
    </TableRow>
  );
};

export default PrintConditionRow;