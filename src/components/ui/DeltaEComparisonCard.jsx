import React from 'react';
import { cn } from '@/lib/utils';

/**
 * DeltaEComparisonCard - Shows adaptation warning for substrate differences
 */
const DeltaEComparisonCard = ({ className = "" }) => {
  return (
    <div className={cn(
      "p-3 bg-destructive/10 border border-destructive/20 rounded-lg",
      "text-sm",
      className
    )}>
      <div className="font-medium text-destructive">
        The substrate of the imported data is different than the whitepoint of the selected substrate condition. 
        Imported data will be adapted. You can also create a new Substrate/Condition by choosing "Create new".
      </div>
    </div>
  );
};

export default DeltaEComparisonCard;