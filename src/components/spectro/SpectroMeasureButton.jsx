import React, { useState } from 'react';
import { ScanLine, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Reusable measurement button that triggers spectrophotometer measurement
 */
const SpectroMeasureButton = ({
  onMeasurement,
  measure,
  measuring,
  deviceConnected,
  calibrated,
  bridgeConnected,
  error,
  modes = ['M0'],
  variant = 'default',
  size = 'default',
  className,
  children,
  showStatus = true,
}) => {
  const [localError, setLocalError] = useState(null);

  const handleMeasure = async () => {
    setLocalError(null);
    
    try {
      const result = await measure(modes);
      if (result?.results) {
        onMeasurement?.(result.results);
      }
    } catch (err) {
      setLocalError(err.message || 'Measurement failed');
    }
  };

  // Determine if button should be disabled
  const isDisabled = !bridgeConnected || !deviceConnected || !calibrated || measuring;

  // Get tooltip message based on state
  const getTooltipMessage = () => {
    if (!bridgeConnected) return 'Spectro Bridge app not running';
    if (!deviceConnected) return 'No spectrophotometer connected';
    if (!calibrated) return 'Device needs calibration';
    if (measuring) return 'Measurement in progress...';
    return 'Click to measure color';
  };

  const displayError = localError || error;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleMeasure}
              disabled={isDisabled}
              variant={variant}
              size={size}
              className={cn(
                'relative',
                measuring && 'animate-pulse',
                className
              )}
            >
              <ScanLine className={cn('h-5 w-5', children && 'mr-2', measuring && 'animate-pulse')} />
              {measuring ? 'Measuring...' : (children || 'Measure')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipMessage()}</p>
          </TooltipContent>
        </Tooltip>

        {/* Status indicator */}
        {showStatus && !bridgeConnected && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Start Spectro Bridge app
          </p>
        )}

        {/* Error display */}
        {displayError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {displayError}
          </p>
        )}
      </div>
    </TooltipProvider>
  );
};

export default SpectroMeasureButton;
