// build-parser-bundle-safari.cjs
// Script to bundle all TypeScript parsers for Safari extension using esbuild

const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
  entryPoints: [
    '/Users/Matt.Bordenet/GitHub/RecipeArchive/parsers/parser-registry.ts',
  ],
  bundle: true,
  minify: false,
  format: 'iife',
  platform: 'browser',
  outfile: path.resolve(__dirname, 'safari/typescript-parser-bundle.js'),
  sourcemap: false,
  target: ['es2020'],
  tsconfig: path.resolve(__dirname, '../parsers/tsconfig.json'),
  allowOverwrite: true,
}).then(() => {
  console.log('✅ Parser bundle built for Safari extension.');
}).catch((err) => {
  console.error('❌ Parser bundle build failed:', err);
  process.exit(1);
});
