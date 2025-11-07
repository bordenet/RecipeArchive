#!/usr/bin/env node
/**
 * Test script to validate API authentication
 * This will help us determine if the issue is with token generation or API validation
 */

const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");

// Configuration from .env file
const config = {
  region: "us-west-2",
  userPoolId: "us-west-2_rpBcEEhYK",
  clientId: "7lm8mqr03s0m0fn17dnv373s4h",
  apiUrl: "https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod/recipes",
  testEmail: "mattbordenet@hotmail.com",
  testPassword: process.env.TEST_USER_PASSWORD || "CHANGE_ME",
};

console.log("🔐 Testing RecipeArchive API Authentication");
console.log("==========================================");

async function testAuthentication() {
  try {
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
