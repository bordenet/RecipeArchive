import { SmittenKitchenParser } from "./sites/smitten-kitchen";
import { FoodNetworkParser } from "./sites/food-network";
import { NYTCookingParser } from "./sites/nyt-cooking";
export class ParserRegistry {
    constructor() {
        this.parsers = [];
        // Register all parsers
        this.parsers.push(new SmittenKitchenParser(), new FoodNetworkParser(), new NYTCookingParser());
    }
    async parseRecipe(html, url) {
        // Find the first parser that can handle this URL
        const parser = this.parsers.find(p => p.canParse(url));
        if (!parser) {
            console.warn(`No parser found for URL: ${url}`);
            return null;
        }
        try {
            const recipe = await parser.parse(html, url);
            return recipe;
        }
        catch (err) {
            console.error(`Error parsing recipe from ${url}:`, err);
            return null;
        }
    }
    getParserForUrl(url) {
        return this.parsers.find(p => p.canParse(url)) || null;
    }
}
