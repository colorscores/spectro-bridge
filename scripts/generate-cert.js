#!/usr/bin/env node
/**
 * Generate self-signed SSL certificate for localhost
 * Run this once: node scripts/generate-cert.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, '..', 'certs');

// Create certs directory if it doesn't exist
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

const keyPath = path.join(certsDir, 'localhost.key');
const certPath = path.join(certsDir, 'localhost.crt');

// Check if certificates already exist
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log('Certificates already exist in', certsDir);
  console.log('Delete them first if you want to regenerate.');
  process.exit(0);
}

console.log('Generating self-signed certificate for localhost...');

try {
  // Generate private key and certificate using OpenSSL
  const opensslCmd = `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1"`;
  
  execSync(opensslCmd, { stdio: 'inherit' });
  
  console.log('\n✅ Certificates generated successfully!');
  console.log(`   Key:  ${keyPath}`);
  console.log(`   Cert: ${certPath}`);
  console.log('\n📋 To trust the certificate on macOS:');
  console.log('   1. Open Keychain Access');
  console.log('   2. Drag localhost.crt to "System" keychain');
  console.log('   3. Double-click it, expand "Trust", set to "Always Trust"');
  console.log('\n   Or simply visit https://localhost:9876 in your browser');
  console.log('   and accept the security warning once.');
} catch (error) {
  console.error('Failed to generate certificates:', error.message);
  console.error('\nMake sure OpenSSL is installed:');
  console.error('  macOS: brew install openssl');
  console.error('  Windows: Download from https://slproweb.com/products/Win32OpenSSL.html');
  process.exit(1);
}
