import React from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import TableHeaderButton from '@/components/common/TableHeaderButton';
import SubstrateRow from './SubstrateRow';

const SubstratesTable = ({
  substrates,
  selectedIds,
  activeId,
  allIds,
  openSubstrates,
  onSelectAll,
  onSelectSubstrate,
  onSelectCondition,
  getSubstrateSelectionState,
  onRowClick,
  toggleSubstrate,
  sortConfig,
  onSort,
}) => {
  const allSelected = allIds.length > 0 && selectedIds.size === allIds.length;
  const isIndeterminate = selectedIds.size > 0 && !allSelected;

  return (
    <div className="min-w-[1200px]">
      <Table className="w-full">
      <TableHeader className="sticky top-0 z-20 bg-background shadow-sm">
        <TableRow className="hover:bg-transparent h-14 items-center">
          <TableHead className="w-[50px] p-4">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onSelectAll}
              data-state={isIndeterminate ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked')}
            />
          </TableHead>
          <TableHead className="w-[50px] p-4" />
          <TableHead className="w-[50px] p-4" />
          <TableHead style={{ width: 'calc(60% - 100px)', minWidth: '300px' }} className="p-4">
            <TableHeaderButton onClick={() => onSort?.('name')} sortKey="name" currentSort={sortConfig}>
              Name
            </TableHeaderButton>
          </TableHead>
          <TableHead style={{ width: '20%' }} className="p-4">
            <TableHeaderButton onClick={() => onSort?.('pack_type')} sortKey="pack_type" currentSort={sortConfig}>
              Pack Type
            </TableHeaderButton>
          </TableHead>
          <TableHead className="text-right p-4" style={{ width: '20%' }}>
            <TableHeaderButton onClick={() => onSort?.('updated_at')} sortKey="updated_at" currentSort={sortConfig}>
              Last Edited
            </TableHeaderButton>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence>
          {substrates.map((substrate) => (
            <SubstrateRow
              key={substrate.id}
              substrate={substrate}
              selectionState={getSubstrateSelectionState(substrate)}
              isActive={activeId === substrate.id}
              onSelectSubstrate={(checked) => onSelectSubstrate(substrate, checked)}
              onSelectCondition={onSelectCondition}
              isExpanded={openSubstrates.has(substrate.id)}
              onToggleExpand={() => toggleSubstrate(substrate.id)}
              onRowClick={onRowClick}
              selectedIds={selectedIds}
              activeId={activeId}
            />
          ))}
        </AnimatePresence>
      </TableBody>
    </Table>
    </div>
  );
};

export default SubstratesTable;