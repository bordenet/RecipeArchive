import { BaseParser } from '../base-parser.js';
import * as cheerio from 'cheerio';
import { Recipe } from '../types';

class Food52Parser extends BaseParser {
	canParse(url: string): boolean {
		return /food52\.com\/recipes\//.test(url);
	}

	async parse(html: string, url: string): Promise<Recipe> {
		const $ = cheerio.load(html);
		// Title
		const title = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content') || '';

		// Author
		let author = '';
		// Try JSON-LD first
		const jsonLd = this.extractJsonLD(html);
		if (jsonLd && jsonLd.author && typeof jsonLd.author === 'object' && jsonLd.author.name && jsonLd.author.name !== 'null') {
			author = jsonLd.author.name;
		}
		if (!author) {
			// Try DOM link
			const authorLink = $('a[href*="/author/"]').first().text().trim();
			if (authorLink) author = authorLink;
		}
		if (!author) {
			author = $('[class*="author"], .byline, .entry-author').first().text().trim();
		}
		if (!author) {
			author = $('meta[name="author"]').attr('content') || '';
		}

		// Ingredients
		let ingredients: string[] = [];
		$('[class*="ingredient"], .recipe__ingredient, .ingredients li').each((_, el) => {
			const text = $(el).text().trim();
			if (text) ingredients.push(text);
		});
		if (ingredients.length === 0 && jsonLd && Array.isArray(jsonLd.recipeIngredient)) {
			ingredients = jsonLd.recipeIngredient.map((i: string) => String(i).trim());
		}

		// Instructions
		let instructions: string[] = [];
		$('[class*="instruction"], .recipe__instruction, .instructions li').each((_, el) => {
			const text = $(el).text().trim();
			if (text) instructions.push(text);
		});
		if (instructions.length === 0 && jsonLd && Array.isArray(jsonLd.recipeInstructions)) {
			instructions = jsonLd.recipeInstructions.map((i: string | { text?: string }) => typeof i === 'string' ? i.trim() : (i.text || '').trim());
		}

	let imageUrl: string | undefined = undefined;
	if (jsonLd && jsonLd.image) {
		if (typeof jsonLd.image === 'string') {
			imageUrl = jsonLd.image;
		} else if (Array.isArray(jsonLd.image)) {
			imageUrl = typeof jsonLd.image[0] === 'string' ? jsonLd.image[0] : (jsonLd.image[0]?.url || undefined);
		} else if (typeof jsonLd.image === 'object' && jsonLd.image.url) {
			imageUrl = jsonLd.image.url;
		}
	}
	if (!imageUrl) {
		imageUrl = $('meta[property="og:image"]').attr('content') || $('img.recipe__image, .main-image').attr('src') || undefined;
	}

	// Times
	const prepTime = (jsonLd && jsonLd.prepTime) || $('meta[itemprop="prepTime"]').attr('content') || $('dt:contains("Prep Time")').next('dd').text().trim() || '';
	const cookTime = (jsonLd && jsonLd.cookTime) || $('meta[itemprop="cookTime"]').attr('content') || $('dt:contains("Cook Time")').next('dd').text().trim() || '';
	const totalTime = (jsonLd && jsonLd.totalTime) || $('meta[itemprop="totalTime"]').attr('content') || '';

	// Servings / Yield
	const servings = (jsonLd && jsonLd.recipeYield) || $('[class*="servings"], .recipe__servings').first().text().trim() || $('dt:contains("Serves")').next('dd').text().trim() || '';

		// Categories/Tags
		let tags: string[] = [];
		if (jsonLd && jsonLd.recipeCategory) {
			if (Array.isArray(jsonLd.recipeCategory)) {
				tags = tags.concat(jsonLd.recipeCategory.map((c: string) => c.trim()));
			} else if (typeof jsonLd.recipeCategory === 'string') {
				tags.push(jsonLd.recipeCategory.trim());
			}
		}
		if (jsonLd && jsonLd.keywords) {
			if (typeof jsonLd.keywords === 'string') {
				tags = tags.concat(jsonLd.keywords.split(',').map((k: string) => k.trim()));
			}
		}
		$('[class*="tag"], .recipe__tag, .tags li').each((_, el) => {
			const text = $(el).text().trim();
			if (text) tags.push(text);
		});

		// Notes
		const notes: string[] = [];
		$('[class*="note"], .recipe__note, .notes li').each((_, el) => {
			const text = $(el).text().trim();
			if (text) notes.push(text);
		});

		// Description
		const description = $('meta[name="description"]').attr('content') || '';

		// Map to contract types
		const mappedIngredients = ingredients.map(text => ({ text }));
		const mappedInstructions = instructions.map((text, idx) => ({ stepNumber: idx + 1, text }));

	// Nutrition
	let nutrition = '';
	// Reviews
	let reviews: string | number = '';

		// Contract enforcement: ensure required fields
		return {
			title: title || 'Untitled',
			source_url: url,
			author: author || undefined,
			ingredients: mappedIngredients,
			instructions: mappedInstructions,
			image: imageUrl,
			prep_time: prepTime,
			cook_time: cookTime,
			total_time: totalTime,
			yield: servings,
			categories: tags,
			description,
			nutrition,
			reviews,
		};
	}
}

export default Food52Parser;
