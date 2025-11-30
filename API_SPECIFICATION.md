# Spectro Bridge WebSocket API Specification

## Overview

The Spectro Bridge provides a WebSocket API for web applications to communicate with spectrophotometer devices. The bridge runs as a local Electron application on the user's machine and exposes a WebSocket server on `ws://localhost:9876`.

## Connection

Connect to the bridge using a standard WebSocket client:

```javascript
const ws = new WebSocket('ws://localhost:9876');

ws.onopen = () => {
  console.log('Connected to Spectro Bridge');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleMessage(message);
};
```

## Message Format

All messages are JSON objects with a `type` field and an optional `requestId` field for request/response correlation.

### Request Format
```json
{
  "type": "message:type",
  "requestId": "uuid-v4",
  ...additional fields
}
```

### Response Format
```json
{
  "type": "message:type:response",
  "requestId": "uuid-v4",
  ...response data
}
```

### Event Format (Broadcasts)
```json
{
  "type": "event:type",
  ...event data
}
```

## API Reference

### Device Status

Get the current status of the active device.

**Request:**
```json
{
  "type": "device:status",
  "requestId": "uuid"
}
```

**Response:**
```json
{
  "type": "device:status:response",
  "requestId": "uuid",
  "device": {
    "connected": true,
    "make": "X-Rite",
    "model": "i1Pro2",
    "serialNumber": "123456789",
    "firmwareVersion": "1.0.4",
    "capabilities": {
      "supportedModes": ["M0", "M1", "M2"],
      "hasDualPass": true,
      "hasPhysicalFilters": false,
      "spectralRange": {
        "start": 380,
        "end": 730,
        "interval": 10
      },
      "canMultiMode": true,
      "supportsScanning": true
    },
    "calibration": {
      "calibrated": true,
      "timestamp": "2025-01-15T10:30:00Z",
      "expiresAt": "2025-01-15T18:30:00Z"
    }
  }
}
```

### Device List

Get all connected devices.

**Request:**
```json
{
  "type": "device:list",
  "requestId": "uuid"
}
```

**Response:**
```json
{
  "type": "device:list:response",
  "requestId": "uuid",
  "devices": [
    {
      "deviceId": "X-Rite_i1Pro2_1",
      "make": "X-Rite",
      "model": "i1Pro2",
      "serialNumber": "123456789",
      "isActive": true,
      "capabilities": { ... },
      "calibration": { ... }
    }
  ]
}
```

### Calibration

Start device calibration.

**Request:**
```json
{
  "type": "calibration:start",
  "requestId": "uuid"
}
```

**Response (Immediate):**
```json
{
  "type": "calibration:started",
  "requestId": "uuid",
  "message": "Calibration started - place device on white calibration tile"
}
```

**Event (Progress):**
```json
{
  "type": "calibration:progress",
  "message": "Place device on white calibration tile"
}
```

**Event (Complete):**
```json
{
  "type": "calibration:complete",
  "requestId": "uuid",
  "calibration": {
    "calibrated": true,
    "timestamp": "2025-01-15T10:30:00Z",
    "expiresAt": "2025-01-15T18:30:00Z"
  }
}
```

**Event (Error):**
```json
{
  "type": "calibration:error",
  "requestId": "uuid",
  "error": {
    "code": "DEVICE_NOT_ON_TILE",
    "message": "Device not properly positioned on calibration tile"
  }
}
```

### Measurement

Trigger a measurement and get results for multiple modes.

**Request:**
```json
{
  "type": "measurement:trigger",
  "requestId": "uuid",
  "measurementType": "spot",
  "modes": ["M0", "M1", "M2"]
}
```

**Response:**
```json
{
  "type": "measurement:result",
  "requestId": "uuid",
  "success": true,
  "measurementId": "uuid",
  "timestamp": "2025-01-15T10:35:00Z",
  "measurementType": "spot",
  "results": {
    "M0": {
      "Lab": { "L": 95.2, "a": -1.2, "b": 3.4 },
      "XYZ": { "X": 89.1, "Y": 93.2, "Z": 85.4 },
      "spectral": {
        "380": 0.12,
        "390": 0.15,
        "400": 0.18,
        ...
        "730": 0.85
      }
    },
    "M1": {
      "Lab": { "L": 94.8, "a": -0.9, "b": 2.8 },
      "XYZ": { "X": 88.5, "Y": 92.8, "Z": 86.1 },
      "spectral": { ... }
    },
    "M2": {
      "Lab": { "L": 93.1, "a": -0.5, "b": 1.2 },
      "XYZ": { "X": 86.2, "Y": 91.0, "Z": 88.9 },
      "spectral": { ... }
    }
  }
}
```

### Bridge Info

Get bridge version and capabilities.

**Request:**
```json
{
  "type": "bridge:info",
  "requestId": "uuid"
}
```

**Response:**
```json
{
  "type": "bridge:info:response",
  "requestId": "uuid",
  "bridge": {
    "version": "1.0.0",
    "supportedDevices": ["X-Rite i1Pro", "X-Rite i1Pro2", "X-Rite i1Pro3"],
    "supportedModes": ["M0", "M1", "M2"],
    "capabilities": {
      "multiModeMeasurement": true,
      "scanning": true
    }
  }
}
```

## Events

### Device Connected
```json
{
  "type": "device:connected",
  "device": {
    "make": "X-Rite",
    "model": "i1Pro2",
    "serialNumber": "123456789"
  }
}
```

### Device Disconnected
```json
{
  "type": "device:disconnected",
  "deviceId": "X-Rite_i1Pro2_1"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `DEVICE_NOT_CONNECTED` | No spectrophotometer detected |
| `DEVICE_NOT_CALIBRATED` | Calibration required before measurement |
| `CALIBRATION_EXPIRED` | Calibration has expired |
| `DEVICE_BUSY` | Another operation is in progress |
| `MEASUREMENT_FAILED` | Device reported measurement error |
| `MEASUREMENT_TIMEOUT` | No response within timeout period |
| `DEVICE_DISCONNECTED` | Device removed during operation |
| `INVALID_MODE` | Requested mode not supported |
| `ARGYLL_NOT_FOUND` | ArgyllCMS not installed |

## Example Usage

```javascript
// Connect
const ws = new WebSocket('ws://localhost:9876');

// Get device status
ws.send(JSON.stringify({
  type: 'device:status',
  requestId: crypto.randomUUID()
}));

// Calibrate
ws.send(JSON.stringify({
  type: 'calibration:start',
  requestId: crypto.randomUUID()
}));

// Measure (M0, M1, M2 simultaneously)
ws.send(JSON.stringify({
  type: 'measurement:trigger',
  requestId: crypto.randomUUID(),
  measurementType: 'spot',
  modes: ['M0', 'M1', 'M2']
}));

// Handle responses
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'measurement:result') {
    console.log('M0 Lab:', message.results.M0.Lab);
    console.log('M1 Lab:', message.results.M1.Lab);
    console.log('M2 Lab:', message.results.M2.Lab);
  }
};
```
