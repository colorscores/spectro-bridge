import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import SubstrateConditionRow from './SubstrateConditionRow';
import { getSubstrateIconColor } from '@/lib/colorUtils';
import { labToHexD65 } from '@/lib/colorUtils';

const SubstrateRow = ({
  substrate,
  selectionState,
  isActive,
  onSelectSubstrate,
  onSelectCondition,
  isExpanded,
  onToggleExpand,
  onRowClick,
  selectedIds,
  activeId,
}) => {
  const hasConditions = substrate.conditions && substrate.conditions.length > 0;

  const handleRowClickInternal = (e) => {
    const isCheckbox = e.target.closest('[role="checkbox"]');
    const isButton = e.target.closest('button');
    if (isCheckbox || isButton) return;
    onRowClick(substrate);
  };

  const handleToggleClick = (e) => {
    e.stopPropagation();
    onToggleExpand();
  };
  
  // Compute background color cheaply without heavy spectral calculations
  const firstCondition = substrate.conditions && substrate.conditions.length > 0 ? substrate.conditions[0] : null;
  const backgroundColor = firstCondition?.color_hex
    || (firstCondition?.lab ? labToHexD65(firstCondition.lab.L, firstCondition.lab.a, firstCondition.lab.b) : null)
    || '#f3f4f6';
  const iconColorClass = getSubstrateIconColor(backgroundColor);

  return (
    <>
      <TableRow
        className={cn(
          "h-14 cursor-pointer group",
          isActive ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50",
          isExpanded && !isActive && "bg-gray-50"
        )}
        onClick={handleRowClickInternal}
        data-state={isActive || selectionState !== 'unchecked' ? 'selected' : 'unchecked'}
      >
        <TableCell className="w-[50px] p-4" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            onCheckedChange={onSelectSubstrate}
            checked={selectionState === 'checked'}
            data-state={selectionState}
          />
        </TableCell>
        <TableCell className="w-[50px] p-4">
          {hasConditions ? (
            <Button variant="ghost" size="icon" onClick={handleToggleClick} className="h-8 w-8">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          ) : <div className="h-8 w-8" />}
        </TableCell>
        <TableCell className="w-[50px] p-4">
          <div 
            className="h-8 w-8 rounded-md border border-gray-200 flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor }}
          >
            <Layers className={cn("h-4 w-4", iconColorClass)} />
          </div>
        </TableCell>
        <TableCell className="p-4 w-1/2">
          <span className="font-medium text-gray-900 truncate">{substrate.name}</span>
        </TableCell>
        <TableCell className="p-4 text-gray-600 w-1/4"></TableCell>
        <TableCell className="text-right text-muted-foreground p-4 w-1/4">
          {substrate.updated_at ? format(new Date(substrate.updated_at), 'MMM d, yyyy') : 'N/A'}
        </TableCell>
      </TableRow>
      {isExpanded && hasConditions && substrate.conditions.map((condition) => (
        <motion.tr
          key={condition.id}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{ overflow: 'hidden' }}
          transition={{ duration: 0.2 }}
          className={cn(
            "bg-white"
          )}
          data-state={activeId === condition.id || selectedIds.has(condition.id) ? 'selected' : 'unchecked'}
        >
          <SubstrateConditionRow
            condition={condition}
            isSelected={selectedIds.has(condition.id)}
            isActive={activeId === condition.id}
            onSelect={(checked) => onSelectCondition(condition, checked)}
            onRowClick={() => onRowClick(condition)}
          />
        </motion.tr>
      ))}
    </>
  );
};

export default SubstrateRow;