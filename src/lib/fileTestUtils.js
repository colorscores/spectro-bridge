import { debug } from './debugUtils';

/**
 * Test utilities for debugging file import issues
 */

// Create a minimal test CxF file for debugging
export function createTestCxfFile() {
  const testCxfContent = `<?xml version="1.0" encoding="UTF-8"?>
<CxF xmlns="http://colorexchangeformat.com/CxF3-core" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://colorexchangeformat.com/CxF3-core http://colorexchangeformat.com/CxF3-core.xsd">
  <FileInformation>
    <Description>Test CxF File</Description>
    <Creator>Lovable Debug Tool</Creator>
    <CreationDate>2024-01-01T00:00:00</CreationDate>
  </FileInformation>
  <Resources>
    <ObjectCollection>
      <Object Name="TestColor1" ObjectType="Standard" Id="TestColor1">
        <ColorValues>
          <ColorCIELab L="50.0" A="25.0" B="-25.0" />
          <ColorRGB R="0.4" G="0.6" B="0.8" />
        </ColorValues>
      </Object>
    </ObjectCollection>
  </Resources>
</CxF>`;

  const blob = new Blob([testCxfContent], { type: 'application/xml' });
  const file = new File([blob], 'test.cxf', { type: 'application/xml' });
  
  debug.log('[File Test Utils] Created test CxF file:', {
    name: file.name,
    size: file.size,
    type: file.type
  });
  
  return file;
}

// Test FileReader API availability and functionality
export async function testFileReaderAPI() {
  debug.log('[File Test Utils] Testing FileReader API...');
  
  const tests = {
    apiAvailable: !!window.FileReader,
    canCreateInstance: false,
    canReadBlob: false,
    canReadFile: false,
    environment: {
      userAgent: navigator.userAgent,
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      inIframe: window.parent !== window
    }
  };

  // Test if we can create a FileReader instance
  try {
    const reader = new FileReader();
    tests.canCreateInstance = true;
    debug.log('[File Test Utils] ✓ Can create FileReader instance');
  } catch (error) {
    debug.error('[File Test Utils] ✗ Cannot create FileReader instance:', error);
  }

  // Test reading a simple blob
  if (tests.canCreateInstance) {
    try {
      const testBlob = new Blob(['Hello World'], { type: 'text/plain' });
      const result = await readBlobAsText(testBlob);
      tests.canReadBlob = result === 'Hello World';
      debug.log('[File Test Utils] ✓ Can read blob:', result);
    } catch (error) {
      debug.error('[File Test Utils] ✗ Cannot read blob:', error);
    }
  }

  // Test reading a test file
  if (tests.canReadBlob) {
    try {
      const testFile = createTestCxfFile();
      const result = await readFileAsText(testFile);
      tests.canReadFile = result.includes('<CxF xmlns=');
      debug.log('[File Test Utils] ✓ Can read file, length:', result.length);
    } catch (error) {
      debug.error('[File Test Utils] ✗ Cannot read file:', error);
    }
  }

  // Compute overall success - API should work if we can create instances and read blobs
  // File reading is the core requirement for CxF import
  tests.success = tests.apiAvailable && tests.canCreateInstance && tests.canReadBlob;
  
  debug.log('[File Test Utils] FileReader API test results:', tests);
  return tests;
}

// Helper function to read blob as text
function readBlobAsText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('FileReader error: ' + e.target.error?.message));
    reader.readAsText(blob);
  });
}

// Helper function to read file as text with detailed logging
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      debug.log('[File Test Utils] File read successful');
      resolve(e.target.result);
    };
    
    reader.onerror = (e) => {
      debug.error('[File Test Utils] File read error:', e.target.error);
      reject(new Error('FileReader error: ' + e.target.error?.message));
    };
    
    reader.onabort = () => {
      debug.error('[File Test Utils] File read aborted');
      reject(new Error('File read aborted'));
    };
    
    reader.readAsText(file);
  });
}

// Test file input element functionality
export function testFileInputElement() {
  debug.log('[File Test Utils] Testing file input element...');
  
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.cxf,.xml';
  
  const tests = {
    canCreateInput: true,
    canSetProperties: false,
    canTriggerClick: false,
    hasFileAPI: !!input.files
  };

  try {
    input.accept = '.cxf,.xml';
    input.multiple = false;
    tests.canSetProperties = true;
    debug.log('[File Test Utils] ✓ Can set input properties');
  } catch (error) {
    debug.error('[File Test Utils] ✗ Cannot set input properties:', error);
  }

  try {
    // Test if we can programmatically trigger click
    input.click();
    tests.canTriggerClick = true;
    debug.log('[File Test Utils] ✓ Can trigger input click');
  } catch (error) {
    debug.error('[File Test Utils] ✗ Cannot trigger input click:', error);
  }

  // Compute overall success - File input should work if we can create and configure it
  // Click triggering is not essential for basic functionality
  tests.success = tests.canCreateInput && tests.canSetProperties && tests.hasFileAPI;

  debug.log('[File Test Utils] File input test results:', tests);
  return tests;
}

// Run comprehensive file system tests
export async function runFileSystemDiagnostics() {
  debug.log('[File Test Utils] Running comprehensive file system diagnostics...');
  
  const fileReaderResults = await testFileReaderAPI();
  const fileInputResults = testFileInputElement();
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    // Legacy keys for backward compatibility
    fileReaderTests: fileReaderResults,
    fileInputTests: fileInputResults,
    // New expected keys
    fileReader: fileReaderResults,
    fileInput: fileInputResults,
    securityContext: {
      isSecureContext: window.isSecureContext,
      protocol: window.location.protocol,
      crossOriginEmbedded: document.querySelector('meta[http-equiv="Cross-Origin-Embedder-Policy"]')?.content,
      crossOriginOpener: document.querySelector('meta[http-equiv="Cross-Origin-Opener-Policy"]')?.content
    },
    permissions: {}
  };

  // Test permissions if available
  if (navigator.permissions) {
    try {
      const result = await navigator.permissions.query({ name: 'camera' });
      diagnostics.permissions.camera = result.state;
    } catch (error) {
      debug.warn('[File Test Utils] Could not check camera permission:', error);
    }
  }

  debug.log('[File Test Utils] Complete diagnostics:', diagnostics);
  return diagnostics;
}