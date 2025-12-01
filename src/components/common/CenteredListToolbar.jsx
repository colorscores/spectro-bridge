import React from 'react';
import { Input } from '@/components/ui/input';

const CenteredListToolbar = ({
  searchValue,
  onSearchChange,
  placeholder = 'Search... ',
  leftChildren = null,
  rightChildren = null,
  farRightChildren = null,
}) => {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-gray-50/50">
      <div className="flex items-center gap-2 flex-1">
        {leftChildren}
      </div>

      <div className="flex-1 flex justify-center px-4">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Input
              placeholder={placeholder}
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="h-8 w-full focus-visible:ring-offset-0"
            />
          </div>
          {rightChildren}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-1 justify-end">
        {farRightChildren}
      </div>
    </div>
  );
};

export default CenteredListToolbar;
