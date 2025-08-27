/* eslint-env browser */
// RecipeArchive Chrome Extension Popup with full backend integration

// State management
let isSignedIn = false;
let currentUser = null;

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
            currentUser = JSON.parse(storedAuth);
            isSignedIn = true;
        } catch (error) {
            console.error("Error parsing stored auth:", error);
            isSignedIn = false;
            currentUser = null;
        }
    }
    
    renderUI();
}

function renderUI() {
    const container = document.getElementById("main-container");
    
    if (isSignedIn) {
        // Signed in UI - show capture functionality
        container.innerHTML = `
            <div style="position: relative;">
                <h1 style="margin: 0 0 20px 0; font-size: 18px; color: #333;">RecipeArchive</h1>
                <a href="#" id="signout-link" style="position: absolute; top: 0; right: 0; font-size: 11px; color: #666; text-decoration: none;">sign out</a>
            </div>
            <div style="margin-bottom: 15px; padding: 10px; background: #e8f5e8; border-radius: 4px; font-size: 12px;">
                ✅ Signed in as ${currentUser ? currentUser.email : "user"}
            </div>
            <button id="capture" style="width: 100%; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">Capture Recipe</button>
            <div id="status" style="margin-top: 15px; padding: 10px; border-radius: 4px; font-size: 12px; display: none;"></div>
        `;
        
        // Attach event listeners for signed-in state
        document.getElementById("capture").onclick = function() {
            captureRecipe();
        };
        
        document.getElementById("signout-link").onclick = function(e) {
            e.preventDefault();
            signOut();
        };
        
    } else {
        // Not signed in UI - show sign in form
        container.innerHTML = `
            <h1 style="margin: 0 0 20px 0; font-size: 18px; color: #333; text-align: center;">RecipeArchive</h1>
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
        // Initialize CognitoAuth with configuration
        const cognitoAuth = new ChromeCognitoAuth({
            region: 'us-west-2',
            userPoolId: 'us-west-2_qJ1i9RhxD',
            clientId: '5grdn7qhf1el0ioqb6hkelr29s'
        });
        
        // Perform real Cognito authentication
        const result = await cognitoAuth.signIn(email, password);
        
        if (result.success) {
            console.log("🔧 Cognito authentication result:", result);
            console.log("🔧 Cognito result.data:", result.data);
            console.log("🔧 Available tokens:", {
                hasAccessToken: !!result.data.AccessToken,
                hasIdToken: !!result.data.IdToken,
                hasRefreshToken: !!result.data.RefreshToken,
                accessTokenPreview: result.data.AccessToken ? result.data.AccessToken.substring(0, 50) + "..." : "null",
                idTokenPreview: result.data.IdToken ? result.data.IdToken.substring(0, 50) + "..." : "null"
            });
            
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

function signOut() {
    isSignedIn = false;
    currentUser = null;
    localStorage.removeItem("recipeArchive.auth");
    // Note: Keeping saved credentials for convenience
    // Users can clear them manually if desired
    renderUI();
}

async function captureRecipe() {
    if (!isSignedIn) {
        showStatus("❌ Please sign in first", "#ffebee");
        return;
    }

    showStatus("📝 Capturing recipe from page...", "#e7f3ff");

    try {
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            showStatus("❌ Cannot access current tab", "#ffebee");
            return;
        }

        // Inject content script to extract recipe data
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: extractRecipeFromPage
        });

        if (!results || !results[0] || !results[0].result) {
            showStatus("❌ Could not extract recipe data", "#ffebee");
            return;
        }

        const recipeData = results[0].result;
        console.log("📝 Extracted recipe data:", recipeData);

        if (!recipeData.title) {
            showStatus("❌ No recipe found on this page", "#ffebee");
            return;
        }

        // Send to AWS backend
        showStatus("☁️ Saving to AWS...", "#e7f3ff");
        const result = await sendToAWSBackend(recipeData);
        
        if (result.success) {
            showStatus("✅ Recipe saved successfully!", "#e8f5e8");
        } else {
            showStatus("❌ Failed to save: " + result.error, "#ffebee");
        }

    } catch (error) {
        console.error("❌ Recipe capture error:", error);
        showStatus("❌ Capture failed: " + error.message, "#ffebee");
    }
}

// Content script function to extract recipe data
function extractRecipeFromPage() {
    const recipe = {
        title: "",
        ingredients: [],
        instructions: [],
        url: window.location.href,
        extractedAt: new Date().toISOString()
    };

    // Try to extract title
    const titleSelectors = [
        'h1[class*="recipe"]',
        '.recipe-title',
        '.entry-title',
        'h1',
        '.post-title'
    ];
    
    for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
            recipe.title = element.textContent.trim();
            break;
        }
    }

    // Try to extract ingredients
    const ingredientSelectors = [
        '.recipe-ingredient',
        '.ingredients li',
        '[class*="ingredient"] li',
        '.recipe-ingredients li'
    ];
    
    for (const selector of ingredientSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            recipe.ingredients = Array.from(elements).map(el => el.textContent.trim()).filter(text => text);
            break;
        }
    }

    // Try to extract instructions
    const instructionSelectors = [
        '.recipe-instruction',
        '.instructions li',
        '.directions li',
        '.recipe-instructions li',
        '.recipe-directions li'
    ];
    
    for (const selector of instructionSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            recipe.instructions = Array.from(elements).map(el => el.textContent.trim()).filter(text => text);
            break;
        }
    }

    return recipe;
}

async function sendToAWSBackend(recipeData) {
    try {
        const authData = localStorage.getItem("recipeArchive.auth");
        if (!authData) {
            return { success: false, error: "No authentication token found" };
        }

        const auth = JSON.parse(authData);
        if (!auth.token) {
            return { success: false, error: "No valid authentication token" };
        }

        console.log("🔧 Sending to AWS with token preview:", auth.token.substring(0, 50) + "...");

        const response = await fetch('https://fhm2vhw7g1.execute-api.us-west-2.amazonaws.com/prod/recipes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify(recipeData)
        });

        console.log("🔧 AWS Response status:", response.status);
        console.log("🔧 AWS Response headers:", Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ AWS API Error:", errorText);
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
