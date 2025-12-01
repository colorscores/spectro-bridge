import React, { Fragment } from 'react';
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
import BookRow from './BookRow';
import ColorRow from './ColorRow';

const TableHeaderButton = ({ children, className = "" }) => (
  <Button variant="ghost" className={`text-muted-foreground hover:text-foreground p-0 h-auto font-semibold ${className}`}>
    {children}
    <ArrowUpDown className="ml-2 h-3 w-3" />
  </Button>
);

const ColorBooksTable = ({
  colorBooks,
  allColors,
  showInBooks,
  selectedColorIds,
  activeColorId,
  openBooks,
  handleSelectAll,
  handleSelectBook,
  handleSelectColor,
  toggleBook,
  getBookSelectionState,
  handleColorRowClick,
}) => {
  const allSelected = allColors.length > 0 && selectedColorIds.size === allColors.length;
  const isIndeterminate = selectedColorIds.size > 0 && selectedColorIds.size < allColors.length;

  return (
    <div className="overflow-x-auto">
      <Table style={{ tableLayout: 'fixed' }}>
        <TableHeader>
          <TableRow className="border-b-gray-200 hover:bg-transparent">
            <TableHead className="w-[50px]"><Checkbox checked={allSelected} data-state={isIndeterminate ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked')} onCheckedChange={handleSelectAll} /></TableHead>
            <TableHead className={`transition-all duration-300 ${showInBooks ? 'w-[50px]' : 'w-0 p-0'}`} />
            <TableHead className="w-1/3"><TableHeaderButton>Color Name</TableHeaderButton></TableHead>
            <TableHead><TableHeaderButton>Tag Category</TableHeaderButton></TableHead>
            <TableHead><TableHeaderButton>Tag Category</TableHeaderButton></TableHead>
            <TableHead className="text-right"><TableHeaderButton>Last Edited</TableHeaderButton></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {showInBooks ? (
            colorBooks.map((book) => (
              <Fragment key={book.id}>
                <BookRow
                  book={book}
                  isOpen={openBooks.has(book.id)}
                  onToggle={toggleBook}
                />
                {openBooks.has(book.id) && book.colors.map((color) => (
                  <ColorRow
                    key={color.id}
                    color={color}
                    isSelected={selectedColorIds.has(color.id)}
                    isActive={activeColorId === color.id}
                    onSelect={handleSelectColor}
                    onRowClick={handleColorRowClick}
                    showInBooks={true}
                  />
                ))}
              </Fragment>
            ))
          ) : (
            allColors.map((color) => (
              <ColorRow
                key={color.id}
                color={color}
                isSelected={selectedColorIds.has(color.id)}
                isActive={activeColorId === color.id}
                onSelect={handleSelectColor}
                onRowClick={handleColorRowClick}
                showInBooks={false}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default ColorBooksTable;