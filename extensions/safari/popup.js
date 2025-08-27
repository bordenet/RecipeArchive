// RecipeArchive Safari popup with authentication-first UX
console.log("RecipeArchive Safari popup loading");

// State management
let isSignedIn = false;
let currentUser = null;
let extensionAPI = null;

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
        console.log("🦏 Using Safari browser API");
    } else if (typeof chrome !== "undefined") {
        extensionAPI = chrome;
        console.log("🌐 Using Chrome API");
    }
    
    if (!extensionAPI) {
        console.error("❌ No extension API available");
        showStatus("Extension API not available", "#ffebee");
        return false;
    }
    
    return true;
}

function checkAuthenticationStatus() {
    // Check if user is signed in (from storage or session)
    // TODO: Replace with real AWS Cognito check
    const storedAuth = localStorage.getItem("recipeArchive.auth");
    if (storedAuth) {
        try {
            currentUser = JSON.parse(storedAuth);
            isSignedIn = true;
        } catch {
            isSignedIn = false;
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
                <h1 style="margin: 0 0 20px 0; font-size: 18px; color: #333;">🍽️ RecipeArchive</h1>
                <a href="#" id="signout-link" style="position: absolute; top: 0; right: 0; font-size: 11px; color: #666; text-decoration: none;">sign out</a>
            </div>
            <div style="margin-bottom: 15px; padding: 10px; background: #e8f5e8; border-radius: 8px; font-size: 12px;">
                ✅ Signed in as ${currentUser ? currentUser.email : "user"}
            </div>
            <button id="capture" style="width: 100%; padding: 12px; background: #007AFF; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">Capture Recipe</button>
            <div id="status" style="margin-top: 15px; padding: 10px; border-radius: 8px; font-size: 12px; display: none;"></div>
        `;
        
        // Attach event listeners for signed-in state
        document.getElementById("capture").onclick = function() {
            console.log("🎯 Capture button clicked!");
            captureRecipe();
        };
        
        document.getElementById("signout-link").onclick = function(e) {
            e.preventDefault();
            signOut();
        };
        
    } else {
        // Not signed in UI - show sign in form
        container.innerHTML = `
            <h1 style="margin: 0 0 20px 0; font-size: 18px; color: #333; text-align: center;">🍽️ RecipeArchive</h1>
            <div style="margin-bottom: 20px; padding: 10px; background: #fff3e0; border-radius: 8px; font-size: 12px; text-align: center;">
                Sign in to capture recipes
            </div>
            
            <form id="signin-form">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #666;">Email</label>
                    <input type="email" id="email" required 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #666;">Password</label>
                    <input type="password" id="password" required 
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
    }
}

function handleSignIn() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    
    showStatus("Signing in...", "#e3f2fd");
    
    // TODO: Replace with real AWS Cognito authentication
    // For now, simulate authentication
    setTimeout(() => {
        if (email && password) {
            // Simulate successful sign in
            currentUser = { email: email };
            isSignedIn = true;
            localStorage.setItem("recipeArchive.auth", JSON.stringify(currentUser));
            renderUI();
            showStatus("✅ Signed in successfully", "#e8f5e8");
        } else {
            showStatus("❌ Please enter email and password", "#ffebee");
        }
    }, 1000);
}

function signOut() {
    isSignedIn = false;
    currentUser = null;
    localStorage.removeItem("recipeArchive.auth");
    renderUI();
}

function captureRecipe() {
    console.log("🎯 captureRecipe() function called!");
    console.log("🎯 extensionAPI available:", !!extensionAPI);
    
    if (!extensionAPI) {
        console.log("❌ Extension API not available");
        showStatus("Extension API not available", "#ffebee");
        return;
    }
    
    console.log("🎯 Setting status to 'Capturing recipe...'");
    showStatus("Capturing recipe...", "#f0f0f0");
    
    console.log("🎯 Calling extensionAPI.tabs.query...");
    extensionAPI.tabs.query({active: true, currentWindow: true}, async function(tabs) {
        console.log("🎯 tabs.query callback called, tabs:", tabs);
        if (!tabs || tabs.length === 0) {
            console.log("❌ No active tab found");
            showStatus("❌ No active tab found", "#ffebee");
            return;
        }
        
        const tab = tabs[0];
        console.log("🍳 Capturing recipe from:", tab.url);
        
        try {
            // Check if content script is already loaded before injecting
            console.log("🔍 Checking for existing content script...");
            
            // Try callback-based approach for better Safari compatibility
            extensionAPI.tabs.sendMessage(tab.id, {action: "ping"}, (pingResponse) => {
                console.log("🔧 Extension runtime error:", extensionAPI.runtime.lastError);
                console.log("🔧 Ping response received:", pingResponse);
                
                if (extensionAPI.runtime.lastError || !pingResponse) {
                    console.log("📥 Content script not loaded, injecting...", extensionAPI.runtime.lastError);
                    // Content script not loaded, inject it
                    if (extensionAPI.scripting && extensionAPI.scripting.executeScript) {
                        extensionAPI.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ["content.js"]
                        }).then(() => {
                            console.log("✅ Content script injected");
                            // Wait a moment for script to initialize
                            setTimeout(() => sendCaptureMessage(tab.id), 500);
                        }).catch(error => {
                            console.error("❌ Script injection failed:", error);
                            showStatus("❌ Failed to inject content script: " + error.message, "#ffebee");
                        });
                    } else {
                        showStatus("❌ Scripting API not available", "#ffebee");
                    }
                } else {
                    console.log("✅ Content script already loaded, ping response:", pingResponse);
                    sendCaptureMessage(tab.id);
                }
            });
            
        } catch (error) {
            console.error("❌ Script injection failed:", error);
            showStatus("❌ Failed to inject content script: " + error.message, "#ffebee");
        }
    });
}

function sendCaptureMessage(tabId) {
    // Send message to content script - using callback for Safari compatibility
    console.log("📤 Sending capture message to tab:", tabId);
    
    extensionAPI.tabs.sendMessage(tabId, {action: "captureRecipe"}, (response) => {
        console.log("🔧 Extension runtime error:", extensionAPI.runtime.lastError);
        console.log("📨 Response received:", response);
        
        if (extensionAPI.runtime.lastError) {
            console.error("❌ Message sending failed:", extensionAPI.runtime.lastError);
            showStatus("❌ Message failed: " + extensionAPI.runtime.lastError.message, "#ffebee");
            return;
        }
        
        if (response && response.status === "success") {
            console.log("✅ Recipe data received:", response);
            showStatus("✅ Recipe captured: " + response.data.title, "#e8f5e8");
            
            // Send to backend
            sendToBackend(response.data);
        } else {
            console.error("❌ Capture failed:", response);
            showStatus("❌ Capture failed: " + (response ? (response.message || "Invalid response") : "No response"), "#ffebee");
        }
    });
}

function showStatus(message, backgroundColor) {
    const statusDiv = document.getElementById("status");
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.style.background = backgroundColor;
        statusDiv.style.display = "block";
    }
}

async function sendToBackend(recipeData) {
    try {
        console.log("📤 Sending to backend:", recipeData);
        
        // Get current API configuration
        const apiConfig = CONFIG && CONFIG.getCurrentAPI ? CONFIG.getCurrentAPI() : {
            recipes: "http://localhost:8081/api/recipes"
        };
        
        const response = await fetch(apiConfig.recipes || "http://localhost:8081/api/recipes", {
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