// JWT Validation Utility for Browser Extensions
// Provides secure JWT token validation without requiring full crypto libraries

class JWTValidator {
  constructor() {
    this.clockSkewSeconds = 300; // 5 minutes tolerance for clock skew
  }

  // Parse JWT without verification (for extracting header/payload)
  parseJWT(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const header = JSON.parse(this.base64UrlDecode(parts[0]));
      const payload = JSON.parse(this.base64UrlDecode(parts[1]));
      const signature = parts[2];

      return { header, payload, signature };
    } catch (_error) {
      throw new Error('Failed to parse JWT: ' + error.message);
    }
  }

  // Validate JWT structure and claims (without signature verification)
  validateJWT(token, options = {}) {
    try {
      const { header, payload } = this.parseJWT(token);
      const now = Math.floor(Date.now() / 1000);

      // Basic structure validation
      if (!header.alg || !header.typ) {
        throw new Error('Invalid JWT header');
      }

      if (header.typ !== 'JWT') {
        throw new Error('Invalid token type');
      }

      // Check required claims
      if (!payload.sub) {
        throw new Error('Missing subject claim');
      }

      if (!payload.iat) {
        throw new Error('Missing issued at claim');
      }

      // Check expiration
      if (payload.exp) {
        if (now > payload.exp + this.clockSkewSeconds) {
          throw new Error('Token expired');
        }
      }

      // Check not before
      if (payload.nbf) {
        if (now < payload.nbf - this.clockSkewSeconds) {
          throw new Error('Token not yet valid');
        }
      }

      // Check issuer if provided
      if (options.issuer && payload.iss !== options.issuer) {
        throw new Error('Invalid issuer');
      }

      // Check audience if provided
      if (options.audience) {
        if (Array.isArray(payload.aud)) {
          if (!payload.aud.includes(options.audience)) {
            throw new Error('Invalid audience');
          }
        } else if (payload.aud !== options.audience) {
          throw new Error('Invalid audience');
        }
      }

      return {
        valid: true,
        payload: payload,
        header: header,
        expiresIn: payload.exp ? payload.exp - now : null
      };
    } catch (_error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Check if token is about to expire (within specified seconds)
  isTokenExpiringSoon(token, thresholdSeconds = 300) {
    try {
      const { payload } = this.parseJWT(token);
      if (!payload.exp) {
        return false; // No expiration
      }

      const now = Math.floor(Date.now() / 1000);
      return (payload.exp - now) <= thresholdSeconds;
    } catch (_error) {
      return true; // Treat invalid tokens as expired
    }
  }

  // Extract user information from Cognito ID token
  extractCognitoUserInfo(idToken) {
    try {
      const { payload } = this.parseJWT(idToken);
      
      return {
        userId: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified || false,
        givenName: payload.given_name,
        familyName: payload.family_name,
        name: payload.name,
        tokenUse: payload.token_use, // Should be 'id'
        audience: payload.aud,
        issuer: payload.iss,
        issuedAt: payload.iat,
        expiresAt: payload.exp
      };
    } catch (_error) {
      throw new Error('Failed to extract user info: ' + error.message);
    }
  }

  // Validate Cognito access token structure
  validateCognitoAccessToken(accessToken, expectedClientId) {
    const validation = this.validateJWT(accessToken, {
      audience: expectedClientId
    });

    if (!validation.valid) {
      return validation;
    }

    // Additional Cognito-specific validations
    const { payload } = validation;
    
    if (payload.token_use !== 'access') {
      return {
        valid: false,
        error: 'Invalid token use - expected access token'
      };
    }

    if (!payload.client_id || payload.client_id !== expectedClientId) {
      return {
        valid: false,
        error: 'Invalid client ID'
      };
    }

    return validation;
  }

  // Validate Cognito ID token structure
  validateCognitoIdToken(idToken, expectedClientId) {
    const validation = this.validateJWT(idToken, {
      audience: expectedClientId
    });

    if (!validation.valid) {
      return validation;
    }

    // Additional Cognito-specific validations
    const { payload } = validation;
    
    if (payload.token_use !== 'id') {
      return {
        valid: false,
        error: 'Invalid token use - expected ID token'
      };
    }

    if (!payload.aud || payload.aud !== expectedClientId) {
      return {
        valid: false,
        error: 'Invalid audience'
      };
    }

    return validation;
  }

  // Base64 URL decode helper
  base64UrlDecode(str) {
    // Add padding if needed
    str += '='.repeat((4 - str.length % 4) % 4);
    // Replace URL-safe characters
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    return atob(str);
  }

  // Secure token storage validation
  validateTokenStorage(tokens) {
    const errors = [];

    if (!tokens.accessToken) {
      errors.push('Missing access token');
    } else {
      const accessValidation = this.validateJWT(tokens.accessToken);
      if (!accessValidation.valid) {
        errors.push('Invalid access token: ' + accessValidation.error);
      }
    }

    if (tokens.idToken) {
      const idValidation = this.validateJWT(tokens.idToken);
      if (!idValidation.valid) {
        errors.push('Invalid ID token: ' + idValidation.error);
      }
    }

    if (!tokens.refreshToken) {
      errors.push('Missing refresh token');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
}

// Export for both environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JWTValidator;
} else {
  window.JWTValidator = JWTValidator;
}
