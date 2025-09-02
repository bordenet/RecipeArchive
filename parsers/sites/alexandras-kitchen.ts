// Alexandra's Kitchen Parser (alexandracooks.com)
// Uses JSON-LD structured data with fallback selectors

import * as cheerio from "cheerio";
import { BaseParser } from '../base-parser.js';
import { Recipe, Ingredient, Instruction } from '../types.js';

export class AlexandrasKitchenParser extends BaseParser {
  canParse(url: string): boolean {
    return url.includes("alexandracooks.com");
  }

  async parse(html: string, url: string): Promise<Recipe> {
    const $ = cheerio.load(html);
    
    try {
      // First try JSON-LD parsing (Alexandra's Kitchen has excellent structured data)
      const jsonLD = this.extractJsonLD(html);
      if (jsonLD && jsonLD.name) {
        console.log('✅ Alexandra\'s Kitchen: Extracted recipe via JSON-LD');
        return {
          title: this.sanitizeText(jsonLD.name),
          source: url,
          author: typeof jsonLD.author === "string" ? jsonLD.author : jsonLD.author?.name || "Alexandra Stafford",
          ingredients: (jsonLD.recipeIngredient || []).map(i => ({ text: this.sanitizeText(i) })),
          instructions: (jsonLD.recipeInstructions || []).map((i, idx) => ({ 
            stepNumber: idx + 1, 
            text: typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text) 
          })),
          imageUrl: typeof jsonLD.image === "string" ? jsonLD.image : Array.isArray(jsonLD.image) ? 
            (typeof jsonLD.image[0] === "string" ? jsonLD.image[0] : jsonLD.image[0]?.url) : jsonLD.image?.url,
          prepTime: jsonLD.prepTime || '',
          cookTime: jsonLD.cookTime || '',
          totalTime: jsonLD.totalTime || '',
          servings: jsonLD.recipeYield?.toString() || '',
          tags: Array.isArray(jsonLD.recipeCategory) ? jsonLD.recipeCategory.map((c: string) => this.sanitizeText(c)) : 
            (jsonLD.recipeCategory ? [this.sanitizeText(jsonLD.recipeCategory)] : []),
        };
      }

      // Fallback to CSS selectors if JSON-LD fails
      console.log('⚠️ Alexandra\'s Kitchen: JSON-LD failed, trying CSS selectors');
      return await this.parseWithSelectors($, url);
    } catch (error) {
      console.error('❌ Alexandra\'s Kitchen parsing error:', error);
      throw error;
    }
  }

  private async parseWithSelectors($: cheerio.CheerioAPI, url: string): Promise<Recipe> {
    try {
      // Extract basic recipe information using cheerio selectors
      const title = this.sanitizeText($('h1.entry-title, h1.post-title, .recipe-title h1, h1').first().text() || '');
      
      if (!title) {
        throw new Error('No recipe title found');
      }

      // Alexandra's Kitchen uses Tasty Recipes plugin - extract ingredients
      const ingredients: Ingredient[] = [];
      $('.tasty-recipes-ingredients li, .recipe-ingredients li, .ingredients li').each((_, el) => {
        const text = $(el).text().trim();
        if (text) ingredients.push({ text: this.sanitizeText(text) });
      });

      // Extract instructions 
      const instructions: Instruction[] = [];
      $('.tasty-recipes-instructions li, .recipe-instructions li, .instructions li').each((idx, el) => {
        const text = $(el).text().trim();
        if (text) instructions.push({ stepNumber: idx + 1, text: this.sanitizeText(text) });
      });

      // Extract other recipe data
      const prepTime = this.sanitizeText($('.tasty-recipes-prep-time, .recipe-prep-time').first().text() || '');
      const cookTime = this.sanitizeText($('.tasty-recipes-cook-time, .recipe-cook-time').first().text() || '');
      const totalTime = this.sanitizeText($('.tasty-recipes-total-time, .recipe-total-time').first().text() || '');
      const servings = this.sanitizeText($('.tasty-recipes-yield, .recipe-servings').first().text() || '');

      // Extract image URL
      let imageUrl = $('.tasty-recipes-image img, .recipe-image img, .entry-content img').first().attr('src');
      if (!imageUrl) {
        imageUrl = $('meta[property="og:image"]').attr('content');
      }

      return {
        title,
        source: url,
        author: "Alexandra Stafford",
        ingredients,
        instructions,
        imageUrl: imageUrl || undefined,
        prepTime,
        cookTime,
        totalTime,
        servings,
        tags: []
      };
    } catch (error) {
      console.error('❌ Alexandra\'s Kitchen selector parsing failed:', error);
      throw error;
    }
  }

  private parseTimeToMinutes(timeText: string): number | undefined {
    if (!timeText) return undefined;
    
    const text = timeText.toLowerCase();
    let totalMinutes = 0;
    
    // Extract hours
    const hoursMatch = text.match(/(\d+)\s*(?:hours?|hrs?|h)/);
    if (hoursMatch) {
      totalMinutes += parseInt(hoursMatch[1]) * 60;
    }
    
    // Extract minutes
    const minutesMatch = text.match(/(\d+)\s*(?:minutes?|mins?|m)/);
    if (minutesMatch) {
      totalMinutes += parseInt(minutesMatch[1]);
    }
    
    // If no time units found, try to parse as just a number (assume minutes)
    if (totalMinutes === 0) {
      const numberMatch = text.match(/(\d+)/);
      if (numberMatch) {
        totalMinutes = parseInt(numberMatch[1]);
      }
    }
    
    return totalMinutes > 0 ? totalMinutes : undefined;
  }

  private parseServings(servingsText: string): number | undefined {
    if (!servingsText) return undefined;
    
    const match = servingsText.match(/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  }
}

// Export singleton instance
export const alexandrasKitchenParser = new AlexandrasKitchenParser();