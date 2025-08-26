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
