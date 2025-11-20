#!/usr/bin/env node
/**
 * Test script to validate API authentication
 * This will help us determine if the issue is with token generation or API validation
 */

const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");

// Configuration from environment / .env file
const config = {
  region: process.env.AWS_REGION || "us-west-2",
  userPoolId: process.env.COGNITO_USER_POOL_ID || "",
  clientId: process.env.COGNITO_APP_CLIENT_ID || "",
  apiUrl: process.env.API_BASE_URL
    ? `${process.env.API_BASE_URL.replace(/\/$/, "")}/recipes`
    : "",
  testEmail: process.env.TEST_USER_EMAIL || "your-test-user@example.com",
  testPassword: process.env.TEST_USER_PASSWORD || "CHANGE_ME",
};

console.log("🔐 Testing RecipeArchive API Authentication");
console.log("==========================================");

async function testAuthentication() {
  try {
    if (!config.userPoolId || !config.clientId) {
      console.error(
        "❌ COGNITO_USER_POOL_ID and COGNITO_APP_CLIENT_ID must be set in your .env file for this test."
      );
      process.exit(1);
    }

    if (!config.apiUrl) {
      console.error(
        "❌ API_BASE_URL must be set in your .env file for this test (used to derive the recipes endpoint)."
      );
      process.exit(1);
    }

    if (!config.testEmail || !config.testPassword || config.testPassword === "CHANGE_ME") {
      console.error(
        "❌ TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in your .env file for this test."
      );
      process.exit(1);
    }
    // Configure AWS
    AWS.config.update({
      region: config.region,
    });

    const cognito = new AWS.CognitoIdentityServiceProvider();

    console.log("📧 Attempting authentication...");
    console.log(`   Email: ${config.testEmail}`);
    console.log(`   User Pool: ${config.userPoolId}`);

    // Authenticate with Cognito
    const authParams = {
      AuthFlow: "ADMIN_NO_SRP_AUTH",
      UserPoolId: config.userPoolId,
      ClientId: config.clientId,
      AuthParameters: {
        USERNAME: config.testEmail,
        PASSWORD: config.testPassword,
      },
    };

    const authResult = await cognito.adminInitiateAuth(authParams).promise();

    if (!authResult.AuthenticationResult) {
      throw new Error("Authentication failed - no result returned");
    }

    const { IdToken, _AccessToken, _RefreshToken } =
      authResult.AuthenticationResult;

    console.log("✅ Authentication successful!");

    // Decode and display token info
    const decoded = jwt.decode(IdToken);
    console.log(`   User ID: ${decoded.sub}`);
    console.log(`   Email: ${decoded.email}`);
    console.log(
      `   Token expires: ${new Date(decoded.exp * 1000).toISOString()}`
    );

    // Test API call
    console.log("\n🌐 Testing API call...");
    const fetch = require("node-fetch");

    const response = await fetch(config.apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${IdToken}`,
      },
    });

    console.log(
      `   Response Status: ${response.status} ${response.statusText}`
    );

    if (response.ok) {
      const data = await response.json();
      console.log(
        `✅ API call successful! Found ${data.recipes?.length || 0} recipes`
      );

      if (data.recipes?.length > 0) {
        console.log(`   First recipe: ${data.recipes[0].title}`);
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ API call failed: ${errorText}`);
    }
  } catch (error) {
    console.error("❌ Authentication test failed:", error.message);

    if (error.code) {
      console.error(`   AWS Error Code: ${error.code}`);
    }
  }
}

// Run the test
testAuthentication()
  .then(() => {
    console.log("\n==========================================");
    console.log("Authentication test completed");
  })
  .catch(console.error);
