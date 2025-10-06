// Auto-generated environment configuration
// This file is generated at build time - do not edit manually
const ENV_CONFIG = {
  "AWS_REGION": "us-west-2",
  "COGNITO_USER_POOL_ID": "us-west-2_rpBcEEhYK",
  "COGNITO_APP_CLIENT_ID": "7lm8mqr03s0m0fn17dnv373s4h",
  "API_BASE_URL": "https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod",
  "WEB_APP_URL": "https://d1jcaphz4458q7.cloudfront.net",
  "S3_BUCKET_NAME": "recipe-storage-0ea7007d57f67ecb-990537043943"
};

// Make it available globally for browser extensions
if (typeof window !== "undefined") {
  window.ENV_CONFIG = ENV_CONFIG;
}

// Export for module systems
if (typeof module !== "undefined" && module.exports) {
  module.exports = ENV_CONFIG;
}
