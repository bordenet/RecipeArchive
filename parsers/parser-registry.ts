import { BaseParser } from "./base-parser";
import { SmittenKitchenParser } from "./sites/smitten-kitchen";
import { FoodNetworkParser } from "./sites/food-network";
import { NYTCookingParser } from "./sites/nyt-cooking";
import { AllRecipesParser } from "./sites/allrecipes";
import { LoveAndLemonsParser } from "./sites/loveandlemons";
import { Food52Parser } from "./sites/food52";
import { EpicuriousParser } from "./sites/epicurious";
import { WashingtonPostParser } from "./sites/washington-post";
import { FoodAndWineParser } from "./sites/food-and-wine";
import { DamnDeliciousParser } from "./sites/damn-delicious";
import { SeriousEatsParser } from "./sites/serious-eats";
import { Recipe } from "./types";

export class ParserRegistry {
    private parsers: BaseParser[] = [];

    constructor() {
        // Register all parsers
        this.parsers.push(
            new SmittenKitchenParser(),
            new FoodNetworkParser(),
            new NYTCookingParser(),
            new AllRecipesParser(),
            new LoveAndLemonsParser(),
            new Food52Parser(),
            new EpicuriousParser(),
            new WashingtonPostParser(),
            new FoodAndWineParser(),
            new DamnDeliciousParser(),
            new SeriousEatsParser()
        );
    }

    async parseRecipe(html: string, url: string): Promise<Recipe | null> {
        // Find the first parser that can handle this URL
        const parser = this.parsers.find(p => p.canParse(url));

        if (!parser) {
            console.warn(`No parser found for URL: ${url}`);
            return null;
        }

        try {
            const recipe = await parser.parse(html, url);
            return recipe;
        } catch (err) {
            console.error(`Error parsing recipe from ${url}:`, err);
            return null;
        }
    }

    getParserForUrl(url: string): BaseParser | null {
        return this.parsers.find(p => p.canParse(url)) || null;
    }
}
