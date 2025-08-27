document.addEventListener("DOMContentLoaded", async () => {
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const saveButton = document.getElementById("saveAuth");
  const statusDiv = document.getElementById("status");
  const backLink = document.getElementById("backToMain");

  // Load existing credentials if any
  try {
    const stored = await chrome.storage.local.get(["username", "password"]);
    if (stored.username) {usernameInput.value = stored.username;}
    if (stored.password) {passwordInput.value = stored.password;}
  } catch (error) {
    console.error("Error loading stored credentials:", error);
  }

  // Save credentials
  saveButton.addEventListener("click", async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      showStatus("Please enter both username and password", "error");
      return;
    }

    try {
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";

      // Test the credentials
      const isValid = await testCredentials(username, password);

      if (isValid) {
        // Store basic flag for development compatibility
        await chrome.storage.local.set({
          authConfigured: true,
          username: username,
          timestamp: Date.now()
        });

        showStatus("Cognito authentication successful!", "success");
        setTimeout(() => {
          window.location.href = "popup.html";
        }, 1500);
      } else {
        showStatus("Invalid credentials. Please try again.", "error");
      }
    } catch (error) {
      console.error("Error saving credentials:", error);
      showStatus(`Error saving credentials: ${ error.message}`, "error");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save Credentials";
    }
  });

  // Back to main
  backLink.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "popup.html";
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
  }

  async function testCredentials(username, password) {
    try {
      // Use Cognito authentication for validation
      const config = CONFIG.getCognitoConfig();
      const cognitoAuth = new ChromeCognitoAuth(config);
      const result = await cognitoAuth.signIn(username, password);

      if (result.success) {
        console.log("Cognito authentication successful");
        return true;
      }
        console.error("Cognito authentication failed:", result.error);
        return false;

    } catch (error) {
      console.error("Authentication error:", error);
      return false;
    }
  }
});

// Auth utility functions for other scripts
window.AuthUtils = {
  async getStoredCredentials() {
    try {
      const stored = await chrome.storage.local.get([
        "username",
        "password",
        "authConfigured",
      ]);
      return {
        username: stored.username || null,
        password: stored.password || null,
        isConfigured: Boolean(stored.authConfigured),
      };
    } catch (error) {
      console.error("Error getting stored credentials:", error);
      return { username: null, password: null, isConfigured: false };
    }
  },

  async clearCredentials() {
    try {
      await chrome.storage.local.remove([
        "username",
        "password",
        "authConfigured",
      ]);
      return true;
    } catch (error) {
      console.error("Error clearing credentials:", error);
      return false;
    }
  },

  createBasicAuthHeader(username, password) {
    const credentials = btoa(`${username }:${ password}`);
    return `Basic ${ credentials}`;
  },
};
