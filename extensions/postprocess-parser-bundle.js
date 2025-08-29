// postprocess-parser-bundle.cjs
// Script to clean up unused assignments and unsupported lint rules from the parser bundle after build

const fs = require('fs');
const path = require('path');

const bundlePath = path.resolve(__dirname, 'chrome/typescript-parser-bundle.js');
let code = fs.readFileSync(bundlePath, 'utf8');

// Remove unused variable assignments (simple regex for common patterns)
code = code.replace(/\n\s*var\s+(htmlDecoder|xmlDecoder|encode_html_default|escapeUTF8|compile3|_compileUnsafe|selectAll|selectOne|getCodePoint2|ParserRegistry)\s*=.*?;\n/g, '\n');
code = code.replace(/\n\s*function\s+(compile3|_compileUnsafe|selectAll|selectOne|getCodePoint2)\s*\(.*?\)\s*{[\s\S]*?}\n/g, '\n');
code = code.replace(/\n\s*'err'\s+is\s+defined\s+but\s+never\s+used[\s\S]*?;\n/g, '\n');

// Remove unsupported lint rule comments
code = code.replace(/\/\/\s*eslint-disable-next-line[^\n]*\n/g, '');
code = code.replace(/\/\/\s*eslint-disable[^\n]*\n/g, '');
code = code.replace(/\/\/\s*eslint-enable[^\n]*\n/g, '');

// Remove references to missing rules in comments
code = code.replace(/Definition for rule '[^']+' was not found[\s\S]*?\n/g, '');

// Remove Buffer and TextDecoder polyfills if not used
code = code.replace(/if \(typeof Buffer !== "undefined" && Buffer.isBuffer\(content\)\) \{[\s\S]*?\}/g, '');
code = code.replace(/if \(content instanceof ArrayBuffer\) \{[\s\S]*?\}/g, '');

fs.writeFileSync(bundlePath, code, 'utf8');
console.log('✅ Post-build parser bundle cleanup complete.');
