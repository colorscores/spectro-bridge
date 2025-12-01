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
import { ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react';
import InkBookRow from './InkBookRow';
import InkRow from './InkRow';
import InkConditionRow from './InkConditionRow';
import { cn } from '@/lib/utils';

const TableHeaderButton = ({ children, className = "" }) => (
  <Button variant="ghost" className={cn("text-muted-foreground hover:text-foreground p-0 h-auto font-semibold", className)}>
    {children}
    <ArrowUpDown className="ml-2 h-3 w-3" />
  </Button>
);

const InksTable = ({ view, inks, inkBooks, selectedItems, setSelectedItems, onRowClick, activeId, getSubstrateConditionColor }) => {
  const [expandedBooks, setExpandedBooks] = useState(new Set());
  const [expandedInks, setExpandedInks] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const toggleBook = useCallback((bookId) => {
    setExpandedBooks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookId)) {
        newSet.delete(bookId);
      } else {
        newSet.add(bookId);
      }
      return newSet;
    });
  }, []);

  const toggleInk = useCallback((inkId) => {
    setExpandedInks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(inkId)) {
        newSet.delete(inkId);
      } else {
        newSet.add(inkId);
      }
      return newSet;
    });
  }, []);

  const getBookSelectionState = useCallback((book) => {
    // Book selection is independent - only check if the book itself is selected
    return selectedItems.books.has(book.id) ? 'checked' : 'unchecked';
  }, [selectedItems]);

  const allInksCount = useMemo(() => inks.length, [inks]);
  const allConditionsCount = useMemo(() => inks.reduce((acc, ink) => acc + ink.conditions.length, 0), [inks]);

  // "Select All" means select all inks AND all conditions independently
  const allSelected = selectedItems.inks.size === allInksCount && selectedItems.conditions.size === allConditionsCount && allInksCount > 0;
  const isIndeterminate = !allSelected && (selectedItems.inks.size > 0 || selectedItems.conditions.size > 0 || selectedItems.books.size > 0);

  const handleSelectAll = useCallback((checked) => {
    setSelectedItems(prev => {
      const newBooks = new Set();
      const newInks = new Set();
      const newConditions = new Set();

      if (checked) {
        inkBooks.forEach(book => newBooks.add(book.id));
        inks.forEach(ink => {
          newInks.add(ink.id);
          ink.conditions.forEach(c => newConditions.add(c.id));
        });
      }
      return { books: newBooks, inks: newInks, conditions: newConditions };
    });
  }, [inks, inkBooks, setSelectedItems]);

  // Expand/collapse all functionality
  const hasExpandableItems = inks.length > 0 || inkBooks.length > 0;
  const allExpanded = useMemo(() => {
    if (view === 'book') {
      return expandedBooks.size > 0 && 
             inkBooks.every(book => expandedBooks.has(book.id)) &&
             expandedInks.size > 0 && 
             inks.every(ink => expandedInks.has(ink.id));
    } else {
      return expandedInks.size > 0 && inks.every(ink => expandedInks.has(ink.id));
    }
  }, [expandedBooks, expandedInks, inkBooks, inks, view]);

  const handleExpandCollapseAll = useCallback(() => {
    if (allExpanded) {
      // Collapse all
      setExpandedBooks(new Set());
      setExpandedInks(new Set());
    } else {
      // Expand all
      if (view === 'book') {
        setExpandedBooks(new Set(inkBooks.map(book => book.id)));
        setExpandedInks(new Set(inks.map(ink => ink.id)));
      } else {
        setExpandedInks(new Set(inks.map(ink => ink.id)));
      }
    }
  }, [allExpanded, view, inkBooks, inks, setExpandedBooks, setExpandedInks]);

  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const sortedInks = useMemo(() => {
    if (!sortConfig.key || !inks) return inks;
    
    const sorted = [...inks].sort((a, b) => {
      let aValue, bValue;
      
      if (sortConfig.key === 'updated_at') {
        aValue = new Date(a.updated_at || 0).getTime();
        bValue = new Date(b.updated_at || 0).getTime();
      } else if (sortConfig.key === 'name') {
        aValue = (a.name || '').toLowerCase();
        bValue = (b.name || '').toLowerCase();
      } else if (sortConfig.key === 'print_process') {
        aValue = (a.print_process || '').toLowerCase();
        bValue = (b.print_process || '').toLowerCase();
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [inks, sortConfig]);

  const sortedInkBooks = useMemo(() => {
    if (!sortConfig.key || !inkBooks) return inkBooks;
    
    return inkBooks.map(book => ({
      ...book,
      inks: [...(book.inks || [])].sort((a, b) => {
        let aValue, bValue;
        
        if (sortConfig.key === 'updated_at') {
          aValue = new Date(a.updated_at || 0).getTime();
          bValue = new Date(b.updated_at || 0).getTime();
        } else if (sortConfig.key === 'name') {
          aValue = (a.name || '').toLowerCase();
          bValue = (b.name || '').toLowerCase();
        } else if (sortConfig.key === 'print_process') {
          aValue = (a.print_process || '').toLowerCase();
          bValue = (b.print_process || '').toLowerCase();
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      })
    }));
  }, [inkBooks, sortConfig]);


  return (
    <div className="min-w-[1400px]">
      <Table style={{ tableLayout: 'fixed' }}>
        <TableHeader>
          <TableRow className="border-b-gray-200 hover:bg-transparent h-14 items-center">
            <TableHead className="w-[50px] p-4"><Checkbox checked={allSelected} data-state={isIndeterminate ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked')} onCheckedChange={handleSelectAll} /></TableHead>
            <TableHead className="w-[50px] p-4">
              {hasExpandableItems && (
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-9 h-9"
                    onClick={handleExpandCollapseAll}
                  >
                    {allExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </TableHead>
            <TableHead className="w-[50px] p-4"> {/* Type Icon Column */} </TableHead>
            <TableHead className="p-4 w-1/2">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground p-0 h-auto font-semibold" onClick={() => handleSort('name')}>
                Name
                <ArrowUpDown className="ml-2 h-3 w-3" />
              </Button>
            </TableHead>
            <TableHead className="p-4 w-1/4">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground p-0 h-auto font-semibold" onClick={() => handleSort('print_process')}>
                Print Process
                <ArrowUpDown className="ml-2 h-3 w-3" />
              </Button>
            </TableHead>
            <TableHead className="text-right p-4 w-1/4">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground p-0 h-auto font-semibold" onClick={() => handleSort('updated_at')}>
                Last Edited
                <ArrowUpDown className="ml-2 h-3 w-3" />
              </Button>
            </TableHead>
            
          </TableRow>
        </TableHeader>
        <TableBody>
          {view === 'book' ? (
            sortedInkBooks.map((book) => (
              <Fragment key={book.id}>
                <InkBookRow
                  book={book}
                  isExpanded={expandedBooks.has(book.id)}
                  onToggleExpand={toggleBook}
                  selectedItems={selectedItems}
                  setSelectedItems={setSelectedItems}
                  selectionState={getBookSelectionState(book)}
                />
                {expandedBooks.has(book.id) && book.inks.map((ink) => (
                  <Fragment key={`${ink.id}::${book.id}`}>
                    <InkRow
                      ink={ink}
                      isExpanded={expandedInks.has(ink.id)}
                      onToggleExpand={toggleInk}
                      selectedItems={selectedItems}
                      setSelectedItems={setSelectedItems}
                      indentationLevel={1}
                      onRowClick={() => onRowClick({ ...ink, assetType: 'Ink' })}
                      isActive={activeId === ink.id}
                      bookId={book.id}
                      associationId={ink.associationId}
                    />
                    {expandedInks.has(ink.id) && ink.conditions.map((condition) => (
                      <InkConditionRow
                        key={condition.id}
                        condition={condition}
                        inkId={ink.id}
                        selectedItems={selectedItems}
                        setSelectedItems={setSelectedItems}
                        indentationLevel={2}
                        onRowClick={() => onRowClick({ ...condition, assetType: 'Ink Condition', parentId: ink.id })}
                        isActive={activeId === condition.id}
                        getSubstrateConditionColor={getSubstrateConditionColor}
                      />
                    ))}
                  </Fragment>
                ))}
              </Fragment>
            ))
          ) : (
            sortedInks.map((ink) => (
              <Fragment key={ink.id}>
                <InkRow
                  ink={ink}
                  isExpanded={expandedInks.has(ink.id)}
                  onToggleExpand={toggleInk}
                  selectedItems={selectedItems}
                  setSelectedItems={setSelectedItems}
                  indentationLevel={0}
                  onRowClick={() => onRowClick({ ...ink, assetType: 'Ink' })}
                  isActive={activeId === ink.id}
                />
                {expandedInks.has(ink.id) && ink.conditions.map((condition) => (
                  <InkConditionRow
                    key={condition.id}
                    condition={condition}
                    inkId={ink.id}
                    selectedItems={selectedItems}
                    setSelectedItems={setSelectedItems}
                    indentationLevel={1}
                    onRowClick={() => onRowClick({ ...condition, assetType: 'Ink Condition', parentId: ink.id })}
                    isActive={activeId === condition.id}
                    getSubstrateConditionColor={getSubstrateConditionColor}
                  />
                ))}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default InksTable;