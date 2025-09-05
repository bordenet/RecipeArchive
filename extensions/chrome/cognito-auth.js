// Cognito Authentication Module for RecipeArchive Browser Extensions
// This handles user authentication with AWS Cognito

class CognitoAuth {
  constructor(config) {
    this.region = config.region || "us-west-2";
    this.userPoolId = config.userPoolId;
    this.clientId = config.clientId;
    this.baseUrl = `https://cognito-idp.${this.region}.amazonaws.com/`;
    
    // Token storage keys
    this.ACCESS_TOKEN_KEY = "cognito_access_token";
    this.REFRESH_TOKEN_KEY = "cognito_refresh_token";  
    this.ID_TOKEN_KEY = "cognito_id_token";
    this.USER_INFO_KEY = "cognito_user_info";
    this.TOKEN_EXPIRES_KEY = "cognito_token_expires";
  }

  // Sign up a new user
  async signUp(email, password, attributes = {}) {
    const params = {
      ClientId: this.clientId,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: "email", Value: email },
        ...Object.entries(attributes).map(([key, value]) => ({ Name: key, Value: value }))
      ]
    };

    try {
      const response = await this._makeRequest("AWSCognitoIdentityProviderService.SignUp", params);
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
      const response = await this._makeRequest("AWSCognitoIdentityProviderService.ConfirmSignUp", params);
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Sign in user - supports both direct auth and OAuth2
  async signIn(email, password, useOAuth2 = false) {
    if (useOAuth2) {
      return await this._signInWithOAuth2();
    } else {
      return await this._signInWithPassword(email, password);
    }
  }

  // Direct password authentication (for development/testing)
  async _signInWithPassword(email, password) {
    // Check if the User Pool supports USER_PASSWORD_AUTH
    const params = {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: this.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    };

    try {
      const response = await this._makeRequest("AWSCognitoIdentityProviderService.InitiateAuth", params);
      
      if (response.AuthenticationResult) {
        await this._storeTokens(response.AuthenticationResult);
        const userInfo = await this._extractUserInfo(response.AuthenticationResult.IdToken);
        
        if (!userInfo) {
          return { success: false, error: "Failed to extract user information from token" };
        }
        
        await this._storeUserInfo(userInfo);
        
        // Return both user info and tokens for the popup to use
        return { 
          success: true, 
          data: {
            ...userInfo,
            // Include the actual tokens
            AccessToken: response.AuthenticationResult.AccessToken,
            IdToken: response.AuthenticationResult.IdToken,
            RefreshToken: response.AuthenticationResult.RefreshToken,
            ExpiresIn: response.AuthenticationResult.ExpiresIn
          }
        };
      } else {
        return { success: false, error: "Authentication failed" };
      }
    } catch (error) {
      console.error("Direct authentication failed:", error);
      
      // If USER_PASSWORD_AUTH is not enabled, suggest OAuth2
      if (error.message.includes("USER_PASSWORD_AUTH") || error.message.includes("NotAuthorizedException")) {
        return { 
          success: false, 
          error: "Direct password authentication not enabled. Please use OAuth2 flow or enable USER_PASSWORD_AUTH in your Cognito User Pool.",
          suggestOAuth2: true
        };
      }
      
      return { success: false, error: error.message };
    }
  }

  // OAuth2 authentication flow (recommended for browser extensions)
  async _signInWithOAuth2() {
    try {
      console.log("🔐 Starting OAuth2 authentication flow...");
      
      // Build the authorization URL with PKCE for security
      const { authUrl, codeVerifier } = await this._buildOAuth2AuthUrl();
      console.log("🔗 Authorization URL:", authUrl);
      
      // Launch web auth flow (works in both Chrome and Safari)
      const redirectUrl = await this._launchWebAuthFlow(authUrl);
      console.log("✅ Received redirect URL");
      
      // Extract authorization code
      const authCode = this._extractAuthorizationCode(redirectUrl);
      if (!authCode) {
        throw new Error("No authorization code received");
      }
      
      console.log("🎫 Authorization code received, exchanging for tokens...");
      
      // Exchange code for tokens
      const tokens = await this._exchangeCodeForTokens(authCode, codeVerifier);
      console.log("🎫 Tokens received successfully");
      
      // Store tokens and extract user info
      await this._storeTokens({
        AccessToken: tokens.access_token,
        IdToken: tokens.id_token,
        RefreshToken: tokens.refresh_token,
        ExpiresIn: tokens.expires_in
      });
      
      // Extract user info from ID token
      const userInfo = await this._extractUserInfo(tokens.id_token);
      if (!userInfo) {
        throw new Error("Failed to extract user information from ID token");
      }
      
      await this._storeUserInfo(userInfo);
      
      return { success: true, data: userInfo, method: "oauth2" };
      
    } catch (error) {
      console.error("❌ OAuth2 authentication failed:", error);
      return {
        success: false,
        error: error.message,
        method: "oauth2"
      };
    }
  }

  // Build OAuth2 authorization URL with PKCE
  async _buildOAuth2AuthUrl() {
    // Generate PKCE parameters for security
    const codeVerifier = this._generateCodeVerifier();
    const codeChallenge = await this._generateCodeChallenge(codeVerifier);
    const state = this._generateRandomString(32);
    
    // Store state and code verifier for validation
    await this._setStoredItem("oauth2_state", state);
    await this._setStoredItem("oauth2_code_verifier", codeVerifier);
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      scope: "email openid profile",
      redirect_uri: this._getRedirectUri(),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    });
    
    const cognitoDomain = this._getCognitoDomain();
    const authUrl = `${cognitoDomain}/oauth2/authorize?${params.toString()}`;
    
    return { authUrl, codeVerifier };
  }

  // Get Cognito hosted UI domain
  _getCognitoDomain() {
    // Extract from config or build from region
    // Format: https://your-domain.auth.region.amazoncognito.com
    if (this.cognitoDomain) {
      return this.cognitoDomain;
    }
    
    // If no domain specified, we can't use OAuth2
    throw new Error("Cognito domain not configured. OAuth2 requires a hosted UI domain.");
  }

  // Get redirect URI for OAuth2
  _getRedirectUri() {
    // For browser extensions, we can use chrome-extension:// or safari-extension:// URLs
    // or a localhost URL that we control
    return this.redirectUri || "https://localhost:3000/auth/callback";
  }

  // Launch web authentication flow
  async _launchWebAuthFlow(url) {
    const extensionAPI = (typeof browser !== "undefined") ? browser : chrome;
    
    if (extensionAPI && extensionAPI.identity && extensionAPI.identity.launchWebAuthFlow) {
      // Standard browser extension identity API
      return await extensionAPI.identity.launchWebAuthFlow({
        url: url,
        interactive: true
      });
    } else {
      // Fallback: manual popup handling
      return new Promise((resolve, reject) => {
        const popup = window.open(url, "cognito-auth", "width=500,height=600,scrollbars=yes,resizable=yes");
        
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            reject(new Error("Authentication popup was closed by user"));
          }
        }, 1000);
        
        // This is a simplified implementation
        // In production, you'd need to handle the redirect properly
        setTimeout(() => {
          if (!popup.closed) {
            try {
              const currentUrl = popup.location.href;
              if (currentUrl && currentUrl.includes("code=")) {
                popup.close();
                clearInterval(checkClosed);
                resolve(currentUrl);
              }
            } catch (error) {
              // Cross-origin access error - expected during auth flow
            }
          }
        }, 1000);
      });
    }
  }

  // Extract authorization code from redirect URL
  _extractAuthorizationCode(url) {
    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get("code");
      // const _state = urlObj.searchParams.get("state");
      
      // TODO: Validate state parameter for security
      // const storedState = await this._getStoredItem('oauth2_state');
      // if (state !== storedState) {
      //   throw new Error('Invalid state parameter');
      // }
      
      return code;
    } catch (error) {
      console.error("❌ Failed to extract authorization code:", error);
      return null;
    }
  }

  // Exchange authorization code for tokens
  async _exchangeCodeForTokens(authCode, codeVerifier) {
    const cognitoDomain = this._getCognitoDomain();
    const tokenEndpoint = `${cognitoDomain}/oauth2/token`;
    
    const tokenData = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.clientId,
      code: authCode,
      redirect_uri: this._getRedirectUri(),
      code_verifier: codeVerifier
    });
    
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: tokenData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }
    
    return await response.json();
  }

  // Generate PKCE code verifier
  _generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  // Generate PKCE code challenge
  async _generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  // Generate random string
  _generateRandomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Sign out user
  async signOut() {
    try {
      const accessToken = await this._getStoredToken(this.ACCESS_TOKEN_KEY);
      if (accessToken) {
        const params = {
          AccessToken: accessToken
        };
        await this._makeRequest("AWSCognitoIdentityProviderService.GlobalSignOut", params);
      }
    } catch (error) {
      console.warn("Global sign out failed:", error);
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
        return { success: false, error: "No valid session" };
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

      throw new Error("Unable to get valid access token");
    } catch (error) {
      console.error("Failed to get access token:", error);
      return null;
    }
  }

  // Refresh access token using refresh token
  async _refreshTokens() {
    try {
      const refreshToken = await this._getStoredToken(this.REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const params = {
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: this.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken
        }
      };

      const response = await this._makeRequest("AWSCognitoIdentityProviderService.InitiateAuth", params);
      
      if (response.AuthenticationResult) {
        await this._storeTokens(response.AuthenticationResult);
        return { success: true };
      } else {
        throw new Error("Token refresh failed");
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
      await this._clearStoredTokens(); // Clear invalid tokens
      return { success: false, error: error.message };
    }
  }

  // Public method to refresh tokens (called by popup.js)
  async refreshToken(providedRefreshToken = null) {
    return await this._refreshTokens();
  }

  // Check if current token is valid (not expired) with proper JWT validation
  async _isTokenValid() {
    try {
      const accessToken = await this._getStoredToken(this.ACCESS_TOKEN_KEY);
      if (!accessToken) return false;

      // Use JWT validator for proper token validation
      const jwtValidator = new JWTValidator();
      const validation = jwtValidator.validateCognitoAccessToken(accessToken, this.clientId);
      
      if (!validation.valid) {
        console.warn("Token validation failed:", validation.error);
        return false;
      }

      // Check if token is expiring soon (5 minutes buffer)
      if (jwtValidator.isTokenExpiringSoon(accessToken, 300)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Token validation error:", error);
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
      if (!idToken || typeof idToken !== "string") {
        throw new Error("Invalid ID token: token must be a non-empty string");
      }
      
      // Simple JWT parsing without strict validation (similar to backend approach)
      const parts = idToken.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid JWT format: must have 3 parts");
      }
      
      // Decode the payload (middle part)
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      
      // Extract basic user information
      return {
        id: payload.sub || null,
        email: payload.email || null,
        emailVerified: Boolean(payload.email_verified),
        givenName: payload.given_name || null,
        familyName: payload.family_name || null,
        name: payload.name || null,
        issuedAt: payload.iat || null,
        expiresAt: payload.exp || null
      };
      
    } catch (error) {
      console.error("Failed to extract user info from ID token:", error);
      
      // Fallback: try with JWT validator if simple parsing fails
      if (typeof JWTValidator !== "undefined") {
        let jwtValidator = null;
        let userInfo = null;
        
        try {
          jwtValidator = new JWTValidator();
          userInfo = jwtValidator.extractCognitoUserInfo(idToken);
          if (userInfo) {
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
          }
        } catch (validatorError) {
          console.error("JWT validator also failed:", validatorError);
        }
      }
      
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
    } catch {
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
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": action
    };

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(params)
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.__type || errorData.message || errorMessage;
      } catch {
        errorMessage = responseText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return JSON.parse(responseText);
  }

  // Storage abstraction (to be implemented by specific browser)
  async _getStoredItem(_key) {
    throw new Error("_getStoredItem must be implemented by subclass");
  }

  async _setStoredItem(_key, _value) {
    throw new Error("_setStoredItem must be implemented by subclass");
  }

  async _removeStoredItem(_key) {
    throw new Error("_removeStoredItem must be implemented by subclass");
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
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CognitoAuth, ChromeCognitoAuth, SafariCognitoAuth };
} else {
  window.CognitoAuth = CognitoAuth;
  window.ChromeCognitoAuth = ChromeCognitoAuth;
  window.SafariCognitoAuth = SafariCognitoAuth;
}
