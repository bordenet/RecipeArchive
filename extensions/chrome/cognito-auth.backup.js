// Cognito Authentication Module for RecipeArchive Browser Extensions
// This handles user authentication with AWS Cognito

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

  // Sign up a new user
  async signUp(email, password, attributes = {}) {
    const params = {
      ClientId: this.clientId,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        ...Object.entries(attributes).map(([key, value]) => ({ Name: key, Value: value }))
      ]
    };

    try {
      const response = await this._makeRequest('AWSCognitoIdentityProviderService.SignUp', params);
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Confirm sign up with verification code
  async confirmSignUp(email, confirmationCode) {
    const params = {
      ClientId: this.clientId,
      Username: email,
      ConfirmationCode: confirmationCode
    };

    try {
      const response = await this._makeRequest('AWSCognitoIdentityProviderService.ConfirmSignUp', params);
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Sign in user
  async signIn(email, password) {
    const params = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: this.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    };

    try {
      const response = await this._makeRequest('AWSCognitoIdentityProviderService.InitiateAuth', params);
      
      if (response.AuthenticationResult) {
        await this._storeTokens(response.AuthenticationResult);
        const userInfo = await this._extractUserInfo(response.AuthenticationResult.IdToken);
        
        if (!userInfo) {
          return { success: false, error: 'Failed to extract user information from token' };
        }
        
        await this._storeUserInfo(userInfo);
        return { success: true, data: userInfo };
      } else {
        return { success: false, error: 'Authentication failed' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Sign out user
  async signOut() {
    try {
      const accessToken = await this._getStoredToken(this.ACCESS_TOKEN_KEY);
      if (accessToken) {
        const params = {
          AccessToken: accessToken
        };
        await this._makeRequest('AWSCognitoIdentityProviderService.GlobalSignOut', params);
      }
    } catch (error) {
      console.warn('Global sign out failed:', error);
    }

    // Clear stored tokens regardless of API call success
    await this._clearStoredTokens();
    return { success: true };
  }

  // Get current user info
  async getCurrentUser() {
    try {
      const userInfo = await this._getStoredUserInfo();
      if (userInfo && await this._isTokenValid()) {
        return { success: true, data: userInfo };
      } else {
        return { success: false, error: 'No valid session' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get valid access token (refresh if needed)
  async getAccessToken() {
    try {
      // Check if current token is valid
      if (await this._isTokenValid()) {
        return await this._getStoredToken(this.ACCESS_TOKEN_KEY);
      }

      // Try to refresh token
      const refreshResult = await this._refreshTokens();
      if (refreshResult.success) {
        return await this._getStoredToken(this.ACCESS_TOKEN_KEY);
      }

      throw new Error('Unable to get valid access token');
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }

  // Refresh access token using refresh token
  async _refreshTokens() {
    try {
      const refreshToken = await this._getStoredToken(this.REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const params = {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken
        }
      };

      const response = await this._makeRequest('AWSCognitoIdentityProviderService.InitiateAuth', params);
      
      if (response.AuthenticationResult) {
        await this._storeTokens(response.AuthenticationResult);
        return { success: true };
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      await this._clearStoredTokens(); // Clear invalid tokens
      return { success: false, error: error.message };
    }
  }

  // Check if current token is valid (not expired) with proper JWT validation
  async _isTokenValid() {
    try {
      const accessToken = await this._getStoredToken(this.ACCESS_TOKEN_KEY);
      if (!accessToken) {return false;}

      // Use JWT validator for proper token validation
      const jwtValidator = new JWTValidator();
      const validation = jwtValidator.validateCognitoAccessToken(accessToken, this.clientId);
      
      if (!validation.valid) {
        console.warn('Token validation failed:', validation.error);
        return false;
      }

      // Check if token is expiring soon (5 minutes buffer)
      if (jwtValidator.isTokenExpiringSoon(accessToken, 300)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  // Store authentication tokens
  async _storeTokens(authResult) {
    const expiresIn = authResult.ExpiresIn || 3600; // Default 1 hour
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    await this._setStoredItem(this.ACCESS_TOKEN_KEY, authResult.AccessToken);
    await this._setStoredItem(this.TOKEN_EXPIRES_KEY, expiresAt.toString());
    
    if (authResult.RefreshToken) {
      await this._setStoredItem(this.REFRESH_TOKEN_KEY, authResult.RefreshToken);
    }
    
    if (authResult.IdToken) {
      await this._setStoredItem(this.ID_TOKEN_KEY, authResult.IdToken);
    }
  }

  // Extract user info from ID token with proper validation
  async _extractUserInfo(idToken) {
    try {
      // Defensive check for required dependencies
      if (typeof JWTValidator === 'undefined') {
        throw new Error('JWTValidator is not available. Ensure jwt-validator.js is loaded.');
      }
      
      if (!idToken || typeof idToken !== 'string') {
        throw new Error('Invalid ID token: token must be a non-empty string');
      }
      
      // Initialize JWT validator
      const jwtValidator = new JWTValidator();
      
      // Validate ID token structure and claims
      const validation = jwtValidator.validateCognitoIdToken(idToken, this.clientId);
      if (!validation || !validation.valid) {
        const errorMsg = validation?.error || 'Unknown validation error';
        throw new Error('Invalid ID token: ' + errorMsg);
      }
      
      // Extract user information using validated payload
      const userInfo = jwtValidator.extractCognitoUserInfo(idToken);
      
      // Ensure userInfo is valid before accessing properties
      if (!userInfo) {
        throw new Error('Failed to extract user info from token');
      }
      
      // Defensive property access with fallbacks
      return {
        id: userInfo.userId || null,
        email: userInfo.email || null,
        emailVerified: Boolean(userInfo.emailVerified),
        givenName: userInfo.givenName || null,
        familyName: userInfo.familyName || null,
        name: userInfo.name || null,
        issuedAt: userInfo.issuedAt || null,
        expiresAt: userInfo.expiresAt || null
      };
    } catch (error) {
      console.error('Failed to extract user info from ID token:', error);
      return null;
    }
  }

  // Store user info
  async _storeUserInfo(userInfo) {
    await this._setStoredItem(this.USER_INFO_KEY, JSON.stringify(userInfo));
  }

  // Get stored user info
  async _getStoredUserInfo() {
    try {
      const userInfoStr = await this._getStoredItem(this.USER_INFO_KEY);
      return userInfoStr ? JSON.parse(userInfoStr) : null;
    } catch (_error) {
      return null;
    }
  }

  // Clear all stored tokens and user info
  async _clearStoredTokens() {
    await this._removeStoredItem(this.ACCESS_TOKEN_KEY);
    await this._removeStoredItem(this.REFRESH_TOKEN_KEY);
    await this._removeStoredItem(this.ID_TOKEN_KEY);
    await this._removeStoredItem(this.USER_INFO_KEY);
    await this._removeStoredItem(this.TOKEN_EXPIRES_KEY);
  }

  // Get stored token
  async _getStoredToken(key) {
    return await this._getStoredItem(key);
  }

  // Make HTTP request to Cognito API
  async _makeRequest(action, params) {
    const headers = {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': action
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(params)
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.__type || errorData.message || errorMessage;
      } catch (_e) {
        errorMessage = responseText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return JSON.parse(responseText);
  }

  // Storage abstraction (to be implemented by specific browser)
  async _getStoredItem(_key) {
    throw new Error('_getStoredItem must be implemented by subclass');
  }

  async _setStoredItem(_key, _value) {
    throw new Error('_setStoredItem must be implemented by subclass');
  }

  async _removeStoredItem(_key) {
    throw new Error('_removeStoredItem must be implemented by subclass');
  }
}

// Chrome Extension specific implementation
class ChromeCognitoAuth extends CognitoAuth {
  async _getStoredItem(key) {
    const result = await chrome.storage.local.get([key]);
    return result[key] || null;
  }

  async _setStoredItem(key, value) {
    await chrome.storage.local.set({ [key]: value });
  }

  async _removeStoredItem(key) {
    await chrome.storage.local.remove([key]);
  }
}

// Safari Extension specific implementation  
class SafariCognitoAuth extends CognitoAuth {
  async _getStoredItem(key) {
    const result = await browser.storage.local.get([key]);
    return result[key] || null;
  }

  async _setStoredItem(key, value) {
    await browser.storage.local.set({ [key]: value });
  }

  async _removeStoredItem(key) {
    await browser.storage.local.remove([key]);
  }
}

// Export for use in extensions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CognitoAuth, ChromeCognitoAuth, SafariCognitoAuth };
} else {
  window.CognitoAuth = CognitoAuth;
  window.ChromeCognitoAuth = ChromeCognitoAuth;
  window.SafariCognitoAuth = SafariCognitoAuth;
}
