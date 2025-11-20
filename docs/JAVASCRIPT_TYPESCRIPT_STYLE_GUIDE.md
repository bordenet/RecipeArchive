# JavaScript/TypeScript Style Guide for RecipeArchive

This document defines the JavaScript and TypeScript coding standards for RecipeArchive browser extensions and web applications.

## 1. Code Organization

### File Structure
```
extensions/
├── shared/           # Shared utilities (no platform-specific APIs)
│   ├── env-config.js
│   ├── jwt-validator.js
│   ├── security-validator.js
│   └── supported-sites.js
├── chrome/           # Chrome-specific implementations
│   ├── content.js
│   ├── background.js
│   ├── popup.js
│   ├── cognito-auth.js
│   └── config.js
└── safari/           # Safari-specific implementations
    ├── content.js
    ├── popup.js
    ├── cognito-auth.js
    └── config.js
```

### Import/Export Patterns
```javascript
// Prefer named exports for utilities
export function validateJWT(token) { }
export function parseToken(token) { }

// Use default export for main classes
export default class CognitoAuthManager { }

// Group imports by type
// 1. No imports (browser extensions can't use ES6 modules in content scripts)
// 2. Chrome/Safari APIs used directly as globals
```

## 2. String Quoting - CRITICAL

**Always use double quotes for strings.** This project uses ESLint with double quote enforcement.

```javascript
// ✅ CORRECT
console.log("Starting authentication");
const url = "https://example.com";
const message = "Error: ${error.message}";

// ❌ WRONG
console.log('Starting authentication');
const url = 'https://example.com';
```

**Always run `npm run lint -- --fix` after editing JavaScript files.**

## 3. Naming Conventions

### Variables and Functions
```javascript
// camelCase for variables and functions
const accessToken = "...";
function extractRecipeData() { }
async function fetchUserProfile() { }
```

### Constants
```javascript
// UPPER_SNAKE_CASE for true constants
const API_ENDPOINT = "https://api.example.com";
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;

// Regular const for runtime-initialized values
const config = loadConfiguration();
```

### Classes
```javascript
// PascalCase for classes
class CognitoAuthManager {
  constructor() { }
}

class RecipeExtractor {
  extract() { }
}
```

### Private Members (Conventional)
```javascript
class AuthManager {
  // Prefix with underscore for "private" methods
  _storeTokens(tokens) { }
  _validateToken(token) { }

  // Public methods have no prefix
  async signIn(username, password) { }
}
```

## 4. Console Logging Standards

### Browser Extensions (Development-Friendly)
Browser extensions use emojis in console logging for better visibility in DevTools:

```javascript
// ✅ Good - Uses emojis for visual distinction
console.log("🎯 RecipeArchive content script starting...");
console.log("✅ Recipe extraction completed");
console.error("❌ Failed to authenticate:", error);
console.warn("⚠️ Token validation failed");
console.log("📊 Diagnostic data sent successfully");
```

**Emoji Guide**:
- 🎯 - Starting/initializing
- ✅ - Success operations
- ❌ - Errors/failures
- ⚠️ - Warnings
- 📊 - Data/metrics
- 🔐 - Authentication
- 🍳 - Recipe operations
- 📨 - Messages/events

### Server-Side JavaScript (Node.js/Lambda)
No emojis - use structured logging with prefixes:

```javascript
// ✅ Server-side logging
console.log("INFO: Starting recipe normalization");
console.error("ERROR: Failed to parse recipe:", error);
console.warn("WARN: Invalid token format");
```

## 5. Async/Await Patterns

### Prefer async/await over Promises
```javascript
// ✅ Good - Clear async/await
async function extractRecipe() {
  try {
    const html = await fetchHTML(url);
    const recipe = await parseRecipe(html);
    return recipe;
  } catch (error) {
    console.error("❌ Recipe extraction failed:", error);
    throw error;
  }
}

// ❌ Avoid - Promise chains harder to read
function extractRecipe() {
  return fetchHTML(url)
    .then(html => parseRecipe(html))
    .catch(error => {
      console.error("❌ Recipe extraction failed:", error);
      throw error;
    });
}
```

### Message Listener Pattern (Browser Extensions)
```javascript
// ✅ Correct pattern for async message handling
chrome.runtime.onMessage.addListener(
  function messageListener(request, sender, sendResponse) {
    if (request.action === "captureRecipe") {
      // Handle async operation
      (async () => {
        try {
          const data = await extractRecipeFromPage();
          sendResponse({ success: true, data });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();

      return true; // Keep channel open for async response
    }
  }
);
```

## 6. Error Handling

### Try-Catch Blocks
```javascript
// ✅ Good - Comprehensive error handling
async function authenticateUser(username, password) {
  try {
    const tokens = await cognito.signIn(username, password);
    await storeTokens(tokens);
    return { success: true };
  } catch (error) {
    console.error("❌ Authentication failed:", error);

    // Report diagnostics for unexpected errors
    if (!error.code) {
      await reportDiagnostic("auth-error", error);
    }

    return {
      success: false,
      error: error.message || "Authentication failed"
    };
  }
}
```

### Error Reporting
```javascript
// Diagnostic reporting function for production errors
async function reportDiagnostic(errorType, error, additionalData = {}) {
  try {
    const diagnosticData = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      errorType,
      error: error?.message || error?.toString() || "Unknown error",
      timestamp: new Date().toISOString(),
      ...additionalData,
    };

    if (error?.stack) {
      diagnosticData.stack = error.stack;
    }

    await fetch(DIAGNOSTIC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ errors: [diagnosticData] }),
    });
  } catch (diagnosticError) {
    console.error("❌ Failed to send diagnostic data:", diagnosticError);
  }
}
```

## 7. Function Documentation

### JSDoc Comments
```javascript
/**
 * Extract recipe data from the current page.
 *
 * @returns {Promise<Object>} Recipe data with ingredients, instructions, etc.
 * @throws {Error} If extraction fails or no recipe found
 *
 * @example
 * const recipe = await extractRecipeFromPage();
 * console.log(recipe.ingredients); // ["1 cup flour", ...]
 */
async function extractRecipeFromPage() {
  // Implementation
}

/**
 * Authenticate user with Cognito.
 *
 * @param {string} username - User's email or username
 * @param {string} password - User's password
 * @returns {Promise<{success: boolean, tokens?: Object, error?: string}>}
 */
async function authenticateUser(username, password) {
  // Implementation
}
```

## 8. Object and Array Patterns

### Destructuring
```javascript
// ✅ Good - Clear destructuring
const { ingredients, instructions, title } = recipeData;
const [firstIngredient, ...restIngredients] = ingredients;

// ✅ Good - With defaults
const { timeout = 5000, retries = 3 } = options;
```

### Spread Operator
```javascript
// ✅ Good - Object merging
const diagnosticData = {
  url: window.location.href,
  timestamp: new Date().toISOString(),
  ...additionalData,
};

// ✅ Good - Array operations
const allItems = [...existingItems, ...newItems];
```

### Optional Chaining
```javascript
// ✅ Good - Safe property access
const userName = user?.profile?.name;
const firstIngredient = recipe?.ingredients?.[0];

// ✅ Good - With nullish coalescing
const displayName = user?.profile?.name ?? "Guest";
```

## 9. Browser Extension Patterns

### Storage API
```javascript
// Chrome storage API
async function storeTokens(tokens) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ tokens }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

async function getStoredTokens() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["tokens"], (result) => {
      resolve(result.tokens || null);
    });
  });
}
```

### Message Passing
```javascript
// Send message to background script
async function sendToBackground(action, data) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action, data },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      }
    );
  });
}
```

## 10. Code Quality Patterns

### Early Returns
```javascript
// ✅ Good - Early returns reduce nesting
function validateRecipe(recipe) {
  if (!recipe) {
    return { valid: false, error: "No recipe provided" };
  }

  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    return { valid: false, error: "No ingredients" };
  }

  if (!recipe.instructions || recipe.instructions.length === 0) {
    return { valid: false, error: "No instructions" };
  }

  return { valid: true };
}
```

### Guard Clauses
```javascript
// ✅ Good - Guard at function start
async function processRecipe(url) {
  if (!url || !isValidUrl(url)) {
    throw new Error("Invalid URL");
  }

  // Main logic here
  const html = await fetchHTML(url);
  return parseRecipe(html);
}
```

### Single Responsibility
```javascript
// ✅ Good - Each function has one clear purpose
function extractIngredients(html) {
  // Only extract ingredients
}

function extractInstructions(html) {
  // Only extract instructions
}

function extractRecipe(html) {
  // Coordinate extraction
  return {
    ingredients: extractIngredients(html),
    instructions: extractInstructions(html),
  };
}
```

## 11. Testing Patterns

### Test Structure
```javascript
describe("JWT Validator", () => {
  test("validates correct JWT format", () => {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
    expect(validateJWT(token).isValid).toBe(true);
  });

  test("rejects invalid JWT format", () => {
    const token = "invalid-token";
    expect(validateJWT(token).isValid).toBe(false);
  });

  test("rejects expired tokens", () => {
    const expiredToken = createExpiredToken();
    expect(validateJWT(expiredToken).isExpired).toBe(true);
  });
});
```

## 12. File Duplication Management

### Current Pattern
RecipeArchive has intentional duplication between Chrome and Safari extensions:
- `chrome/cognito-auth.js` and `safari/cognito-auth.js`
- `chrome/popup.js` and `safari/popup.js`
- `chrome/content.js` and `safari/content.js`

**Rationale**:
- Safari and Chrome have different Web Extension APIs
- Some code differs in storage APIs, message passing, OAuth flows
- Duplication preferred over complex abstraction layers
- Easier to debug and maintain platform-specific code

**Guidelines**:
- ✅ Keep shared utilities in `extensions/shared/`
- ✅ Accept minor duplication for platform-specific features
- ❌ Don't create complex abstraction layers for minor differences
- ✅ Test both platforms independently

## 13. Security Patterns

### Input Validation
```javascript
// ✅ Good - Validate all external inputs
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
}

// ✅ Good - Sanitize user inputs
function sanitizeHTML(html) {
  const div = document.createElement("div");
  div.textContent = html;
  return div.innerHTML;
}
```

### Token Handling
```javascript
// ✅ Good - Secure token storage
async function storeTokens(tokens) {
  // Use chrome.storage.local (encrypted by browser)
  await chrome.storage.local.set({
    accessToken: tokens.accessToken,
    idToken: tokens.idToken,
    refreshToken: tokens.refreshToken,
  });

  // Never log tokens
  console.log("✅ Tokens stored securely");
}

// ❌ Bad - Don't log sensitive data
console.log("Token:", token); // NEVER DO THIS
```

## 14. Performance Patterns

### Debouncing
```javascript
// ✅ Good - Debounce expensive operations
function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

const debouncedSearch = debounce(performSearch, 300);
```

### Lazy Loading
```javascript
// ✅ Good - Load heavy resources only when needed
let parserBundle = null;

async function getParser() {
  if (!parserBundle) {
    parserBundle = await import("./typescript-parser-bundle.js");
  }
  return parserBundle;
}
```

## 15. Current Codebase Status

All RecipeArchive JavaScript/TypeScript code follows these conventions:

**Browser Extensions**:
- ✅ Chrome extension: `extensions/chrome/*.js`
- ✅ Safari extension: `extensions/safari/*.js`
- ✅ Shared utilities: `extensions/shared/*.js`

**Key Files**:
- `content.js` - Recipe extraction from web pages
- `popup.js` - Extension UI and user interaction
- `cognito-auth.js` - AWS Cognito authentication
- `background.js` - Event handling and error reporting
- `typescript-parser-bundle.js` - Generated parser (do not edit manually)

**Testing**:
- All code passes ESLint with strict rules
- No linting warnings (max 150 threshold, currently 0)
- Jest tests for shared utilities
- Manual testing required for browser extensions

## 16. Tools and Automation

### Linting
```bash
# Run ESLint on all JavaScript/TypeScript
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

### Building
```bash
# Build parser bundle
npm run build:parser

# Build all extensions
npm run build:extensions
```

### Testing
```bash
# Run Jest tests
npm test

# Run specific test file
npm test -- parser-registry-integration.test.js
```

## Related Documentation

- [GO_STYLE_GUIDE.md](GO_STYLE_GUIDE.md) - Go coding standards
- [KOTLIN_STYLE_GUIDE.md](KOTLIN_STYLE_GUIDE.md) - Android/Kotlin standards
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution workflow and project development guide
