/* eslint-env node, browser */

/**
 * Washington Post Manual Testing Guide
 *
 * Since Washington Post has paywall restrictions, this provides instructions
 * for manual testing of the browser extension on actual recipe pages.
 */

console.log(`
🚀 WASHINGTON POST MANUAL TESTING GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 STEPS FOR MANUAL TESTING:

1. LOAD THE EXTENSION:
   - Chrome: Load unpacked extension from extensions/chrome/
   - Safari: Load extension from extensions/safari/

2. LOG INTO WASHINGTON POST:
   - Go to washingtonpost.com
   - Sign in with your subscription

3. FIND INDIVIDUAL RECIPE PAGES:
   - Go to Washington Post Food section
   - Look for individual recipe articles (not collection articles)
   - Individual recipes typically have URLs like:
     • /recipes/[recipe-name]/
     • Or are embedded within food articles

4. TEST THE EXTENSION:
   - Navigate to an individual recipe page
   - Click the RecipeArchive extension button
   - Check browser console for extraction logs
   - Verify ingredients and steps are captured

5. EXAMPLE RECIPE SEARCH TERMS:
   - "washington post chicken recipe"
   - "washington post pasta recipe"
   - Navigate through Food section articles

6. DEBUGGING:
   - Open browser DevTools (F12)
   - Check Console tab for extraction logs
   - Look for "RecipeArchive: Extracting Washington Post recipe..."
   - Verify JSON-LD or manual extraction results

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 WHAT TO LOOK FOR:
✅ Extension detects Washington Post site
✅ Finds ingredients list
✅ Finds instruction steps  
✅ Captures recipe title
✅ Console shows "SUCCESS" extraction

❌ COMMON ISSUES:
- Collection/roundup pages (no individual recipes)
- Paywall blocking content
- Recipe embedded in article text (not structured)

💡 TIP: Look for pages with visible ingredient lists and 
numbered/bulleted instruction steps for best testing.
`);

// Export the Washington Post parser logic for reference
const washingtonPostParserLogic = `
// Washington Post Parser Logic (from extensions)
function extractWashingtonPostRecipe() {
    console.log('Extracting Washington Post recipe...');
    
    // Try JSON-LD first
    const jsonLdResult = extractRecipeFromJsonLd();
    if (jsonLdResult && jsonLdResult.ingredients.length > 0 && jsonLdResult.steps.length > 0) {
        return jsonLdResult;
    }
    
    // Manual extraction
    const title = document.querySelector('h1')?.textContent?.trim() || 
                 document.querySelector('.headline')?.textContent?.trim() ||
                 document.querySelector('[data-qa="headline"]')?.textContent?.trim() ||
                 document.title;
    
    let ingredients = [];
    const ingredientSelectors = [
        '.recipe-ingredients li',
        '.ingredients li',
        '[data-testid="ingredients"] li',
        '.ingredient-list li',
        '[class*="ingredient"] li',
        '.wprecipe-ingredients li'
    ];
    
    // Try each selector until we find ingredients
    for (const selector of ingredientSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            const items = Array.from(elements)
                .map(el => el.textContent?.trim())
                .filter(text => text && text.length > 2);
            
            if (items.length > 0) {
                ingredients = [{ title: null, items }];
                console.log('Found ingredients with selector:', selector);
                break;
            }
        }
    }
    
    let steps = [];
    const stepSelectors = [
        '.recipe-instructions li',
        '.instructions li',
        '[data-testid="instructions"] li',
        '.directions li',
        '[class*="instruction"] li',
        '.wprecipe-instructions li',
        '.recipe-directions li'
    ];
    
    // Try each selector until we find steps
    for (const selector of stepSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            const items = Array.from(elements)
                .map(el => el.textContent?.trim())
                .filter(text => text && text.length > 15);
            
            if (items.length > 0) {
                steps = [{ title: null, items }];
                console.log('Found steps with selector:', selector);
                break;
            }
        }
    }
    
    return createRecipePayload(title, ingredients, steps, 'washingtonpost-manual');
}
`;

console.log('\n📋 PARSER LOGIC REFERENCE:');
console.log(
  'The extension uses this logic to extract Washington Post recipes:'
);
console.log(washingtonPostParserLogic);

console.log(`
🎯 NEXT STEPS:
1. Test the extension manually on Washington Post recipe pages
2. If recipes aren't found, check console logs for selector issues
3. Report back any specific recipe URLs that don't work
4. We can update selectors based on real Washington Post recipe page structures

✅ The Washington Post parser is ready - just needs real recipe pages to test on!
`);
