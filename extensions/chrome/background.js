console.log("🎯 Minimal background script loaded");

// Global error handling for background script
const DIAGNOSTIC_ENDPOINT =
  "https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod/report-error";

// Diagnostic reporting function
async function reportDiagnostic(errorType, error, additionalData = {}) {
  try {
    const diagnosticData = {
      url: "chrome-extension-background",
      userAgent: navigator.userAgent,
      errorType,
      error: error?.message || error?.toString() || "Unknown error",
      timestamp: new Date().toISOString(),
      extension: "chrome",
      context: "background",
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
self.addEventListener("error", (event) => {
  console.error("🚨 Unhandled error in background:", event.error);
  reportDiagnostic("background-unhandled-error", event.error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
  event.preventDefault(); // Prevent error from reaching chrome://extensions
});

self.addEventListener("unhandledrejection", (event) => {
  console.error("🚨 Unhandled promise rejection in background:", event.reason);
  reportDiagnostic("background-unhandled-rejection", event.reason);
  event.preventDefault(); // Prevent error from reaching chrome://extensions
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ Minimal extension installed");
});
