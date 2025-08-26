// Authentication Status Dashboard for Safari Extension
// Provides comprehensive status monitoring and diagnostics

class AuthDashboard {
  constructor() {
    this.isVisible = false;
    this.refreshInterval = null;
    this.statusData = {};
  }

  // Create and show the dashboard
  show() {
    if (this.isVisible) {return;}

    this.createDashboardUI();
    this.startRefresh();
    this.isVisible = true;
  }

  // Hide the dashboard
  hide() {
    const dashboard = document.getElementById('authDashboard');
    if (dashboard) {
      dashboard.remove();
    }

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    this.isVisible = false;
  }

  // Create dashboard UI
  createDashboardUI() {
    const dashboard = document.createElement('div');
    dashboard.id = 'authDashboard';
    dashboard.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 320px;
      max-height: 80vh;
      background: white;
      border: 2px solid #007AFF;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 12px;
      overflow-y: auto;
    `;

    dashboard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0; color: #007AFF;">🔐 Auth Status</h3>
        <button id="closeDashboard" style="background: none; border: none; font-size: 16px; cursor: pointer;">✕</button>
      </div>
      
      <div id="authStatusContent">
        <div style="text-align: center; color: #666;">Loading...</div>
      </div>
      
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
        <button id="refreshAuth" style="width: 100%; padding: 8px; background: #007AFF; color: white; border: none; border-radius: 4px; cursor: pointer;">
          🔄 Refresh Status
        </button>
      </div>
      
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
        <button id="clearAuthData" style="width: 100%; padding: 8px; background: #ff3b30; color: white; border: none; border-radius: 4px; cursor: pointer;">
          🗑️ Clear Auth Data
        </button>
      </div>
    `;

    document.body.appendChild(dashboard);

    // Event handlers
    document.getElementById('closeDashboard').onclick = () => this.hide();
    document.getElementById('refreshAuth').onclick = () => this.updateStatus();
    document.getElementById('clearAuthData').onclick = () => this.clearAuthData();

    this.updateStatus();
  }

  // Update dashboard status
  async updateStatus() {
    const content = document.getElementById('authStatusContent');
    if (!content) {return;}

    try {
      const status = await this.collectAuthStatus();
      content.innerHTML = this.formatStatus(status);
      this.statusData = status;
    } catch (error) {
      content.innerHTML = `<div style="color: red;">Error: ${error.message}</div>`;
    }
  }

  // Collect comprehensive authentication status
  async collectAuthStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      config: {},
      tokens: {},
      user: {},
      performance: {},
      errors: {},
      environment: {}
    };

    // Configuration status
    try {
      if (typeof CONFIG !== 'undefined') {
        status.config = {
          available: true,
          environment: CONFIG.ENVIRONMENT || 'unknown',
          cognitoRegion: CONFIG.COGNITO?.region || 'not set',
          cognitoUserPoolId: CONFIG.COGNITO?.userPoolId || 'not set',
          cognitoClientId: CONFIG.COGNITO?.clientId ? 'set' : 'not set',
          apiEndpoints: CONFIG.getCurrentAPI ? Object.keys(CONFIG.getCurrentAPI()) : []
        };
      } else {
        status.config.available = false;
      }
    } catch (error) {
      status.config.error = error.message;
    }

    // Token status
    try {
      if (typeof SafariCognitoAuth !== 'undefined' && status.config.available) {
        const auth = new SafariCognitoAuth(CONFIG.getCognitoConfig());

        // Get stored tokens
        const tokens = await auth._getStoredTokens();
        status.tokens = {
          hasAccessToken: Boolean(tokens.accessToken),
          hasRefreshToken: Boolean(tokens.refreshToken),
          hasIdToken: Boolean(tokens.idToken),
          expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : 'not set',
          isExpired: tokens.expiresAt ? Date.now() > tokens.expiresAt : 'unknown'
        };

        // Get current user
        const userResult = await auth.getCurrentUser();
        status.user = {
          authenticated: userResult.success && userResult.data?.authenticated,
          email: userResult.data?.email || 'not available',
          error: userResult.error || null
        };
      }
    } catch (error) {
      status.tokens.error = error.message;
    }

    // Performance metrics
    if (typeof window !== 'undefined' && window.authPerformanceMonitor) {
      status.performance = {
        available: true,
        activeOperations: window.authPerformanceMonitor.metrics.size
      };
    }

    // Error status
    if (typeof window !== 'undefined' && window.authErrorHandler) {
      const diagnostics = window.authErrorHandler.getDiagnostics();
      status.errors = {
        totalErrors: diagnostics.errorCount,
        recentErrors: diagnostics.recentErrors.length,
        retryStatus: Object.keys(diagnostics.retryStatus).length
      };
    }

    // Environment info
    status.environment = {
      userAgent: `${navigator.userAgent.substring(0, 100) }...`,
      url: window.location.href,
      storage: {
        localStorage: typeof localStorage !== 'undefined',
        browserStorage: typeof browser !== 'undefined' && typeof browser.storage !== 'undefined'
      },
      devBypass: localStorage.getItem('recipeArchive.devBypass') === 'true'
    };

    return status;
  }

  // Format status for display
  formatStatus(status) {
    const formatBoolean = (value) => value ? '✅' : '❌';
    const formatValue = (value) => value || '❌ not set';

    return `
      <div style="margin-bottom: 15px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">⚙️ Configuration</h4>
        <div>Available: ${formatBoolean(status.config.available)}</div>
        <div>Environment: ${formatValue(status.config.environment)}</div>
        <div>Cognito Region: ${formatValue(status.config.cognitoRegion)}</div>
        <div>User Pool ID: ${formatValue(status.config.cognitoUserPoolId)}</div>
        <div>Client ID: ${formatValue(status.config.cognitoClientId)}</div>
      </div>

      <div style="margin-bottom: 15px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">🔑 Authentication</h4>
        <div>Authenticated: ${formatBoolean(status.user.authenticated)}</div>
        <div>Email: ${formatValue(status.user.email)}</div>
        <div>Access Token: ${formatBoolean(status.tokens.hasAccessToken)}</div>
        <div>ID Token: ${formatBoolean(status.tokens.hasIdToken)}</div>
        <div>Refresh Token: ${formatBoolean(status.tokens.hasRefreshToken)}</div>
        <div>Token Expired: ${status.tokens.isExpired ? '⚠️ Yes' : '✅ No'}</div>
      </div>

      <div style="margin-bottom: 15px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">📊 Status</h4>
        <div>Total Errors: ${status.errors.totalErrors || 0}</div>
        <div>Recent Errors: ${status.errors.recentErrors || 0}</div>
        <div>Active Operations: ${status.performance.activeOperations || 0}</div>
        <div>Dev Bypass: ${formatBoolean(status.environment.devBypass)}</div>
      </div>

      <div style="font-size: 10px; color: #666; padding-top: 10px; border-top: 1px solid #eee;">
        Last updated: ${new Date(status.timestamp).toLocaleTimeString()}
      </div>
    `;
  }

  // Clear authentication data
  async clearAuthData() {
    if (!confirm('Clear all authentication data? You will need to sign in again.')) {
      return;
    }

    try {
      if (typeof SafariCognitoAuth !== 'undefined' && typeof CONFIG !== 'undefined') {
        const auth = new SafariCognitoAuth(CONFIG.getCognitoConfig());
        await auth.signOut();
      }

      // Clear local storage
      localStorage.removeItem('recipeArchive.devBypass');

      // Clear error logs
      if (typeof window !== 'undefined' && window.authErrorHandler) {
        window.authErrorHandler.clearLog();
      }

      alert('Authentication data cleared successfully');
      this.updateStatus();
    } catch (error) {
      alert(`Error clearing auth data: ${ error.message}`);
    }
  }

  // Start auto-refresh
  startRefresh() {
    this.refreshInterval = setInterval(() => {
      this.updateStatus();
    }, 10000); // Refresh every 10 seconds
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.AuthDashboard = AuthDashboard;

  // Add keyboard shortcut to show dashboard (Cmd+Shift+A or Ctrl+Shift+A)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
      e.preventDefault();

      if (!window.authDashboardInstance) {
        window.authDashboardInstance = new AuthDashboard();
      }

      if (window.authDashboardInstance.isVisible) {
        window.authDashboardInstance.hide();
      } else {
        window.authDashboardInstance.show();
      }
    }
  });
}
