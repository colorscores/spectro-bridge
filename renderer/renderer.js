// UI state management
let deviceConnected = false;

// DOM elements
const deviceStatus = document.getElementById('device-status');
const deviceInfo = document.getElementById('device-info');
const calibrationStatus = document.getElementById('calibration-status');
const calibrationInfo = document.getElementById('calibration-info');
const activityLog = document.getElementById('activity-log');
const calibrateBtn = document.getElementById('calibrate-btn');
const testMeasurementBtn = document.getElementById('test-measurement-btn');
const refreshBtn = document.getElementById('refresh-btn');

// Initialize
refreshDeviceStatus();

// Event listeners
window.spectroAPI.onDeviceConnected((device) => {
  addLogEntry(`Device connected: ${device.make} ${device.model}`, 'success');
  refreshDeviceStatus();
});

window.spectroAPI.onDeviceDisconnected((deviceId) => {
  addLogEntry(`Device disconnected: ${deviceId}`, 'error');
  refreshDeviceStatus();
});

calibrateBtn.addEventListener('click', async () => {
  try {
    calibrateBtn.disabled = true;
    addLogEntry('Starting calibration...');
    
    await window.spectroAPI.triggerCalibration();
    
    addLogEntry('Calibration complete!', 'success');
    setTimeout(refreshDeviceStatus, 1000);
  } catch (error) {
    addLogEntry(`Calibration failed: ${error.message}`, 'error');
  } finally {
    calibrateBtn.disabled = false;
  }
});

testMeasurementBtn.addEventListener('click', async () => {
  try {
    testMeasurementBtn.disabled = true;
    addLogEntry('Starting test measurement...');
    
    const result = await window.spectroAPI.triggerMeasurement({
      measurementType: 'spot',
      modes: ['M0', 'M1', 'M2']
    });
    
    addLogEntry(`Measurement complete! M0 Lab: ${result.results.M0.Lab.L.toFixed(1)}, ${result.results.M0.Lab.a.toFixed(1)}, ${result.results.M0.Lab.b.toFixed(1)}`, 'success');
  } catch (error) {
    addLogEntry(`Measurement failed: ${error.message}`, 'error');
  } finally {
    testMeasurementBtn.disabled = false;
  }
});

refreshBtn.addEventListener('click', refreshDeviceStatus);

// Functions
async function refreshDeviceStatus() {
  try {
    const status = await window.spectroAPI.getDeviceStatus();
    
    if (status.connected) {
      deviceConnected = true;
      updateDeviceUI(status);
      updateCalibrationUI(status.calibration);
      calibrateBtn.disabled = false;
      testMeasurementBtn.disabled = false;
    } else {
      deviceConnected = false;
      updateDeviceUIDisconnected();
      calibrateBtn.disabled = true;
      testMeasurementBtn.disabled = true;
    }
  } catch (error) {
    console.error('Failed to get device status:', error);
    addLogEntry(`Error: ${error.message}`, 'error');
  }
}

function updateDeviceUI(status) {
  // Update status indicator
  const indicator = deviceStatus.querySelector('.status-indicator');
  indicator.className = 'status-indicator connected';
  indicator.querySelector('span:last-child').textContent = 'Device connected';
  
  // Show device info
  deviceInfo.style.display = 'block';
  document.getElementById('device-make').textContent = status.make;
  document.getElementById('device-model').textContent = status.model;
  document.getElementById('device-serial').textContent = status.serialNumber;
}

function updateDeviceUIDisconnected() {
  const indicator = deviceStatus.querySelector('.status-indicator');
  indicator.className = 'status-indicator disconnected';
  indicator.querySelector('span:last-child').textContent = 'No device connected';
  deviceInfo.style.display = 'none';
  
  // Hide calibration info
  calibrationInfo.style.display = 'none';
  calibrationStatus.querySelector('.not-calibrated').style.display = 'block';
}

function updateCalibrationUI(calibration) {
  if (calibration && calibration.calibrated) {
    calibrationStatus.querySelector('.not-calibrated').style.display = 'none';
    calibrationInfo.style.display = 'block';
    
    const calibTime = new Date(calibration.timestamp).toLocaleString();
    const expiresTime = new Date(calibration.expiresAt).toLocaleString();
    
    document.getElementById('calibration-time').textContent = calibTime;
    document.getElementById('calibration-expires').textContent = expiresTime;
  } else {
    calibrationInfo.style.display = 'none';
    calibrationStatus.querySelector('.not-calibrated').style.display = 'block';
  }
}

function addLogEntry(message, type = '') {
  const entry = document.createElement('p');
  entry.className = `log-entry ${type}`;
  entry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
  
  activityLog.insertBefore(entry, activityLog.firstChild);
  
  // Keep only last 50 entries
  while (activityLog.children.length > 50) {
    activityLog.removeChild(activityLog.lastChild);
  }
}
