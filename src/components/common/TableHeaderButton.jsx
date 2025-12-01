import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const TableHeaderButton = ({ children, className = "", onClick, sortKey, currentSort }) => {
  const isActive = currentSort?.key === sortKey;
  
  const getSortIcon = () => {
    if (!isActive) return <ArrowUpDown className="ml-2 h-3 w-3" />;
    return currentSort?.direction === 'asc' 
      ? <ArrowUp className="ml-2 h-3 w-3" />
      : <ArrowDown className="ml-2 h-3 w-3" />;
  };

  return (
    <Button 
      variant="ghost" 
      className={cn(
        "text-muted-foreground hover:text-foreground p-0 h-auto font-semibold",
        isActive && "text-foreground",
        className
      )}
      onClick={onClick}
    >
      {children}
      {getSortIcon()}
    </Button>
  );
};

export default TableHeaderButton;
