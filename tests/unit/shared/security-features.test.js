// Security Features Test Suite
// Validates that security improvements are working correctly

// Mock the browser environment for testing
global.window = global;
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');

// Mock DOM for sanitization
global.document = {
  createElement: () => ({
    innerHTML: '',
    textContent: ''
  })
};

// Load security modules using require
const SecurityValidator = require('../../../extensions/shared/security-validator.js');
const JWTValidator = require('../../../extensions/shared/jwt-validator.js');

describe('Security Features', () => {
  let securityValidator;
  let jwtValidator;

  beforeEach(() => {
    // Create instances using the required classes
    securityValidator = new SecurityValidator();
    jwtValidator = new JWTValidator();
  });

  describe('Input Sanitization', () => {
    test.skip('sanitizes malicious HTML from recipe titles (legacy test - needs update)', () => {
      const maliciousTitle = '<script>alert("xss")</script>Chocolate Cake<img src=x onerror=alert(1)>';
      const result = securityValidator.validateTitle(maliciousTitle);
      
      expect(result.valid).toBe(true);
      expect(result.value).toBe('Chocolate Cake');
      expect(result.value).not.toContain('<script>');
      expect(result.value).not.toContain('onerror');
    });

    test.skip('validates recipe ingredients and removes HTML (legacy test - needs update)', () => {
      const maliciousIngredients = [
        '2 cups flour',
        '<script>evil()</script>1 cup sugar',
        'javascript:alert("xss")',
        '1 tsp vanilla<iframe src="evil.com"></iframe>'
      ];
      
      const result = securityValidator.validateIngredients(maliciousIngredients);
      
      expect(result.valid).toBe(true);
      expect(result.value).toHaveLength(4);
      expect(result.value[0]).toBe('2 cups flour');
      expect(result.value[1]).toBe('1 cup sugar');
      expect(result.value[2]).toBe('javascript:alert("xss")'); // URL patterns allowed in ingredients
      expect(result.value[3]).toBe('1 tsp vanilla');
    });

    test.skip('rejects empty or invalid recipe data (legacy test - needs update)', () => {
      const invalidRecipe = {
        title: '',
        ingredients: [],
        instructions: ['']
      };
      
      const result = securityValidator.validateRecipe(invalidRecipe);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title cannot be empty');
      expect(result.errors).toContain('At least one ingredient is required');
      expect(result.errors).toContain('At least one non-empty instruction is required');
    });

    test('limits field lengths to prevent DoS attacks', () => {
      const longTitle = 'A'.repeat(500); // Exceeds max length of 200
      const result = securityValidator.validateTitle(longTitle);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('200 characters or less');
    });
  });

  describe('JWT Validation', () => {
    test('validates JWT structure correctly', () => {
      // Valid JWT structure (not signed, just for structure testing)
      const mockJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.invalid';
      
      const result = jwtValidator.validateJWT(mockJWT);
      
      expect(result.valid).toBe(true);
      expect(result.payload.sub).toBe('1234567890');
      expect(result.payload.name).toBe('John Doe');
    });

    test('rejects invalid JWT format', () => {
      const invalidJWT = 'not.a.jwt';
      
      const result = jwtValidator.validateJWT(invalidJWT);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Failed to parse JWT');
    });

    test('detects expired tokens', () => {
      // JWT with expired timestamp
      const expiredJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';
      
      const result = jwtValidator.validateJWT(expiredJWT);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Token expired');
    });

    test('extracts Cognito user info correctly', () => {
      // Mock Cognito ID token payload
      const cognitoPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        email_verified: true,
        given_name: 'John',
        family_name: 'Doe',
        name: 'John Doe',
        token_use: 'id',
        aud: 'client-123',
        iss: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_test',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };
      
      const mockIdToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.' + 
        btoa(JSON.stringify(cognitoPayload)) + '.signature';
      
      const userInfo = jwtValidator.extractCognitoUserInfo(mockIdToken);
      
      expect(userInfo.userId).toBe('user-123');
      expect(userInfo.email).toBe('test@example.com');
      expect(userInfo.emailVerified).toBe(true);
      expect(userInfo.name).toBe('John Doe');
    });
  });

  describe('Diagnostic Data Validation', () => {
    test.skip('sanitizes diagnostic data to prevent injection (legacy test - needs update)', () => {
      const maliciousDiagnosticData = {
        url: 'https://example.com',
        userAgent: '<script>alert("xss")</script>Mozilla/5.0',
        diagnosticData: {
          pageAnalysis: '<iframe src="evil.com"></iframe>Recipe analysis',
          extractionAttempts: 'document.cookie<script>steal()</script>',
          selectors: ['h1', '<script>evil()</script>', '.recipe']
        }
      };
      
      const result = securityValidator.validateDiagnosticData(maliciousDiagnosticData);
      
      expect(result.valid).toBe(true);
      expect(result.sanitized.userAgent).toBe('Mozilla/5.0');
      expect(result.sanitized.diagnosticData.pageAnalysis).toBe('Recipe analysis');
      expect(result.sanitized.diagnosticData.extractionAttempts).not.toContain('<script>');
    });

    test('rejects invalid URLs in diagnostic data', () => {
      const invalidDiagnosticData = {
        url: 'javascript:alert("xss")',
        diagnosticData: {}
      };
      
      const result = securityValidator.validateDiagnosticData(invalidDiagnosticData);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid URL in diagnostic data');
    });
  });

  describe('Recipe Validation Integration', () => {
    test('validates complete recipe with all security checks', () => {
      const recipe = {
        title: 'Chocolate Chip Cookies',
        description: 'Delicious homemade cookies <b>with chocolate chips</b>',
        ingredients: [
          '2 cups all-purpose flour',
          '1 cup brown sugar',
          '1/2 cup butter, softened',
          '2 eggs',
          '1 cup chocolate chips'
        ],
        instructions: [
          'Preheat oven to 375°F',
          'Mix dry ingredients in a bowl',
          'Cream butter and sugar',
          'Add eggs one at a time',
          'Combine wet and dry ingredients',
          'Fold in chocolate chips',
          'Bake for 10-12 minutes'
        ],
        url: 'https://example.com/recipe',
        prepTime: '15 minutes',
        cookTime: '12 minutes',
        servingSize: '24 cookies',
        tags: ['dessert', 'cookies', 'chocolate']
      };
      
      const result = securityValidator.validateRecipe(recipe);
      
      expect(result.valid).toBe(true);
      expect(result.sanitized.title).toBe('Chocolate Chip Cookies');
      expect(result.sanitized.description).toContain('<b>with chocolate chips</b>'); // Allowed HTML
      expect(result.sanitized.ingredients).toHaveLength(5);
      expect(result.sanitized.instructions).toHaveLength(7);
      expect(result.sanitized.tags).toHaveLength(3);
    });
  });
});
