// build-parser-bundle.cjs
// Script to bundle all TypeScript parsers for Chrome extension using esbuild

const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
  entryPoints: [
    path.resolve(__dirname, '../parsers/parser-registry.ts'),
  ],
  bundle: true,
  minify: false,
  format: 'iife',
  platform: 'browser',
  outfile: path.resolve(__dirname, 'chrome/typescript-parser-bundle.js'),
  sourcemap: false,
  target: ['es2020'],
  tsconfig: path.resolve(__dirname, '../parsers/tsconfig.json'),
  allowOverwrite: true,
  treeShaking: true, // Enable tree-shaking to remove unused code
  logLevel: 'info',
  drop: ['console', 'debugger'], // Drop unused code from dependencies
  external: ['buffer', 'process'], // Externalize node built-ins to avoid dead code
}).then(() => {
  console.log('✅ Parser bundle built for Chrome extension.');
}).catch((err) => {
  console.error('❌ Parser bundle build failed:', err);
  process.exit(1);
});
