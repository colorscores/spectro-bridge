import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { Download, Edit, Trash2, MoreHorizontal, ChevronRight, Layers3 } from 'lucide-react';

const AssetGroupRow = ({ group, isOpen, onToggle, onSelect, selectionState, hovered, onHover, assetTypePlural }) => {
  const showToast = (event) => {
    event.stopPropagation();
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  const isStructuresCategory = group.name.toLowerCase().includes('structure');

  return (
    <TableRow 
      className="border-b-gray-200 bg-gray-50 hover:bg-gray-100 font-semibold group"
      data-state={selectionState ? 'selected' : ''}
      onMouseEnter={() => onHover(group.id)}
      onMouseLeave={() => onHover(null)}
    >
      <TableCell onClick={(e) => onSelect(e, group, !selectionState || selectionState === 'indeterminate')}>
         <Checkbox checked={selectionState} />
      </TableCell>
      <TableCell onClick={(e) => onToggle(e, group.id)} className="cursor-pointer">
        <div className="flex items-center justify-center w-5 h-5">
          <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
        </div>
      </TableCell>
      <TableCell onClick={(e) => onToggle(e, group.id)} className="cursor-pointer">
        <div className="flex items-center gap-3">
          {isStructuresCategory && <Layers3 className="h-5 w-5 text-gray-500" />}
          <span className="text-gray-800">{group.name}</span>
          <span className="text-gray-400">({group.assets.length} {assetTypePlural.toLowerCase()})</span>
        </div>
      </TableCell>
      <TableCell></TableCell>
      <TableCell></TableCell>
      <TableCell></TableCell>
      <TableCell className="text-right">
         <div className="flex items-center justify-end h-8">
          {hovered && (
            <motion.div 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={showToast}><Download className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={showToast}><Edit className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={showToast}><Trash2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={showToast}><MoreHorizontal className="h-4 w-4" /></Button>
            </motion.div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default AssetGroupRow;