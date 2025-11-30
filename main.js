const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const { SpectroWebSocketServer } = require('./src/server/websocket');
const { DeviceManager } = require('./src/device/DeviceManager');
const { CalibrationManager } = require('./src/calibration/CalibrationManager');
const { logger } = require('./src/utils/logger');

let mainWindow = null;
let tray = null;
let wsServer = null;
let deviceManager = null;
let calibrationManager = null;

function createWindow() {
  const windowOptions = {
    title: 'Spectro Bridge',
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  };
  
  // Add icon only if it exists
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const fs = require('fs');
  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }
  
  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.loadFile('renderer/index.html');

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Try to create tray with icon, but don't crash if icon is missing
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const fs = require('fs');
  
  try {
    if (fs.existsSync(iconPath)) {
      tray = new Tray(iconPath);
    } else {
      logger.warn('Tray icon not found, creating tray without icon');
      // Create empty image for tray
      const { nativeImage } = require('electron');
      const emptyImage = nativeImage.createEmpty();
      tray = new Tray(emptyImage);
    }
  } catch (error) {
    logger.error('Failed to create tray:', error);
    return; // Don't crash the app
  }
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Show Spectro Bridge', 
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    { 
      label: 'Device Status', 
      enabled: false
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Spectro Bridge');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
}

async function initializeServices() {
  try {
    console.log('=== SPECTRO BRIDGE STARTING ===');
    logger.info('=== Initializing Spectro Bridge services ===');

    // Initialize managers
    console.log('Creating CalibrationManager...');
    calibrationManager = new CalibrationManager();
    console.log('Creating DeviceManager...');
    deviceManager = new DeviceManager(calibrationManager);

    // Initialize WebSocket server
    console.log('Creating WebSocket server...');
    wsServer = new SpectroWebSocketServer(9876, deviceManager, calibrationManager);
    console.log('Starting WebSocket server...');
    await wsServer.start();
    console.log('WebSocket server started');

    // Start device detection
    console.log('Starting device detection...');
    logger.info('=== STARTING DEVICE DETECTION ===');
    await deviceManager.startDetection();
    console.log('Device detection started');
    logger.info('=== DEVICE DETECTION STARTED ===');

    // Listen for device events and broadcast to clients
    deviceManager.on('device:connected', (device) => {
      logger.info('Device connected:', device);
      wsServer.broadcast({
        type: 'device:connected',
        device: device.getInfo()
      });
      updateTrayMenu();
      if (mainWindow) {
        mainWindow.webContents.send('device:connected', device.getInfo());
      }
    });

    deviceManager.on('device:disconnected', (deviceId) => {
      logger.info('Device disconnected:', deviceId);
      wsServer.broadcast({
        type: 'device:disconnected',
        deviceId
      });
      updateTrayMenu();
      if (mainWindow) {
        mainWindow.webContents.send('device:disconnected', deviceId);
      }
    });
    
    // Listen for measurement events and broadcast to ALL clients (push events)
    deviceManager.on('measurement:completed', (data) => {
      logger.info('Measurement completed, broadcasting to clients:', data.measurementId);
      wsServer.broadcast({
        type: 'measurement:completed',
        ...data
      });
    });

    logger.info('Spectro Bridge initialized successfully');
    console.log('=== SPECTRO BRIDGE INITIALIZED SUCCESSFULLY ===');
  } catch (error) {
    console.error('!!! FAILED TO INITIALIZE SERVICES !!!', error);
    logger.error('Failed to initialize services:', error);
    throw error;
  }
}

function updateTrayMenu() {
  if (!tray) return;

  const device = deviceManager ? deviceManager.getActiveDevice() : null;
  const deviceStatus = device 
    ? `${device.getInfo().make} ${device.getInfo().model} - Connected`
    : 'No device connected';

  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Show Spectro Bridge', 
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    { 
      label: deviceStatus,
      enabled: false
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// App lifecycle
console.log('=== ELECTRON APP STARTING ===');
app.whenReady().then(async () => {
  console.log('=== ELECTRON APP READY ===');
  try {
    console.log('Creating window...');
    createWindow();
    console.log('Creating tray...');
    createTray();
    console.log('Initializing services...');
    await initializeServices();
    console.log('=== APP FULLY INITIALIZED ===');
  } catch (error) {
    console.error('!!! FATAL ERROR DURING APP INITIALIZATION !!!', error);
    logger.error('Fatal error during app initialization:', error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch(error => {
  console.error('!!! FATAL ERROR IN APP.WHENREADY !!!', error);
  app.quit();
});

app.on('window-all-closed', () => {
  // Keep app running in system tray
  // Don't quit on window close
});

// Simplified quit handling - single quit works
app.on('before-quit', async (event) => {
  if (app.isQuitting) return; // Already quitting
  
  event.preventDefault();
  app.isQuitting = true;
  
  logger.info('Shutting down Spectro Bridge...');
  
  try {
    // Run cleanup
    await Promise.all([
      wsServer ? wsServer.stop() : Promise.resolve(),
      deviceManager ? deviceManager.stopDetection() : Promise.resolve()
    ]);
    logger.info('Spectro Bridge shutdown complete');
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  app.exit(0);
});

// IPC handlers for renderer process
ipcMain.handle('get-device-status', async () => {
  const device = deviceManager ? deviceManager.getActiveDevice() : null;
  if (!device) {
    return { connected: false };
  }
  return device.getStatus();
});

ipcMain.handle('trigger-calibration', async () => {
  const device = deviceManager ? deviceManager.getActiveDevice() : null;
  if (!device) {
    throw new Error('No device connected');
  }
  return await device.calibrate();
});

ipcMain.handle('trigger-measurement', async (event, options) => {
  const device = deviceManager ? deviceManager.getActiveDevice() : null;
  if (!device) {
    throw new Error('No device connected');
  }
  return await device.measure(options);
});
