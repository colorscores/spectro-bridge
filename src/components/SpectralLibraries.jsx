import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Library, PlusCircle, ChevronsUpDown, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { spectralLibrariesData, generateRandomSpectralData, hexToRgb, labToHex } from '@/lib/colorUtils';
import { useSpectroDevice } from '@/hooks/useSpectroDevice';
import { SpectroDeviceStatus, SpectroMeasureButton } from '@/components/spectro';

const SpectralLibraries = ({ onAddColor, onAddMeasuredColor }) => {
  const [selectedLibrary, setSelectedLibrary] = useState(Object.keys(spectralLibrariesData)[0]);
  
  // Use the spectrophotometer hook
  const {
    bridgeConnected,
    deviceConnected,
    deviceInfo,
    calibrated,
    calibrating,
    calibrationExpiry,
    measuring,
    statusMessage,
    error,
    calibrate,
    measure,
    refreshStatus,
    clearError,
    forceReconnect,
  } = useSpectroDevice();

  // Handle measurement result from spectrophotometer
  const handleMeasurementResult = useCallback((result) => {
    if (!result) return;

    // Get the first mode's data (typically M0)
    const modeKey = Object.keys(result)[0];
    const modeData = result[modeKey];

    if (!modeData) {
      toast({
        title: "Measurement Error",
        description: "No measurement data received",
        variant: "destructive",
      });
      return;
    }

    // Convert Lab to hex for display
    let hex = '#808080'; // Default gray
    if (modeData.lab) {
      try {
        hex = labToHex(modeData.lab.L, modeData.lab.a, modeData.lab.b) || '#808080';
      } catch (e) {
        console.warn('Failed to convert Lab to hex:', e);
      }
    }

    // Build spectral data object from array if provided
    let spectralData = {};
    if (modeData.spectral && Array.isArray(modeData.spectral)) {
      // Assuming 380-730nm @ 10nm intervals (36 points)
      modeData.spectral.forEach((value, index) => {
        const wavelength = 380 + (index * 10);
        spectralData[wavelength] = value;
      });
    } else if (modeData.spectral && typeof modeData.spectral === 'object') {
      spectralData = modeData.spectral;
    }

    const newColor = {
      id: Date.now(),
      hex: hex.toUpperCase(),
      rgb: hexToRgb(hex),
      status: 'approved',
      name: 'Measured Color',
      library: 'Direct Measurement',
      spectral: Object.keys(spectralData).length > 0 ? spectralData : generateRandomSpectralData(),
      lab: modeData.lab || null,
      xyz: modeData.xyz || null,
      measurementMode: modeKey,
    };

    onAddMeasuredColor(newColor);
    
    toast({
      title: "Measurement Complete",
      description: `Color measured: L*=${modeData.lab?.L?.toFixed(2) || '?'} a*=${modeData.lab?.a?.toFixed(2) || '?'} b*=${modeData.lab?.b?.toFixed(2) || '?'}`,
    });
  }, [onAddMeasuredColor]);

  const handleCalibrate = useCallback(async () => {
    toast({
      title: "Calibrating...",
      description: "Place device on white calibration tile",
    });
    await calibrate();
  }, [calibrate]);
  
  const handleImport = () => {
    toast({
      title: "Feature In Progress",
      description: "Import functionality coming soon",
      variant: "default",
    });
  };
  
  const handleExport = () => {
    toast({
      title: "Feature In Progress", 
      description: "Export functionality coming soon",
      variant: "default",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.15 }}
      className="bg-card rounded-lg p-6 border border-border h-full flex flex-col"
    >
      <h2 className="text-xl font-bold text-foreground mb-4 flex items-center">
        <Library className="mr-2 h-6 w-6" />
        Spectral Tools
      </h2>
      
      <div className="flex-grow space-y-4">
        {/* Device Status */}
        <SpectroDeviceStatus
          bridgeConnected={bridgeConnected}
          deviceConnected={deviceConnected}
          deviceInfo={deviceInfo}
          calibrated={calibrated}
          calibrating={calibrating}
          calibrationExpiry={calibrationExpiry}
          statusMessage={statusMessage}
          error={error}
          onCalibrate={handleCalibrate}
          onRefresh={refreshStatus}
          onForceReconnect={forceReconnect}
        />

        {/* Measurement & Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <SpectroMeasureButton
            onMeasurement={handleMeasurementResult}
            measure={measure}
            measuring={measuring}
            deviceConnected={deviceConnected}
            calibrated={calibrated}
            bridgeConnected={bridgeConnected}
            error={error}
            modes={['M0']}
            className="flex-1"
            showStatus={false}
          >
            Measure Color
          </SpectroMeasureButton>
          
          <Button onClick={handleImport} variant="outline" className="flex-1">
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button onClick={handleExport} variant="outline" className="flex-1">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
        
        {/* Library Selection */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center">
            <ChevronsUpDown className="mr-2 h-5 w-5" /> Select Library
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.keys(spectralLibrariesData).map(libName => (
              <Button
                key={libName}
                onClick={() => setSelectedLibrary(libName)}
                variant={selectedLibrary === libName ? 'default' : 'outline'}
                size="sm"
              >
                {libName}
              </Button>
            ))}
          </div>
        </div>

        {/* Library Colors */}
        <div className="flex-grow overflow-y-auto max-h-[120px] pr-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedLibrary}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 md:grid-cols-3 gap-3"
            >
              {spectralLibrariesData[selectedLibrary].map((color) => (
                <div key={color.hex} className="bg-card p-2 rounded-md border border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-sm border border-border" style={{ backgroundColor: color.hex }} />
                    <div className="flex-1">
                      <p className="text-foreground text-xs font-semibold truncate">{color.name}</p>
                      <p className="text-muted-foreground text-xs font-mono">{color.hex}</p>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7 text-muted-foreground hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30" 
                      onClick={() => onAddColor({ ...color, spectral: generateRandomSpectralData() })}
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default SpectralLibraries;
