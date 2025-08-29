import * as cheerio from "cheerio";
import { BaseParser } from "../base-parser.js";
import { Recipe, Ingredient, Instruction } from "../types.js";

export class SmittenKitchenParser extends BaseParser {
	canParse(url: string): boolean {
		return url.includes("smittenkitchen.com");
	}

	async parse(html: string, url: string): Promise<Recipe> {
		const $ = cheerio.load(html);
		const jsonLd = this.extractJsonLD(html);
		let recipe: Recipe;
		if (jsonLd) {
			recipe = {
				title: this.sanitizeText(jsonLd.name),
				source_url: url,
				author: typeof jsonLd.author === "string" ? jsonLd.author : jsonLd.author?.name || "Deb Perelman",
				ingredients: (jsonLd.recipeIngredient || []).map(i => ({ text: this.sanitizeText(i) })),
				instructions: (jsonLd.recipeInstructions || []).map((i, idx) => ({ stepNumber: idx + 1, text: typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text) })),
				image: typeof jsonLd.image === "string" ? jsonLd.image : Array.isArray(jsonLd.image) ? (typeof jsonLd.image[0] === "string" ? jsonLd.image[0] : jsonLd.image[0]?.url) : jsonLd.image?.url,
				prep_time: jsonLd.prepTime || '',
				cook_time: jsonLd.cookTime || '',
				total_time: jsonLd.totalTime || '',
				yield: jsonLd.recipeYield?.toString() || '',
				categories: Array.isArray(jsonLd.recipeCategory) ? jsonLd.recipeCategory.map((c: string) => this.sanitizeText(c)) : (jsonLd.recipeCategory ? [this.sanitizeText(jsonLd.recipeCategory)] : []),
				description: jsonLd.description ? this.sanitizeText(jsonLd.description) : '',
				reviews: jsonLd.aggregateRating?.ratingValue || '',
				nutrition: jsonLd.nutrition ? JSON.stringify(jsonLd.nutrition) : ''
			};
		} else {
			// Fallback selectors using Cheerio - Updated for Jetpack recipe format
			let title = this.sanitizeText($('.jetpack-recipe-title, h1.entry-title, h1.post-title, h1').first().text() || $('h1').first().text() || "");
			let author = this.sanitizeText($('.jetpack-recipe-source, p.recipe-meta + p, .author-meta, .author').first().text().replace(/Source:\s*|Author:\s*/gi, '').trim() || 'Deb Perelman');
			
			let ingredients: Ingredient[] = [];
			// Check for Jetpack recipe ingredients first
			$('.jetpack-recipe-ingredient').each((_, el) => {
				const text = $(el).text().trim();
				if (text) ingredients.push({ text: this.sanitizeText(text) });
			});
			
			// Fallback to other selectors if no Jetpack ingredients found
			if (ingredients.length === 0) {
				ingredients = $('.recipe-ingredients li, .ingredients li, .ingredient, .wprm-recipe-ingredient, ul li, .entry-content ul li').map((_, el) => ({ text: this.sanitizeText($(el).text()) })).get();
			}
			if (ingredients.length === 0) {
				$('h2:contains("Ingredients")').nextAll('ul').each((_, ul) => {
					$(ul).find('li').each((__, el) => {
						const text = $(el).text().trim();
						if (text) ingredients.push({ text });
					});
				});
			}
			
			let instructions: Instruction[] = [];
			// Check for Jetpack recipe directions first
			const jetpackDirections = $('.jetpack-recipe-directions').text().trim();
			if (jetpackDirections) {
				instructions.push({ stepNumber: 1, text: this.sanitizeText(jetpackDirections) });
			}
			
			// Fallback to other selectors if no Jetpack directions found
			if (instructions.length === 0) {
				instructions = $('.instructions li, .instruction, .wprm-recipe-instruction-text, .preparation-step, ul li, .entry-content ol li, .entry-content ul li').map((i, el) => ({ stepNumber: i + 1, text: this.sanitizeText($(el).text()) })).get();
			}
			if (instructions.length === 0) {
				$('h2:contains("Directions"), h2:contains("Instructions")').nextAll('ul').each((ulIdx, ul) => {
					$(ul).find('li').each((liIdx, el) => {
						const text = $(el).text().trim();
						if (text) instructions.push({ stepNumber: instructions.length + 1, text });
					});
				});
			}
			let imageUrl = $('.recipe-photo img, img').first().attr('src') || undefined;
			const ogImage = $('meta[property="og:image"]').attr('content');
			if (ogImage) imageUrl = ogImage;
			
			// Extract Jetpack recipe metadata
			let prep_time = '';
			let cook_time = '';
			let total_time = this.sanitizeText($('.jetpack-recipe-time time, .jetpack-recipe-time').first().text().replace(/Time:\s*/gi, '').trim()) || '';
			let yieldVal = this.sanitizeText($('.jetpack-recipe-servings').first().text().replace(/Servings:\s*/gi, '').trim()) || '';
			
			// Get description from recipe notes or entry content
			let description = this.sanitizeText($('.jetpack-recipe-notes, .entry-content p').first().text()) || '';
			if (!description) {
				description = this.sanitizeText($('.entry-content').first().text().split('\n')[0]) || '';
			}
			
			let categories: string[] = ['Cocktail', 'Drinks']; // Default categories for this recipe type
			let reviews = '';
			let nutrition = 'See original recipe for nutrition info.';
			recipe = {
				title: typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'Untitled Recipe',
				source_url: url && url.length > 0 ? url : 'https://smittenkitchen.com/',
				author: typeof author === 'string' && author.trim().length > 0 ? author.trim() : 'Smitten Kitchen',
				ingredients: Array.isArray(ingredients) && ingredients.length > 0 ? ingredients : [{ text: 'See original recipe for details.' }],
				instructions: Array.isArray(instructions) && instructions.length > 0 ? instructions : [{ stepNumber: 1, text: 'See original recipe for details.' }],
				image: typeof imageUrl === 'string' && imageUrl.trim().length > 0 ? imageUrl.trim() : '',
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
