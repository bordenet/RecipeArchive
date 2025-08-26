// Safari Web Extension Setup Script
// Compatible with both Safari desktop and mobile browsers

// Cross-browser compatibility - only declare if not already defined
if (typeof browserAPI === 'undefined') {
  var browserAPI = typeof browser !== 'undefined' ? browser : chrome;
}

document.addEventListener('DOMContentLoaded', async function () {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const saveButton = document.getElementById('saveAuth');
  const statusDiv = document.getElementById('status');
  const backLink = document.getElementById('backToMain');

  // Load existing credentials if any
  try {
    const stored = await browserAPI.storage.local.get(['username', 'password']);
    if (stored.username) usernameInput.value = stored.username;
    if (stored.password) passwordInput.value = stored.password;
  } catch (error) {
    console.error(
      'Safari Extension - Error loading stored credentials:',
      error
    );
  }

  // Enhanced mobile Safari support - prevent zoom on focus
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    const inputs = document.querySelectorAll('input');
    inputs.forEach((input) => {
      input.addEventListener('blur', function () {
        document
          .querySelector('meta[name="viewport"]')
          .setAttribute('content', 'width=device-width, initial-scale=1.0');
      });
      input.addEventListener('focus', function () {
        document
          .querySelector('meta[name="viewport"]')
          .setAttribute(
            'content',
            'width=device-width, initial-scale=1.0, maximum-scale=1.0'
          );
      });
    });
  }

  // Save credentials
  saveButton.addEventListener('click', async function () {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      showStatus('Please enter both username and password', 'error');
      return;
    }

    try {
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';

      // Test the credentials
      const isValid = await testCredentials(username, password);

      if (isValid) {
        // Save to browser storage
        await browserAPI.storage.local.set({
          username: username,
          password: password,
          authConfigured: true,
        });

        showStatus('Credentials saved successfully!', 'success');
        setTimeout(() => {
          window.location.href = 'popup.html';
        }, 1500);
      } else {
        showStatus('Invalid credentials. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Safari Extension - Error saving credentials:', error);
      showStatus('Error saving credentials: ' + error.message, 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save Credentials';
    }
  });

  // Enter key support for better UX
  [usernameInput, passwordInput].forEach((input) => {
    input.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        saveButton.click();
      }
    });
  });

  // Back to main
  backLink.addEventListener('click', function (e) {
    e.preventDefault();
    window.location.href = 'popup.html';
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
  }

  async function testCredentials(username, password) {
    // For development, use environment-based credentials or Cognito
    // Load from environment variables if available
    const expectedUser = process.env.COGNITO_TEST_USER || 'test@example.com';
    const expectedPass = process.env.COGNITO_TEST_PASS || 'defaultpass';
    
    console.log('Safari Extension - Testing credentials:', { username, environment: 'development' });
    
    if (username === expectedUser && password === expectedPass) {
      console.log('Safari Extension - Credentials valid for development mode');
      return true;
    }
    
    console.log('Safari Extension - Invalid credentials for development mode');
    return false;
  }
});

// Auth utility functions for other scripts - Safari compatible
window.AuthUtils = {
  async getStoredCredentials() {
    try {
      const stored = await browserAPI.storage.local.get([
        'username',
        'password',
        'authConfigured',
      ]);
      return {
        username: stored.username || null,
        password: stored.password || null,
        isConfigured: !!stored.authConfigured,
      };
    } catch (error) {
      console.error(
        'Safari Extension - Error getting stored credentials:',
        error
      );
      return { username: null, password: null, isConfigured: false };
    }
  },

  async clearCredentials() {
    try {
      await browserAPI.storage.local.remove([
        'username',
        'password',
        'authConfigured',
      ]);
      return true;
    } catch (error) {
      console.error('Safari Extension - Error clearing credentials:', error);
      return false;
    }
  },

  createBasicAuthHeader(username, password) {
    const credentials = btoa(username + ':' + password);
    return 'Basic ' + credentials;
  },
};
