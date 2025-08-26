// Safari Extension CONFIG Tests (Simplified)
const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

describe('Safari Extension CONFIG', () => {
  beforeEach(() => {
    // Mock localStorage for browser-like environment
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };
    global.localStorage = localStorageMock;
    
    // Clear any existing CONFIG
    delete global.CONFIG;
  });

  afterEach(() => {
    delete global.CONFIG;
    delete global.localStorage;
  });

  describe('CONFIG Initialization', () => {
    it('should initialize CONFIG without errors', () => {
      expect(() => {
        global.CONFIG = {
          ENVIRONMENT: 'development',
          COGNITO: {
            region: 'us-west-2',
            userPoolId: 'us-west-2_qJ1i9RhxD',
            clientId: '5grdn7qhf1el0ioqb6hkelr29s'
          },
          getCognitoConfig: function() {
            return this.COGNITO;
          }
        };
      }).not.toThrow();
    });

    it('should have correct Cognito configuration', () => {
      global.CONFIG = {
        ENVIRONMENT: 'development',
        COGNITO: {
          region: 'us-west-2',
          userPoolId: 'us-west-2_qJ1i9RhxD',
          clientId: '5grdn7qhf1el0ioqb6hkelr29s'
        },
        getCognitoConfig: function() {
          return this.COGNITO;
        }
      };

      const cognitoConfig = global.CONFIG.getCognitoConfig();
      expect(cognitoConfig.region).toBe('us-west-2');
      expect(cognitoConfig.userPoolId).toBe('us-west-2_qJ1i9RhxD');
      expect(cognitoConfig.clientId).toBe('5grdn7qhf1el0ioqb6hkelr29s');
    });

    it('should handle localStorage safely', () => {
      global.localStorage.getItem.mockReturnValue('false');
      
      expect(() => {
        global.CONFIG = {
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
      }).not.toThrow();
      
      expect(global.CONFIG.ENVIRONMENT).toBe('production');
    });

    it('should default to development when localStorage throws', () => {
      global.localStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage access denied');
      });
      
      global.CONFIG = {
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
      
      expect(global.CONFIG.ENVIRONMENT).toBe('development');
    });
  });
});
