/* eslint-env browser */
// Chrome Extension Popup Script
// Handles the user interface and authentication flow

// Configuration validation
const CONFIG = window.CONFIG || {
  cognito: {
    region: 'us-west-2',
    userPoolId: 'us-west-2_example',
    clientId: 'example-client-id'
  },
  api: {
    baseUrl: 'https://api.recipearchive.example.com'
  }
};

// Initialize extension API with defensive checks
let extensionAPI = null;
if (typeof chrome !== 'undefined' && chrome.tabs) {
  extensionAPI = chrome;
} else if (typeof browser !== 'undefined' && browser.tabs) {
  extensionAPI = browser;
}

// Initialize authentication
let cognitoAuth = null;

// Utility functions - defined first to avoid hoisting issues
const showMessage = (message, isError = false) => {
  const messageDiv = document.getElementById('message');
  if (messageDiv) {
    messageDiv.textContent = message;
    messageDiv.className = isError ? 'error' : 'success';
    messageDiv.style.display = 'block';
  }
};

const showMainInterface = () => {
  const authContainer = document.getElementById('auth-container');
  const mainContainer = document.getElementById('main-container');

  if (authContainer) {
    authContainer.style.display = 'none';
  }
  if (mainContainer) {
    mainContainer.style.display = 'block';
  }
};

const showAuthRequired = () => {
  const authContainer = document.getElementById('auth-container');
  const mainContainer = document.getElementById('main-container');

  if (authContainer) {
    authContainer.style.display = 'block';
  }
  if (mainContainer) {
    mainContainer.style.display = 'none';
  }
};

const setupDevControls = () => {
  const devSection = document.getElementById('dev-section');
  if (devSection && CONFIG.environment === 'development') {
    devSection.style.display = 'block';
  }
};

// DOM Content Loaded Handler
document.addEventListener('DOMContentLoaded', () => {
  // Validate CONFIG availability
  if (!CONFIG || !CONFIG.cognito) {
    showMessage('Configuration error: Missing Cognito settings', true);
    return;
  }

  // Validate CONFIG.cognito properties
  if (!CONFIG.cognito.userPoolId || !CONFIG.cognito.clientId) {
    showMessage('Configuration error: Missing required Cognito parameters', true);
    return;
  }

  // Initialize SafariCognitoAuth with proper checks
  if (typeof SafariCognitoAuth === 'undefined') {
    showMessage('Authentication library not loaded', true);
    return;
  }

  try {
    cognitoAuth = new SafariCognitoAuth(CONFIG.cognito);

    // Check authentication status
    checkAuthStatus();
  } catch (error) {
    showMessage(`Authentication initialization failed: ${error.message}`, true);
    showAuthRequired();
  }

  // Set up event listeners with error handling
  setupEventListeners();
});

const handleAuthClick = () => {
  if (!cognitoAuth) {
    showMessage('Authentication not initialized', true);
    return;
  }

  showMessage('Starting authentication...');
  // This would trigger the OAuth flow
  // Implementation depends on your specific OAuth setup
};

const handleSignOut = async () => {
  if (!cognitoAuth) {
    showMessage('Authentication not initialized', true);
    return;
  }

  try {
    const result = await cognitoAuth.signOut();

    if (result.success) {
      showMessage('Signed out successfully');
      showAuthRequired();
    } else {
      showMessage(`Sign out failed: ${result.error}`, true);
    }
  } catch (error) {
    showMessage(`Error during sign out: ${error.message}`, true);
  }
};

const checkAuthStatus = async () => {
  if (!cognitoAuth) {
    showMessage('Authentication not initialized', true);
    showAuthRequired();
    return;
  }

  try {
    const result = await cognitoAuth.getCurrentUser();

    if (result.success && result.user) {
      showMessage(`Welcome, ${result.user.name}!`);
      showMainInterface();
      setupDevControls();
    } else {
      showMessage(`Authentication check failed: ${result.error}`, true);
      showAuthRequired();
    }
  } catch (error) {
    showMessage(`Error checking authentication: ${error.message}`, true);
    showAuthRequired();
  }
};

const setupEventListeners = () => {
  // Sign In button
  const signInButton = document.getElementById('sign-in-btn');
  if (signInButton) {
    signInButton.addEventListener('click', () => {
      handleAuthClick();
    });
  }

  // Sign Out button
  const signOutButton = document.getElementById('sign-out-btn');
  if (signOutButton) {
    signOutButton.addEventListener('click', () => {
      handleSignOut();
    });
  }
};

const sendRecipeToBackend = (recipeData) => {
  if (!CONFIG || !CONFIG.api || !CONFIG.api.baseUrl) {
    return {
      success: false,
      error: 'API configuration missing'
    };
  }

  if (!recipeData) {
    return {
      success: false,
      error: 'No recipe data provided'
    };
  }

  // FIXME: Implement actual API call
  console.log('Recipe data to send:', recipeData);

  // Simulated success for now
  return {
    success: true,
    data: { id: 'recipe-123' }
  };
};

const captureRecipe = () => {
  if (!extensionAPI) {
    showMessage('Extension API not available', true);
    return;
  }

  showMessage('Capturing recipe...');

  extensionAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      showMessage('No active tab found', true);
      return;
    }

    const activeTab = tabs[0];

    extensionAPI.tabs.sendMessage(activeTab.id, { action: 'extractRecipe' }, (response) => {
      if (extensionAPI.runtime.lastError) {
        showMessage(`Recipe capture failed: ${extensionAPI.runtime.lastError.message}`, true);
        return;
      }

      if (response && response.success) {
        showMessage('Recipe captured successfully!');

        // Send to backend
        const sendResult = sendRecipeToBackend(response.data);
        if (sendResult.success) {
          showMessage('Recipe saved to your archive!');
        } else {
          showMessage(`Failed to save recipe: ${sendResult.error}`, true);
        }
      } else {
        showMessage(`Recipe extraction failed: ${response ? response.error : 'Unknown error'}`, true);
      }
    });
  });
};

// Development functions
const testExtraction = () => {
  showMessage('Testing recipe extraction...');

  const testData = {
    title: 'Test Recipe',
    ingredients: ['1 cup flour', '2 eggs'],
    instructions: ['Mix ingredients', 'Bake for 30 minutes'],
    source: window.location.href
  };

  const result = sendRecipeToBackend(testData);
  if (result.success) {
    showMessage('Test successful!');
  } else {
    showMessage(`Test failed: ${result.error}`, true);
  }
};

const clearStorage = () => {
  if (!extensionAPI || !extensionAPI.storage) {
    showMessage('Storage API not available', true);
    return;
  }

  extensionAPI.storage.local.clear(() => {
    showMessage('Storage cleared');
    showAuthRequired();
  });
};

const viewLogs = () => {
  const logs = [
    'Extension loaded',
    `Config: ${JSON.stringify(CONFIG, null, 2)}`,
    `Auth initialized: ${cognitoAuth ? 'Yes' : 'No'}`,
    `Extension API: ${extensionAPI ? 'Available' : 'Not available'}`
  ];

  console.log('RecipeArchive Extension Logs:', logs);
  showMessage('Logs printed to console (F12)');
};

// Make functions available globally for HTML onclick handlers
if (typeof window !== 'undefined') {
  window.captureRecipe = captureRecipe;
  window.testExtraction = testExtraction;
  window.clearStorage = clearStorage;
  window.viewLogs = viewLogs;
}
