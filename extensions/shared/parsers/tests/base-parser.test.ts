import { BaseParser } from '../base-parser';
import { Recipe } from '../types';

class TestParser extends BaseParser {
    canParse(url: string): boolean {
        const validDomains = ['test.com', 'www.test.com'];
        try {
            const domain = new URL(url).hostname;
            return validDomains.includes(domain);
        } catch {
            return false;
        }
    }

    async parse(html: string, url: string): Promise<Recipe> {
        return {
            title: 'Test Recipe',
            source: url,
            ingredients: ['ingredient 1', 'ingredient 2'],
            instructions: ['step 1', 'step 2'],
            author: 'Test Author',
            servings: '4 servings',
            prepTime: '10 minutes',
            cookTime: '20 minutes',
            totalTime: '30 minutes',
            imageUrl: 'https://test.com/image.jpg',
            tags: ['test', 'recipe']
        };
    }
}

describe('BaseParser', () => {
    let parser: TestParser;

    beforeEach(() => {
        parser = new TestParser();
    });

    describe('canParse', () => {
        it('should return true for matching domains', () => {
            expect(parser.canParse('https://test.com/recipe')).toBe(true);
            expect(parser.canParse('https://www.test.com/recipe')).toBe(true);
        });

        it('should return false for non-matching domains', () => {
            expect(parser.canParse('https://other.com/recipe')).toBe(false);
            expect(parser.canParse('https://test.org/recipe')).toBe(false);
        });

        it('should handle invalid URLs', () => {
            expect(parser.canParse('not-a-url')).toBe(false);
            expect(parser.canParse('')).toBe(false);
        });
    });

    describe('extractJsonLD', () => {
        it('should extract JSON-LD recipe data from HTML', async () => {
            const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org/",
                "@type": "Recipe",
                "name": "Test Recipe",
                "recipeIngredient": ["ingredient 1", "ingredient 2"],
                "recipeInstructions": ["step 1", "step 2"]
              }
            </script>
          </head>
          <body></body>
        </html>
      `;

            const jsonLd = parser['extractJsonLD'](html);
            expect(jsonLd).not.toBeNull();
            expect(jsonLd?.name).toBe('Test Recipe');
        });

        it('should handle missing JSON-LD data', () => {
            const html = '<html><body>No JSON-LD here</body></html>';
            const jsonLd = parser['extractJsonLD'](html);
            expect(jsonLd).toBeNull();
        });

        it('should handle invalid JSON-LD', () => {
            const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {invalid json}
            </script>
          </head>
          <body></body>
        </html>
      `;

            const jsonLd = parser['extractJsonLD'](html);
            expect(jsonLd).toBeNull();
        });
    });
});
