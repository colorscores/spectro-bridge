import React from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/colorUtils';

const DataQualityIndicator = ({ 
  hasSpectral = false, 
  hasLab = false, 
  hasValidHex = false, 
  showDetails = false,
  className = "" 
}) => {
  // Determine data quality level
  const getQualityInfo = () => {
    if (hasSpectral) {
      return {
        level: 'excellent',
        icon: CheckCircle,
        text: 'Spectral data available',
        description: 'Highest accuracy - can be used for precise color matching and quality assessment',
        color: 'text-green-600 dark:text-green-400'
      };
    } else if (hasLab) {
      return {
        level: 'good',
        icon: CheckCircle,
        text: 'Lab data available',
        description: 'Good accuracy - suitable for color matching and quality assessment',
        color: 'text-blue-600 dark:text-blue-400'
      };
    } else if (hasValidHex) {
      return {
        level: 'limited',
        icon: AlertTriangle,
        text: 'Display color only',
        description: 'Limited accuracy - not suitable for precise color matching or quality assessment',
        color: 'text-yellow-600 dark:text-yellow-400'
      };
    } else {
      return {
        level: 'poor',
        icon: AlertTriangle,
        text: 'No colorimetric data',
        description: 'Cannot be used for accurate color matching or quality assessment',
        color: 'text-red-600 dark:text-red-400'
      };
    }
  };

  const quality = getQualityInfo();
  const IconComponent = quality.icon;

  if (!showDetails) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <IconComponent className={cn("h-4 w-4", quality.color)} />
        <span className={cn("text-sm", quality.color)}>{quality.text}</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <IconComponent className={cn("h-5 w-5", quality.color)} />
        <span className={cn("font-medium", quality.color)}>{quality.text}</span>
      </div>
      <p className="text-sm text-muted-foreground">{quality.description}</p>
      {quality.level === 'limited' || quality.level === 'poor' ? (
        <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
          <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            <p className="font-medium">Recommendation:</p>
            <p>Provide spectral measurements or Lab values for accurate color analysis.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DataQualityIndicator;