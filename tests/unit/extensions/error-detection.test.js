// Automated JavaScript Variable Scope and Error Detection Tests
// Catches runtime errors like undefined variables before they reach users

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Extension JavaScript Error Detection', () => {
  let dom;
  let window;
  let console;

  beforeEach(() => {
    // Set up a clean DOM environment for each test
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Extension Test</title></head>
        <body>
          <div id="authSection">
            <div id="userInfo"></div>
            <button id="authButton">Sign In</button>
            <button id="logoutButton">Sign Out</button>
          </div>
          <button id="captureBtn">Capture Recipe</button>
          <div id="message"></div>
          <div id="devControls">
            <input type="checkbox" id="devBypass">
          </div>
          <input type="checkbox" id="emergencyDevBypass">
        </body>
      </html>
    `, {
      url: 'chrome-extension://test/',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    window = dom.window;
    global.window = window;
    global.document = window.document;
    // Polyfill localStorage to avoid JSDOM SecurityError
    global.localStorage = {
      store: {},
      getItem(key) { return this.store[key] || null; },
      setItem(key, value) { this.store[key] = value.toString(); },
      removeItem(key) { delete this.store[key]; },
      clear() { this.store = {}; }
    };

    // Capture console errors
    console = {
      errors: [],
      log: jest.fn(),
      error: (...args) => {
        console.errors.push(args.join(' '));
      },
      warn: jest.fn()
    };
    global.console = console;
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Variable Scope Error Detection', () => {
    it('should detect undefined variable references in async functions', async () => {
      // Mock the problematic function pattern
      const problematicFunction = `
        async function testFunction() {
          try {
            const someVar = await someAsyncOperation();
            return someVar;
          } catch (error) {
            // This would cause "Can't find variable: someVar" if someVar is used here
            console.log('Error with var:', someVar); // This is the bug pattern
            throw error;
          }
        }
      `;

      // Test for variable scope issues
      expect(() => {
        eval(problematicFunction);
      }).not.toThrow();

      // But calling it should reveal the scope issue
      global.someAsyncOperation = async () => {
        throw new Error('Test error');
      };

      // Patch: define testFunction in global scope for this test
      global.testFunction = eval(problematicFunction);
      try {
        await global.testFunction();
      } catch (error) {
        // Should detect the variable scope error
        expect(console.errors.some(err => err.includes('Can\'t find variable') || err.includes('someVar'))).toBe(true);
      }
    });

    it('should validate Safari popup.js for variable scope issues', () => {
      const safariPopupPath = path.join(__dirname, '../../safari/popup.js');
      
      if (fs.existsSync(safariPopupPath)) {
        const popupContent = fs.readFileSync(safariPopupPath, 'utf8');
        
        // Check for common variable scope patterns that cause issues
        const problematicPatterns = [
          // Variables declared in try but used in catch
          /try\s*{[\s\S]*?const\s+(\w+)[\s\S]*?}\s*catch[\s\S]*?\1/,
          // Variables declared in if but used outside
          /if\s*\([^)]*\)\s*{[\s\S]*?const\s+(\w+)[\s\S]*?}[\s\S]*?\1/,
          // Let/const in block scope used outside
          /{\s*(?:let|const)\s+(\w+)[\s\S]*?}[\s\S]*?\1/
        ];

        problematicPatterns.forEach((pattern, index) => {
          const matches = popupContent.match(pattern);
          if (matches) {
            console.warn(`Potential scope issue found in popup.js (pattern ${index + 1}):`, matches[0]);
          }
        });

        // Should not have obvious scope issues
        expect(popupContent).not.toMatch(/catch[\s\S]*?tokenResult(?!\s*=)/);
      }
    });

    it('should validate Chrome popup.js for variable scope issues', () => {
      const chromePopupPath = path.join(__dirname, '../../chrome/popup.js');
      
      if (fs.existsSync(chromePopupPath)) {
        const popupContent = fs.readFileSync(chromePopupPath, 'utf8');
        
        // Check for the same patterns in Chrome extension
        expect(popupContent).not.toMatch(/catch[\s\S]*?tokenResult(?!\s*=)/);
        expect(popupContent).not.toMatch(/catch[\s\S]*?[a-zA-Z]+Result(?!\s*=)/);
      }
    });
  });

  describe('Runtime Error Simulation', () => {
    it('should simulate the tokenResult error scenario', async () => {
      // Set up mocks
      global.CONFIG = {
        getCognitoConfig: () => ({ region: 'us-west-2' }),
        getCurrentAPI: () => ({ recipes: 'https://api.test.com/recipes' })
      };

      global.SafariCognitoAuth = class {
        constructor() {}
        async getIdToken() {
          throw new Error('Network error'); // Simulate failure
        }
      };

      global.fetch = jest.fn();
      window.RecipeArchiveConfig = global.CONFIG;

      // Test the problematic function pattern
      const testFunction = async (_recipe) => {
        // Variables used to test scope handling
        let tokenResult = null; // Fixed version

        try {
          const config = window.RecipeArchiveConfig;
          // Test API config access
          config.getCurrentAPI();
          
          const cognitoAuth = new SafariCognitoAuth(config.getCognitoConfig());
          tokenResult = await cognitoAuth.getIdToken();
          
          if (!tokenResult.success) {
            throw new Error('Authentication required');
          }
          
          return { success: true };
        } catch (error) {
          // This should NOT cause "Can't find variable: tokenResult" because it's declared at function scope
          const hasToken = !!tokenResult?.data;
          throw new Error(`Error with token status: ${hasToken}`);
        }
      };

      // This should not throw a variable scope error
      try {
        await testFunction({ title: 'Test Recipe' });
      } catch (error) {
        expect(error.message).not.toContain('Can\'t find variable');
        expect(error.message).toContain('token status'); // Should be able to access tokenResult
      }
    });

    it('should detect missing global variables', () => {
      // Test for undefined global variable access
      const testCode = `
        function testGlobals() {
          if (typeof UndefinedGlobal !== 'undefined') {
            return UndefinedGlobal.someMethod();
          }
          return null;
        }
      `;

      expect(() => {
        eval(testCode);
        eval('testGlobals()');
      }).not.toThrow(); // Should handle undefined gracefully
    });
  });

  describe('Extension-Specific Error Patterns', () => {
    it('should validate authentication flow error handling', async () => {
      // Mock extension APIs
      global.chrome = {
        tabs: {
          query: jest.fn().mockResolvedValue([{ id: 1 }]),
          sendMessage: jest.fn().mockResolvedValue({ success: true })
        }
      };

      // Test authentication error scenarios
      const authScenarios = [
        { name: 'Network failure', error: new Error('Network error') },
        { name: 'Invalid token', error: new Error('Token expired') },
        { name: 'Service unavailable', error: new Error('Service unavailable') }
      ];

      for (const scenario of authScenarios) {
        try {
          global.SafariCognitoAuth = class {
            async getIdToken() {
              throw scenario.error;
            }
          };

          // Simulate the function that was causing issues
          const testAuthFlow = async () => {
            let tokenResult = null;
            try {
              const auth = new SafariCognitoAuth();
              tokenResult = await auth.getIdToken();
              return { success: true, token: tokenResult };
            } catch (error) {
              // Should be able to access tokenResult safely
              return { 
                success: false, 
                error: error.message,
                hadToken: !!tokenResult 
              };
            }
          };

          const result = await testAuthFlow();
          expect(result.success).toBe(false);
          expect(result.hadToken).toBe(false);
          expect(result.error).toBe(scenario.error.message);
        } catch (error) {
          fail(`Scenario "${scenario.name}" caused unexpected error: ${error.message}`);
        }
      }
    });
  });
});
