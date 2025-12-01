import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, BookText } from 'lucide-react';
import { cn } from '@/lib/utils';

const InkBookRow = ({ book, isOpen, onToggle, isSelected, onSelect }) => {
  const handleToggle = (e) => {
    if (e.target.closest('[data-checkbox-container]')) return;
    onToggle(book.id);
  };

  const handleSelectClick = (e) => {
    e.stopPropagation();
    onSelect(book, isSelected === 'checked' ? false : true);
  };

  return (
    <TableRow
      onClick={handleToggle}
      className="border-b-gray-200 bg-blue-50 hover:bg-blue-100 font-semibold group cursor-pointer"
      data-state={isSelected !== 'unchecked' ? 'selected' : ''}
    >
      <TableCell className="w-[50px]" onClick={(e) => e.stopPropagation()} data-checkbox-container>
        <Checkbox 
          onCheckedChange={() => onSelect(book, isSelected === 'checked' ? false : true)}
          checked={isSelected === 'checked'}
          data-state={isSelected}
        />
      </TableCell>
      <TableCell className="w-[50px] pl-4">
        <div className="flex items-center justify-start w-5 h-5">
          <ChevronRight className={cn("h-4 w-4 transition-transform duration-200", isOpen ? 'rotate-90' : '')} />
        </div>
      </TableCell>
      <TableCell className="w-[350px]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border border-blue-200 flex items-center justify-center bg-blue-100">
            <BookText className="h-5 w-5 text-blue-600" />
          </div>
          <span className="font-medium text-blue-900">{book.name}</span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-gray-500">({book.totalCount} colors)</span>
      </TableCell>
      <TableCell></TableCell>
      <TableCell></TableCell>
    </TableRow>
  );
};

export default InkBookRow;