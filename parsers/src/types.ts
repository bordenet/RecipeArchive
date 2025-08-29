// Recipe data structure types
export interface Ingredient {
	text: string;
}

export interface Instruction {
	stepNumber: number;
	text: string;
}

export interface Recipe {
	// Required fields
	title: string;       // Required, max 200 chars
	source_url: string;  // Required, valid URL of the original recipe
	ingredients: Ingredient[]; // Required, non-empty list
	instructions: Instruction[]; // Required, non-empty list
	author?: string;     // Author name
	image?: string;      // URL to recipe image
	prep_time?: string;  // ISO 8601 duration preferred
	cook_time?: string;  // ISO 8601 duration preferred
	total_time?: string; // ISO 8601 duration preferred
	yield?: string;      // Number or descriptive text
	categories?: string[]; // Recipe categories/keywords
	description?: string; // Recipe description
	reviews?: string | number; // Ratings or reviews
	nutrition?: string;  // Nutrition info
}

export interface ValidationResult {
	isValid: boolean;
	missingFields: string[];
	invalidFields: string[];
	warnings: string[];
	fieldErrors: {
		[key: string]: {
			code: string;
			message: string;
			value?: any;
		}
	};
}

export interface JsonLdRecipe {
	"@type": string;
	"@graph"?: JsonLdRecipe[];
	name?: string;
	author?: string | { name: string };
	recipeIngredient?: string[];
	recipeInstructions?: (string | { text: string })[];
	image?: string | { url: string } | (string | { url: string })[];
	prepTime?: string;
	cookTime?: string;
	totalTime?: string;
	recipeYield?: string;
	description?: string;
	keywords?: string | string[];
	recipeCategory?: string | string[];
	aggregateRating?: { ratingValue?: string | number; reviewCount?: string | number };
	nutrition?: { [key: string]: any };
}
