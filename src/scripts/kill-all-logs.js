#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to recursively get all JS/JSX files
function getAllJSFiles(dir, files = []) {
  const entries = fs.readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(entry)) {
      getAllJSFiles(fullPath, files);
    } else if (stat.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Function to remove all console statements
function removeConsoleStatements(content) {
  // Remove all types of console statements with comprehensive regex patterns
  const patterns = [
    // Single line console statements
    /^\s*console\.(log|info|warn|error|debug|trace|dir|table|time|timeEnd|group|groupEnd|count|assert)\([^;]*\);\s*$/gm,
    
    // Multi-line console statements
    /^\s*console\.(log|info|warn|error|debug|trace|dir|table|time|timeEnd|group|groupEnd|count|assert)\([^)]*\n[^)]*\);\s*$/gm,
    
    // Console statements without semicolon
    /^\s*console\.(log|info|warn|error|debug|trace|dir|table|time|timeEnd|group|groupEnd|count|assert)\([^;]*\)\s*$/gm,
    
    // Complex multi-line console statements with nested parentheses
    /^\s*console\.(log|info|warn|error|debug|trace|dir|table|time|timeEnd|group|groupEnd|count|assert)\([\s\S]*?\);\s*$/gm,
    
    // Console statements with template literals
    /^\s*console\.(log|info|warn|error|debug|trace|dir|table|time|timeEnd|group|groupEnd|count|assert)\([^`]*`[^`]*`[^)]*\);\s*$/gm,
    
    // Console statements with object literals
    /^\s*console\.(log|info|warn|error|debug|trace|dir|table|time|timeEnd|group|groupEnd|count|assert)\([^{]*\{[^}]*\}[^)]*\);\s*$/gm
  ];
  
  let result = content;
  
  // Apply each pattern
  for (const pattern of patterns) {
    result = result.replace(pattern, '');
  }
  
  // Clean up any remaining standalone console statements (aggressive fallback)
  result = result.replace(/^\s*console\.[a-zA-Z]+\([^)]*\);?\s*$/gm, '');
  
  // Remove empty lines left behind
  result = result.replace(/^\s*\n/gm, '');
  
  return result;
}

// Main execution
const srcDir = path.join(__dirname, '..');
const jsFiles = getAllJSFiles(srcDir);

let totalRemoved = 0;

console.log(`Processing ${jsFiles.length} files...`);

for (const file of jsFiles) {
  try {
    const originalContent = fs.readFileSync(file, 'utf8');
    const newContent = removeConsoleStatements(originalContent);
    
    const originalLines = originalContent.split('\n').length;
    const newLines = newContent.split('\n').length;
    const removedLines = originalLines - newLines;
    
    if (removedLines > 0) {
      fs.writeFileSync(file, newContent, 'utf8');
      console.log(`${path.relative(srcDir, file)}: Removed ${removedLines} console statements`);
      totalRemoved += removedLines;
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
}

console.log(`\nCompleted! Removed ${totalRemoved} total console statements from ${jsFiles.length} files.`);