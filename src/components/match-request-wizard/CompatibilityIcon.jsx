import React from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { COMPATIBILITY_STATUS } from '@/lib/colorQualitySetCompatibility';

const CompatibilityIcon = ({ status, message }) => {
  if (!status) {
    return <div className="w-5 h-5" />; // Empty space when no status
  }

  const getIcon = () => {
    switch (status) {
      case COMPATIBILITY_STATUS.COMPATIBLE:
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case COMPATIBILITY_STATUS.WARNING:
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case COMPATIBILITY_STATUS.INCOMPATIBLE:
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <div className="w-5 h-5" />;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex justify-center">
            {getIcon()}
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <p className="text-sm">{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CompatibilityIcon;