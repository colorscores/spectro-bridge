const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('spectroAPI', {
  getDeviceStatus: () => ipcRenderer.invoke('get-device-status'),
  triggerCalibration: () => ipcRenderer.invoke('trigger-calibration'),
  triggerMeasurement: (options) => ipcRenderer.invoke('trigger-measurement', options),
  
  // Event listeners
  onDeviceConnected: (callback) => {
    ipcRenderer.on('device:connected', (event, device) => callback(device));
  },
  onDeviceDisconnected: (callback) => {
    ipcRenderer.on('device:disconnected', (event, deviceId) => callback(deviceId));
  }
});
