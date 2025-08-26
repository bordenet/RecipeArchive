/* eslint-disable no-unused-vars */
/* global CONFIG, ChromeCognitoAuth, SafariCognitoAuth */

let cognitoAuth;
let currentEmail = '';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
  await initializeAuth();
  await checkAuthStatus();
  initializeEventHandlers();
});

async function initializeAuth() {
  // Make config available globally
  window.RecipeArchiveConfig = CONFIG;
  const config = window.RecipeArchiveConfig;
  
  // Check if we're in development mode and should skip Cognito
  if (config.ENVIRONMENT === 'development') {
    console.log('🔧 Development mode: Offering auth bypass option');
    
    // Add development bypass button
    const envToggle = document.getElementById('env-toggle');
    if (envToggle) {
      envToggle.style.display = 'block';
      envToggle.innerHTML += '<br><button id="dev-bypass" style="margin-top: 10px; background: #ff9800; color: white; border: none; padding: 8px 16px; border-radius: 4px;">Skip Auth (Dev Mode)</button>';
      
      document.getElementById('dev-bypass').addEventListener('click', () => {
        console.log('🔧 Bypassing authentication in development mode - going directly to popup');
        // Set a flag in localStorage to indicate dev bypass is active
        localStorage.setItem('recipeArchive.devBypass', 'true');
        // Skip the user dashboard and go directly to popup.html
        window.location.href = 'popup.html';
      });
    }
  }
  
  const cognitoConfig = config.getCognitoConfig();
  
  // Initialize appropriate auth class based on browser
  if (typeof chrome !== 'undefined' && chrome.storage) {
    cognitoAuth = new ChromeCognitoAuth(cognitoConfig);
  } else if (typeof browser !== 'undefined' && browser.storage) {
    cognitoAuth = new SafariCognitoAuth(cognitoConfig);
  } else {
    showMessage('Browser not supported', 'error');
    return;
  }

  // Show environment toggle in development
  if (config.ENVIRONMENT === 'development') {
    document.getElementById('env-toggle').style.display = 'block';
    document.getElementById('current-env').textContent = config.ENVIRONMENT;
  }
}

async function checkAuthStatus() {
  const result = await cognitoAuth.getCurrentUser();
  
  if (result.success) {
    showUserDashboard(result.data);
  } else {
    showForm('signin');
  }
  
  document.getElementById('loading').style.display = 'none';
}

function initializeEventHandlers() {
  // Form navigation handlers
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-show-form]')) {
      const formName = e.target.getAttribute('data-show-form');
      showForm(formName);
    }
    
    if (e.target.matches('[data-action="sign-out"]')) {
      signOut();
    }
    
    if (e.target.matches('[data-action="toggle-env"]')) {
      toggleEnvironment();
    }
    
    if (e.target.matches('[data-action="go-to-popup"]')) {
      window.location.href = 'popup.html';
    }
  });

  // Form submission handlers
  document.getElementById('signin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    
    setButtonLoading('signin', true);
    
    try {
      const result = await cognitoAuth.signIn(email, password);
      
      setButtonLoading('signin', false);
      
      if (result.success) {
        showMessage('Sign in successful!', 'success');
        showUserDashboard(result.data);
      } else {
        showMessage(`Sign in failed: ${result.error}`, 'error');
      }
    } catch (error) {
      setButtonLoading('signin', false);
      console.error('Sign in error:', error);
      showMessage(`Authentication error: ${error.message}. Try the development bypass button if available.`, 'error');
    }
  });

  document.getElementById('signup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const name = document.getElementById('signup-name').value;
    
    setButtonLoading('signup', true);
    
    const attributes = {};
    if (name) {
      const nameParts = name.split(' ');
      attributes.given_name = nameParts[0];
      if (nameParts.length > 1) {
        attributes.family_name = nameParts.slice(1).join(' ');
      }
    }
    
    const result = await cognitoAuth.signUp(email, password, attributes);
    
    setButtonLoading('signup', false);
    
    if (result.success) {
      currentEmail = email;
      document.getElementById('confirm-email').value = email;
      showMessage('Account created! Please check your email for verification.', 'success');
      showForm('confirm');
    } else {
      showMessage(result.error, 'error');
    }
  });

  document.getElementById('confirm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('confirm-email').value;
    const code = document.getElementById('confirm-code').value;
    
    setButtonLoading('confirm', true);
    
    const result = await cognitoAuth.confirmSignUp(email, code);
    
    setButtonLoading('confirm', false);
    
    if (result.success) {
      showMessage('Email verified! You can now sign in.', 'success');
      document.getElementById('signin-email').value = email;
      showForm('signin');
    } else {
      showMessage(result.error, 'error');
    }
  });
}

function showForm(formName) {
  // Hide all forms
  document.querySelectorAll('.auth-form').forEach(form => {
    form.classList.remove('active');
  });
  
  // Show selected form
  document.getElementById(`${formName}-form`).classList.add('active');
  
  // Clear any previous messages
  clearMessages();
}

function showUserDashboard(user) {
  const userInfo = document.getElementById('user-info');
  userInfo.innerHTML = `
    <h3>${user.name || user.email}</h3>
    <p><strong>Email:</strong> ${user.email}</p>
    <p><strong>Status:</strong> ${user.emailVerified ? '✅ Verified' : '⚠️ Unverified'}</p>
    <p><strong>User ID:</strong> ${user.id.substring(0, 8)}...</p>
  `;
  showForm('user-dashboard');
}

async function signOut() {
  const result = await cognitoAuth.signOut();
  if (result.success) {
    showMessage('Signed out successfully', 'success');
    showForm('signin');
  }
}

function setButtonLoading(formName, loading) {
  const form = document.getElementById(formName);
  const button = form.querySelector('button[type="submit"]');
  button.disabled = loading;
  button.textContent = loading ? 'Loading...' : button.textContent;
}

function showMessage(message, type) {
  const container = document.getElementById('message-container');
  const messageDiv = document.createElement('div');
  messageDiv.className = `${type}-message`;
  messageDiv.textContent = message;
  container.appendChild(messageDiv);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    messageDiv.remove();
  }, 5000);
}

function clearMessages() {
  document.getElementById('message-container').innerHTML = '';
}

function toggleEnvironment() {
  const config = window.RecipeArchiveConfig;
  const newEnv = config.toggleEnvironment();
  document.getElementById('current-env').textContent = newEnv;
  showMessage(`Switched to ${newEnv} environment`, 'info');
}
