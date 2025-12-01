import React, { useCallback, useRef } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import ColorRow from './ColorRow';
import BookRow from './BookRow';
import HierarchicalRow from './HierarchicalRow';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useProfile } from '@/context/ProfileContext';

const TableHeaderButton = ({ children, className = "", onClick, sortKey, currentSort }) => {
  const isActive = currentSort?.key === sortKey;
  const getSortIcon = () => {
    if (!isActive) return <ArrowUpDown className="ml-2 h-3 w-3" />;
    return currentSort.direction === 'asc' 
      ? <ArrowUp className="ml-2 h-3 w-3" />
      : <ArrowDown className="ml-2 h-3 w-3" />;
  };

  return (
    <Button 
      variant="ghost" 
      className={cn("text-muted-foreground hover:text-foreground p-0 h-auto font-semibold", isActive && "text-foreground", className)}
      onClick={onClick}
    >
      {children}
      {getSortIcon()}
    </Button>
  );
};

const ColorsTable = ({
  scrollContainerRef,
  assetGroups,
  allAssets,
  hierarchicalAssets,
  viewMode,
  selectedAssetIds,
  selectedBookIds,
  activeAssetId,
  openGroups,
  handleSelectAll,
  handleSelectAsset,
  handleSelectBook,
  toggleGroup,
  handleAssetRowClick,
  sortConfig,
  onSort,
}) => {
  const { profile } = useProfile();
  
  // Hide Owner column for brand owners, show for others (partners)
  const orgTypes = Array.isArray(profile?.organization?.type)
    ? profile.organization.type
    : (profile?.organization?.type ? [profile.organization.type] : []);
  const isBrandOwner = orgTypes.some(t => /brand owner/i.test(t));
  const showOwnerColumn = !isBrandOwner;
  const isPartnerView = !isBrandOwner;
  const isBookView = viewMode === 'book';
  const isDependentView = viewMode === 'dependent';

  const rows = React.useMemo(() => {
    let visibleRows = [];
    if (isBookView) {
      assetGroups.forEach(group => {
        if (group.id !== 'unassigned') {
          visibleRows.push({ id: group.id, type: 'book', book: group, isGroup: true });
          if (openGroups.has(String(group.id))) {
            group.assets.forEach(asset => {
              if (asset && asset.id) {
                visibleRows.push({ id: asset.id, type: 'color', color: asset, isGroup: false, parentBookId: group.id });
              }
            });
          }
        }
      });
    } else if (isDependentView) {
      hierarchicalAssets.forEach(master => {
        visibleRows.push({ id: master.id, type: 'color', color: master, isGroup: false, isMaster: true, level: 0 });
        if (openGroups.has(String(master.id)) && master.dependents) {
          master.dependents.forEach((dependent, index) => {
            visibleRows.push({ 
              id: dependent.id,
              type: 'color',
              color: dependent,
              isGroup: false, 
              isMaster: false, 
              level: 1,
              isLastInGroup: index === master.dependents.length - 1
            });
          });
        }
      });
    } else {
      visibleRows = allAssets.map(asset => ({ id: asset.id, type: 'color', color: asset, isGroup: false }));
    }
    return visibleRows;
  }, [isBookView, isDependentView, allAssets, assetGroups, hierarchicalAssets, openGroups]);
  const isSafari = typeof navigator !== 'undefined' && /Safari/i.test(navigator.userAgent) && !/(Chrome|CriOS|Chromium|Edg|Edge|OPR|FxiOS)/i.test(navigator.userAgent);
  const useVirtual = !isSafari;

  const scrollElementRef = useRef(null);
  
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 56,
    overscan: 15,
    getItemKey: (index) => {
        const row = rows[index];
        if (row.isGroup) return row.id;
        return row.parentBookId ? `${row.id}::${row.parentBookId}` : row.id;
    },
    paddingStart: 0,
    paddingEnd: 0,
  });

  const totalSelectedCount = selectedAssetIds.size + selectedBookIds.size;
  const allSelected = rows.length > 0 && totalSelectedCount === rows.length;
  const isIndeterminate = !allSelected && totalSelectedCount > 0;
  
  const handleSelectAllChange = useCallback((checked) => {
    handleSelectAll(checked, rows);
  }, [handleSelectAll, rows]);

  // Unified scroll container (no separate header scroller to avoid jitter)


  return (
    <div className="flex flex-col h-full">
      {/* Single scroll container handles both axes; header is sticky inside to avoid jitter */}
      <div 
        ref={scrollElementRef}
        className="flex-1 overflow-auto pb-4"
      >
        <div className="sticky top-0 z-20 bg-background shadow-sm">
          <Table className="w-full table-fixed min-w-[1150px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent flex w-full h-14 items-center">
                <TableHead className="w-[50px] shrink-0 p-4 flex items-center justify-center">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAllChange}
                    aria-label="Select all rows"
                    data-state={isIndeterminate ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked')}
                  />
                </TableHead>
                {isDependentView && <TableHead className="w-[50px] shrink-0 p-4" />}
                <TableHead className="w-[50px] shrink-0 p-4" />
                <TableHead className="w-[50px] shrink-0 p-4" />
                <TableHead className="basis-1/2 min-w-[240px] p-4 text-left">
                  <TableHeaderButton 
                    className="justify-start text-left" 
                    onClick={() => onSort('name')}
                    sortKey="name"
                    currentSort={sortConfig}
                  >
                    Name
                  </TableHeaderButton>
                </TableHead>
                {showOwnerColumn && (
                  <TableHead className="w-[150px] shrink-0 p-4 text-left hidden lg:table-cell">
                    <span className="text-muted-foreground font-semibold">Owner</span>
                  </TableHead>
                )}
                <TableHead className="w-[220px] shrink-0 p-4 text-left hidden sm:table-cell">
                  <TableHeaderButton 
                    className="justify-start text-left" 
                    onClick={() => onSort('tags')}
                    sortKey="tags"
                    currentSort={sortConfig}
                  >
                    Tags
                  </TableHeaderButton>
                </TableHead>
                <TableHead className="w-[200px] shrink-0 p-4 text-center hidden lg:table-cell">Mode(s)</TableHead>
                <TableHead className="w-[120px] shrink-0 p-4 text-right">
                  <TableHeaderButton 
                    className="justify-end text-right" 
                    onClick={() => onSort('updated_at')}
                    sortKey="updated_at"
                    currentSort={sortConfig}
                  >
                    Last Edited
                  </TableHeaderButton>
                </TableHead>
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        {useVirtual ? (
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, minWidth: '1150px' }} className="w-full relative">
            <Table className="w-full table-fixed min-w-[1150px]">
              <TableBody className="relative w-full">
                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                  const row = rows[virtualRow.index];
                  if (!row || !row.id) return null;

                  const style = {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translate3d(0, ${virtualRow.start}px, 0)`,
                    willChange: 'transform',
                  };

                  if (row.isGroup) {
                    return (
                      <BookRow
                        key={row.id}
                        style={style}
                        book={row.book}
                        isOpen={openGroups.has(String(row.id))}
                        onToggle={toggleGroup}
                        isSelected={selectedBookIds.has(row.id)}
                        onSelect={handleSelectBook}
                        showOwnerColumn={showOwnerColumn}
                        data-index={virtualRow.index}
                      />
                    );
                  }

                  if (isDependentView) {
                    const color = row.color;
                    return (
                      <HierarchicalRow
                        key={row.id}
                        style={style}
                        color={color}
                        isSelected={selectedAssetIds.has(row.id)}
                        onSelect={handleSelectAsset}
                        onRowClick={handleAssetRowClick}
                        isActive={activeAssetId === row.id}
                        isMaster={row.isMaster}
                        isLastInGroup={row.isLastInGroup}
                        hasDependents={color.dependents && color.dependents.length > 0}
                        isOpen={openGroups.has(String(row.id))}
                        onToggle={() => toggleGroup(String(row.id))}
                        isPartnerView={isPartnerView}
                        showOwnerColumn={showOwnerColumn}
                        data-index={virtualRow.index}
                      />
                    );
                  }

                  const uniqueId = isBookView && row.parentBookId ? `${row.id}::${row.parentBookId}` : row.id;

                  return (
                    <ColorRow
                      key={uniqueId}
                      style={style}
                      color={row.color}
                      isSelected={selectedAssetIds.has(uniqueId)}
                      onSelect={handleSelectAsset}
                      onRowClick={handleAssetRowClick}
                      showInBooks={isBookView}
                      parentBookId={isBookView ? row.parentBookId : null}
                      isActive={activeAssetId === uniqueId}
                      isPartnerView={isPartnerView}
                      showOwnerColumn={showOwnerColumn}
                      data-index={virtualRow.index}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="min-w-[1150px] w-full">
            <Table className="w-full table-fixed min-w-[1150px]">
              <TableBody>
                {rows.map((row, index) => {
                  if (!row || !row.id) return null;

                  if (row.isGroup) {
                    return (
                      <BookRow
                        key={row.id}
                        book={row.book}
                        isOpen={openGroups.has(String(row.id))}
                        onToggle={toggleGroup}
                        isSelected={selectedBookIds.has(row.id)}
                        onSelect={handleSelectBook}
                        showOwnerColumn={showOwnerColumn}
                        data-index={index}
                      />
                    );
                  }

                  if (isDependentView) {
                    const color = row.color;
                    return (
                      <HierarchicalRow
                        key={row.id}
                        color={color}
                        isSelected={selectedAssetIds.has(row.id)}
                        onSelect={handleSelectAsset}
                        onRowClick={handleAssetRowClick}
                        isActive={activeAssetId === row.id}
                        isMaster={row.isMaster}
                        isLastInGroup={row.isLastInGroup}
                        hasDependents={color.dependents && color.dependents.length > 0}
                        isOpen={openGroups.has(String(row.id))}
                        onToggle={() => toggleGroup(String(row.id))}
                        isPartnerView={isPartnerView}
                        showOwnerColumn={showOwnerColumn}
                        data-index={index}
                      />
                    );
                  }

                  const uniqueId = isBookView && row.parentBookId ? `${row.id}::${row.parentBookId}` : row.id;

                  return (
                    <ColorRow
                      key={uniqueId}
                      color={row.color}
                      isSelected={selectedAssetIds.has(uniqueId)}
                      onSelect={handleSelectAsset}
                      onRowClick={handleAssetRowClick}
                      showInBooks={isBookView}
                      parentBookId={isBookView ? row.parentBookId : null}
                      isActive={activeAssetId === uniqueId}
                      isPartnerView={isPartnerView}
                      showOwnerColumn={showOwnerColumn}
                      data-index={index}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ColorsTable;