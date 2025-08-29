import * as cheerio from "cheerio";
import { BaseParser } from "../base-parser.js";
import { Recipe, Ingredient, Instruction } from "../types.js";

export class NYTCookingParser extends BaseParser {
	canParse(url: string): boolean {
		return url.includes("cooking.nytimes.com");
	}

	async parse(html: string, url: string): Promise<Recipe> {
		const $ = cheerio.load(html);
		const jsonLd = this.extractJsonLD(html);
		let recipe: Recipe;
		if (jsonLd) {
			recipe = {
				title: this.sanitizeText(jsonLd.name),
				source_url: url,
				author: typeof jsonLd.author === "string" ? jsonLd.author : jsonLd.author?.name || "NYT Cooking",
				ingredients: (jsonLd.recipeIngredient || []).map(i => ({ text: this.sanitizeText(i) })),
				instructions: (jsonLd.recipeInstructions || []).map((i, idx) => ({ stepNumber: idx + 1, text: typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text) })),
				image: typeof jsonLd.image === "string" ? jsonLd.image : Array.isArray(jsonLd.image) ? (typeof jsonLd.image[0] === "string" ? jsonLd.image[0] : jsonLd.image[0]?.url) : jsonLd.image?.url,
				prep_time: jsonLd.prepTime,
				cook_time: jsonLd.cookTime,
				total_time: jsonLd.totalTime,
				yield: jsonLd.recipeYield?.toString(),
				categories: Array.isArray(jsonLd.recipeCategory) ? jsonLd.recipeCategory.map((c: string) => this.sanitizeText(c)) : (jsonLd.recipeCategory ? [this.sanitizeText(jsonLd.recipeCategory)] : []),
				description: jsonLd.description ? this.sanitizeText(jsonLd.description) : '',
				reviews: jsonLd.aggregateRating?.ratingValue || '',
				nutrition: jsonLd.nutrition ? JSON.stringify(jsonLd.nutrition) : ''
			};
		} else {
			// Fallback selectors using Cheerio
			let title = this.sanitizeText($('h1.recipe-title, h1[data-testid="recipe-title"], h1.pantry-recipe-title, h1').first().text() || "");
			let author = this.sanitizeText($('.recipe-author, [data-testid="recipe-author"], .byline-author, .author').first().text() || "NYT Cooking");
			let ingredients: Ingredient[] = $('[data-testid="IngredientList"] li, .recipe-ingredients li, .ingredients-section li, [data-module="Ingredients"] li, ul[data-testid="ingredients"] li').map((_, el) => ({ text: this.sanitizeText($(el).text()) })).get();
			let instructions: Instruction[] = $('[data-testid="MethodList"] li, .recipe-instructions li, .instructions-section li, [data-module="Instructions"] li, ol[data-testid="instructions"] li').map((_, el) => ({ stepNumber: _ + 1, text: this.sanitizeText($(el).text()) })).get();
			let imageUrl = $('.recipe-photo img, [data-testid="recipe-image"] img, img').first().attr('src') || undefined;
			let prep_time = '';
			let cook_time = '';
			let total_time = '';
			let yieldVal = '';
			let categories: string[] = ['Uncategorized'];
			let description = '';
			let reviews = '';
			let nutrition = 'See original recipe for nutrition info.';
			recipe = {
				title: title || '',
				source_url: url,
				author: author || '',
				ingredients: Array.isArray(ingredients) ? ingredients : [],
				instructions: Array.isArray(instructions) ? instructions : [],
				image: imageUrl || '',
				prep_time,
				cook_time,
				total_time,
				yield: yieldVal,
				categories,
				description,
				reviews,
				nutrition
			};
		}
		// Strict contract enforcement
		if (
			!recipe.title ||
			!recipe.description ||
			!recipe.image ||
			!recipe.author ||
			!recipe.ingredients.length ||
			!recipe.instructions.length ||
			!recipe.yield ||
			!Array.isArray(recipe.categories) || recipe.categories.length === 0 ||
			!recipe.nutrition
		) {
			throw new Error('Missing required recipe fields');
		}
		return recipe;
	}
}
