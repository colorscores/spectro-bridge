import React from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Circle, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import SpectroDownloadPrompt from './SpectroDownloadPrompt';

/**
 * Device status indicator showing bridge connection, device status, and calibration state
 */
const SpectroDeviceStatus = ({
  bridgeConnected,
  bridgeNotInstalled,
  bridgeDownloadUrl,
  deviceConnected,
  deviceInfo,
  calibrated,
  calibrating,
  calibrationExpiry,
  statusMessage,
  error,
  onCalibrate,
  onRefresh,
  onForceReconnect,
  compact = false,
}) => {
  // Determine overall status
  const getStatusColor = () => {
    if (!bridgeConnected) return 'text-muted-foreground';
    if (!deviceConnected) return 'text-amber-500';
    if (!calibrated) return 'text-amber-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (!bridgeConnected) return <WifiOff className="h-4 w-4" />;
    if (!deviceConnected) return <Circle className="h-4 w-4" />;
    if (!calibrated) return <AlertCircle className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  // Format calibration expiry
  const formatExpiry = () => {
    if (!calibrationExpiry) return null;
    const now = new Date();
    const diff = calibrationExpiry - now;
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Show download prompt if bridge is not installed
  if (bridgeNotInstalled && !compact) {
    return (
      <SpectroDownloadPrompt 
        downloadUrl={bridgeDownloadUrl} 
        onRetry={onForceReconnect} 
      />
    );
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('flex items-center gap-1', getStatusColor())}>
              {getStatusIcon()}
              {bridgeConnected && deviceConnected && (
                <span className="text-xs font-medium">
                  {calibrated ? 'Ready' : 'Cal needed'}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{statusMessage}</p>
            {deviceInfo && (
              <p className="text-xs text-muted-foreground">
                {deviceInfo.model} ({deviceInfo.serialNumber})
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-lg border border-border p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          {bridgeConnected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-muted-foreground" />
          )}
          Spectrophotometer
        </h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={bridgeConnected ? onRefresh : onForceReconnect}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {bridgeConnected ? 'Refresh status' : 'Reconnect to bridge'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        <StatusBadge
          label="Bridge"
          active={bridgeConnected}
          activeText="Connected"
          inactiveText="Not running"
        />
        <StatusBadge
          label="Device"
          active={deviceConnected}
          activeText={deviceInfo?.model || 'Connected'}
          inactiveText="Not connected"
          disabled={!bridgeConnected}
        />
        <StatusBadge
          label="Calibration"
          active={calibrated}
          activeText={formatExpiry() ? `Valid (${formatExpiry()})` : 'Valid'}
          inactiveText="Required"
          disabled={!deviceConnected}
          warning={calibrating}
          warningText="Calibrating..."
        />
      </div>

      {/* Device info */}
      {deviceInfo && (
        <div className="text-xs text-muted-foreground mb-3">
          <span className="font-medium">{deviceInfo.make} {deviceInfo.model}</span>
          {deviceInfo.serialNumber !== 'Unknown' && (
            <span className="ml-2">S/N: {deviceInfo.serialNumber}</span>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1 mb-3">
          {error}
        </div>
      )}

      {/* Status message */}
      <p className="text-sm text-muted-foreground mb-3">{statusMessage}</p>

      {/* Calibrate button */}
      {deviceConnected && !calibrated && !calibrating && (
        <Button
          onClick={onCalibrate}
          className="w-full"
          variant="default"
        >
          Calibrate Device
        </Button>
      )}

      {calibrating && (
        <Button disabled className="w-full">
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          Calibrating...
        </Button>
      )}
    </motion.div>
  );
};

// Status badge component
const StatusBadge = ({ label, active, activeText, inactiveText, disabled, warning, warningText }) => {
  const getBadgeStyles = () => {
    if (disabled) return 'bg-muted text-muted-foreground';
    if (warning) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    if (active) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  };

  const getText = () => {
    if (warning) return warningText;
    return active ? activeText : inactiveText;
  };

  return (
    <div className={cn('px-2 py-1 rounded-full text-xs font-medium', getBadgeStyles())}>
      <span className="text-muted-foreground mr-1">{label}:</span>
      {getText()}
    </div>
  );
};

export default SpectroDeviceStatus;
