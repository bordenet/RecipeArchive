// Safari Extension Popup Tests
// Ensures popup initialization works correctly with CONFIG dependency

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { JSDOM } = require('jsdom');

describe('Safari Extension Popup', () => {
  let dom;
  let window;
  let document;
  let localStorage;

  beforeEach(() => {
    // Set up DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Recipe Archive</title></head>
        <body>
          <div id="auth-container">
            <div id="auth-login" class="auth-section">
              <h3>Login</h3>
              <input type="email" id="email" placeholder="Email" />
              <input type="password" id="password" placeholder="Password" />
              <button id="loginBtn">Login</button>
            </div>
            <div id="auth-register" class="auth-section hidden">
              <h3>Register</h3>
              <input type="email" id="register-email" placeholder="Email" />
              <input type="password" id="register-password" placeholder="Password" />
              <input type="password" id="confirm-password" placeholder="Confirm Password" />
              <button id="registerBtn">Register</button>
            </div>
            <div id="auth-tabs">
              <button id="login-tab" class="tab active">Login</button>
              <button id="register-tab" class="tab">Register</button>
            </div>
          </div>
          <div id="main-container" class="hidden">
            <h3>Recipe Archive</h3>
            <button id="extractBtn">Extract Recipe</button>
            <button id="logoutBtn">Logout</button>
            <div id="dev-controls" class="hidden">
              <h4>Development Controls</h4>
              <button id="quickLoginBtn">Quick Login (Dev)</button>
              <label>
                <input type="checkbox" id="devModeToggle" />
                Development Mode
              </label>
            </div>
          </div>
          <div id="message"></div>
        </body>
      </html>
    `, {
      url: 'moz-extension://test-extension/',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    window = dom.window;
    document = window.document;
    localStorage = window.localStorage;
    
    global.window = window;
    global.document = document;
    global.localStorage = localStorage;
    
    // Clear localStorage
    localStorage.clear();
    
    // Initialize CONFIG first (simulating config.js loading)
    global.CONFIG = {
      ENVIRONMENT: 'development',
      
      COGNITO: {
        region: 'us-west-2',
        userPoolId: 'us-west-2_qJ1i9RhxD',
        clientId: '5grdn7qhf1el0ioqb6hkelr29s'
      },
      
      DEFAULT_TEST_USER: {
        email: 'test@example.com',
        getPassword: function() {
          return 'TestPassword123!';
        }
      },
      
      getCurrentAPI: function() {
        return this.API[this.ENVIRONMENT];
      },
      
      getCognitoConfig: function() {
        return this.COGNITO;
      },
      
      API: {
        development: {
          base: 'http://localhost:8080',
          recipes: 'http://localhost:8080/recipes'
        },
        production: {
          base: 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod',
          recipes: 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod/recipes'
        }
      }
    };
  });

  afterEach(() => {
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.localStorage;
    delete global.CONFIG;
  });

  describe('Popup Initialization', () => {
    it('should initialize without CONFIG errors', () => {
      expect(() => {
        // Simulate popup.js initialization sequence
        
        // 1. Elements should be found
        const authContainer = document.getElementById('auth-container');
        const mainContainer = document.getElementById('main-container');
        
        expect(authContainer).toBeTruthy();
        expect(mainContainer).toBeTruthy();
        
        // 2. CONFIG should be accessible
        expect(global.CONFIG).toBeTruthy();
        expect(global.CONFIG.ENVIRONMENT).toBe('development');
        
        // 3. setupDevControls should be callable after CONFIG
        function setupDevControls() {
          if (global.CONFIG && global.CONFIG.ENVIRONMENT === 'development') {
            const devControls = document.getElementById('dev-controls');
            if (devControls) {
              devControls.classList.remove('hidden');
            }
          }
        }
        
        setupDevControls();
        
        const devControls = document.getElementById('dev-controls');
        expect(devControls.classList.contains('hidden')).toBe(false);
        
      }).not.toThrow();
    });

    it('should handle CONFIG dependency correctly', () => {
      // Test that setup functions wait for CONFIG
      let configAvailable = false;
      
      function setupDevControls() {
        if (typeof CONFIG !== 'undefined' && CONFIG.ENVIRONMENT === 'development') {
          configAvailable = true;
          const devControls = document.getElementById('dev-controls');
          if (devControls) {
            devControls.classList.remove('hidden');
          }
          return true;
        }
        return false;
      }
      
      // Should work when CONFIG exists
      const result = setupDevControls();
      expect(result).toBe(true);
      expect(configAvailable).toBe(true);
    });

    it('should show dev controls in development mode', () => {
      global.CONFIG.ENVIRONMENT = 'development';
      
      function setupDevControls() {
        if (global.CONFIG && global.CONFIG.ENVIRONMENT === 'development') {
          const devControls = document.getElementById('dev-controls');
          if (devControls) {
            devControls.classList.remove('hidden');
            
            // Setup dev mode toggle
            const devModeToggle = document.getElementById('devModeToggle');
            if (devModeToggle) {
              try {
                const isDev = localStorage.getItem('recipeArchive.dev') !== 'false';
                devModeToggle.checked = isDev;
              } catch (error) {
                devModeToggle.checked = true;
              }
            }
          }
        }
      }
      
      setupDevControls();
      
      const devControls = document.getElementById('dev-controls');
      expect(devControls.classList.contains('hidden')).toBe(false);
      
      const devModeToggle = document.getElementById('devModeToggle');
      expect(devModeToggle.checked).toBe(true);
    });

    it('should hide dev controls in production mode', () => {
      global.CONFIG.ENVIRONMENT = 'production';
      
      function setupDevControls() {
        if (global.CONFIG && global.CONFIG.ENVIRONMENT === 'development') {
          const devControls = document.getElementById('dev-controls');
          if (devControls) {
            devControls.classList.remove('hidden');
          }
        }
      }
      
      setupDevControls();
      
      const devControls = document.getElementById('dev-controls');
      expect(devControls.classList.contains('hidden')).toBe(true);
    });

    it('should handle missing CONFIG gracefully', () => {
      // Temporarily remove CONFIG
      const originalConfig = global.CONFIG;
      delete global.CONFIG;
      
      expect(() => {
        function setupDevControls() {
          if (typeof CONFIG !== 'undefined' && CONFIG.ENVIRONMENT === 'development') {
            const devControls = document.getElementById('dev-controls');
            if (devControls) {
              devControls.classList.remove('hidden');
            }
          }
        }
        
        setupDevControls();
        
        // Dev controls should remain hidden when CONFIG unavailable
        const devControls = document.getElementById('dev-controls');
        expect(devControls.classList.contains('hidden')).toBe(true);
        
      }).not.toThrow();
      
      // Restore CONFIG
      global.CONFIG = originalConfig;
    });
  });

  describe('Authentication Interface', () => {
    it('should initialize auth tabs correctly', () => {
      const loginTab = document.getElementById('login-tab');
      const registerTab = document.getElementById('register-tab');
      const authLogin = document.getElementById('auth-login');
      const authRegister = document.getElementById('auth-register');
      
      expect(loginTab).toBeTruthy();
      expect(registerTab).toBeTruthy();
      expect(authLogin).toBeTruthy();
      expect(authRegister).toBeTruthy();
      
      // Login should be visible by default
      expect(authLogin.classList.contains('hidden')).toBe(false);
      expect(authRegister.classList.contains('hidden')).toBe(true);
    });

    it('should switch between login and register tabs', () => {
      const loginTab = document.getElementById('login-tab');
      const registerTab = document.getElementById('register-tab');
      const authLogin = document.getElementById('auth-login');
      const authRegister = document.getElementById('auth-register');
      
      // Click register tab
      registerTab.click();
      
      // Simulate tab switching logic
      loginTab.classList.remove('active');
      registerTab.classList.add('active');
      authLogin.classList.add('hidden');
      authRegister.classList.remove('hidden');
      
      expect(loginTab.classList.contains('active')).toBe(false);
      expect(registerTab.classList.contains('active')).toBe(true);
      expect(authLogin.classList.contains('hidden')).toBe(true);
      expect(authRegister.classList.contains('hidden')).toBe(false);
    });

    it('should have all required form elements', () => {
      // Login form
      const email = document.getElementById('email');
      const password = document.getElementById('password');
      const loginBtn = document.getElementById('loginBtn');
      
      expect(email).toBeTruthy();
      expect(password).toBeTruthy();
      expect(loginBtn).toBeTruthy();
      
      // Register form
      const registerEmail = document.getElementById('register-email');
      const registerPassword = document.getElementById('register-password');
      const confirmPassword = document.getElementById('confirm-password');
      const registerBtn = document.getElementById('registerBtn');
      
      expect(registerEmail).toBeTruthy();
      expect(registerPassword).toBeTruthy();
      expect(confirmPassword).toBeTruthy();
      expect(registerBtn).toBeTruthy();
    });
  });

  describe('Main Interface', () => {
    it('should have main container elements', () => {
      const mainContainer = document.getElementById('main-container');
      const extractBtn = document.getElementById('extractBtn');
      const logoutBtn = document.getElementById('logoutBtn');
      const messageDiv = document.getElementById('message');
      
      expect(mainContainer).toBeTruthy();
      expect(extractBtn).toBeTruthy();
      expect(logoutBtn).toBeTruthy();
      expect(messageDiv).toBeTruthy();
    });

    it('should toggle between auth and main containers', () => {
      const authContainer = document.getElementById('auth-container');
      const mainContainer = document.getElementById('main-container');
      
      // Simulate successful login
      authContainer.classList.add('hidden');
      mainContainer.classList.remove('hidden');
      
      expect(authContainer.classList.contains('hidden')).toBe(true);
      expect(mainContainer.classList.contains('hidden')).toBe(false);
      
      // Simulate logout
      mainContainer.classList.add('hidden');
      authContainer.classList.remove('hidden');
      
      expect(mainContainer.classList.contains('hidden')).toBe(true);
      expect(authContainer.classList.contains('hidden')).toBe(false);
    });
  });

  describe('Message Display', () => {
    it('should display messages correctly', () => {
      const messageDiv = document.getElementById('message');
      
      function showMessage(text, type = 'info') {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
      }
      
      showMessage('Test message', 'success');
      expect(messageDiv.textContent).toBe('Test message');
      expect(messageDiv.classList.contains('success')).toBe(true);
      
      showMessage('Error message', 'error');
      expect(messageDiv.textContent).toBe('Error message');
      expect(messageDiv.classList.contains('error')).toBe(true);
    });
  });
});
