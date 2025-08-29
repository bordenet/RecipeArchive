const { FoodAndWineParser } = require("../../parsers/sites/food-and-wine.ts");
const fs = require("fs");

const html = fs.readFileSync("tests/fixtures/html-samples/food-and-wine-sample.html", "utf8");
const url = "https://www.foodandwine.com/melted-ice-cream-cake-11743051";

(async () => {
    const parser = new FoodAndWineParser();
    const recipe = await parser.parse(html, url);
    console.log(JSON.stringify(recipe, null, 2));
})();
