/**
 * WebSocket client for Spectro Bridge communication
 * Connects to the local Electron bridge app on port 9876
 * Tries wss:// first (for HTTPS pages), falls back to ws:// (for local dev)
 */

const BRIDGE_URLS = ['wss://localhost:9876', 'ws://localhost:9876'];
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]; // Exponential backoff

// Download URL for Spectro Bridge installer
export const SPECTRO_BRIDGE_DOWNLOAD_URL = 'https://github.com/colorscores/spectro-bridge/releases/latest';

// Number of connection failures before assuming bridge is not installed
const NOT_INSTALLED_THRESHOLD = 3;

class SpectroBridgeClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.pendingRequests = new Map();
    this.reconnectAttempt = 0;
    this.reconnectTimeout = null;
    this.intentionalClose = false;
    this.connected = false;
    this.currentUrlIndex = 0;
    this.connectedUrl = null;
    this.connectionFailures = 0;
    this.bridgeNotInstalled = false;
  }

  /**
   * Connect to the bridge WebSocket server
   * Tries wss:// first, then falls back to ws://
   */
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    this.intentionalClose = false;
    
    // If we had a successful connection before, try that URL first
    if (this.connectedUrl) {
      return this.tryConnect(this.connectedUrl);
    }
    
    // Otherwise try URLs in order
    return this.tryConnectWithFallback(0);
  }

  /**
   * Try connecting to URLs in order, falling back on failure
   */
  tryConnectWithFallback(urlIndex) {
    if (urlIndex >= BRIDGE_URLS.length) {
      console.error('[SpectroBridge] All connection attempts failed');
      this.connectionFailures++;
      
      // After multiple failures, assume bridge is not installed
      if (this.connectionFailures >= NOT_INSTALLED_THRESHOLD) {
        this.bridgeNotInstalled = true;
        this.emit('bridge:not-installed', { downloadUrl: SPECTRO_BRIDGE_DOWNLOAD_URL });
      }
      
      this.emit('error', { error: 'All connection attempts failed' });
      this.scheduleReconnect();
      return Promise.reject(new Error('All connection attempts failed'));
    }

    const url = BRIDGE_URLS[urlIndex];
    console.log(`[SpectroBridge] Trying ${url}...`);

    return this.tryConnect(url).catch(() => {
      console.log(`[SpectroBridge] Failed to connect to ${url}, trying next...`);
      return this.tryConnectWithFallback(urlIndex + 1);
    });
  }

  /**
   * Try to connect to a specific URL
   */
  tryConnect(url) {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(url);
        let settled = false;

        const cleanup = () => {
          ws.onopen = null;
          ws.onclose = null;
          ws.onerror = null;
          ws.onmessage = null;
        };

        ws.onopen = () => {
          if (settled) return;
          settled = true;
          console.log(`[SpectroBridge] Connected to ${url}`);
          this.ws = ws;
          this.connected = true;
          this.connectedUrl = url;
          this.reconnectAttempt = 0;
          this.connectionFailures = 0;
          this.bridgeNotInstalled = false;
          
          // Set up permanent handlers
          this.ws.onclose = () => {
            console.log('[SpectroBridge] Disconnected from bridge');
            this.connected = false;
            this.emit('connection', { connected: false });
            
            if (!this.intentionalClose) {
              this.scheduleReconnect();
            }
          };

          this.ws.onerror = (error) => {
            console.error('[SpectroBridge] WebSocket error:', error);
            this.emit('error', { error: 'Connection error' });
          };

          this.ws.onmessage = (event) => {
            this.handleMessage(event.data);
          };

          this.emit('connection', { connected: true });
          resolve();
        };

        ws.onerror = (error) => {
          if (settled) return;
          settled = true;
          cleanup();
          console.warn(`[SpectroBridge] Connection error for ${url}:`, error);
          reject(error);
        };

        // Timeout for this specific connection attempt
        setTimeout(() => {
          if (!settled) {
            settled = true;
            cleanup();
            ws.close();
            reject(new Error(`Connection timeout for ${url}`));
          }
        }, 3000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the bridge
   */
  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  /**
   * Force an immediate reconnection attempt
   * Clears backoff state and tries to connect right away
   */
  forceReconnect() {
    console.log('[SpectroBridge] Force reconnect requested');
    
    // Clear any pending reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Close any stale/connecting socket
    if (this.ws) {
      this.intentionalClose = true;
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    
    // Reset all backoff state
    this.reconnectAttempt = 0;
    this.connectionFailures = 0;
    this.bridgeNotInstalled = false;
    this.intentionalClose = false;
    this.connected = false;
    this.connectedUrl = null; // Clear cached URL to try all options fresh
    
    // Immediately attempt connection
    return this.connect();
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  scheduleReconnect() {
    if (this.intentionalClose) return;

    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    console.log(`[SpectroBridge] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt + 1})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempt++;
      this.connect().catch(() => {
        // Will auto-retry via onclose handler
      });
    }, delay);
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      console.log('[SpectroBridge] Received:', message.type, message);

      // Handle request/response correlation
      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const { resolve, reject } = this.pendingRequests.get(message.requestId);
        this.pendingRequests.delete(message.requestId);

        if (message.type.includes('error') || message.error) {
          reject(message);
        } else {
          resolve(message);
        }
      }

      // Emit event for listeners
      this.emit(message.type, message);

    } catch (error) {
      console.error('[SpectroBridge] Failed to parse message:', error);
    }
  }

  /**
   * Send a message to the bridge
   */
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Not connected to bridge'));
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullMessage = { ...message, requestId };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      // Timeout for response
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 60000); // 60 second timeout for measurements

      this.ws.send(JSON.stringify(fullMessage));
      console.log('[SpectroBridge] Sent:', fullMessage.type, fullMessage);
    });
  }

  /**
   * Request device status
   */
  async requestDeviceStatus() {
    return this.send({ type: 'device:status' });
  }

  /**
   * Request calibration
   */
  async requestCalibration() {
    return this.send({ type: 'calibration:start' });
  }

  /**
   * Request measurement with specified modes
   * @param {string[]} modes - Array of modes like ['M0', 'M1', 'M2']
   * @param {string} measurementType - 'spot', 'strip', or 'multi-spot'
   */
  async requestMeasurement(modes = ['M0'], measurementType = 'spot') {
    return this.send({ 
      type: 'measurement:trigger',
      modes,
      measurementType
    });
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[SpectroBridge] Listener error:', error);
        }
      });
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Check if bridge appears to not be installed
   */
  isBridgeNotInstalled() {
    return this.bridgeNotInstalled;
  }
}

// Singleton instance
let clientInstance = null;

export const getSpectroBridgeClient = () => {
  if (!clientInstance) {
    clientInstance = new SpectroBridgeClient();
  }
  return clientInstance;
};

export default SpectroBridgeClient;
