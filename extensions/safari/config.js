// Configuration for Recipe Archive Browser Extensions
// This handles switching between local development and production AWS endpoints
// SECURITY: Uses environment-based configuration to avoid hardcoded credentials
// This file loads configuration from env-config.js (auto-generated at build time)

// Environment configuration loader
function loadEnvironmentConfig() {
  // First, try to load from the auto-generated ENV_CONFIG
  if (typeof ENV_CONFIG !== "undefined" && ENV_CONFIG) {
    return {
      COGNITO_USER_POOL_ID: (typeof localStorage !== "undefined" ? localStorage.getItem("COGNITO_USER_POOL_ID") : null) || ENV_CONFIG.COGNITO_USER_POOL_ID,
      COGNITO_APP_CLIENT_ID: (typeof localStorage !== "undefined" ? localStorage.getItem("COGNITO_APP_CLIENT_ID") : null) || ENV_CONFIG.COGNITO_APP_CLIENT_ID,
      AWS_REGION: (typeof localStorage !== "undefined" ? localStorage.getItem("AWS_REGION") : null) || ENV_CONFIG.AWS_REGION,
      API_BASE_URL: (typeof localStorage !== "undefined" ? localStorage.getItem("API_BASE_URL") : null) || ENV_CONFIG.API_BASE_URL,
      WEB_APP_URL: (typeof localStorage !== "undefined" ? localStorage.getItem("WEB_APP_URL") : null) || ENV_CONFIG.WEB_APP_URL,
      S3_RECIPE_STORAGE_BUCKET: (typeof localStorage !== "undefined" ? localStorage.getItem("S3_RECIPE_STORAGE_BUCKET") : null) || ENV_CONFIG.S3_RECIPE_STORAGE_BUCKET,
    };
  }

  // Fallback: Check localStorage only (for manual configuration)
  if (typeof localStorage !== "undefined") {
    const localStorageConfig = {
      COGNITO_USER_POOL_ID: localStorage.getItem("COGNITO_USER_POOL_ID"),
      COGNITO_APP_CLIENT_ID: localStorage.getItem("COGNITO_APP_CLIENT_ID"),
      AWS_REGION: localStorage.getItem("AWS_REGION"),
      API_BASE_URL: localStorage.getItem("API_BASE_URL"),
      WEB_APP_URL: localStorage.getItem("WEB_APP_URL"),
      S3_RECIPE_STORAGE_BUCKET: localStorage.getItem("S3_RECIPE_STORAGE_BUCKET"),
    };

    // If all localStorage values are present, use them
    if (Object.values(localStorageConfig).every(val => val)) {
      return localStorageConfig;
    }
  }

  // No configuration found - show error
  console.error("❌ RecipeArchive Extension: Missing configuration!");
  console.error("This extension must be built with 'npm run build:extensions' to generate env-config.js");
  console.error("See README.md for setup instructions");

  throw new Error("Extension not properly configured. Run 'npm run build:extensions' first.");
}

const envConfig = loadEnvironmentConfig();

const CONFIG = {
  // Environment detection
  ENVIRONMENT: (function () {
    try {
      // Check if we're in development mode
      // For initial testing, default to development mode
      if (typeof localStorage !== "undefined") {
        const isDevelopment =
          localStorage.getItem("recipeArchive.dev") !== "false";
        return isDevelopment ? "development" : "production";
      }
      // Fallback if localStorage is not available
      return "development";
    } catch {
      console.warn(
        "CONFIG: Could not access localStorage, defaulting to development mode"
      );
      return "development";
    }
  })(),

  // Web App URL (from environment configuration)
  WEB_APP_URL: envConfig.WEB_APP_URL,

  // API Endpoints
  API: {
    development: {
      base: "http://127.0.0.1:8081",
      recipes: "http://127.0.0.1:8081/api/recipes",
      diagnostics: "http://127.0.0.1:8081/api/diagnostics",
      health: "http://127.0.0.1:8081/health",
    },
    production: {
      base: envConfig.API_BASE_URL,
      recipes: `${envConfig.API_BASE_URL}/recipes`,
      diagnostics: `${envConfig.API_BASE_URL}/report-error`,
      health: `${envConfig.API_BASE_URL}/health`,
    },
  },

  // AWS Cognito Configuration (from environment configuration)
  COGNITO: {
    region: envConfig.AWS_REGION,
    userPoolId: envConfig.COGNITO_USER_POOL_ID,
    clientId: envConfig.COGNITO_APP_CLIENT_ID,
  },

  // Development test user (use environment variables for real values)
  DEFAULT_TEST_USER: {
    email: (function () {
      try {
        // In a browser extension, we can't access process.env directly
        // Use localStorage for development configuration
        if (typeof localStorage !== "undefined") {
          return (
            localStorage.getItem("recipeArchive.testEmail") ||
            "test@example.com"
          );
        }
        return "test@example.com";
      } catch {
        return "test@example.com";
      }
    })(),
    // Password should be retrieved from secure storage when needed
    getPassword: function () {
      try {
        if (typeof localStorage !== "undefined") {
          return localStorage.getItem("recipeArchive.testPassword") || "";
        }
        return "";
      } catch {
        return "";
      }
    },
  },

  // Get current API endpoints based on environment
  getCurrentAPI: function () {
    return this.API[this.ENVIRONMENT];
  },

  // Get Cognito configuration
  getCognitoConfig: function () {
    return this.COGNITO;
  },

  // Toggle environment (for debugging)
  toggleEnvironment: function () {
    const newEnv =
      this.ENVIRONMENT === "development" ? "production" : "development";
    localStorage.setItem(
      "recipeArchive.dev",
      newEnv === "development" ? "true" : "false"
    );
    this.ENVIRONMENT = newEnv;
    console.log(`🔄 Switched to ${newEnv} environment`);
    return newEnv;
  },

  // Force development mode
  enableDevelopment: function () {
    localStorage.setItem("recipeArchive.dev", "true");
    this.ENVIRONMENT = "development";
    console.log("🔧 Development mode enabled");
  },

  // Force production mode
  enableProduction: function () {
    localStorage.setItem("recipeArchive.dev", "false");
    this.ENVIRONMENT = "production";
    console.log("🚀 Production mode enabled");
  },

  // Reload environment configuration
  reloadConfiguration: function () {
    try {
      if (typeof localStorage !== "undefined") {
        this.COGNITO.region = localStorage.getItem("AWS_REGION") || envConfig.AWS_REGION;
        this.COGNITO.userPoolId = localStorage.getItem("COGNITO_USER_POOL_ID") || envConfig.COGNITO_USER_POOL_ID;
        this.COGNITO.clientId = localStorage.getItem("COGNITO_APP_CLIENT_ID") || envConfig.COGNITO_APP_CLIENT_ID;
        this.API.production.base = localStorage.getItem("API_BASE_URL") || envConfig.API_BASE_URL;
        this.API.production.recipes = `${this.API.production.base}/recipes`;
        this.API.production.diagnostics = `${this.API.production.base}/report-error`;
        this.API.production.health = `${this.API.production.base}/health`;
        console.log("🔄 Configuration reloaded with latest localStorage values");
      }
    } catch (error) {
      console.warn("CONFIG: Could not reload configuration:", error.message);
    }
  },

  // Get current status
  getStatus: function () {
    const api = this.getCurrentAPI();
    const cognito = this.getCognitoConfig();
    return {
      environment: this.ENVIRONMENT,
      api: api,
      cognito: cognito,
      isLocal: this.ENVIRONMENT === "development",
    };
  },
};

// Log current configuration on load
console.log("🔧 Recipe Archive Extension Config:", CONFIG.getStatus());

// Export for use in other files
if (typeof window !== "undefined") {
  window.RecipeArchiveConfig = CONFIG;
  window.CONFIG = CONFIG; // Also expose as CONFIG for compatibility
}
