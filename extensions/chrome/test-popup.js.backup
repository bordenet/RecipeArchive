// Test popup script for Chrome extension verification
console.log('🎯 RecipeArchive popup script loading...');

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ RecipeArchive popup DOM ready');
    
    // Test basic functionality
    testBasicFunctionality();
    
    // Add test button for debugging
    addTestButton();
});

function testBasicFunctionality() {
    try {
        // Test Chrome extension API access
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            console.log('✅ Chrome extension API available');
        } else {
            console.error('❌ Chrome extension API not available');
            return;
        }
        
        // Test config loading
        if (typeof CONFIG !== 'undefined') {
            console.log('✅ CONFIG loaded:', CONFIG.ENVIRONMENT);
        } else {
            console.error('❌ CONFIG not loaded');
        }
        
        // Test current tab access
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs && tabs.length > 0) {
                console.log('✅ Current tab accessible:', tabs[0].url);
                
                // Test message sending to content script
                chrome.tabs.sendMessage(tabs[0].id, {action: 'ping'}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.log('⚠️ Content script communication error:', chrome.runtime.lastError.message);
                    } else {
                        console.log('✅ Content script responded:', response);
                    }
                });
            } else {
                console.error('❌ No active tab found');
            }
        });
        
    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

function addTestButton() {
    // Add a test button to the popup for manual testing
    const testButton = document.createElement('button');
    testButton.textContent = 'Test Extension';
    testButton.style.cssText = `
        width: 100%;
        padding: 10px;
        margin: 10px 0;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
    
    testButton.onclick = function testButtonClick() {
        console.log('🧪 Manual test button clicked');
        testRecipeCapture();
    };
    
    // Insert at the top of the popup
    const body = document.body;
    if (body.firstChild) {
        body.insertBefore(testButton, body.firstChild);
    } else {
        body.appendChild(testButton);
    }
}

function testRecipeCapture() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs.length > 0) {
            const tab = tabs[0];
            console.log('🍳 Testing recipe capture on:', tab.url);
            
            // Send capture message to content script
            // FIXED: Check if content script exists first
                if (chrome.runtime.lastError) {
                    console.error('❌ Recipe capture error:', chrome.runtime.lastError.message);
                } else {
                    console.log('✅ Recipe captured:', response);
                    
                    // Show results in popup
                    showResults(response);
                    
                    // Send to backend if capture was successful
                    if (response && response.status === 'success' && response.data) {
                        sendToBackend(response.data);
                    }
                }
            });
        }
    });
}

function showResults(response) {
    // Create results display
    const resultsDiv = document.createElement('div');
    resultsDiv.style.cssText = `
        background: #f5f5f5;
        padding: 10px;
        margin: 10px 0;
        border-radius: 4px;
        font-size: 12px;
    `;
    
    if (response && response.status === 'success') {
        resultsDiv.innerHTML = `
            <strong>✅ Recipe Captured!</strong><br>
            Title: ${response.data.title}<br>
            Ingredients: ${response.data.ingredients.length}<br>
            Steps: ${response.data.steps.length}<br>
            Source: ${response.data.source}
        `;
        resultsDiv.style.background = '#e8f5e8';
    } else {
        resultsDiv.innerHTML = `
            <strong>❌ Capture Failed</strong><br>
            ${JSON.stringify(response, null, 2)}
        `;
        resultsDiv.style.background = '#ffeaea';
    }
    
    document.body.appendChild(resultsDiv);
}

async function sendToBackend(recipeData) {
    try {
        console.log('📤 Sending recipe to backend...', recipeData);
        
        // Get API endpoint from config
        const apiEndpoint = CONFIG.API_ENDPOINT || 'http://localhost:8080';
        const url = `${apiEndpoint}/api/recipes`;
        
        // Prepare recipe data for backend
        const backendData = {
            title: recipeData.title || 'Untitled Recipe',
            description: `Captured from ${recipeData.url || 'web page'}`,
            ingredients: recipeData.ingredients || [],
            instructions: recipeData.steps || [],
            tags: ['chrome-extension', 'captured'],
            source: 'chrome-extension',
            capturedAt: new Date().toISOString()
        };
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer dev-mock-token',
                'X-Recipe-Source': 'chrome-extension',
                'X-Recipe-Version': '1.0'
            },
            body: JSON.stringify(backendData)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Recipe saved to backend:', result);
            
            // Update UI to show backend success
            const successDiv = document.createElement('div');
            successDiv.innerHTML = '✅ Saved to backend!';
            successDiv.style.cssText = `
                background: #d4edda;
                color: #155724;
                padding: 5px 10px;
                margin: 5px 0;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
            `;
            document.body.appendChild(successDiv);
            
        } else {
            throw new Error(`Backend responded with ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('❌ Failed to send recipe to backend:', error);
        
        // Update UI to show backend error
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `❌ Backend error: ${error.message}`;
        errorDiv.style.cssText = `
            background: #f8d7da;
            color: #721c24;
            padding: 5px 10px;
            margin: 5px 0;
            border-radius: 4px;
            font-size: 12px;
        `;
        document.body.appendChild(errorDiv);
    }
}

console.log('🎯 Test popup script loaded');
