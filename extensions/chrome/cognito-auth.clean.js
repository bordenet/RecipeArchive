/* eslint-env browser */
// Cognito Authentication Module for RecipeArchive Browser Extensions
// This handles user authentication with AWS Cognito

const CognitoAuth = class CognitoAuth {
  constructor(config) {
    this.region = config.region || 'us-west-2';
    this.userPoolId = config.userPoolId;
    this.clientId = config.clientId;
    this.baseUrl = `https://cognito-idp.${this.region}.amazonaws.com/`;
    this.endpoint = `${this.baseUrl}${this.userPoolId}`;
    this.authenticated = false;
    this.user = null;
  }

  async signUp(username, password, email) {
    const payload = {
      ClientId: this.clientId,
      Username: username,
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: email
        }
      ]
    };

    try {
      const response = await this._makeRequest('SignUp', payload);
      return {
        success: true,
        data: response
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Sign up failed'
      };
    }
  }

  async confirmSignUp(username, confirmationCode) {
    const payload = {
      ClientId: this.clientId,
      Username: username,
      ConfirmationCode: confirmationCode
    };

    try {
      const response = await this._makeRequest('ConfirmSignUp', payload);
      return {
        success: true,
        data: response
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Confirmation failed'
      };
    }
  }

  async signIn(username, password) {
    const payload = {
      ClientId: this.clientId,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password
      }
    };

    try {
      const response = await this._makeRequest('InitiateAuth', payload);

      if (response.AuthenticationResult) {
        const { AccessToken, IdToken, RefreshToken } = response.AuthenticationResult;

        // Store tokens securely
        await this._setStoredItem('accessToken', AccessToken);
        await this._setStoredItem('idToken', IdToken);
        await this._setStoredItem('refreshToken', RefreshToken);

        // Extract and store user info
        const userInfo = await this._extractUserInfo(IdToken);
        if (userInfo) {
          await this._setStoredItem('userInfo', JSON.stringify(userInfo));
          this.user = userInfo;
          this.authenticated = true;

          return {
            success: true,
            user: userInfo,
            tokens: { AccessToken, IdToken, RefreshToken }
          };
        }

        return {
          success: false,
          error: 'Failed to extract user information from token'
        };
      }

      if (response.ChallengeName) {
        return {
          success: false,
          challenge: response.ChallengeName,
          challengeParameters: response.ChallengeParameters,
          session: response.Session
        };
      }

      return {
        success: false,
        error: 'Unknown authentication response'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Sign in failed'
      };
    }
  }

  async signOut() {
    try {
      await this._removeStoredItem('accessToken');
      await this._removeStoredItem('idToken');
      await this._removeStoredItem('refreshToken');
      await this._removeStoredItem('userInfo');

      this.authenticated = false;
      this.user = null;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Sign out failed'
      };
    }
  }

  async getCurrentUser() {
    try {
      const accessToken = await this._getStoredItem('accessToken');
      const storedUserInfo = await this._getStoredItem('userInfo');

      if (accessToken && storedUserInfo) {
        // Verify token is still valid
        const isValid = await this._verifyToken(accessToken);
        if (isValid) {
          this.user = JSON.parse(storedUserInfo);
          this.authenticated = true;
          return {
            success: true,
            user: this.user
          };
        }
        // Token invalid, sign out
        await this.signOut();
      }

      return {
        success: false,
        error: 'No authenticated user'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to get current user'
      };
    }
  }

  async refreshTokens() {
    try {
      const refreshToken = await this._getStoredItem('refreshToken');

      if (!refreshToken) {
        return {
          success: false,
          error: 'No refresh token available'
        };
      }

      const payload = {
        ClientId: this.clientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          REFRESH_TOKEN: refreshToken
        }
      };

      const response = await this._makeRequest('InitiateAuth', payload);

      if (response.AuthenticationResult) {
        const { AccessToken, IdToken } = response.AuthenticationResult;

        await this._setStoredItem('accessToken', AccessToken);
        await this._setStoredItem('idToken', IdToken);

        return {
          success: true,
          tokens: { AccessToken, IdToken }
        };
      }

      return {
        success: false,
        error: 'Token refresh failed'
      };
    } catch (error) {
      // If refresh fails, sign out
      await this.signOut();
      return {
        success: false,
        error: error.message || 'Token refresh failed'
      };
    }
  }

  async _makeRequest(action, payload) {
    const headers = {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.__type ? `${data.__type}: ${data.message}` : 'Request failed';
      throw new Error(errorMessage);
    }

    return data;
  }

  async _extractUserInfo(idToken) {
    try {
      // Check if JWTValidator is available
      if (typeof JWTValidator === 'undefined' || !JWTValidator) {
        console.warn('JWTValidator not available, attempting basic token parsing');
        // Fallback to basic JWT parsing
        const payload = idToken.split('.')[1];
        if (!payload) {
          throw new Error('Invalid JWT token format');
        }
        
        const decoded = JSON.parse(atob(payload));
        return {
          sub: decoded.sub || null,
          email: decoded.email || null,
          name: decoded.name || decoded.email || 'Unknown User',
          email_verified: decoded.email_verified || false
        };
      }

      // Use JWTValidator for proper validation
      const validator = new JWTValidator();
      const decoded = validator.decode(idToken);

      if (!decoded || typeof decoded !== 'object') {
        throw new Error('Token validation failed');
      }

      return {
        sub: decoded.sub || null,
        email: decoded.email || null,
        name: decoded.name || decoded.email || 'Unknown User',
        email_verified: decoded.email_verified || false
      };
    } catch (error) {
      console.error('Error extracting user info:', error);
      return null;
    }
  }

  async _verifyToken(token) {
    if (!token) {
      return false;
    }

    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      const currentTime = Math.floor(Date.now() / 1000);

      return decoded.exp > currentTime;
    } catch (error) {
      return false;
    }
  }

  // Storage helpers - these work for both Chrome and Safari extensions
  async _getStoredItem(key) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          resolve(result[key] || null);
        });
      });
    }
    // Fallback to localStorage for Safari or testing
    return localStorage.getItem(key);
  }

  async _setStoredItem(key, value) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
      });
    }
    // Fallback to localStorage for Safari or testing
    localStorage.setItem(key, value);
    return Promise.resolve();
  }

  async _removeStoredItem(key) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.remove([key], resolve);
      });
    }
    // Fallback to localStorage for Safari or testing
    localStorage.removeItem(key);
    return Promise.resolve();
  }
};

// Chrome extension-specific implementation
const ChromeCognitoAuth = class ChromeCognitoAuth extends CognitoAuth {
  constructor(config) {
    super(config);
    this.platform = 'chrome';
  }

  async _getStoredItem(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] || null);
      });
    });
  }

  async _setStoredItem(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  async _removeStoredItem(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], resolve);
    });
  }
};

// Safari extension-specific implementation
const SafariCognitoAuth = class SafariCognitoAuth extends CognitoAuth {
  constructor(config) {
    super(config);
    this.platform = 'safari';
  }
};

// Browser-compatible export
if (typeof window !== 'undefined') {
  window.CognitoAuth = CognitoAuth;
  window.ChromeCognitoAuth = ChromeCognitoAuth;
  window.SafariCognitoAuth = SafariCognitoAuth;
}
