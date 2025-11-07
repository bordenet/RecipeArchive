import { BaseParser } from "./base-parser";
import { Recipe } from "./types";

export class ParserRegistry {
  private static instance: ParserRegistry | null = null;
  private parsers: BaseParser[] = [];

  constructor() {
    // Parsers are registered via registerParser() method
    // This allows the bundle build script to control which parsers are included
  }

  static getInstance(): ParserRegistry {
    if (!ParserRegistry.instance) {
      ParserRegistry.instance = new ParserRegistry();
    }
    return ParserRegistry.instance;
  }

  registerParser(urlPattern: string, parserClass: new () => BaseParser): void {
    const parser = new parserClass();
    this.parsers.push(parser);
  }

  async parseRecipe(html: string, url: string): Promise<Recipe | null> {
    // Find the first parser that can handle this URL
    const parser = this.parsers.find((p) => p.canParse(url));

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
    return this.parsers.find((p) => p.canParse(url)) || null;
  }
}
