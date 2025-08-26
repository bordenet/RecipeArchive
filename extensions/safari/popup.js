/* eslint-disable no-unused-vars */
/* global CONFIG, SafariCognitoAuth */

// Global extension API reference
let extensionAPI;

// Cached DOM elements
let domElements = {};

// Safari RecipeArchive Extension - Popup Script with Authentication
document.addEventListener('DOMContentLoaded', async function() {
  console.log('RecipeArchive Safari: Popup loaded');
  
  // Cache DOM elements
  domElements = {
    authSection: document.getElementById('authSection'),
    captureBtn: document.getElementById('captureBtn'),
    authButton: document.getElementById('authButton'),
    logoutButton: document.getElementById('logoutButton'),
    userInfo: document.getElementById('userInfo'),
    message: document.getElementById('message'),
    devControls: document.getElementById('devControls'),
    devBypass: document.getElementById('devBypass'),
    emergencyDevBypass: document.getElementById('emergencyDevBypass')
  };
  
  // Add debug indicator
  showMessage('Popup loaded, checking extension API...', 'info');
  
  // Cross-browser compatibility
  extensionAPI = (function() {
    if (typeof browser !== 'undefined') return browser;
    if (typeof chrome !== 'undefined') return chrome;
    return null;
  })();
  
  if (!extensionAPI) {
    console.error('RecipeArchive Safari: No extension API available');
    showMessage('Extension API not available', 'error');
    return;
  }

  showMessage('Extension API found, checking dev bypass...', 'info');

  // Check for development bypass flag
  const devBypass = localStorage.getItem('recipeArchive.devBypass');
  if (devBypass === 'true') {
    console.log('🔧 Development bypass active - skipping auth');
    showMessage('Ready to capture recipes (dev bypass active)', 'success');
    showMainInterface('dev-user');
    return;
  }

  showMessage('Loading configuration...', 'info');

  // Make config available globally
  try {
    if (typeof CONFIG === 'undefined') {
      throw new Error('CONFIG not loaded - check config.js script tag');
    }
    window.RecipeArchiveConfig = CONFIG;
    console.log('RecipeArchive Safari: Config loaded', CONFIG);
    showMessage('Configuration loaded, checking authentication...', 'info');
  } catch (error) {
    console.error('RecipeArchive Safari: Config error', error);
    showMessage('Configuration error: ' + error.message, 'error');
    return;
  }

  // Check auth status
  try {
    console.log('RecipeArchive Safari: Starting auth check');
    await checkAuthStatus();
    console.log('RecipeArchive Safari: Auth check complete');
  } catch (error) {
    console.error('RecipeArchive Safari: Auth check failed', error);
    showMessage('Authentication check failed: ' + error.message, 'error');
    showAuthRequired();
  }

  // Setup development controls
  setupDevControls();
  
  // Emergency dev bypass handler
  domElements.emergencyDevBypass.addEventListener('change', function(e) {
    if (e.target.checked) {
      localStorage.setItem('recipeArchive.devBypass', 'true');
      showMessage('Dev bypass enabled - reloading extension...', 'info');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  });
});

async function checkAuthStatus() {
  console.log('RecipeArchive Safari: checkAuthStatus called');
  
  // Set up a timeout for the entire auth check process
  const authTimeout = setTimeout(() => {
    console.error('RecipeArchive Safari: Authentication check timed out');
    showMessage('Authentication check timed out. Check emergency bypass or reload extension.', 'error');
    showAuthRequired();
  }, 10000); // 10 second timeout
  
  try {
    showMessage('Step 1: Getting configuration...', 'info');
    
    const config = window.RecipeArchiveConfig;
    if (!config) {
      throw new Error('RecipeArchiveConfig not available - check config.js script tag');
    }
    console.log('RecipeArchive Safari: Config environment', config.ENVIRONMENT);
    
    showMessage('Step 2: Getting Cognito configuration...', 'info');
    
    // Always use Cognito for both dev and production
    const cognitoConfig = config.getCognitoConfig();
    console.log('RecipeArchive Safari: Cognito config', cognitoConfig);
    
    showMessage('Step 3: Checking SafariCognitoAuth availability...', 'info');
    
    // Check if SafariCognitoAuth is available
    if (typeof SafariCognitoAuth === 'undefined') {
      throw new Error('SafariCognitoAuth not loaded - check cognito-auth.js script tag');
    }
    
    showMessage('Step 4: Initializing authentication...', 'info');
    
    // Create Safari-compatible Cognito auth
    const cognitoAuth = new SafariCognitoAuth(cognitoConfig);
    console.log('RecipeArchive Safari: SafariCognitoAuth initialized');
    
    showMessage('Step 5: Checking for existing session...', 'info');
    
    const userResult = await cognitoAuth.getCurrentUser();
    console.log('RecipeArchive Safari: getCurrentUser result', userResult);
    
    showMessage('Step 6: Processing authentication result...', 'info');
    
    clearTimeout(authTimeout); // Clear timeout on success
    
    if (userResult.success) {
      showMessage('Authentication successful!', 'success');
      showMainInterface(userResult.data.email);
    } else {
      console.log('RecipeArchive Safari: No active session, calling showAuthRequired');
      showAuthRequired();
    }
  } catch (error) {
    clearTimeout(authTimeout); // Clear timeout on error
    console.error('RecipeArchive Safari: Error checking auth status:', error);
    
    // Use enhanced error handling if available
    let errorMessage = error.message;
    if (typeof window !== 'undefined' && window.authErrorHandler) {
      window.authErrorHandler.logError('checkAuthStatus', error, { 
        context: 'popup-initialization',
        url: window.location.href 
      });
      errorMessage = window.authErrorHandler.getUserFriendlyMessage(error);
    }
    
    showMessage(`Authentication Error: ${errorMessage}`, 'error');
    showAuthRequired();
  }
}

function showAuthRequired() {
  console.log('RecipeArchive Safari: showAuthRequired called');
  
  // Show auth section, hide capture button
  domElements.authSection.style.display = 'block';
  domElements.captureBtn.style.display = 'none';
  domElements.authButton.style.display = 'block';
  domElements.logoutButton.style.display = 'none';
  
  domElements.authButton.textContent = 'Sign In / Sign Up';
  domElements.authButton.onclick = () => {
    window.location.href = 'auth.html';
  };
  
  console.log('RecipeArchive Safari: About to show auth required message');
  showMessage('Authentication required. Please sign in to capture recipes.', 'info');
  console.log('RecipeArchive Safari: showAuthRequired complete');
}

function showMainInterface(username) {
  // Show user info and capture functionality
  domElements.authSection.style.display = 'block';
  domElements.userInfo.style.display = 'block';
  domElements.userInfo.textContent = `Welcome, ${username}`;
  
  domElements.authButton.style.display = 'none';
  domElements.logoutButton.style.display = 'block';
  domElements.captureBtn.style.display = 'block';
  
  // Setup logout handler
  domElements.logoutButton.onclick = async () => {
    try {
      const cognitoAuth = new SafariCognitoAuth(CONFIG.getCognitoConfig());
      await cognitoAuth.signOut();
      showMessage('Signed out successfully', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Logout error:', error);
      showMessage('Error signing out: ' + error.message, 'error');
    }
  };
  
  // Setup capture handler
  domElements.captureBtn.addEventListener('click', function() {
    console.log('RecipeArchive Safari: Capture button clicked');
    captureRecipe();
  });
  
  showMessage('Ready to capture recipes!', 'success');
}

function captureRecipe() {
  showMessage('Extracting recipe...', 'info');
  domElements.captureBtn.disabled = true;
  
  extensionAPI.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || tabs.length === 0) {
      showMessage('No active tab found', 'error');
      captureBtn.disabled = false;
      return;
    }
    
    const activeTab = tabs[0];
    console.log('RecipeArchive Safari: Sending message to tab:', activeTab.id);
    
    extensionAPI.tabs.sendMessage(activeTab.id, { action: 'captureRecipe' }, async function(response) {
      captureBtn.disabled = false;
      
      if (extensionAPI.runtime.lastError) {
        console.error('RecipeArchive Safari: Runtime error:', extensionAPI.runtime.lastError);
        showMessage('Error: ' + extensionAPI.runtime.lastError.message, 'error');
        return;
      }
      
      if (!response) {
        console.error('RecipeArchive Safari: No response from content script');
        showMessage('No response from page. Try refreshing the page.', 'error');
        return;
      }
      
      if (response.success) {
        console.log('RecipeArchive Safari: Recipe captured successfully');
        showMessage('Recipe captured successfully!', 'success');
        console.log('Recipe data:', response.recipe);
        
        // Send to backend if authenticated
        const devBypass = localStorage.getItem('recipeArchive.devBypass');
        if (devBypass !== 'true') {
          try {
            await sendRecipeToBackend(response.recipe);
            showMessage('Recipe saved to your archive!', 'success');
          } catch (error) {
            console.error('Backend save error:', error);
            showMessage('Recipe captured but failed to save: ' + error.message, 'error');
          }
        }
      } else {
        console.error('RecipeArchive Safari: Capture failed:', response.error);
        showMessage('Error: ' + response.error, 'error');
      }
    });
  });
}

async function sendRecipeToBackend(recipe) {
  const operation = 'sendRecipeToBackend';
  
  try {
    // Performance monitoring
    if (typeof window !== 'undefined' && window.authPerformanceMonitor) {
      window.authPerformanceMonitor.startTimer(operation);
    }
    
    const config = window.RecipeArchiveConfig;
    const api = config.getCurrentAPI();
    
    // Get auth token with enhanced error handling
    const cognitoAuth = new SafariCognitoAuth(config.getCognitoConfig());
    const tokenResult = await cognitoAuth.getIdToken();
    
    if (!tokenResult.success) {
      throw new Error('Authentication required: ' + (tokenResult.error || 'No token available'));
    }
    
    // Enhanced request with retry logic
    const makeRequest = async () => {
      const response = await fetch(api.recipes, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenResult.data}`,
          'X-Recipe-Source': 'safari-extension',
          'X-Recipe-Version': '1.0'
        },
        body: JSON.stringify({
          ...recipe,
          capturedAt: new Date().toISOString(),
          source: 'safari-extension'
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // Use default message if parsing fails
        }
        
        const error = new Error(errorMessage);
        error.status = response.status;
        error.__type = response.status >= 500 ? 'ServiceUnavailableException' : 'ClientError';
        throw error;
      }
      
      return await response.json();
    };
    
    // Execute with retry logic
    let result;
    if (typeof window !== 'undefined' && window.authErrorHandler) {
      result = await window.authErrorHandler.executeWithRetry(makeRequest, operation, {
        recipeTitle: recipe.title ? recipe.title.substring(0, 50) + '...' : 'Untitled',
        apiUrl: api.recipes
      });
    } else {
      result = await makeRequest();
    }
    
    // Performance success
    if (typeof window !== 'undefined' && window.authPerformanceMonitor) {
      window.authPerformanceMonitor.endTimer(operation, true);
    }
    
    return result;
  } catch (error) {
    // Performance failure
    if (typeof window !== 'undefined' && window.authPerformanceMonitor) {
      window.authPerformanceMonitor.endTimer(operation, false);
    }
    
    // Enhanced error logging
    if (typeof window !== 'undefined' && window.authErrorHandler) {
      window.authErrorHandler.logError(operation, error, {
        recipeTitle: recipe.title ? recipe.title.substring(0, 50) + '...' : 'Untitled',
        hasToken: !!tokenResult?.data
      });
    }
    
    throw error;
  }
}

function setupDevControls() {
  // Show dev controls in development
  if (CONFIG.ENVIRONMENT === 'development') {
    domElements.devControls.style.display = 'block';
    domElements.devBypass.checked = localStorage.getItem('recipeArchive.devBypass') === 'true';
    
    domElements.devBypass.addEventListener('change', (e) => {
      localStorage.setItem('recipeArchive.devBypass', e.target.checked ? 'true' : 'false');
      showMessage(e.target.checked ? 'Dev bypass enabled - reload extension' : 'Dev bypass disabled - reload extension', 'info');
    });
  }
}

function showMessage(text, type) {
  console.log('RecipeArchive Safari: ' + type.toUpperCase() + ' - ' + text);
  
  if (!domElements || !domElements.message) {
    console.error('RecipeArchive Safari: domElements.message not available, falling back to direct DOM access');
    const messageEl = document.getElementById('message');
    if (messageEl) {
      messageEl.textContent = text;
      messageEl.className = 'message ' + type;
    } else {
      console.error('RecipeArchive Safari: message element not found in DOM');
    }
    return;
  }
  
  domElements.message.textContent = text;
  domElements.message.className = 'message ' + type;
}