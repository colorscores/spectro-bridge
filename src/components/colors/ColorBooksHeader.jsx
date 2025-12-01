import React from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { 
  PlusCircle,
  Filter
} from 'lucide-react';

const ColorBooksHeader = ({ 
  handleNewMatchRequest, 
  numSelected
}) => {
  const showToast = (event) => {
    event.stopPropagation();
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Colors
        </h1>
      </div>
      <div className="flex items-center gap-2">
         <Button variant="outline" className="bg-white" onClick={showToast}>
          <Filter className="mr-2 h-4 w-4"/>
          Filter
        </Button>
        <Button variant="outline" className="bg-white" onClick={showToast}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Color
        </Button>
        <Button 
          className="bg-primary hover:bg-primary/90" 
          onClick={handleNewMatchRequest}
          disabled={numSelected === 0}
        >
          New Match Request
        </Button>
      </div>
    </div>
  );
};

export default ColorBooksHeader;