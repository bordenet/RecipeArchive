// Central registry for all supported recipe sites
export interface RecipeSite {
  name: string;
  urlPattern: string;
  parserFile: string;
  fixtureFile: string;
  paywall?: boolean | string;
  status: "production" | "planned" | "legacy";
}

export const SITE_REGISTRY: RecipeSite[] = [
  {
    name: "Smitten Kitchen",
    urlPattern: "smittenkitchen.com",
    parserFile: "smitten-kitchen.ts",
    fixtureFile: "smitten-kitchen-sample.html",
    paywall: false,
    status: "production"
  },
  {
    name: "Food Network",
    urlPattern: "foodnetwork.com",
    parserFile: "food-network.ts",
    fixtureFile: "food-network-sample.html",
    paywall: false,
    status: "production"
  },
  {
    name: "NYT Cooking",
    urlPattern: "cooking.nytimes.com",
    parserFile: "nyt-cooking.ts",
    fixtureFile: "nyt-cooking-sample.html",
    paywall: false,
    status: "production"
  },
  {
    name: "Washington Post",
    urlPattern: "washingtonpost.com",
    parserFile: "washington-post.ts",
    fixtureFile: "washington-post-sample.html",
    paywall: "Cookie auth required for live tests; offline HTML fixture for CI",
    status: "production"
  },
  {
    name: "Love & Lemons",
    urlPattern: "loveandlemons.com",
    parserFile: "loveandlemons.ts",
    fixtureFile: "love-lemons-sample.html",
    paywall: false,
    status: "production"
  },
  {
    name: "Food52",
    urlPattern: "food52.com",
    parserFile: "food52.ts",
    fixtureFile: "food52-Confit-Red-Pepper-and-Tomato-Pasta-Sauce-Recipe.html",
    paywall: false,
    status: "production"
  },
  {
    name: "AllRecipes",
    urlPattern: "allrecipes.com",
    parserFile: "allrecipes.ts",
    fixtureFile: "allrecipes-sample.html",
    paywall: false,
    status: "production"
  },
  {
    name: "Epicurious",
    urlPattern: "epicurious.com",
    parserFile: "epicurious.ts",
    fixtureFile: "epicurious-sample.html",
    paywall: false,
    status: "production"
  },
  {
    name: "Serious Eats",
    urlPattern: "seriouseats.com",
    parserFile: "serious-eats.ts",
    fixtureFile: "serious-eats-sample.html",
    paywall: false,
    status: "production"
  },
  {
    name: "Alexandra's Kitchen",
    urlPattern: "alexandracooks.com",
    parserFile: "alexandras-kitchen.ts",
    fixtureFile: "alexandras-kitchen-sample-2.html",
    paywall: false,
    status: "production"
  },
  {
  name: "Food & Wine",
  urlPattern: "foodandwine.com",
  parserFile: "food-and-wine.ts",
  fixtureFile: "food-and-wine-sample.html",
  paywall: false,
  status: "production"
  },
  {
  name: "Damn Delicious",
  urlPattern: "damndelicious.net",
  parserFile: "damn-delicious.ts",
  fixtureFile: "damn-delicious-sample.html",
  paywall: false,
  status: "production"
  },
  {
  name: "JSON-LD Sites",
  urlPattern: "(universal)",
  parserFile: "json-ld.ts",
  fixtureFile: "json-ld-sample.html",
  paywall: false,
  status: "production"
  }
];
