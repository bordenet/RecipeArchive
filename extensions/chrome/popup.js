/* eslint-env browser */
// RecipeArchive Chrome Extension Popup with full backend integration

// State management
let isSignedIn = false;
// let currentUser = null; // Removed unused variable

// Get extension version from manifest
function getExtensionVersion() {
    return chrome.runtime.getManifest().version;
}

// Create version display element
function createVersionDisplay() {
    const version = getExtensionVersion();
    const webAppUrl = CONFIG.WEB_APP_URL;
    
    return `
        <div style="position: absolute; top: 8px; left: 20px; z-index: 1000;">
            <a href="${webAppUrl}" target="_blank" 
               style="font-size: 11px; color: #888; text-decoration: none; font-family: Arial, sans-serif;"
               title="Open RecipeArchive Web App">v${version}</a>
        </div>
    `;
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

document.addEventListener("DOMContentLoaded", function() {
    const container = document.createElement("div");
    container.style.cssText = "padding: 20px; min-width: 320px; font-family: Arial, sans-serif;";
    container.id = "main-container";
    
    document.body.appendChild(container);
    
    // Check authentication status on extension load
    checkAuthenticationStatus();
});

function checkAuthenticationStatus() {
    // Check if user is signed in (from storage or session)
    const storedAuth = localStorage.getItem("recipeArchive.auth");
    if (storedAuth) {
        try {
            isSignedIn = true;
        } catch (error) {
            console.error("Error parsing stored auth:", error);
            isSignedIn = false;
        }
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
                <h1 style="margin: 0 0 20px 0; font-size: 18px; color: #333;">RecipeArchive</h1>
                <a href="#" id="signout-link" style="position: absolute; top: -12px; right: 0; font-size: 11px; color: #666; text-decoration: none;">sign out</a>
            </div>
            <button id="capture" style="width: 100%; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">Capture Recipe</button>
            <div id="status" style="margin-top: 15px; padding: 10px; border-radius: 4px; font-size: 12px; display: none;"></div>
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
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
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
        });
        
    } else {
        // Not signed in UI - show sign in form
        container.innerHTML = `
            ${versionDisplay}
            <div style="padding-top: 20px;">
                <h1 style="margin: 0 0 20px 0; font-size: 18px; color: #333; text-align: center;">RecipeArchive</h1>
            </div>
            <div style="margin-bottom: 20px; padding: 10px; background: #fff3e0; border-radius: 4px; font-size: 12px; text-align: center;">
                Sign in to capture recipes
            </div>
            
            <form id="signin-form">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #666;">Email</label>
                    <input type="email" id="email" required 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #666;">Password</label>
                    <input type="password" id="password" required 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="font-size: 12px; color: #666; cursor: pointer;">
                        <input type="checkbox" id="show-password" style="margin-right: 5px;"> Show password
                    </label>
                </div>
                
                <button type="submit" id="signin-btn" 
                        style="width: 100%; padding: 12px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    Sign In
                </button>
            </form>
            
            <div id="clear-credentials-container"></div>
            
            <div id="status" style="margin-top: 15px; padding: 10px; border-radius: 4px; font-size: 12px; display: none;"></div>
        `;
        
        // Load saved credentials and populate form
        const savedCreds = loadCredentials();
        document.getElementById("email").value = savedCreds.email || "";
        document.getElementById("password").value = savedCreds.password || "";
        
        // Add clear credentials link if there are saved credentials
        if (savedCreds.email) {
            document.getElementById("clear-credentials-container").innerHTML = `
                <div style="margin-top: 10px; text-align: center;">
                    <a href="#" id="clear-credentials" style="font-size: 12px; color: #666; text-decoration: none;">Clear saved credentials</a>
                </div>
            `;
        }
        
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
        
        // Initialize ChromeCognitoAuth with configuration from CONFIG
        const cognitoConfig = CONFIG.getCognitoConfig();
        const cognitoAuth = new ChromeCognitoAuth({
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
            
            // Store authentication data
            
            // Store auth data
            isSignedIn = true;
            localStorage.setItem("recipeArchive.auth", JSON.stringify(authData));
            
            // Authentication data stored successfully
            
            // Switch to production mode for AWS API calls
            if (typeof CONFIG !== "undefined") {
                CONFIG.enableProduction();
            }
            
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
        
        // Initialize ChromeCognitoAuth with configuration
        const cognitoConfig = CONFIG.getCognitoConfig();
        const cognitoAuth = new ChromeCognitoAuth({
            region: cognitoConfig.region,
            userPoolId: cognitoConfig.userPoolId,
            clientId: cognitoConfig.clientId
        });
        
        // Call the refresh token method
        const result = await cognitoAuth.refreshToken(auth.refreshToken);
        
        if (result.success) {
            console.log("✅ Token refresh successful");
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
    isSignedIn = false;
    localStorage.removeItem("recipeArchive.auth");
    // Note: Keeping saved credentials for convenience
    // Users can clear them manually if desired
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
        
        // Download the image
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        
        const contentType = response.headers.get("content-type") || "image/jpeg";
        const imageBlob = await response.blob();
        
        console.log(`📦 Downloaded image (${imageBlob.size} bytes, ${contentType})`);
        
        // Convert blob to base64 for AWS upload
        const arrayBuffer = await imageBlob.arrayBuffer();
        const base64String = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        
        // Upload to S3 via API Gateway
        const api = CONFIG.getCurrentAPI();
        const uploadResponse = await fetch(`${api.base}/v1/images/upload`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${JSON.parse(localStorage.getItem("recipeArchive.auth") || "{}").token}`
            },
            body: JSON.stringify({
                filename: filename,
                contentType: contentType,
                imageData: base64String
            })
        });
        
        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
        }
        
        const uploadResult = await uploadResponse.json();
        console.log("✅ Image uploaded to S3:", uploadResult);
        
        return uploadResult.imageUrl || uploadResult.url;
        
    } catch (error) {
        console.error("❌ Image download/upload failed:", error);
        return null;
    }
}

async function captureRecipe() {
    if (!isSignedIn) {
        showStatus("❌ Please sign in first", "#ffebee");
        return;
    }

    showStatus("📝 Capturing recipe from page...", "#e7f3ff");

    let tab;
    try {
        // Get the active tab
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tab = activeTab;
        
        if (!tab) {
            showStatus("❌ Cannot access current tab", "#ffebee");
            return;
        }

        // Check if the current site is supported
        if (typeof window.RecipeArchiveSites !== "undefined" && !window.RecipeArchiveSites.isSupportedSite(tab.url)) {
            const supportedSites = window.RecipeArchiveSites.getSupportedSites();
            showStatus(`❌ This site is not supported. Supported sites include: ${supportedSites.slice(0, 3).join(", ")}, and ${supportedSites.length - 3} more.`, "#ffebee");
            return;
        }

        // Use content script message system to leverage TypeScript parsers
        showStatus("🔍 Extracting recipe...", "#e3f2fd");
        
        // First, try to ping the content script to see if it's already loaded
        let response = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { action: "ping" }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ status: "error", needsInjection: true });
                } else {
                    resolve(response || { status: "error", needsInjection: true });
                }
            });
        });

        // If content script isn't responding, try to inject it manually
        if (response.needsInjection || response.status === "error") {
            console.log("🔧 Content script not responding, injecting manually...");
            showStatus("🔧 Loading parser system...", "#e3f2fd");
            
            try {
                // Check if we can inject into this tab (some pages are restricted)
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ["typescript-parser-bundle.js", "content.js"]
                });
                
                // Wait for injection to complete
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log("✅ Content script injected successfully");
            } catch (injectionError) {
                console.error("❌ Cannot inject content script:", injectionError);
                showStatus("❌ Cannot capture recipe from this page", "#ffebee");
                return;
            }
        }
        
        // Now send the capture message
        response = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { action: "captureRecipe" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Content script communication error:", chrome.runtime.lastError);
                    resolve({ status: "error", error: chrome.runtime.lastError.message });
                } else {
                    resolve(response);
                }
            });
        });

        if (response.status === "error") {
            console.error("Content script error:", response.error);
            showStatus("❌ Error communicating with content script", "#ffebee");
            return;
        }


        const results = [{ result: response.data }];
        if (!results || !results[0] || !results[0].result) {
            showStatus("❌ Could not extract recipe data", "#ffebee");
            // Fallback: submit to failed-parse API
            await submitFallbackParse(tab);
            return;
        }

        const recipeData = results[0].result;
        console.log("📝 Extracted recipe data:", recipeData);

        // Download and replace image URL with S3 URL
        if (recipeData.image || recipeData.imageUrl) {
            showStatus("🖼️ Downloading recipe image...", "#e7f3ff");
            const originalImageUrl = recipeData.image || recipeData.imageUrl;
            try {
                const s3ImageUrl = await downloadAndUploadImage(originalImageUrl, recipeData.title);
                if (s3ImageUrl) {
                    recipeData.image = s3ImageUrl;
                    recipeData.imageUrl = s3ImageUrl;
                    console.log("✅ Image uploaded to S3:", s3ImageUrl);
                } else {
                    console.warn("⚠️ Failed to upload image to S3, keeping original URL");
                }
            } catch (imageError) {
                console.error("❌ Error processing image:", imageError);
                // Continue with original URL if image processing fails
            }
        }

        // Fallback logic: check for missing ingredients/instructions
        const missingIngredients = !recipeData.ingredients || recipeData.ingredients.length === 0;
        const missingInstructions = (!recipeData.instructions || recipeData.instructions.length === 0) && (!recipeData.steps || recipeData.steps.length === 0);
        if (missingIngredients || missingInstructions) {
            showStatus("❌ Recipe extraction incomplete. Attempting fallback...", "#ffebee");
            await submitFallbackParse(tab, recipeData);
            // TODO: Post-MVP: Allow manual copy/paste fallback for failed extractions
            return;
        }

        if (!recipeData.title) {
            showStatus("❌ No recipe found on this page", "#ffebee");
            await submitFallbackParse(tab, recipeData);
            return;
        }

        // Send to AWS backend
        showStatus("☁️ Saving to AWS...", "#e7f3ff");
        console.log("🔧 About to call sendToAWSBackend with data:", recipeData);
        const result = await sendToAWSBackend(recipeData, tab && tab.url ? tab.url : "unknown");
        console.log("🔧 sendToAWSBackend result:", result);

        if (result.success) {
            if (result.id) {
                showStatus(`✅ Saved to AWS! Recipe ID: ${result.id}`, "#d4edda");
            } else {
                showStatus("✅ Recipe saved successfully!", "#e8f5e8");
            }
        } else {
            console.error("❌ AWS save failed:", result.error);
            showStatus("❌ Failed to save: " + result.error, "#ffebee");
        }

    } catch (error) {
        console.error("❌ Recipe capture error:", error);
        showStatus("❌ Capture failed: " + error.message, "#ffebee");
        // Submit diagnostic data for parsing failures
        await submitDiagnosticData({
            error: error.message,
            errorType: "recipe_capture_failed",
            url: tab && tab.url ? tab.url : "unknown",
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            stage: "recipe_capture"
        });
    }
}

// Fallback: submit page HTML and metadata to failed-parse API
async function submitFallbackParse(tab, recipeData = {}) {
    try {
        showStatus("🔍 Submitting fallback parse request...", "#e3f2fd");
        const diagnosticsEndpoint = CONFIG.getCurrentAPI().diagnostics;
        const html = await new Promise((resolve) => {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => document.documentElement.outerHTML
            }, (results) => {
                resolve(results && results[0] && results[0].result ? results[0].result : "");
            });
        });
        const payload = {
            url: tab.url,
            html,
            userAgent: navigator.userAgent,
            extensionVersion: chrome.runtime.getManifest().version,
            extractionAttempt: {
                method: recipeData && recipeData._extractionMethod ? recipeData._extractionMethod : "unknown",
                timeElapsed: recipeData && recipeData._extractionTime ? recipeData._extractionTime : 0,
                elementsFound: {},
                partialData: recipeData || {}
            },
            timestamp: new Date().toISOString(),
            failureReason: "Incomplete extraction"
        };
        const response = await fetch(diagnosticsEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            showStatus("📊 Fallback parse request submitted.", "#d4edda");
        } else {
            showStatus("⚠️ Fallback parse submission failed.", "#ffebee");
        }
    } catch (error) {
        showStatus("⚠️ Fallback parse error: " + error.message, "#ffebee");
    }
}

function transformRecipeDataForAWS(recipeData) {
    // Transform Chrome extension format to AWS backend expected format
    const ingredients = [];
    const instructions = [];
    
    // DEBUG: Log the actual structure we're receiving
    console.log("🔧 RAW recipeData structure:", JSON.stringify(recipeData, null, 2));
    console.log("🔧 recipeData.ingredients type:", typeof recipeData.ingredients, recipeData.ingredients);
    console.log("🔧 recipeData.steps type:", typeof recipeData.steps, recipeData.steps);
    console.log("🔧 recipeData.instructions type:", typeof recipeData.instructions, recipeData.instructions);
    
    // Transform ingredients - Handle both flat arrays and grouped format
    // Flat format: ["text1", "text2"] -> AWS format: [{ text: "text1" }, { text: "text2" }]
    // Grouped format: [{ title: null, items: [...] }] -> AWS format: [{ text: "text1" }, ...]
    if (recipeData.ingredients && Array.isArray(recipeData.ingredients)) {
        recipeData.ingredients.forEach(item => {
            if (item && typeof item === "string" && item.trim()) {
                // Flat format - direct string
                ingredients.push({ text: item.trim() });
            } else if (item && item.items && Array.isArray(item.items)) {
                // Grouped format - extract from items array
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
    
    // Transform instructions - Handle both flat arrays and grouped format
    // Flat format: ["step1", "step2"] -> AWS format: [{ stepNumber: 1, text: "step1" }, ...]
    // Grouped format: [{ title: null, items: [...] }] -> AWS format: [{ stepNumber: 1, text: "step1" }, ...]
    if (recipeData.instructions && Array.isArray(recipeData.instructions)) {
        recipeData.instructions.forEach((item, index) => {
            if (item && typeof item === "string" && item.trim()) {
                // Flat format - direct string
                instructions.push({ 
                    stepNumber: index + 1, 
                    text: item.trim() 
                });
            } else if (item && item.items && Array.isArray(item.items)) {
                // Grouped format - extract from items array
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
    
    // Also handle `steps` field (TypeScript parser uses this field name)
    if (recipeData.steps && Array.isArray(recipeData.steps)) {
        recipeData.steps.forEach((item, _index) => {
            if (item && typeof item === "string" && item.trim()) {
                // Flat format - direct string
                instructions.push({ 
                    stepNumber: instructions.length + 1, 
                    text: item.trim() 
                });
            } else if (item && item.items && Array.isArray(item.items)) {
                // Grouped format - extract from items array
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
    
    // Build the AWS-compatible recipe data with only required fields
    const transformedData = {
        title: recipeData.title || "Unknown Recipe",
        ingredients: ingredients,
        instructions: instructions,
        sourceUrl: recipeData.url || recipeData.sourceUrl || window.location.href
    };
    
    // Only add optional fields if they have valid values
    if (recipeData.servingSize) {
        const servings = parseInt(recipeData.servingSize);
        if (servings && servings > 0) {
            transformedData.servings = servings;
        }
    }
    
    if (recipeData.cookTime) {
        // Try to parse time strings to minutes
        const timeStr = recipeData.cookTime.toString().toLowerCase();
        if (timeStr.includes("min")) {
            const minutes = parseInt(timeStr.match(/\d+/)?.[0]);
            if (minutes && minutes > 0) {
                transformedData.totalTimeMinutes = minutes;
            }
        }
    }
    
    // Ensure sourceUrl is a valid URL - AWS backend validates this
    try {
        new URL(transformedData.sourceUrl);
    } catch {
        // If the sourceUrl is invalid, use current page URL as fallback
        transformedData.sourceUrl = window.location.href;
    }
    
    console.log("🔧 Transformed ingredients:", ingredients.length, "items");
    console.log("🔧 Transformed instructions:", instructions.length, "steps");
    
    // Validate required fields for AWS backend
    if (!transformedData.title || transformedData.title.trim() === "") {
        throw new Error("Recipe title is required");
    }
    
    // Validate that we actually found recipe content
    if (ingredients.length === 0) {
        throw new Error("No ingredients found on this page. This may not be a recipe page, or the page format has changed.");
    }
    
    if (instructions.length === 0) {
        throw new Error("No cooking instructions found on this page. This may not be a recipe page, or the page format has changed.");
    }
    
    if (!transformedData.sourceUrl) {
        throw new Error("Source URL is required");
    }

    return transformedData;
}

async function sendToAWSBackend(recipeData, currentUrl = "unknown") {
    console.log("🔧 sendToAWSBackend called with:", recipeData);
    
    try {
        const authData = localStorage.getItem("recipeArchive.auth");
        console.log("🔧 Retrieved auth data:", authData ? "exists" : "null");
        // Auth data retrieved from storage
        
        if (!authData) {
            console.error("❌ No auth data found in localStorage");
            return { success: false, error: "No authentication token found" };
        }

        const auth = JSON.parse(authData);
        console.log("🔧 Parsed auth data:", auth);
        console.log("🔧 Parsed auth data structure:", {
            hasToken: !!auth.token,
            hasAccessToken: !!auth.accessToken,
            hasIdToken: !!auth.idToken,
            tokenPreview: auth.token ? auth.token.substring(0, 50) + "..." : "null",
            allKeys: Object.keys(auth)
        });
        
        // Extract and log user information from JWT token
        if (auth.token) {
            try {
                const tokenParts = auth.token.split(".");
                if (tokenParts.length === 3) {
                    const payload = JSON.parse(atob(tokenParts[1]));
                    console.log("🔧 JWT Token payload:", {
                        email: payload.email,
                        sub: payload.sub,
                        username: payload["cognito:username"]
                    });
                }
            } catch (e) {
                console.warn("Could not decode JWT token:", e);
            }
        }
        
        if (!auth.token) {
            console.error("❌ No token in auth data");
            return { success: false, error: "No valid authentication token" };
        }

        // Sending recipe data to AWS backend

        // Transform data to match AWS backend expected format
        let transformedData;
        try {
            transformedData = transformRecipeDataForAWS(recipeData);
            console.log("🔧 Transformed recipe data for AWS:", transformedData);
            console.log("🔧 JSON payload being sent:", JSON.stringify(transformedData, null, 2));
        } catch (transformError) {
            console.error("❌ Recipe transformation failed:", transformError);
            
            // Submit diagnostic data for transformation failures
            await submitDiagnosticData({
                error: transformError.message,
                errorType: "recipe_transformation_failed",
                url: currentUrl,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                stage: "data_transformation",
                rawRecipeData: recipeData
            });
            
            return {
                success: false,
                error: `Recipe parsing failed: ${transformError.message}`
            };
        }

        // Use the correct API endpoint from CONFIG
        const apiEndpoint = CONFIG.getCurrentAPI().recipes;
        console.log("🔧 Using API endpoint:", apiEndpoint);

        const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${auth.token}`
            },
            body: JSON.stringify(transformedData)
        });

        console.log("🔧 AWS Response status:", response.status);
        console.log("🔧 AWS Response headers:", Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ AWS API Error:", errorText);
            
            // Handle token expiration (401) with automatic refresh
            if (response.status === 401 && errorText.includes("expired")) {
                console.log("🔄 Token expired, attempting to refresh...");
                const refreshResult = await refreshAuthToken();
                
                if (refreshResult.success) {
                    console.log("✅ Token refreshed successfully, retrying request...");
                    // Retry the original request with new token
                    const newAuth = JSON.parse(localStorage.getItem("recipeArchive.auth"));
                    const retryResponse = await fetch(apiEndpoint, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${newAuth.token}`
                        },
                        body: JSON.stringify(transformedData)
                    });
                    
                    if (retryResponse.ok) {
                        const retryResult = await retryResponse.json();
                        console.log("✅ Retry successful after token refresh:", retryResult);
                        return { success: true, data: retryResult };
                    } else {
                        const retryErrorText = await retryResponse.text();
                        console.error("❌ Retry failed even after token refresh:", retryErrorText);
                        return { 
                            success: false, 
                            error: `HTTP ${retryResponse.status}: ${retryErrorText}` 
                        };
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
                error: `HTTP ${response.status}: ${errorText}` 
            };
        }

        const result = await response.json();
        console.log("✅ AWS Response:", result);
        return { success: true, data: result };

    } catch (error) {
        console.error("❌ AWS backend error:", error);
        return {
            success: false,
            error: `AWS connection failed: ${error.message}`
        };
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
