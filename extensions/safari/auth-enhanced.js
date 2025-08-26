// Enhanced Authentication Error Handler and Recovery System
// Provides comprehensive error handling, logging, and recovery for Safari authentication

class AuthErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogEntries = 50;
    this.retryAttempts = new Map();
    this.maxRetries = 3;
  }

  // Log authentication errors with context
  logError(operation, error, context = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      operation,
      error: error.message || error,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.errorLog.push(errorEntry);
    
    // Keep log size manageable
    if (this.errorLog.length > this.maxLogEntries) {
      this.errorLog.shift();
    }

    // Log to console for debugging (without sensitive data)
    console.error(`Auth Error [${operation}]:`, error.message || error, context);
    
    return errorEntry;
  }

  // Get user-friendly error message
  getUserFriendlyMessage(error) {
    const errorType = error.__type || error.name || 'UnknownError';
    
    const errorMessages = {
      'NotAuthorizedException': 'Invalid email or password. Please check your credentials and try again.',
      'UserNotFoundException': 'No account found with this email address. Please sign up first.',
      'UsernameExistsException': 'An account with this email already exists. Please sign in instead.',
      'InvalidPasswordException': 'Password does not meet requirements. Must be at least 8 characters with uppercase, lowercase, and numbers.',
      'CodeDeliveryFailureException': 'Could not send verification code. Please check your email address.',
      'ExpiredCodeException': 'Verification code has expired. Please request a new code.',
      'CodeMismatchException': 'Invalid verification code. Please check the code and try again.',
      'LimitExceededException': 'Too many attempts. Please wait a few minutes before trying again.',
      'NetworkError': 'Connection problem. Please check your internet connection and try again.',
      'TimeoutError': 'Request timed out. Please try again.',
      'TokenExpiredException': 'Your session has expired. Please sign in again.',
      'InvalidTokenException': 'Invalid session. Please sign in again.'
    };

    return errorMessages[errorType] || 'An unexpected error occurred. Please try again or contact support.';
  }

  // Check if operation should be retried
  shouldRetry(operation, error) {
    const retryableErrors = [
      'NetworkError',
      'TimeoutError',
      'InternalErrorException',
      'ServiceUnavailableException'
    ];

    const errorType = error.__type || error.name || 'UnknownError';
    const currentAttempts = this.retryAttempts.get(operation) || 0;

    return retryableErrors.includes(errorType) && currentAttempts < this.maxRetries;
  }

  // Increment retry counter
  incrementRetry(operation) {
    const current = this.retryAttempts.get(operation) || 0;
    this.retryAttempts.set(operation, current + 1);
    return current + 1;
  }

  // Reset retry counter
  resetRetry(operation) {
    this.retryAttempts.delete(operation);
  }

  // Get retry delay (exponential backoff)
  getRetryDelay(attempt) {
    return Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
  }

  // Execute operation with retry logic
  async executeWithRetry(operation, operationName, context = {}) {
    while (true) {
      try {
        this.resetRetry(operationName);
        return await operation();
      } catch (error) {
        this.logError(operationName, error, context);
        
        if (this.shouldRetry(operationName, error)) {
          const attempt = this.incrementRetry(operationName);
          const delay = this.getRetryDelay(attempt);
          
          console.log(`Retrying ${operationName} in ${delay}ms (attempt ${attempt}/${this.maxRetries})`);
          await this.delay(delay);
          continue;
        }
        
        throw error;
      }
    }
  }

  // Utility delay function
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get error diagnostics for support
  getDiagnostics() {
    return {
      errorCount: this.errorLog.length,
      recentErrors: this.errorLog.slice(-5),
      retryStatus: Object.fromEntries(this.retryAttempts),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };
  }

  // Clear error log
  clearLog() {
    this.errorLog = [];
    this.retryAttempts.clear();
  }
}

// Enhanced security validator
class AuthSecurityValidator {
  constructor() {
    this.suspiciousPatterns = [
      /script|javascript|vbscript/i,
      /<[^>]*>/,
      /['"]\s*on\w+\s*=/i
    ];
  }

  // Validate email format and security
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email || typeof email !== 'string') {
      throw new Error('Email is required');
    }
    
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
    
    if (email.length > 254) {
      throw new Error('Email address too long');
    }
    
    if (this.containsSuspiciousContent(email)) {
      throw new Error('Invalid characters in email');
    }
    
    return true;
  }

  // Validate password security
  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password is required');
    }
    
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    if (password.length > 128) {
      throw new Error('Password too long');
    }
    
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    
    if (this.containsSuspiciousContent(password)) {
      throw new Error('Password contains invalid characters');
    }
    
    return true;
  }

  // Check for suspicious content
  containsSuspiciousContent(input) {
    return this.suspiciousPatterns.some(pattern => pattern.test(input));
  }

  // Validate confirmation code
  validateConfirmationCode(code) {
    if (!code || typeof code !== 'string') {
      throw new Error('Confirmation code is required');
    }
    
    if (!/^\d{6}$/.test(code)) {
      throw new Error('Confirmation code must be 6 digits');
    }
    
    return true;
  }
}

// Performance monitor for authentication operations
class AuthPerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  // Start timing an operation
  startTimer(operation) {
    this.metrics.set(operation, {
      startTime: performance.now(),
      operation
    });
  }

  // End timing and log results
  endTimer(operation, success = true) {
    const metric = this.metrics.get(operation);
    if (!metric) return;

    const duration = performance.now() - metric.startTime;
    const result = {
      operation,
      duration: Math.round(duration),
      success,
      timestamp: new Date().toISOString()
    };

    console.log(`Auth Performance [${operation}]: ${duration.toFixed(2)}ms - ${success ? 'SUCCESS' : 'FAILED'}`);
    
    this.metrics.delete(operation);
    return result;
  }

  // Get average performance for operation type
  getAverageTime(operation) {
    // This would require storing historical data
    // For now, just return current metric if active
    const current = this.metrics.get(operation);
    return current ? performance.now() - current.startTime : null;
  }
}

// Make classes available globally
if (typeof window !== 'undefined') {
  window.AuthErrorHandler = AuthErrorHandler;
  window.AuthSecurityValidator = AuthSecurityValidator;
  window.AuthPerformanceMonitor = AuthPerformanceMonitor;
  
  // Initialize global error handler for authentication
  window.authErrorHandler = new AuthErrorHandler();
  window.authSecurityValidator = new AuthSecurityValidator();
  window.authPerformanceMonitor = new AuthPerformanceMonitor();
}
