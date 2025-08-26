// Safari Extension AWS Cognito Authentication Tests
// Comprehensive test suite for the authentication system

const { describe, it, expect, beforeEach, jest } = require('@jest/globals');

// Mock browser extension API
global.browser = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  }
};

// Mock fetch for AWS Cognito API calls
global.fetch = jest.fn();

// Import the authentication class
const { SafariCognitoAuth } = require('./cognito-auth.js');

describe('Safari Cognito Authentication', () => {
  let cognitoAuth;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      region: 'us-west-2',
      userPoolId: 'us-west-2_qJ1i9RhxD',
      clientId: '5grdn7qhf1el0ioqb6hkelr29s'
    };
    
    cognitoAuth = new SafariCognitoAuth(mockConfig);
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Default storage mock responses
    browser.storage.local.get.mockResolvedValue({});
    browser.storage.local.set.mockResolvedValue();
    browser.storage.local.remove.mockResolvedValue();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(cognitoAuth.region).toBe('us-west-2');
      expect(cognitoAuth.userPoolId).toBe('us-west-2_qJ1i9RhxD');
      expect(cognitoAuth.clientId).toBe('5grdn7qhf1el0ioqb6hkelr29s');
    });

    it('should set correct AWS Cognito endpoint', () => {
      expect(cognitoAuth.baseUrl).toBe('https://cognito-idp.us-west-2.amazonaws.com/');
    });
  });

  describe('Sign Up', () => {
    it('should successfully sign up a new user', async () => {
      const mockResponse = {
        UserSub: 'test-user-id',
        CodeDeliveryDetails: {
          Destination: 'test@example.com',
          DeliveryMedium: 'EMAIL'
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await cognitoAuth.signUp('test@example.com', 'TestPass123!');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        'https://cognito-idp.us-west-2.amazonaws.com/',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp'
          })
        })
      );
    });

    it('should handle sign up errors', async () => {
      const mockError = {
        __type: 'UsernameExistsException',
        message: 'An account with the given email already exists.'
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockError)
      });

      const result = await cognitoAuth.signUp('existing@example.com', 'TestPass123!');

      expect(result.success).toBe(false);
      expect(result.error).toContain('UsernameExistsException');
    });
  });

  describe('Sign In', () => {
    it('should successfully sign in with valid credentials', async () => {
      const mockResponse = {
        AuthenticationResult: {
          AccessToken: 'mock-access-token',
          IdToken: 'mock-id-token',
          RefreshToken: 'mock-refresh-token',
          ExpiresIn: 3600
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await cognitoAuth.signIn('test@example.com', 'TestPass123!');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      
      // Verify tokens are stored
      expect(browser.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'cognito_access_token': 'mock-access-token',
          'cognito_id_token': 'mock-id-token',
          'cognito_refresh_token': 'mock-refresh-token'
        })
      );
    });

    it('should handle invalid credentials', async () => {
      const mockError = {
        __type: 'NotAuthorizedException',
        message: 'Incorrect username or password.'
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockError)
      });

      const result = await cognitoAuth.signIn('test@example.com', 'WrongPassword');

      expect(result.success).toBe(false);
      expect(result.error).toContain('NotAuthorizedException');
    });
  });

  describe('Token Management', () => {
    it('should retrieve stored tokens', async () => {
      const mockTokens = {
        'cognito_access_token': 'stored-access-token',
        'cognito_id_token': 'stored-id-token',
        'cognito_refresh_token': 'stored-refresh-token',
        'cognito_token_expires': '1234567890'
      };

      browser.storage.local.get.mockResolvedValueOnce(mockTokens);

      const tokens = await cognitoAuth._getStoredTokens();

      expect(tokens.accessToken).toBe('stored-access-token');
      expect(tokens.idToken).toBe('stored-id-token');
      expect(tokens.refreshToken).toBe('stored-refresh-token');
      expect(tokens.expiresAt).toBe(1234567890);
    });

    it('should refresh tokens when expired', async () => {
      const mockRefreshResponse = {
        AuthenticationResult: {
          AccessToken: 'new-access-token',
          IdToken: 'new-id-token',
          ExpiresIn: 3600
        }
      };

      // Mock stored refresh token
      browser.storage.local.get.mockResolvedValueOnce({
        'cognito_refresh_token': 'valid-refresh-token'
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRefreshResponse)
      });

      const result = await cognitoAuth._refreshTokens();

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://cognito-idp.us-west-2.amazonaws.com/',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
          })
        })
      );
    });
  });

  describe('User Session', () => {
    it('should get current user when authenticated', async () => {
      const mockTokens = {
        'cognito_access_token': 'valid-token',
        'cognito_id_token': 'valid-id-token',
        'cognito_token_expires': (Date.now() + 3600000).toString() // 1 hour from now
      };

      browser.storage.local.get.mockResolvedValueOnce(mockTokens);

      const result = await cognitoAuth.getCurrentUser();

      expect(result.success).toBe(true);
      expect(result.data.authenticated).toBe(true);
    });

    it('should return unauthenticated when no tokens', async () => {
      browser.storage.local.get.mockResolvedValueOnce({});

      const result = await cognitoAuth.getCurrentUser();

      expect(result.success).toBe(true);
      expect(result.data.authenticated).toBe(false);
    });
  });

  describe('Sign Out', () => {
    it('should clear all stored tokens on sign out', async () => {
      await cognitoAuth.signOut();

      expect(browser.storage.local.remove).toHaveBeenCalledWith([
        'cognito_access_token',
        'cognito_refresh_token',
        'cognito_id_token',
        'cognito_token_expires',
        'cognito_user_info'
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await cognitoAuth.signIn('test@example.com', 'TestPass123!');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle storage errors gracefully', async () => {
      browser.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));

      const result = await cognitoAuth.getCurrentUser();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
    });
  });

  describe('Security', () => {
    it('should not expose sensitive data in logs', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await cognitoAuth.signIn('test@example.com', 'SecretPassword123!');
      
      const logCalls = consoleSpy.mock.calls;
      logCalls.forEach(call => {
        const logMessage = call.join(' ');
        expect(logMessage).not.toContain('SecretPassword123!');
        expect(logMessage).not.toContain('mock-access-token');
      });
      
      consoleSpy.mockRestore();
    });
  });
});
