// Configuration for Recipe Archive Browser Extensions
// This handles switching between local development and production AWS endpoints

// Prevent multiple loading of this script
if (typeof window.RECIPE_ARCHIVE_CONFIG_LOADED !== 'undefined') {
  console.log('Config already loaded, skipping...');
} else {
  window.RECIPE_ARCHIVE_CONFIG_LOADED = true;

(function() {
  // Cross-browser compatibility - make available globally for content scripts
  if (!window.browserAPI) {
    window.browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  }

  // Only create CONFIG if it doesn't exist
  if (!window.CONFIG && !window.RecipeArchiveConfig) {
    window.CONFIG = {
  // Environment detection
  ENVIRONMENT: (function() {
    // Check if we're in development mode
    // For initial testing, default to development mode
    const isDevelopment = localStorage.getItem('recipeArchive.dev') !== 'false';
    return isDevelopment ? 'development' : 'production';
  })(),

  // API Endpoints
  API: {
    development: {
      base: 'http://localhost:8080',
      recipes: 'http://localhost:8080/recipes',
      diagnostics: 'http://localhost:8080/diagnostics',
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
    userPoolClientId: '5grdn7qhf1el0ioqb6hkelr29s'
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
console.log('🔧 Recipe Archive Extension Config:', window.CONFIG.getStatus());

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.CONFIG;
} else if (typeof window !== 'undefined') {
  window.RecipeArchiveConfig = window.CONFIG;
}

  } // Close the CONFIG existence check
})(); // Close the IIFE

} // Close the loading check
