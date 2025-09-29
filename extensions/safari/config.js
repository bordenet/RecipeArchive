// Configuration for Recipe Archive Browser Extensions
// This handles switching between local development and production AWS endpoints
// TODO: Integrate with root .env for build-time environment variable loading

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

  // Web App URL (authoritative source)
  WEB_APP_URL: "https://d1jcaphz4458q7.cloudfront.net",

  // API Endpoints
  API: {
    development: {
      base: "http://127.0.0.1:8081",
      recipes: "http://127.0.0.1:8081/api/recipes",
      diagnostics: "http://127.0.0.1:8081/api/diagnostics",
      health: "http://127.0.0.1:8081/health",
    },
    production: {
      base: "https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod",
      recipes:
        "https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod/recipes",
diagnostics: "https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod/report-error",
      health:
        "https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod/health",
    },
  },

  // AWS Cognito Configuration (loaded from environment/localStorage)
  COGNITO: {
    region:
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("AWS_REGION")
        : null) || "us-west-2",
    userPoolId:
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("COGNITO_USER_POOL_ID")
        : null) || "us-west-2_rpBcEEhYK",
    clientId:
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("COGNITO_APP_CLIENT_ID")
        : null) || "7lm8mqr03s0m0fn17dnv373s4h",
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
        this.COGNITO.region = localStorage.getItem("AWS_REGION") || "us-west-2";
        this.COGNITO.userPoolId =
          localStorage.getItem("COGNITO_USER_POOL_ID") || "CONFIGURE_ME";
        this.COGNITO.clientId =
          localStorage.getItem("COGNITO_APP_CLIENT_ID") || "CONFIGURE_ME";
        this.API.production.base =
          localStorage.getItem("API_BASE_URL") ||
          "https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod";
        this.API.production.recipes = `${this.API.production.base}/recipes`;
        this.API.production.diagnostics = `${this.API.production.base}/report-error`;
        this.API.production.health = `${this.API.production.base}/health`;
        console.log(
          "🔄 Configuration reloaded with latest localStorage values"
        );
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
