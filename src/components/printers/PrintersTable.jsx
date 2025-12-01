import React, { Fragment, useState, useCallback, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowUpDown } from 'lucide-react';
import PrinterRow from './PrinterRow';
import PrinterConditionRow from './PrinterConditionRow';
import { cn } from '@/lib/utils';

const TableHeaderButton = ({ children, className = "" }) => (
  <Button variant="ghost" className={cn("text-muted-foreground hover:text-foreground p-0 h-auto font-semibold", className)}>
    {children}
    <ArrowUpDown className="ml-2 h-3 w-3" />
  </Button>
);

const PrintersTable = ({ printers, selectedItems, setSelectedItems, onRowClick, activeId, expandedPrinters, setExpandedPrinters }) => {
  // Use props if provided, otherwise manage state internally
  const [internalExpandedPrinters, setInternalExpandedPrinters] = useState(new Set());
  const actualExpandedPrinters = expandedPrinters || internalExpandedPrinters;
  const actualSetExpandedPrinters = setExpandedPrinters || setInternalExpandedPrinters;

  const togglePrinter = useCallback((printerId) => {
    actualSetExpandedPrinters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(printerId)) {
        newSet.delete(printerId);
      } else {
        newSet.add(printerId);
      }
      return newSet;
    });
  }, [actualSetExpandedPrinters]);

  const allPrintersCount = useMemo(() => printers.length, [printers]);
  const allConditionsCount = useMemo(() => printers.reduce((acc, printer) => acc + (printer.conditions?.length || 0), 0), [printers]);

  const allSelected = selectedItems.printers.size === allPrintersCount && selectedItems.conditions.size === allConditionsCount && allPrintersCount > 0;
  const isIndeterminate = !allSelected && (selectedItems.printers.size > 0 || selectedItems.conditions.size > 0);

  const handleSelectAll = useCallback((checked) => {
    setSelectedItems(prev => {
      const newPrinters = new Set();
      const newConditions = new Set();

      if (checked) {
        printers.forEach(printer => {
          newPrinters.add(printer.id);
          if (printer.conditions) {
            printer.conditions.forEach(c => newConditions.add(c.id));
          }
        });
      }
      return { printers: newPrinters, conditions: newConditions };
    });
  }, [printers, setSelectedItems]);

  return (
    <div className="overflow-x-auto">
      <Table style={{ tableLayout: 'fixed' }}>
        <TableHeader>
          <TableRow className="border-b-gray-200 hover:bg-transparent">
            <TableHead className="w-[50px] p-4">
              <Checkbox 
                checked={allSelected} 
                data-state={isIndeterminate ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked')} 
                onCheckedChange={handleSelectAll} 
              />
            </TableHead>
            <TableHead className="w-[50px] p-4"> {/* Expand/Collapse Column */} </TableHead>
            <TableHead className="w-[50px] p-4"> {/* Type Icon Column */} </TableHead>
            <TableHead className="w-[250px] p-4"><TableHeaderButton>Printer/Condition Name</TableHeaderButton></TableHead>
            <TableHead className="w-[200px] p-4"><TableHeaderButton>Substrate + Condition</TableHeaderButton></TableHead>
            <TableHead className="w-[120px] p-4"><TableHeaderButton>Number of Inks</TableHeaderButton></TableHead>
            <TableHead className="w-[150px] p-4"><TableHeaderButton>Last Calibration</TableHeaderButton></TableHead>
            <TableHead className="w-[150px] p-4"><TableHeaderButton>Calibration Status</TableHeaderButton></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {printers.map((printer) => (
            <Fragment key={printer.id}>
              <PrinterRow
                printer={printer}
                isExpanded={actualExpandedPrinters.has(printer.id)}
                onToggleExpand={togglePrinter}
                selectedItems={selectedItems}
                setSelectedItems={setSelectedItems}
                onRowClick={() => onRowClick({ ...printer, assetType: 'Printer' })}
                isActive={activeId === printer.id}
              />
              {actualExpandedPrinters.has(printer.id) && printer.conditions?.map((condition) => (
                <PrinterConditionRow
                  key={condition.id}
                  condition={condition}
                  printerId={printer.id}
                  selectedItems={selectedItems}
                  setSelectedItems={setSelectedItems}
                  onRowClick={() => onRowClick({ ...condition, assetType: 'Printer Condition', parentId: printer.id })}
                  isActive={activeId === condition.id}
                />
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default PrintersTable;