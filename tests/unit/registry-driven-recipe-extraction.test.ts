import { SITE_REGISTRY } from '../../parsers/sites/site-registry';
import { loadParser, loadFixture, extractRecipeFromFixture, matchRecipeContract } from './test-utils';

describe('Registry-driven recipe extraction', () => {
  SITE_REGISTRY.forEach(site => {
    it(`should extract recipe from fixture for ${site.name}`, async () => {
      const ParserClass = loadParser(site.parserFile);
      const fixtureHtml = await loadFixture(site.fixtureFile);
      const result = extractRecipeFromFixture(ParserClass, fixtureHtml);
      expect(matchRecipeContract(result)).toBe(true);
    });
  });
});
