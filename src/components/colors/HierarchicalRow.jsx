import React, { useMemo } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DependentIcon from '@/components/icons/DependentIcon';
import HierarchyLineIcon from '@/components/icons/HierarchyLineIcon';
import { getContrastColor } from '@/lib/colorUtils/common';
import { useProfile } from '@/context/ProfileContext';
import { useCanEdit } from '@/hooks/useCanEdit';
import { sortMeasurementModes } from '@/lib/utils/measurementUtils';

const HierarchicalRow = ({
  color,
  isSelected,
  onSelect,
  onRowClick,
  isActive,
  isMaster,
  isLastInGroup,
  hasDependents,
  isOpen,
  onToggle,
  style,
  isPartnerView,
  showOwnerColumn,
}) => {
  const { profile } = useProfile();
  const canEdit = useCanEdit();
  const isOwnColor = useMemo(() => {
    const orgId = profile?.organization_id;
    const colorOrg = color?.organization_id;
    return Boolean(orgId && colorOrg && orgId === colorOrg);
  }, [profile?.organization_id, color?.organization_id]);
  const canEditColor = useMemo(() => Boolean(canEdit && isOwnColor), [canEdit, isOwnColor]);
  
  const handleToggleClick = (e) => {
    e.stopPropagation();
    if (onToggle) {
      onToggle();
    }
  };

  const handleRowClickInternal = (e) => {
    const isCheckbox = e.target.closest('[role="checkbox"]');
    const isToggle = e.target.closest('button');
    if (isCheckbox || isToggle) return;
    if (onRowClick && color && color.id) {
      onRowClick(color.id);
    }
  };

  const stopPropagation = (e) => e.stopPropagation();

  const tags = color.tags && Array.isArray(color.tags) ? color.tags : [];
  const iconColor = getContrastColor(color.hex);
  
  const modes = sortMeasurementModes(Array.from(new Set((color.measurements || []).map(m => m.mode))));

  return (
      <TableRow
        style={style}
        className={cn(
          "h-14 cursor-pointer group flex relative items-center",
          style ? "absolute w-full" : "w-full",
          isActive ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50",
          !isOwnColor && "bg-gray-50/50 opacity-75"
        )}
        onClick={handleRowClickInternal}
        data-state={isSelected ? 'checked' : 'unchecked'}
      >
        <TableCell className="w-[50px] pl-4 flex items-center justify-center z-10 h-full" onClick={stopPropagation}>
          <Checkbox 
            checked={isSelected} 
            onCheckedChange={(checked) => onSelect(color.id, checked)} 
            disabled={!canEditColor}
            className={!canEditColor ? "opacity-50 cursor-not-allowed" : ""}
          />
        </TableCell>

        {!isMaster && (
          <TableCell className="w-[50px] shrink-0 p-4" />
        )}

        <TableCell className="w-[50px] p-0 flex items-center justify-center h-full">
          {hasDependents && isMaster && (
            <Button variant="ghost" size="icon" onClick={handleToggleClick} className="h-6 w-6">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
        </TableCell>

        <TableCell className="w-[50px] p-0 flex items-center justify-center h-full relative">
          {isMaster && hasDependents && isOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 w-px bg-gray-300 pointer-events-none" style={{ top: '100%', height: 'calc(100% + 28px)' }} />
          )}
          {isMaster && (
            <div
              className="h-10 w-10 rounded-md border border-gray-200 flex items-center justify-center flex-shrink-0 relative z-10"
              style={{ backgroundColor: (typeof color.hex === 'string' ? color.hex : color.hex?.hex) || '#E5E7EB' }}
            >
              <Target className={cn("h-5 w-5", iconColor)} />
            </div>
          )}
          {!isMaster && (
            <>
              <div
                className="h-10 w-10 rounded-md border border-gray-200 flex items-center justify-center flex-shrink-0 relative z-10"
                style={{ backgroundColor: (typeof color.hex === 'string' ? color.hex : color.hex?.hex) || '#E5E7EB' }}
              >
                <div className="absolute top-1/2 right-full -translate-y-1/2 w-5 h-[2px] bg-gray-400/90 pointer-events-none" />
                <DependentIcon className={cn("h-5 w-5", iconColor)} />
              </div>
            </>
          )}
        </TableCell>

        <TableCell className="min-w-[200px] flex-1 p-4 text-left">
          <div className="flex items-center h-full">
            <span className="font-medium text-gray-800 truncate">{color.name}</span>
          </div>
        </TableCell>

        {showOwnerColumn && (
          <TableCell className="w-[150px] px-4 text-left flex items-center h-full">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-sm truncate",
                isOwnColor ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                {color.owner_org_name || '—'}
              </span>
              {!isOwnColor && (
                <Badge variant="outline" className="text-xs py-0 px-1 h-4">
                  Shared
                </Badge>
              )}
            </div>
          </TableCell>
        )}

        <TableCell className="w-[220px] px-4 text-left flex items-center h-full hidden sm:flex">
          <div className="flex items-center gap-1 flex-nowrap overflow-hidden">
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag.id || tag.name} variant="secondary">{tag.name}</Badge>
            ))}
            {tags.length > 3 && <Badge variant="outline">+{tags.length - 3}</Badge>}
          </div>
        </TableCell>
        
        <TableCell className="w-[200px] px-4 text-center flex items-center justify-center gap-1 h-full hidden lg:flex">
          {modes && modes.length > 0 ? (
            modes.map((m) => <Badge key={m} variant="outline">{m}</Badge>)
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>

        <TableCell className="w-[120px] px-4 text-right flex items-center justify-end h-full text-gray-500">
          {color.updated_at ? format(new Date(color.updated_at), 'MMM d, yyyy') : 'N/A'}
        </TableCell>
      </TableRow>
  );
};

export default React.memo(HierarchicalRow);
