import React from 'react';
import { Search, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TestchartsTableToolbar = ({
  numSelected,
  onDelete,
  onEdit,
  searchTerm,
  onSearchTermChange
}) => {
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center space-x-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search test charts..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="pl-10 w-80"
          />
        </div>
      </div>

      {numSelected > 0 && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            {numSelected} selected
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={numSelected !== 1}
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
};

export default TestchartsTableToolbar;