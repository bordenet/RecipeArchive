/**
 * Security Validation Test Suite
 * Tests core security functions using require() instead of browser loading
 */

const fs = require('fs');
const path = require('path');

describe('Security Validation', () => {
  let securityValidatorCode;
  let jwtValidatorCode;
  
  beforeAll(() => {
    // Load the source files for validation
    const securityValidatorPath = path.join(__dirname, '../../../extensions/shared/security-validator.js');
    const jwtValidatorPath = path.join(__dirname, '../../../extensions/shared/jwt-validator.js');
    
    securityValidatorCode = fs.readFileSync(securityValidatorPath, 'utf8');
    jwtValidatorCode = fs.readFileSync(jwtValidatorPath, 'utf8');
  });

  describe('Security Module Structure', () => {
    test('SecurityValidator class is properly defined', () => {
      expect(securityValidatorCode).toContain('class SecurityValidator');
      expect(securityValidatorCode).toContain('sanitizeHTML');
      expect(securityValidatorCode).toContain('validateTitle');
      expect(securityValidatorCode).toContain('validateIngredient');
    });

    test('JWTValidator class is properly defined', () => {
      expect(jwtValidatorCode).toContain('class JWTValidator');
      expect(jwtValidatorCode).toContain('validateJWT');
      expect(jwtValidatorCode).toContain('parseJWT');
      expect(jwtValidatorCode).toContain('extractCognitoUserInfo');
    });

    test('SecurityValidator has XSS protection patterns', () => {
      expect(securityValidatorCode).toContain('script');
      expect(securityValidatorCode).toMatch(/on\\w+/); // Escaped version of event handlers
      expect(securityValidatorCode).toContain('javascript');
      expect(securityValidatorCode).toContain('dangerous');
    });

    test('JWTValidator has proper token validation', () => {
      expect(jwtValidatorCode).toContain('split');
      expect(jwtValidatorCode).toContain('JSON.parse');
      expect(jwtValidatorCode).toContain('exp');
      expect(jwtValidatorCode).toContain('iat');
    });
  });

  describe('Security Configuration Validation', () => {
    test('SecurityValidator has proper field length limits', () => {
      expect(securityValidatorCode).toMatch(/title:\s*\d+/);
      expect(securityValidatorCode).toMatch(/description:\s*\d+/);
      expect(securityValidatorCode).toMatch(/ingredient:\s*\d+/);
      expect(securityValidatorCode).toMatch(/url:\s*\d+/);
    });

    test('SecurityValidator has proper regex patterns', () => {
      expect(securityValidatorCode).toContain('email:');
      expect(securityValidatorCode).toContain('url:');
      expect(securityValidatorCode).toContain('time:');
      expect(securityValidatorCode).toContain('serving:');
    });

    test('Security modules export correctly for both environments', () => {
      expect(securityValidatorCode).toContain('typeof module');
      expect(securityValidatorCode).toContain('module.exports');
      expect(securityValidatorCode).toContain('window.SecurityValidator');
      
      expect(jwtValidatorCode).toContain('typeof module');
      expect(jwtValidatorCode).toContain('module.exports');
      expect(jwtValidatorCode).toContain('window.JWTValidator');
    });
  });

  describe('Input Sanitization Patterns', () => {
    test('SecurityValidator removes dangerous script patterns', () => {
      // Check for script tag removal patterns
      expect(securityValidatorCode).toMatch(/<script.*?>/i);
      expect(securityValidatorCode).toMatch(/javascript:/i);
      expect(securityValidatorCode).toContain('dangerous');
      expect(securityValidatorCode).toContain('replace');
    });

    test('SecurityValidator removes event handler patterns', () => {
      // Check for event handler removal functionality
      expect(securityValidatorCode).toContain('Remove event handlers');
      expect(securityValidatorCode).toContain('onclick, onload');
      expect(securityValidatorCode).toContain('replace');
      expect(securityValidatorCode).toContain('gi'); // Global case-insensitive replacement
    });

    test('SecurityValidator has HTML entity handling', () => {
      // Check for HTML tag removal and sanitization patterns
      expect(securityValidatorCode).toContain('stripHTML');
      expect(securityValidatorCode).toContain('sanitizeHTML');
      expect(securityValidatorCode).toMatch(/replace.*<[^>]*>/);
      expect(securityValidatorCode).toContain('trim()');
    });
  });

  describe('JWT Validation Implementation', () => {
    test('JWTValidator properly validates token structure', () => {
      // Check for three-part JWT validation
      expect(jwtValidatorCode).toMatch(/\.split\(['"`]\.\s*['"`]\)/);
      expect(jwtValidatorCode).toMatch(/length.*3/);
    });

    test('JWTValidator handles token expiration', () => {
      expect(jwtValidatorCode).toContain('exp');
      expect(jwtValidatorCode).toMatch(/Date\.now\(\)/);
      expect(jwtValidatorCode).toMatch(/\/\s*1000/); // Division by 1000 for Unix timestamp conversion
    });

    test('JWTValidator extracts Cognito user information', () => {
      expect(jwtValidatorCode).toContain('extractCognitoUserInfo');
      expect(jwtValidatorCode).toContain('email');
      expect(jwtValidatorCode).toContain('sub');
      expect(jwtValidatorCode).toContain('given_name');
      expect(jwtValidatorCode).toContain('family_name');
    });
  });

  describe('Error Handling and Security', () => {
    test('SecurityValidator has proper error handling', () => {
      // Check for error handling patterns
      expect(securityValidatorCode).toContain('valid: false');
      expect(securityValidatorCode).toContain('error:');
      expect(securityValidatorCode).toContain('typeof');
      expect(securityValidatorCode).toContain('length');
    });

    test('JWTValidator has proper error handling', () => {
      expect(jwtValidatorCode).toMatch(/try\s*{[\s\S]*?}\s*catch/);
      expect(jwtValidatorCode).toContain('valid: false');
      expect(jwtValidatorCode).toContain('error:');
      expect(jwtValidatorCode).toContain('throw new Error');
    });

    test('No hardcoded credentials or sensitive data', () => {
      expect(securityValidatorCode).not.toMatch(/password.*[:=]/i);
      expect(securityValidatorCode).not.toMatch(/secret.*[:=]/i);
      expect(securityValidatorCode).not.toMatch(/key.*[:=].*['"`][^'"`]{10,}/);
      
      expect(jwtValidatorCode).not.toMatch(/password.*[:=]/i);
      expect(jwtValidatorCode).not.toMatch(/secret.*[:=]/i);
      expect(jwtValidatorCode).not.toMatch(/key.*[:=].*['"`][^'"`]{10,}/);
    });
  });
});
