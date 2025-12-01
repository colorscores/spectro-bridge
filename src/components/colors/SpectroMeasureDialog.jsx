import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  SpectroDeviceStatus, 
  SpectroMeasureButton, 
  MeasurementModeSelector,
  MultiSpotReadingsList 
} from '@/components/spectro';
import { useSpectroDevice } from '@/hooks/useSpectroDevice';
import { spectralToLabASTME308, labToHex } from '@/lib/colorUtils';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { useProfile } from '@/context/ProfileContext';
import { getSpectralDataInfo } from '@/lib/colorUtils/spectralRangeUtils';
import { Zap } from 'lucide-react';

const SpectroMeasureDialog = ({ open, onOpenChange, onUse }) => {
  // Measurement mode state
  const [measurementMode, setMeasurementMode] = useState('spot');
  const [measurementData, setMeasurementData] = useState(null);
  const [multiSpotReadings, setMultiSpotReadings] = useState([]);
  
  // Get ASTM tables and profile for proper spectral-to-Lab conversion
  const { astmTables } = useAstmTablesCache();
  const { profile } = useProfile();

  // Process raw measurement result into usable data
  const processMeasurementResult = useCallback((result, source = 'software') => {
    const modes = Object.keys(result || {});
    const primaryMode = modes.includes('M0') ? 'M0' : modes[0];
    const primaryData = result?.[primaryMode];

    if (!primaryData) {
      console.error('No measurement data received');
      return null;
    }

    // ALWAYS compute Lab from spectral data if available
    let lab = null;
    let hex = '#888888';

    if (primaryData.spectral && Object.keys(primaryData.spectral).length > 0) {
      const orgDefaults = profile?.organization || {};
      const illuminant = orgDefaults.default_illuminant || 'D50';
      const observer = orgDefaults.default_observer || '2';
      const tableNumber = orgDefaults.default_astm_table || '5';
      
      const weightingTable = astmTables.filter(row => 
        String(row.illuminant_name).toUpperCase() === illuminant.toUpperCase() &&
        String(row.observer).replace(/[^0-9]/g, '') === String(observer).replace(/[^0-9]/g, '') &&
        String(row.table_number) === String(tableNumber)
      );
      
      if (weightingTable.length > 0) {
        const computedLab = spectralToLabASTME308(primaryData.spectral, weightingTable);
        if (computedLab && typeof computedLab.L === 'number') {
          lab = computedLab;
          hex = labToHex(lab.L, lab.a, lab.b);
        }
      }
    } else {
      lab = primaryData.Lab || primaryData.lab;
      if (lab) {
        hex = labToHex(lab.L, lab.a, lab.b);
      }
    }

    // Build spectral data object for all modes
    const spectralByMode = {};
    modes.forEach((mode) => {
      if (result[mode]?.spectral && Object.keys(result[mode].spectral).length > 0) {
        spectralByMode[mode] = result[mode].spectral;
      }
    });

    return {
      id: `reading_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lab,
      hex,
      spectral: spectralByMode,
      modes,
      primaryMode,
      raw: result,
      source,
      timestamp: new Date().toISOString(),
    };
  }, [astmTables, profile]);

  // Handle hardware-triggered measurement (device button press)
  const handleHardwareMeasurement = useCallback((message) => {
    console.log('[SpectroMeasureDialog] === HARDWARE MEASUREMENT RECEIVED ===');
    console.log('[SpectroMeasureDialog] Full message:', JSON.stringify(message, null, 2).substring(0, 1000));
    
    const resultData = message.results || message.result;
    console.log('[SpectroMeasureDialog] Result data keys:', resultData ? Object.keys(resultData) : 'N/A');
    
    if (resultData?.M0) {
      console.log('[SpectroMeasureDialog] M0 Lab:', JSON.stringify(resultData.M0.Lab));
      console.log('[SpectroMeasureDialog] M0 spectral count:', resultData.M0.spectral ? Object.keys(resultData.M0.spectral).length : 0);
    }
    
    const processed = processMeasurementResult(resultData, 'hardware');
    console.log('[SpectroMeasureDialog] Processed result:', processed ? {
      lab: processed.lab,
      hex: processed.hex,
      spectralModes: Object.keys(processed.spectral || {}),
      source: processed.source
    } : 'null');
    
    if (!processed) {
      console.error('[SpectroMeasureDialog] Failed to process measurement result!');
      return;
    }

    if (measurementMode === 'multi-spot') {
      // In multi-spot mode, add to readings list
      console.log('[SpectroMeasureDialog] Adding to multi-spot readings');
      setMultiSpotReadings(prev => [...prev, processed]);
    } else {
      // In spot mode, replace current measurement
      console.log('[SpectroMeasureDialog] Setting spot measurement data');
      setMeasurementData(processed);
    }
  }, [measurementMode, processMeasurementResult]);

  // Use spectro device hook with hardware measurement callback
  const {
    bridgeConnected,
    bridgeNotInstalled,
    bridgeDownloadUrl,
    deviceConnected,
    deviceInfo,
    calibrated,
    calibrating,
    calibrationExpiry,
    measuring,
    error,
    statusMessage,
    calibrate,
    measure,
    refreshStatus,
    clearError,
    forceReconnect,
  } = useSpectroDevice({ onMeasurementReceived: handleHardwareMeasurement });

  // Handle software-triggered measurement result
  const handleMeasurement = useCallback((result) => {
    const processed = processMeasurementResult(result, 'software');
    
    if (!processed) return;

    if (measurementMode === 'multi-spot') {
      // In multi-spot mode, add to readings list
      setMultiSpotReadings(prev => [...prev, processed]);
    } else {
      // In spot mode, replace current measurement
      setMeasurementData(processed);
    }
  }, [measurementMode, processMeasurementResult]);

  // Handle "Use" button click
  const handleUse = useCallback(() => {
    if (measurementMode === 'multi-spot') {
      if (multiSpotReadings.length > 0 && onUse) {
        // Return all readings for multi-spot mode
        onUse({ readings: multiSpotReadings, mode: 'multi-spot' });
      }
    } else {
      if (measurementData && onUse) {
        onUse(measurementData);
      }
    }
  }, [measurementMode, measurementData, multiSpotReadings, onUse]);

  // Handle removing a reading from multi-spot list
  const handleRemoveReading = useCallback((index) => {
    setMultiSpotReadings(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Handle dialog close - reset state
  const handleOpenChange = useCallback((newOpen) => {
    if (!newOpen) {
      setMeasurementData(null);
      setMultiSpotReadings([]);
      setMeasurementMode('spot');
      clearError();
    }
    onOpenChange(newOpen);
  }, [onOpenChange, clearError]);

  // Get spectral info for display
  const spectralInfo = measurementData?.spectral?.[measurementData.primaryMode]
    ? getSpectralDataInfo(measurementData.spectral[measurementData.primaryMode])
    : null;

  // Determine if "Use" button should be enabled
  const canUse = measurementMode === 'multi-spot' 
    ? multiSpotReadings.length > 0 
    : measurementData !== null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Measure Color</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Device Status */}
          <SpectroDeviceStatus
            bridgeConnected={bridgeConnected}
            bridgeNotInstalled={bridgeNotInstalled}
            bridgeDownloadUrl={bridgeDownloadUrl}
            deviceConnected={deviceConnected}
            deviceInfo={deviceInfo}
            calibrated={calibrated}
            calibrating={calibrating}
            calibrationExpiry={calibrationExpiry}
            statusMessage={statusMessage}
            error={error}
            onCalibrate={calibrate}
            onRefresh={refreshStatus}
            onForceReconnect={forceReconnect}
          />

          {/* Measurement Mode Selector */}
          <MeasurementModeSelector
            value={measurementMode}
            onChange={setMeasurementMode}
            disabled={measuring}
          />

          {/* Multi-spot readings list */}
          {measurementMode === 'multi-spot' && (
            <MultiSpotReadingsList
              readings={multiSpotReadings}
              onRemove={handleRemoveReading}
            />
          )}

          {/* Single measurement Color Preview (spot mode only) */}
          {measurementMode === 'spot' && (
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-32 h-32 rounded-lg border-2 border-border shadow-inner flex items-center justify-center"
                style={{
                  backgroundColor: measurementData?.hex || 'hsl(var(--muted))',
                }}
              >
                {!measurementData && (
                  <span className="text-muted-foreground text-sm">
                    No measurement
                  </span>
                )}
              </div>

              {measurementData?.lab && (
                <div className="text-center space-y-1">
                  <p className="text-sm font-mono">
                    L: {measurementData.lab.L?.toFixed(2)} &nbsp;
                    a: {measurementData.lab.a?.toFixed(2)} &nbsp;
                    b: {measurementData.lab.b?.toFixed(2)}
                  </p>
                  {spectralInfo && (
                    <p className="text-xs text-muted-foreground">
                      {spectralInfo.display}
                    </p>
                  )}
                  {measurementData.source === 'hardware' && (
                    <p className="text-xs text-primary flex items-center justify-center gap-1">
                      <Zap className="h-3 w-3" />
                      Device button
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Trigger hint and Measure Button */}
          <div className="flex flex-col items-center gap-2">
            {deviceConnected && calibrated && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Press device button or click below
              </p>
            )}
            <SpectroMeasureButton
              onMeasurement={handleMeasurement}
              measure={measure}
              measuring={measuring}
              deviceConnected={deviceConnected}
              calibrated={calibrated}
              bridgeConnected={bridgeConnected}
              error={error}
              modes={['M0', 'M1', 'M2']}
              size="lg"
            >
              {measurementMode === 'multi-spot' ? 'Take Reading' : 'Measure'}
            </SpectroMeasureButton>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUse} disabled={!canUse}>
            {measurementMode === 'multi-spot' 
              ? `Use ${multiSpotReadings.length} Reading${multiSpotReadings.length !== 1 ? 's' : ''}`
              : 'Use'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SpectroMeasureDialog;
