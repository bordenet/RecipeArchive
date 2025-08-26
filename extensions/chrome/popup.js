// RecipeArchive popup with full backend integration
console.log("RecipeArchive popup loading");

document.addEventListener("DOMContentLoaded", function() {
    const container = document.createElement("div");
    container.style.cssText = "padding: 20px; min-width: 300px; font-family: Arial, sans-serif;";
    
    container.innerHTML = `
        <h1 style="margin: 0 0 20px 0; font-size: 18px; color: #333;">RecipeArchive</h1>
        <button id="capture" style="width: 100%; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">Capture Recipe</button>
        <div id="status" style="margin-top: 15px; padding: 10px; border-radius: 4px; font-size: 12px; display: none;"></div>
    `;
    
    document.body.appendChild(container);
    
    document.getElementById("capture").onclick = function() {
        captureRecipe();
    };
});

function captureRecipe() {
    const statusDiv = document.getElementById("status");
    showStatus("Capturing recipe...", "#f0f0f0");
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || tabs.length === 0) {
            showStatus("❌ No active tab found", "#ffebee");
            return;
        }
        
        const tab = tabs[0];
        console.log("🍳 Capturing recipe from:", tab.url);
        
        chrome.tabs.sendMessage(tab.id, {action: "captureRecipe"}, function(response) {
            if (chrome.runtime.lastError) {
                console.error("❌ Content script error:", chrome.runtime.lastError.message);
                showStatus("❌ Error: " + chrome.runtime.lastError.message, "#ffebee");
                return;
            }
            
            if (response && response.status === "success") {
                console.log("✅ Recipe data received:", response);
                showStatus("✅ Recipe captured: " + response.data.title, "#e8f5e8");
                
                // Send to backend
                sendToBackend(response.data);
            } else {
                console.error("❌ Capture failed:", response);
                showStatus("❌ Capture failed: " + (response ? response.message : "No response"), "#ffebee");
            }
        });
    });
}

function showStatus(message, backgroundColor) {
    const statusDiv = document.getElementById("status");
    statusDiv.textContent = message;
    statusDiv.style.background = backgroundColor;
    statusDiv.style.display = "block";
}

async function sendToBackend(recipeData) {
    try {
        console.log("📤 Sending to backend:", recipeData);
        
        const response = await fetch("http://localhost:8080/api/recipes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer dev-mock-token"
            },
            body: JSON.stringify({
                title: recipeData.title || "Unknown Recipe",
                description: "Captured from " + recipeData.url,
                ingredients: recipeData.ingredients || [],
                instructions: recipeData.steps || [],
                tags: ["chrome-extension"],
                source: "chrome-extension"
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log("✅ Backend success:", result);
            showStatus("✅ Saved to backend! Recipe ID: " + (result.recipe ? result.recipe.id.substring(0, 8) : "unknown"), "#d4edda");
        } else {
            const errorText = await response.text();
            throw new Error("Backend error " + response.status + ": " + errorText);
        }
    } catch (error) {
        console.error("❌ Backend error:", error);
        showStatus("⚠️ Backend error: " + error.message, "#fff3cd");
    }
}

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

// Send captured recipe data to backend API
const sendRecipeToBackend = async (recipeData) => {
  try {
    console.log('Sending recipe to backend:', recipeData);
    
    const apiConfig = CONFIG.getCurrentAPI();
    const endpoint = apiConfig.recipes;
    
    // Get authentication token (mock for development, real for production)
    let authToken = 'dev-token'; // Default for development mode
    
    // Try to get real auth token if in production mode
    if (CONFIG.ENVIRONMENT === 'production' && cognitoAuth) {
      try {
        const session = await cognitoAuth.getCurrentSession();
        if (session && session.accessToken) {
          authToken = session.accessToken.jwtToken;
        }
      } catch (_error) {
        console.warn('Could not get auth token, using dev token');
      }
    }
    
    // Prepare recipe payload for backend
    const recipePayload = {
      title: recipeData.title || 'Untitled Recipe',
      description: recipeData.description || '',
      ingredients: recipeData.ingredients || [],
      instructions: recipeData.steps || recipeData.instructions || [],
      tags: recipeData.tags || [],
      sourceUrl: recipeData.attributionUrl || window.location?.href || '',
      // Additional metadata
      servingSize: recipeData.servingSize || null,
      prepTime: recipeData.prepTime || null,
      cookTime: recipeData.cookTime || null,
      totalTime: recipeData.time || null,
    };
    
    console.log('Sending to endpoint:', endpoint);
    console.log('Recipe payload:', recipePayload);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(recipePayload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('Backend response:', result);
    
    return {
      success: true,
      data: result,
    };
    
  } catch (error) {
    console.error('Failed to send recipe to backend:', error);
    return {
      success: false,
      error: error.message,
    };
  }
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
        showMessage('Recipe captured successfully! Saving to archive...');

        // Send to backend (async)
        sendRecipeToBackend(response.data).then(sendResult => {
          if (sendResult.success) {
            showMessage('Recipe saved to your archive!');
          } else {
            showMessage(`Failed to save recipe: ${sendResult.error}`, true);
          }
        }).catch(error => {
          showMessage(`Failed to save recipe: ${error.message}`, true);
        });
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

  sendRecipeToBackend(testData).then(result => {
    if (result.success) {
      showMessage('Test successful!');
    } else {
      showMessage(`Test failed: ${result.error}`, true);
    }
  }).catch(error => {
    showMessage(`Test failed: ${error.message}`, true);
  });
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
