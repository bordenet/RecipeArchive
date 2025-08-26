/* global SafariCognitoAuth */

// Safari Web Extension Popup Script  
// Compatible with Safari desktop and mobile browsers

// Cross-browser compatibility - declare globally to prevent duplicates
if (typeof window.browserAPI === 'undefined') {
  window.browserAPI = typeof browser !== 'undefined' ? browser : chrome;
}
const browserAPI = window.browserAPI;

document.addEventListener('DOMContentLoaded', async function () {
  // Make config available globally - use window.CONFIG from config.js
  window.RecipeArchiveConfig = window.CONFIG || window.RecipeArchiveConfig;
  
  // Check if auth is configured on page load
  await checkAuthStatus();
});

async function checkAuthStatus() {
  try {
    const config = window.RecipeArchiveConfig;
    
    if (config.ENVIRONMENT === 'development') {
      // In development, check for basic auth setup
      const authData = await browserAPI.storage.local.get([
        'username',
        'password',
        'authConfigured',
      ]);

      if (!authData.authConfigured) {
        showSetupRequired();
      } else {
        showMainInterface(authData.username);
      }
      return;
    }
    
    // Production: Check Cognito authentication
    const cognitoConfig = config.getCognitoConfig();
    const cognitoAuth = new SafariCognitoAuth(cognitoConfig);
    
    const userResult = await cognitoAuth.getCurrentUser();
    
    if (userResult.success) {
      showMainInterface(userResult.data.email);
    } else {
      showCognitoAuthRequired();
    }
  } catch (error) {
    console.error('Safari Extension - Error checking auth status:', error);
    showSetupRequired();
  }
}

function showCognitoAuthRequired() {
  document.getElementById('status').innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <h2>🔐 Authentication Required</h2>
      <p>Please sign in to your RecipeArchive account to use this extension.</p>
      <button id="authBtn" style="padding: 10px 20px; background: #007AFF; color: white; border: none; border-radius: 8px; cursor: pointer; margin: 8px;">
        Sign In / Sign Up
      </button>
    </div>
  `;

  document.getElementById('authBtn').addEventListener('click', () => {
    window.location.href = 'auth.html';
  });

  // Hide the capture button
  document.getElementById('capture').style.display = 'none';
}

function showSetupRequired() {
  // Show setup button in status area
  document.getElementById('status').innerHTML = `
    <div style="text-align: center; padding: 15px;">
      <h3 style="margin: 0 0 10px 0; color: #333;">🔐 Authentication Required</h3>
      <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">Configure your credentials to start capturing recipes</p>
      <button id="setupBtn" style="padding: 10px 20px; background: #007AFF; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
        ⚙️ Setup Authentication
      </button>
    </div>
  `;

  document.getElementById('setupBtn').addEventListener('click', () => {
    window.location.href = 'setup.html';
  });

  // Change capture button to redirect to setup
  const captureButton = document.getElementById('capture');
  captureButton.textContent = '⚙️ Configure Setup';
  captureButton.style.background = '#FF9500';
  captureButton.onclick = () => {
    window.location.href = 'setup.html';
  };
}

function showMainInterface(username) {
  // Show welcome message
  const welcomeDiv = document.createElement('div');
  welcomeDiv.innerHTML = `
    <div style="font-size: 12px; color: #666; margin-bottom: 10px; text-align: center;">
      Welcome, ${username} | <a href="#" id="settingsLink" style="color: #666;">Settings</a>
    </div>
  `;
  document.body.insertBefore(welcomeDiv, document.getElementById('capture'));

  // Add settings click handler
  document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'setup.html';
  });

  // Show the capture button
  document.getElementById('capture').style.display = 'block';
}

document.getElementById('capture').addEventListener('click', async () => {
  // Check auth before capturing
  const authData = await browserAPI.storage.local.get([
    'username',
    'password',
    'authConfigured',
  ]);

  if (!authData.authConfigured) {
    // Redirect to setup instead of just showing error
    window.location.href = 'setup.html';
    return;
  }

  const captureButton = document.getElementById('capture');
  const originalText = captureButton.textContent;
  captureButton.textContent = 'Capturing...';
  captureButton.disabled = true;
  
  document.getElementById('status').textContent = 'Analyzing recipe on this page...';

  browserAPI.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tabId = tabs[0].id;
    // Try sending message first
    browserAPI.tabs.sendMessage(
      tabId,
      { action: 'captureRecipe' },
      function (response) {
        if (browserAPI.runtime.lastError || !response) {
          // If no response, inject content script then retry
          browserAPI.scripting.executeScript(
            {
              target: { tabId },
              files: ['content.js'],
            },
            () => {
              // Retry sending message
              browserAPI.tabs.sendMessage(
                tabId,
                { action: 'captureRecipe' },
                function (response2) {
                  if (response2 && response2.status === 'success') {
                    renderRecipe(response2.data);
                  } else if (
                    response2 &&
                    response2.status === 'extraction_failed'
                  ) {
                    handleExtractionFailure(response2);
                  } else if (response2 && response2.status === 'error') {
                    document.getElementById('status').textContent =
                      'Unable to extract recipe: ' + response2.error;
                  } else {
                    document.getElementById('status').textContent =
                      'No recipe found on this page.';
                  }
                  // Reset capture button
                  captureButton.textContent = originalText;
                  captureButton.disabled = false;
                }
              );
            }
          );
        } else if (response && response.status === 'success') {
          renderRecipe(response.data);
        } else if (response && response.status === 'extraction_failed') {
          handleExtractionFailure(response);
        } else if (response && response.status === 'error') {
          document.getElementById('status').textContent =
            'Unable to extract recipe: ' + response.error;
          captureButton.textContent = originalText;
          captureButton.disabled = false;
        } else {
          document.getElementById('status').textContent =
            'No recipe found on this page.';
          captureButton.textContent = originalText;
          captureButton.disabled = false;
        }
      }
    );
  });
});

function renderRecipe(data) {
  // Store the captured recipe data for syncing
  browserAPI.storage.local.set({ lastCapturedRecipe: data });
  
  // Reset capture button
  const captureButton = document.getElementById('capture');
  captureButton.textContent = 'Capture Recipe';
  captureButton.disabled = false;
  
  document.getElementById('status').textContent = 'Recipe extracted successfully!';
  let html = '';

  // Add save button for AWS backend integration
  html += `<div style="text-align: center; margin-bottom: 15px;">
    <button onclick="saveToAWS()" style="padding: 10px 20px; background: #007AFF; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 500;">
      💾 Save Recipe
    </button>
    <div style="font-size: 12px; color: #666; margin-top: 5px;">Save to your recipe collection</div>
  </div>`;

  // Ingredients (with sections)
  html += '<h2>Ingredients</h2>';
  if (Array.isArray(data.ingredients)) {
    data.ingredients.forEach((section) => {
      if (section.title) html += `<h3>${section.title}</h3>`;
      html += '<ul>';
      section.items.forEach((item) => {
        html += `<li>${item}</li>`;
      });
      html += '</ul>';
    });
  }
  // Steps (with sections)
  html += '<h2>Steps</h2>';
  if (Array.isArray(data.steps)) {
    data.steps.forEach((section) => {
      if (section.title) html += `<h3>${section.title}</h3>`;
      html += '<ol>';
      section.items.forEach((item) => {
        html += `<li>${item}</li>`;
      });
      html += '</ol>';
    });
  }
  // Serving size
  html += `<h2>Serving Size</h2><p>${data.servingSize || 'N/A'}</p>`;
  // Time
  html += `<h2>Time</h2><p>${data.time || 'N/A'}</p>`;
  // Photos
  html += '<h2>Photos</h2>';
  if (Array.isArray(data.photos) && data.photos.length > 0) {
    data.photos.forEach((url) => {
      html += `<img src="${url}" alt="Recipe photo" style="max-width:100px;max-height:100px;margin:2px;" />`;
    });
  } else {
    html += '<p>N/A</p>';
  }
  // Attribution URL
  html += `<h2>Attribution URL</h2><p><a href="${data.attributionUrl}" target="_blank">${data.attributionUrl}</a></p>`;
  // Full page archive (show as downloadable link)
  html += `<h2>Full Page Archive</h2><a href="data:text/html;charset=utf-8,${encodeURIComponent(data.fullPageArchive)}" download="recipe-archive.html">Download HTML</a>`;
  // JSON payload (for debug/future API push)
  html += `<h2>Raw JSON</h2><pre style="white-space:pre-wrap;word-break:break-all;max-height:200px;overflow:auto;">${JSON.stringify(data, null, 2)}</pre>`;
  document.getElementById('status').innerHTML = html;
}

// Helper function to get authentication token (Cognito integration)
async function getAuthToken() {
  try {
    const config = window.RecipeArchiveConfig;
    const cognitoConfig = config.getCognitoConfig();
    
    if (config.ENVIRONMENT === 'development') {
      // Use mock token for development
      return 'development-mock-token';
    }
    
    // Initialize Cognito auth for Safari
    const cognitoAuth = new SafariCognitoAuth(cognitoConfig);
    
    // Get valid access token
    const accessToken = await cognitoAuth.getAccessToken();
    
    if (!accessToken) {
      throw new Error('No valid authentication token available');
    }
    
    return accessToken;
  } catch (error) {
    console.error('Safari Extension - Failed to get auth token:', error);
    throw error;
  }
}

// Recipe save function with automatic duplicate overwrite
// eslint-disable-next-line no-unused-vars
async function saveToAWS() {
  const syncButton = event.target;
  const originalText = syncButton.textContent;
  
  try {
    syncButton.textContent = '💾 Saving...';
    syncButton.disabled = true;

    const authData = await browserAPI.storage.local.get(['username', 'password']);

    if (!authData.username || !authData.password) {
      alert('Authentication not configured');
      return;
    }

    // Get the most recently captured recipe data
    const recipeData = await browserAPI.storage.local.get(['lastCapturedRecipe']);
    
    if (!recipeData.lastCapturedRecipe) {
      alert('No recipe data to sync. Please capture a recipe first.');
      return;
    }

    // Use configuration system to get API endpoint
    const config = window.RecipeArchiveConfig;
    const api = config.getCurrentAPI();
    
    console.log(`Safari Extension - Saving to ${config.ENVIRONMENT} environment:`, api.recipes);

    // Prepare payload for AWS backend
    const payload = {
      title: recipeData.lastCapturedRecipe.title || 'Untitled Recipe',
      url: recipeData.lastCapturedRecipe.attributionUrl,
      ingredients: recipeData.lastCapturedRecipe.ingredients || [],
      instructions: recipeData.lastCapturedRecipe.steps || [],
      servingSize: recipeData.lastCapturedRecipe.servingSize,
      prepTime: recipeData.lastCapturedRecipe.time,
      cookTime: recipeData.lastCapturedRecipe.cookTime,
      totalTime: recipeData.lastCapturedRecipe.totalTime,
      photos: recipeData.lastCapturedRecipe.photos || [],
      fullPageArchive: recipeData.lastCapturedRecipe.fullPageArchive,
      extractedAt: new Date().toISOString(),
      extractedBy: authData.username,
      extensionVersion: browserAPI.runtime.getManifest().version
    };

    console.log('Safari Extension - Saving recipe to AWS:', payload);

    // Prepare headers based on environment
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'RecipeArchive-Safari-Extension'
    };

    // Add authorization for local development (mock token) or production (real JWT)
    if (config.ENVIRONMENT === 'development') {
      headers['Authorization'] = `Bearer ${authData.username}-safari-extension-token`;
    } else {
      // Add real Cognito JWT token for production
      headers['Authorization'] = 'Bearer ' + await getAuthToken();
    }

    // Use PUT method to automatically overwrite duplicates (idempotent)
    // Generate consistent recipe ID from URL for duplicate detection
    const recipeId = btoa(payload.url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    
    const response = await fetch(`${api.recipes}/${recipeId}`, {
      method: 'PUT', // PUT for idempotent save with overwrite
      headers: headers,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Safari Extension - Recipe saved successfully:', result);

    syncButton.textContent = '✅ Saved!';
    syncButton.style.background = '#28CD41';
    
    // Show success message
    const statusDiv = document.getElementById('status');
    const successMsg = document.createElement('div');
    successMsg.innerHTML = `
      <div style="color: #007AFF; text-align: center; padding: 10px; margin-top: 10px; border: 1px solid #007AFF; border-radius: 8px; background: #e8f4ff;">
        <strong>✅ Recipe Saved!</strong><br>
        <small>Added to your recipe collection</small>
      </div>
    `;
    statusDiv.appendChild(successMsg);

    // Reset button after delay
    setTimeout(() => {
      syncButton.textContent = originalText;
      syncButton.style.background = '#007AFF';
      syncButton.disabled = false;
    }, 3000);

  } catch (error) {
    console.error('Safari Extension - Save error:', error);
    
    // Trigger automatic diagnostics on AWS save failure
    await triggerAutomaticDiagnostics(error);
    
    syncButton.textContent = '❌ Failed';
    syncButton.style.background = '#FF3B30';
    
    // Show error message
    const statusDiv = document.getElementById('status');
    const errorMsg = document.createElement('div');
    errorMsg.innerHTML = `
      <div style="color: #FF3B30; text-align: center; padding: 10px; margin-top: 10px; border: 1px solid #FF3B30; border-radius: 8px; background: #ffebee;">
        <strong>❌ Save Failed</strong><br>
        <small>${error.message}</small>
      </div>
    `;
    statusDiv.appendChild(errorMsg);
    
    // Reset button after delay
    setTimeout(() => {
      syncButton.textContent = originalText;
      syncButton.style.background = '#007AFF';
      syncButton.disabled = false;
    }, 3000);
  }
}

async function handleExtractionFailure(response) {
  console.log(
    'Safari Extension - Recipe extraction failed, auto-triggering diagnostics:',
    response
  );

  // Reset capture button
  const captureButton = document.getElementById('capture');
  captureButton.textContent = 'Capture Recipe';
  captureButton.disabled = false;

  // Automatically send diagnostics without user interaction
  await triggerAutomaticDiagnostics('Recipe extraction failed');

  // Show user feedback
  document.getElementById('status').innerHTML = `
    <div style="color: #FF9500; text-align: center; padding: 15px; border: 1px solid #FFD60A; border-radius: 8px; background: #fff9e6;">
      <strong>⚠️ No Recipe Found</strong><br>
      <small>This site may not be supported yet</small><br>
      <small style="color: #666; margin-top: 5px; display: block;">We're working to support more recipe websites</small>
    </div>
  `;

  // Show any partial data that was extracted
  if (response.data) {
    let partialHtml =
      '<div style="margin-top: 15px; padding: 10px; background: #f5f5f5; border-radius: 8px;">';
    partialHtml += '<h3 style="margin-top: 0;">Partial Data Found:</h3>';

    if (response.data.title) {
      partialHtml += `<p><strong>Title:</strong> ${response.data.title}</p>`;
    }
    if (response.data.ingredients && response.data.ingredients.length > 0) {
      partialHtml += `<p><strong>Ingredients:</strong> ${response.data.ingredients.length} found</p>`;
    }
    if (response.data.steps && response.data.steps.length > 0) {
      partialHtml += `<p><strong>Steps:</strong> ${response.data.steps.length} found</p>`;
    }

    partialHtml += '</div>';
    document.getElementById('status').innerHTML += partialHtml;
  }
}

// Automatic diagnostic capture (internal function, not user-facing)
async function triggerAutomaticDiagnostics(errorContext) {
  try {
    console.log('Safari Extension - Auto-triggering diagnostic capture for:', errorContext);
    
    const [tab] = await browserAPI.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Send diagnostic capture message to content script
    const response = await browserAPI.tabs.sendMessage(tab.id, {
      action: 'captureDiagnostics',
      timestamp: new Date().toISOString(),
      url: tab.url,
      errorContext: errorContext
    });

    if (response && response.status === 'success') {
      await sendDiagnosticData(response.data, tab.url);
      console.log('Safari Extension - Automatic diagnostics sent successfully');
    }
  } catch (error) {
    console.warn('Safari Extension - Automatic diagnostic capture failed (non-critical):', error);
    // Don't show this error to user - diagnostics are background functionality
  }
}

async function sendDiagnosticData(diagnosticData, url) {
  // Use configuration system to determine endpoint
  const config = window.RecipeArchiveConfig;
  const api = config.getCurrentAPI();
  
  console.log(`Safari Extension - Using ${config.ENVIRONMENT} environment:`, api.diagnostics);

  try {
    const payload = {
      url: url,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      extensionVersion: browserAPI.runtime.getManifest().version,
      platform: 'Safari',
      environment: config.ENVIRONMENT,
      diagnosticData: diagnosticData,
    };

    // Log to console for debugging
    console.log('Safari Extension - Diagnostic data prepared for API:', payload);

    // Make actual API call
    const response = await fetch(api.diagnostics, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'RecipeArchive-Safari-Extension',
          // TODO: Add authentication for production
          ...(config.ENVIRONMENT === 'production' && {
            'Authorization': 'Bearer ' + await getAuthToken()
          })
        },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('Safari Extension - Diagnostic data sent successfully:', result);
  } catch (error) {
    console.error(`Safari Extension - Failed to send diagnostic data to ${config.ENVIRONMENT}:`, error);
    
    // Fallback to local logging if API call fails
    console.log('Safari Extension - Storing diagnostic data locally as fallback');
    throw error;
  }
}