// Content script that runs on all web pages
// Extracts HTML and sends to popup/background script

console.log('RecipeArchive content script loaded');

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractHTML') {
    console.log('Extracting HTML from page...');

    try {
      // Get the full HTML content
      const html = document.documentElement.outerHTML;
      const url = window.location.href;
      const title = document.title;

      // Try to extract recipe schema (if available)
      const recipeSchema = extractRecipeSchema();

      sendResponse({
        success: true,
        data: {
          html: html,
          url: url,
          title: title,
          recipeSchema: recipeSchema,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Error extracting HTML:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  // Return true to indicate async response
  return true;
});

// Extract structured recipe data if available (JSON-LD)
function extractRecipeSchema() {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);

        // Handle single schema or array of schemas
        const schemas = Array.isArray(data) ? data : [data];

        for (const schema of schemas) {
          if (schema['@type'] === 'Recipe' ||
              (Array.isArray(schema['@type']) && schema['@type'].includes('Recipe'))) {
            console.log('Found recipe schema!');
            return schema;
          }
        }
      } catch (e) {
        // Invalid JSON in script tag, skip
        continue;
      }
    }
  } catch (error) {
    console.warn('Error extracting recipe schema:', error);
  }

  return null;
}
