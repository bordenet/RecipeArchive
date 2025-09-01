// Configuration for Recipe Archive Browser Extensions
// This handles switching between local development and production AWS endpoints
// SECURITY: Uses environment-based configuration to avoid hardcoded credentials

// Environment configuration loader
function loadEnvironmentConfig() {
  return {
    COGNITO_USER_POOL_ID: localStorage.getItem('COGNITO_USER_POOL_ID') || 'CONFIGURE_ME',
    COGNITO_APP_CLIENT_ID: localStorage.getItem('COGNITO_APP_CLIENT_ID') || 'CONFIGURE_ME',
    AWS_REGION: localStorage.getItem('AWS_REGION') || 'us-west-2',
    API_BASE_URL: localStorage.getItem('API_BASE_URL') || 'CONFIGURE_ME'
  };
}

const envConfig = loadEnvironmentConfig();


const CONFIG = {
  // Environment detection
  ENVIRONMENT: (function determineEnvironment() {
    // Check if we're in development mode
    // For initial testing, default to development mode
    const isDevelopment = localStorage.getItem("recipeArchive.dev") !== "false";
    return isDevelopment ? "development" : "production";
  })(),

  // Web App URL (authoritative source)
  WEB_APP_URL: "https://d1jcaphz4458q7.cloudfront.net",

  // API Endpoints
  API: {
    development: {
      base: "http://localhost:8080",
      recipes: "http://localhost:8080/api/recipes",
      diagnostics: "http://localhost:8080/api/diagnostics",
      health: "http://localhost:8080/health"
    },
    production: {
      base: envConfig.API_BASE_URL,
      recipes: `${envConfig.API_BASE_URL}/v1/recipes`,
      diagnostics: `${envConfig.API_BASE_URL}/v1/diagnostics`,
      health: `${envConfig.API_BASE_URL}/health`
    }
  },

  // AWS Cognito Configuration (loaded from environment/localStorage)
  COGNITO: {
    region: envConfig.AWS_REGION,
    userPoolId: envConfig.COGNITO_USER_POOL_ID,
    clientId: envConfig.COGNITO_APP_CLIENT_ID
  },

  // Development test user (for testing only)
  DEFAULT_TEST_USER: {
    email: "test@example.com",
    // Password should be set in localStorage for development testing
  },

  // Get current API endpoints based on environment
  getCurrentAPI: function() {
    return this.API[this.ENVIRONMENT];
  },

  // Get Cognito configuration
  getCognitoConfig: function() {
    return this.COGNITO;
  },

  // Reload environment configuration
  reloadConfiguration: function() {
    const envConfig = loadEnvironmentConfig();
    this.COGNITO.region = envConfig.AWS_REGION;
    this.COGNITO.userPoolId = envConfig.COGNITO_USER_POOL_ID;
    this.COGNITO.clientId = envConfig.COGNITO_APP_CLIENT_ID;
    this.API.production.base = envConfig.API_BASE_URL;
    this.API.production.recipes = `${envConfig.API_BASE_URL}/v1/recipes`;
    this.API.production.diagnostics = `${envConfig.API_BASE_URL}/v1/diagnostics`;
    this.API.production.health = `${envConfig.API_BASE_URL}/health`;
    console.log('🔄 Configuration reloaded with latest localStorage values');
  },

  // Toggle environment (for debugging)
  toggleEnvironment: function() {
    const newEnv = this.ENVIRONMENT === "development" ? "production" : "development";
    localStorage.setItem("recipeArchive.dev", newEnv === "development" ? "true" : "false");
    this.ENVIRONMENT = newEnv;
    console.log(`🔄 Switched to ${newEnv} environment`);
    return newEnv;
  },

  // Force development mode
  enableDevelopment: function() {
    localStorage.setItem("recipeArchive.dev", "true");
    this.ENVIRONMENT = "development";
    console.log("🔧 Development mode enabled");
  },

  // Force production mode
  enableProduction: function() {
    localStorage.setItem("recipeArchive.dev", "false");
    this.ENVIRONMENT = "production";
    console.log("🚀 Production mode enabled");
  },

  // Get current status
  getStatus: function() {
    const api = this.getCurrentAPI();
    const cognito = this.getCognitoConfig();
    return {
      environment: this.ENVIRONMENT,
      api: api,
      cognito: cognito,
      isLocal: this.ENVIRONMENT === "development"
    };
  }
};

// Log current configuration on load
console.log("🔧 Recipe Archive Extension Config:", CONFIG.getStatus());

// Export for use in other files
if (typeof window !== "undefined") {
  window.RecipeArchiveConfig = CONFIG;
  window.CONFIG = CONFIG; // Also expose as CONFIG for compatibility
}

// For testing/development environments that support module exports
try {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = CONFIG;
  }
} catch {
  // Ignore module export errors in browser extension context
}
