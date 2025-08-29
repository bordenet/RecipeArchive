import * as cheerio from "cheerio";
import { BaseParser } from "../base-parser.js";
import { Recipe, Ingredient, Instruction } from "../types.js";

export class LoveAndLemonsParser extends BaseParser {
	canParse(url: string): boolean {
		return url.includes("loveandlemons.com");
	}

	async parse(html: string, url: string): Promise<Recipe> {
		const $ = cheerio.load(html);
		// Detect error/404 page
		const pageTitle = $('title').text();
		const ogTitle = $('meta[property="og:title"]').attr('content');
		if ((pageTitle && pageTitle.toLowerCase().includes('page not found')) || (ogTitle && ogTitle.toLowerCase().includes('page not found')) || $('title').text().toLowerCase().includes('404') || $('body').text().toLowerCase().includes('not found')) {
			return {
				title: '',
				source_url: url,
				author: '',
				ingredients: [],
				instructions: [],
				image: '',
				prep_time: '',
				cook_time: '',
				total_time: '',
				yield: '',
				categories: [],
				description: '',
				reviews: '',
				nutrition: '',
			};
		}

		// Try JSON-LD first
		let jsonLdRecipe: any = null;
		const jsonLdRaw = $('script[type="application/ld+json"]').html();
		if (jsonLdRaw) {
			try {
				const json = JSON.parse(jsonLdRaw.replace(/[\u0000-\u001F]+/g, ''));
				if (json['@type'] === 'Recipe') {
					jsonLdRecipe = json;
				} else if (Array.isArray(json['@graph'])) {
					jsonLdRecipe = json['@graph'].find((n: any) => n['@type'] === 'Recipe');
				}
			} catch {}
		}

		// Normalize/clean helpers
		function cleanString(str: string) {
			return str ? str.replace(/<[^>]*>?/gm, '').replace(/(\r\n|\n|\r)/gm, ' ').replace(/&nbsp;|\s\s+/gm, ' ').trim() : '';
		}
		function toIngredientList(arr: any): Ingredient[] {
			if (!arr) return [];
			if (Array.isArray(arr)) return arr.map((i: string) => ({ text: cleanString(i) }));
			return [];
		}
		function toInstructionList(arr: any): Instruction[] {
			if (!arr) return [];
			if (Array.isArray(arr)) return arr.map((i: any, idx: number) => ({ stepNumber: idx + 1, text: cleanString(typeof i === 'string' ? i : i.text) }));
			return [];
		}
		function toString(val: any): string {
			if (!val) return '';
			if (typeof val === 'string') return cleanString(val);
			if (Array.isArray(val)) return cleanString(val[0]);
			return '';
		}
		function toList(val: any): string[] {
			if (!val) return [];
			if (Array.isArray(val)) return val.map((v: any) => cleanString(v));
			if (typeof val === 'string') return [cleanString(val)];
			return [];
		}

		// Extract from JSON-LD if available, else robust Cheerio selectors
		let title = jsonLdRecipe ? toString(jsonLdRecipe.name) : $('h1.entry-title').text().trim() || $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content') || '';
		let author = jsonLdRecipe ? toString(jsonLdRecipe.author && jsonLdRecipe.author.name ? jsonLdRecipe.author.name : jsonLdRecipe.author) : $('.author').text().trim() || $('meta[name="author"]').attr('content') || 'Jeanine Donofrio';
		let description = jsonLdRecipe ? toString(jsonLdRecipe.description) : $('meta[name="description"]').attr('content') || cleanString($('.first-sentence').text()) || cleanString($('.entry-content p').first().text()) || '';
		let categories = jsonLdRecipe ? toList(jsonLdRecipe.recipeCategory) : [];
		let ingredients = jsonLdRecipe ? toIngredientList(jsonLdRecipe.recipeIngredient) : [];
		let instructions = jsonLdRecipe ? toInstructionList(jsonLdRecipe.recipeInstructions) : [];
		let image = jsonLdRecipe ? toString(jsonLdRecipe.image) : $('meta[property="og:image"]').attr('content') || $('.post-thumbnail img').attr('src') || '';
		let prep_time = jsonLdRecipe ? toString(jsonLdRecipe.prepTime) : '';
		let cook_time = jsonLdRecipe ? toString(jsonLdRecipe.cookTime) : '';
		let total_time = jsonLdRecipe ? toString(jsonLdRecipe.totalTime) : '';
		let yieldVal = jsonLdRecipe ? toString(jsonLdRecipe.recipeYield) : '';
		let reviews = jsonLdRecipe && jsonLdRecipe.aggregateRating ? (jsonLdRecipe.aggregateRating.ratingValue || jsonLdRecipe.aggregateRating.reviewCount || '') : '';
		let nutrition = jsonLdRecipe && jsonLdRecipe.nutrition ? JSON.stringify(jsonLdRecipe.nutrition) : '';

		// Strict contract enforcement
		if (
			!title ||
			!description ||
			!image ||
			!author ||
			!ingredients.length ||
			!instructions.length ||
			!yieldVal ||
			!categories.length ||
			!nutrition
		) {
			throw new Error('Missing required recipe fields');
		}

		return {
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
}
