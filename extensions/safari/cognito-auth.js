// Safari Cognito Authentication Module for RecipeArchive
// This handles user authentication with AWS Cognito for Safari Web Extensions

class CognitoAuth {
  constructor(config) {
    this.region = config.region || 'us-west-2';
    this.userPoolId = config.userPoolId;
    this.clientId = config.clientId;
    this.baseUrl = `https://cognito-idp.${this.region}.amazonaws.com/`;

    // Token storage keys
    this.ACCESS_TOKEN_KEY = 'cognito_access_token';
    this.REFRESH_TOKEN_KEY = 'cognito_refresh_token';
    this.ID_TOKEN_KEY = 'cognito_id_token';
    this.USER_INFO_KEY = 'cognito_user_info';
    this.TOKEN_EXPIRES_KEY = 'cognito_token_expires';
  }

  // Sign up a new user with enhanced security validation
  async signUp(email, password, attributes = {}) {
    const operation = 'signUp';

    try {
      // Input validation and security checks
      if (typeof window !== 'undefined' && window.authSecurityValidator) {
        window.authSecurityValidator.validateEmail(email);
        window.authSecurityValidator.validatePassword(password);
      }

      // Performance monitoring
      if (typeof window !== 'undefined' && window.authPerformanceMonitor) {
        window.authPerformanceMonitor.startTimer(operation);
      }

      const params = {
        ClientId: this.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          ...Object.entries(attributes).map(([key, value]) => ({ Name: key, Value: value }))
        ]
      };

      // Execute with retry logic
      const response = await this._executeWithRetry(async () => {
        return await this._makeRequest('AWSCognitoIdentityProviderService.SignUp', params);
      }, operation, { email: `${email.substring(0, 3) }***` });

      // Performance success
      if (typeof window !== 'undefined' && window.authPerformanceMonitor) {
        window.authPerformanceMonitor.endTimer(operation, true);
      }

      return { success: true, data: response };
    } catch (error) {
      // Performance failure
      if (typeof window !== 'undefined' && window.authPerformanceMonitor) {
        window.authPerformanceMonitor.endTimer(operation, false);
      }

      // Enhanced error handling
      if (typeof window !== 'undefined' && window.authErrorHandler) {
        const userFriendlyMessage = window.authErrorHandler.getUserFriendlyMessage(error);
        return { success: false, error: userFriendlyMessage, originalError: error.message };
      }

      return { success: false, error: error.message };
    }
  }

  // Confirm sign up with verification code
  async confirmSignUp(email, confirmationCode) {
    const operation = 'confirmSignUp';

    try {
      // Input validation
      if (typeof window !== 'undefined' && window.authSecurityValidator) {
        window.authSecurityValidator.validateEmail(email);
        window.authSecurityValidator.validateConfirmationCode(confirmationCode);
      }

      // Performance monitoring
      if (typeof window !== 'undefined' && window.authPerformanceMonitor) {
        window.authPerformanceMonitor.startTimer(operation);
      }

      const params = {
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: confirmationCode
      };

      // Execute with retry logic
      const response = await this._executeWithRetry(async () => {
        return await this._makeRequest('AWSCognitoIdentityProviderService.ConfirmSignUp', params);
      }, operation, { email: `${email.substring(0, 3) }***` });

      // Performance success
      if (typeof window !== 'undefined' && window.authPerformanceMonitor) {
        window.authPerformanceMonitor.endTimer(operation, true);
      }

      return { success: true, data: response };
    } catch (error) {
      // Performance failure
      if (typeof window !== 'undefined' && window.authPerformanceMonitor) {
        window.authPerformanceMonitor.endTimer(operation, false);
      }

      // Enhanced error handling
      if (typeof window !== 'undefined' && window.authErrorHandler) {
        const userFriendlyMessage = window.authErrorHandler.getUserFriendlyMessage(error);
        return { success: false, error: userFriendlyMessage, originalError: error.message };
      }

      return { success: false, error: error.message };
    }
  }

  // Sign in user with enhanced security and error handling
  async signIn(email, password) {
    const operation = 'signIn';

    try {
      // Input validation and security checks
      if (typeof window !== 'undefined' && window.authSecurityValidator) {
        window.authSecurityValidator.validateEmail(email);
        window.authSecurityValidator.validatePassword(password);
      }

      // Performance monitoring
      if (typeof window !== 'undefined' && window.authPerformanceMonitor) {
        window.authPerformanceMonitor.startTimer(operation);
      }

      const params = {
        ClientId: this.clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      };

      // Execute with retry logic
      const response = await this._executeWithRetry(async () => {
        return await this._makeRequest('AWSCognitoIdentityProviderService.InitiateAuth', params);
      }, operation, { email: `${email.substring(0, 3) }***` }); // Log only partial email

      if (response.AuthenticationResult) {
        await this._storeTokens(response.AuthenticationResult);
        const userInfo = await this._extractUserInfo(response.AuthenticationResult.IdToken);

        // Performance success
        if (typeof window !== 'undefined' && window.authPerformanceMonitor) {
          window.authPerformanceMonitor.endTimer(operation, true);
        }

        return { success: true, data: { user: userInfo, tokens: response.AuthenticationResult } };
      }
        throw new Error('Authentication failed - no authentication result');

    } catch (error) {
      // Performance failure
      if (typeof window !== 'undefined' && window.authPerformanceMonitor) {
        window.authPerformanceMonitor.endTimer(operation, false);
      }

      // Enhanced error handling
      if (typeof window !== 'undefined' && window.authErrorHandler) {
        const userFriendlyMessage = window.authErrorHandler.getUserFriendlyMessage(error);
        return { success: false, error: userFriendlyMessage, originalError: error.message };
      }

      return { success: false, error: error.message };
    }
  }

  // Sign out user
  async signOut() {
    try {
      const tokens = await this._getStoredTokens();

      if (tokens.accessToken) {
        const params = {
          AccessToken: tokens.accessToken
        };

        await this._makeRequest('AWSCognitoIdentityProviderService.GlobalSignOut', params);
      }

      await this._clearStoredTokens();
      return { success: true };
    } catch (error) {
      // Clear tokens even if API call fails
      await this._clearStoredTokens();
      return { success: true };
    }
  }

  // Get current user if authenticated
  async getCurrentUser() {
    try {
      console.log('SafariCognitoAuth: Starting getCurrentUser()');

      // Add timeout wrapper for storage operations
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Storage operation timed out')), 5000)
      );

      const checkUser = async () => {
        console.log('SafariCognitoAuth: Getting stored tokens');
        const tokens = await this._getStoredTokens();

        if (!tokens.accessToken) {
          console.log('SafariCognitoAuth: No access token found');
          return { success: false, error: 'No authentication token found' };
        }

        console.log('SafariCognitoAuth: Checking token validity');
        // Check if token is still valid
        if (!(await this._isTokenValid())) {
          console.log('SafariCognitoAuth: Token invalid, attempting refresh');
          // Try to refresh
          const refreshResult = await this._refreshTokens();
          if (!refreshResult.success) {
            console.log('SafariCognitoAuth: Token refresh failed');
            return { success: false, error: 'Token expired and refresh failed' };
          }
          console.log('SafariCognitoAuth: Token refreshed successfully');
        }

        console.log('SafariCognitoAuth: Getting user info');
        const userInfo = JSON.parse(await this._getStorageItem(this.USER_INFO_KEY) || '{}');
        console.log('SafariCognitoAuth: User info retrieved', userInfo);
        return { success: true, data: userInfo };
      };

      return await Promise.race([checkUser(), timeoutPromise]);
    } catch (error) {
      console.error('SafariCognitoAuth: getCurrentUser error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get valid access token
  async getAccessToken() {
    try {
      const tokens = await this._getStoredTokens();

      if (!tokens.accessToken) {
        return { success: false, error: 'No access token found' };
      }

      if (!(await this._isTokenValid())) {
        const refreshResult = await this._refreshTokens();
        if (!refreshResult.success) {
          return { success: false, error: 'Token expired and refresh failed' };
        }

        // Get updated tokens
        const newTokens = await this._getStoredTokens();
        return { success: true, data: newTokens.accessToken };
      }

      return { success: true, data: tokens.accessToken };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get valid ID token
  async getIdToken() {
    try {
      const tokens = await this._getStoredTokens();

      if (!tokens.idToken) {
        return { success: false, error: 'No ID token found' };
      }

      if (!(await this._isTokenValid())) {
        const refreshResult = await this._refreshTokens();
        if (!refreshResult.success) {
          return { success: false, error: 'Token expired and refresh failed' };
        }

        // Get updated tokens
        const newTokens = await this._getStoredTokens();
        return { success: true, data: newTokens.idToken };
      }

      return { success: true, data: tokens.idToken };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Refresh tokens using refresh token
  async _refreshTokens() {
    try {
      const tokens = await this._getStoredTokens();

      if (!tokens.refreshToken) {
        return { success: false, error: 'No refresh token available' };
      }

      const params = {
        ClientId: this.clientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          REFRESH_TOKEN: tokens.refreshToken
        }
      };

      const response = await this._makeRequest('AWSCognitoIdentityProviderService.InitiateAuth', params);

      if (response.AuthenticationResult) {
        // Preserve refresh token if not returned
        if (!response.AuthenticationResult.RefreshToken) {
          response.AuthenticationResult.RefreshToken = tokens.refreshToken;
        }

        await this._storeTokens(response.AuthenticationResult);
        return { success: true, data: response.AuthenticationResult };
      }
        return { success: false, error: 'Token refresh failed' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Check if current token is valid
  async _isTokenValid() {
    try {
      const expiresAt = await this._getStorageItem(this.TOKEN_EXPIRES_KEY);
      if (!expiresAt) {return false;}

      const now = Date.now();
      const expiry = parseInt(expiresAt);

      // Add 5 minute buffer for safety
      return now < (expiry - 300000);
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  // Store authentication tokens
  async _storeTokens(authResult) {
    try {
      await this._setStorageItem(this.ACCESS_TOKEN_KEY, authResult.AccessToken);
      await this._setStorageItem(this.ID_TOKEN_KEY, authResult.IdToken);

      if (authResult.RefreshToken) {
        await this._setStorageItem(this.REFRESH_TOKEN_KEY, authResult.RefreshToken);
      }

      // Calculate and store expiry
      const expiresAt = Date.now() + (authResult.ExpiresIn * 1000);
      await this._setStorageItem(this.TOKEN_EXPIRES_KEY, expiresAt.toString());

      // Extract and store user info
      if (authResult.IdToken) {
        const userInfo = await this._extractUserInfo(authResult.IdToken);
        await this._setStorageItem(this.USER_INFO_KEY, JSON.stringify(userInfo));
      }
    } catch (error) {
      console.error('Token storage error:', error);
      throw error;
    }
  }

  // Extract user information from ID token
  async _extractUserInfo(idToken) {
    try {
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const payload = JSON.parse(atob(parts[1]));
      return {
        email: payload.email,
        name: payload.name || payload.email,
        sub: payload.sub,
        email_verified: payload.email_verified
      };
    } catch (error) {
      console.error('User info extraction error:', error);
      return {};
    }
  }

  // Execute operation with enhanced retry logic
  async _executeWithRetry(operation, operationName, context = {}) {
    if (typeof window !== 'undefined' && window.authErrorHandler) {
      return await window.authErrorHandler.executeWithRetry(operation, operationName, context);
    }

    // Fallback retry logic if enhanced error handler not available
    let lastError;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Check if we should retry
        const retryableErrors = ['NetworkError', 'TimeoutError', 'ServiceUnavailableException'];
        const errorType = error.__type || error.name || 'UnknownError';

        if (attempt < maxRetries && retryableErrors.includes(errorType)) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`Retrying ${operationName} in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  // Make authenticated request to Cognito
  async _makeRequest(action, params) {
    const headers = {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': action
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const errorData = await response.text();
      let errorMessage = `HTTP ${response.status}`;

      try {
        const errorJson = JSON.parse(errorData);
        errorMessage = errorJson.message || errorJson.__type || errorMessage;
      } catch (e) {
        // If JSON parsing fails, use HTTP status
      }

      throw new Error(errorMessage);
    }

    return await response.json();
  }

  // Safari-compatible storage methods
  _getExtensionAPI() {
    if (typeof browser !== 'undefined') {return browser;}
    if (typeof chrome !== 'undefined') {return chrome;}
    return null;
  }

  async _setStorageItem(key, value) {
    try {
      console.log(`SafariCognitoAuth: Setting storage item ${key}`);
      const extensionAPI = this._getExtensionAPI();
      if (extensionAPI && extensionAPI.storage) {
        const data = {};
        data[key] = value;
        const setPromise = extensionAPI.storage.local.set(data);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Storage set timeout')), 3000)
        );
        await Promise.race([setPromise, timeoutPromise]);
        console.log(`SafariCognitoAuth: Successfully set ${key} via extension API`);
      } else {
        localStorage.setItem(key, value);
        console.log(`SafariCognitoAuth: Successfully set ${key} via localStorage`);
      }
    } catch (error) {
      console.error('Storage set error:', error);
      localStorage.setItem(key, value);
    }
  }

  async _getStorageItem(key) {
    try {
      console.log(`SafariCognitoAuth: Getting storage item ${key}`);
      const extensionAPI = this._getExtensionAPI();
      if (extensionAPI && extensionAPI.storage) {
        const getPromise = extensionAPI.storage.local.get([key]);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Storage get timeout')), 3000)
        );
        const result = await Promise.race([getPromise, timeoutPromise]);
        console.log(`SafariCognitoAuth: Got ${key} via extension API:`, result[key] ? 'found' : 'not found');
        return result[key] || null;
      }
        const result = localStorage.getItem(key);
        console.log(`SafariCognitoAuth: Got ${key} via localStorage:`, result ? 'found' : 'not found');
        return result;

    } catch (error) {
      console.error('Storage get error:', error);
      return localStorage.getItem(key);
    }
  }

  async _removeStorageItem(key) {
    try {
      const extensionAPI = this._getExtensionAPI();
      if (extensionAPI && extensionAPI.storage) {
        await extensionAPI.storage.local.remove([key]);
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Storage remove error:', error);
      localStorage.removeItem(key);
    }
  }

  async _getStoredTokens() {
    try {
      const accessToken = await this._getStorageItem(this.ACCESS_TOKEN_KEY);
      const refreshToken = await this._getStorageItem(this.REFRESH_TOKEN_KEY);
      const idToken = await this._getStorageItem(this.ID_TOKEN_KEY);
      const expiresAt = await this._getStorageItem(this.TOKEN_EXPIRES_KEY);

      return {
        accessToken,
        refreshToken,
        idToken,
        expiresAt: expiresAt ? parseInt(expiresAt) : null
      };
    } catch (error) {
      console.error('Token retrieval error:', error);
      return {};
    }
  }

  async _clearStoredTokens() {
    try {
      await this._removeStorageItem(this.ACCESS_TOKEN_KEY);
      await this._removeStorageItem(this.REFRESH_TOKEN_KEY);
      await this._removeStorageItem(this.ID_TOKEN_KEY);
      await this._removeStorageItem(this.TOKEN_EXPIRES_KEY);
      await this._removeStorageItem(this.USER_INFO_KEY);
    } catch (error) {
      console.error('Token clearing error:', error);
    }
  }
}

// Safari-specific subclass
class SafariCognitoAuth extends CognitoAuth {
  constructor(config) {
    super(config);
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.CognitoAuth = CognitoAuth;
  window.SafariCognitoAuth = SafariCognitoAuth;
}
