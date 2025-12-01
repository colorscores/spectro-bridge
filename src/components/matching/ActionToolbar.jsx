import React from 'react';
import { Route, Ruler, Import, Printer, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const ActionToolbar = ({ 
  onCxfImportClick, 
  onCgatsImportClick, 
  onPickInkCondition, 
  onRouteMatch,
  onPrintReference,
  onPrintMatch,
  showRouteMatch = true,
  showMeasureImport = true
}) => {
  const navigate = useNavigate();
  const showToast = (event) => {
    event.stopPropagation();
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  return (
    <div className="flex items-center gap-2 h-9">
      {showRouteMatch && (
        <Button variant="outline" className="bg-white h-9" onClick={onRouteMatch}>
          <Route className="mr-2 h-4 w-4" /> Route Match
        </Button>
      )}
      
      {showMeasureImport && (
        <>
          <Button variant="outline" className="bg-white h-9" onClick={showToast}>
            <Ruler className="mr-2 h-4 w-4" /> Measure Match
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-white h-9">
                <Import className="mr-2 h-4 w-4" />
                Import Match
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); onCxfImportClick(); }}>Import from CXF</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); onCgatsImportClick(); }}>Import from CGATS</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); onPickInkCondition(); }}>From Ink Condition…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="bg-white h-9">
            <Printer className="mr-2 h-4 w-4" /> 
            Print Color Card
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-white z-50">
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); onPrintReference(); }}>
            Print Reference
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); onPrintMatch(); }}>
            Print Match
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ActionToolbar;