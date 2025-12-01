import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight } from 'lucide-react';
import InkBookIcon from '@/components/icons/InkBookIcon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const InkBookRow = ({ book, isExpanded, onToggleExpand, selectedItems, setSelectedItems, selectionState }) => {
  const handleSelect = (checked) => {
    setSelectedItems(prev => {
      const newBooks = new Set(prev.books);

      if (checked) {
        newBooks.add(book.id);
      } else {
        newBooks.delete(book.id);
      }
      // Book selection is independent - don't automatically select/deselect child items
      return { ...prev, books: newBooks };
    });
  };

  const handleToggleClick = (e) => {
    e.stopPropagation();
    onToggleExpand(book.id);
  };

  return (
    <TableRow
      className="h-14 bg-blue-50 hover:bg-blue-100 font-semibold cursor-pointer group"
      onClick={handleToggleClick}
      data-state={selectionState}
    >
      <TableCell className="w-[50px] p-4"> {/* Checkbox Column */}
        <Checkbox
          checked={selectionState === 'checked'}
          data-state={selectionState}
          onCheckedChange={handleSelect}
          onClick={(e) => e.stopPropagation()}
        />
      </TableCell>
      <TableCell className="w-[50px] p-4"> {/* Expand/Collapse Column */}
        <Button variant="ghost" size="icon" onClick={handleToggleClick} className="w-9 h-9">
          {book.inks && book.inks.length > 0 ? (
            isExpanded ? <ChevronRight className="h-4 w-4 rotate-90 transition-transform" /> : <ChevronRight className="h-4 w-4 transition-transform" />
          ) : <div className="w-4 h-4" />} {/* Empty div to maintain alignment if no inks */}
        </Button>
      </TableCell>
      <TableCell className="w-[50px] p-4 text-center"> {/* Type Icon Column */}
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-blue-200 bg-blue-100">
          <InkBookIcon className="h-5 w-5 text-blue-600" />
        </div>
      </TableCell>
      <TableCell className="p-4 whitespace-nowrap text-sm w-1/2">
        <span className="font-medium text-blue-900">{book.name}</span>
        <span className="ml-2 text-gray-500">({book.inks.length} inks)</span>
      </TableCell>
      <TableCell className="w-1/4"></TableCell> {/* Print Process - empty for book rows */}
      <TableCell className="w-1/4"></TableCell> {/* Last Edited - empty for book rows */}
    </TableRow>
  );
};

export default InkBookRow;