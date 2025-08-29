// build-parser-bundle.js
// Script to bundle all TypeScript parsers for Chrome extension using esbuild

const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
  entryPoints: [
    path.resolve(__dirname, '../shared/parsers/parser-registry.ts'),
  ],
  bundle: true,
  minify: false,
  format: 'iife',
  platform: 'browser',
  outfile: path.resolve(__dirname, 'chrome/typescript-parser-bundle.js'),
  sourcemap: false,
  target: ['es2020'],
  tsconfig: path.resolve(__dirname, '../shared/parsers/tsconfig.json'),
  allowOverwrite: true,
}).then(() => {
  console.log('✅ Parser bundle built for Chrome extension.');
}).catch((err) => {
  console.error('❌ Parser bundle build failed:', err);
  process.exit(1);
});
