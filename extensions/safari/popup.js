// RecipeArchive Safari popup with authentication-first UX

// State management
let isSignedIn = false;
let currentUser = null;
let extensionAPI = null;

// Get extension version from manifest
function getExtensionVersion() {
    // Safari Web Extensions need to use the extensionAPI
    if (extensionAPI && extensionAPI.runtime && extensionAPI.runtime.getManifest) {
        return extensionAPI.runtime.getManifest().version;
    }
    return "0.3.0"; // Fallback version
}

// Create version display element
function createVersionDisplay() {
    const version = getExtensionVersion();
    const webAppUrl = CONFIG.WEB_APP_URL;
    
    return `
        <div style="position: absolute; top: 8px; left: 20px; z-index: 1000;">
            <a href="${webAppUrl}" target="_blank" 
               style="font-size: 11px; color: #888; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, sans-serif;"
               title="Open RecipeArchive Web App">v${version}</a>
        </div>
    `;
}

document.addEventListener("DOMContentLoaded", function() {
    const container = document.createElement("div");
    container.style.cssText = "padding: 20px; min-width: 320px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;";
    container.id = "main-container";
    
    document.body.appendChild(container);
    
    // Initialize cross-browser extension API
    initializeExtensionAPI();
    
    // Check authentication status on load
    checkAuthenticationStatus();
});

function initializeExtensionAPI() {
    // Safari Web Extensions use the browser API, not chrome API
    if (typeof browser !== "undefined") {
        extensionAPI = browser;
    } else if (typeof chrome !== "undefined") {
        extensionAPI = chrome;
    }
    
    if (!extensionAPI) {
        console.error("❌ No extension API available");
        showStatus("Extension API not available", "#ffebee");
        return false;
    }
    
    return true;
}

function checkAuthenticationStatus() {
    // Check if user is signed in with valid AWS Cognito token
    const storedAuth = localStorage.getItem("recipeArchive.auth");
    if (storedAuth) {
        try {
            const authData = JSON.parse(storedAuth);
            // Check if token is still valid (not expired)
            const now = Date.now();
            const tokenAge = now - (authData.issuedAt || 0);
            const maxAge = (authData.expiresIn || 3600) * 1000; // Convert to milliseconds
            if (tokenAge < maxAge && authData.email && authData.accessToken) {
                currentUser = { email: authData.email };
                isSignedIn = true;
                // Switch to production mode for authenticated users
                CONFIG.enableProduction();
            } else {
                // Token expired, clear auth
                localStorage.removeItem("recipeArchive.auth");
                isSignedIn = false;
                currentUser = null;
            }
        } catch (e) {
            // Invalid auth data, clear it
            localStorage.removeItem("recipeArchive.auth");
            isSignedIn = false;
            currentUser = null;
        }
    } else {
        isSignedIn = false;
        currentUser = null;
    }
    renderUI();
}

function renderUI() {
    const container = document.getElementById("main-container");
    const versionDisplay = createVersionDisplay();
    
    if (isSignedIn) {
        // Signed in UI - show capture functionality
        container.innerHTML = `
            ${versionDisplay}
            <div style="position: relative; padding-top: 20px;">
                <h1 style="margin: 0 0 20px 0; font-size: 18px; color: #333;">🍽️ RecipeArchive</h1>
                <a href="#" id="signout-link" style="position: absolute; top: -12px; right: 0; font-size: 11px; color: #666; text-decoration: none;">sign out</a>
            </div>
            <div style="margin-bottom: 15px; padding: 10px; background: #e8f5e8; border-radius: 8px; font-size: 12px; display: none;">
                ✅ Signed in as ${currentUser ? currentUser.email : "user"}
            </div>
            <button id="capture" style="width: 100%; padding: 12px; background: #007AFF; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">Capture Recipe</button>
            <div id="status" style="margin-top: 15px; padding: 10px; border-radius: 8px; font-size: 12px; display: none;"></div>
        `;
        
        // Attach event listeners for signed-in state
        const captureBtn = document.getElementById("capture");
        captureBtn.onclick = function() {
            captureRecipe();
        };
        
        document.getElementById("signout-link").onclick = function(e) {
            e.preventDefault();
            signOut();
        };

        // Check if current site is supported and enable/disable button
        if (extensionAPI && extensionAPI.tabs) {
            extensionAPI.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs && tabs.length > 0) {
                    const tab = tabs[0];
                    let isSupported = false;
                    if (tab && typeof window.RecipeArchiveSites !== "undefined") {
                        isSupported = window.RecipeArchiveSites.isSupportedSite(tab.url);
                    }
                    captureBtn.disabled = !isSupported;
                    captureBtn.style.opacity = isSupported ? "1" : "0.5";
                    captureBtn.style.cursor = isSupported ? "pointer" : "not-allowed";
                    captureBtn.title = isSupported ? "Capture Recipe" : "This site is not supported";
                    
                    // Update button text to be more descriptive
                    if (!isSupported) {
                        captureBtn.textContent = "Site Not Supported";
                    } else {
                        captureBtn.textContent = "Capture Recipe";
                    }
                }
            });
        }
        
    } else {
        // Load saved credentials
        const savedCreds = loadCredentials();
        
        // Not signed in UI - show sign in form
        container.innerHTML = `
            ${versionDisplay}
            <div style="padding-top: 20px;">
                <h1 style="margin: 0 0 20px 0; font-size: 18px; color: #333; text-align: center;">🍽️ RecipeArchive</h1>
            </div>
            <div style="margin-bottom: 20px; padding: 10px; background: #fff3e0; border-radius: 8px; font-size: 12px; text-align: center;">
                Sign in to capture recipes
            </div>
            
            <form id="signin-form">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #666;">Email</label>
                    <input type="email" id="email" required value="${savedCreds.email}"
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #666;">Password</label>
                    <input type="password" id="password" required value="${savedCreds.password}"
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="font-size: 12px; color: #666; cursor: pointer;">
                        <input type="checkbox" id="show-password" style="margin-right: 5px;"> Show password
                    </label>
                </div>
                
                <button type="submit" id="signin-btn" 
                        style="width: 100%; padding: 12px; background: #007AFF; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
                    Sign In
                </button>
            </form>
            
            ${savedCreds.email ? `<div style="margin-top: 10px; text-align: center;">
                <a href="#" id="clear-credentials" style="font-size: 12px; color: #666; text-decoration: none;">Clear saved credentials</a>
            </div>` : ""}
            
            <div id="status" style="margin-top: 15px; padding: 10px; border-radius: 8px; font-size: 12px; display: none;"></div>
        `;
        
        // Attach event listeners for sign-in form
        document.getElementById("signin-form").onsubmit = function(e) {
            e.preventDefault();
            handleSignIn();
        };
        
        document.getElementById("show-password").onchange = function() {
            const passwordField = document.getElementById("password");
            passwordField.type = this.checked ? "text" : "password";
        };
        
        // Add clear credentials handler if the link exists
        const clearCredentialsLink = document.getElementById("clear-credentials");
        if (clearCredentialsLink) {
            clearCredentialsLink.onclick = function(e) {
                e.preventDefault();
                clearCredentials();
                renderUI(); // Re-render to show empty form
                showStatus("✅ Saved credentials cleared", "#e8f5e8");
            };
        }
    }
}

// Ensure AWS configuration is set before authentication attempts
async function ensureAWSConfiguration() {
    console.log("🔧 Checking AWS configuration...");
    
    // Check if configuration is already set and valid
    const currentUserPoolId = localStorage.getItem("COGNITO_USER_POOL_ID");
    const currentClientId = localStorage.getItem("COGNITO_APP_CLIENT_ID");
    
    if (currentUserPoolId && currentClientId && 
        currentUserPoolId !== "CONFIGURE_ME" && 
        currentClientId !== "CONFIGURE_ME") {
        console.log("✅ AWS configuration already set");
        return;
    }
    
    // Set correct AWS configuration
    console.log("🔧 Setting correct AWS configuration...");
    localStorage.setItem("AWS_REGION", "us-west-2");
    localStorage.setItem("COGNITO_USER_POOL_ID", "us-west-2_qJ1i9RhxD");
    localStorage.setItem("COGNITO_APP_CLIENT_ID", "5grdn7qhf1el0ioqb6hkelr29s");
    localStorage.setItem("API_BASE_URL", "https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod");
    
    // Enable production mode for the extension
    localStorage.setItem("recipeArchive.dev", "false");
    
    // Force CONFIG to reload environment configuration
    if (typeof CONFIG !== "undefined" && CONFIG.reloadConfiguration) {
        CONFIG.reloadConfiguration();
    }
    
    console.log("✅ AWS configuration set successfully");
}

async function handleSignIn() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    
    if (!email || !password) {
        showStatus("❌ Please enter email and password", "#ffebee");
        return;
    }
    
    showStatus("Signing in to AWS Cognito...", "#e3f2fd");
    
    try {
        // Ensure AWS configuration is set before authentication
        await ensureAWSConfiguration();
        
        // Initialize SafariCognitoAuth with configuration from CONFIG (Safari-specific implementation)
        const cognitoConfig = CONFIG.getCognitoConfig();
        const cognitoAuth = new SafariCognitoAuth({
            region: cognitoConfig.region,
            userPoolId: cognitoConfig.userPoolId,
            clientId: cognitoConfig.clientId
        });
        
        // Perform real Cognito authentication
        const result = await cognitoAuth.signIn(email, password);
        
        if (result.success) {
            // Authentication successful - token logging removed for security
            
            // Get the real JWT tokens from Cognito
            const authData = {
                email: email,
                token: result.data.IdToken,           // Primary token field
                accessToken: result.data.AccessToken,
                idToken: result.data.IdToken,
                refreshToken: result.data.RefreshToken,
                tokenType: "Bearer",
                expiresIn: result.data.ExpiresIn || 3600,
                issuedAt: Date.now(),
                provider: "cognito"
            };
            
            console.log("🔧 Storing auth data:", authData);
            
            // Store auth data
            currentUser = { 
                email: email, 
                token: result.data.IdToken,
                accessToken: result.data.AccessToken
            };
            isSignedIn = true;
            localStorage.setItem("recipeArchive.auth", JSON.stringify(authData));
            
            // Switch to production mode for AWS API calls
            CONFIG.enableProduction();
            
            // Save credentials for future use
            saveCredentials(email, password);
            
            renderUI();
            showStatus("✅ Signed in to AWS Cognito successfully", "#e8f5e8");
        } else {
            showStatus("❌ Sign in failed: " + result.error, "#f8d7da");
            console.error("❌ Cognito authentication failed:", result.error);
        }
        
    } catch (error) {
        console.error("❌ Cognito authentication error:", error);
        showStatus("❌ Sign in failed: " + error.message, "#ffebee");
    }
}

async function refreshAuthToken() {
    try {
        const authData = localStorage.getItem("recipeArchive.auth");
        if (!authData) {
            return { success: false, error: "No auth data found" };
        }
        
        const auth = JSON.parse(authData);
        if (!auth.refreshToken) {
            return { success: false, error: "No refresh token available" };
        }
        
        // Initialize CognitoAuth with configuration
        const cognitoConfig = CONFIG.getCognitoConfig();
        const cognitoAuth = new SafariCognitoAuth({
            region: cognitoConfig.region,
            userPoolId: cognitoConfig.userPoolId,
            clientId: cognitoConfig.clientId
        });
        
        // Call the refresh token method
        const result = await cognitoAuth.refreshToken(auth.refreshToken);
        
        if (result.success) {
            console.log("✅ Token refresh successful");
            
            // Update the localStorage auth data with new tokens from the response
            if (result.tokens) {
                const updatedAuth = {
                    ...auth,
                    token: result.tokens.idToken,           // Keep token as idToken for consistency
                    accessToken: result.tokens.accessToken, // Store accessToken separately
                    idToken: result.tokens.idToken,
                    refreshToken: result.tokens.refreshToken || auth.refreshToken
                };
                localStorage.setItem("recipeArchive.auth", JSON.stringify(updatedAuth));
                console.log("✅ Updated localStorage with new tokens");
            }
            
            return { success: true };
        } else {
            console.error("❌ Token refresh failed:", result.error);
            return { success: false, error: result.error };
        }
        
    } catch (error) {
        console.error("❌ Token refresh error:", error);
        return { success: false, error: error.message };
    }
}

function signOut() {
    console.log("🔧 Signing out - clearing all auth data");
    isSignedIn = false;
    currentUser = null;
    localStorage.removeItem("recipeArchive.auth");
    // Also clear any legacy auth keys that might exist
    localStorage.removeItem("recipeArchive.user");
    localStorage.removeItem("recipeArchive.token");
    // Note: Keeping saved credentials for convenience
    // Users can clear them manually if desired
    CONFIG.enableDevelopment(); // Switch back to dev mode
    renderUI();
}

function forceAuthRefresh() { // eslint-disable-line no-unused-vars
    // Clearing cached authentication tokens
    localStorage.removeItem("recipeArchive.auth");
    isSignedIn = false;
    currentUser = null;
    renderUI();
}

async function downloadAndUploadImage(imageUrl, recipeTitle) {
    try {
        console.log("🖼️ Starting image download from:", imageUrl);
        
        // Generate a unique filename
        const timestamp = Date.now();
        const sanitizedTitle = (recipeTitle || "recipe")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .substring(0, 50);
        const fileExtension = imageUrl.split(".").pop()?.toLowerCase().split("?")[0] || "jpg";
        const filename = `recipes/${sanitizedTitle}-${timestamp}.${fileExtension}`;
        
        // Download the image with better error handling
        console.log(`📥 Fetching image: ${imageUrl}`);
        const response = await fetch(imageUrl, {
            mode: 'cors',
            credentials: 'omit',
            headers: {
                'Accept': 'image/*,*/*;q=0.9'
            }
        });
        if (!response.ok) {
            console.error(`❌ Image fetch failed: ${response.status} ${response.statusText} for URL: ${imageUrl}`);
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        console.log(`✅ Image fetch successful: ${response.status} ${response.headers.get('content-type')}`);
        
        const contentType = response.headers.get("content-type") || "image/jpeg";
        const imageBlob = await response.blob();
        
        console.log(`📦 Downloaded image (${imageBlob.size} bytes, ${contentType})`);
        
        // Convert blob to base64 for AWS upload
        const arrayBuffer = await imageBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Process in chunks to avoid stack overflow with large images
        let binaryString = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, i + chunkSize);
            binaryString += String.fromCharCode.apply(null, chunk);
        }
        const base64String = btoa(binaryString);
        
        // Upload to S3 via API Gateway
        const api = CONFIG.getCurrentAPI();
        const uploadResponse = await fetch(`${api.base}/v1/images/upload`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${JSON.parse(localStorage.getItem("recipeArchive.auth") || "{}").idToken}`
            },
            body: JSON.stringify({
                filename: filename,
                contentType: contentType,
                imageData: base64String
            })
        });
        
        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error(`❌ S3 upload failed: ${uploadResponse.status} ${errorText}`);
            throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
        }
        
        const uploadResult = await uploadResponse.json();
        console.log("✅ Image uploaded to S3:", uploadResult);
        
        return uploadResult.imageUrl || uploadResult.url;
        
    } catch (error) {
        console.error("❌ Image download/upload failed:", error);
        console.error("❌ Error details:", {
            message: error.message,
            name: error.name,
            imageUrl: imageUrl,
            recipeTitle: recipeTitle
        });
        return null;
    }
}

async function captureRecipe() {
    if (!extensionAPI) {
        showStatus("Extension API not available", "#ffebee");
        return;
    }
    
    showStatus("Capturing recipe...", "#f0f0f0");
    
    extensionAPI.tabs.query({active: true, currentWindow: true}, async function(tabs) {
        if (!tabs || tabs.length === 0) {
            showStatus("❌ No active tab found", "#ffebee");
            return;
        }

        // Check if the current site is supported
        const currentTab = tabs[0];
        if (typeof window.RecipeArchiveSites !== "undefined" && !window.RecipeArchiveSites.isSupportedSite(currentTab.url)) {
            const supportedSites = window.RecipeArchiveSites.getSupportedSites();
            showStatus(`❌ This site is not supported. Supported sites include: ${supportedSites.slice(0, 3).join(", ")}, and ${supportedSites.length - 3} more.`, "#ffebee");
            return;
        }
        
        const tab = tabs[0];
        console.log("🔧 Active tab:", tab);
        console.log("🔧 Tab ID:", tab.id);
        console.log("🔧 Tab URL:", tab.url);
        
        // Declare timeout variable outside try-catch to avoid scoping issues
        let pingTimeout = null;
        
        try {
            // Check if content script is already loaded before injecting
            let pingResponded = false;
            console.log("📤 Sending ping to tab:", tab.id);
            
            pingTimeout = setTimeout(() => {
                if (!pingResponded) {
                    console.log("⏰ Ping timeout - injecting content script");
                    injectContentScript(tab.id, tab.url);
                }
            }, 1000);
            
            // Safari Web Extensions: Use async/await pattern that works with both Promise and callback
            try {
                const pingResponse = await new Promise((resolve, reject) => {
                    // Safari Web Extensions: Use direct tab messaging with setTimeout response
                    extensionAPI.tabs.sendMessage(tab.id, {action: "ping"}, (response) => {
                        console.log("🔧 Ping sendMessage callback - response:", response);
                        console.log("🔧 Ping sendMessage callback - lastError:", extensionAPI.runtime.lastError);
                        if (extensionAPI.runtime.lastError) {
                            reject(extensionAPI.runtime.lastError);
                        } else {
                            resolve(response);
                        }
                    });
                });
                
                console.log("� Ping response received:", pingResponse);
                pingResponded = true;
                clearTimeout(pingTimeout);
                
                if (pingResponse && pingResponse.status === "pong") {
                    console.log("✅ Content script already loaded, sending capture message");
                    await sendCaptureMessage(tab.id, tab.url);
                } else {
                    console.log("🔧 Safari Web Extensions: Trying direct recipe capture");
                    await captureRecipeDirectly(tab.id, tab.url);
                }
            } catch (error) {
                console.log("📥 Ping error:", error);
                pingResponded = true;
                clearTimeout(pingTimeout);
                console.log("🔧 Safari Web Extensions: Trying direct recipe capture as fallback");
                await captureRecipeDirectly(tab.id, tab.url);
            }
            
        } catch (error) {
            console.error("❌ Script injection failed:", error);
            showStatus("❌ Failed to inject content script: " + error.message, "#ffebee");
        }
    });
}

function injectContentScript(tabId, tabUrl = "unknown") {
    if (extensionAPI.scripting && extensionAPI.scripting.executeScript) {
        extensionAPI.scripting.executeScript({
            target: { tabId: tabId },
            files: ["content.js"]
        }).then(async () => {
            // Wait longer for Safari script to initialize
            await new Promise(resolve => setTimeout(resolve, 1500));
            await sendCaptureMessage(tabId, tabUrl);
        }).catch(error => {
            console.error("❌ Script injection failed:", error);
            showStatus("❌ Failed to inject content script: " + error.message, "#ffebee");
        });
    } else {
        showStatus("❌ Scripting API not available", "#ffebee");
    }
}

async function captureRecipeDirectly(tabId, tabUrl = "unknown") {
    console.log("🔧 Safari Web Extensions: Direct recipe capture starting");
    
    try {
        const result = await extensionAPI.scripting.executeScript({
            target: { tabId: tabId },
            func: function() {
                // Copy the recipe extraction functions from content script
                function extractRecipeFromPage() {
                    const url = window.location.href;
                    console.log("🔍 Direct extraction from:", url);
                    
                    // Try JSON-LD first (works for most modern recipe sites)
                    const jsonLdRecipe = extractRecipeFromJsonLd();
                    if (jsonLdRecipe && jsonLdRecipe.ingredients && jsonLdRecipe.ingredients.length > 0) {
                        console.log("✅ Found JSON-LD recipe data with ingredients");
                        return jsonLdRecipe;
                    }
                    
                    // Site-specific extractors
                    if (url.includes("smittenkitchen.com")) {
                        return extractSmittenKitchenRecipe();
                    }
                    
                    // Try Food Network specific extraction
                    if (url.includes("foodnetwork.com")) {
                        const foodNetworkRecipe = extractFoodNetworkRecipe();
                        if (foodNetworkRecipe && foodNetworkRecipe.ingredients && foodNetworkRecipe.ingredients.length > 0) {
                            console.log("✅ Found Food Network recipe");
                            return foodNetworkRecipe;
                        }
                    }
                    
                    // Generic fallback with better selectors
                    const fallbackRecipe = extractGenericRecipe();
                    if (fallbackRecipe && fallbackRecipe.ingredients && fallbackRecipe.ingredients.length > 0) {
                        console.log("✅ Found recipe with generic extraction");
                        return fallbackRecipe;
                    }
                    
                    // Minimal fallback
                    return {
                        title: document.title || "Unknown Recipe",
                        url: window.location.href,
                        timestamp: new Date().toISOString(),
                        ingredients: [],
                        steps: [],
                        source: "safari-direct-fallback"
                    };
                }
                
                function extractFoodNetworkRecipe() {
                    console.log("🍳 Food Network specific extraction...");
                    
                    const title = document.querySelector("h1.o-AssetTitle__a-HeadlineText, h1")?.textContent?.trim() || document.title;
                    
                    // Food Network ingredient selectors
                    const ingredientElements = document.querySelectorAll(
                        ".o-RecipeIngredients__a-Ingredient, " +
                        ".o-Ingredients__a-Ingredient, " +
                        "[data-module=\"IngredientsList\"] li, " +
                        ".recipe-ingredients li, " +
                        ".o-RecipeIngredients li"
                    );
                    
                    const ingredients = Array.from(ingredientElements)
                        .map(el => el.textContent?.trim())
                        .filter(text => text && text.length > 2);
                    
                    // Food Network instruction selectors
                    const stepElements = document.querySelectorAll(
                        ".o-Method__m-Step, " +
                        ".recipe-instructions .o-Method__m-Step, " +
                        "[data-module=\"InstructionsList\"] li, " +
                        ".recipe-instructions ol li, " +
                        ".recipe-instructions li"
                    );
                    
                    const steps = Array.from(stepElements)
                        .map(el => el.textContent?.trim())
                        .filter(text => text && text.length > 10);
                    
                    console.log(`🔍 Found ${ingredients.length} ingredients and ${steps.length} steps`);
                    
                    return {
                        title,
                        url: window.location.href,
                        timestamp: new Date().toISOString(),
                        ingredients: ingredients.length > 0 ? [{ title: null, items: ingredients }] : [],
                        steps: steps.length > 0 ? [{ title: null, items: steps }] : [],
                        source: "safari-direct-food-network"
                    };
                }
                
                function extractGenericRecipe() {
                    console.log("🔍 Generic recipe extraction...");
                    
                    const title = document.querySelector("h1[class*=\"recipe\"], .recipe-title, .entry-title, h1")?.textContent?.trim() || document.title;
                    
                    // Enhanced ingredient selectors
                    const ingredientSelectors = [
                        ".recipe-ingredient",
                        ".ingredients li",
                        "[class*=\"ingredient\"] li",
                        ".recipe-ingredients li",
                        ".o-RecipeIngredients__a-Ingredient",
                        ".o-Ingredients__a-Ingredient",
                        "[data-module=\"IngredientsList\"] li",
                        ".recipe-summary ul li"
                    ];
                    
                    let ingredients = [];
                    for (const selector of ingredientSelectors) {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            ingredients = Array.from(elements)
                                .map(el => el.textContent?.trim())
                                .filter(text => text && text.length > 2);
                            if (ingredients.length > 0) break;
                        }
                    }
                    
                    // Enhanced instruction selectors
                    const instructionSelectors = [
                        ".recipe-instruction",
                        ".instructions li",
                        ".directions li",
                        ".recipe-instructions li",
                        ".recipe-directions li",
                        ".o-Method__m-Step",
                        ".recipe-instructions .o-Method__m-Step",
                        "[data-module=\"InstructionsList\"] li",
                        ".recipe-instructions ol li"
                    ];
                    
                    let steps = [];
                    for (const selector of instructionSelectors) {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            steps = Array.from(elements)
                                .map(el => el.textContent?.trim())
                                .filter(text => text && text.length > 10);
                            if (steps.length > 0) break;
                        }
                    }
                    
                    console.log(`🔍 Generic extraction found ${ingredients.length} ingredients and ${steps.length} steps`);
                    
                    return {
                        title,
                        url: window.location.href,
                        timestamp: new Date().toISOString(),
                        ingredients: ingredients.length > 0 ? [{ title: null, items: ingredients }] : [],
                        steps: steps.length > 0 ? [{ title: null, items: steps }] : [],
                        source: "safari-direct-generic"
                    };
                }
                
                function extractRecipeFromJsonLd() {
                    const jsonLdScripts = document.querySelectorAll("script[type=\"application/ld+json\"]");
                    
                    for (const script of jsonLdScripts) {
                        try {
                            const jsonData = JSON.parse(script.textContent);
                            let recipeData = null;
                            
                            if (jsonData["@type"] === "Recipe") {
                                recipeData = jsonData;
                            } else if (Array.isArray(jsonData)) {
                                recipeData = jsonData.find(item => item && item["@type"] === "Recipe");
                            } else if (jsonData["@graph"]) {
                                recipeData = jsonData["@graph"].find(item => item && item["@type"] === "Recipe");
                            }
                            
                            if (recipeData && recipeData.name) {
                                const ingredients = recipeData.recipeIngredient 
                                    ? [{ title: null, items: recipeData.recipeIngredient }]
                                    : [];
                                
                                let steps = [];
                                if (recipeData.recipeInstructions) {
                                    const stepItems = recipeData.recipeInstructions
                                        .map(instruction => {
                                            if (typeof instruction === "string") return instruction;
                                            if (instruction.text) return instruction.text;
                                            if (instruction.name) return instruction.name;
                                            return "";
                                        })
                                        .filter(Boolean);
                                    
                                    if (stepItems.length > 0) {
                                        steps = [{ title: null, items: stepItems }];
                                    }
                                }
                                
                                return {
                                    title: recipeData.name,
                                    url: window.location.href,
                                    timestamp: new Date().toISOString(),
                                    ingredients,
                                    steps,
                                    servingSize: recipeData.recipeYield || recipeData.yield || null,
                                    time: recipeData.totalTime || recipeData.cookTime || recipeData.prepTime || null,
                                    photos: recipeData.image ? (Array.isArray(recipeData.image) ? recipeData.image : [recipeData.image]) : [],
                                    source: "safari-direct-json-ld"
                                };
                            }
                        } catch (e) {
                            console.log("JSON-LD parsing failed:", e.message);
                        }
                    }
                    return null;
                }
                
                function extractSmittenKitchenRecipe() {
                    console.log("🍳 Direct Smitten Kitchen extraction...");
                    
                    const title = document.querySelector(".entry-title, h1")?.textContent?.trim() || document.title;
                    
                    // Extract ingredients
                    const ingredientElements = document.querySelectorAll(".recipe-ingredients li, .recipe-summary ul li");
                    const ingredients = Array.from(ingredientElements)
                        .map(el => el.textContent?.trim())
                        .filter(text => text && text.length > 2);
                    
                    // Extract steps  
                    const stepElements = document.querySelectorAll(".recipe-instructions li, .recipe-instructions ol li");
                    const steps = Array.from(stepElements)
                        .map(el => el.textContent?.trim())
                        .filter(text => text && text.length > 10);
                    
                    return {
                        title,
                        url: window.location.href,
                        timestamp: new Date().toISOString(),
                        ingredients: ingredients.length > 0 ? [{ title: null, items: ingredients }] : [],
                        steps: steps.length > 0 ? [{ title: null, items: steps }] : [],
                        source: "safari-direct-smitten-kitchen"
                    };
                }
                
                // Execute the extraction
                return extractRecipeFromPage();
            }
        });
        
        if (result && result[0] && result[0].result) {
            const recipeData = result[0].result;
            console.log("✅ Direct recipe extraction result:", recipeData);
            
            if (recipeData && (recipeData.ingredients?.length > 0 || recipeData.title)) {
                showStatus("✅ Recipe captured: " + recipeData.title, "#e8f5e8");
                await sendToBackends(recipeData, tabUrl);
            } else {
                showStatus("⚠️ Limited recipe data found", "#fff3cd");
                await sendToBackends(recipeData, tabUrl);
            }
        } else {
            showStatus("❌ Direct capture failed", "#ffebee");
        }
        
    } catch (error) {
        console.error("❌ Direct recipe capture error:", error);
        showStatus("❌ Direct capture error: " + error.message, "#ffebee");
    }
}

async function sendCaptureMessage(tabId, tabUrl = "unknown") {
    // Send message to content script using async/await pattern
    let messageResponded = false;
    
    console.log("📤 Sending capture message to tab:", tabId);
    
    // Set up a timeout in case Safari doesn't respond
    const timeout = setTimeout(() => {
        if (!messageResponded) {
            console.error("❌ Message timeout - Safari may need content script reload");
            showStatus("❌ Safari timeout - try reloading the page", "#ffebee");
        }
    }, 5000);
    
    try {
        const response = await new Promise((resolve, reject) => {
            extensionAPI.tabs.sendMessage(tabId, {action: "captureRecipe"}, (response) => {
                console.log("🔧 Capture sendMessage callback - response:", response);
                console.log("🔧 Capture sendMessage callback - lastError:", extensionAPI.runtime.lastError);
                if (extensionAPI.runtime.lastError) {
                    reject(extensionAPI.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
        
        console.log("📥 Received response:", response);
        messageResponded = true;
        clearTimeout(timeout);
        
        if (response && response.status === "success") {
            showStatus("✅ Recipe captured: " + response.data.title, "#e8f5e8");
            
            // Send to both development and AWS backends
            sendToBackends(response.data, tabUrl);
        } else {
            showStatus("❌ Capture failed: " + (response ? (response.message || "Invalid response") : "No response"), "#ffebee");
        }
    } catch (error) {
        console.log("📥 Capture error:", error);
        messageResponded = true;
        clearTimeout(timeout);
        showStatus("❌ Message failed: " + error.message, "#ffebee");
    }
}

function showStatus(message, backgroundColor) {
    const statusDiv = document.getElementById("status");
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.style.background = backgroundColor;
        statusDiv.style.display = "block";
    }
}

async function sendToBackends(recipeData, tabUrl = "unknown") {
    // Check if user is authenticated - if so, save directly to AWS
    const authData = localStorage.getItem("recipeArchive.auth");
    const isAuthenticated = authData && isSignedIn;
    
    if (isAuthenticated) {
        // Authenticated user: Save directly to AWS production
        showStatus("Saving to AWS...", "#e7f3ff");
        console.log("🚀 Authenticated user - saving directly to AWS");
        
        try {
            const awsResult = await sendToAWSBackend(recipeData, tabUrl);
            
            if (awsResult.success) {
                showStatus("✅ Saved to AWS! Recipe ID: " + awsResult.id, "#d4edda");
                console.log("✅ Successfully saved to AWS:", awsResult);
            } else {
                showStatus("❌ AWS save failed: " + awsResult.error, "#f8d7da");
                console.error("❌ AWS save failed:", awsResult.error);
            }
        } catch (error) {
            console.error("❌ AWS backend error:", error);
            showStatus("❌ AWS error: " + error.message, "#f8d7da");
        }
        
    } else {
        // Unauthenticated user: Try development backend only
        showStatus("Saving to development backend...", "#fff3cd");
        console.log("🔧 Unauthenticated user - trying development backend");
        
        try {
            const devResult = await sendToDevBackend(recipeData);
            
            if (devResult.success) {
                showStatus("✅ Saved to development backend! Recipe ID: " + devResult.id, "#d4edda");
            } else {
                showStatus("❌ Failed to save: " + devResult.error, "#f8d7da");
            }
        } catch (error) {
            showStatus("❌ Error saving to development backend: " + error.message, "#ffebee");
        }
    }
}

async function sendToDevBackend(recipeData) {
    // Development server is always on port 8081 for testing
    const devEndpoint = "http://localhost:8081/api/recipes";
    try {
        const response = await fetch(devEndpoint, {
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
                tags: ["safari-extension"],
                source: "safari-extension"
            })
        });
        if (response.ok) {
            const result = await response.json();
            return {
                success: true,
                id: result.id || "unknown",
                result: result
            };
        } else {
            const errorText = await response.text();
            return {
                success: false,
                error: "Dev backend error " + response.status + ": " + errorText
            };
        }
    } catch (error) {
        return {
            success: false,
            error: "Development backend not available on port 8081: " + error.message
        };
    }
}

function transformRecipeDataForAWS(recipeData, currentUrl = null) {
    // Transform Safari extension format to AWS backend expected format
    const ingredients = [];
    const instructions = [];
    
    // Transform ingredients - Handle multiple format variations
    // 1. Flat strings: ["text1", "text2"] -> AWS format: [{ text: "text1" }, { text: "text2" }]
    // 2. Object format: [{ text: "text1" }, { text: "text2" }] -> AWS format: [{ text: "text1" }, { text: "text2" }]
    // 3. Grouped format: [{ title: null, items: [...] }] -> AWS format: [{ text: "text1" }, ...]
    if (recipeData.ingredients && Array.isArray(recipeData.ingredients)) {
        recipeData.ingredients.forEach(item => {
            if (item && typeof item === "string" && item.trim()) {
                // Format 1: Flat format - direct string
                ingredients.push({ text: item.trim() });
            } else if (item && item.text && typeof item.text === "string" && item.text.trim()) {
                // Format 2: Already has text property - pass through
                ingredients.push({ text: item.text.trim() });
            } else if (item && item.items && Array.isArray(item.items)) {
                // Format 3: Grouped format - extract from items array
                item.items.forEach(subItem => {
                    if (subItem && subItem.text && subItem.text.trim()) {
                        ingredients.push({ text: subItem.text.trim() });
                    } else if (typeof subItem === "string" && subItem.trim()) {
                        ingredients.push({ text: subItem.trim() });
                    }
                });
            }
        });
    }
    
    // Transform instructions - Handle multiple format variations
    // 1. Flat strings: ["step1", "step2"] -> AWS format: [{ stepNumber: 1, text: "step1" }, ...]
    // 2. Object format: [{ stepNumber: 1, text: "step1" }] -> AWS format: [{ stepNumber: 1, text: "step1" }]
    // 3. Grouped format: [{ title: null, items: [...] }] -> AWS format: [{ stepNumber: 1, text: "step1" }, ...]
    
    // Handle recipeData.instructions first (TypeScript parser format)
    if (recipeData.instructions && Array.isArray(recipeData.instructions)) {
        recipeData.instructions.forEach((item, index) => {
            if (item && typeof item === "string" && item.trim()) {
                // Format 1: Flat format - direct string
                instructions.push({ 
                    stepNumber: index + 1, 
                    text: item.trim() 
                });
            } else if (item && item.text && typeof item.text === "string" && item.text.trim()) {
                // Format 2: Already has text property - pass through (preserve or assign stepNumber)
                instructions.push({ 
                    stepNumber: item.stepNumber || (instructions.length + 1),
                    text: item.text.trim() 
                });
            } else if (item && item.items && Array.isArray(item.items)) {
                // Format 3: Grouped format - extract from items array
                item.items.forEach((subItem, _subIndex) => {
                    if (subItem && subItem.text && subItem.text.trim()) {
                        instructions.push({ 
                            stepNumber: instructions.length + 1,
                            text: subItem.text.trim() 
                        });
                    } else if (typeof subItem === "string" && subItem.trim()) {
                        instructions.push({ 
                            stepNumber: instructions.length + 1,
                            text: subItem.trim() 
                        });
                    }
                });
            }
        });
    }
    
    // Handle recipeData.steps (Safari fallback format)
    if (recipeData.steps && Array.isArray(recipeData.steps) && instructions.length === 0) {
        recipeData.steps.forEach(group => {
            if (group.items && Array.isArray(group.items)) {
                group.items.forEach(item => {
                    if (item && typeof item === "string" && item.trim()) {
                        instructions.push({ 
                            stepNumber: instructions.length + 1, 
                            text: item.trim() 
                        });
                    }
                });
            }
        });
    }
    
    // Build the AWS-compatible recipe data
    const transformedData = {
        title: recipeData.title || "Unknown Recipe",
        ingredients: ingredients,
        instructions: instructions,
        sourceUrl: recipeData.source || recipeData.url || recipeData.sourceUrl
    };
    
    // Add optional fields if they exist
    if (recipeData.servingSize) {
        const servings = parseInt(recipeData.servingSize);
        if (servings && servings > 0) {
            transformedData.servings = servings;
        }
    }
    
    if (recipeData.time) {
        // Try to parse time strings to minutes
        const timeStr = recipeData.time.toString().toLowerCase();
        if (timeStr.includes("min")) {
            const minutes = parseInt(timeStr.match(/\d+/)?.[0]);
            if (minutes && minutes > 0) {
                transformedData.totalTimeMinutes = minutes;
            }
        }
    }
    
    // Add image if available (from photos array, imageUrl, or mainPhotoUrl)
    let imageUrl = null;
    if (recipeData.photos && Array.isArray(recipeData.photos) && recipeData.photos.length > 0) {
        imageUrl = recipeData.photos[0];
    } else if (recipeData.mainPhotoUrl) {
        imageUrl = recipeData.mainPhotoUrl;
    } else if (recipeData.imageUrl) {
        imageUrl = recipeData.imageUrl;
    }
    
    if (imageUrl && imageUrl.trim()) {
        transformedData.mainPhotoUrl = imageUrl.trim();
    }
    
    // Ensure sourceUrl is a valid URL - AWS backend validates this
    try {
        new URL(transformedData.sourceUrl);
    } catch (e) {
        // If the sourceUrl is invalid, use current page URL as fallback
        transformedData.sourceUrl = currentUrl || "unknown";
    }
    
    console.log("🔧 Transformed ingredients:", ingredients.length, "items");
    console.log("🔧 Transformed instructions:", instructions.length, "steps");
    
    // Validate required fields for AWS backend
    if (!transformedData.title || transformedData.title.trim() === "") {
        throw new Error("Recipe title is required");
    }
    
    // Temporary: Allow empty ingredients/instructions for debugging
    if (ingredients.length === 0) {
        console.warn("⚠️ No ingredients found - adding placeholder for debugging");
        ingredients.push({ text: "[No ingredients extracted - parser debugging needed]" });
    }
    
    if (instructions.length === 0) {
        console.warn("⚠️ No instructions found - adding placeholder for debugging");
        instructions.push({ 
            stepNumber: 1, 
            text: "[No instructions extracted - parser debugging needed]" 
        });
    }
    
    if (!transformedData.sourceUrl) {
        throw new Error("Source URL is required");
    }

    return transformedData;
}

async function sendToAWSBackend(recipeData, currentUrl = "unknown") {
    try {
        if (typeof CONFIG === "undefined") {
            return {
                success: false,
                error: "AWS backend skipped (CONFIG not loaded)"
            };
        }
        // Get current user auth (check localStorage for auth token)
        const authData = localStorage.getItem("recipeArchive.auth");
        if (!authData) {
            return {
                success: false,
                error: "No authentication token found. Please sign in again."
            };
        }
        let userToken;
        try {
            const auth = JSON.parse(authData);
            userToken = auth.token || auth.accessToken || auth.idToken;
        } catch {
            return {
                success: false,
                error: "Invalid authentication data. Please sign in again."
            };
        }
        if (!userToken) {
            return {
                success: false,
                error: "No valid authentication token. Please sign in again."
            };
        }
        // Transform data to match AWS backend expected format
        let transformedData;
        try {
            transformedData = transformRecipeDataForAWS(recipeData, currentUrl);
            
            // Download and replace image URL with S3 URL if image exists
            if (transformedData.mainPhotoUrl) {
                try {
                    const s3ImageUrl = await downloadAndUploadImage(transformedData.mainPhotoUrl, transformedData.title);
                    if (s3ImageUrl) {
                        transformedData.mainPhotoUrl = s3ImageUrl;
                        console.log("✅ Image uploaded to S3:", s3ImageUrl);
                    } else {
                        console.warn("⚠️ Failed to upload image to S3, keeping original URL");
                    }
                } catch (imageError) {
                    console.error("❌ Error processing image:", imageError);
                    // Continue with original URL if image processing fails
                }
            }
        } catch (transformError) {
            // Submit diagnostic data for transformation failures
            if (typeof submitDiagnosticData === "function") {
                await submitDiagnosticData({
                    error: transformError.message,
                    errorType: "recipe_transformation_failed",
                    url: currentUrl,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    stage: "data_transformation",
                    rawRecipeData: recipeData
                });
            } else if (typeof window !== "undefined" && typeof window.submitDiagnosticData === "function") {
                await window.submitDiagnosticData({
                    error: transformError.message,
                    errorType: "recipe_transformation_failed",
                    url: currentUrl,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    stage: "data_transformation",
                    rawRecipeData: recipeData
                });
            }
            return {
                success: false,
                error: `Recipe parsing failed: ${transformError.message}`
            };
        }
        // Use proper AWS API authentication format (same as Chrome extension)
        const awsAPI = CONFIG.getCurrentAPI();
        const response = await fetch(awsAPI.recipes, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${userToken}`
            },
            body: JSON.stringify(transformedData)
        });
        if (response.ok) {
            const result = await response.json();
            return {
                success: true,
                id: result.id || result.recipeId || "aws-" + Date.now(),
                result: result,
                message: "Successfully saved to AWS"
            };
        } else {
            const errorText = await response.text();
            let errorMessage = errorText;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.message || errorText;
            } catch {
                // Keep original text if not JSON
            }
            
            // Handle token expiration (401) with automatic refresh
            if (response.status === 401 && errorMessage.includes("expired")) {
                console.log("🔄 Token expired, attempting to refresh...");
                const refreshResult = await refreshAuthToken();
                
                if (refreshResult.success) {
                    console.log("✅ Token refreshed successfully, retrying request...");
                    // Retry the original request with new token
                    const newAuthData = localStorage.getItem("recipeArchive.auth");
                    if (newAuthData) {
                        const newAuth = JSON.parse(newAuthData);
                        const newToken = newAuth.token || newAuth.accessToken || newAuth.idToken;
                        
                        const retryResponse = await fetch(awsAPI.recipes, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${newToken}`
                            },
                            body: JSON.stringify(transformedData)
                        });
                        
                        if (retryResponse.ok) {
                            const retryResult = await retryResponse.json();
                            console.log("✅ Retry successful after token refresh:", retryResult);
                            return {
                                success: true,
                                id: retryResult.id || retryResult.recipeId || "aws-" + Date.now(),
                                result: retryResult,
                                message: "Successfully saved to AWS after token refresh"
                            };
                        } else {
                            const retryErrorText = await retryResponse.text();
                            console.error("❌ Retry failed even after token refresh:", retryErrorText);
                            return {
                                success: false,
                                error: `AWS API ${retryResponse.status}: ${retryErrorText}`
                            };
                        }
                    }
                } else {
                    console.error("❌ Token refresh failed:", refreshResult.error);
                    // Clear invalid auth and force re-login
                    isSignedIn = false;
                    localStorage.removeItem("recipeArchive.auth");
                    renderUI();
                    return {
                        success: false,
                        error: "Session expired. Please sign in again."
                    };
                }
            }
            
            return {
                success: false,
                error: `AWS API ${response.status}: ${errorMessage}`
            };
        }
    } catch (error) {
        return {
            success: false,
            error: `AWS connection failed: ${error.message}`
        };
    }
}

// Submit diagnostic data to AWS backend for debugging parsing failures
async function submitDiagnosticData(diagnosticPayload) {
    try {
        const diagnosticsEndpoint = CONFIG.getCurrentAPI().diagnostics;
        console.log("🔍 Submitting diagnostic data to:", diagnosticsEndpoint);
        console.log("🔍 Diagnostic payload:", diagnosticPayload);

        // Get auth token for diagnostics endpoint
        let authHeaders = { "Content-Type": "application/json" };
        try {
            const authData = localStorage.getItem("recipeArchive.auth");
            if (authData) {
                const auth = JSON.parse(authData);
                const token = auth.token || auth.accessToken || auth.idToken;
                if (token) {
                    authHeaders["Authorization"] = `Bearer ${token}`;
                }
            }
        } catch (error) {
            console.warn("⚠️ Could not get auth token for diagnostics:", error.message);
        }

        const response = await fetch(diagnosticsEndpoint, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(diagnosticPayload)
        });

        if (response.ok) {
            const result = await response.json();
            console.log("📊 Diagnostic data submitted successfully:", result);
        } else {
            console.warn("⚠️ Diagnostic submission failed:", response.status, await response.text());
        }
    } catch (error) {
        console.warn("⚠️ Failed to submit diagnostic data:", error.message);
        // Don't throw - diagnostic submission failures shouldn't break the main flow
    }
}


// Credential management functions for convenience
function saveCredentials(email, password) {
    const credentials = { email, password };
    localStorage.setItem("recipeArchive.credentials", JSON.stringify(credentials));
}

function loadCredentials() {
    try {
        const saved = localStorage.getItem("recipeArchive.credentials");
        return saved ? JSON.parse(saved) : { email: "", password: "" };
    } catch (error) {
        console.error("Error loading credentials:", error);
        return { email: "", password: "" };
    }
}

function clearCredentials() {
    localStorage.removeItem("recipeArchive.credentials");
}