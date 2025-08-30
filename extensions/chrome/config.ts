// Configuration for Recipe Archive Browser Extensions
// This handles switching between local development and production AWS endpoints
// SECURITY: Uses environment-based configuration to avoid hardcoded credentials

type Environment = "development" | "production";
type APIConfig = {
  base: string;
  recipes: string;
  diagnostics: string;
  health: string;
};
type CognitoConfig = {
  region: string;
  userPoolId: string;
  clientId: string;
};
type Status = {
  environment: Environment;
  api: APIConfig;
  cognito: CognitoConfig;
  isLocal: boolean;
};

// Environment configuration loader for TypeScript
function loadEnvironmentConfig() {
  return {
    COGNITO_USER_POOL_ID: typeof localStorage !== "undefined" 
      ? localStorage.getItem('COGNITO_USER_POOL_ID') || 'CONFIGURE_ME'
      : 'CONFIGURE_ME',
    COGNITO_APP_CLIENT_ID: typeof localStorage !== "undefined"
      ? localStorage.getItem('COGNITO_APP_CLIENT_ID') || 'CONFIGURE_ME'
      : 'CONFIGURE_ME',
    AWS_REGION: typeof localStorage !== "undefined"
      ? localStorage.getItem('AWS_REGION') || 'us-west-2'
      : 'us-west-2',
    API_BASE_URL: typeof localStorage !== "undefined"
      ? localStorage.getItem('API_BASE_URL') || 'CONFIGURE_ME'
      : 'CONFIGURE_ME'
  };
}

const envConfig = loadEnvironmentConfig();

export const CONFIG = {
  ENVIRONMENT: (function determineEnvironment() {
    const isDevelopment = typeof localStorage !== "undefined" && localStorage.getItem("recipeArchive.dev") !== "false";
    return isDevelopment ? "development" : "production";
  })(),

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
  } as Record<Environment, APIConfig>,

  COGNITO: {
    region: envConfig.AWS_REGION,
    userPoolId: envConfig.COGNITO_USER_POOL_ID,
    clientId: envConfig.COGNITO_APP_CLIENT_ID
  },

  DEFAULT_TEST_USER: {
    email: "test@example.com"
  },

  getCurrentAPI(): APIConfig {
  return this.API[this.ENVIRONMENT as Environment];
  },

  getCognitoConfig(): CognitoConfig {
    return this.COGNITO;
  },

  toggleEnvironment(): Environment {
    const newEnv: Environment = this.ENVIRONMENT === "development" ? "production" : "development";
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("recipeArchive.dev", newEnv === "development" ? "true" : "false");
    }
    this.ENVIRONMENT = newEnv;
    console.log(`🔄 Switched to ${newEnv} environment`);
    return newEnv;
  },

  enableDevelopment(): void {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("recipeArchive.dev", "true");
    }
    this.ENVIRONMENT = "development";
    console.log("🔧 Development mode enabled");
  },

  enableProduction(): void {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("recipeArchive.dev", "false");
    }
    this.ENVIRONMENT = "production";
    console.log("🚀 Production mode enabled");
  },

  getStatus(): Status {
    const api = this.getCurrentAPI();
    const cognito = this.getCognitoConfig();
    return {
      environment: this.ENVIRONMENT as Environment,
      api: api,
      cognito: cognito,
      isLocal: this.ENVIRONMENT === "development"
    };
  }
};

console.log("🔧 Recipe Archive Extension Config:", CONFIG.getStatus());

// Export for browser
if (typeof window !== "undefined") {
  (window as unknown as { RecipeArchiveConfig: typeof CONFIG; CONFIG: typeof CONFIG }).RecipeArchiveConfig = CONFIG;
  (window as unknown as { RecipeArchiveConfig: typeof CONFIG; CONFIG: typeof CONFIG }).CONFIG = CONFIG;
}



