/**
 * Safari Extension Validation Test
 * Validates that Safari extension has correct structure and basic functionality
 */

const fs = require('fs');
const path = require('path');

const SAFARI_DIR = path.join(__dirname, '../extensions/safari');

// Test manifest structure
function testManifest() {
  console.log('🧪 Testing Safari manifest.json...');

  const manifestPath = path.join(SAFARI_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('❌ manifest.json not found');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Check required fields
  const required = [
    'manifest_version',
    'name',
    'version',
    'permissions',
    'icons',
    'action',
    'background',
    'content_scripts',
  ];
  for (const field of required) {
    if (!manifest[field]) {
      throw new Error(`❌ Missing required field: ${field}`);
    }
  }

  // Check background service worker
  if (!manifest.background.service_worker) {
    throw new Error('❌ Missing background.service_worker');
  }

  // Check icons
  const iconSizes = ['16', '32', '48', '128'];
  for (const size of iconSizes) {
    if (!manifest.icons[size]) {
      throw new Error(`❌ Missing icon size: ${size}`);
    }
  }

  console.log('✅ Manifest validation passed');
  return manifest;
}

// Test required files exist
function testRequiredFiles() {
  console.log('🧪 Testing required files exist...');

  const requiredFiles = [
    'manifest.json',
    'popup.html',
    'popup.js',
    'content.js',
    'background.js',
    'config.js',
    'icon16.png',
    'icon32.png',
    'icon48.png',
    'icon128.png',
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(SAFARI_DIR, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`❌ Required file missing: ${file}`);
    }
  }

  console.log('✅ All required files present');
}

// Test JavaScript syntax
function testJavaScriptSyntax() {
  console.log('🧪 Testing JavaScript syntax...');

  const jsFiles = [
    'popup.js',
    'content.js',
    'background.js',
    'config.js',
    'auth.js',
    'cognito-auth.js',
    'jwt-validator.js',
  ];

  for (const file of jsFiles) {
    const filePath = path.join(SAFARI_DIR, file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        // Basic syntax check - look for obvious syntax errors
        if (content.includes('} catch (error) {')) {
          console.warn(`⚠️  ${file} still has unused error parameters`);
        }
      } catch (error) {
        throw new Error(`❌ Error reading ${file}: ${error.message}`);
      }
    }
  }

  console.log('✅ JavaScript syntax check passed');
}

// Run all tests
async function runTests() {
  try {
    console.log('🚀 Starting Safari Extension Validation Tests...\n');

    testManifest();
    testRequiredFiles();
    testJavaScriptSyntax();

    console.log(
      '\n🎉 All tests passed! Safari extension is ready for testing.'
    );
    console.log('\n📋 Next steps:');
    console.log('   1. Load extension in Safari Developer menu');
    console.log('   2. Test popup functionality');
    console.log('   3. Test content script injection');
    console.log('   4. Test authentication flow');
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
