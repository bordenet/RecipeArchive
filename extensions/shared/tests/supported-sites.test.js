const { isSupportedSite, getSupportedSites, SUPPORTED_SITES } = require("../supported-sites");

describe("Supported Sites", () => {
  describe("SUPPORTED_SITES array", () => {
    it("should contain expected recipe sites", () => {
      expect(SUPPORTED_SITES).toContain("smittenkitchen.com");
      expect(SUPPORTED_SITES).toContain("loveandlemons.com");
      expect(SUPPORTED_SITES).toContain("food52.com");
      expect(SUPPORTED_SITES).toContain("foodnetwork.com");
      expect(SUPPORTED_SITES).toContain("epicurious.com");
      expect(SUPPORTED_SITES).toContain("cooking.nytimes.com");
      expect(SUPPORTED_SITES).toContain("allrecipes.com");
      expect(SUPPORTED_SITES).toContain("seriouseats.com");
    });

    it("should have at least 10 supported sites", () => {
      expect(SUPPORTED_SITES.length).toBeGreaterThanOrEqual(10);
    });

    it("should not contain duplicates", () => {
      const uniqueSites = [...new Set(SUPPORTED_SITES)];
      expect(uniqueSites.length).toBe(SUPPORTED_SITES.length);
    });
  });

  describe("isSupportedSite function", () => {
    describe("valid supported sites", () => {
      it("should return true for smittenkitchen.com", () => {
        expect(isSupportedSite("https://smittenkitchen.com/recipe")).toBe(true);
      });

      it("should return true for www.smittenkitchen.com", () => {
        expect(isSupportedSite("https://www.smittenkitchen.com/recipe")).toBe(true);
      });

      it("should return true for food52.com", () => {
        expect(isSupportedSite("https://food52.com/recipes/12345")).toBe(true);
      });

      it("should return true for cooking.nytimes.com", () => {
        expect(isSupportedSite("https://cooking.nytimes.com/recipes/12345")).toBe(true);
      });

      it("should return true for allrecipes.com", () => {
        expect(isSupportedSite("https://www.allrecipes.com/recipe/12345/")).toBe(true);
      });

      it("should return true for epicurious.com", () => {
        expect(isSupportedSite("https://www.epicurious.com/recipes/food/views/test")).toBe(true);
      });

      it("should return true for seriouseats.com", () => {
        expect(isSupportedSite("https://www.seriouseats.com/recipes/test")).toBe(true);
      });

      it("should return true for foodnetwork.com", () => {
        expect(isSupportedSite("https://www.foodnetwork.com/recipes/test")).toBe(true);
      });
    });

    describe("invalid or unsupported sites", () => {
      it("should return false for unsupported site", () => {
        expect(isSupportedSite("https://www.example.com/recipe")).toBe(false);
      });

      it("should return false for google.com", () => {
        expect(isSupportedSite("https://www.google.com")).toBe(false);
      });

      it("should return false for empty string", () => {
        expect(isSupportedSite("")).toBe(false);
      });

      it("should return false for null", () => {
        expect(isSupportedSite(null)).toBe(false);
      });

      it("should return false for undefined", () => {
        expect(isSupportedSite(undefined)).toBe(false);
      });

      it("should return false for non-string input", () => {
        expect(isSupportedSite(12345)).toBe(false);
      });

      it("should return false for invalid URL", () => {
        expect(isSupportedSite("not-a-valid-url")).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("should handle URLs with query parameters", () => {
        expect(isSupportedSite("https://food52.com/recipes/12345?ref=search")).toBe(true);
      });

      it("should handle URLs with hash fragments", () => {
        expect(isSupportedSite("https://smittenkitchen.com/recipe#comments")).toBe(true);
      });

      it("should handle URLs with different protocols", () => {
        expect(isSupportedSite("http://food52.com/recipes/12345")).toBe(true);
      });

      it("should be case-insensitive for hostnames", () => {
        expect(isSupportedSite("https://FOOD52.COM/recipes/12345")).toBe(true);
        expect(isSupportedSite("https://Food52.com/recipes/12345")).toBe(true);
      });

      it("should handle subdomains correctly", () => {
        // cooking.nytimes.com should be supported
        expect(isSupportedSite("https://cooking.nytimes.com/recipes/12345")).toBe(true);
        // but www.nytimes.com should not be (only cooking subdomain)
        expect(isSupportedSite("https://www.nytimes.com/article")).toBe(false);
      });
    });
  });

  describe("getSupportedSites function", () => {
    it("should return a copy of SUPPORTED_SITES array", () => {
      const sites = getSupportedSites();
      expect(Array.isArray(sites)).toBe(true);
      expect(sites).toEqual(SUPPORTED_SITES);
    });

    it("should return a new array (not the original)", () => {
      const sites = getSupportedSites();
      sites.push("test.com");
      expect(SUPPORTED_SITES).not.toContain("test.com");
    });
  });
});

