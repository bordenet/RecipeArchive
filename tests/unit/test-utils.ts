import * as fs from 'fs';
import * as path from 'path';

export async function loadFixture(fixtureFile: string): Promise<string> {
  const fixturePath = path.resolve(__dirname, '../fixtures/html-samples', fixtureFile);
  return fs.promises.readFile(fixturePath, 'utf-8');
}

export function loadParser(parserFile: string) {
  // Dynamically import the parser module
  // NOTE: This assumes parsers are exported as default classes
  // You may need to adjust for your actual parser export style
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(path.resolve(__dirname, '../../parsers/sites', parserFile)).default;
}

export function extractRecipeFromFixture(ParserClass: any, html: string) {
  // Instantiate parser and run extraction
  const parser = new ParserClass();
  return parser.parse(html);
}

export function matchRecipeContract(recipe: any): boolean {
  // Basic contract validation: title, ingredients, instructions
  return (
    typeof recipe.title === 'string' && recipe.title.length > 0 &&
    Array.isArray(recipe.ingredients) && recipe.ingredients.length >= 2 &&
    Array.isArray(recipe.instructions) && recipe.instructions.length >= 2
  );
}
