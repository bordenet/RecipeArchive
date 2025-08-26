/* eslint-env browser */
// Chrome Extension Popup Script
// Handles the user interface and authentication flow

// CONFIG is loaded from config.js - no need to redeclare it

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
  console.log('Showing main interface');
  
  // Hide auth button, show user info and capture button
  const authButton = document.getElementById('authButton');
  const logoutButton = document.getElementById('logoutButton');
  const captureBtn = document.getElementById('captureBtn');
  const userInfo = document.getElementById('userInfo');

  if (authButton) {
    authButton.style.display = 'none';
  }
  if (logoutButton) {
    logoutButton.style.display = 'block';
  }
  if (captureBtn) {
    captureBtn.style.display = 'block';
  }
  if (userInfo) {
    userInfo.style.display = 'block';
    userInfo.textContent = 'Welcome, Developer! (Development Mode)';
  }
  
  console.log('Main interface shown successfully');
};

const showAuthRequired = () => {
  console.log('Showing auth required interface');
  
  // Show auth button, hide user info and capture button
  const authButton = document.getElementById('authButton');
  const logoutButton = document.getElementById('logoutButton');
  const captureBtn = document.getElementById('captureBtn');
  const userInfo = document.getElementById('userInfo');

  if (authButton) {
    authButton.style.display = 'block';
  }
  if (logoutButton) {
    logoutButton.style.display = 'none';
  }
  if (captureBtn) {
    captureBtn.style.display = 'none';
  }
  if (userInfo) {
    userInfo.style.display = 'none';
  }
  
  console.log('Auth required interface shown successfully');
};

const setupDevControls = () => {
  const devSection = document.getElementById('dev-section');
  if (devSection && CONFIG.ENVIRONMENT === 'development') {
    devSection.style.display = 'block';
  }
};

// DOM Content Loaded Handler
document.addEventListener('DOMContentLoaded', () => {
  // Clear the loading message first
  const messageDiv = document.getElementById('message');
  if (messageDiv) {
    messageDiv.style.display = 'none';
    messageDiv.textContent = '';
  }

  // Wait a bit for config.js to load and define CONFIG
  setTimeout(() => {
    // Log CONFIG status for debugging
    console.log('Chrome Extension CONFIG status:', {
      available: typeof CONFIG !== 'undefined',
      config: typeof CONFIG !== 'undefined' ? CONFIG.getStatus() : null
    });

    // Validate CONFIG availability
    if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.COGNITO) {
      showMessage('Configuration error: Missing Cognito settings', true);
      console.error('CONFIG not available or missing COGNITO:', typeof CONFIG !== 'undefined' ? CONFIG : 'undefined');
      return;
    }

    // Validate CONFIG.COGNITO properties
    if (!CONFIG.COGNITO.userPoolId || !CONFIG.COGNITO.clientId) {
      showMessage('Configuration error: Missing required Cognito parameters', true);
      console.error('CONFIG.COGNITO missing properties:', CONFIG.COGNITO);
      return;
    }

    // Initialize SafariCognitoAuth with proper checks
    if (typeof SafariCognitoAuth === 'undefined') {
      showMessage('Authentication library not loaded', true);
      console.error('SafariCognitoAuth not available');
      return;
    }

    try {
      cognitoAuth = new SafariCognitoAuth(CONFIG.COGNITO);
      console.log('Authentication initialized successfully');

      // Check authentication status
      checkAuthStatus();
    } catch (error) {
      console.error('Authentication initialization error:', error);
      showMessage(`Authentication initialization failed: ${error.message}`, true);
      showAuthRequired();
    }

    // Set up event listeners with error handling
    setupEventListeners();
  }, 100); // Small delay to ensure config.js has loaded
});

const handleAuthClick = async () => {
  console.log('handleAuthClick called');
  console.log('cognitoAuth available:', !!cognitoAuth);
  console.log('CONFIG.ENVIRONMENT:', CONFIG.ENVIRONMENT);
  
  if (!cognitoAuth) {
    showMessage('Authentication not initialized', true);
    return;
  }

  showMessage('Starting authentication...');

  // For development mode, provide a simple authentication bypass
  if (CONFIG.ENVIRONMENT === 'development') {
    console.log('Using development mode authentication');
    try {
      // Simulate successful authentication for development
      const mockUser = {
        name: 'Developer',
        email: 'dev@localhost',
        id: 'dev-user-local'
      };

      // Store mock authentication state
      localStorage.setItem('recipeArchive.dev.authenticated', 'true');
      localStorage.setItem('recipeArchive.dev.user', JSON.stringify(mockUser));

      console.log('Development authentication successful');
      showMessage(`Authentication successful! Welcome, ${mockUser.name}!`);
      showMainInterface();
      setupDevControls();
      return;
    } catch (error) {
      console.error('Development authentication error:', error);
      showMessage(`Development authentication failed: ${error.message}`, true);
      return;
    }
  }

  // For production mode, implement proper OAuth flow
  try {
    console.log('Using production mode authentication (not implemented)');
    // This would trigger the actual OAuth flow for production
    // For now, show instruction to user
    showMessage('Production authentication not yet implemented. Please use development mode.', true);
    
    // TODO: Implement production OAuth flow
    // const result = await cognitoAuth.initiateOAuth();
    // if (result.success) {
    //   showMainInterface();
    // } else {
    //   showMessage(`Authentication failed: ${result.error}`, true);
    // }
  } catch (error) {
    console.error('Production authentication error:', error);
    showMessage(`Authentication error: ${error.message}`, true);
  }
};

const handleSignOut = async () => {
  if (!cognitoAuth) {
    showMessage('Authentication not initialized', true);
    return;
  }

  try {
    // Handle development mode sign out
    if (CONFIG.ENVIRONMENT === 'development') {
      localStorage.removeItem('recipeArchive.dev.authenticated');
      localStorage.removeItem('recipeArchive.dev.user');
      showMessage('Signed out successfully (Development Mode)');
      showAuthRequired();
      return;
    }

    // Handle production sign out
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
    // Check for development mode authentication first
    if (CONFIG.ENVIRONMENT === 'development') {
      const isDevAuthenticated = localStorage.getItem('recipeArchive.dev.authenticated');
      const devUserData = localStorage.getItem('recipeArchive.dev.user');
      
      if (isDevAuthenticated === 'true' && devUserData) {
        const user = JSON.parse(devUserData);
        showMessage(`Welcome, ${user.name}! (Development Mode)`);
        showMainInterface();
        setupDevControls();
        return;
      }
    }

    // Check production authentication
    const result = await cognitoAuth.getCurrentUser();

    if (result.success && result.user) {
      showMessage(`Welcome, ${result.user.name}!`);
      showMainInterface();
      setupDevControls();
    } else {
      showMessage(`Authentication check failed: ${result.error || 'No authenticated user'}`, true);
      showAuthRequired();
    }
  } catch (error) {
    showMessage(`Error checking authentication: ${error.message}`, true);
    showAuthRequired();
  }
};

const setupEventListeners = () => {
  console.log('Setting up event listeners...');
  
  // Sign In button - check for both possible IDs
  const signInButton = document.getElementById('authButton') || document.getElementById('sign-in-btn');
  if (signInButton) {
    console.log('Sign In button found, attaching event listener');
    signInButton.addEventListener('click', () => {
      console.log('Sign In button clicked');
      handleAuthClick();
    });
  } else {
    console.error('Sign In button not found - checked IDs: authButton, sign-in-btn');
  }

  // Sign Out button - check for both possible IDs
  const signOutButton = document.getElementById('logoutButton') || document.getElementById('sign-out-btn');
  if (signOutButton) {
    console.log('Sign Out button found, attaching event listener');
    signOutButton.addEventListener('click', () => {
      console.log('Sign Out button clicked');
      handleSignOut();
    });
  } else {
    console.warn('Sign Out button not found - checked IDs: logoutButton, sign-out-btn');
  }

  // Capture Recipe button
  const captureButton = document.getElementById('captureBtn');
  if (captureButton) {
    console.log('Capture button found, attaching event listener');
    captureButton.addEventListener('click', () => {
      console.log('Capture button clicked');
      captureRecipe();
    });
  } else {
    console.warn('Capture button not found - checked ID: captureBtn');
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

    extensionAPI.tabs.sendMessage(activeTab.id, { action: 'captureRecipe' }, (response) => {
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
