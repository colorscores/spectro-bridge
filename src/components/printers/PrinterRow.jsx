import React, { useMemo, useCallback } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Printer, ChevronDown, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const PrinterRow = ({ printer, isExpanded, onToggleExpand, selectedItems, setSelectedItems, onRowClick, isActive }) => {
  const selectionState = useMemo(() => {
    const isPrinterSelected = selectedItems.printers.has(printer.id);
    const conditionIds = printer.conditions?.map(c => c.id) || [];
    const selectedConditionsCount = conditionIds.filter(id => selectedItems.conditions.has(id)).length;

    if (isPrinterSelected && selectedConditionsCount === conditionIds.length) return 'checked';
    if (isPrinterSelected || selectedConditionsCount > 0) return 'indeterminate';
    return 'unchecked';
  }, [printer, selectedItems]);
  
  const handleSelect = useCallback((checked) => {
    setSelectedItems(prev => {
      const newPrinters = new Set(prev.printers);
      const newConditions = new Set(prev.conditions);

      if (checked) {
        newPrinters.add(printer.id);
        if (printer.conditions) {
          printer.conditions.forEach(c => newConditions.add(c.id));
        }
      } else {
        newPrinters.delete(printer.id);
        if (printer.conditions) {
          printer.conditions.forEach(c => newConditions.delete(c.id));
        }
      }
      return { ...prev, printers: newPrinters, conditions: newConditions };
    });
  }, [printer, setSelectedItems]);

  const handleRowClickInternal = (e) => {
    const isCheckbox = e.target.closest('[role="checkbox"]');
    const isButton = e.target.closest('button');
    if (isCheckbox || isButton) return;
    onRowClick();
  };

  const handleToggleClick = (e) => {
    e.stopPropagation();
    onToggleExpand(printer.id);
  };

  const hasConditions = printer.conditions && printer.conditions.length > 0;

  return (
    <TableRow
      className={cn(
        "cursor-pointer font-semibold bg-gray-100/50",
        isActive ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-200/60"
      )}
      onClick={handleRowClickInternal}
      data-state={selectionState !== 'unchecked' ? 'selected' : ''}
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
        <Button variant="ghost" size="icon" onClick={handleToggleClick} className="w-9 h-9">
          {hasConditions ? (
            isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : <div className="w-4 h-4" />}
        </Button>
      </TableCell>
      <TableCell className="w-[50px] p-4 text-center">
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 border border-gray-300">
          <Printer className="h-5 w-5 text-gray-600" />
        </div>
      </TableCell>
      <TableCell className="p-4 whitespace-nowrap text-sm text-gray-900">
        <span className="font-medium text-gray-800">{printer.name}</span>
      </TableCell>
      <TableCell className="p-4 whitespace-nowrap text-sm text-gray-500">
        {/* Empty for printer rows */}
      </TableCell>
      <TableCell className="p-4 whitespace-nowrap text-sm text-gray-500">
        {/* Empty for printer rows */}
      </TableCell>
      <TableCell className="p-4 whitespace-nowrap text-sm text-gray-500">
        {/* Empty for printer rows */}
      </TableCell>
      <TableCell className="p-4 whitespace-nowrap text-sm text-gray-500">
        {/* Empty for printer rows */}
      </TableCell>
    </TableRow>
  );
};

export default PrinterRow;