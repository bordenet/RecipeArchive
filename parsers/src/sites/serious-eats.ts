import * as cheerio from "cheerio";
import { BaseParser } from "../base-parser.js";
import { Recipe, Ingredient, Instruction } from "../types.js";

export class SeriousEatsParser extends BaseParser {
	canParse(url: string): boolean {
		return url.includes("seriouseats.com");
	}

	async parse(html: string, url: string): Promise<Recipe> {
		const $ = cheerio.load(html);
		const canonicalUrl = $('link[rel="canonical"]').attr('href');
		const ogUrl = $('meta[property="og:url"]').attr('content');
		const pageTitle = $('title').text().trim();
		if ((canonicalUrl && canonicalUrl.includes('/404')) || (ogUrl && ogUrl.includes('/404')) || pageTitle === 'Page Not Found' || html.includes('404') && html.includes('seriouseats.com')) {
			return {
				title: '',
				source_url: url,
				ingredients: [],
				instructions: [],
				author: '',
				image: '',
				prep_time: '',
				cook_time: '',
				total_time: '',
				yield: '',
				categories: [],
				description: '',
				reviews: '',
				nutrition: ''
			};
		}
		const jsonLd = this.extractJsonLD(html);
		let recipe: Recipe;
		if (jsonLd) {
			let categories: string[] = [];
			if (jsonLd.keywords) {
				if (Array.isArray(jsonLd.keywords)) {
					categories = jsonLd.keywords.map(k => this.sanitizeText(k));
				} else if (typeof jsonLd.keywords === "string") {
					categories = jsonLd.keywords.split(',').map(k => this.sanitizeText(k));
				}
			} else if (jsonLd.recipeCategory) {
				if (Array.isArray(jsonLd.recipeCategory)) {
					categories = jsonLd.recipeCategory.map(k => this.sanitizeText(k));
				} else if (typeof jsonLd.recipeCategory === "string") {
					categories = jsonLd.recipeCategory.split(',').map(k => this.sanitizeText(k));
				}
			}
			let reviews: string | number = '';
			if (jsonLd.aggregateRating) {
				if (jsonLd.aggregateRating.ratingValue) {
					reviews = jsonLd.aggregateRating.ratingValue;
				} else if (jsonLd.aggregateRating.reviewCount) {
					reviews = jsonLd.aggregateRating.reviewCount;
				}
			}
			let nutrition: string = '';
			if (jsonLd.nutrition) {
				nutrition = JSON.stringify(jsonLd.nutrition);
			}
			recipe = {
				title: this.sanitizeText(jsonLd.name),
				source_url: url,
				author: typeof jsonLd.author === "string" ? jsonLd.author : jsonLd.author?.name,
				ingredients: (jsonLd.recipeIngredient || []).map(i => ({ text: this.sanitizeText(i) })),
				instructions: (jsonLd.recipeInstructions || []).map((i, idx) => ({
					stepNumber: idx + 1,
					text: typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text)
				})),
				image: typeof jsonLd.image === "string" ? jsonLd.image :
					Array.isArray(jsonLd.image) ?
						(typeof jsonLd.image[0] === "string" ? jsonLd.image[0] : jsonLd.image[0]?.url) :
						jsonLd.image?.url,
				prep_time: jsonLd.prepTime,
				cook_time: jsonLd.cookTime,
				total_time: jsonLd.totalTime,
				yield: Array.isArray(jsonLd.recipeYield) ? jsonLd.recipeYield.join(", ") : jsonLd.recipeYield?.toString(),
				categories,
				description: jsonLd.description ? this.sanitizeText(jsonLd.description) : undefined,
				reviews,
				nutrition
			};
		} else {
			// Fallback selectors for Serious Eats specific structure
			let title = '';
			let author = '';
			let ingredients: Ingredient[] = [];
			let instructions: Instruction[] = [];
			let image = '';
			let prep_time = '';
			let cook_time = '';
			let total_time = '';
			let yieldVal = '';
			let categories: string[] = [];
			let description = '';
			let reviews = '';
			let nutrition = '';
			recipe = {
				title,
				source_url: url,
				author,
				ingredients,
				instructions,
				image,
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
