// Test Authentication Setup for RecipeArchive Extension
// Run this script in the browser console on the extension popup to set up working test credentials

console.log("🧪 Setting up test authentication credentials...");

// Environment variables should be loaded by a script before this runs
const email = process.env.RECIPE_TEST_USER;
const password = process.env.RECIPE_TEST_PASS;
const userPoolId = "your-cognito-user-pool-id";
const clientId = "your-cognito-app-client-id";
const apiBaseUrl =
  "https://your-api-gateway-id.execute-api.us-west-2.amazonaws.com/prod";

if (!email || !password || !userPoolId || !clientId || !apiBaseUrl) {
  console.error(
    "❌ Missing required environment variables. Make sure RECIPE_TEST_USER, RECIPE_TEST_PASS, COGNITO_USER_POOL_ID, COGNITO_APP_CLIENT_ID, and API_BASE_URL are set in your .env file and loaded."
  );
} else {
  // Set test credentials in localStorage for extension to use
  localStorage.setItem("test_email", email);
  localStorage.setItem("test_password", password);

  // Also ensure correct AWS configuration
  localStorage.setItem("COGNITO_USER_POOL_ID", userPoolId);
  localStorage.setItem("COGNITO_APP_CLIENT_ID", clientId);
  localStorage.setItem("AWS_REGION", "us-west-2");
  localStorage.setItem("API_BASE_URL", apiBaseUrl);
  localStorage.setItem("recipeArchive.dev", "false"); // Force production mode

  console.log("✅ Test credentials configured:");
  console.log("   Email:", email);
  console.log("   Password: [HIDDEN]");
  console.log("   User Pool:", localStorage.getItem("COGNITO_USER_POOL_ID"));
  console.log("   Client ID:", localStorage.getItem("COGNITO_APP_CLIENT_ID"));
  console.log("");
  console.log("🚀 Now try signing in with these credentials:");
  console.log(`   Email: ${email}`);
  console.log("   Password: (check .env file)");
  console.log("");
  console.log("📋 These credentials match the .env file and production user");
}
