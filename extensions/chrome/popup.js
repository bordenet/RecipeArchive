/* eslint-disable no-unused-vars */
/* global CONFIG, ChromeCognitoAuth */

document.addEventListener('DOMContentLoaded', async function () {
  console.log('Chrome Extension: DOM loaded');
  
  // Check for development bypass flag
  const devBypass = localStorage.getItem('recipeArchive.devBypass');
  if (devBypass === 'true') {
    console.log('🔧 Development bypass active - skipping auth');
    document.getElementById('status').textContent = 'Ready to capture recipes (dev bypass active)';
    showMainInterface('dev-user');
    await initializeDiagnosticMode();
    return;
  }
  
  // Make config available globally
  window.RecipeArchiveConfig = CONFIG;
  console.log('Chrome Extension: Config loaded', CONFIG);
  
  // Check if auth is configured on page load
  try {
    console.log('Chrome Extension: Starting auth check');
    await checkAuthStatus();
    console.log('Chrome Extension: Auth check complete');
  } catch (error) {
    console.error('Chrome Extension: Auth check failed', error);
    document.getElementById('status').textContent = 'Authentication check failed: ' + error.message;
  }

  // Initialize diagnostic mode
  await initializeDiagnosticMode();
});

async function initializeDiagnosticMode() {
  // Load diagnostic mode state
  const result = await chrome.storage.local.get(['diagnosticMode']);
  const toggle = document.getElementById('diagnosticToggle');
  const status = document.getElementById('diagnosticStatus');

  if (toggle) {
    toggle.checked = result.diagnosticMode || false;

    // Add toggle event listener
    toggle.addEventListener('change', async (e) => {
      const isEnabled = e.target.checked;
      await chrome.storage.local.set({ diagnosticMode: isEnabled });

      if (status) {
        status.textContent = isEnabled
          ? '🔍 Diagnostic Mode: ON'
          : '🔍 Diagnostic Mode: OFF';
        status.className = isEnabled
          ? 'diagnostic-active'
          : 'diagnostic-inactive';
      }

      console.log(`Diagnostic mode ${isEnabled ? 'enabled' : 'disabled'}`);
    });
  }

  if (status) {
    const isActive = result.diagnosticMode || false;
    status.textContent = isActive
      ? '🔍 Diagnostic Mode: ON'
      : '🔍 Diagnostic Mode: OFF';
    status.className = isActive ? 'diagnostic-active' : 'diagnostic-inactive';
  }

  // Add diagnostic capture button listener
  const diagnosticBtn = document.getElementById('diagnosticBtn');
  if (diagnosticBtn) {
    diagnosticBtn.addEventListener('click', async () => {
      await captureDiagnostics();
    });
  }
}

async function captureDiagnostics() {
  const diagnosticBtn = document.getElementById('diagnosticBtn');

  try {
    if (diagnosticBtn) {
      diagnosticBtn.textContent = 'Capturing...';
      diagnosticBtn.disabled = true;
    }

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Send diagnostic capture message to content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'captureDiagnostics',
      timestamp: new Date().toISOString(),
      url: tab.url,
    });

    if (response && response.status === 'success') {
      // Send diagnostic data to AWS
      await sendDiagnosticData(response.data, tab.url);

      if (diagnosticBtn) {
        diagnosticBtn.textContent = '✅ Sent to AWS';
        setTimeout(() => {
          diagnosticBtn.textContent = '📊 Capture Diagnostics';
          diagnosticBtn.disabled = false;
        }, 2000);
      }

      // Show success message
      document.getElementById('status').innerHTML = `
        <div style="color: #4CAF50; text-align: center; padding: 10px;">
          <strong>✅ Diagnostic Data Captured!</strong><br>
          <small>Page analysis sent to AWS for parser improvement</small>
        </div>
      `;
    } else {
      throw new Error('Failed to capture diagnostic data from content script');
    }
  } catch (error) {
    console.error('Diagnostic capture failed:', error);

    if (diagnosticBtn) {
      diagnosticBtn.textContent = '❌ Failed';
      setTimeout(() => {
        diagnosticBtn.textContent = '📊 Capture Diagnostics';
        diagnosticBtn.disabled = false;
      }, 2000);
    }

    document.getElementById('status').innerHTML = `
      <div style="color: #f44336; text-align: center; padding: 10px;">
        <strong>❌ Diagnostic Capture Failed</strong><br>
        <small>${error.message}</small>
      </div>
    `;
  }
}

async function sendDiagnosticData(diagnosticData, url) {
  // Use configuration system to determine endpoint
  const config = window.RecipeArchiveConfig;
  const api = config.getCurrentAPI();
  
  console.log(`🔧 Using ${config.ENVIRONMENT} environment:`, api.diagnostics);

  try {
    const payload = {
      url: url,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      extensionVersion: chrome.runtime.getManifest().version,
      environment: config.ENVIRONMENT,
      diagnosticData: diagnosticData,
    };

    // Log to console for debugging
    console.log('📊 Diagnostic data prepared for API:', payload);
    console.log('🔍 Page structure analysis:', diagnosticData.pageAnalysis);
    console.log(
      '🍽️ Recipe extraction attempt:',
      diagnosticData.extractionResult
    );

    // Make actual API call
    const response = await fetch(api.diagnostics, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
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
    console.log('✅ Diagnostic data sent successfully:', result);
  } catch (error) {
    console.error(`Failed to send diagnostic data to ${config.ENVIRONMENT}:`, error);
    
    // Fallback to local logging if API call fails
    console.log('📝 Storing diagnostic data locally as fallback');
    throw error;
  }
}

async function checkAuthStatus() {
  console.log('Chrome Extension: checkAuthStatus called');
  try {
    const config = window.RecipeArchiveConfig;
    console.log('Chrome Extension: Config environment', config.ENVIRONMENT);
    
    if (config.ENVIRONMENT === 'development') {
      console.log('Chrome Extension: Development mode - using Cognito');
      // In development, use Cognito authentication instead of broken secure storage
      const cognitoConfig = config.getCognitoConfig();
      console.log('Chrome Extension: Cognito config', cognitoConfig);
      
      const cognitoAuth = new ChromeCognitoAuth(cognitoConfig);
      console.log('Chrome Extension: ChromeCognitoAuth initialized');
      
      const userResult = await cognitoAuth.getCurrentUser();
      console.log('Chrome Extension: getCurrentUser result', userResult);
      
      if (userResult.success) {
        showMainInterface(userResult.data.email);
      } else {
        showCognitoAuthRequired();
      }
      return;
    }
    
    console.log('Chrome Extension: Production mode - using Cognito');
    // Production: Check Cognito authentication
    const cognitoConfig = config.getCognitoConfig();
    const cognitoAuth = new ChromeCognitoAuth(cognitoConfig);
    
    const userResult = await cognitoAuth.getCurrentUser();
    
    if (userResult.success) {
      showMainInterface(userResult.data.email);
    } else {
      showCognitoAuthRequired();
    }
  } catch (error) {
    console.error('Chrome Extension: Error checking auth status:', error);
    document.getElementById('status').innerHTML = `
      <div style="color: red; padding: 10px;">
        <strong>Authentication Error:</strong><br>
        ${error.message}<br><br>
        <button onclick="window.location.href='setup.html'">Manual Setup</button>
      </div>
    `;
  }
}

function showCognitoAuthRequired() {
  document.getElementById('status').innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <h2>🔐 Authentication Required</h2>
      <p>Please sign in to your RecipeArchive account to use this extension.</p>
      <button id="authBtn" style="padding: 10px 20px; background: #007AFF; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 8px;">
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

// eslint-disable-next-line no-unused-vars
function showSetupRequired() {
  // Show setup message in status area
  document.getElementById('status').innerHTML = `
    <div style="text-align: center; padding: 15px;">
      <h3 style="margin: 0 0 10px 0; color: #333;">🔐 Authentication Required</h3>
      <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">Configure your credentials to start capturing recipes</p>
    </div>
  `;

  // Change capture button to setup mode - SINGLE BUTTON ONLY
  const captureButton = document.getElementById('capture');
  captureButton.textContent = '🔐 Setup Authentication';
  captureButton.style.background = '#4CAF50';
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
  console.log('Chrome Extension: Capture button clicked');
  
  // Check for development bypass flag
  const devBypass = localStorage.getItem('recipeArchive.devBypass');
  if (devBypass === 'true') {
    console.log('🔧 Development bypass active - skipping auth check for capture');
    document.getElementById('status').textContent = 'Recipe capture triggered (dev bypass).';
    // Skip to the capture logic
  } else {
    // Check auth before capturing using Cognito
    try {
      const config = window.RecipeArchiveConfig;
      const cognitoConfig = config.getCognitoConfig();
      const cognitoAuth = new ChromeCognitoAuth(cognitoConfig);
      
      const userResult = await cognitoAuth.getCurrentUser();
      
      if (!userResult.success) {
        showCognitoAuthRequired();
        return;
      }
    } catch (error) {
      console.log('Auth check failed:', error);
      showCognitoAuthRequired();
      return;
    }

    document.getElementById('status').textContent = 'Recipe capture triggered.';
  }
  
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tabId = tabs[0].id;
    // Try sending message first
    chrome.tabs.sendMessage(
      tabId,
      { action: 'captureRecipe' },
      function (response) {
        if (chrome.runtime.lastError || !response) {
          // If no response, inject content script then retry
          chrome.scripting.executeScript(
            {
              target: { tabId },
              files: ['content.js'],
            },
            () => {
              // Retry sending message
              chrome.tabs.sendMessage(
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
                      'Recipe capture failed: ' + response2.error;
                  } else {
                    document.getElementById('status').textContent =
                      'Recipe capture failed: No response from content script.';
                  }
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
            'Recipe capture failed: ' + response.error;
        } else {
          document.getElementById('status').textContent =
            'Recipe capture failed: No response from content script.';
        }
      }
    );
  });
});

function renderRecipe(data) {
  // Store the captured recipe data for syncing
  chrome.storage.local.set({ lastCapturedRecipe: data });
  
  document.getElementById('status').textContent = 'Recipe captured!';
  let html = '';

  // Add sync button for AWS backend integration
  html += `<div style="text-align: center; margin-bottom: 15px;">
    <button onclick="syncToAPI()" style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">
      ☁️ Save to Cloud
    </button>
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
    
    // Initialize Cognito auth
    const cognitoAuth = new ChromeCognitoAuth(cognitoConfig);
    
    // Get valid access token
    const accessToken = await cognitoAuth.getAccessToken();
    
    if (!accessToken) {
      throw new Error('No valid authentication token available');
    }
    
    return accessToken;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    throw error;
  }
}

// Recipe sync function - updated to use actual AWS backend
 
async function syncToAPI() {
  const syncButton = event.target;
  const originalText = syncButton.textContent;
  
  try {
    syncButton.textContent = '🔄 Syncing...';
    syncButton.disabled = true;

    const authData = await chrome.storage.local.get(['username', 'password']);
    const devBypass = localStorage.getItem('recipeArchive.devBypass');

    if (!authData.username || !authData.password) {
      if (devBypass === 'true') {
        console.log('🔧 Dev bypass active - using mock auth for API sync');
        // Use mock auth data for dev bypass
        authData.username = 'dev@localhost';
        authData.password = 'dev-bypass';
      } else {
        alert('Authentication not configured');
        return;
      }
    }

    // Get the most recently captured recipe data
    const recipeData = await chrome.storage.local.get(['lastCapturedRecipe']);
    
    if (!recipeData.lastCapturedRecipe) {
      alert('No recipe data to sync. Please capture a recipe first.');
      return;
    }

    // Use configuration system to get API endpoint
    const config = window.RecipeArchiveConfig;
    const api = config.getCurrentAPI();
    
    console.log(`🔧 Syncing to ${config.ENVIRONMENT} environment:`, api.recipes);

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
      extensionVersion: chrome.runtime.getManifest().version
    };

    console.log('📤 Sending recipe to AWS:', payload);

    // Prepare headers based on environment
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'RecipeArchive-Extension'
    };

    // Add authorization for local development (mock token) or production (real JWT)
    if (config.ENVIRONMENT === 'development') {
      headers['Authorization'] = `Bearer ${authData.username}-extension-token`;
    } else {
      // TODO: Add real Cognito JWT token for production
      headers['Authorization'] = 'Bearer ' + await getAuthToken();
    }

    // Make API call to backend
    const response = await fetch(api.recipes, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Recipe synced successfully:', result);

    syncButton.textContent = '✅ Synced!';
    syncButton.style.background = '#4CAF50';
    
    // Show success message
    const statusDiv = document.getElementById('status');
    const successMsg = document.createElement('div');
    successMsg.innerHTML = `
      <div style="color: #4CAF50; text-align: center; padding: 10px; margin-top: 10px; border: 1px solid #4CAF50; border-radius: 4px; background: #e8f5e9;">
        <strong>✅ Recipe Saved to Cloud!</strong><br>
        <small>Recipe ID: ${result.id || 'Generated'}</small>
      </div>
    `;
    statusDiv.appendChild(successMsg);

    // Reset button after delay
    setTimeout(() => {
      syncButton.textContent = originalText;
      syncButton.style.background = '#4CAF50';
      syncButton.disabled = false;
    }, 3000);

  } catch (error) {
    console.error('Sync error:', error);
    
    syncButton.textContent = '❌ Failed';
    syncButton.style.background = '#f44336';
    
    // Show error message
    const statusDiv = document.getElementById('status');
    const errorMsg = document.createElement('div');
    errorMsg.innerHTML = `
      <div style="color: #f44336; text-align: center; padding: 10px; margin-top: 10px; border: 1px solid #f44336; border-radius: 4px; background: #ffebee;">
        <strong>❌ Sync Failed</strong><br>
        <small>${error.message}</small>
      </div>
    `;
    statusDiv.appendChild(errorMsg);
    
    // Reset button after delay
    setTimeout(() => {
      syncButton.textContent = originalText;
      syncButton.style.background = '#4CAF50';
      syncButton.disabled = false;
    }, 3000);
  }
}

function handleExtractionFailure(response) {
  console.log(
    'Recipe extraction failed - diagnostics auto-captured:',
    response
  );

  // Show user feedback about automatic diagnostic capture
  document.getElementById('status').innerHTML = `
    <div style="color: #ff9800; text-align: center; padding: 15px; border: 1px solid #ffcc02; border-radius: 4px; background: #fff3cd;">
      <strong>⚠️ Recipe Extraction Failed</strong><br>
      <small>Diagnostic data automatically sent to AWS for parser improvement</small><br>
      <small style="color: #666; margin-top: 5px; display: block;">This helps us support more recipe websites</small>
    </div>
  `;

  // Show any partial data that was extracted
  if (response.data) {
    let partialHtml =
      '<div style="margin-top: 15px; padding: 10px; background: #f5f5f5; border-radius: 4px;">';
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
