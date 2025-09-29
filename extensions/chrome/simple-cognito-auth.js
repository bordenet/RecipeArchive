// Simple Cognito Authentication - Direct Fetch Approach
// Replaces the complex ChromeCognitoAuth with the proven working method

class SimpleCognitoAuth {
  constructor(config) {
    this.region = config.region || "us-west-2";
    this.userPoolId = config.userPoolId;
    this.clientId = config.clientId;
    this.baseUrl = `https://cognito-idp.${this.region}.amazonaws.com/`;

    // DEBUG: Log configuration details
    console.log("🔧 SimpleCognitoAuth initialized with:", {
      region: this.region,
      userPoolId: this.userPoolId,
      clientId: this.clientId,
      baseUrl: this.baseUrl,
    });

    // Token storage keys
    this.ACCESS_TOKEN_KEY = "cognito_access_token";
    this.REFRESH_TOKEN_KEY = "cognito_refresh_token";
    this.ID_TOKEN_KEY = "cognito_id_token";
    this.USER_INFO_KEY = "cognito_user_info";
    this.TOKEN_EXPIRES_KEY = "cognito_token_expires";
  }

  // Simple sign in using the proven working fetch approach
  async signIn(email, password) {
    console.log("🔐 SimpleCognitoAuth: Starting sign in...");
    console.log("📧 Email:", email);
    console.log("🔑 User Pool ID:", this.userPoolId);
    console.log("🆔 Client ID:", this.clientId);

    const payload = {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: this.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    };

    console.log("📦 Authentication payload (password hidden):", {
      ...payload,
      AuthParameters: {
        ...payload.AuthParameters,
        PASSWORD: "[HIDDEN]",
      },
    });

    const headers = {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    };

    let errorText;
    let errorMessage;

    try {
      console.log("📤 Making authentication request...");

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        errorText = await response.text();
        console.log(
          "❌ Authentication HTTP error:",
          response.status,
          errorText
        );

        errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.__type || errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        return { success: false, error: errorMessage };
      }

      const data = await response.json();
      console.log("📥 Authentication response received");

      if (data.AuthenticationResult) {
        console.log("✅ Authentication successful!");

        // Store tokens
        await this._storeTokens(data.AuthenticationResult);

        // Extract user info from ID token
        const userInfo = await this._extractUserInfo(
          data.AuthenticationResult.IdToken
        );
        if (userInfo) {
          await this._storeUserInfo(userInfo);
        }

        return {
          success: true,
          data: {
            ...userInfo,
            AccessToken: data.AuthenticationResult.AccessToken,
            IdToken: data.AuthenticationResult.IdToken,
            RefreshToken: data.AuthenticationResult.RefreshToken,
            ExpiresIn: data.AuthenticationResult.ExpiresIn,
          },
        };
      } else {
        console.log("❌ No authentication result in response");
        return { success: false, error: "Authentication failed - no result" };
      }
    } catch (error) {
      console.log("💥 Authentication failed:", error);
      return { success: false, error: error.message };
    }
  }

  // Store tokens in chrome storage
  async _storeTokens(authResult) {
    const expiresAt = Date.now() + authResult.ExpiresIn * 1000;

    const tokenData = {
      [this.ACCESS_TOKEN_KEY]: authResult.AccessToken,
      [this.ID_TOKEN_KEY]: authResult.IdToken,
      [this.REFRESH_TOKEN_KEY]: authResult.RefreshToken,
      [this.TOKEN_EXPIRES_KEY]: expiresAt,
    };

    if (typeof chrome !== "undefined" && chrome.storage) {
      await chrome.storage.local.set(tokenData);
    } else {
      // Fallback to localStorage
      Object.entries(tokenData).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
    }

    console.log("💾 Tokens stored successfully");
  }

  // Extract user info from ID token
  async _extractUserInfo(idToken) {
    try {
      const payload = idToken.split(".")[1];
      const decodedPayload = atob(
        payload.replace(/-/g, "+").replace(/_/g, "/")
      );
      const userInfo = JSON.parse(decodedPayload);

      return {
        email: userInfo.email,
        userId: userInfo.sub,
        emailVerified: userInfo.email_verified,
      };
    } catch (error) {
      console.log("⚠️ Could not extract user info from token:", error);
      return null;
    }
  }

  // Store user info
  async _storeUserInfo(userInfo) {
    if (typeof chrome !== "undefined" && chrome.storage) {
      await chrome.storage.local.set({ [this.USER_INFO_KEY]: userInfo });
    } else {
      localStorage.setItem(this.USER_INFO_KEY, JSON.stringify(userInfo));
    }
  }

  // Check if user is authenticated
  async isAuthenticated() {
    try {
      let tokenData;

      if (typeof chrome !== "undefined" && chrome.storage) {
        tokenData = await chrome.storage.local.get([
          this.ACCESS_TOKEN_KEY,
          this.TOKEN_EXPIRES_KEY,
        ]);
      } else {
        tokenData = {
          [this.ACCESS_TOKEN_KEY]: localStorage.getItem(this.ACCESS_TOKEN_KEY),
          [this.TOKEN_EXPIRES_KEY]: localStorage.getItem(
            this.TOKEN_EXPIRES_KEY
          ),
        };
      }

      if (
        !tokenData[this.ACCESS_TOKEN_KEY] ||
        !tokenData[this.TOKEN_EXPIRES_KEY]
      ) {
        return false;
      }

      return Date.now() < parseInt(tokenData[this.TOKEN_EXPIRES_KEY]);
    } catch (error) {
      console.log("⚠️ Error checking authentication:", error);
      return false;
    }
  }

  // Sign out
  async signOut() {
    const keys = [
      this.ACCESS_TOKEN_KEY,
      this.REFRESH_TOKEN_KEY,
      this.ID_TOKEN_KEY,
      this.USER_INFO_KEY,
      this.TOKEN_EXPIRES_KEY,
    ];

    if (typeof chrome !== "undefined" && chrome.storage) {
      await chrome.storage.local.remove(keys);
    } else {
      keys.forEach((key) => localStorage.removeItem(key));
    }

    console.log("🚪 User signed out");
  }
}

// Make available globally for compatibility
if (typeof window !== "undefined") {
  window.SimpleCognitoAuth = SimpleCognitoAuth;
}
