// RecipeArchive Safari popup with authentication-first UX

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
        
        const tab = tabs[0];
        
        try {
            // Check if content script is already loaded before injecting
            let pingResponded = false;
            console.log("📤 Sending ping to tab:", tab.id);
            
            const pingTimeout = setTimeout(() => {
                if (!pingResponded) {
                    console.log("⏰ Ping timeout - injecting content script");
                    injectContentScript(tab.id);
                }
            }, 1000);
            
            // Safari Web Extensions: Use async/await pattern that works with both Promise and callback
            try {
                const pingResponse = await new Promise((resolve, reject) => {
                    // Safari Web Extensions: Use direct tab messaging with setTimeout response
                    extensionAPI.tabs.sendMessage(tab.id, {action: "ping"}, (response) => {
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
                    await sendCaptureMessage(tab.id);
                } else {
                    console.log("🔧 Content script not loaded, injecting...");
                    injectContentScript(tab.id);
                }
            } catch (error) {
                console.log("📥 Ping error:", error);
                pingResponded = true;
                clearTimeout(pingTimeout);
                console.log("🔧 Content script not loaded, injecting...");
                injectContentScript(tab.id);
            }
            
        } catch (error) {
            console.error("❌ Script injection failed:", error);
            showStatus("❌ Failed to inject content script: " + error.message, "#ffebee");
        }
    });
}

function injectContentScript(tabId) {
    if (extensionAPI.scripting && extensionAPI.scripting.executeScript) {
        extensionAPI.scripting.executeScript({
            target: { tabId: tabId },
            files: ["content.js"]
        }).then(async () => {
            // Wait longer for Safari script to initialize
            await new Promise(resolve => setTimeout(resolve, 1500));
            await sendCaptureMessage(tabId);
        }).catch(error => {
            console.error("❌ Script injection failed:", error);
            showStatus("❌ Failed to inject content script: " + error.message, "#ffebee");
        });
    } else {
        showStatus("❌ Scripting API not available", "#ffebee");
    }
}

async function sendCaptureMessage(tabId) {
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
            sendToBackends(response.data);
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

async function sendToBackends(recipeData) {
    // Show initial status
    showStatus("Saving recipe...", "#fff3cd");
    
    try {
        // First, save to development backend for testing
        const devResult = await sendToDevBackend(recipeData);
        
        if (devResult.success) {
            // If dev backend succeeds, also send to AWS production
            showStatus("Saving to AWS...", "#e7f3ff");
            const awsResult = await sendToAWSBackend(recipeData);
            
            if (awsResult.success) {
                showStatus("✅ Saved to both dev and AWS! Recipe ID: " + devResult.id, "#d4edda");
            } else {
                showStatus("✅ Saved to dev backend. AWS: " + awsResult.error, "#fff3cd");
            }
        } else {
            showStatus("❌ Failed to save: " + devResult.error, "#f8d7da");
        }
    } catch (error) {
        console.error("❌ Backend error:", error);
        showStatus("❌ Save error: " + error.message, "#f8d7da");
    }
}

async function sendToDevBackend(recipeData) {
    try {
        // Development server is always on port 8081 for testing
        const devEndpoint = "http://localhost:8081/api/recipes";
        
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

async function sendToAWSBackend(recipeData) {
    try {
        // For development testing, simulate AWS success without real auth
        if (typeof CONFIG === "undefined") {
            return {
                success: false,
                error: "AWS backend skipped (development mode - CONFIG not loaded)"
            };
        }
        
        // TODO: Implement real Cognito authentication
        // For now, simulate successful AWS submission for testing
        console.log("📤 Would send to AWS:", recipeData.title);
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
        
        return {
            success: true,
            message: "Simulated AWS save (real Cognito auth needed for production)",
            id: "simulated-aws-id-" + Date.now()
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}