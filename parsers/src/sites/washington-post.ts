import * as cheerio from "cheerio";
import { BaseParser } from "../base-parser.js";
import { Recipe } from "../types.js";

export class WashingtonPostParser extends BaseParser {
	canParse(url: string): boolean {
		return url.includes('washingtonpost.com/food') || 
			   url.includes('washingtonpost.com') && url.includes('recipe');
	}

	async parse(html: string, url: string): Promise<Recipe> {
		const jsonLd = this.extractJsonLD(html);
		if (jsonLd) {
			return this.parseFromJsonLD(jsonLd, url);
		}
		const $ = cheerio.load(html);
		const title = this.extractTitle($);
		const ingredients = this.extractIngredients($);
		const instructions = this.extractInstructions($);
		const imageUrl = this.extractImage($);
		const metadata = this.extractMetadata($);
		const recipe: Recipe = {
			title,
			source_url: url,
			ingredients,
			instructions,
			image: imageUrl || '',
			prep_time: metadata.prep_time || '',
			cook_time: metadata.cook_time || '',
			total_time: metadata.total_time || '',
			yield: metadata.yield || '',
			description: metadata.description || '',
			categories: metadata.categories || [],
			reviews: metadata.reviews || '',
			nutrition: metadata.nutrition || ''
		};
		// Strict contract enforcement
		if (
			!recipe.title ||
			!recipe.description ||
			!recipe.image ||
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

	private extractTitle($: cheerio.CheerioAPI): string {
		const titleSelectors = [
			'h1[data-qa="headline"]',
			'h1.headline',
			'h1.font--headline',
			'h1',
			'.headline h1',
			'[data-qa="headline"]'
		];
		for (const selector of titleSelectors) {
			const title = $(selector).first().text().trim();
			if (title) {
				return this.sanitizeText(title);
			}
		}
		return 'Recipe from Washington Post';
	}

	private extractIngredients($: cheerio.CheerioAPI): Array<{ text: string }> {
		const ingredients: Array<{ text: string }> = [];
		const ingredientSelectors = [
			'.recipe-ingredients li',
			'.ingredients-section li',
			'.ingredient-list li',
			'ul[data-qa="ingredients"] li',
			'.wpds-box ul li',
			'li[data-ingredient]'
		];
		for (const selector of ingredientSelectors) {
			$(selector).each((_, el) => {
				const text = $(el).text().trim();
				if (text && !this.isIngredientHeader(text)) {
					ingredients.push({ text: this.sanitizeText(text) });
				}
			});
			if (ingredients.length > 0) break;
		}
		if (ingredients.length === 0) {
			ingredients.push(...this.extractIngredientsFromParagraphs($));
		}
		return ingredients;
	}

	private extractInstructions($: cheerio.CheerioAPI): Array<{ stepNumber: number; text: string }> {
		const instructions: Array<{ stepNumber: number; text: string }> = [];
		const instructionSelectors = [
			'.recipe-instructions li',
			'.instructions-section li',
			'.method-steps li',
			'ol[data-qa="instructions"] li',
			'.recipe-method li',
			'.directions li'
		];
		for (const selector of instructionSelectors) {
			$(selector).each((idx, el) => {
				const text = $(el).text().trim();
				if (text && !this.isInstructionHeader(text)) {
					instructions.push({
						stepNumber: idx + 1,
						text: this.sanitizeText(text)
					});
				}
			});
			if (instructions.length > 0) break;
		}
		if (instructions.length === 0) {
			instructions.push(...this.extractInstructionsFromParagraphs($));
		}
		return instructions;
	}

	private extractImage($: cheerio.CheerioAPI): string | undefined {
		const imageSelectors = [
			'.recipe-hero img',
			'.lead-image img',
			'.featured-image img',
			'img[data-qa="hero-image"]',
			'.wpds-image img',
			'meta[property="og:image"]'
		];
		for (const selector of imageSelectors) {
			if (selector.startsWith('meta')) {
				const content = $(selector).attr('content');
				if (content) return content;
			} else {
				const src = $(selector).first().attr('src') || $(selector).first().attr('data-src');
				if (src) return src.startsWith('http') ? src : `https://washingtonpost.com${src}`;
			}
		}
		return undefined;
	}

	private extractMetadata($: cheerio.CheerioAPI): Partial<Recipe> {
		const metadata: Partial<Recipe> = {};
		const prepTime = $('[data-qa="prep-time"], .prep-time').text().trim();
		const cookTime = $('[data-qa="cook-time"], .cook-time').text().trim();
		const totalTime = $('[data-qa="total-time"], .total-time').text().trim();
		if (prepTime) metadata.prep_time = prepTime;
		if (cookTime) metadata.cook_time = cookTime;
		if (totalTime) metadata.total_time = totalTime;
		const yieldVal = $('[data-qa="servings"], .servings, .yield').text().trim();
		if (yieldVal) metadata.yield = yieldVal;
		const description = $('.recipe-description, .article-summary, .dek').first().text().trim();
		if (description) {
			metadata.description = this.sanitizeText(description);
		}
		return metadata;
	}

	private isIngredientHeader(text: string): boolean {
		const headers = ['ingredients', 'for the', 'you will need', 'shopping list'];
		return headers.some(header => text.toLowerCase().includes(header));
	}

	private isInstructionHeader(text: string): boolean {
		const headers = ['instructions', 'method', 'directions', 'steps'];
		return headers.some(header => text.toLowerCase().includes(header));
	}

	private extractIngredientsFromParagraphs($: cheerio.CheerioAPI): Array<{ text: string }> {
		const ingredients: Array<{ text: string }> = [];
		$('p').each((_, el) => {
			const text = $(el).text().trim();
			if (this.looksLikeIngredient(text)) {
				ingredients.push({ text: this.sanitizeText(text) });
			}
		});
		return ingredients;
	}

	private extractInstructionsFromParagraphs($: cheerio.CheerioAPI): Array<{ stepNumber: number; text: string }> {
		const instructions: Array<{ stepNumber: number; text: string }> = [];
		$('p').each((idx, el) => {
			const text = $(el).text().trim();
			if (this.looksLikeInstruction(text)) {
				instructions.push({
					stepNumber: instructions.length + 1,
					text: this.sanitizeText(text)
				});
			}
		});
		return instructions;
	}

	private looksLikeIngredient(text: string): boolean {
		const ingredientIndicators = [
			/\d+.*(?:cup|tablespoon|teaspoon|pound|ounce|gram|kg|lb)/i,
			/\b(?:salt|pepper|oil|butter|flour|sugar|egg|milk|water|onion|garlic)\b/i,
			/^\d+(?:\s*-\s*\d+)?\s+/
		];
		return ingredientIndicators.some(pattern => pattern.test(text)) && text.length < 200;
	}

	private looksLikeInstruction(text: string): boolean {
		const instructionIndicators = [
			/^(?:heat|cook|add|mix|stir|bake|roast|grill|sauté|simmer|boil)/i,
			/(?:minutes?|hours?|until|degrees?|°[CF])/i,
			/\b(?:oven|pan|skillet|pot|bowl|plate)\b/i
		];
		return instructionIndicators.some(pattern => pattern.test(text)) && 
			   text.length > 20 && text.length < 500;
	}

	private parseFromJsonLD(jsonLd: any, url: string): Recipe {
		return {
			title: this.sanitizeText(jsonLd.name || 'Recipe'),
			source_url: url,
			ingredients: (jsonLd.recipeIngredient || []).map((i: string) => ({ 
				text: this.sanitizeText(i) 
			})),
			instructions: (jsonLd.recipeInstructions || []).map((instruction: any, idx: number) => ({
				stepNumber: idx + 1,
				text: typeof instruction === 'string' ? 
					this.sanitizeText(instruction) : 
					this.sanitizeText(instruction.text)
			})),
			image: this.extractImageFromJsonLD(jsonLd) || '',
			prep_time: jsonLd.prepTime || '',
			cook_time: jsonLd.cookTime || '',
			total_time: jsonLd.totalTime || '',
			yield: jsonLd.recipeYield?.toString() || '',
			description: jsonLd.description ? this.sanitizeText(jsonLd.description) : '',
			categories: Array.isArray(jsonLd.recipeCategory) ? jsonLd.recipeCategory.map((c: string) => this.sanitizeText(c)) : (jsonLd.recipeCategory ? [this.sanitizeText(jsonLd.recipeCategory)] : []),
			reviews: jsonLd.aggregateRating?.ratingValue || '',
			nutrition: jsonLd.nutrition ? JSON.stringify(jsonLd.nutrition) : ''
		};
	}

	private extractImageFromJsonLD(jsonLd: any): string | undefined {
		if (typeof jsonLd.image === 'string') return jsonLd.image;
		if (Array.isArray(jsonLd.image)) {
			const firstImage = jsonLd.image[0];
			return typeof firstImage === 'string' ? firstImage : firstImage?.url;
		}
		return jsonLd.image?.url;
	}
}
