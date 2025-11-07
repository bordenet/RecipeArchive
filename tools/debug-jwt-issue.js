// Debug script to help diagnose JWT issues in browser extension

console.log(`
🔍 JWT DEBUG HELPER
==================

If you're still getting HTTP 500 errors, please:

1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Try saving a recipe
4. Look for these specific messages:

✅ GOOD SIGNS:
- "🔧 Selected valid JWT token: ..."
- "🔧 JWT Token payload: {email: ..., sub: ...}"
- HTTP 200/201 response

❌ BAD SIGNS:
- "🔧 Invalid JWT token found (wrong segments): ..."
- "❌ No valid JWT token found in auth data"
- HTTP 500 response

5. Copy ALL console output and send to developer

EXTENSION VERSION CHECK:
========================
Open Extensions page (chrome://extensions) and verify:
- Extension version should show v0.3.3 or higher
- Extension should be the newly downloaded JWT-fix version

MANUAL JWT CHECK:
================
Run this in console to check your stored tokens:
`);

// Manual token validation function for console debugging
function _debugJWTTokens() {
  const authData = localStorage.getItem("recipeArchive.auth");
  if (!authData) {
    console.error("❌ No auth data found");
    return;
  }

  try {
    const auth = JSON.parse(authData);
    console.log("🔧 Auth object keys:", Object.keys(auth));

    const tokens = {
      idToken: auth.idToken,
      token: auth.token,
      accessToken: auth.accessToken,
    };

    console.log("🔧 Token status:");
    for (const [name, token] of Object.entries(tokens)) {
      if (!token) {
        console.log(`  ${name}: ❌ missing`);
        continue;
      }

      const parts = token.split(".");
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(atob(parts[1]));
          console.log(
            `  ${name}: ✅ valid (${token.substring(0, 20)}..., email: ${payload.email})`
          );
        } catch (_e) {
          console.log(
            `  ${name}: ❌ malformed payload (${token.substring(0, 20)}...)`
          );
        }
      } else {
        console.log(
          `  ${name}: ❌ wrong segments (${parts.length}) (${token.substring(0, 20)}...)`
        );
      }
    }
  } catch (e) {
    console.error("❌ Error parsing auth data:", e);
  }
}

console.log(`
Copy this function and run it in your browser console:

debugJWTTokens();

Then share the output with the developer.
`);
