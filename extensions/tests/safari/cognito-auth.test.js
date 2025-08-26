// Safari Extension Cognito Authentication Tests
// Tests the SafariCognitoAuth class functionality

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const { JSDOM } = require('jsdom');

// Mock AWS Cognito SDK
const mockCognitoIdentityServiceProvider = {
  signUp: jest.fn(),
  confirmSignUp: jest.fn(),
  initiateAuth: jest.fn(),
  globalSignOut: jest.fn()
};

const mockAWS = {
  config: {
    update: jest.fn()
  },
  CognitoIdentityServiceProvider: jest.fn(() => mockCognitoIdentityServiceProvider)
};

// Mock global AWS
global.AWS = mockAWS;

describe('Safari Extension Cognito Authentication', () => {
  let dom;
  let window;
  let localStorage;
  let SafariCognitoAuth;

  beforeEach(() => {
    // Set up DOM environment
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
    
    // Clear localStorage and mocks
    localStorage.clear();
    jest.clearAllMocks();
    
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
            UserAttributes: [
              {
                Name: 'email',
                Value: email
              }
            ]
          };

          const result = await this.cognito.signUp(params).promise();
          return {
            success: true,
            userSub: result.UserSub,
            needsConfirmation: !result.UserConfirmed
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }

      async signIn(email, password) {
        try {
          const params = {
            ClientId: this.cognitoConfig.clientId,
            AuthFlow: 'USER_PASSWORD_AUTH',
            AuthParameters: {
              USERNAME: email,
              PASSWORD: password
            }
          };

          const result = await this.cognito.initiateAuth(params).promise();
          
          if (result.AuthenticationResult) {
            this.accessToken = result.AuthenticationResult.AccessToken;
            this.currentUser = email;
            
            // Store session
            localStorage.setItem('recipeArchive.accessToken', this.accessToken);
            localStorage.setItem('recipeArchive.user', email);
            
            return {
              success: true,
              user: email,
              accessToken: this.accessToken
            };
          } else {
            return {
              success: false,
              error: 'Authentication failed'
            };
          }
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }

      async signOut() {
        try {
          if (this.accessToken) {
            await this.cognito.globalSignOut({
              AccessToken: this.accessToken
            }).promise();
          }
          
          // Clear local session
          this.currentUser = null;
          this.accessToken = null;
          localStorage.removeItem('recipeArchive.accessToken');
          localStorage.removeItem('recipeArchive.user');
          
          return { success: true };
        } catch (error) {
          // Clear local session even if remote signout fails
          this.currentUser = null;
          this.accessToken = null;
          localStorage.removeItem('recipeArchive.accessToken');
          localStorage.removeItem('recipeArchive.user');
          
          return {
            success: true,
            warning: 'Local session cleared, remote signout may have failed'
          };
        }
      }

      isAuthenticated() {
        return !!(this.accessToken || localStorage.getItem('recipeArchive.accessToken'));
      }

      getCurrentUser() {
        return this.currentUser || localStorage.getItem('recipeArchive.user');
      }

      restoreSession() {
        try {
          const savedToken = localStorage.getItem('recipeArchive.accessToken');
          const savedUser = localStorage.getItem('recipeArchive.user');
          
          if (savedToken && savedUser) {
            this.accessToken = savedToken;
            this.currentUser = savedUser;
            return true;
          }
          
          return false;
        } catch (error) {
          console.warn('Could not restore session:', error);
          return false;
        }
      }
    };
  });

  afterEach(() => {
    dom.window.close();
    delete global.window;
    delete global.localStorage;
    delete global.CONFIG;
  });

  describe('SafariCognitoAuth Initialization', () => {
    it('should initialize with CONFIG', () => {
      expect(() => {
        const auth = new SafariCognitoAuth();
        expect(auth.cognitoConfig).toBeTruthy();
        expect(auth.cognitoConfig.region).toBe('us-west-2');
        expect(auth.cognitoConfig.userPoolId).toBe('us-west-2_qJ1i9RhxD');
        expect(auth.cognitoConfig.clientId).toBe('5grdn7qhf1el0ioqb6hkelr29s');
      }).not.toThrow();
    });

    it('should configure AWS SDK correctly', () => {
      const auth = new SafariCognitoAuth();
      expect(mockAWS.CognitoIdentityServiceProvider).toHaveBeenCalledWith({
        region: 'us-west-2'
      });
    });

    it('should start with no authenticated user', () => {
      const auth = new SafariCognitoAuth();
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.getCurrentUser()).toBeNull();
    });
  });

  describe('User Registration', () => {
    it('should handle successful registration', async () => {
      const auth = new SafariCognitoAuth();
      
      mockCognitoIdentityServiceProvider.signUp.mockReturnValue({
        promise: () => Promise.resolve({
          UserSub: 'test-user-sub',
          UserConfirmed: false
        })
      });

      const result = await auth.signUp('test@example.com', 'TestPassword123!');
      
      expect(result.success).toBe(true);
      expect(result.userSub).toBe('test-user-sub');
      expect(result.needsConfirmation).toBe(true);
      
      expect(mockCognitoIdentityServiceProvider.signUp).toHaveBeenCalledWith({
        ClientId: '5grdn7qhf1el0ioqb6hkelr29s',
        Username: 'test@example.com',
        Password: 'TestPassword123!',
        UserAttributes: [
          {
            Name: 'email',
            Value: 'test@example.com'
          }
        ]
      });
    });

    it('should handle registration errors', async () => {
      const auth = new SafariCognitoAuth();
      
      mockCognitoIdentityServiceProvider.signUp.mockReturnValue({
        promise: () => Promise.reject(new Error('User already exists'))
      });

      const result = await auth.signUp('test@example.com', 'TestPassword123!');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('User already exists');
    });
  });

  describe('User Authentication', () => {
    it('should handle successful sign in', async () => {
      const auth = new SafariCognitoAuth();
      
      mockCognitoIdentityServiceProvider.initiateAuth.mockReturnValue({
        promise: () => Promise.resolve({
          AuthenticationResult: {
            AccessToken: 'test-access-token',
            RefreshToken: 'test-refresh-token'
          }
        })
      });

      const result = await auth.signIn('test@example.com', 'TestPassword123!');
      
      expect(result.success).toBe(true);
      expect(result.user).toBe('test@example.com');
      expect(result.accessToken).toBe('test-access-token');
      
      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.getCurrentUser()).toBe('test@example.com');
      
      // Check localStorage
      expect(localStorage.getItem('recipeArchive.accessToken')).toBe('test-access-token');
      expect(localStorage.getItem('recipeArchive.user')).toBe('test@example.com');
    });

    it('should handle sign in errors', async () => {
      const auth = new SafariCognitoAuth();
      
      mockCognitoIdentityServiceProvider.initiateAuth.mockReturnValue({
        promise: () => Promise.reject(new Error('Incorrect username or password'))
      });

      const result = await auth.signIn('test@example.com', 'WrongPassword');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Incorrect username or password');
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('should handle incomplete authentication result', async () => {
      const auth = new SafariCognitoAuth();
      
      mockCognitoIdentityServiceProvider.initiateAuth.mockReturnValue({
        promise: () => Promise.resolve({
          // Missing AuthenticationResult
        })
      });

      const result = await auth.signIn('test@example.com', 'TestPassword123!');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
    });
  });

  describe('Session Management', () => {
    it('should restore session from localStorage', () => {
      localStorage.setItem('recipeArchive.accessToken', 'saved-token');
      localStorage.setItem('recipeArchive.user', 'saved@example.com');
      
      const auth = new SafariCognitoAuth();
      const restored = auth.restoreSession();
      
      expect(restored).toBe(true);
      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.getCurrentUser()).toBe('saved@example.com');
      expect(auth.accessToken).toBe('saved-token');
    });

    it('should handle missing session data', () => {
      const auth = new SafariCognitoAuth();
      const restored = auth.restoreSession();
      
      expect(restored).toBe(false);
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.getCurrentUser()).toBeNull();
    });

    it('should handle localStorage errors during restore', () => {
      // Mock localStorage to throw
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = jest.fn().mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });
      
      const auth = new SafariCognitoAuth();
      const restored = auth.restoreSession();
      
      expect(restored).toBe(false);
      
      // Restore original function
      localStorage.getItem = originalGetItem;
    });
  });

  describe('User Sign Out', () => {
    it('should handle successful sign out', async () => {
      const auth = new SafariCognitoAuth();
      
      // Set up authenticated state
      auth.accessToken = 'test-token';
      auth.currentUser = 'test@example.com';
      localStorage.setItem('recipeArchive.accessToken', 'test-token');
      localStorage.setItem('recipeArchive.user', 'test@example.com');
      
      mockCognitoIdentityServiceProvider.globalSignOut.mockReturnValue({
        promise: () => Promise.resolve({})
      });

      const result = await auth.signOut();
      
      expect(result.success).toBe(true);
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.getCurrentUser()).toBeNull();
      expect(localStorage.getItem('recipeArchive.accessToken')).toBeNull();
      expect(localStorage.getItem('recipeArchive.user')).toBeNull();
    });

    it('should handle sign out errors gracefully', async () => {
      const auth = new SafariCognitoAuth();
      
      // Set up authenticated state
      auth.accessToken = 'test-token';
      auth.currentUser = 'test@example.com';
      localStorage.setItem('recipeArchive.accessToken', 'test-token');
      localStorage.setItem('recipeArchive.user', 'test@example.com');
      
      mockCognitoIdentityServiceProvider.globalSignOut.mockReturnValue({
        promise: () => Promise.reject(new Error('Network error'))
      });

      const result = await auth.signOut();
      
      expect(result.success).toBe(true);
      expect(result.warning).toContain('Local session cleared');
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.getCurrentUser()).toBeNull();
    });

    it('should sign out when no token present', async () => {
      const auth = new SafariCognitoAuth();
      
      const result = await auth.signOut();
      
      expect(result.success).toBe(true);
      expect(mockCognitoIdentityServiceProvider.globalSignOut).not.toHaveBeenCalled();
    });
  });

  describe('Authentication State', () => {
    it('should correctly identify authenticated state', () => {
      const auth = new SafariCognitoAuth();
      
      // Not authenticated initially
      expect(auth.isAuthenticated()).toBe(false);
      
      // Authenticated with token
      auth.accessToken = 'test-token';
      expect(auth.isAuthenticated()).toBe(true);
      
      // Authenticated with localStorage only
      auth.accessToken = null;
      localStorage.setItem('recipeArchive.accessToken', 'stored-token');
      expect(auth.isAuthenticated()).toBe(true);
      
      // Not authenticated when cleared
      localStorage.removeItem('recipeArchive.accessToken');
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('should get current user from memory or localStorage', () => {
      const auth = new SafariCognitoAuth();
      
      // No user initially
      expect(auth.getCurrentUser()).toBeNull();
      
      // User from memory
      auth.currentUser = 'memory@example.com';
      expect(auth.getCurrentUser()).toBe('memory@example.com');
      
      // User from localStorage when memory cleared
      auth.currentUser = null;
      localStorage.setItem('recipeArchive.user', 'stored@example.com');
      expect(auth.getCurrentUser()).toBe('stored@example.com');
    });
  });
});
