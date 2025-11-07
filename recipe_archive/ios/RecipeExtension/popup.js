// Popup script - handles user interaction and sends data to native app

const saveBtn = document.getElementById("saveBtn");
const statusDiv = document.getElementById("status");

// Show status message
function showStatus(message, type = "info") {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
}

// Save recipe to native app
async function saveRecipe() {
  try {
    saveBtn.disabled = true;
    saveBtn.innerHTML = "Extracting...<span class=\"spinner\"></span>";
    showStatus("Extracting recipe from page...", "info");

    // Get active tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error("No active tab found");
    }

    const tab = tabs[0];

    // Send message to content script to extract HTML
    const response = await browser.tabs.sendMessage(tab.id, { action: "extractHTML" });

    if (!response.success) {
      throw new Error(response.error || "Failed to extract HTML");
    }

    console.log("HTML extracted successfully, size:", response.data.html.length);

    // Save to App Group storage for native app
    await saveToAppGroup(response.data);

    // Notify native app via custom URL scheme
    await notifyNativeApp(response.data);

    showStatus("✓ Recipe saved! Open RecipeArchive app to view.", "success");
    saveBtn.innerHTML = "✓ Saved!";

    // Close popup after 2 seconds
    setTimeout(() => {
      window.close();
    }, 2000);

  } catch (error) {
    console.error("Error saving recipe:", error);
    showStatus(`Error: ${error.message}`, "error");
    saveBtn.disabled = false;
    saveBtn.innerHTML = "Save to RecipeArchive";
  }
}

// Save data to App Group storage (shared with native app)
async function saveToAppGroup(data) {
  // Use browser.storage.local as bridge
  // Native code will read this via NSUserDefaults App Group
  await browser.storage.local.set({
    "recipeData": {
      url: data.url,
      title: data.title,
      html: data.html,
      recipeSchema: data.recipeSchema,
      timestamp: data.timestamp
    }
  });

  console.log("Saved to browser storage");
}

// Notify native app via custom URL scheme
async function notifyNativeApp(data) {
  try {
    // Create custom URL with encoded data
    const params = new URLSearchParams({
      action: "newRecipe",
      timestamp: data.timestamp.toString()
    });

    const url = `recipearchive://recipe?${params.toString()}`;

    // Open URL to trigger native app
    // Safari will handle this and launch the app
    await browser.tabs.create({ url: url });

    console.log("Notified native app");
  } catch (error) {
    console.warn("Could not notify native app:", error);
    // Non-fatal - native app will poll storage
  }
}

// Event listeners
saveBtn.addEventListener("click", saveRecipe);

// Show initial URL
browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
  if (tabs && tabs.length > 0) {
    const url = new URL(tabs[0].url);
    showStatus(`Ready to save from ${url.hostname}`, "info");
  }
});
