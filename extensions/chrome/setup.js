// Setup script for RecipeArchive Chrome Extension
// This script configures the extension with the correct AWS credentials

document.addEventListener('DOMContentLoaded', function() {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const saveButton = document.getElementById('saveAuth');
  const statusDiv = document.getElementById('status');
  const backLink = document.getElementById('backToMain');

  // Pre-fill with configuration values
  usernameInput.value = 'mattbordenet@hotmail.com';
  passwordInput.value = 'Recipe123';

  // Auto-configure AWS settings on page load
  configureAWSSettings();

  saveButton.addEventListener('click', async function() {
    const username = usernameInput.value;
    const password = passwordInput.value;

    if (!username || !password) {
      showStatus('Please fill in all fields', 'error');
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    try {
      // Save credentials using localStorage (like popup.js does)
      const credentials = { email: username, password: password };
      localStorage.setItem('recipeArchive.credentials', JSON.stringify(credentials));
      
      showStatus('Credentials saved successfully!', 'success');
      
      // Redirect back to popup after a short delay
      setTimeout(() => {
        window.location.href = 'popup.html';
      }, 1000);
      
    } catch (error) {
      console.error('Failed to save credentials:', error);
      showStatus('Failed to save credentials: ' + error.message, 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save Credentials';
    }
  });

  backLink.addEventListener('click', function(e) {
    e.preventDefault();
    window.location.href = 'popup.html';
  });

  function showStatus(message, type) {
    statusDiv.innerHTML = `<div class="${type}">${message}</div>`;
  }

  // Configure AWS settings automatically
  function configureAWSSettings() {
    console.log('🔧 Configuring AWS settings...');
    
    // Set AWS configuration in localStorage
    localStorage.setItem('AWS_REGION', 'us-west-2');
    localStorage.setItem('COGNITO_USER_POOL_ID', 'us-west-2_qJ1i9RhxD');
    localStorage.setItem('COGNITO_APP_CLIENT_ID', '5grdn7qhf1el0ioqb6hkelr29s');
    localStorage.setItem('API_BASE_URL', 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod');
    
    // Enable production mode for the extension
    localStorage.setItem('recipeArchive.dev', 'false');
    
    console.log('✅ AWS settings configured successfully');
    showStatus('AWS settings configured automatically', 'success');
  }
});