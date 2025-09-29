// Simple Fetch-Based Authentication Test
// Run this in browser console to test authentication without extension complexity

console.log("🧪 Simple fetch-based authentication test starting...");

async function testSimpleAuth() {
  // Environment variables should be loaded by a script before this runs
  const clientId = "your-cognito-app-client-id";
  const username = process.env.RECIPE_TEST_USER;
  const password = process.env.RECIPE_TEST_PASS;

  if (!clientId || !username || !password) {
    console.error(
      "❌ Missing required environment variables. Make sure COGNITO_APP_CLIENT_ID, RECIPE_TEST_USER, and RECIPE_TEST_PASS are set in your .env file and loaded."
    );
    return;
  }

  const url = "https://cognito-idp.us-west-2.amazonaws.com/";

  const payload = {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  };

  const headers = {
    "Content-Type": "application/x-amz-json-1.1",
    "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
  };

  console.log("📤 Making fetch request to:", url);
  console.log("📋 Headers:", headers);
  console.log("📦 Payload (sensitive values redacted):", {
    ...payload,
    AuthParameters: {
      USERNAME: "[REDACTED]",
      PASSWORD: "[REDACTED]",
    },
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    console.log("📥 Response status:", response.status);
    console.log("📥 Response headers:", [...response.headers.entries()]);

    if (!response.ok) {
      const errorText = await response.text();
      console.log("❌ Error response body:", errorText);

      try {
        const errorData = JSON.parse(errorText);
        console.log("❌ Parsed error:", errorData);
      } catch (_e) {
        console.log("❌ Could not parse error as JSON");
      }

      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("✅ Success! Authentication result:", data);

    if (data.AuthenticationResult) {
      console.log(
        "🎉 Access token received:",
        data.AuthenticationResult.AccessToken ? "YES" : "NO"
      );
      console.log(
        "🎉 ID token received:",
        data.AuthenticationResult.IdToken ? "YES" : "NO"
      );
      console.log(
        "🎉 Refresh token received:",
        data.AuthenticationResult.RefreshToken ? "YES" : "NO"
      );
    }

    return data;
  } catch (error) {
    console.log("💥 Fetch failed:", error);
    console.log("💥 Error name:", error.name);
    console.log("💥 Error message:", error.message);
    console.log("💥 Error stack:", error.stack);
    throw error;
  }
}

// Run the test
testSimpleAuth()
  .then(() => console.log("🎉 Simple auth test completed successfully"))
  .catch((error) => console.log("💥 Simple auth test failed:", error));
