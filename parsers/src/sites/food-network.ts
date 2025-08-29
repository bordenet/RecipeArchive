import * as cheerio from "cheerio";
import { BaseParser } from "../base-parser.js";
import { Recipe, Ingredient, Instruction } from "../types.js";

export class FoodNetworkParser extends BaseParser {
	canParse(url: string): boolean {
		return url.includes("foodnetwork.com");
	}

	async parse(html: string, url: string): Promise<Recipe> {
		if (html.includes('Page Not Found | Food Network') || html.includes('The page you\'re looking for seems to have disappeared!')) {
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
		const $ = cheerio.load(html);
		const jsonLd = this.extractJsonLD(html);
		let recipe: Recipe;
		if (jsonLd) {
			recipe = {
				title: this.sanitizeText(jsonLd.name),
				source_url: url,
				author: typeof jsonLd.author === "string" ? this.sanitizeText(jsonLd.author) : this.sanitizeText(jsonLd.author?.name) || "Food Network",
				ingredients: (jsonLd.recipeIngredient || []).map(i => ({ text: this.sanitizeText(i) })).filter(ing => typeof ing.text === 'string' && ing.text.length > 0),
				instructions: (jsonLd.recipeInstructions || []).map((i, idx) => ({ stepNumber: idx + 1, text: typeof i === "string" ? this.sanitizeText(i) : this.sanitizeText(i.text) })).filter(inst => typeof inst.text === 'string' && inst.text.length > 0),
				image: typeof jsonLd.image === "string" ? jsonLd.image : Array.isArray(jsonLd.image) ? (typeof jsonLd.image[0] === "string" ? jsonLd.image[0] : jsonLd.image[0]?.url) : jsonLd.image?.url,
				prep_time: jsonLd.prepTime,
				cook_time: jsonLd.cookTime,
				total_time: jsonLd.totalTime,
				yield: jsonLd.recipeYield?.toString() || '',
				categories: Array.isArray(jsonLd.recipeCategory) ? jsonLd.recipeCategory.map((c: string) => this.sanitizeText(c)) : (jsonLd.recipeCategory ? [this.sanitizeText(jsonLd.recipeCategory)] : []),
				description: jsonLd.description ? this.sanitizeText(jsonLd.description) : '',
				reviews: jsonLd.aggregateRating?.ratingValue || '',
				nutrition: jsonLd.nutrition ? JSON.stringify(jsonLd.nutrition) : ''
			};
		} else {
			// Fallback to DOM parsing for Food Network specific selectors
			let title = this.sanitizeText([
				$('h1.o-AssetTitle__a-HeadlineText').text(),
				$('h1.recipe-title').text(),
				$('h1').text()
			].find(t => t && t.trim().length > 0) || "");
			let author = this.sanitizeText([
				$('.o-Attribution__a-Name').text(),
				$('.recipe-author').text(),
				$('.chef-name').text()
			].find(a => a && a.trim().length > 0) || "Food Network");
			let fnIngredients: Ingredient[] = [];
			$('.o-Ingredients__a-Ingredient, .ingredients-list__item, .ingredient, .recipe-ingredients li, ul li, .entry-content ul li').each((_, el) => {
				let label = $(el).find('.o-Ingredients__a-Ingredient--CheckboxLabel').text().trim();
				if (!label) label = $(el).text().trim();
				if (label && label.toLowerCase() !== 'deselect all') {
					fnIngredients.push({ text: label });
				}
			});
			if (fnIngredients.length === 0) fnIngredients = [];
			let instructions: Instruction[] = [];
			$('.o-Method__m-Step, .instructions-list__item, .instruction, .recipe-instructions li, ol li, ul li, .entry-content ol li, .entry-content ul li').each((i, el) => {
				const text = $(el).text().trim();
				if (text) instructions.push({ stepNumber: i + 1, text });
			});
			let image = $('meta[property="og:image"]').attr('content') || '';
			let prep_time = '';
			let cook_time = '';
			let total_time = '';
			let yieldVal = '';
			let categories: string[] = [];
			let description = $('meta[name="description"]').attr('content') || '';
			let reviews = '';
			let nutrition = '';
			recipe = {
				title,
				source_url: url,
				author,
				ingredients: fnIngredients,
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
