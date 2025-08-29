
import * as cheerio from "cheerio";
import { BaseParser } from "../base-parser.js";
import { Recipe } from "../types.js";

function getJsonLdRecipe($: cheerio.CheerioAPI): any {
	let found;
	$('script[type="application/ld+json"]').each((_, el) => {
		try {
			const parsed = JSON.parse($(el).html() || '{}');
			if (Array.isArray(parsed)) {
				for (const obj of parsed) {
					if (obj['@type'] && (Array.isArray(obj['@type']) ? obj['@type'].includes('Recipe') : obj['@type'] === 'Recipe')) {
						found = obj;
						break;
					}
				}
			} else if (parsed['@type'] && (Array.isArray(parsed['@type']) ? parsed['@type'].includes('Recipe') : parsed['@type'] === 'Recipe')) {
				found = parsed;
			}
		} catch {}
	});
	return found;
}

export class AllRecipesParser extends BaseParser {
	canParse(url: string): boolean {
		return url.includes("allrecipes.com");
	}

	async parse(html: string, url: string): Promise<Recipe> {
		const $ = cheerio.load(html);
		const jsonLd = getJsonLdRecipe($) || {};

		// Title
		const title =
			jsonLd.name ||
			jsonLd.headline ||
			$('meta[property="og:title"]').attr('content') ||
			$('title').text().trim();

		// Description
		const description =
			jsonLd.description ||
			$('meta[name="description"]').attr('content') ||
			$('meta[property="og:description"]').attr('content') || '';

		const image =
			(jsonLd.image?.url || (typeof jsonLd.image === 'string' ? jsonLd.image : undefined)) ||
			$('meta[property="og:image"]').attr('content') ||
			$('meta[name="twitter:image"]').attr('content') || '';

		// Author
		let author =
			(Array.isArray(jsonLd.author) ? jsonLd.author[0]?.name : jsonLd.author?.name) ||
			$('meta[property="article:author"]').attr('content') ||
			'Allrecipes';

		// Ingredients
		const ingredients = (jsonLd.recipeIngredient || []).map((i: string) => ({ text: i }));

		// Instructions
		const instructions = (jsonLd.recipeInstructions || []).map((step: any, idx: number) => ({ stepNumber: idx + 1, text: typeof step === 'string' ? step : step.text }));

		// Yield
		let yieldVal = jsonLd.recipeYield;
		if (Array.isArray(yieldVal)) yieldVal = yieldVal.join(', ');
		yieldVal = yieldVal || '';

		// Categories
		let categories = jsonLd.recipeCategory;
		if (Array.isArray(categories)) categories = categories;
		else if (typeof categories === 'string') categories = [categories];
		categories = categories || ($('meta[name="parsely-tags"]').attr('content') ? $('meta[name="parsely-tags"]').attr('content')?.split(',').map(s => s.trim()) : []);

		// Reviews
		let reviews: string | number = '';
		if (jsonLd.aggregateRating && (jsonLd.aggregateRating.ratingValue || jsonLd.aggregateRating.reviewCount)) {
			reviews = jsonLd.aggregateRating.ratingValue || jsonLd.aggregateRating.reviewCount || '';
		}

		// Nutrition
		let nutrition: string = '';
		if (jsonLd.nutrition && typeof jsonLd.nutrition === 'object') {
			nutrition = Object.entries(jsonLd.nutrition).map(([k, v]) => `${k}: ${v}`).join('; ');
		}

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
			ingredients,
			instructions,
			author,
			image,
			prep_time: jsonLd.prepTime || '',
			cook_time: jsonLd.cookTime || '',
			total_time: jsonLd.totalTime || '',
			yield: yieldVal,
			categories,
			description,
			reviews,
			nutrition
		};
	}
}
