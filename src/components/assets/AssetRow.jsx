import React from 'react';
import { motion } from 'framer-motion';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const AssetRow = ({ 
  asset, 
  isSelected, 
  isHighlighted,
  onSelect, 
  onRowClick,
  showInGroups
}) => {
  const rowProps = {
    className: "cursor-pointer group",
    'data-state': isHighlighted ? 'selected' : '',
    onClick: () => onRowClick(asset.id),
  };

  const motionProps = {
    initial: { opacity: 0, y: -10, height: 0 },
    animate: { opacity: 1, y: 0, height: 'auto' },
    exit: { opacity: 0, y: -10, height: 0 },
    transition: { duration: 0.3, ease: 'easeInOut' },
  };

  const content = (
    <>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox 
          checked={isSelected} 
          onCheckedChange={(checked) => onSelect(asset.id, checked)} 
        />
      </TableCell>
      {showInGroups && <TableCell></TableCell>}
      <TableCell className="font-medium">
        <div className="flex items-center gap-3">
          {asset.hex && <div className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: asset.hex }}></div>}
          <span className="text-foreground">{asset.name}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={asset.assetType === 'Color' ? 'default' : 'secondary'}>{asset.assetType}</Badge>
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {asset.updated_at ? new Date(asset.updated_at).toLocaleDateString() : 'N/A'}
      </TableCell>
    </>
  );

  if (showInGroups) {
    return (
      <TableRow as={motion.tr} {...rowProps} {...motionProps}>
        {content}
      </TableRow>
    );
  }

  return <TableRow {...rowProps}>{content}</TableRow>;
};

export default AssetRow;