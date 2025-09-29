/* eslint-env browser */
// RecipeArchive Chrome Extension Popup with full backend integration

// Global error handling for popup
const DIAGNOSTIC_ENDPOINT =
  "https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod/report-error";

// Diagnostic reporting function
async function reportDiagnostic(errorType, error, additionalData = {}) {
  try {
    const diagnosticData = {
      url: "chrome-extension-popup",
      userAgent: navigator.userAgent,
      errorType,
      error: error?.message || error?.toString() || "Unknown error",
      timestamp: new Date().toISOString(),
      extension: "chrome",
      context: "popup",
      ...additionalData,
    };

    // Include stack trace if available
    if (error?.stack) {
      diagnosticData.stack = error.stack;
    }

    await fetch(DIAGNOSTIC_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ errors: [diagnosticData] }),
    });

    console.log("📊 Diagnostic data sent successfully");
  } catch (diagnosticError) {
    console.error("❌ Failed to send diagnostic data:", diagnosticError);
  }
}

// Global error handlers
window.addEventListener("error", (event) => {
  console.error("🚨 Unhandled error in popup:", event.error);
  reportDiagnostic("popup-unhandled-error", event.error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
  event.preventDefault(); // Prevent error from reaching chrome://extensions
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("🚨 Unhandled promise rejection in popup:", event.reason);
  reportDiagnostic("popup-unhandled-rejection", event.reason);
  event.preventDefault(); // Prevent error from reaching chrome://extensions
});

// State management
let isSignedIn = false;
// let currentUser = null; // Removed unused variable

// Get extension version from manifest
function getExtensionVersion() {
  return chrome.runtime.getManifest().version;
}

// Create version display element
function createVersionDisplay() {
  const version = getExtensionVersion();
  const webAppUrl = CONFIG.WEB_APP_URL;

  return `
        <div style="position: absolute; top: 8px; left: 20px; z-index: 1000;">
            <a href="${webAppUrl}" target="_blank" 
               style="font-size: 11px; color: #888; text-decoration: none; font-family: Arial, sans-serif;"
               title="Open RecipeArchive Web App">v${version}</a>
        </div>
    `;
}

// Credential management functions for convenience
function saveCredentials(email, password) {
  const credentials = { email, password };
  localStorage.setItem(
    "recipeArchive.credentials",
    JSON.stringify(credentials)
  );
}

function loadCredentials() {
  try {
    const saved = localStorage.getItem("recipeArchive.credentials");
    return saved ? JSON.parse(saved) : { email: "", password: "" };
  } catch (error) {
    console.error("Error loading credentials:", error);
    return { email: "", password: "" };
  }
}

function clearCredentials() {
  localStorage.removeItem("recipeArchive.credentials");
}

// Ensure AWS configuration is set before authentication attempts
async function ensureAWSConfiguration() {
  console.log("🔧 Checking AWS configuration...");

  // Check if configuration is already set and valid
  const currentUserPoolId = localStorage.getItem("COGNITO_USER_POOL_ID");
  const currentClientId = localStorage.getItem("COGNITO_APP_CLIENT_ID");

  if (
    currentUserPoolId &&
    currentClientId &&
    currentUserPoolId !== "CONFIGURE_ME" &&
    currentClientId !== "CONFIGURE_ME"
  ) {
    console.log("✅ AWS configuration already set");
    return;
  }

  // Set correct AWS configuration
  console.log("🔧 Setting correct AWS configuration...");
  localStorage.setItem("AWS_REGION", "us-west-2");
  localStorage.setItem("COGNITO_USER_POOL_ID", "us-west-2_rpBcEEhYK");
  localStorage.setItem("COGNITO_APP_CLIENT_ID", "7lm8mqr03s0m0fn17dnv373s4h");
  localStorage.setItem(
    "API_BASE_URL",
    "https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod"
  );

  // Enable production mode for the extension
  localStorage.setItem("recipeArchive.dev", "false");

  // Force CONFIG to reload environment configuration
  if (typeof CONFIG !== "undefined" && CONFIG.reloadConfiguration) {
    CONFIG.reloadConfiguration();
  }

  console.log("✅ AWS configuration set successfully");
}

document.addEventListener("DOMContentLoaded", function () {
  const container = document.createElement("div");
  container.style.cssText =
    "padding: 20px; min-width: 320px; font-family: Arial, sans-serif;";
  container.id = "main-container";

  document.body.appendChild(container);

  // Initialize with proper dependencies loading
  initializePopupSafely();
});

// Safe initialization with dependency checking
async function initializePopupSafely(retryCount = 0) {
  const MAX_INIT_RETRIES = 5;
  const INIT_RETRY_DELAY = 100;

  try {
    // Check if critical dependencies are loaded
    if (typeof CONFIG === "undefined" || typeof localStorage === "undefined") {
      if (retryCount < MAX_INIT_RETRIES) {
        console.log(
          `⏳ Waiting for dependencies to load (attempt ${retryCount + 1}/${MAX_INIT_RETRIES})`
        );
        setTimeout(() => {
          initializePopupSafely(retryCount + 1);
        }, INIT_RETRY_DELAY);
        return;
      } else {
        console.error("⚠️ Critical dependencies failed to load");
      }
    }

    // Check authentication status on extension load
    checkAuthenticationStatus();
  } catch (error) {
    console.error("Error during popup initialization:", error);
    // Fallback initialization
    checkAuthenticationStatus();
  }
}

function checkAuthenticationStatus() {
  // Check if user is signed in (from storage or session)
  const storedAuth = localStorage.getItem("recipeArchive.auth");
  if (storedAuth) {
    try {
      isSignedIn = true;
    } catch (error) {
      console.error("Error parsing stored auth:", error);
      isSignedIn = false;
    }
  }
  renderUI();
}

// Robust site support checking with race condition protection
async function checkSiteSupport(captureBtn, retryCount = 0) {
  const MAX_RETRIES = 10; // Maximum number of retries
  const RETRY_DELAY = 50; // Milliseconds between retries

  try {
    // Get current tab with proper error handling
    const tabs = await new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(tabs);
        }
      });
    });

    const tab = tabs[0];
    let isSupported = false;

    // Check if RecipeArchiveSites is available with retry logic
    if (typeof window.RecipeArchiveSites !== "undefined") {
      if (tab && tab.url) {
        isSupported = window.RecipeArchiveSites.isSupportedSite(tab.url);
      }
      updateCaptureButton(captureBtn, isSupported);
    } else if (retryCount < MAX_RETRIES) {
      // RecipeArchiveSites not loaded yet, retry after delay
      console.log(
        `⏳ Waiting for RecipeArchiveSites to load (attempt ${retryCount + 1}/${MAX_RETRIES})`
      );
      setTimeout(() => {
        checkSiteSupport(captureBtn, retryCount + 1);
      }, RETRY_DELAY);
      return;
    } else {
      // Max retries reached, disable button with error state
      console.warn("⚠️ RecipeArchiveSites failed to load after max retries");
      updateCaptureButton(captureBtn, false, "Loading Error");
    }
  } catch (error) {
    console.error("Error checking site support:", error);
    updateCaptureButton(captureBtn, false, "Check Failed");
  }
}

// Update capture button state with proper error handling
function updateCaptureButton(captureBtn, isSupported, errorMessage = null) {
  if (!captureBtn) return;

  captureBtn.disabled = !isSupported;
  captureBtn.style.opacity = isSupported ? "1" : "0.5";
  captureBtn.style.cursor = isSupported ? "pointer" : "not-allowed";

  if (errorMessage) {
    captureBtn.textContent = errorMessage;
    captureBtn.title = "Failed to check site compatibility";
  } else if (!isSupported) {
    captureBtn.textContent = "Site Not Supported";
    captureBtn.title = "This site is not supported";
  } else {
    captureBtn.textContent = "Capture Recipe";
    captureBtn.title = "Capture Recipe";
  }
}

function renderUI() {
  const container = document.getElementById("main-container");
  const versionDisplay = createVersionDisplay();

  if (isSignedIn) {
    // Signed in UI - show capture functionality
    container.innerHTML = `
            ${versionDisplay}
            <div style="position: relative; padding-top: 20px;">
                <h1 style="margin: 0 0 20px 0; font-size: 18px; color: #333;">RecipeArchive</h1>
                <a href="#" id="signout-link" style="position: absolute; top: -12px; right: 0; font-size: 11px; color: #666; text-decoration: none;">sign out</a>
            </div>
            <button id="capture" style="width: 100%; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">Capture Recipe</button>
            <div id="status" style="margin-top: 15px; padding: 10px; border-radius: 4px; font-size: 12px; display: none;"></div>
        `;

    // Attach event listeners for signed-in state
    const captureBtn = document.getElementById("capture");
    captureBtn.onclick = function () {
      captureRecipe();
    };
    document.getElementById("signout-link").onclick = function (e) {
      e.preventDefault();
      signOut();
    };
    // Check if current site is supported with race condition protection
    checkSiteSupport(captureBtn);
  } else {
    // Not signed in UI - show sign in form
    container.innerHTML = `
            ${versionDisplay}
            <div style="padding-top: 20px;">
                <h1 style="margin: 0 0 20px 0; font-size: 18px; color: #333; text-align: center;">RecipeArchive</h1>
            </div>
            <div style="margin-bottom: 20px; padding: 10px; background: #fff3e0; border-radius: 4px; font-size: 12px; text-align: center;">
                Sign in to capture recipes
            </div>
            
            <form id="signin-form">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #666;">Email</label>
                    <input type="email" id="email" required 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #666;">Password</label>
                    <input type="password" id="password" required 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="font-size: 12px; color: #666; cursor: pointer;">
                        <input type="checkbox" id="show-password" style="margin-right: 5px;"> Show password
                    </label>
                </div>
                
                <button type="submit" id="signin-btn" 
                        style="width: 100%; padding: 12px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    Sign In
                </button>
            </form>
            
            <div id="clear-credentials-container"></div>
            
            <div id="status" style="margin-top: 15px; padding: 10px; border-radius: 4px; font-size: 12px; display: none;"></div>
        `;

    // Load saved credentials and populate form
    const savedCreds = loadCredentials();
    document.getElementById("email").value = savedCreds.email || "";
    document.getElementById("password").value = savedCreds.password || "";

    // Add clear credentials link if there are saved credentials
    if (savedCreds.email) {
      document.getElementById("clear-credentials-container").innerHTML = `
                <div style="margin-top: 10px; text-align: center;">
                    <a href="#" id="clear-credentials" style="font-size: 12px; color: #666; text-decoration: none;">Clear saved credentials</a>
                </div>
            `;
    }

    // Attach event listeners for sign-in form
    document.getElementById("signin-form").onsubmit = function (e) {
      e.preventDefault();
      handleSignIn();
    };

    document.getElementById("show-password").onchange = function () {
      const passwordField = document.getElementById("password");
      passwordField.type = this.checked ? "text" : "password";
    };

    // Add clear credentials handler if the link exists
    const clearCredentialsLink = document.getElementById("clear-credentials");
    if (clearCredentialsLink) {
      clearCredentialsLink.onclick = function (e) {
        e.preventDefault();
        clearCredentials();
        renderUI(); // Re-render to show empty form
        showStatus("✅ Saved credentials cleared", "#e8f5e8");
      };
    }
  }
}

async function handleSignIn() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) {
    showStatus("❌ Please enter email and password", "#ffebee");
    return;
  }

  showStatus("Signing in to AWS Cognito...", "#e3f2fd");

  try {
    // Ensure AWS configuration is set before authentication
    await ensureAWSConfiguration();

    // Initialize SimpleCognitoAuth with configuration from CONFIG
    const cognitoConfig = CONFIG.getCognitoConfig();
    console.log("🔍 DEBUG: cognitoConfig from CONFIG:", cognitoConfig);

    const cognitoAuth = new window.SimpleCognitoAuth({
      region: cognitoConfig.region,
      userPoolId: cognitoConfig.userPoolId,
      clientId: cognitoConfig.clientId,
    });

    // Perform real Cognito authentication
    const result = await cognitoAuth.signIn(email, password);

    if (result.success) {
      // Authentication successful - token logging removed for security

      // Get the real JWT tokens from Cognito
      const authData = {
        email: email,
        token: result.data.IdToken, // Primary token field
        accessToken: result.data.AccessToken,
        idToken: result.data.IdToken,
        refreshToken: result.data.RefreshToken,
        tokenType: "Bearer",
        expiresIn: result.data.ExpiresIn || 3600,
        issuedAt: Date.now(),
        provider: "cognito",
      };

      // Store authentication data

      // Store auth data
      isSignedIn = true;
      localStorage.setItem("recipeArchive.auth", JSON.stringify(authData));

      // Authentication data stored successfully

      // Switch to production mode for AWS API calls
      if (typeof CONFIG !== "undefined") {
        CONFIG.enableProduction();
      }

      // Save credentials for future use
      saveCredentials(email, password);

      renderUI();
      showStatus("✅ Signed in to AWS Cognito successfully", "#e8f5e8");
    } else {
      showStatus("❌ Sign in failed: " + result.error, "#f8d7da");
      console.error("❌ Cognito authentication failed:", result.error);
    }
  } catch (error) {
    console.error("❌ Cognito authentication error:", error);
    showStatus("❌ Sign in failed: " + error.message, "#ffebee");
  }
}

async function refreshAuthToken() {
  try {
    const authData = localStorage.getItem("recipeArchive.auth");
    if (!authData) {
      return { success: false, error: "No auth data found" };
    }

    const auth = JSON.parse(authData);
    if (!auth.refreshToken) {
      return { success: false, error: "No refresh token available" };
    }

    // Initialize ChromeCognitoAuth with configuration
    const cognitoConfig = CONFIG.getCognitoConfig();
    const cognitoAuth = new window.SimpleCognitoAuth({
      region: cognitoConfig.region,
      userPoolId: cognitoConfig.userPoolId,
      clientId: cognitoConfig.clientId,
    });

    // Call the refresh token method
    const result = await cognitoAuth.refreshToken(auth.refreshToken);

    if (result.success) {
      console.log("✅ Token refresh successful");

      // Update the localStorage auth data with new tokens from the response
      if (result.tokens) {
        const updatedAuth = {
          ...auth,
          token: result.tokens.idToken, // Keep token as idToken for consistency
          accessToken: result.tokens.accessToken, // Store accessToken separately
          idToken: result.tokens.idToken,
          refreshToken: result.tokens.refreshToken || auth.refreshToken,
        };
        localStorage.setItem("recipeArchive.auth", JSON.stringify(updatedAuth));
        console.log("✅ Updated localStorage with new tokens");
      }

      return { success: true };
    } else {
      console.error("❌ Token refresh failed:", result.error);

      // Try to re-authenticate with stored credentials automatically
      console.log(
        "🔄 Attempting automatic re-authentication with stored credentials..."
      );
      const reAuthResult = await attemptAutoReAuth();
      if (reAuthResult.success) {
        console.log("✅ Automatic re-authentication successful");
        return { success: true };
      } else {
        console.error(
          "❌ Automatic re-authentication failed:",
          reAuthResult.error
        );
        return { success: false, error: result.error };
      }
    }
  } catch (error) {
    console.error("❌ Token refresh error:", error);

    // Try to re-authenticate with stored credentials automatically
    console.log(
      "🔄 Attempting automatic re-authentication with stored credentials..."
    );
    const reAuthResult = await attemptAutoReAuth();
    if (reAuthResult.success) {
      console.log("✅ Automatic re-authentication successful after error");
      return { success: true };
    } else {
      console.error(
        "❌ Automatic re-authentication failed after error:",
        reAuthResult.error
      );
      return { success: false, error: error.message };
    }
  }
}

// Attempt automatic re-authentication using stored credentials with retry logic
async function attemptAutoReAuth(retryCount = 0) {
  const MAX_RETRY_ATTEMPTS = 3;
  const BASE_DELAY_MS = 1000; // Start with 1 second

  try {
    const savedCreds = loadCredentials();
    if (!savedCreds.email || !savedCreds.password) {
      console.log("❌ No stored credentials available for auto re-auth");
      return { success: false, error: "No stored credentials available" };
    }

    console.log(
      `🔄 Attempting auto re-auth for user: ${savedCreds.email} (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`
    );

    // Initialize Cognito auth
    const cognitoConfig = CONFIG.getCognitoConfig();
    const cognitoAuth = new window.SimpleCognitoAuth({
      region: cognitoConfig.region,
      userPoolId: cognitoConfig.userPoolId,
      clientId: cognitoConfig.clientId,
    });

    // Attempt sign in with stored credentials
    const result = await cognitoAuth.signIn(
      savedCreds.email,
      savedCreds.password
    );

    if (result.success) {
      console.log("✅ Auto re-authentication successful");

      // Store the new authentication tokens
      const authData = {
        token: result.tokens.idToken,
        accessToken: result.tokens.accessToken,
        idToken: result.tokens.idToken,
        refreshToken: result.tokens.refreshToken,
        userEmail: savedCreds.email,
      };
      localStorage.setItem("recipeArchive.auth", JSON.stringify(authData));

      // Update signed in state
      isSignedIn = true;

      console.log("✅ Auto re-auth tokens stored successfully");
      return { success: true };
    } else {
      console.error(
        `❌ Auto re-auth failed (attempt ${retryCount + 1}):`,
        result.error
      );

      // Check if we should retry
      if (retryCount < MAX_RETRY_ATTEMPTS - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryCount); // Exponential backoff
        console.log(`⏳ Retrying auto re-auth in ${delay}ms...`);

        await new Promise((resolve) => setTimeout(resolve, delay));
        return await attemptAutoReAuth(retryCount + 1);
      } else {
        console.error(
          "❌ Auto re-auth exhausted all retry attempts. User credentials may have changed or been deprovisioned."
        );
        return {
          success: false,
          error: `Auto re-auth failed after ${MAX_RETRY_ATTEMPTS} attempts: ${result.error}`,
        };
      }
    }
  } catch (error) {
    console.error(`❌ Auto re-auth error (attempt ${retryCount + 1}):`, error);

    // Check if we should retry on error
    if (retryCount < MAX_RETRY_ATTEMPTS - 1) {
      const delay = BASE_DELAY_MS * Math.pow(2, retryCount); // Exponential backoff
      console.log(`⏳ Retrying auto re-auth after error in ${delay}ms...`);

      await new Promise((resolve) => setTimeout(resolve, delay));
      return await attemptAutoReAuth(retryCount + 1);
    } else {
      console.error(
        "❌ Auto re-auth exhausted all retry attempts due to errors. User credentials may have changed or been deprovisioned."
      );
      return {
        success: false,
        error: `Auto re-auth failed after ${MAX_RETRY_ATTEMPTS} attempts: ${error.message}`,
      };
    }
  }
}

function signOut() {
  isSignedIn = false;
  localStorage.removeItem("recipeArchive.auth");
  // Note: Keeping saved credentials for convenience
  // Users can clear them manually if desired
  renderUI();
}

// Helper function to compress images using canvas
async function compressImage(imageBlob, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions (max 1200px width while maintaining aspect ratio)
        const maxWidth = 1200;
        const maxHeight = 1200;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (compressedBlob) => {
            if (compressedBlob) {
              resolve(compressedBlob);
            } else {
              reject(new Error("Image compression failed"));
            }
          },
          "image/jpeg",
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () =>
      reject(new Error("Image load failed during compression"));

    // Create object URL from blob
    const objectUrl = URL.createObjectURL(imageBlob);
    img.src = objectUrl;

    // Clean up object URL after a delay
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  });
}

async function downloadAndUploadImage(imageUrl, recipeTitle) {
  try {
    console.log("🖼️ Starting image download from:", imageUrl);

    // Generate a unique filename
    const timestamp = Date.now();
    const sanitizedTitle = (recipeTitle || "recipe")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);
    const fileExtension =
      imageUrl.split(".").pop()?.toLowerCase().split("?")[0] || "jpg";
    const filename = `recipes/${sanitizedTitle}-${timestamp}.${fileExtension}`;

    // Try multiple strategies for downloading images with CORS restrictions
    console.log(`📥 Fetching image: ${imageUrl}`);

    let imageBlob, contentType;

    try {
      // Strategy 1: Try CORS mode first
      const response = await fetch(imageUrl, {
        mode: "cors",
        credentials: "omit",
        headers: {
          Accept: "image/*,*/*;q=0.9",
        },
      });

      if (!response.ok) {
        throw new Error(
          `CORS fetch failed: ${response.status} ${response.statusText}`
        );
      }

      contentType = response.headers.get("content-type") || "image/jpeg";
      imageBlob = await response.blob();
      console.log(
        `✅ Image fetch successful (CORS): ${response.status} ${contentType}`
      );
    } catch (corsError) {
      console.log("📥 CORS failed, trying no-cors fetch...");

      // Strategy 2: Try no-cors mode (can't read response but may still work for some cases)
      try {
        const _response = await fetch(imageUrl, {
          mode: "no-cors",
          credentials: "omit",
        });

        // For no-cors, we get an opaque response we can't read
        // This approach works for some sites but has limitations
        console.log(
          "⚠️ Got opaque response from no-cors fetch - cannot process image data"
        );
        throw new Error("No-cors mode returned opaque response");
      } catch (noCorsError) {
        console.log(
          "📥 No-cors also failed, trying server-side fetch strategy..."
        );

        // Strategy 3: Check if this is a known problematic domain
        const problematicDomains = [
          "food.fnr.sndimg.com", // Food Network CDN
          "images.immediate.co.uk", // BBC Good Food
          "cdn.apartmenttherapy.info", // The Kitchn
          "s3.amazonaws.com", // Some AWS S3 buckets
        ];

        const urlHost = new URL(imageUrl).hostname;
        const isProblematicDomain = problematicDomains.some((domain) =>
          urlHost.includes(domain)
        );

        if (isProblematicDomain) {
          console.log(
            `⚠️ Known problematic domain (${urlHost}), skipping image due to CORS restrictions`
          );

          // Report this specific CORS issue for monitoring
          reportDiagnostic(
            "image-cors-blocked",
            new Error(`CORS blocked for ${urlHost}`),
            {
              imageUrl,
              domain: urlHost,
              corsError: corsError.message,
              noCorsError: noCorsError.message,
              strategy: "skip-image",
            }
          );

          // Skip the image instead of server-side fetch for security
          return null;
        }

        // Strategy 4: For unknown domains, return null (skip image)
        console.warn(`⚠️ All image fetch strategies failed for: ${imageUrl}`);
        console.warn("⚠️ Specific errors:", {
          cors: corsError.message,
          noCors: noCorsError.message,
        });

        // Report general image fetch failure
        reportDiagnostic(
          "image-fetch-failed",
          new Error(`All strategies failed for ${urlHost}`),
          {
            imageUrl,
            domain: urlHost,
            corsError: corsError.message,
            noCorsError: noCorsError.message,
          }
        );

        // Return null to indicate image capture failed
        return null;
      }
    }

    console.log(
      `📦 Downloaded image (${imageBlob.size} bytes, ${contentType})`
    );

    // Compress large images before upload
    if (imageBlob.size > 2 * 1024 * 1024) {
      // If larger than 2MB, compress
      console.log(`🗜️ Compressing large image: ${imageBlob.size} bytes`);
      imageBlob = await compressImage(imageBlob, 0.7); // 70% quality
      contentType = "image/jpeg"; // Compression converts to JPEG
      console.log(`✅ Compressed to: ${imageBlob.size} bytes`);
    }

    // Final size check for Lambda limits (account for base64 expansion ~33%)
    const estimatedPayloadSize = imageBlob.size * 1.33;
    if (estimatedPayloadSize > 5.5 * 1024 * 1024) {
      // 5.5MB limit for safety
      throw new Error(
        `Payload too large for Lambda: ${Math.round(estimatedPayloadSize)} bytes (max ~5.5MB)`
      );
    }

    // Convert blob to base64 for AWS upload
    const arrayBuffer = await imageBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    console.log(`🔄 Converting ${uint8Array.length} bytes to base64...`);

    // Process in chunks to avoid stack overflow with large images
    let binaryString = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, chunk);
    }
    const base64String = btoa(binaryString);

    console.log(
      `✅ Base64 conversion complete: ${base64String.length} characters`
    );

    // Check if base64 data is too large for Lambda (6MB payload limit)
    const payloadSize = JSON.stringify({
      filename: filename,
      contentType: contentType,
      imageData: base64String,
    }).length;

    if (payloadSize > 5.5 * 1024 * 1024) {
      // 5.5MB to leave room for headers
      throw new Error(
        `Payload too large for Lambda: ${payloadSize} bytes (max ~5.5MB)`
      );
    }

    console.log(`📤 Uploading ${payloadSize} byte payload to S3...`);

    // Upload to S3 via API Gateway
    const api = CONFIG.getCurrentAPI();
    const auth = JSON.parse(localStorage.getItem("recipeArchive.auth") || "{}");

    const uploadResponse = await fetch(`${api.base}/images/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.idToken || auth.token || auth.accessToken}`,
      },
      body: JSON.stringify({
        filename: filename,
        contentType: contentType,
        imageData: base64String,
      }),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error(
        `❌ S3 upload failed: ${uploadResponse.status} ${errorText}`
      );
      console.error("❌ S3 upload details:", {
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        headers: Object.fromEntries(uploadResponse.headers.entries()),
        errorBody: errorText,
        requestSize: base64String.length,
        contentType: contentType,
        filename: filename,
      });
      throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log("✅ Image uploaded to S3:", uploadResult);

    return uploadResult.imageUrl || uploadResult.url;
  } catch (error) {
    console.error("❌ Image download/upload failed:", error);
    console.error("❌ Error details:", {
      message: error.message,
      name: error.name,
      imageUrl: imageUrl,
      recipeTitle: recipeTitle,
    });

    // Report image processing error to diagnostic endpoint
    reportDiagnostic("image-processing-error", error, {
      imageUrl: imageUrl,
      recipeTitle: recipeTitle,
      failedAtStep: "download-or-upload",
    });

    return null;
  }
}

// Enhanced recipe validation to prevent empty submissions and provide helpful guidance
function isValidRecipePage(recipeData, pageUrl) {
  // Check for common non-recipe page patterns
  const nonRecipePatterns = [
    /\/(search|category|tag|author|about|contact|privacy|terms)/i,
    /\/(blog|news|articles)\/(?!.*recipe)/i,
    /\/(home|index|main)$/i,
    /^https?:\/\/[^/]+\/?$/, // Root domain homepages
    /\/(index\.(html?|php))(\?.*)?$/, // Index files
    /\/\?.*page=/i, // Pagination URLs
    /\/(categories?|tags?|search)\/[^/]*$/i, // Category/tag listing pages
  ];

  // Check if URL suggests this is not a recipe page
  if (pageUrl && nonRecipePatterns.some((pattern) => pattern.test(pageUrl))) {
    const urlParts = new URL(pageUrl);
    const siteName = urlParts.hostname.replace(/^www\./, "");
    showStatus(
      `❌ This appears to be a category or homepage. Please navigate to an actual recipe page on ${siteName} and try again.`,
      "#ffebee"
    );
    return false;
  }

  // Check if recipe data indicates this is not a recipe page
  if (
    recipeData.source === "no-recipe-found" ||
    recipeData.source === "extraction-error"
  ) {
    showStatus(
      "❌ No recipe found on this page. Please navigate to an actual recipe page and try again.",
      "#ffebee"
    );
    return false;
  }

  // Count meaningful content to detect empty/invalid recipes
  const hasTitle = recipeData.title && recipeData.title.trim().length > 3;
  const ingredientsCount = (recipeData.ingredients || []).filter(
    (i) =>
      (typeof i === "string" && i.trim().length > 2) ||
      (i && i.text && i.text.trim().length > 2)
  ).length;
  const instructionsCount = Math.max(
    (recipeData.instructions || []).filter(
      (i) =>
        (typeof i === "string" && i.trim().length > 5) ||
        (i && i.text && i.text.trim().length > 5)
    ).length,
    (recipeData.steps || []).filter(
      (i) =>
        (typeof i === "string" && i.trim().length > 5) ||
        (i && i.text && i.text.trim().length > 5)
    ).length
  );

  console.log("🔍 Recipe validation check:", {
    hasTitle,
    ingredientsCount,
    instructionsCount,
    title: recipeData.title,
    url: pageUrl,
  });

  // Provide specific guidance based on what's missing
  if (!hasTitle) {
    showStatus(
      "❌ No recipe title found. This may not be a recipe page, or the page format has changed.",
      "#ffebee"
    );
    return false;
  }

  if (ingredientsCount === 0) {
    showStatus(
      "❌ No ingredients found on this page. Please make sure you're on a recipe page with a clear ingredients list.",
      "#ffebee"
    );
    return false;
  }

  if (instructionsCount === 0) {
    showStatus(
      "❌ No cooking instructions found on this page. Please make sure you're on a recipe page with cooking steps.",
      "#ffebee"
    );
    return false;
  }

  // Check for minimum content threshold to avoid capturing incomplete recipes
  if (ingredientsCount < 2) {
    showStatus(
      "❌ Only found 1 ingredient - this may not be a complete recipe. Please check the page content.",
      "#ffebee"
    );
    return false;
  }

  if (instructionsCount < 2) {
    showStatus(
      "❌ Only found 1 instruction step - this may not be a complete recipe. Please check the page content.",
      "#ffebee"
    );
    return false;
  }

  console.log("✅ Recipe validation passed - proceeding with capture");
  return true;
}

async function captureRecipe() {
  if (!isSignedIn) {
    showStatus("❌ Please sign in first", "#ffebee");
    return;
  }

  showStatus("📝 Capturing recipe from page...", "#e7f3ff");

  let tab;
  try {
    // Get the active tab
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    tab = activeTab;

    if (!tab) {
      showStatus("❌ Cannot access current tab", "#ffebee");
      return;
    }

    // Check if the current site is supported
    if (
      typeof window.RecipeArchiveSites !== "undefined" &&
      !window.RecipeArchiveSites.isSupportedSite(tab.url)
    ) {
      const supportedSites = window.RecipeArchiveSites.getSupportedSites();
      showStatus(
        `❌ This site is not supported. Supported sites include: ${supportedSites.slice(0, 3).join(", ")}, and ${supportedSites.length - 3} more.`,
        "#ffebee"
      );
      return;
    }

    // Use content script message system to leverage TypeScript parsers
    showStatus("🔍 Extracting recipe...", "#e3f2fd");

    // First, try to ping the content script to see if it's already loaded
    let response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action: "ping" }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ status: "error", needsInjection: true });
        } else {
          resolve(response || { status: "error", needsInjection: true });
        }
      });
    });

    // If content script isn"t responding, try to inject it manually
    if (response.needsInjection || response.status === "error") {
      console.log("🔧 Content script not responding, injecting manually...");
      showStatus("🔧 Loading parser system...", "#e3f2fd");

      try {
        // Check if we can inject into this tab (some pages are restricted)
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["typescript-parser-bundle.js", "content.js"],
        });

        // Wait for injection to complete
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log("✅ Content script injected successfully");
      } catch (injectionError) {
        console.error("❌ Cannot inject content script:", injectionError);
        showStatus("❌ Cannot capture recipe from this page", "#ffebee");
        return;
      }
    }

    // Now send the capture message
    response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tab.id,
        { action: "captureRecipe" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Content script communication error:",
              chrome.runtime.lastError
            );
            resolve({
              status: "error",
              error: chrome.runtime.lastError.message,
            });
          } else {
            resolve(response);
          }
        }
      );
    });

    if (response.status === "error") {
      console.error("Content script error:", response.error);
      showStatus("❌ Error communicating with content script", "#ffebee");
      return;
    }

    const results = [{ result: response.data }];
    if (!results || !results[0] || !results[0].result) {
      showStatus("❌ Could not extract recipe data", "#ffebee");
      // Fallback: submit to failed-parse API
      await submitFallbackParse(tab);
      return;
    }

    const recipeData = results[0].result;
    console.log("📝 Extracted recipe data:", recipeData);

    // Enhanced validation: Check if we're on a recipe page before processing
    if (!isValidRecipePage(recipeData, tab.url)) {
      return;
    }

    // Download and replace image URL with S3 URL
    // Priority: rawImageUrl (from content script) > existing fields
    let originalImageUrl =
      recipeData.rawImageUrl || recipeData.image || recipeData.imageUrl;

    // Check for photos array (common in parser output)
    if (
      !originalImageUrl &&
      recipeData.photos &&
      Array.isArray(recipeData.photos) &&
      recipeData.photos.length > 0
    ) {
      originalImageUrl = recipeData.photos[0]; // Use first photo
    }

    if (originalImageUrl) {
      showStatus("🖼️ Downloading recipe image...", "#e7f3ff");
      try {
        const imageResult = await downloadAndUploadImage(
          originalImageUrl,
          recipeData.title
        );

        if (typeof imageResult === "string") {
          // Normal case - got S3 URL back
          recipeData.mainPhotoUrl = imageResult;
          recipeData.imageUrl = imageResult; // Keep for compatibility
          recipeData.image = imageResult; // Keep for compatibility
          console.log("✅ Image uploaded to S3:", imageResult);
        } else {
          console.warn(
            "⚠️ Failed to upload image to S3. No image will be included due to CORS restrictions."
          );
        }
      } catch (imageError) {
        console.log("ℹ️ Image processing skipped:", imageError.message);
        // No image will be included - this is expected for CORS restrictions
      }
    }

    // Debug: log recipe data structure
    console.log("🔍 DEBUG: Recipe data structure:", {
      hasIngredients: !!recipeData.ingredients,
      ingredientsLength: recipeData.ingredients?.length || 0,
      hasInstructions: !!recipeData.instructions,
      instructionsLength: recipeData.instructions?.length || 0,
      hasSteps: !!recipeData.steps,
      stepsLength: recipeData.steps?.length || 0,
      source: recipeData.source,
    });

    // Fallback logic: check for missing ingredients/instructions
    const missingIngredients =
      !recipeData.ingredients || recipeData.ingredients.length === 0;
    const missingInstructions =
      (!recipeData.instructions || recipeData.instructions.length === 0) &&
      (!recipeData.steps || recipeData.steps.length === 0);

    console.log("🔍 DEBUG: Fallback conditions:", {
      missingIngredients,
      missingInstructions,
      willFallback: missingIngredients || missingInstructions,
    });

    if (missingIngredients || missingInstructions) {
      // Don"t submit non-recipe pages to backend - they clutter the database
      if (
        recipeData.source === "no-recipe-found" ||
        recipeData.source === "extraction-error"
      ) {
        showStatus(
          "❌ This page doesn't contain a recipe. Please navigate to a recipe page.",
          "#ffebee"
        );
        return;
      }

      // Only use fallback for pages that look like recipes but had parsing issues
      showStatus(
        "❌ Recipe extraction incomplete. Attempting fallback...",
        "#ffebee"
      );
      await submitFallbackParse(tab, recipeData);
      // TODO: Post-MVP: Allow manual copy/paste fallback for failed extractions
      return;
    }

    if (!recipeData.title) {
      showStatus(
        "❌ No recipe found on this page. Please navigate to a recipe page.",
        "#ffebee"
      );
      return;
    }

    // Capture full page HTML for OpenAI analysis
    showStatus("📄 Capturing page content...", "#e3f2fd");
    const html = await new Promise((resolve) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: () => document.documentElement.outerHTML,
        },
        (results) => {
          resolve(
            results && results[0] && results[0].result ? results[0].result : ""
          );
        }
      );
    });
    console.log("🔧 Captured HTML length:", html.length);

    // Send to AWS backend with full HTML context
    showStatus("☁️ Saving to AWS...", "#e7f3ff");
    console.log("🔧 About to call sendToAWSBackend with data:", recipeData);
    const result = await sendToAWSBackend(
      recipeData,
      tab && tab.url ? tab.url : "unknown",
      html
    );
    console.log("🔧 sendToAWSBackend result:", result);

    if (result.success) {
      if (result.id) {
        showStatus(`✅ Saved to AWS! Recipe ID: ${result.id}`, "#d4edda");
      } else {
        showStatus("✅ Recipe saved successfully!", "#e8f5e8");
      }
    } else {
      console.error("❌ AWS save failed:", result.error);
      showStatus("❌ Failed to save: " + result.error, "#ffebee");
    }
  } catch (error) {
    console.error("❌ Recipe capture error:", error);
    showStatus("❌ Capture failed: " + error.message, "#ffebee");
    // Submit diagnostic data for parsing failures
    await submitDiagnosticData({
      error: error.message,
      errorType: "recipe_capture_failed",
      url: tab && tab.url ? tab.url : "unknown",
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      stage: "recipe_capture",
    });
  }
}

// Fallback: submit page HTML and metadata to failed-parse API
async function submitFallbackParse(tab, recipeData = {}) {
  try {
    showStatus("🔍 Submitting fallback parse request...", "#e3f2fd");
    const diagnosticsEndpoint = CONFIG.getCurrentAPI().diagnostics;
    const html = await new Promise((resolve) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: () => document.documentElement.outerHTML,
        },
        (results) => {
          resolve(
            results && results[0] && results[0].result ? results[0].result : ""
          );
        }
      );
    });
    const payload = {
      url: tab.url,
      html,
      userAgent: navigator.userAgent,
      extensionVersion: chrome.runtime.getManifest().version,
      extractionAttempt: {
        method:
          recipeData && recipeData._extractionMethod
            ? recipeData._extractionMethod
            : "unknown",
        timeElapsed:
          recipeData && recipeData._extractionTime
            ? recipeData._extractionTime
            : 0,
        elementsFound: {},
        partialData: recipeData || {},
      },
      timestamp: new Date().toISOString(),
      failureReason: "Incomplete extraction",
    };
    // Get auth token for API request
    const auth = JSON.parse(localStorage.getItem("recipeArchive.auth") || "{}");

    const response = await fetch(diagnosticsEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.idToken || auth.token || auth.accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      showStatus("📊 Fallback parse request submitted.", "#d4edda");
    } else {
      showStatus("⚠️ Fallback parse submission failed.", "#ffebee");
    }
  } catch (error) {
    showStatus("⚠️ Fallback parse error: " + error.message, "#ffebee");
  }
}

function transformRecipeDataForAWS(recipeData, currentUrl = null) {
  // Transform Chrome extension format to AWS backend expected format
  const ingredients = [];
  const instructions = [];

  // DEBUG: Log the actual structure we're receiving
  console.log(
    "🔧 RAW recipeData structure:",
    JSON.stringify(recipeData, null, 2)
  );
  console.log(
    "🔧 recipeData.ingredients type:",
    typeof recipeData.ingredients,
    recipeData.ingredients
  );
  console.log(
    "🔧 recipeData.steps type:",
    typeof recipeData.steps,
    recipeData.steps
  );
  console.log(
    "🔧 recipeData.instructions type:",
    typeof recipeData.instructions,
    recipeData.instructions
  );

  // Transform ingredients - Handle multiple format variations
  // 1. Flat strings: ["text1", "text2"] -> AWS format: [{ text: "text1" }, { text: "text2" }]
  // 2. Object format: [{ text: "text1" }, { text: "text2" }] -> AWS format: [{ text: "text1" }, { text: "text2" }]
  // 3. Grouped format: [{ title: null, items: [...] }] -> AWS format: [{ text: "text1" }, ...]
  if (recipeData.ingredients && Array.isArray(recipeData.ingredients)) {
    recipeData.ingredients.forEach((item) => {
      if (item && typeof item === "string" && item.trim()) {
        // Format 1: Flat format - direct string
        ingredients.push({ text: item.trim() });
      } else if (
        item &&
        item.text &&
        typeof item.text === "string" &&
        item.text.trim()
      ) {
        // Format 2: Already has text property - pass through
        ingredients.push({ text: item.text.trim() });
      } else if (item && item.items && Array.isArray(item.items)) {
        // Format 3: Grouped format - extract from items array
        item.items.forEach((subItem) => {
          if (subItem && subItem.text && subItem.text.trim()) {
            ingredients.push({ text: subItem.text.trim() });
          } else if (typeof subItem === "string" && subItem.trim()) {
            ingredients.push({ text: subItem.trim() });
          }
        });
      }
    });
  }

  // Transform instructions - Handle multiple format variations
  // 1. Flat strings: ["step1", "step2"] -> AWS format: [{ stepNumber: 1, text: "step1" }, ...]
  // 2. Object format: [{ stepNumber: 1, text: "step1" }] -> AWS format: [{ stepNumber: 1, text: "step1" }]
  // 3. Grouped format: [{ title: null, items: [...] }] -> AWS format: [{ stepNumber: 1, text: "step1" }, ...]
  if (recipeData.instructions && Array.isArray(recipeData.instructions)) {
    recipeData.instructions.forEach((item, index) => {
      if (item && typeof item === "string" && item.trim()) {
        // Format 1: Flat format - direct string
        instructions.push({
          stepNumber: index + 1,
          text: item.trim(),
        });
      } else if (
        item &&
        item.text &&
        typeof item.text === "string" &&
        item.text.trim()
      ) {
        // Format 2: Already has text property - pass through (preserve or assign stepNumber)
        instructions.push({
          stepNumber: item.stepNumber || instructions.length + 1,
          text: item.text.trim(),
        });
      } else if (item && item.items && Array.isArray(item.items)) {
        // Format 3: Grouped format - extract from items array
        item.items.forEach((subItem, _subIndex) => {
          if (subItem && subItem.text && subItem.text.trim()) {
            instructions.push({
              stepNumber: instructions.length + 1,
              text: subItem.text.trim(),
            });
          } else if (typeof subItem === "string" && subItem.trim()) {
            instructions.push({
              stepNumber: instructions.length + 1,
              text: subItem.trim(),
            });
          }
        });
      }
    });
  }

  // Also handle `steps` field (TypeScript parser uses this field name)
  if (recipeData.steps && Array.isArray(recipeData.steps)) {
    recipeData.steps.forEach((item, _index) => {
      if (item && typeof item === "string" && item.trim()) {
        // Flat format - direct string
        instructions.push({
          stepNumber: instructions.length + 1,
          text: item.trim(),
        });
      } else if (item && item.items && Array.isArray(item.items)) {
        // Grouped format - extract from items array
        item.items.forEach((subItem, _subIndex) => {
          if (subItem && subItem.text && subItem.text.trim()) {
            instructions.push({
              stepNumber: instructions.length + 1,
              text: subItem.text.trim(),
            });
          } else if (typeof subItem === "string" && subItem.trim()) {
            instructions.push({
              stepNumber: instructions.length + 1,
              text: subItem.trim(),
            });
          }
        });
      }
    });
  }

  // Build the AWS-compatible recipe data with only required fields
  const transformedData = {
    title: recipeData.title || "Unknown Recipe",
    ingredients: ingredients,
    instructions: instructions,
    sourceUrl: recipeData.source || recipeData.url || recipeData.sourceUrl,
  };

  // Add image if available (from either imageUrl or mainPhotoUrl)
  const imageUrl = recipeData.mainPhotoUrl || recipeData.imageUrl;
  if (imageUrl && imageUrl.trim()) {
    transformedData.mainPhotoUrl = imageUrl.trim();
  }

  // Only add optional fields if they have valid values
  if (recipeData.servingSize) {
    const servings = parseInt(recipeData.servingSize);
    if (servings && servings > 0) {
      transformedData.servings = servings;
    }
  }

  if (recipeData.cookTime) {
    // Try to parse time strings to minutes
    const timeStr = recipeData.cookTime.toString().toLowerCase();
    if (timeStr.includes("min")) {
      const minutes = parseInt(timeStr.match(/\d+/)?.[0]);
      if (minutes && minutes > 0) {
        transformedData.totalTimeMinutes = minutes;
      }
    }
  }

  // Ensure sourceUrl is a valid URL - AWS backend validates this
  try {
    new URL(transformedData.sourceUrl);
  } catch {
    // If the sourceUrl is invalid, use current page URL as fallback
    transformedData.sourceUrl = currentUrl || "unknown";
  }

  console.log("🔧 Transformed ingredients:", ingredients.length, "items");
  console.log("🔧 Transformed instructions:", instructions.length, "steps");

  // Validate required fields for AWS backend
  if (!transformedData.title || transformedData.title.trim() === "") {
    throw new Error("Recipe title is required");
  }

  // Validate that we actually found recipe content
  if (ingredients.length === 0) {
    throw new Error(
      "No ingredients found on this page. This may not be a recipe page, or the page format has changed."
    );
  }

  if (instructions.length === 0) {
    throw new Error(
      "No cooking instructions found on this page. This may not be a recipe page, or the page format has changed."
    );
  }

  if (!transformedData.sourceUrl) {
    throw new Error("Source URL is required");
  }

  return transformedData;
}

async function sendToAWSBackend(
  recipeData,
  currentUrl = "unknown",
  pageHtml = ""
) {
  console.log("🔧 sendToAWSBackend called with:", recipeData);
  console.log("🔧 HTML context length:", pageHtml.length);

  try {
    const authData = localStorage.getItem("recipeArchive.auth");
    console.log("🔧 Retrieved auth data:", authData ? "exists" : "null");
    // Auth data retrieved from storage

    if (!authData) {
      console.error("❌ No auth data found in localStorage");
      return { success: false, error: "No authentication token found" };
    }

    const auth = JSON.parse(authData);
    console.log("🔧 Parsed auth data:", auth);
    console.log("🔧 Parsed auth data structure:", {
      hasToken: !!auth.token,
      hasAccessToken: !!auth.accessToken,
      hasIdToken: !!auth.idToken,
      tokenPreview: auth.token ? auth.token.substring(0, 50) + "..." : "null",
      idTokenPreview: auth.idToken
        ? auth.idToken.substring(0, 50) + "..."
        : "null",
      accessTokenPreview: auth.accessToken
        ? auth.accessToken.substring(0, 50) + "..."
        : "null",
      allKeys: Object.keys(auth),
    });

    // Validate and select the best JWT token
    const userToken = auth.idToken || auth.token || auth.accessToken;

    if (!userToken) {
      console.error("❌ No JWT token found in auth data");
      return { success: false, error: "No authentication token found" };
    }

    // Extract and log user information from JWT token
    try {
      const tokenParts = userToken.split(".");
      const payload = JSON.parse(atob(tokenParts[1]));
      console.log("🔧 JWT Token payload:", {
        email: payload.email,
        sub: payload.sub,
        username: payload["cognito:username"],
      });
    } catch (e) {
      console.warn("Could not decode JWT token payload:", e);
    }

    // Sending recipe data to AWS backend

    // Transform data to match AWS backend expected format
    let transformedData;
    try {
      transformedData = transformRecipeDataForAWS(recipeData, currentUrl);

      // Add full page HTML for OpenAI context analysis
      if (pageHtml && pageHtml.length > 0) {
        transformedData.webArchiveHtml = pageHtml;
        console.log(
          "🔧 Added page HTML context:",
          pageHtml.length,
          "characters"
        );
      }

      console.log("🔧 Transformed recipe data for AWS:", transformedData);
      console.log(
        "🔧 JSON payload being sent (without HTML):",
        JSON.stringify(
          {
            ...transformedData,
            pageHtml: pageHtml ? `[${pageHtml.length} chars]` : undefined,
          },
          null,
          2
        )
      );
    } catch (transformError) {
      console.error("❌ Recipe transformation failed:", transformError);

      // Submit diagnostic data for transformation failures
      await submitDiagnosticData({
        error: transformError.message,
        errorType: "recipe_transformation_failed",
        url: currentUrl,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        stage: "data_transformation",
        rawRecipeData: recipeData,
      });

      return {
        success: false,
        error: `Recipe parsing failed: ${transformError.message}`,
      };
    }

    // Use the correct API endpoint from CONFIG
    const apiEndpoint = CONFIG.getCurrentAPI().recipes;
    console.log("🔧 Using API endpoint:", apiEndpoint);

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(transformedData),
    });

    console.log("🔧 AWS Response status:", response.status);
    console.log(
      "🔧 AWS Response headers:",
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ AWS API Error:", errorText);

      // Capture diagnostic data for 500 errors
      if (response.status === 500) {
        const diagnosticData = {
          timestamp: new Date().toISOString(),
          errorType: "HTTP_500_AFTER_JWT_FIX",
          httpStatus: response.status,
          errorMessage: errorText,
          url: currentUrl,
          userAgent: navigator.userAgent,
          tokenInfo: {
            hasIdToken: !!auth.idToken,
            hasToken: !!auth.token,
            hasAccessToken: !!auth.accessToken,
            idTokenSegments: auth.idToken ? auth.idToken.split(".").length : 0,
            tokenSegments: auth.token ? auth.token.split(".").length : 0,
            accessTokenSegments: auth.accessToken
              ? auth.accessToken.split(".").length
              : 0,
            selectedToken: userToken
              ? userToken.substring(0, 50) + "..."
              : "none",
          },
          headers: Object.fromEntries(response.headers.entries()),
        };

        // Send to S3 diagnostic bucket
        try {
          await fetch(
            "https://recipe-storage-0ea7007d57f67ecb-990537043943.s3.amazonaws.com/web-extension-errors/",
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(diagnosticData),
            }
          );
          console.log("📊 Diagnostic data sent to S3");
        } catch (diagError) {
          console.warn("Failed to send diagnostic data:", diagError);
        }
      }

      // Handle token expiration (401) with automatic refresh
      if (response.status === 401 && errorText.includes("expired")) {
        console.log("🔄 Token expired, attempting to refresh...");
        const refreshResult = await refreshAuthToken();

        if (refreshResult.success) {
          console.log("✅ Token refreshed successfully, retrying request...");
          // Retry the original request with new token
          const newAuth = JSON.parse(
            localStorage.getItem("recipeArchive.auth")
          );

          // Find valid token from refreshed auth data
          let retryToken = null;
          const jwtValidator = new JWTValidator(); // Instantiate JWTValidator
          const retryTokenOptions = [
            newAuth.idToken,
            newAuth.token,
            newAuth.accessToken,
          ];
          for (const token of retryTokenOptions) {
            if (jwtValidator.validateJWT(token).valid) {
              // Use JWTValidator.validateJWT
              retryToken = token;
              break;
            }
          }

          if (!retryToken) {
            console.error("❌ No valid token after refresh");
            return {
              success: false,
              error: "Token refresh failed - no valid token",
            };
          }

          const retryResponse = await fetch(apiEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${retryToken}`,
            },
            body: JSON.stringify(transformedData),
          });

          if (retryResponse.ok) {
            const retryResult = await retryResponse.json();
            console.log(
              "✅ Retry successful after token refresh:",
              retryResult
            );
            return { success: true, data: retryResult };
          } else {
            const retryErrorText = await retryResponse.text();
            console.error(
              "❌ Retry failed even after token refresh:",
              retryErrorText
            );
            return {
              success: false,
              error: `HTTP ${retryResponse.status}: ${retryErrorText}`,
            };
          }
        } else {
          console.error("❌ Token refresh failed:", refreshResult.error);
          // Clear invalid auth and force re-login
          isSignedIn = false;
          localStorage.removeItem("recipeArchive.auth");
          renderUI();
          return {
            success: false,
            error: "Session expired. Please sign in again.",
          };
        }
      }

      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const result = await response.json();
    console.log("✅ AWS Response:", result);
    return { success: true, data: result };
  } catch (error) {
    console.error("❌ AWS backend error:", error);

    // Send comprehensive diagnostic data for all exceptions
    let diagnosticData;
    try {
      diagnosticData = {
        timestamp: new Date().toISOString(),
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        context: {
          url: currentUrl,
          userAgent: navigator.userAgent,
          extensionVersion:
            chrome?.runtime?.getManifest?.()?.version || "unknown",
          recipeDataSize: JSON.stringify(recipeData || {}).length,
          pageHtmlSize: pageHtml?.length || 0,
        },
        authState: (() => {
          const authStr = localStorage.getItem("recipeArchive.auth") || "{}";
          let auth = {};
          let parseSuccess = true;

          try {
            auth = JSON.parse(authStr);
          } catch {
            parseSuccess = false;
          }

          if (!parseSuccess) {
            return { error: "Failed to parse auth data" };
          }

          return {
            hasIdToken: !!auth.idToken,
            hasToken: !!auth.token,
            hasAccessToken: !!auth.accessToken,
            idTokenLength: auth.idToken?.length || 0,
            tokenLength: auth.token?.length || 0,
            accessTokenLength: auth.accessToken?.length || 0,
          };
        })(),
      };

      await submitDiagnosticData(diagnosticData);
      console.log("📊 Exception diagnostic data sent");
    } catch (diagError) {
      console.warn("Failed to send exception diagnostic data:", diagError);
    }

    return {
      success: false,
      error: `AWS connection failed: ${error.message}`,
    };
  }
}

function showStatus(message, backgroundColor) {
  const statusDiv = document.getElementById("status");
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.style.background = backgroundColor;
    statusDiv.style.display = "block";
  }
}

// Submit diagnostic data to AWS backend for debugging parsing failures
async function submitDiagnosticData(diagnosticPayload) {
  try {
    const diagnosticsEndpoint = CONFIG.getCurrentAPI().diagnostics;
    console.log("🔍 Submitting diagnostic data to:", diagnosticsEndpoint);
    console.log("🔍 Diagnostic payload:", diagnosticPayload);

    // Add platform information and wrap in errors array format
    const diagnosticData = {
      ...diagnosticPayload,
      extension: "chrome",
      platform: "chrome",
      context: "popup",
      userAgent: navigator.userAgent,
      timestamp: diagnosticPayload.timestamp || new Date().toISOString(),
    };

    const requestPayload = { errors: [diagnosticData] };

    // Get auth token for diagnostics endpoint
    let authHeaders = { "Content-Type": "application/json" };
    try {
      const authData = localStorage.getItem("recipeArchive.auth");
      if (authData) {
        const auth = JSON.parse(authData);

        const token = auth.idToken || auth.token || auth.accessToken;
        if (token) {
          authHeaders["Authorization"] = `Bearer ${token}`;
        }
      }
    } catch (error) {
      console.warn(
        "⚠️ Could not get auth token for diagnostics:",
        error.message
      );
    }

    const response = await fetch(diagnosticsEndpoint, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(requestPayload),
    });

    if (response.ok) {
      const result = await response.json();
      console.log("📊 Diagnostic data submitted successfully:", result);
    } else {
      console.warn(
        "⚠️ Diagnostic submission failed:",
        response.status,
        await response.text()
      );
    }
  } catch (error) {
    console.warn("⚠️ Failed to submit diagnostic data:", error.message);
    // Don"t throw - diagnostic submission failures shouldn"t break the main flow
  }
}
