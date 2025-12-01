import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { 
  Columns
} from 'lucide-react';

const AssetsTableToolbar = ({
  showInGroups,
  setShowInGroups,
  assetTypePlural
}) => {
  const showToast = (event) => {
    event.stopPropagation();
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  return (
    <div className="bg-background border-t border-b border-border p-4">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="show-in-groups" checked={showInGroups} onCheckedChange={setShowInGroups} />
            <Label htmlFor="show-in-groups" className="text-sm font-medium">Show in {assetTypePlural}</Label>
          </div>
          <Button variant="outline" className="bg-background" onClick={showToast}>
            <Columns className="mr-2 h-4 w-4" />
            Columns
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AssetsTableToolbar;