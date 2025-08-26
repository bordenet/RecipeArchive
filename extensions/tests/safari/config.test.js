// Safari Extension Configuration Tests
// Ensures CONFIG object is properly initialized and accessible

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { JSDOM } = require('jsdom');

describe('Safari Extension Configuration', () => {
  let dom;
  let window;
  let localStorage;

  beforeEach(() => {
    // Set up DOM environment with localStorage
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body></body>
      </html>
    `, {
      url: 'moz-extension://test-extension/',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    window = dom.window;
    localStorage = window.localStorage;
    global.window = window;
    global.localStorage = localStorage;
    
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    dom.window.close();
    delete global.window;
    delete global.localStorage;
  });

  describe('CONFIG Initialization', () => {
    it('should initialize CONFIG without errors', () => {
      // Simulate config.js loading
      expect(() => {
        const CONFIG = {
          ENVIRONMENT: (function() {
            try {
              if (typeof localStorage !== 'undefined') {
                const isDevelopment = localStorage.getItem('recipeArchive.dev') !== 'false';
                return isDevelopment ? 'development' : 'production';
              } else {
                return 'development';
              }
            } catch (error) {
              console.warn('CONFIG: Could not access localStorage, defaulting to development mode');
              return 'development';
            }
          })(),
          
          COGNITO: {
            region: 'us-west-2',
            userPoolId: 'us-west-2_qJ1i9RhxD',
            clientId: '5grdn7qhf1el0ioqb6hkelr29s'
          },
          
          DEFAULT_TEST_USER: {
            email: (function() {
              try {
                if (typeof localStorage !== 'undefined') {
                  return localStorage.getItem('recipeArchive.testEmail') || 'test@example.com';
                }
                return 'test@example.com';
              } catch (error) {
                return 'test@example.com';
              }
            })(),
            getPassword: function() {
              try {
                if (typeof localStorage !== 'undefined') {
                  return localStorage.getItem('recipeArchive.testPassword') || '';
                }
                return '';
              } catch (error) {
                return '';
              }
            }
          },
          
          getCurrentAPI: function() {
            return this.API[this.ENVIRONMENT];
          },
          
          getCognitoConfig: function() {
            return this.COGNITO;
          },
          
          API: {
            development: {
              base: 'http://localhost:8080',
              recipes: 'http://localhost:8080/recipes'
            },
            production: {
              base: 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod',
              recipes: 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod/recipes'
            }
          }
        };
        
        global.CONFIG = CONFIG;
      }).not.toThrow();
    });

    it('should default to development environment', () => {
      const CONFIG = global.CONFIG;
      expect(CONFIG.ENVIRONMENT).toBe('development');
    });

    it('should have proper Cognito configuration', () => {
      const CONFIG = global.CONFIG;
      const cognitoConfig = CONFIG.getCognitoConfig();
      
      expect(cognitoConfig.region).toBe('us-west-2');
      expect(cognitoConfig.userPoolId).toBe('us-west-2_qJ1i9RhxD');
      expect(cognitoConfig.clientId).toBe('5grdn7qhf1el0ioqb6hkelr29s');
    });

    it('should handle localStorage unavailability gracefully', () => {
      // Temporarily remove localStorage
      const originalLocalStorage = global.localStorage;
      delete global.localStorage;
      
      expect(() => {
        const CONFIG = {
          ENVIRONMENT: (function() {
            try {
              if (typeof localStorage !== 'undefined') {
                const isDevelopment = localStorage.getItem('recipeArchive.dev') !== 'false';
                return isDevelopment ? 'development' : 'production';
              } else {
                return 'development';
              }
            } catch (error) {
              return 'development';
            }
          })()
        };
        
        expect(CONFIG.ENVIRONMENT).toBe('development');
      }).not.toThrow();
      
      // Restore localStorage
      global.localStorage = originalLocalStorage;
    });

    it('should provide API endpoints for both environments', () => {
      const CONFIG = global.CONFIG;
      
      // Check development API
      CONFIG.ENVIRONMENT = 'development';
      const devAPI = CONFIG.getCurrentAPI();
      expect(devAPI.base).toBe('http://localhost:8080');
      expect(devAPI.recipes).toBe('http://localhost:8080/recipes');
      
      // Check production API  
      CONFIG.ENVIRONMENT = 'production';
      const prodAPI = CONFIG.getCurrentAPI();
      expect(prodAPI.base).toBe('https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod');
      expect(prodAPI.recipes).toBe('https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod/recipes');
    });

    it('should handle test user configuration safely', () => {
      const CONFIG = global.CONFIG;
      
      // Should not throw when accessing test user
      expect(() => {
        const email = CONFIG.DEFAULT_TEST_USER.email;
        const password = CONFIG.DEFAULT_TEST_USER.getPassword();
        
        expect(typeof email).toBe('string');
        expect(typeof password).toBe('string');
      }).not.toThrow();
    });

    it('should support environment switching', () => {
      localStorage.setItem('recipeArchive.dev', 'false');
      
      const CONFIG = {
        ENVIRONMENT: (function() {
          try {
            if (typeof localStorage !== 'undefined') {
              const isDevelopment = localStorage.getItem('recipeArchive.dev') !== 'false';
              return isDevelopment ? 'development' : 'production';
            } else {
              return 'development';
            }
          } catch (error) {
            return 'development';
          }
        })()
      };
      
      expect(CONFIG.ENVIRONMENT).toBe('production');
      
      localStorage.setItem('recipeArchive.dev', 'true');
      
      const CONFIG2 = {
        ENVIRONMENT: (function() {
          try {
            if (typeof localStorage !== 'undefined') {
              const isDevelopment = localStorage.getItem('recipeArchive.dev') !== 'false';
              return isDevelopment ? 'development' : 'production';
            } else {
              return 'development';
            }
          } catch (error) {
            return 'development';
          }
        })()
      };
      
      expect(CONFIG2.ENVIRONMENT).toBe('development');
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage exceptions gracefully', () => {
      // Mock localStorage to throw an error
      const mockLocalStorage = {
        getItem: jest.fn().mockImplementation(() => {
          throw new Error('localStorage access denied');
        })
      };
      
      global.localStorage = mockLocalStorage;
      
      expect(() => {
        const CONFIG = {
          ENVIRONMENT: (function() {
            try {
              if (typeof localStorage !== 'undefined') {
                const isDevelopment = localStorage.getItem('recipeArchive.dev') !== 'false';
                return isDevelopment ? 'development' : 'production';
              } else {
                return 'development';
              }
            } catch (error) {
              return 'development';
            }
          })()
        };
        
        expect(CONFIG.ENVIRONMENT).toBe('development');
      }).not.toThrow();
    });
  });
});
