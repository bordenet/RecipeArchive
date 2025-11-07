#!/usr/bin/env ts-node
/**
 * Test recipe parser with real URLs
 *
 * Usage: npx ts-node tools/test-parser.ts <URL>
 * Example: npx ts-node tools/test-parser.ts https://www.laurainthekitchen.com/recipes/stuffed-peppers/
 */

import fetch from "node-fetch";
import { LauraInTheKitchenParser } from "../parsers/sites/laurainthekitchen.com.js";

async function testParser(url: string) {
  console.log(`\n🧪 Testing Recipe Parser: ${url}`);
  console.log("━".repeat(80));

  // Fetch HTML
  console.log("\n🌐 Fetching HTML...");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const html = await response.text();
  console.log(`✅ Fetched ${html.length} characters of HTML`);

  // Initialize parser
  const parser = new LauraInTheKitchenParser();

  // Check if parser can handle this URL
  if (!parser.canParse(url)) {
    console.log("\n❌ Parser cannot handle this URL");
    console.log("   URL must contain: 'laurainthekitchen.com/recipes'");
    process.exit(1);
  }

  // Parse the recipe
  console.log("\n🔍 Parsing recipe...");
  const recipe = await parser.parse(html, url);

  // Display results
  console.log("\n📊 Recipe Extraction Results:");
  console.log("━".repeat(80));
  console.log("✅ Recipe extraction successful!");
  console.log(`\n📋 Title: ${recipe.title}`);
  console.log(`👤 Author: ${recipe.author || "Not specified"}`);
  console.log(`🖼️  Image: ${recipe.imageUrl || "Not found"}`);
  console.log(`⏱️  Prep Time: ${recipe.prepTime || "Not specified"}`);
  console.log(`⏱️  Cook Time: ${recipe.cookTime || "Not specified"}`);
  console.log(`⏱️  Total Time: ${recipe.totalTime || "Not specified"}`);
  console.log(`🍽️  Servings: ${recipe.servings || "Not specified"}`);
  console.log(`\n🥘 Ingredients: ${recipe.ingredients.length} found`);
  recipe.ingredients.forEach((ing, idx) => {
    console.log(`   ${idx + 1}. ${ing.text}`);
  });
  console.log(`\n📖 Instructions: ${recipe.instructions.length} steps found`);
  recipe.instructions.forEach((inst) => {
    console.log(`   ${inst.stepNumber}. ${inst.text.substring(0, 80)}${inst.text.length > 80 ? "..." : ""}`);
  });

  // Save to file
  const fs = require("fs");
  const outputPath = "tools/test-parser-output.json";
  fs.writeFileSync(outputPath, JSON.stringify(recipe, null, 2));
  console.log(`\n💾 Full recipe data saved to: ${outputPath}`);

  // Summary
  console.log("\n" + "━".repeat(80));
  if (recipe.ingredients.length === 0) {
    console.log("⚠️  Warning: No ingredients found!");
  }
  if (recipe.instructions.length === 0) {
    console.log("⚠️  Warning: No instructions found!");
  }
  if (recipe.ingredients.length > 0 && recipe.instructions.length > 0) {
    console.log("✅ Parser working correctly!");
  }
}

// Main
const url = process.argv[2];
if (!url) {
  console.error("Usage: npx ts-node tools/test-parser.ts <URL>");
  console.error("Example: npx ts-node tools/test-parser.ts https://www.laurainthekitchen.com/recipes/stuffed-peppers/");
  process.exit(1);
}

testParser(url).catch((error) => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});
