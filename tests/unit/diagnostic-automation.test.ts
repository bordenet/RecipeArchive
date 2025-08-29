describe('Automated diagnostic coverage', () => {
import { SITE_REGISTRY } from '../../parsers/sites/site-registry';
import { loadParser, loadFixture, extractRecipeFromFixture } from './test-utils';
import { submitDiagnostic } from './diagnostic-api';

describe('Automated diagnostic coverage', () => {
  SITE_REGISTRY.forEach(site => {
    it(`should submit diagnostic payload on failed extraction for ${site.name}`, async () => {
      const ParserClass = loadParser(site.parserFile);
      const fixtureHtml = await loadFixture(site.fixtureFile);
      // Simulate a failure by passing empty HTML or corrupt data
      const result = extractRecipeFromFixture(ParserClass, '');
      const diagnosticPayload = {
        url: site.urlPattern,
        timestamp: new Date().toISOString(),
        extractionAttempt: {
          method: 'site-specific',
          timeElapsed: 0,
          elementsFound: {},
          partialData: result
        },
        htmlDump: '',
        domMetrics: {},
        failureReason: 'Extraction failed (empty HTML)'
      };
      const apiResult = await submitDiagnostic(diagnosticPayload);
      expect(apiResult).toBeDefined();
      // Optionally check for success/error in apiResult
    });
  });
});
