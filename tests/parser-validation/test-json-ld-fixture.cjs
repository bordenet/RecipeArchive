const { JsonLdParser } = require("../../parsers/sites/json-ld.ts");
const fs = require("fs");

const html = fs.readFileSync("tests/fixtures/html-samples/json-ld-sample.html", "utf8");
const url = "https://generic-recipe-site.com/chocolate-chip-cookies";

(async () => {
    const parser = new JsonLdParser();
    const recipe = await parser.parse(html, url);
    console.log(JSON.stringify(recipe, null, 2));
})();
