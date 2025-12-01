// Script to remove all console.log statements
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../pages/InkConditionDetail.jsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Remove all console.log statements (including multiline ones)
content = content.replace(/console\.log\([^;]*\);?/g, '// Console log removed');

// Also remove console.error statements that might be console.log related
content = content.replace(/console\.error\([^;]*\);?/g, '// Console error removed');

// Clean up multiple consecutive comment lines
content = content.replace(/(\/\/ Console log removed\s*\n){2,}/g, '// Console logs removed\n');

// Write back to file
fs.writeFileSync(filePath, content, 'utf8');

console.log('All console.log statements removed from InkConditionDetail.jsx');