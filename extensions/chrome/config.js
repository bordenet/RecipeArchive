// Configuration for Recipe Archive Browser Extensions
// This handles switching between local development and production AWS endpoints


const CONFIG = {
  // Environment detection
  ENVIRONMENT: (function determineEnvironment() {
    // Check if we're in development mode
    // For initial testing, default to development mode
    const isDevelopment = localStorage.getItem('recipeArchive.dev') !== 'false';
    return isDevelopment ? 'development' : 'production';
  })(),

  // API Endpoints
  API: {
    development: {
      base: 'http://localhost:8080',
      recipes: 'http://localhost:8080/api/recipes',
      diagnostics: 'http://localhost:8080/api/diagnostics',
      health: 'http://localhost:8080/health'
    },
    production: {
      base: 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod',
      recipes: 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod/recipes',
      diagnostics: 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod/diagnostics',
      health: 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod/health'
    }
  },

  // AWS Cognito Configuration (production)
  COGNITO: {
    region: 'us-west-2',
    userPoolId: 'us-west-2_qJ1i9RhxD',
    clientId: '5grdn7qhf1el0ioqb6hkelr29s'  // Fixed: was userPoolClientId
  },

  // Development test user (for testing only)
  DEFAULT_TEST_USER: {
    email: 'test@example.com',
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

  // Toggle environment (for debugging)
  toggleEnvironment: function() {
    const newEnv = this.ENVIRONMENT === 'development' ? 'production' : 'development';
    localStorage.setItem('recipeArchive.dev', newEnv === 'development' ? 'true' : 'false');
    this.ENVIRONMENT = newEnv;
    console.log(`🔄 Switched to ${newEnv} environment`);
    return newEnv;
  },

  // Force development mode
  enableDevelopment: function() {
    localStorage.setItem('recipeArchive.dev', 'true');
    this.ENVIRONMENT = 'development';
    console.log('🔧 Development mode enabled');
  },

  // Force production mode
  enableProduction: function() {
    localStorage.setItem('recipeArchive.dev', 'false');
    this.ENVIRONMENT = 'production';
    console.log('🚀 Production mode enabled');
  },

  // Get current status
  getStatus: function() {
    const api = this.getCurrentAPI();
    const cognito = this.getCognitoConfig();
    return {
      environment: this.ENVIRONMENT,
      api: api,
      cognito: cognito,
      isLocal: this.ENVIRONMENT === 'development'
    };
  }
};

// Log current configuration on load
console.log('🔧 Recipe Archive Extension Config:', CONFIG.getStatus());

// Export for use in other files
if (typeof window !== 'undefined') {
  window.RecipeArchiveConfig = CONFIG;
  window.CONFIG = CONFIG; // Also expose as CONFIG for compatibility
}

// For testing/development environments that support module exports
