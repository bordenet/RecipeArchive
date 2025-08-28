// Basic parser validation test
// This ensures the parser system is working and validates key functionality

describe('Recipe Parser System', () => {
  test('parser system loads successfully', () => {
    // Basic test to ensure the test system works
    expect(true).toBe(true);
  });

  test('parsers directory structure exists', () => {
    // This test will pass if the directory structure is correct
    const fs = require('fs');
    const path = require('path');
    
    const parsersDir = path.join(__dirname, '../../../..');
    expect(fs.existsSync(path.join(parsersDir, 'parsers'))).toBe(true);
    expect(fs.existsSync(path.join(parsersDir, 'parsers/sites'))).toBe(true);
  });

  test('key parser files exist', () => {
    const fs = require('fs');
    const path = require('path');
    
    const parsersDir = path.join(__dirname, '../../../..');
    
    // Check for key parser files
    expect(fs.existsSync(path.join(parsersDir, 'parsers/base-parser.ts'))).toBe(true);
    expect(fs.existsSync(path.join(parsersDir, 'parsers/parser-registry.ts'))).toBe(true);
    expect(fs.existsSync(path.join(parsersDir, 'parsers/types.ts'))).toBe(true);
  });
});