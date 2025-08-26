// Comprehensive Error Handling and Logging Utility
// Provides structured error handling, logging, and user feedback for browser extensions

class ErrorHandler {
  constructor(options = {}) {
    this.extensionName = options.extensionName || 'RecipeArchive';
    this.version = options.version || '1.0.0';
    this.enableConsoleLogging = options.enableConsoleLogging !== false;
    this.enableUserNotifications = options.enableUserNotifications !== false;
    this.maxErrorsPerSession = options.maxErrorsPerSession || 50;
    
    this.errorCount = 0;
    this.errorLog = [];
    this.criticalErrors = [];
  }

  // Log different types of errors with structured format
  logError(error, context = {}) {
    if (this.errorCount >= this.maxErrorsPerSession) {
      return; // Prevent memory leaks from excessive logging
    }

    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error.message || String(error),
      stack: error.stack,
      type: error.name || 'Error',
      context: context,
      url: window.location?.href,
      userAgent: navigator.userAgent,
      extension: this.extensionName,
      version: this.version,
      severity: this.getSeverity(error, context)
    };

    this.errorLog.push(errorEntry);
    this.errorCount++;

    if (errorEntry.severity === 'critical') {
      this.criticalErrors.push(errorEntry);
    }

    if (this.enableConsoleLogging) {
      this.logToConsole(errorEntry);
    }

    return errorEntry;
  }

  // Determine error severity based on type and context
  getSeverity(error, context) {
    // Critical errors that break core functionality
    if (context.operation === 'authentication' || 
        context.operation === 'tokenRefresh' ||
        error.message?.includes('crypto') ||
        error.message?.includes('storage') ||
        error.name === 'SecurityError') {
      return 'critical';
    }

    // High severity for extraction failures and network issues
    if (context.operation === 'recipeExtraction' ||
        context.operation === 'apiRequest' ||
        error.name === 'NetworkError' ||
        error.name === 'TypeError') {
      return 'high';
    }

    // Medium severity for parsing and validation issues
    if (context.operation === 'parsing' ||
        context.operation === 'validation' ||
        error.name === 'SyntaxError') {
      return 'medium';
    }

    return 'low';
  }

  // Log to console with appropriate level
  logToConsole(errorEntry) {
    const prefix = `[${this.extensionName}]`;
    const message = `${prefix} ${errorEntry.severity.toUpperCase()}: ${errorEntry.message}`;

    switch (errorEntry.severity) {
      case 'critical':
        console.error(message, errorEntry);
        break;
      case 'high':
        console.error(message, errorEntry);
        break;
      case 'medium':
        console.warn(message, errorEntry);
        break;
      default:
        console.log(message, errorEntry);
    }
  }

  // Show user-friendly error messages
  showUserError(error, context = {}) {
    if (!this.enableUserNotifications) {
      return;
    }

    const userMessage = this.getUserFriendlyMessage(error, context);
    
    // Try to show in status div if available
    const statusElement = document.getElementById('status');
    if (statusElement) {
      this.displayInStatusDiv(statusElement, userMessage, context.severity || 'error');
    } else {
      // Fallback to browser notification API
      this.showBrowserNotification(userMessage);
    }
  }

  // Generate user-friendly error messages
  getUserFriendlyMessage(error, context) {
    const operation = context.operation;

    switch (operation) {
      case 'recipeExtraction':
        return 'Unable to extract recipe from this page. The page layout may not be supported yet.';
      
      case 'authentication':
        return 'Authentication failed. Please check your credentials and try again.';
      
      case 'tokenRefresh':
        return 'Session expired. Please sign in again.';
      
      case 'apiRequest':
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          return 'Network error. Please check your internet connection and try again.';
        }
        return 'Server error. Please try again in a moment.';
      
      case 'storage':
        return 'Unable to save data locally. Please check browser storage permissions.';
      
      case 'validation':
        return error.message || 'Invalid data format. Please check your input.';
      
      default:
        if (error.message?.includes('permission')) {
          return 'Permission denied. Please check browser extension permissions.';
        }
        return 'An unexpected error occurred. Please try refreshing the page.';
    }
  }

  // Display error in status div with appropriate styling
  displayInStatusDiv(statusElement, message, severity = 'error') {
    const colors = {
      error: '#f44336',
      warning: '#ff9800',
      info: '#2196f3',
      success: '#4caf50'
    };

    statusElement.innerHTML = `
      <div style="
        color: ${colors[severity] || colors.error};
        text-align: center;
        padding: 10px;
        border: 1px solid ${colors[severity] || colors.error};
        border-radius: 4px;
        background: ${severity === 'error' ? '#ffebee' : '#fff3e0'};
        margin: 10px 0;
      ">
        <strong>${severity === 'error' ? '❌' : '⚠️'} ${severity.toUpperCase()}</strong><br>
        <small>${message}</small>
      </div>
    `;

    // Auto-clear after 10 seconds for non-critical errors
    if (severity !== 'error') {
      setTimeout(() => {
        if (statusElement.innerHTML.includes(message)) {
          statusElement.innerHTML = '';
        }
      }, 10000);
    }
  }

  // Show browser notification (fallback)
  showBrowserNotification(message) {
    if (typeof chrome !== 'undefined' && chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: this.extensionName + ' Error',
        message: message
      });
    }
  }

  // Wrap async functions with error handling
  async withErrorHandling(asyncFunction, context = {}) {
    try {
      return await asyncFunction();
    } catch (error) {
      const errorEntry = this.logError(error, context);
      
      if (errorEntry.severity === 'critical' || errorEntry.severity === 'high') {
        this.showUserError(error, context);
      }
      
      throw error; // Re-throw for caller to handle if needed
    }
  }

  // Wrap sync functions with error handling
  withSyncErrorHandling(syncFunction, context = {}) {
    try {
      return syncFunction();
    } catch (error) {
      const errorEntry = this.logError(error, context);
      
      if (errorEntry.severity === 'critical' || errorEntry.severity === 'high') {
        this.showUserError(error, context);
      }
      
      throw error; // Re-throw for caller to handle if needed
    }
  }

  // Get error summary for diagnostics
  getErrorSummary() {
    return {
      totalErrors: this.errorCount,
      criticalErrors: this.criticalErrors.length,
      recentErrors: this.errorLog.slice(-10),
      errorsByType: this.getErrorsByType(),
      timestamp: new Date().toISOString()
    };
  }

  // Group errors by type for analysis
  getErrorsByType() {
    const errorTypes = {};
    this.errorLog.forEach(error => {
      const key = error.type + ':' + (error.context.operation || 'unknown');
      errorTypes[key] = (errorTypes[key] || 0) + 1;
    });
    return errorTypes;
  }

  // Clear error log (useful for testing)
  clearErrors() {
    this.errorLog = [];
    this.criticalErrors = [];
    this.errorCount = 0;
  }

  // Check if there are any critical errors
  hasCriticalErrors() {
    return this.criticalErrors.length > 0;
  }

  // Get recent critical errors for emergency reporting
  getCriticalErrors() {
    return this.criticalErrors.slice(-5); // Return last 5 critical errors
  }
}

// Global error handler setup
class GlobalErrorHandler extends ErrorHandler {
  constructor(options = {}) {
    super(options);
    this.setupGlobalHandlers();
  }

  setupGlobalHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError(event.reason, {
        operation: 'unhandledPromise',
        type: 'UnhandledPromiseRejection'
      });
      
      // Prevent default browser error reporting for known issues
      if (this.isKnownIssue(event.reason)) {
        event.preventDefault();
      }
    });

    // Handle general errors
    window.addEventListener('error', (event) => {
      this.logError(event.error || new Error(event.message), {
        operation: 'globalError',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
  }

  // Check if this is a known issue that shouldn't bubble up
  isKnownIssue(error) {
    const message = error?.message || String(error);
    
    // Known browser extension issues that are not critical
    const knownIssues = [
      'Extension context invalidated',
      'Could not establish connection',
      'The message port closed before a response was received',
      'ResizeObserver loop limit exceeded'
    ];

    return knownIssues.some(issue => message.includes(issue));
  }
}

// Export for both environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ErrorHandler, GlobalErrorHandler };
} else {
  window.ErrorHandler = ErrorHandler;
  window.GlobalErrorHandler = GlobalErrorHandler;
}
