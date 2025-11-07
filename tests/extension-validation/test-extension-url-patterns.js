#!/usr/bin/env node

// Test the fixed URL pattern logic from the extensions
console.log("🔍 Testing Extension URL Pattern Logic");

// Import the fixed patterns
const nonRecipePatterns = [
  /\/(search|category|tag|author|about|contact|privacy|terms)/i,
  /\/(blog|news|articles)\/(?!.*recipe)/i,
  /\/(home|index|main)$/i,
  /^https?:\/\/[^/]+\/?$/, // Root domain homepages
  /\/(index\.(html?|php))(\?.*)?$/, // Index files
  /\/\?.*page=/i, // Pagination URLs
  /\/(categories?|tags?|search)\/[^/]*$/i, // Category/tag listing pages
];

// Test URLs that should be valid recipe pages
const validRecipeUrls = [
  "https://foodandwine.com/recipes/chicken-parmesan?utm_source=google&utm_medium=search",
  "https://allrecipes.com/recipe/123456/chocolate-chip-cookies?print=true",
  "https://smittenkitchen.com/2020/01/classic-beef-stew?ref=homepage",
  "https://food52.com/recipes/12345-apple-pie.html?source=newsletter",
  "https://seriouseats.com/recipes/2019/12/perfect-pizza-dough.php?campaign=social",
  "https://loveandlemons.com/vegetable-curry-recipe/?share=pinterest",
];

// Test URLs that should be invalid (non-recipe pages)
const invalidRecipeUrls = [
  "https://foodandwine.com/", // Homepage
  "https://foodandwine.com/index.html", // Homepage with index
  "https://allrecipes.com/search?q=chicken", // Search page
  "https://smittenkitchen.com/category/main-dishes", // Category page
  "https://food52.com/blog/how-to-cook-better", // Blog post
  "https://seriouseats.com/about", // About page
  "https://loveandlemons.com/?page=2", // Pagination
];

function testUrlPattern(url, shouldBeValid) {
  const isBlocked = nonRecipePatterns.some((pattern) => pattern.test(url));
  const isValid = !isBlocked;

  const result = isValid === shouldBeValid ? "✅ PASS" : "❌ FAIL";
  const status = isValid ? "VALID" : "BLOCKED";

  console.log(`${result} ${status}: ${url}`);

  if (isValid !== shouldBeValid) {
    console.log(
      `    Expected: ${shouldBeValid ? "VALID" : "BLOCKED"}, Got: ${status}`
    );
    const matchingPattern = nonRecipePatterns.find((pattern) =>
      pattern.test(url)
    );
    if (matchingPattern) {
      console.log(`    Matched pattern: ${matchingPattern}`);
    }
  }

  return isValid === shouldBeValid;
}

console.log("\n📝 Testing VALID recipe URLs (should pass):");
let passCount = 0;
let totalTests = 0;

validRecipeUrls.forEach((url) => {
  if (testUrlPattern(url, true)) passCount++;
  totalTests++;
});

console.log("\n🚫 Testing INVALID recipe URLs (should be blocked):");
invalidRecipeUrls.forEach((url) => {
  if (testUrlPattern(url, false)) passCount++;
  totalTests++;
});

console.log(`\n📊 Results: ${passCount}/${totalTests} tests passed`);

if (passCount === totalTests) {
  console.log(
    "✅ All URL pattern tests passed! Extensions should work correctly."
  );
  process.exit(0);
} else {
  console.log(
    "❌ Some URL pattern tests failed. Extensions may still have issues."
  );
  process.exit(1);
}
