# Spectro Bridge

Electron-based bridge application for connecting spectrophotometer devices to web browsers via WebSocket API.

## Features

- ✅ USB device hot-plug detection
- ✅ X-Rite i1Pro/i1Pro2/i1Pro3 support via ArgyllCMS
- ✅ Multi-mode measurements (M0, M1, M2) from single physical measurement
- ✅ WebSocket API for browser communication
- ✅ Device calibration management
- ✅ System tray integration
- ✅ Cross-platform support (Mac, Windows, Linux)

## Prerequisites

1. **Node.js** (v16 or higher)
2. **ArgyllCMS** installed and in system PATH
   - macOS: `brew install argyllcms`
   - Windows: Download from [ArgyllCMS website](https://www.argyllcms.com/)
   - Linux: `sudo apt-get install argyll` or compile from source

## Installation

```bash
cd spectro-bridge
npm install
```

## Development

Run in development mode:

```bash
npm run dev
```

## Building

Build for all platforms:

```bash
npm run build
```

Or build for specific platform:

```bash
npm run build:mac
npm run build:win
npm run build:linux
```

## Usage

1. **Start the bridge app** - It will run in the system tray
2. **Connect your spectrophotometer** - The app will automatically detect it
3. **Open the status window** - Click the tray icon
4. **Calibrate the device** - Click "Calibrate Device"
5. **Connect from your web app** - Use WebSocket at `ws://localhost:9876`

## WebSocket API

See [API_SPECIFICATION.md](./API_SPECIFICATION.md) for complete API documentation.

### Quick Example

```javascript
const ws = new WebSocket('ws://localhost:9876');

// Get device status
ws.send(JSON.stringify({
  type: 'device:status',
  requestId: crypto.randomUUID()
}));

// Measure M0, M1, M2 simultaneously
ws.send(JSON.stringify({
  type: 'measurement:trigger',
  requestId: crypto.randomUUID(),
  measurementType: 'spot',
  modes: ['M0', 'M1', 'M2']
}));
```

## Supported Devices

### Current
- ✅ X-Rite i1Pro (via ArgyllCMS)
- ✅ X-Rite i1Pro2 (via ArgyllCMS)
- ✅ X-Rite i1Pro3 (via ArgyllCMS)

### Future (Requires vendor SDK)
- ⏳ X-Rite eXact
- ⏳ Techkon SpectroDens

## Adding New Devices

See [ADAPTER_GUIDE.md](./ADAPTER_GUIDE.md) for instructions on adding support for additional spectrophotometer models.

## Architecture

```
spectro-bridge/
├── main.js                    # Electron main process
├── preload.js                 # Secure IPC bridge
├── src/
│   ├── adapters/              # Device adapters
│   │   ├── BaseAdapter.js     # Abstract interface
│   │   └── I1ProAdapter.js    # i1Pro implementation
│   ├── argyll/                # ArgyllCMS integration
│   │   ├── spotread.js        # CLI wrapper
│   │   ├── parser.js          # Output parser
│   │   └── fwaCompensation.js # Multi-mode calculations
│   ├── calibration/           # Calibration management
│   ├── device/                # Device detection & management
│   ├── server/                # WebSocket server
│   └── utils/                 # Logging, config
└── renderer/                  # Status UI
```

## License

MIT
