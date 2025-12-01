import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import DependentIcon from '@/components/icons/DependentIcon';
import { Target } from 'lucide-react';
import { getContrastColor, getDisplayHex } from '@/lib/colorUtils';
import { sortMeasurementModes } from '@/lib/utils/measurementUtils';

const ColorRow = ({ color, isSelected, onSelect, onRowClick, showInBooks, parentBookId, isActive, style, isPartnerView, showOwnerColumn }) => {
  const handleRowClickInternal = (e) => {
    if (e.target.closest('[role="checkbox"]')) {
      return;
    }
    if (onRowClick && color && color.id) {
      onRowClick(color.id, parentBookId);
    }
  };

  const handleCheckboxChange = (checked) => {
    onSelect(color.id, checked, parentBookId);
  };

  if (!color) {
    return (
        <TableRow style={style} className={cn("h-14 flex items-center", style ? "absolute w-full" : "w-full")}>
          <TableCell className="w-full p-4"></TableCell>
        </TableRow>
    );
  }

  const tags = color.tags && Array.isArray(color.tags) ? color.tags : [];
  const displayHex = getDisplayHex(color) || '#E5E7EB';
  const iconColor = getContrastColor(displayHex);
  
  const modes = sortMeasurementModes(Array.from(new Set((color.measurements || []).map(m => m.mode))));
  
  return (
      <TableRow
        style={style}
        className={cn(
          "h-14 cursor-pointer group flex items-center",
          style ? "absolute w-full" : "w-full",
          isActive ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50",
          showInBooks && "bg-white"
        )}
        onClick={handleRowClickInternal}
        data-state={isSelected ? 'checked' : 'unchecked'}
      >
        <TableCell className="w-[50px] shrink-0 p-4 flex items-center justify-center">
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
            aria-label={`Select color ${color.name}`}
          />
        </TableCell>

        {showInBooks && (
          <TableCell className="w-[50px] shrink-0 p-4 flex items-center justify-center" />
        )}

        <TableCell className="basis-1/2 min-w-[240px] p-4 flex items-center text-left">
          <div
            className="h-8 w-8 rounded-md border border-border flex items-center justify-center flex-shrink-0 relative mr-2"
            style={{ backgroundColor: displayHex }}
          >
            {color.standard_type === 'master' && <Target className={cn("h-4 w-4", iconColor)} />}
            {color.standard_type === 'dependent' && <DependentIcon className={cn("h-4 w-4", iconColor)} />}
          </div>
          <span className="font-medium text-gray-900 truncate">{color.name}</span>
        </TableCell>
        
        {showOwnerColumn && (
          <TableCell className="w-[150px] shrink-0 p-4 text-left flex items-center hidden lg:flex">
            <span className="text-sm text-muted-foreground truncate">
              {color.owner_org_name || '—'}
            </span>
          </TableCell>
        )}
        
        <TableCell className="w-[220px] shrink-0 p-4 flex items-center text-left hidden sm:flex">
          <div className="flex items-center gap-1 flex-nowrap overflow-hidden">
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag.id || tag.name} variant="secondary" className="shrink-0">{tag.name}</Badge>
            ))}
            {tags.length > 3 && <Badge variant="outline" className="shrink-0">+{tags.length - 3}</Badge>}
          </div>
        </TableCell>
        
        <TableCell className="w-[200px] shrink-0 p-4 text-center flex items-center justify-center gap-1 hidden lg:flex">
          {modes && modes.length > 0 ? (
            modes.map((m) => <Badge key={m} variant="outline" className="shrink-0">{m}</Badge>)
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
        
        <TableCell className="w-[120px] shrink-0 p-4 text-right flex items-center justify-end text-muted-foreground hidden sm:flex">
          {color.updated_at ? format(new Date(color.updated_at), 'MMM d, yyyy') : 'N/A'}
        </TableCell>
      </TableRow>
  );
};

export default React.memo(ColorRow);
