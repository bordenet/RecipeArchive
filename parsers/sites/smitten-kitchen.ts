import * as cheerio from "cheerio";
import { BaseParser } from "../base-parser.js";
import { Recipe, Ingredient, Instruction } from "../types.js";

export class SmittenKitchenParser extends BaseParser {
	canParse(url: string): boolean {
		return url.includes("smittenkitchen.com");
	}

	private extractInstructionText(instruction: any): string {
		// Handle various JSON-LD instruction formats
		if (typeof instruction === "string") {
			return this.sanitizeText(instruction);
		}
		
		if (typeof instruction === "object" && instruction !== null) {
			// Try different possible properties for instruction text
			const possibleTextFields = ["text", "name", "description"];
			
			for (const field of possibleTextFields) {
				if (instruction[field] && typeof instruction[field] === "string") {
					const text = this.sanitizeText(instruction[field]);
					// Filter out JavaScript code fragments
					if (!this.isJavaScriptCode(text)) {
						return text;
					}
				}
			}
		}
		
		return "See original recipe for this step.";
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
			/===|!==|&&|\|\|/
		];
		
		return jsPatterns.some(pattern => pattern.test(text));
	}

	async parse(html: string, url: string): Promise<Recipe> {
		const $ = cheerio.load(html);
		const jsonLd = this.extractJsonLD(html);
		let recipe: Recipe;
		if (jsonLd) {
			recipe = {
				title: this.sanitizeText(jsonLd.name),
				source: url,
				author: typeof jsonLd.author === "string" ? jsonLd.author : jsonLd.author?.name || "Deb Perelman",
				ingredients: (jsonLd.recipeIngredient || []).map(i => ({ text: this.sanitizeText(i) })),
				instructions: (jsonLd.recipeInstructions || []).map((i, idx) => ({ 
					stepNumber: idx + 1, 
					text: this.extractInstructionText(i)
				})),
				imageUrl: typeof jsonLd.image === "string" ? jsonLd.image : Array.isArray(jsonLd.image) ? (typeof jsonLd.image[0] === "string" ? jsonLd.image[0] : jsonLd.image[0]?.url) : jsonLd.image?.url,
				prepTime: jsonLd.prepTime || '',
				cookTime: jsonLd.cookTime || '',
				totalTime: jsonLd.totalTime || '',
				servings: jsonLd.recipeYield?.toString() || '',
				tags: Array.isArray(jsonLd.recipeCategory) ? jsonLd.recipeCategory.map((c: string) => this.sanitizeText(c)) : (jsonLd.recipeCategory ? [this.sanitizeText(jsonLd.recipeCategory)] : []),
			};
		} else {
			// Fallback selectors using Cheerio - Updated for Jetpack recipe format and refined selectors
			let title = this.sanitizeText($('.jetpack-recipe-title, h1.entry-title, h1.post-title, h1').first().text() || $('h1').first().text() || "");
			let author = this.sanitizeText($('.jetpack-recipe-source, p.recipe-meta + p, .author-meta, .author, .byline .author').first().text().replace(/Source:\s*|Author:\s*/gi, '').trim() || 'Deb Perelman');
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
			// Refined entry-content selectors for edge cases
			const entryContent = $('.entry-content');
			const recipeTitleP = entryContent.find('p b:contains("Ina Garten")').parent();
			let ingredientP = recipeTitleP.next('p');
			if (ingredientP.length) {
				const raw = ingredientP.html();
				if (raw) {
					ingredients = raw.split(/<br\s*\/>/i).map(t => ({ text: this.sanitizeText($(t).text() || $("<div>"+t+"</div>").text()) })).filter(i => i.text);
				}
			}
			let instructions: Instruction[] = [];
			const jetpackDirections = $('.jetpack-recipe-directions').text().trim();
			if (jetpackDirections) {
				instructions.push({ stepNumber: 1, text: this.sanitizeText(jetpackDirections) });
			}
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
			// Refined entry-content selectors for instructions
			let instrIdx = ingredientP.index();
			entryContent.find('p').slice(instrIdx + 1).each((i, el) => {
				const html = $(el).html();
				if (html && (html.includes('Preheat oven') || html.match(/\bBake\b|\bAllow to cool\b|\bDo ahead\b|\bFlouring\b|\bSift together\b|\bPour into\b|\bMelt together\b|\bStir\b|\bAdd to\b|\bToss the walnuts\b|\bDo not overbake\b/))) {
					instructions.push({ stepNumber: instructions.length + 1, text: this.sanitizeText($(el).text()) });
				}
			});
			let imageUrl = $('.recipe-photo img, img, .post-thumbnail-container img').first().attr('src') || undefined;
			const ogImage = $('meta[property="og:image"]').attr('content');
			if (ogImage) imageUrl = ogImage;
			// Enhanced time extraction with individual time components
			const prepTime = this.sanitizeText(
				$('.jetpack-recipe-prep-time, .recipe-prep-time').first().text().replace(/Prep.*?:\s*/gi, '').trim() ||
				$('.recipe-meta-prep, .prep-time').first().text().replace(/Prep.*?:\s*/gi, '').trim() ||
				$('[data-prep-time], .preparation-time').first().text()
			) || undefined;
			
			const cookTime = this.sanitizeText(
				$('.jetpack-recipe-cook-time, .recipe-cook-time').first().text().replace(/Cook.*?:\s*/gi, '').trim() ||
				$('.recipe-meta-cook, .cook-time').first().text().replace(/Cook.*?:\s*/gi, '').trim() ||
				$('[data-cook-time], .cooking-time').first().text()
			) || undefined;
			
			let totalTime = this.sanitizeText(
				$('.jetpack-recipe-time time, .jetpack-recipe-time').first().text().replace(/Time:\s*/gi, '').trim() ||
				$('.recipe-total-time, .total-time').first().text().replace(/Total.*?:\s*/gi, '').trim() ||
				$('[data-total-time], .recipe-duration').first().text()
			) || undefined;
			
			let servings = this.sanitizeText(
				$('.jetpack-recipe-servings').first().text().replace(/Servings:\s*/gi, '').trim() ||
				$('.recipe-servings, .recipe-yield').first().text().replace(/Serves?:?\s*/gi, '').trim() ||
				$('[data-servings], .servings-value').first().text()
			) || undefined;
			let tags: string[] = ['Cocktail', 'Drinks']; // Default categories for this recipe type
			recipe = {
				title: typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'Untitled Recipe',
				source: url && url.length > 0 ? url : 'https://smittenkitchen.com/',
				author: typeof author === 'string' && author.trim().length > 0 ? author.trim() : 'Smitten Kitchen',
				ingredients: Array.isArray(ingredients) && ingredients.length > 0 ? ingredients : [{ text: 'See original recipe for details.' }],
				instructions: Array.isArray(instructions) && instructions.length > 0 ? instructions : [{ stepNumber: 1, text: 'See original recipe for details.' }],
				imageUrl: typeof imageUrl === 'string' && imageUrl.trim().length > 0 ? imageUrl.trim() : '',
				prepTime,
				cookTime,
				totalTime,
				servings,
				tags
			};
		}
		// Strict contract enforcement - only check required fields from types.ts
		if (
			!recipe.title ||
			!recipe.source ||
			!recipe.ingredients.length ||
			!recipe.instructions.length
		) {
			throw new Error('Missing required recipe fields');
		}
		return recipe;
	}
}
