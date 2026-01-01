#!/usr/bin/env node
/**
 * Fix UTF-8 BOM in pgkiss bin files.
 * The pgkiss repo has BOM characters that break Node.js on Windows.
 * Run this after npm install: node scripts/fix-pgkiss-bom.js
 */

const fs = require('fs');
const path = require('path');

const binDir = path.join(__dirname, '..', 'node_modules', 'pgkiss', 'bin');

if (!fs.existsSync(binDir)) {
  console.log('pgkiss not installed, skipping BOM fix');
  process.exit(0);
}

const files = fs.readdirSync(binDir).filter(f => f.endsWith('.js'));

let fixed = 0;
for (const file of files) {
  const filePath = path.join(binDir, file);
  const buffer = fs.readFileSync(filePath);
  
  // Check for UTF-8 BOM: EF BB BF (239 187 191)
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    // Strip BOM
    const content = buffer.slice(3);
    fs.writeFileSync(filePath, content);
    console.log(`Fixed BOM: ${file}`);
    fixed++;
  }
}

if (fixed === 0) {
  console.log('No BOM issues found');
} else {
  console.log(`Fixed ${fixed} file(s)`);
}

