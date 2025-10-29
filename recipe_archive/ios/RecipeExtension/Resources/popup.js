// Popup script - handles user interaction and sends data to native app

const saveBtn = document.getElementById('saveBtn');
const statusDiv = document.getElementById('status');

// Show status message
function showStatus(message, type = 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
}

// Save recipe to native app
async function saveRecipe() {
  try {
    saveBtn.disabled = true;
    saveBtn.innerHTML = 'Extracting...<span class="spinner"></span>';
    showStatus('Extracting recipe from page...', 'info');

    // Get active tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }

    const tab = tabs[0];

    // Send message to content script to extract HTML
    const response = await browser.tabs.sendMessage(tab.id, { action: 'extractHTML' });

    if (!response.success) {
      throw new Error(response.error || 'Failed to extract HTML');
    }

    console.log('HTML extracted successfully, size:', response.data.html.length);

    // Save to App Group storage for native app
    await saveToAppGroup(response.data);

    // Notify native app via custom URL scheme
    await notifyNativeApp(response.data);

    showStatus('✓ Recipe saved! Open RecipeArchive app to view.', 'success');
    saveBtn.innerHTML = '✓ Saved!';

    // Close popup after 2 seconds
    setTimeout(() => {
      window.close();
    }, 2000);

  } catch (error) {
    console.error('Error saving recipe:', error);
    showStatus(`Error: ${error.message}`, 'error');
    saveBtn.disabled = false;
    saveBtn.innerHTML = 'Save to RecipeArchive';
  }
}

// Save data to App Group storage (shared with native app)
async function saveToAppGroup(data) {
  // Send message to background script, which forwards to native handler
  const response = await browser.runtime.sendMessage({
    action: 'saveToNative',
    data: {
      url: data.url,
      title: data.title,
      html: data.html,
      recipeSchema: data.recipeSchema
    }
  });

  if (!response || !response.success) {
    throw new Error(response?.error || 'Failed to save to native app');
  }

  console.log('Saved to App Group via native handler');
}

// Notify native app via custom URL scheme
async function notifyNativeApp(data) {
  // Native handler already posted CFNotification, so this is redundant
  // But we'll keep it as a backup mechanism
  try {
    // Create custom URL with encoded data
    const params = new URLSearchParams({
      action: 'newRecipe',
      timestamp: data.timestamp.toString()
    });

    const url = `recipearchive://recipe?${params.toString()}`;

    // Note: This may open a new tab in Safari, which is not ideal
    // The CFNotification from native handler is the primary mechanism
    console.log('URL scheme available if needed:', url);
  } catch (error) {
    console.warn('Could not create URL scheme:', error);
  }
}

// Event listeners
saveBtn.addEventListener('click', saveRecipe);

// Show initial URL
browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
  if (tabs && tabs.length > 0) {
    const url = new URL(tabs[0].url);
    showStatus(`Ready to save from ${url.hostname}`, 'info');
  }
});
