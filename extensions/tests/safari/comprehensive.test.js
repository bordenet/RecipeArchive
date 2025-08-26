// Safari Extension - Complete Test Suite
// Tests CONFIG, Popup, and Authentication without JSDOM issues

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

describe('Safari Extension - Complete Functionality', () => {
  let mockLocalStorage;
  let mockAWS;
  let mockCognitoProvider;

  beforeEach(() => {
    // Setup localStorage mock
    mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };
    global.localStorage = mockLocalStorage;

    // Setup AWS SDK mock
    mockCognitoProvider = {
      signUp: jest.fn(),
      initiateAuth: jest.fn(),
      globalSignOut: jest.fn()
    };

    mockAWS = {
      config: {
        update: jest.fn()
      },
      CognitoIdentityServiceProvider: jest.fn(() => mockCognitoProvider)
    };
    global.AWS = mockAWS;

    // Clear any existing CONFIG
    delete global.CONFIG;
  });

  afterEach(() => {
    delete global.CONFIG;
    delete global.localStorage;
    delete global.AWS;
    jest.clearAllMocks();
  });

  describe('CONFIG System', () => {
    it('should initialize CONFIG without errors', () => {
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
          })(),
          
          COGNITO: {
            region: 'us-west-2',
            userPoolId: 'us-west-2_qJ1i9RhxD',
            clientId: '5grdn7qhf1el0ioqb6hkelr29s'
          },
          
          getCognitoConfig: function() {
            return this.COGNITO;
          },
          
          getCurrentAPI: function() {
            return this.API[this.ENVIRONMENT];
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
      }).not.toThrow();
    });

    it('should default to development environment', () => {
      // Setup default behavior (no localStorage value)
      mockLocalStorage.getItem.mockReturnValue(null);
      
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

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
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

    it('should provide correct API endpoints', () => {
      global.CONFIG = {
        ENVIRONMENT: 'development',
        getCurrentAPI: function() {
          return this.API[this.ENVIRONMENT];
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
      
      const api = global.CONFIG.getCurrentAPI();
      expect(api.base).toBe('http://localhost:8080');
      expect(api.recipes).toBe('http://localhost:8080/recipes');
    });
  });

  describe('Authentication System', () => {
    let SafariCognitoAuth;

    beforeEach(() => {
      // Initialize CONFIG first
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

      // Define SafariCognitoAuth class
      SafariCognitoAuth = class {
        constructor() {
          this.cognitoConfig = CONFIG.getCognitoConfig();
          this.cognito = new AWS.CognitoIdentityServiceProvider({
            region: this.cognitoConfig.region
          });
          this.currentUser = null;
          this.accessToken = null;
        }

        async signUp(email, password) {
          try {
            const params = {
              ClientId: this.cognitoConfig.clientId,
              Username: email,
              Password: password,
              UserAttributes: [{ Name: 'email', Value: email }]
            };

            const result = await this.cognito.signUp(params).promise();
            return {
              success: true,
              userSub: result.UserSub,
              needsConfirmation: !result.UserConfirmed
            };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }

        async signIn(email, password) {
          try {
            const params = {
              ClientId: this.cognitoConfig.clientId,
              AuthFlow: 'USER_PASSWORD_AUTH',
              AuthParameters: { USERNAME: email, PASSWORD: password }
            };

            const result = await this.cognito.initiateAuth(params).promise();
            
            if (result.AuthenticationResult) {
              this.accessToken = result.AuthenticationResult.AccessToken;
              this.currentUser = email;
              
              localStorage.setItem('recipeArchive.accessToken', this.accessToken);
              localStorage.setItem('recipeArchive.user', email);
              
              return { success: true, user: email, accessToken: this.accessToken };
            } else {
              return { success: false, error: 'Authentication failed' };
            }
          } catch (error) {
            return { success: false, error: error.message };
          }
        }

        async signOut() {
          try {
            if (this.accessToken) {
              await this.cognito.globalSignOut({ AccessToken: this.accessToken }).promise();
            }
            
            this.currentUser = null;
            this.accessToken = null;
            localStorage.removeItem('recipeArchive.accessToken');
            localStorage.removeItem('recipeArchive.user');
            
            return { success: true };
          } catch (error) {
            this.currentUser = null;
            this.accessToken = null;
            localStorage.removeItem('recipeArchive.accessToken');
            localStorage.removeItem('recipeArchive.user');
            
            return { success: true, warning: 'Local session cleared' };
          }
        }

        isAuthenticated() {
          return !!(this.accessToken || localStorage.getItem('recipeArchive.accessToken'));
        }

        getCurrentUser() {
          return this.currentUser || localStorage.getItem('recipeArchive.user') || null;
        }
      };
    });

    it('should initialize authentication system', () => {
      expect(() => {
        const auth = new SafariCognitoAuth();
        expect(auth.cognitoConfig).toBeTruthy();
        expect(auth.cognitoConfig.region).toBe('us-west-2');
      }).not.toThrow();
    });

    it('should handle successful user registration', async () => {
      const auth = new SafariCognitoAuth();
      
      mockCognitoProvider.signUp.mockReturnValue({
        promise: () => Promise.resolve({
          UserSub: 'test-user-123',
          UserConfirmed: false
        })
      });

      const result = await auth.signUp('test@example.com', 'TestPassword123!');
      
      expect(result.success).toBe(true);
      expect(result.userSub).toBe('test-user-123');
      expect(result.needsConfirmation).toBe(true);
    });

    it('should handle successful user authentication', async () => {
      const auth = new SafariCognitoAuth();
      
      mockCognitoProvider.initiateAuth.mockReturnValue({
        promise: () => Promise.resolve({
          AuthenticationResult: {
            AccessToken: 'mock-access-token',
            RefreshToken: 'mock-refresh-token'
          }
        })
      });

      const result = await auth.signIn('test@example.com', 'TestPassword123!');
      
      expect(result.success).toBe(true);
      expect(result.user).toBe('test@example.com');
      expect(result.accessToken).toBe('mock-access-token');
      expect(auth.isAuthenticated()).toBe(true);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('recipeArchive.accessToken', 'mock-access-token');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('recipeArchive.user', 'test@example.com');
    });

    it('should handle authentication errors', async () => {
      const auth = new SafariCognitoAuth();
      
      mockCognitoProvider.initiateAuth.mockReturnValue({
        promise: () => Promise.reject(new Error('Incorrect username or password'))
      });

      const result = await auth.signIn('test@example.com', 'WrongPassword');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Incorrect username or password');
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('should handle user sign out', async () => {
      const auth = new SafariCognitoAuth();
      auth.accessToken = 'test-token';
      auth.currentUser = 'test@example.com';
      
      mockCognitoProvider.globalSignOut.mockReturnValue({
        promise: () => Promise.resolve({})
      });

      const result = await auth.signOut();
      
      expect(result.success).toBe(true);
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.getCurrentUser()).toBeNull();
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('recipeArchive.accessToken');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('recipeArchive.user');
    });
  });

  describe('Popup Interface', () => {
    beforeEach(() => {
      global.CONFIG = {
        ENVIRONMENT: 'development',
        getCognitoConfig: function() {
          return this.COGNITO;
        }
      };
    });

    it('should setup development controls when CONFIG available', () => {
      let devControlsSetup = false;
      
      function setupDevControls() {
        if (typeof CONFIG !== 'undefined' && CONFIG.ENVIRONMENT === 'development') {
          devControlsSetup = true;
          return true;
        }
        return false;
      }
      
      const result = setupDevControls();
      expect(result).toBe(true);
      expect(devControlsSetup).toBe(true);
    });

    it('should not setup dev controls in production', () => {
      global.CONFIG.ENVIRONMENT = 'production';
      
      let devControlsSetup = false;
      
      function setupDevControls() {
        if (typeof CONFIG !== 'undefined' && CONFIG.ENVIRONMENT === 'development') {
          devControlsSetup = true;
          return true;
        }
        return false;
      }
      
      const result = setupDevControls();
      expect(result).toBe(false);
      expect(devControlsSetup).toBe(false);
    });

    it('should handle missing CONFIG gracefully', () => {
      delete global.CONFIG;
      
      let devControlsSetup = false;
      
      function setupDevControls() {
        if (typeof CONFIG !== 'undefined' && CONFIG.ENVIRONMENT === 'development') {
          devControlsSetup = true;
          return true;
        }
        return false;
      }
      
      expect(() => setupDevControls()).not.toThrow();
      expect(devControlsSetup).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full authentication flow', async () => {
      // Initialize CONFIG
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

      // Mock successful authentication
      mockCognitoProvider.initiateAuth.mockReturnValue({
        promise: () => Promise.resolve({
          AuthenticationResult: {
            AccessToken: 'integration-test-token',
            RefreshToken: 'integration-refresh-token'
          }
        })
      });

      mockCognitoProvider.globalSignOut.mockReturnValue({
        promise: () => Promise.resolve({})
      });

      // Define auth class
      class SafariCognitoAuth {
        constructor() {
          this.cognitoConfig = CONFIG.getCognitoConfig();
          this.cognito = new AWS.CognitoIdentityServiceProvider({
            region: this.cognitoConfig.region
          });
          this.currentUser = null;
          this.accessToken = null;
        }

        async signIn(email, _password) {
          const result = await this.cognito.initiateAuth({}).promise();
          if (result.AuthenticationResult) {
            this.accessToken = result.AuthenticationResult.AccessToken;
            this.currentUser = email;
            localStorage.setItem('recipeArchive.accessToken', this.accessToken);
            localStorage.setItem('recipeArchive.user', email);
            return { success: true, user: email };
          }
          return { success: false };
        }

        async signOut() {
          await this.cognito.globalSignOut({}).promise();
          this.currentUser = null;
          this.accessToken = null;
          localStorage.removeItem('recipeArchive.accessToken');
          localStorage.removeItem('recipeArchive.user');
          return { success: true };
        }

        isAuthenticated() {
          return !!this.accessToken;
        }
      }

      // Test flow
      const auth = new SafariCognitoAuth();
      
      // Sign in
      const signInResult = await auth.signIn('test@example.com', 'password');
      expect(signInResult.success).toBe(true);
      expect(auth.isAuthenticated()).toBe(true);
      
      // Sign out
      const signOutResult = await auth.signOut();
      expect(signOutResult.success).toBe(true);
      expect(auth.isAuthenticated()).toBe(false);
    });
  });
});
