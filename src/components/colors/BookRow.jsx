import React, { memo } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, Book } from 'lucide-react';
import { cn } from '@/lib/utils';

const BookRow = memo((props) => {
  const { book, isOpen, onToggle, isSelected, onSelect, style, showOwnerColumn } = props;

  const handleCheckboxChange = (checked) => {
    onSelect(book.id, checked);
  };
  
  const handleRowClick = (e) => {
    if (e.target.closest('[role="checkbox"]')) {
      return;
    }
    onToggle(book.id);
  };

  return (
      <TableRow 
        style={style}
        onClick={handleRowClick}
        className={cn(
          "h-14 border-b-gray-200 bg-gray-50 hover:bg-gray-100 font-semibold group cursor-pointer flex",
          style ? "absolute w-full" : "w-full"
        )}
        data-state={isSelected ? 'selected' : ''}
      >
        <TableCell className="w-[50px] p-4 flex items-center justify-center">
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
            aria-label={`Select book ${book.name}`}
          />
        </TableCell>
        <TableCell className="w-[50px] p-4 flex items-center justify-center">
          <ChevronRight className={cn("h-4 w-4 transition-none", isOpen && "rotate-90")} />
        </TableCell>
        <TableCell className="basis-1/2 min-w-[240px] p-4 flex items-center font-medium text-gray-800">
          <div className="h-8 w-8 rounded-md border border-gray-200 flex items-center justify-center bg-white flex-shrink-0 mr-2">
            <Book className="h-4 w-4 text-gray-500" />
          </div>
          <span>{book.name}</span>
          <span className="ml-2 text-gray-500 font-normal">({book.totalCount} colors)</span>
        </TableCell>
        {showOwnerColumn && (
          <TableCell className="w-[150px] shrink-0 p-4 text-left flex items-center hidden lg:flex"></TableCell>
        )}
        <TableCell className="w-[220px] p-4 text-left hidden sm:flex"></TableCell>
        <TableCell className="w-[200px] p-4 text-center hidden lg:flex"></TableCell>
        <TableCell className="w-[120px] p-4 text-right hidden sm:flex"></TableCell>
      </TableRow>
  );
});

export default BookRow;
