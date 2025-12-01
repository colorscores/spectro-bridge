import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { 
  PlusCircle,
  Filter
} from 'lucide-react';

const PrintersHeader = ({ 
  numSelected,
  onAddNew,
  onDelete,
  onEdit
}) => {
  const showToast = (event) => {
    event.stopPropagation();
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-4">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="text-2xl font-bold text-gray-900"
        >
          Printers
        </motion.h1>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" className="bg-white" onClick={showToast}>
          <Filter className="mr-2 h-4 w-4"/>
          Filter
        </Button>
        <Button variant="default" onClick={onAddNew}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Printer
        </Button>
      </div>
    </div>
  );
};

export default PrintersHeader;