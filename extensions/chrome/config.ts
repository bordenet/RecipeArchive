// Configuration for Recipe Archive Browser Extensions
// This handles switching between local development and production AWS endpoints
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
      base: "https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod",
      recipes: "https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod/v1/recipes",
      diagnostics: "https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod/v1/diagnostics",
      health: "https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod/health"
    }
  } as Record<Environment, APIConfig>,

  COGNITO: {
    region: "us-west-2",
    userPoolId: "us-west-2_qJ1i9RhxD",
    clientId: "5grdn7qhf1el0ioqb6hkelr29s"
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



