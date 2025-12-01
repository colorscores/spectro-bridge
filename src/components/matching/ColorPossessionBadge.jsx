import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, ArrowRight } from 'lucide-react';

const ColorPossessionBadge = ({ colorsPossessed, totalColors, isRouted }) => {
  if (totalColors === 0) {
    return (
      <Badge variant="secondary" className="text-xs">
        <Clock className="h-3 w-3 mr-1" />
        No Colors
      </Badge>
    );
  }

  if (colorsPossessed === totalColors) {
    return (
      <Badge variant="default" className="text-xs">
        <CheckCircle className="h-3 w-3 mr-1" />
        All Colors ({totalColors})
      </Badge>
    );
  }

  if (colorsPossessed > 0) {
    return (
      <Badge variant="outline" className="text-xs">
        <ArrowRight className="h-3 w-3 mr-1" />
        {colorsPossessed} of {totalColors} Colors
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="text-xs">
      <Clock className="h-3 w-3 mr-1" />
      No Colors in Possession
    </Badge>
  );
};

export default ColorPossessionBadge;