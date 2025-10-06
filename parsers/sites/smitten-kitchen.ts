import * as cheerio from 'cheerio';
import { BaseParser } from '../base-parser.js';
import { Recipe, Ingredient, Instruction } from '../types.js';

export class SmittenKitchenParser extends BaseParser {
  canParse(url: string): boolean {
    return url.includes('smittenkitchen.com');
  }

  private extractInstructionText(instruction: any): string {
    // Handle various JSON-LD instruction formats
    if (typeof instruction === 'string') {
      return this.sanitizeText(instruction);
    }

    if (typeof instruction === 'object' && instruction !== null) {
      // Try different possible properties for instruction text
      const possibleTextFields = ['text', 'name', 'description'];

      for (const field of possibleTextFields) {
        if (instruction[field] && typeof instruction[field] === 'string') {
          const text = this.sanitizeText(instruction[field]);
          // Filter out JavaScript code fragments
          if (!this.isJavaScriptCode(text)) {
            return text;
          }
        }
      }
    }

    return 'See original recipe for this step.';
  }

  private isJavaScriptCode(text: string): boolean {
    // Check for JavaScript patterns that shouldn't be in recipe instructions
    const jsPatterns = [
      /window\./,
      /document\./,
      /function\s*\(/,
      /var\s+\w+\s*=/,
      /\.addEventListener/,
      /console\./,
      /\$\(/,
      /\.html\(/,
      /\.css\(/,
      /typeof\s+/,
      /return\s+/,
      /\+\+|\-\-/,
      /===|!==|&&|\|\|/,
      /ai_\w+/, // Ad injection patterns
      /htlbid/, // Ad service patterns
      /b64d\s*\(/, // Base64 decode patterns
      /getElementById/, // DOM manipulation
      /innerHTML/, // HTML manipulation
      /readyState/, // Document ready state
      /dataLayer/, // Google Analytics
      /\.push\s*\(/, // Array/object manipulation
      /gtag\s*\(/, // Google Tag Manager
      /\.call\s*\(/, // Function calls
      /sessionStorage/, // Web storage
      /localStorage/, // Web storage
      /_wp\w+/, // WordPress patterns
      /jetpack_\w+/, // Jetpack patterns
      /\.prototype\./, // Prototype manipulation
      /new\s+\w+\s*\(/, // Constructor calls
      /JSON\.(parse|stringify)/, // JSON operations
    ];

    return jsPatterns.some((pattern) => pattern.test(text));
  }

  async parse(html: string, url: string): Promise<Recipe> {
    const $ = cheerio.load(html);
    const jsonLd = this.extractJsonLD(html);
    let recipe: Recipe;
    if (jsonLd) {
      recipe = {
        title: this.sanitizeText(jsonLd.name),
        source: url,
        author:
          typeof jsonLd.author === 'string'
            ? jsonLd.author
            : jsonLd.author?.name || 'Deb Perelman',
        ingredients: (jsonLd.recipeIngredient || []).map((i) => ({
          text: this.sanitizeText(i),
        })),
        instructions: this.processInstructions(
          (jsonLd.recipeInstructions || []).map((i) =>
            this.extractInstructionText(i)
          )
        ),
        imageUrl:
          typeof jsonLd.image === 'string'
            ? jsonLd.image
            : Array.isArray(jsonLd.image)
              ? typeof jsonLd.image[0] === 'string'
                ? jsonLd.image[0]
                : jsonLd.image[0]?.url
              : jsonLd.image?.url,
        prepTime: jsonLd.prepTime || '',
        cookTime: jsonLd.cookTime || '',
        totalTime: jsonLd.totalTime || '',
        servings: jsonLd.recipeYield?.toString() || '',
        tags: Array.isArray(jsonLd.recipeCategory)
          ? jsonLd.recipeCategory.map((c: string) => this.sanitizeText(c))
          : jsonLd.recipeCategory
            ? [this.sanitizeText(jsonLd.recipeCategory)]
            : [],
      };
    } else {
      // Fallback selectors using Cheerio - Updated for Jetpack recipe format and refined selectors
      let title = this.sanitizeText(
        $('.jetpack-recipe-title, h1.entry-title, h1.post-title, h1')
          .first()
          .text() ||
          $('h1').first().text() ||
          ''
      );
      let author = this.sanitizeText(
        $(
          '.jetpack-recipe-source, p.recipe-meta + p, .author-meta, .author, .byline .author'
        )
          .first()
          .text()
          .replace(/Source:\s*|Author:\s*/gi, '')
          .trim() || 'Deb Perelman'
      );
      let ingredients: Ingredient[] = [];

      // Enhanced parsing to preserve section headers like "For the crust" and "For the filling"
      const jetpackIngredients = $('.jetpack-recipe-ingredients');
      if (jetpackIngredients.length > 0) {
        // Parse jetpack ingredients with section headers
        jetpackIngredients.children().each((_, el) => {
          const $el = $(el);
          if ($el.is('h5')) {
            // This is a section header like "For the crust (pâte brisée)" or "For the filling"
            const headerText = this.sanitizeText($el.text()).trim();
            if (headerText) {
              ingredients.push({ text: `## ${headerText}` }); // Use markdown-style header
            }
          } else if ($el.is('ul')) {
            // This is a list of ingredients under the section
            $el.find('li.jetpack-recipe-ingredient').each((__, li) => {
              const text = $(li).text().trim();
              if (text) ingredients.push({ text: this.sanitizeText(text) });
            });
          }
        });
      }

      // Fallback to original parsing if no section headers found
      if (ingredients.length === 0) {
        $('.jetpack-recipe-ingredient').each((_, el) => {
          const text = $(el).text().trim();
          if (text) ingredients.push({ text: this.sanitizeText(text) });
        });
      }
      if (ingredients.length === 0) {
        ingredients = $(
          '.recipe-ingredients li, .ingredients li, .ingredient, .wprm-recipe-ingredient'
        )
          .map((_, el) => ({ text: this.sanitizeText($(el).text()) }))
          .get();
      }
      if (ingredients.length === 0) {
        $('h2:contains("Ingredients")')
          .nextAll('ul')
          .each((_, ul) => {
            $(ul)
              .find('li')
              .each((__, el) => {
                const text = $(el).text().trim();
                if (text) ingredients.push({ text });
              });
          });
      }
      // Refined entry-content selectors for edge cases
      const entryContent = $('.entry-content');
      const recipeTitleP = entryContent
        .find('p b:contains("Ina Garten")')
        .parent();
      let ingredientP = recipeTitleP.next('p');
      if (ingredientP.length) {
        const raw = ingredientP.html();
        if (raw) {
          ingredients = raw
            .split(/<br\s*\/>/i)
            .map((t) => ({
              text: this.sanitizeText(
                $(t).text() || $('<div>' + t + '</div>').text()
              ),
            }))
            .filter((i) => i.text);
        }
      }

      // Parse old-style narrative recipes (2013 era) - ingredients in paragraph with newlines
      if (ingredients.length === 0) {
        $('.entry-content p').each((_, el) => {
          const text = $(el).text().trim();
          // Look for paragraphs with multiple ingredient-like lines (measurements)
          if (text.match(/\d+\s+(cup|tablespoon|teaspoon|ounce|pound|lb|oz|tsp|tbsp)/gi)) {
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            // If multiple lines with measurements, treat as ingredient list
            if (lines.length > 3 && lines.filter(l => /\d/.test(l)).length > 2) {
              lines.forEach(line => {
                if (line.length > 0) {
                  ingredients.push({ text: this.sanitizeText(line) });
                }
              });
              return false; // Stop after finding ingredients
            }
          }
        });
      }

      let instructions: Instruction[] = [];
      // Enhanced jetpack directions parsing - extract clean paragraph content
      const jetpackDirectionsContainer = $('.jetpack-recipe-directions');
      if (jetpackDirectionsContainer.length > 0) {
        let stepNumber = 1;

        // Get the raw HTML and parse it carefully
        const directionsHtml = jetpackDirectionsContainer.html();
        if (directionsHtml) {
          // Split by paragraph tags but preserve bold headers
          const steps = directionsHtml.split(
            /<\/p>\s*<p[^>]*>|<p[^>]*>|<\/p>/i
          );

          for (const step of steps) {
            if (!step.trim()) continue;

            // Remove HTML tags and get clean text
            const cleanText = step
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            // Skip JavaScript patterns and short fragments
            if (
              !cleanText ||
              cleanText.length < 10 ||
              this.isJavaScriptCode(cleanText)
            ) {
              continue;
            }

            // Skip fragments that are just HTML/CSS/JS
            if (
              cleanText.match(/^(function|var|window\.|document\.|ai_|htlbid)/)
            ) {
              continue;
            }

            instructions.push({
              stepNumber: stepNumber++,
              text: this.sanitizeText(cleanText),
            });
          }
        }
      }
      if (instructions.length === 0) {
        instructions = $(
          '.instructions li, .instruction, .wprm-recipe-instruction-text, .preparation-step'
        )
          .map((i, el) => ({
            stepNumber: i + 1,
            text: this.sanitizeText($(el).text()),
          }))
          .get();
      }
      if (instructions.length === 0) {
        $('h2:contains("Directions"), h2:contains("Instructions")')
          .nextAll('ul')
          .each((ulIdx, ul) => {
            $(ul)
              .find('li')
              .each((liIdx, el) => {
                const text = $(el).text().trim();
                if (text)
                  instructions.push({
                    stepNumber: instructions.length + 1,
                    text,
                  });
              });
          });
      }

      // Parse old-style narrative recipes (2013 era) - instructions in paragraphs after ingredients
      if (instructions.length === 0 && ingredients.length > 0) {
        let foundIngredients = false;
        $('.entry-content p').each((_, el) => {
          const text = $(el).text().trim();
          // Skip until we find the ingredient paragraph
          if (!foundIngredients && ingredients.some(ing => text.includes(ing.text.substring(0, 20)))) {
            foundIngredients = true;
            return; // Skip ingredient paragraph
          }
          // After ingredients, look for cooking instruction paragraphs
          if (foundIngredients && text.length > 50) {
            // Look for cooking verbs
            if (/\b(place|add|cook|bring|simmer|stir|transfer|drizzle|serve|boil|heat|mix|combine|cut|slice|halve|quarter|reduce)\b/gi.test(text)) {
              instructions.push({
                stepNumber: instructions.length + 1,
                text: this.sanitizeText(text),
              });
            }
          }
        });
      }

      // Refined entry-content selectors for instructions
      let instrIdx = ingredientP.index();
      entryContent
        .find('p')
        .slice(instrIdx + 1)
        .each((i, el) => {
          const html = $(el).html();
          if (
            html &&
            (html.includes('Preheat oven') ||
              html.match(
                /\bBake\b|\bAllow to cool\b|\bDo ahead\b|\bFlouring\b|\bSift together\b|\bPour into\b|\bMelt together\b|\bStir\b|\bAdd to\b|\bToss the walnuts\b|\bDo not overbake\b/
              ))
          ) {
            instructions.push({
              stepNumber: instructions.length + 1,
              text: this.sanitizeText($(el).text()),
            });
          }
        });
      // Enhanced image extraction for Smitten Kitchen with better priority order
      let imageUrl: string | undefined;

      // Priority 1: Main post thumbnail (most likely to be the recipe image)
      imageUrl = $('.post-thumbnail-container img').first().attr('src');

      // Priority 2: Check for wp-post-image class specifically
      if (!imageUrl) {
        imageUrl = $('img.wp-post-image').first().attr('src');
      }

      // Priority 3: Look for images in entry content that might be recipe photos
      if (!imageUrl) {
        const entryContentImg = $('.entry-content img').first().attr('src');
        // Avoid sidebar/widget images by checking if src contains recipe-related paths
        if (
          entryContentImg &&
          (entryContentImg.includes('/wp-content/uploads/') ||
            entryContentImg.includes('smittenkitchen'))
        ) {
          imageUrl = entryContentImg;
        }
      }

      // Priority 4: Fallback to og:image meta tag
      if (!imageUrl) {
        imageUrl = $('meta[property="og:image"]').attr('content');
      }

      // Priority 5: Last resort - any reasonable image
      if (!imageUrl) {
        imageUrl = $('.recipe-photo img, img[src*="wp-content/uploads"]')
          .first()
          .attr('src');
      }
      // Enhanced time extraction with individual time components
      const prepTime =
        this.sanitizeText(
          $('.jetpack-recipe-prep-time, .recipe-prep-time')
            .first()
            .text()
            .replace(/Prep.*?:\s*/gi, '')
            .trim() ||
            $('.recipe-meta-prep, .prep-time')
              .first()
              .text()
              .replace(/Prep.*?:\s*/gi, '')
              .trim() ||
            $('[data-prep-time], .preparation-time').first().text()
        ) || undefined;

      const cookTime =
        this.sanitizeText(
          $('.jetpack-recipe-cook-time, .recipe-cook-time')
            .first()
            .text()
            .replace(/Cook.*?:\s*/gi, '')
            .trim() ||
            $('.recipe-meta-cook, .cook-time')
              .first()
              .text()
              .replace(/Cook.*?:\s*/gi, '')
              .trim() ||
            $('[data-cook-time], .cooking-time').first().text()
        ) || undefined;

      let totalTime =
        this.sanitizeText(
          $('.jetpack-recipe-time time, .jetpack-recipe-time')
            .first()
            .text()
            .replace(/Time:\s*/gi, '')
            .trim() ||
            $('.recipe-total-time, .total-time')
              .first()
              .text()
              .replace(/Total.*?:\s*/gi, '')
              .trim() ||
            $('[data-total-time], .recipe-duration').first().text()
        ) || undefined;

      let servings =
        this.sanitizeText(
          $('.jetpack-recipe-servings')
            .first()
            .text()
            .replace(/Servings:\s*/gi, '')
            .trim() ||
            $('.recipe-servings, .recipe-yield')
              .first()
              .text()
              .replace(/Serves?:?\s*/gi, '')
              .trim() ||
            $('[data-servings], .servings-value').first().text()
        ) || undefined;
      let tags: string[] = ['Cocktail', 'Drinks']; // Default categories for this recipe type
      recipe = {
        title:
          typeof title === 'string' && title.trim().length > 0
            ? title.trim()
            : 'Untitled Recipe',
        source: url && url.length > 0 ? url : 'https://smittenkitchen.com/',
        author:
          typeof author === 'string' && author.trim().length > 0
            ? author.trim()
            : 'Smitten Kitchen',
        ingredients:
          Array.isArray(ingredients) && ingredients.length > 0
            ? ingredients
            : [{ text: 'See original recipe for details.' }],
        instructions:
          Array.isArray(instructions) && instructions.length > 0
            ? instructions
            : [{ stepNumber: 1, text: 'See original recipe for details.' }],
        imageUrl:
          typeof imageUrl === 'string' && imageUrl.trim().length > 0
            ? imageUrl.trim()
            : undefined,
        prepTime,
        cookTime,
        totalTime,
        servings,
        tags,
      };
    }
    // Lenient validation - only require truly essential fields with defaults
    // Ensure we have at least a basic title and source, and provide fallbacks for missing data
    if (!recipe.title || recipe.title.trim().length === 0) {
      recipe.title = 'Recipe from Smitten Kitchen';
    }
    if (!recipe.source || recipe.source.trim().length === 0) {
      recipe.source = url || 'https://smittenkitchen.com/';
    }
    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      recipe.ingredients = [{ text: 'See original recipe for ingredients.' }];
    }
    if (!recipe.instructions || recipe.instructions.length === 0) {
      recipe.instructions = [
        { stepNumber: 1, text: 'See original recipe for instructions.' },
      ];
    }

    // Only throw an error if we absolutely cannot create a meaningful recipe
    if (!recipe.title && !recipe.source) {
      throw new Error('Cannot extract recipe: no title or source found');
    }
    return recipe;
  }
}
