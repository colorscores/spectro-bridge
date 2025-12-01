import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  BookPlus,
  Palette,
  PlusCircle,
  ChevronDown,
  FileText,
  Pipette,
  GraduationCap,
  ScanLine,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCanEdit } from '@/hooks/useCanEdit';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import ColorsHelpDialog from './ColorsHelpDialog';

const ColorsHeader = ({ 
  viewMode,
  onAddColorClick,
  onAddCgatsClick,
  onColorsAdded,
  onAddBookClick,
  onRequestMatchClick,
  onMeasureClick,
  selectedCount = 0,
  allColors = [],
  associations = [],
}) => {
  const navigate = useNavigate();
  const canEdit = useCanEdit();
  const { isSuperadmin } = useRoleAccess();
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);


  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      className="flex items-center justify-between mb-4"
    >
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          Colors
        </h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setHelpDialogOpen(true)}
          className="h-8 w-8 text-muted-foreground hover:text-primary"
        >
          <GraduationCap className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        {canEdit && viewMode === 'book' && (
          <Button variant="outline" className="bg-white" onClick={onAddBookClick}>
            <BookPlus className="mr-2 h-4 w-4" />
            Add Color Book
          </Button>
        )}
        <Button 
          onClick={onRequestMatchClick}
          disabled={selectedCount === 0}
          className="bg-primary hover:bg-primary/90 text-white"
        >
          <Pipette className="mr-2 h-4 w-4" />
          Request Color Match
        </Button>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                Add Colors
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isSuperadmin && (
                <DropdownMenuItem onClick={onMeasureClick}>
                  <ScanLine className="mr-2 h-4 w-4" />
                  <span>Measure</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onAddColorClick}>
                <PlusCircle className="mr-2 h-4 w-4" />
                <span>Import from CXF</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddCgatsClick}>
                <FileText className="mr-2 h-4 w-4" />
                <span>Import from CGATS</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      
      <ColorsHelpDialog 
        open={helpDialogOpen} 
        onOpenChange={setHelpDialogOpen} 
      />
    </motion.div>
  );
};

export default ColorsHeader;