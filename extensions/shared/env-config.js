/**
 * Environment Configuration Loader for Browser Extensions
 * Loads configuration from environment variables or local storage
 * 
 * SECURITY: Never hardcode credentials in this file!
 */

// Environment configuration with fallbacks
const ENV_CONFIG = {
  // AWS Cognito Configuration
  COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || localStorage.getItem('COGNITO_USER_POOL_ID'),
  COGNITO_APP_CLIENT_ID: process.env.COGNITO_APP_CLIENT_ID || localStorage.getItem('COGNITO_APP_CLIENT_ID'),
  AWS_REGION: process.env.AWS_REGION || localStorage.getItem('AWS_REGION') || 'us-west-2',
  
  // API Configuration
  API_BASE_URL: process.env.API_BASE_URL || localStorage.getItem('API_BASE_URL'),
  
  // Test credentials (development only)
  TEST_USER_EMAIL: process.env.TEST_USER_EMAIL || localStorage.getItem('TEST_USER_EMAIL'),
  TEST_USER_PASSWORD: process.env.TEST_USER_PASSWORD || localStorage.getItem('TEST_USER_PASSWORD')
};

// Validate required configuration
function validateConfig() {
  const required = ['COGNITO_USER_POOL_ID', 'COGNITO_APP_CLIENT_ID', 'API_BASE_URL'];
  const missing = required.filter(key => !ENV_CONFIG[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required configuration:', missing);
    console.error('Please set these in localStorage or environment variables');
    return false;
  }
  return true;
}

// Extension Configuration Object
const EXTENSION_CONFIG = {
  // Environment detection
  ENVIRONMENT: localStorage.getItem("recipeArchive.dev") === "true" ? "development" : "production",

  // API Endpoints
  API: {
    development: {
      base: "http://localhost:3000",
      recipes: "http://localhost:3000/api/recipes",
      diagnostics: "http://localhost:3000/api/diagnostics",
      health: "http://localhost:3000/health"
    },
    production: {
      base: ENV_CONFIG.API_BASE_URL,
      recipes: `${ENV_CONFIG.API_BASE_URL}/v1/recipes`,
      diagnostics: `${ENV_CONFIG.API_BASE_URL}/v1/diagnostics`,
      health: `${ENV_CONFIG.API_BASE_URL}/health`
    }
  },

  // AWS Cognito Configuration
  COGNITO: {
    region: ENV_CONFIG.AWS_REGION,
    userPoolId: ENV_CONFIG.COGNITO_USER_POOL_ID,
    clientId: ENV_CONFIG.COGNITO_APP_CLIENT_ID
  },

  // Development test user (for testing only)
  DEFAULT_TEST_USER: {
    email: ENV_CONFIG.TEST_USER_EMAIL,
    // Note: Password should be handled securely in production
  },

  // Configuration methods
  getCurrentAPI: function() {
    return this.API[this.ENVIRONMENT];
  },

  getCognitoConfig: function() {
    return this.COGNITO;
  },

  toggleEnvironment: function() {
    const newEnv = this.ENVIRONMENT === "development" ? "production" : "development";
    localStorage.setItem("recipeArchive.dev", newEnv === "development" ? "true" : "false");
    this.ENVIRONMENT = newEnv;
    console.log(`🔄 Switched to ${newEnv} environment`);
    return newEnv;
  },

  // Initialize configuration
  init: function() {
    if (!validateConfig()) {
      console.error('❌ Extension configuration validation failed');
      return false;
    }
    console.log('✅ Extension configuration loaded successfully');
    return true;
  }
};

// Export for use in other extension files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EXTENSION_CONFIG;
} else if (typeof window !== 'undefined') {
  window.EXTENSION_CONFIG = EXTENSION_CONFIG;
}
