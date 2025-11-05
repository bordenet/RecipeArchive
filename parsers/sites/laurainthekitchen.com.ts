import { BaseParser } from '../base-parser';
import * as cheerio from 'cheerio';
import { Recipe } from '../types';

export class LauraInTheKitchenParser extends BaseParser {
  canParse(url: string): boolean {
    return url.includes('laurainthekitchen.com/recipes');
  }

  async parse(html: string, url: string): Promise<Recipe> {
    const $ = cheerio.load(html);

    // Try JSON-LD first (best source of structured data)
    const jsonLd = this.extractJsonLD(html);
    if (jsonLd) {
      const recipe: Recipe = {
        title: this.sanitizeText(jsonLd.name),
        source: url,
        author:
          typeof jsonLd.author === 'string'
            ? jsonLd.author
            : jsonLd.author?.name || 'Laura Vitale',
        ingredients: (jsonLd.recipeIngredient || []).map((i) => ({
          text: this.sanitizeText(i),
        })),
        instructions: this.processInstructions(
          (jsonLd.recipeInstructions || []).map((i) =>
            typeof i === 'string' ? this.sanitizeText(i) : this.sanitizeText(i.text)
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
        prepTime: jsonLd.prepTime,
        cookTime: jsonLd.cookTime,
        totalTime: jsonLd.totalTime,
        servings: jsonLd.recipeYield?.toString(),
      };

      const validation = this.validateRecipe(recipe);
      if (validation.isValid) return recipe;
    }

    // Fallback to HTML scraping if JSON-LD fails
    const title = this.sanitizeText($('.cs-page-title h1').first().text());
    const author = 'Laura Vitale';
    const imageUrl = $('meta[property="og:image"]').attr('content') || '';

    // Parse prep and cook time from recipe details
    let prepTime: string | undefined;
    let cookTime: string | undefined;
    let totalTime: string | undefined;
    let servings = '';

    $('.cs-recipe-details > div').each((_, el) => {
      const fullText = $(el).text();
      const spanText = $(el).find('span').text().toLowerCase();

      if (spanText.includes('preparation')) {
        const match = fullText.match(/(\d+)\s*minutes?/i);
        if (match) prepTime = `PT${match[1]}M`;
      } else if (spanText.includes('cook')) {
        const match = fullText.match(/(\d+)\s*(hours?)?\s*(\d+)?\s*minutes?/i);
        if (match) {
          const hours = match[1] ? parseInt(match[1], 10) : 0;
          const mins = match[3] ? parseInt(match[3], 10) : 0;
          cookTime = hours > 0 ? `PT${hours}H${mins}M` : `PT${mins}M`;
        }
      } else if (spanText.includes('servings')) {
        servings = fullText.replace(/servings/i, '').trim();
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
    const ingredients: { text: string }[] = [];
    $('.cs-ingredients-check-list li').each((_, el) => {
      const text = this.sanitizeText($(el).text());
      if (text) {
        ingredients.push({ text });
      }
    });

    // Parse instructions
    const instructions: { stepNumber: number; text: string }[] = [];
    const instructionText = $('.cs-recipe-single-preparation ul').text();
    // Instructions are separated by numbers like "1)", "2)", etc.
    const steps = instructionText.split(/\d+\)/).filter(s => s.trim().length > 0);
    steps.forEach((step, idx) => {
      const text = this.sanitizeText(step);
      if (text) {
        instructions.push({ stepNumber: idx + 1, text });
      }
    });

    const recipe: Recipe = {
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

    return recipe;
  }
}

export default LauraInTheKitchenParser;
