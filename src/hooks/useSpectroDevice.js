import { useState, useEffect, useCallback, useRef } from 'react';
import { getSpectroBridgeClient, SPECTRO_BRIDGE_DOWNLOAD_URL } from '@/lib/spectroBridge';

/**
 * React hook for spectrophotometer device management
 * Handles connection, calibration, and measurement states
 */
export const useSpectroDevice = ({ onMeasurementReceived } = {}) => {
  // Connection states
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [bridgeNotInstalled, setBridgeNotInstalled] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  
  // Device info
  const [deviceInfo, setDeviceInfo] = useState(null);
  
  // Calibration states
  const [calibrated, setCalibrated] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationExpiry, setCalibrationExpiry] = useState(null);
  
  // Measurement states
  const [measuring, setMeasuring] = useState(false);
  const [lastMeasurement, setLastMeasurement] = useState(null);
  
  // Status message for UI
  const [statusMessage, setStatusMessage] = useState('Connecting to bridge...');
  const [error, setError] = useState(null);

  const clientRef = useRef(null);
  const mountedRef = useRef(true);
  const onMeasurementReceivedRef = useRef(onMeasurementReceived);

  // Keep callback ref updated
  useEffect(() => {
    onMeasurementReceivedRef.current = onMeasurementReceived;
  }, [onMeasurementReceived]);

  // Initialize connection
  useEffect(() => {
    mountedRef.current = true;
    const client = getSpectroBridgeClient();
    clientRef.current = client;

    // Set up event listeners
    const handleConnection = ({ connected }) => {
      if (!mountedRef.current) return;
      setBridgeConnected(connected);
      setBridgeNotInstalled(false);
      if (!connected) {
        setDeviceConnected(false);
        setCalibrated(false);
        setStatusMessage('Bridge not running');
      } else {
        setStatusMessage('Checking device...');
        // Request device status when connected
        client.requestDeviceStatus().catch(console.error);
      }
    };

    const handleBridgeNotInstalled = () => {
      if (!mountedRef.current) return;
      setBridgeNotInstalled(true);
      setStatusMessage('Spectro Bridge not detected');
    };

    const handleDeviceStatus = (message) => {
      if (!mountedRef.current) return;
      const { device } = message;
      
      if (device?.connected) {
        setDeviceConnected(true);
        setDeviceInfo({
          make: device.make || 'Unknown',
          model: device.model || 'Unknown',
          serialNumber: device.serialNumber || 'Unknown'
        });
        
        if (device.calibration?.calibrated) {
          setCalibrated(true);
          setCalibrationExpiry(device.calibration.expiresAt ? new Date(device.calibration.expiresAt) : null);
          setStatusMessage('Ready to measure');
        } else {
          setCalibrated(false);
          setStatusMessage('Calibration required');
        }
      } else {
        setDeviceConnected(false);
        setCalibrated(false);
        setDeviceInfo(null);
        setStatusMessage('No device connected');
      }
    };

    const handleDeviceAttached = (message) => {
      if (!mountedRef.current) return;
      setDeviceConnected(true);
      setDeviceInfo({
        make: message.device?.make || 'Unknown',
        model: message.device?.model || 'Unknown',
        serialNumber: message.device?.serialNumber || 'Unknown'
      });
      setCalibrated(false);
      setStatusMessage('Device connected - calibration required');
    };

    const handleDeviceDetached = () => {
      if (!mountedRef.current) return;
      setDeviceConnected(false);
      setCalibrated(false);
      setDeviceInfo(null);
      setStatusMessage('Device disconnected');
    };

    const handleCalibrationComplete = (message) => {
      if (!mountedRef.current) return;
      setCalibrating(false);
      setCalibrated(true);
      if (message.calibration?.expiresAt) {
        setCalibrationExpiry(new Date(message.calibration.expiresAt));
      }
      if (message.device?.serialNumber) {
        setDeviceInfo(prev => ({ ...prev, serialNumber: message.device.serialNumber }));
      }
      setStatusMessage('Ready to measure');
      setError(null);
    };

    const handleCalibrationError = (message) => {
      if (!mountedRef.current) return;
      setCalibrating(false);
      setError(message.error || 'Calibration failed');
      setStatusMessage('Calibration failed');
    };

    const handleMeasurementResult = (message) => {
      if (!mountedRef.current) return;
      setMeasuring(false);
      setLastMeasurement(message.result);
      setStatusMessage('Measurement complete');
      setError(null);
    };

    const handleMeasurementError = (message) => {
      if (!mountedRef.current) return;
      setMeasuring(false);
      setError(message.error || 'Measurement failed');
      setStatusMessage('Measurement failed');
    };
    
    // Push event: measurement completed (auto-detection)
    const handleMeasurementCompleted = (message) => {
      if (!mountedRef.current) return;
      console.log('[useSpectroDevice] === MEASUREMENT COMPLETED (push event) ===');
      console.log('[useSpectroDevice] Message type:', message.type);
      console.log('[useSpectroDevice] Message source:', message.source);
      console.log('[useSpectroDevice] Has results:', !!message.results);
      console.log('[useSpectroDevice] Results modes:', message.results ? Object.keys(message.results) : 'N/A');
      
      if (message.results?.M0?.spectral) {
        console.log('[useSpectroDevice] M0 spectral count:', Object.keys(message.results.M0.spectral).length);
        console.log('[useSpectroDevice] M0 spectral sample:', JSON.stringify(message.results.M0.spectral).substring(0, 200));
      }
      if (message.results?.M0?.Lab) {
        console.log('[useSpectroDevice] M0 Lab:', JSON.stringify(message.results.M0.Lab));
      }
      
      // Call the callback if provided
      if (onMeasurementReceivedRef.current) {
        console.log('[useSpectroDevice] Calling onMeasurementReceived callback');
        onMeasurementReceivedRef.current(message);
      } else {
        console.warn('[useSpectroDevice] No onMeasurementReceived callback registered!');
      }
    };

    const handleError = (message) => {
      if (!mountedRef.current) return;
      setError(message.error || 'Unknown error');
    };

    // Register listeners
    client.on('connection', handleConnection);
    client.on('bridge:not-installed', handleBridgeNotInstalled);
    client.on('device:status:response', handleDeviceStatus);
    client.on('device:connected', handleDeviceAttached);
    client.on('device:disconnected', handleDeviceDetached);
    client.on('calibration:complete', handleCalibrationComplete);
    client.on('calibration:error', handleCalibrationError);
    client.on('measurement:result', handleMeasurementResult);
    client.on('measurement:error', handleMeasurementError);
    client.on('measurement:completed', handleMeasurementCompleted);
    client.on('error', handleError);

    // Connect to bridge
    client.connect().catch(() => {
      if (mountedRef.current) {
        setBridgeConnected(false);
        setStatusMessage('Bridge not running - start Spectro Bridge app');
      }
    });

    // Cleanup
    return () => {
      mountedRef.current = false;
      client.off('connection', handleConnection);
      client.off('bridge:not-installed', handleBridgeNotInstalled);
      client.off('device:status:response', handleDeviceStatus);
      client.off('device:connected', handleDeviceAttached);
      client.off('device:disconnected', handleDeviceDetached);
      client.off('calibration:complete', handleCalibrationComplete);
      client.off('calibration:error', handleCalibrationError);
      client.off('measurement:result', handleMeasurementResult);
      client.off('measurement:error', handleMeasurementError);
      client.off('measurement:completed', handleMeasurementCompleted);
      client.off('error', handleError);
    };
  }, []);

  // Calibrate device
  const calibrate = useCallback(async () => {
    if (!clientRef.current?.isConnected()) {
      setError('Not connected to bridge');
      return null;
    }
    if (!deviceConnected) {
      setError('No device connected');
      return null;
    }

    setCalibrating(true);
    setError(null);
    setStatusMessage('Calibrating... place device on white tile');

    try {
      const result = await clientRef.current.requestCalibration();
      return result;
    } catch (err) {
      setCalibrating(false);
      setError(err.message || 'Calibration failed');
      setStatusMessage('Calibration failed');
      return null;
    }
  }, [deviceConnected]);

  // Measure color
  const measure = useCallback(async (modes = ['M0'], measurementType = 'spot') => {
    if (!clientRef.current?.isConnected()) {
      setError('Not connected to bridge');
      return null;
    }
    if (!deviceConnected) {
      setError('No device connected');
      return null;
    }
    if (!calibrated) {
      setError('Device not calibrated');
      return null;
    }

    setMeasuring(true);
    setError(null);
    setStatusMessage('Measuring... place device on sample');

    try {
      const result = await clientRef.current.requestMeasurement(modes, measurementType);
      return result;
    } catch (err) {
      setMeasuring(false);
      setError(err.message || 'Measurement failed');
      setStatusMessage('Measurement failed');
      return null;
    }
  }, [deviceConnected, calibrated]);

  // Refresh device status
  const refreshStatus = useCallback(async () => {
    if (!clientRef.current?.isConnected()) {
      return;
    }
    try {
      await clientRef.current.requestDeviceStatus();
    } catch (err) {
      console.error('Failed to refresh status:', err);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Force reconnect to bridge
  const forceReconnect = useCallback(async () => {
    setStatusMessage('Reconnecting to bridge...');
    setError(null);
    setBridgeNotInstalled(false);
    try {
      await clientRef.current?.forceReconnect();
    } catch (err) {
      console.error('Force reconnect failed:', err);
      setStatusMessage('Bridge not running - start Spectro Bridge app');
    }
  }, []);

  return {
    // Connection states
    bridgeConnected,
    bridgeNotInstalled,
    bridgeDownloadUrl: SPECTRO_BRIDGE_DOWNLOAD_URL,
    deviceConnected,
    
    // Device info
    deviceInfo,
    
    // Calibration states
    calibrated,
    calibrating,
    calibrationExpiry,
    
    // Measurement states
    measuring,
    lastMeasurement,
    
    // Status
    statusMessage,
    error,
    
    // Actions
    calibrate,
    measure,
    refreshStatus,
    clearError,
    forceReconnect,
  };
};

export default useSpectroDevice;
