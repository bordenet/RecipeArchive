// Fix Recipe Archive Extension Configuration TEMPLATE
// Run this in browser console on extension popup to set correct configuration
//
// USAGE: Copy this file to fix-config.js and replace placeholders with actual values

console.log("🔧 Fixing RecipeArchive Extension Configuration...");

// Set correct AWS Cognito configuration
localStorage.setItem("COGNITO_USER_POOL_ID", "YOUR_COGNITO_USER_POOL_ID");
localStorage.setItem("COGNITO_APP_CLIENT_ID", "YOUR_COGNITO_APP_CLIENT_ID");
localStorage.setItem("AWS_REGION", "us-west-2");
localStorage.setItem(
  "API_BASE_URL",
  "https://YOUR_API_GATEWAY_ID.execute-api.us-west-2.amazonaws.com/prod"
);

// Force production mode
localStorage.setItem("recipeArchive.dev", "false");

console.log(
  "✅ Configuration updated! Reload the extension popup to apply changes."
);
console.log("📋 Configuration set:");
console.log("   User Pool ID:", localStorage.getItem("COGNITO_USER_POOL_ID"));
console.log("   Client ID:", localStorage.getItem("COGNITO_APP_CLIENT_ID"));
console.log("   API Base:", localStorage.getItem("API_BASE_URL"));
console.log(
  "   Production Mode:",
  localStorage.getItem("recipeArchive.dev") === "false"
);
