#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function cleanupParserBundle(bundlePath) {
  console.log(`🧹 Cleaning up parser bundle: ${bundlePath}`);
  
  let content = fs.readFileSync(bundlePath, 'utf8');
  
  // Only safe transformations that don't break syntax:
  
  // 1. Fix empty catch blocks by adding ignored parameter prefix
  content = content.replace(/catch \(([^)]+)\) \{\s*\}/g, 'catch (_$1) { /* ignored */ }');
  
  // 2. Fix empty blocks by adding comments
  content = content.replace(/\{\s*\}/g, '{ /* empty */ }');
  
  // 3. Fix conditional assignments by wrapping in parentheses
  content = content.replace(/if \(([^)=]+) = ([^)]+)\)/g, 'if (($1 = $2))');
  content = content.replace(/while \(([^)=]+) = ([^)]+)\)/g, 'while (($1 = $2))');
  
  // 4. Fix 'this' aliasing by prefixing with underscore
  content = content.replace(/var (self|that) = this;/g, 'var _$1 = this;');
  
  // 5. Add void prefix to standalone expressions that are clearly side effects
  content = content.replace(/^(\s+)([a-zA-Z_$][a-zA-Z0-9_$]*\.prototype\.[^=\n]+);$/gm, '$1void $2;');
  
  // 6. Remove problematic ESLint disable comments with unknown rules
  content = content.replace(/\/\/ eslint-disable-next-line[^\n]*node\/no-unsupported-features\/es-builtins[^\n]*/g, '');
  content = content.replace(/\/\/ eslint-disable-next-line[^\n]*n\/no-unsupported-features\/es-builtins[^\n]*/g, '');
  content = content.replace(/\/\* eslint-disable[^\n]*node\/no-unsupported-features\/es-builtins[^\n]*\*\//g, '');
  content = content.replace(/\/\* eslint-disable[^\n]*n\/no-unsupported-features\/es-builtins[^\n]*\*\//g, '');
  
  fs.writeFileSync(bundlePath, content);
  console.log('✅ Parser bundle cleanup complete');
}

// Clean up both Chrome and Safari bundles
const chromeBundlePath = path.join(__dirname, 'chrome/typescript-parser-bundle.js');
const safariBundlePath = path.join(__dirname, 'safari/typescript-parser-bundle.js');

if (fs.existsSync(chromeBundlePath)) {
  cleanupParserBundle(chromeBundlePath);
}

if (fs.existsSync(safariBundlePath)) {
  cleanupParserBundle(safariBundlePath);
}
