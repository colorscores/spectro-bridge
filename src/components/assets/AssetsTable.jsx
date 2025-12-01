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
import AssetGroupRow from './AssetGroupRow';
import AssetRow from './AssetRow';

const TableHeaderButton = ({ children, className = "" }) => (
  <Button variant="ghost" className={`text-muted-foreground hover:text-foreground p-0 h-auto font-semibold ${className}`}>
    {children}
    <ArrowUpDown className="ml-2 h-3 w-3" />
  </Button>
);

const AssetsTable = ({
  assetGroups = [],
  allAssets = [],
  showInGroups,
  selectedAssetIds,
  highlightedAssetId,
  openGroups,
  hoveredRow,
  handleSelectAll,
  handleSelectGroup,
  handleSelectAsset,
  toggleGroup,
  getGroupSelectionState,
  handleAssetRowClick,
  setHoveredRow,
  assetType,
  assetTypePlural
}) => {

  const assetsToRender = showInGroups ? allAssets : allAssets;
  const allSelected = assetsToRender.length > 0 && selectedAssetIds.size === assetsToRender.length;
  const isIndeterminate = selectedAssetIds.size > 0 && selectedAssetIds.size < assetsToRender.length;

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-full">
        <TableHeader>
          <TableRow className="border-b-gray-200 hover:bg-transparent">
            <TableHead className="w-[50px]"><Checkbox checked={allSelected} data-state={isIndeterminate ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked')} onCheckedChange={handleSelectAll} /></TableHead>
            {showInGroups && <TableHead className="w-[50px]"></TableHead>}
            <TableHead className="flex-1"><TableHeaderButton>{assetType === 'Color' ? 'Color Name' : 'Name'}</TableHeaderButton></TableHead>
            <TableHead className="w-[150px]"><TableHeaderButton>Asset Type</TableHeaderButton></TableHead>
            <TableHead className="w-[200px] text-right"><TableHeaderButton>Last Edited</TableHeaderButton></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {showInGroups ? (
            assetGroups.map((group) => (
              <Fragment key={group.id}>
                <AssetGroupRow
                  group={group}
                  isOpen={openGroups.has(group.id)}
                  onToggle={toggleGroup}
                  onSelect={handleSelectGroup}
                  selectionState={getGroupSelectionState(group)}
                  hovered={hoveredRow === group.id}
                  onHover={setHoveredRow}
                  assetTypePlural={assetTypePlural}
                />
                {openGroups.has(group.id) && group.assets.map((asset) => (
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    isSelected={selectedAssetIds.has(asset.id)}
                    isHighlighted={highlightedAssetId === asset.id}
                    onSelect={handleSelectAsset}
                    onRowClick={handleAssetRowClick}
                    showInGroups={true}
                  />
                ))}
              </Fragment>
            ))
          ) : (
            allAssets.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                isSelected={selectedAssetIds.has(asset.id)}
                isHighlighted={highlightedAssetId === asset.id}
                onSelect={handleSelectAsset}
                onRowClick={handleAssetRowClick}
                showInGroups={false}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default AssetsTable;