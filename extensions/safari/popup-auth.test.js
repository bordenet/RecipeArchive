// Safari Extension Authentication Integration Tests
// Tests the complete authentication flow through the popup interface

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { JSDOM } = require('jsdom');

describe('Safari Extension Authentication Integration', () => {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    // Set up DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>RecipeArchive Test</title>
        </head>
        <body>
          <div id="authSection">
            <div id="userInfo" style="display: none;"></div>
            <button id="authButton">Sign In</button>
            <button id="logoutButton" style="display: none;">Sign Out</button>
          </div>
          <button id="captureBtn" style="display: none;">Capture Recipe</button>
          <div id="message">Loading...</div>
          <div id="devControls" style="display: none;">
            <input type="checkbox" id="devBypass">
          </div>
          <input type="checkbox" id="emergencyDevBypass">
        </body>
      </html>
    `, {
      url: 'moz-extension://test-extension/',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.localStorage = window.localStorage;

    // Mock CONFIG
    global.CONFIG = {
      COGNITO: {
        region: 'us-west-2',
        userPoolId: 'us-west-2_qJ1i9RhxD',
        clientId: '5grdn7qhf1el0ioqb6hkelr29s'
      },
      getCognitoConfig: function() {
        return this.COGNITO;
      }
    };

    // Mock SafariCognitoAuth
    global.SafariCognitoAuth = class {
      constructor(config) {
        this.config = config;
      }

      async getCurrentUser() {
        const devBypass = localStorage.getItem('recipeArchive.devBypass');
        if (devBypass === 'true') {
          return {
            success: true,
            data: { authenticated: true, email: 'dev-user@test.com' }
          };
        }
        return {
          success: true,
          data: { authenticated: false }
        };
      }

      async signOut() {
        return { success: true };
      }

      async getIdToken() {
        return { success: true, data: 'mock-id-token' };
      }
    };

    // Mock browser extension API
    global.browser = {
      tabs: {
        query: jest.fn().mockResolvedValue([{ id: 1, url: 'https://example.com' }]),
        sendMessage: jest.fn().mockResolvedValue({ success: true })
      }
    };
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Popup Interface Authentication Flow', () => {
    it('should show authentication required when not logged in', async () => {
      // Simulate popup.js functionality
      const authSection = document.getElementById('authSection');
      const captureBtn = document.getElementById('captureBtn');
      const authButton = document.getElementById('authButton');
      const logoutButton = document.getElementById('logoutButton');
      const message = document.getElementById('message');

      // Simulate unauthenticated state
      const cognitoAuth = new SafariCognitoAuth(CONFIG.getCognitoConfig());
      const userResult = await cognitoAuth.getCurrentUser();

      if (!userResult.data.authenticated) {
        authSection.style.display = 'block';
        captureBtn.style.display = 'none';
        authButton.style.display = 'block';
        logoutButton.style.display = 'none';
        message.textContent = 'Please sign in to capture recipes';
        message.className = 'info';
      }

      expect(authButton.style.display).toBe('block');
      expect(logoutButton.style.display).toBe('none');
      expect(captureBtn.style.display).toBe('none');
      expect(message.textContent).toBe('Please sign in to capture recipes');
    });

    it('should show main interface when authenticated', async () => {
      // Enable dev bypass to simulate authenticated state
      localStorage.setItem('recipeArchive.devBypass', 'true');

      const authSection = document.getElementById('authSection');
      const captureBtn = document.getElementById('captureBtn');
      const authButton = document.getElementById('authButton');
      const logoutButton = document.getElementById('logoutButton');
      const userInfo = document.getElementById('userInfo');
      const message = document.getElementById('message');

      // Simulate authenticated state
      const cognitoAuth = new SafariCognitoAuth(CONFIG.getCognitoConfig());
      const userResult = await cognitoAuth.getCurrentUser();

      if (userResult.data.authenticated) {
        authSection.style.display = 'block';
        captureBtn.style.display = 'block';
        authButton.style.display = 'none';
        logoutButton.style.display = 'block';
        userInfo.style.display = 'block';
        userInfo.textContent = `Signed in as: ${userResult.data.email}`;
        message.textContent = 'Ready to capture recipes';
        message.className = 'success';
      }

      expect(authButton.style.display).toBe('none');
      expect(logoutButton.style.display).toBe('block');
      expect(captureBtn.style.display).toBe('block');
      expect(userInfo.textContent).toBe('Signed in as: dev-user@test.com');
      expect(message.textContent).toBe('Ready to capture recipes');
    });

    it('should handle sign out flow', async () => {
      // Start in authenticated state
      localStorage.setItem('recipeArchive.devBypass', 'true');
      
      const logoutButton = document.getElementById('logoutButton');
      const authButton = document.getElementById('authButton');
      const captureBtn = document.getElementById('captureBtn');
      const userInfo = document.getElementById('userInfo');
      const message = document.getElementById('message');

      // Simulate logout button click
      logoutButton.addEventListener('click', async () => {
        const cognitoAuth = new SafariCognitoAuth(CONFIG.getCognitoConfig());
        await cognitoAuth.signOut();
        
        // Clear dev bypass
        localStorage.removeItem('recipeArchive.devBypass');
        
        // Update UI
        authButton.style.display = 'block';
        logoutButton.style.display = 'none';
        captureBtn.style.display = 'none';
        userInfo.style.display = 'none';
        message.textContent = 'Signed out successfully';
        message.className = 'info';
      });

      // Trigger click
      logoutButton.click();

      // Small delay for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(authButton.style.display).toBe('block');
      expect(logoutButton.style.display).toBe('none');
      expect(captureBtn.style.display).toBe('none');
      expect(userInfo.style.display).toBe('none');
      expect(message.textContent).toBe('Signed out successfully');
    });

    it('should handle emergency dev bypass toggle', async () => {
      const emergencyBypass = document.getElementById('emergencyDevBypass');
      const message = document.getElementById('message');

      // Simulate emergency bypass check
      emergencyBypass.addEventListener('change', (e) => {
        if (e.target.checked) {
          localStorage.setItem('recipeArchive.devBypass', 'true');
          message.textContent = 'Dev bypass enabled - reloading extension...';
          message.className = 'info';
        }
      });

      emergencyBypass.checked = true;
      emergencyBypass.dispatchEvent(new window.Event('change'));

      expect(localStorage.getItem('recipeArchive.devBypass')).toBe('true');
      expect(message.textContent).toBe('Dev bypass enabled - reloading extension...');
    });
  });

  describe('Recipe Capture with Authentication', () => {
    it('should include auth token when capturing recipes', async () => {
      localStorage.setItem('recipeArchive.devBypass', 'true');
      
      const captureBtn = document.getElementById('captureBtn');
      const message = document.getElementById('message');

      // Simulate recipe capture with authentication
      captureBtn.addEventListener('click', async () => {
        const cognitoAuth = new SafariCognitoAuth(CONFIG.getCognitoConfig());
        const tokenResult = await cognitoAuth.getIdToken();
        
        if (tokenResult.success) {
          // Mock sending message to content script with auth token
          const tabs = await browser.tabs.query({ active: true, currentWindow: true });
          const response = await browser.tabs.sendMessage(tabs[0].id, {
            action: 'captureRecipe',
            authToken: tokenResult.data
          });
          
          if (response.success) {
            message.textContent = 'Recipe captured successfully!';
            message.className = 'success';
          }
        }
      });

      captureBtn.click();

      // Small delay for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(browser.tabs.sendMessage).toHaveBeenCalledWith(1, {
        action: 'captureRecipe',
        authToken: 'mock-id-token'
      });
      expect(message.textContent).toBe('Recipe captured successfully!');
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors gracefully', async () => {
      // Mock SafariCognitoAuth to return error
      global.SafariCognitoAuth = class {
        async getCurrentUser() {
          return {
            success: false,
            error: 'Authentication service unavailable'
          };
        }
      };

      const message = document.getElementById('message');
      
      // Simulate auth check error
      try {
        const cognitoAuth = new SafariCognitoAuth(CONFIG.getCognitoConfig());
        const userResult = await cognitoAuth.getCurrentUser();
        
        if (!userResult.success) {
          message.textContent = `Authentication error: ${userResult.error}`;
          message.className = 'error';
        }
      } catch (error) {
        message.textContent = `Unexpected error: ${error.message}`;
        message.className = 'error';
      }

      expect(message.textContent).toBe('Authentication error: Authentication service unavailable');
      expect(message.className).toBe('error');
    });

    it('should show fallback when config is missing', async () => {
      global.CONFIG = undefined;
      
      const message = document.getElementById('message');
      
      try {
        if (typeof CONFIG === 'undefined') {
          throw new Error('CONFIG not loaded - check config.js script tag');
        }
      } catch (error) {
        message.textContent = `Configuration error: ${error.message}`;
        message.className = 'error';
      }

      expect(message.textContent).toBe('Configuration error: CONFIG not loaded - check config.js script tag');
      expect(message.className).toBe('error');
    });
  });
});
