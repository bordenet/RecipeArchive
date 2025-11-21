import { SITE_REGISTRY, RecipeSite } from "../sites/site-registry";

describe("Site Registry", () => {
  it("should export SITE_REGISTRY array", () => {
    expect(SITE_REGISTRY).toBeDefined();
    expect(Array.isArray(SITE_REGISTRY)).toBe(true);
  });

  it("should have at least 10 registered sites", () => {
    expect(SITE_REGISTRY.length).toBeGreaterThanOrEqual(10);
  });

  it("should have valid structure for all sites", () => {
    SITE_REGISTRY.forEach((site: RecipeSite) => {
      expect(site.name).toBeDefined();
      expect(typeof site.name).toBe("string");
      expect(site.name.length).toBeGreaterThan(0);

      expect(site.urlPattern).toBeDefined();
      expect(typeof site.urlPattern).toBe("string");
      expect(site.urlPattern.length).toBeGreaterThan(0);

      expect(site.parserFile).toBeDefined();
      expect(typeof site.parserFile).toBe("string");
      expect(site.parserFile).toMatch(/\.ts$/);

      expect(site.fixtureFile).toBeDefined();
      expect(typeof site.fixtureFile).toBe("string");
      expect(site.fixtureFile).toMatch(/\.html$/);

      expect(site.status).toBeDefined();
      expect(["production", "planned", "legacy"]).toContain(site.status);
    });
  });

  it("should have unique site names", () => {
    const names = SITE_REGISTRY.map((site) => site.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("should have unique URL patterns", () => {
    const patterns = SITE_REGISTRY.map((site) => site.urlPattern);
    const uniquePatterns = new Set(patterns);
    expect(uniquePatterns.size).toBe(patterns.length);
  });

  it("should include common recipe sites", () => {
    const siteNames = SITE_REGISTRY.map((site) => site.name.toLowerCase());
    
    expect(siteNames.some((name) => name.includes("allrecipes"))).toBe(true);
    expect(siteNames.some((name) => name.includes("food network"))).toBe(true);
    expect(siteNames.some((name) => name.includes("nyt"))).toBe(true);
  });

  it("should have paywall information for all sites", () => {
    SITE_REGISTRY.forEach((site: RecipeSite) => {
      expect(site.paywall !== undefined).toBe(true);
    });
  });
});

