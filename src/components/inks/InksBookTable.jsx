import React, { useState } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import InkBookRow from './InkBookRow';
import InkRow from './InkRow';
import InkConditionRow from './InkConditionRow';

const InksBookTable = ({ 
  inkBooks, 
  selectedIds, 
  allIds,
  onSelectAll, 
  onSelectBook, 
  onSelectInk,
  onSelectCondition,
  getBookSelectionState,
  getInkSelectionState
}) => {
  const [expandedBooks, setExpandedBooks] = useState(new Set());
  const [expandedInks, setExpandedInks] = useState(new Set());

  const isAllSelected = selectedIds.size > 0 && selectedIds.size === allIds.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < allIds.length;
  
  const toggleBookExpand = (bookId) => {
    setExpandedBooks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookId)) {
        newSet.delete(bookId);
      } else {
        newSet.add(bookId);
      }
      return newSet;
    });
  };

  const toggleInkExpand = (inkId) => {
    setExpandedInks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(inkId)) {
        newSet.delete(inkId);
      } else {
        newSet.add(inkId);
      }
      return newSet;
    });
  };

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            <TableHead className="w-[4%] p-4">
              <Checkbox 
                checked={isAllSelected}
                onCheckedChange={onSelectAll}
                data-state={isIndeterminate ? 'indeterminate' : (isAllSelected ? 'checked' : 'unchecked')}
              />
            </TableHead>
            <TableHead className="w-[5%] px-1 py-3"></TableHead>
            <TableHead className="w-[8%] px-1 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Icon</TableHead>
            <TableHead className="w-[25%] px-1 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</TableHead>
            <TableHead className="w-[15%] px-1 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pack Type</TableHead>
            <TableHead className="w-[17%] px-1 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Structure Details</TableHead>
            <TableHead className="w-[10%] px-1 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">View</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inkBooks.map((book) => {
            const isBookExpanded = expandedBooks.has(book.id);
            return (
            <React.Fragment key={book.id}>
              <InkBookRow 
                book={book}
                selectionState={getBookSelectionState(book)}
                onSelect={(checked) => onSelectBook(book, checked)}
                isExpanded={isBookExpanded}
                onToggleExpand={() => toggleBookExpand(book.id)}
              />
              {isBookExpanded && book.inks.map((ink) => {
                const isInkExpanded = expandedInks.has(ink.id);
                return (
                  <React.Fragment key={ink.id}>
                    <InkRow
                      ink={ink}
                      selectionState={getInkSelectionState(ink)}
                      onSelect={(checked) => onSelectInk(ink, checked)}
                      isExpanded={isInkExpanded}
                      onToggleExpand={() => toggleInkExpand(ink.id)}
                      isSubRow={true}
                    />
                    {isInkExpanded && ink.conditions && ink.conditions.map((condition) => (
                      <InkConditionRow 
                        key={condition.id} 
                        condition={condition} 
                        inkId={ink.id} 
                        isSelected={selectedIds.has(condition.id)}
                        onSelect={(checked) => onSelectCondition(condition, checked)}
                        isSubRow={true}
                      />
                    ))}
                  </React.Fragment>
                )
              })}
            </React.Fragment>
          )})}
        </TableBody>
      </Table>
      {inkBooks.length === 0 && (
         <div className="text-center py-12">
            <p className="text-gray-500">No ink books found. Create an ink to get started.</p>
         </div>
      )}
    </div>
  );
};

export default InksBookTable;