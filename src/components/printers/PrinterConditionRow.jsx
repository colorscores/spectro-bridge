import React, { useCallback } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, XCircle } from 'lucide-react';
import { getSubstrateColor } from '@/lib/substrateColors';
import { cn } from '@/lib/utils';

const PrinterConditionRow = ({ condition, printerId, selectedItems, setSelectedItems, onRowClick, isActive }) => {
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
    if (isCheckbox) return;
    onRowClick();
  };

  const substrateColor = getSubstrateColor(condition);
  const isCalibrated = condition.calibration?.status === 'complete';
  const inkCount = condition.inks?.length || 0;
  const inkNames = condition.inks?.map(ink => ink.name).join(', ') || '';

  return (
    <TooltipProvider>
      <TableRow
        className={cn(
          "cursor-pointer bg-gray-50/50 ml-4",
          isActive ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-100"
        )}
        onClick={handleRowClickInternal}
        data-state={isSelected ? 'selected' : 'unchecked'}
      >
        <TableCell className="w-[50px] p-4">
          <Checkbox checked={isSelected} onCheckedChange={handleSelect} onClick={(e) => e.stopPropagation()}/>
        </TableCell>
        <TableCell className="w-[50px] p-4">
          <div className="ml-4">
          </div>
        </TableCell>
        <TableCell className="w-[50px] p-4 text-center">
          <div 
            className="inline-block w-8 h-8 rounded-full border border-gray-200"
            style={{ backgroundColor: substrateColor }}
          />
        </TableCell>
        <TableCell className="p-4 whitespace-nowrap text-sm font-medium text-gray-900">
          <span className="font-medium text-gray-800">{condition.name}</span>
        </TableCell>
        <TableCell className="p-4 whitespace-nowrap text-sm text-gray-500">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{condition.substrate_name || 'Unknown Substrate'}</span>
            {condition.substrate_condition && (
              <span className="text-xs text-gray-400">{condition.substrate_condition}</span>
            )}
          </div>
        </TableCell>
        <TableCell className="p-4 whitespace-nowrap text-sm text-gray-500 text-center">
          {inkCount > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help font-medium">{inkCount}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{inkNames}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-gray-400">0</span>
          )}
        </TableCell>
        <TableCell className="p-4 whitespace-nowrap text-sm text-gray-500">
          {condition.last_calibration_date || 'Never'}
        </TableCell>
        <TableCell className="p-4 whitespace-nowrap text-sm text-gray-500">
          <div className="flex items-center gap-2">
            {isCalibrated ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-green-600 font-medium">Calibrated</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-600 font-medium">Uncalibrated</span>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    </TooltipProvider>
  );
};

export default PrinterConditionRow;