#!/usr/bin/env node
/**
 * Test recipe parser with real URLs
 *
 * Usage: node tools/test-parser.mjs <URL>
 * Example: node tools/test-parser.mjs https://www.laurainthekitchen.com/recipes/stuffed-peppers/
 */

import fetch from "node-fetch";
import * as cheerio from "cheerio";
import * as fs from "fs";

// Parser code inline (adapted from laurainthekitchen.com.ts)
class LauraInTheKitchenParser {
  canParse(url) {
    return url.includes("laurainthekitchen.com/recipes");
  }

  sanitizeText(text) {
    if (!text) return "";
    return text.trim().replace(/\s+/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  }

  async parse(html, url) {
    const $ = cheerio.load(html);

    // Fallback to HTML scraping
    const title = this.sanitizeText($(".cs-page-title h1").first().text());
    const author = "Laura Vitale";
    const imageUrl = $("meta[property=\"og:image\"]").attr("content") || "";

    // Parse prep and cook time from recipe details
    let prepTime;
    let cookTime;
    let totalTime;
    let servings = "";

    $(".cs-recipe-details > div").each((_, el) => {
      const fullText = $(el).text();
      const spanText = $(el).find("span").text().toLowerCase();

      if (spanText.includes("preparation")) {
        const match = fullText.match(/(\d+)\s*minutes?/i);
        if (match) prepTime = `PT${match[1]}M`;
      } else if (spanText.includes("cook")) {
        const match = fullText.match(/(\d+)\s*(hours?)?\s*(\d+)?\s*minutes?/i);
        if (match) {
          const hours = match[1] ? parseInt(match[1], 10) : 0;
          const mins = match[3] ? parseInt(match[3], 10) : 0;
          cookTime = hours > 0 ? `PT${hours}H${mins}M` : `PT${mins}M`;
        }
      } else if (spanText.includes("servings")) {
        servings = fullText.replace(/servings/i, "").trim();
      }
    });

    // Calculate total time if we have prep and cook
    if (prepTime && cookTime) {
      const prepMins = prepTime.match(/PT(\d+)M/) ? parseInt(RegExp.$1, 10) : 0;
      const cookMatch = cookTime.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
      const cookHours = cookMatch && cookMatch[1] ? parseInt(cookMatch[1], 10) : 0;
      const cookMins = cookMatch && cookMatch[2] ? parseInt(cookMatch[2], 10) : 0;
      const totalMins = prepMins + (cookHours * 60) + cookMins;
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      totalTime = hours > 0 ? `PT${hours}H${mins}M` : `PT${mins}M`;
    }

    // Parse ingredients
    const ingredients = [];
    $(".cs-ingredients-check-list li").each((_, el) => {
      const text = this.sanitizeText($(el).text());
      if (text) {
        ingredients.push({ text });
      }
    });

    // Parse instructions
    const instructions = [];
    const instructionText = $(".cs-recipe-single-preparation ul").text();
    // Instructions are separated by numbers like "1)", "2)", etc.
    const steps = instructionText.split(/\d+\)/).filter(s => s.trim().length > 0);
    steps.forEach((step, idx) => {
      const text = this.sanitizeText(step);
      if (text) {
        instructions.push({ stepNumber: idx + 1, text });
      }
    });

    return {
      title,
      source: url,
      author,
      imageUrl: imageUrl || undefined,
      prepTime,
      cookTime,
      totalTime,
      servings: servings || undefined,
      ingredients,
      instructions,
    };
  }
}

async function testParser(url) {
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

  // Save HTML for debugging
  fs.writeFileSync("tools/fetched-html.html", html);
  console.log("💾 HTML saved to tools/fetched-html.html for inspection");

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
  console.error("Usage: node tools/test-parser.mjs <URL>");
  console.error("Example: node tools/test-parser.mjs https://www.laurainthekitchen.com/recipes/stuffed-peppers/");
  process.exit(1);
}

testParser(url).catch((error) => {
  console.error("\n❌ Error:", error.message);
  console.error(error.stack);
  process.exit(1);
});
