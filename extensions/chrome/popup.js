// RecipeArchive popup with full backend integration
console.log("RecipeArchive popup loading");

// State management
let isSignedIn = false;
let currentUser = null;

document.addEventListener("DOMContentLoaded", function() {
    const container = document.createElement("div");
    container.style.cssText = "padding: 20px; min-width: 320px; font-family: Arial, sans-serif;";
    container.id = "main-container";
    
    document.body.appendChild(container);
    
    // Check authentication status on load
    checkAuthenticationStatus();
});

function checkAuthenticationStatus() {
    // Check if user is signed in (from storage or session)
    // For now, simulate checking - replace with real AWS Cognito check
    const storedAuth = localStorage.getItem('recipeArchive.auth');
    if (storedAuth) {
        try {
            currentUser = JSON.parse(storedAuth);
            isSignedIn = true;
        } catch(e) {
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
                <h1 style="margin: 0 0 20px 0; font-size: 18px; color: #333;">RecipeArchive</h1>
                <a href="#" id="signout-link" style="position: absolute; top: 0; right: 0; font-size: 11px; color: #666; text-decoration: none;">sign out</a>
            </div>
            <div style="margin-bottom: 15px; padding: 10px; background: #e8f5e8; border-radius: 4px; font-size: 12px;">
                ✅ Signed in as ${currentUser ? currentUser.email : 'user'}
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
            
            <div id="status" style="margin-top: 15px; padding: 10px; border-radius: 4px; font-size: 12px; display: none;"></div>
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
            localStorage.setItem('recipeArchive.auth', JSON.stringify(currentUser));
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
    localStorage.removeItem('recipeArchive.auth');
    renderUI();
}

function captureRecipe() {
    showStatus("Capturing recipe...", "#f0f0f0");
    
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
        if (!tabs || tabs.length === 0) {
            showStatus("❌ No active tab found", "#ffebee");
            return;
        }
        
        const tab = tabs[0];
        console.log("🍳 Capturing recipe from:", tab.url);
        
        try {
            // Inject content script using Manifest V3 scripting API
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["content.js"]
            });
            
            console.log("✅ Content script injected");
            
            // Now try to send message
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
            
        } catch (error) {
            console.error("❌ Script injection failed:", error);
            showStatus("❌ Failed to inject content script: " + error.message, "#ffebee");
        }
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