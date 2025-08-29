const { DamnDeliciousParser } = require("../../parsers/sites/damn-delicious.ts");
const fs = require("fs");

const html = fs.readFileSync("tests/fixtures/html-samples/damn-delicious-sample.html", "utf8");
const url = "https://damndelicious.net/recipe-url-placeholder";

(async () => {
    const parser = new DamnDeliciousParser();
    const recipe = await parser.parse(html, url);
    console.log(JSON.stringify(recipe, null, 2));
})();
