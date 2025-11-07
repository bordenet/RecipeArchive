import { BaseParser } from "../base-parser";
import * as cheerio from "cheerio";
import { Recipe } from "../types";

export class AnthonyKitchenParser extends BaseParser {
  canParse(url: string): boolean {
    return url.includes("theanthonykitchen.com");
  }

  async parse(html: string, url: string): Promise<Recipe> {
    const $ = cheerio.load(html);
    const jsonLd = this.extractJsonLD(html);

    if (jsonLd) {
      const recipe: Recipe = {
        title: this.sanitizeText(jsonLd.name),
        source: url,
        ingredients: (jsonLd.recipeIngredient || []).map((i) => ({
          text: this.sanitizeText(i),
        })),
        instructions: this.processInstructions(
          (jsonLd.recipeInstructions || [])
            .flatMap((section: any) => {
              if (typeof section === "string") {
                return [this.sanitizeText(section)];
              }
              // Handle HowToSection with itemListElement array
              if (section.itemListElement && Array.isArray(section.itemListElement)) {
                return section.itemListElement.map((step: any) =>
                  typeof step === "string"
                    ? this.sanitizeText(step)
                    : this.sanitizeText(step.text || step.name || "")
                );
              }
              // Handle direct HowToStep objects
              return [this.sanitizeText(section.text || section.name || "")];
            })
            .filter((text: any) => typeof text === "string" && text.length > 0)
        ),
        imageUrl:
          typeof jsonLd.image === "string"
            ? jsonLd.image
            : Array.isArray(jsonLd.image)
              ? typeof jsonLd.image[0] === "string"
                ? jsonLd.image[0]
                : jsonLd.image[0]?.url
              : jsonLd.image?.url,
        prepTime: jsonLd.prepTime,
        cookTime: jsonLd.cookTime,
        totalTime: jsonLd.totalTime,
        servings: jsonLd.recipeYield?.toString(),
        notes: jsonLd.description
          ? [this.sanitizeText(jsonLd.description)]
          : undefined,
      };
      const validation = this.validateRecipe(recipe);
      if (validation.isValid) return recipe;
    }

    // Fallback selectors if JSON-LD is not available or invalid
    const title = this.sanitizeText($("h1.entry-title, h1.wp-block-post-title").first().text() || "");
    const ingredients = $(".wp-block-recipe-ingredient, .recipe-ingredient")
      .map((_: any, el: any) => ({ text: this.sanitizeText($(el).text()) }))
      .get();
    const instructions = $(".wp-block-recipe-instruction, .recipe-instruction")
      .map((_: any, el: any) => ({
        stepNumber: _ + 1,
        text: this.sanitizeText($(el).text()),
      }))
      .get();

    const recipe: Recipe = {
      title,
      source: url,
      ingredients,
      instructions,
    };
    return recipe;
  }
}

export default AnthonyKitchenParser;