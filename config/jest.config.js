export default {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    rootDir: "..", // Set root directory to parent since config is now in subdirectory
    moduleNameMapper: {
        "^@shared/(.*)$": "<rootDir>/extensions/shared/$1"
    },
    transform: {
        "^.+\\.tsx?$": ["ts-jest", {
            useESM: true
        }]
    },
    extensionsToTreatAsEsm: [".ts", ".tsx"],
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    // setupFilesAfterEnv: ["<rootDir>/extensions/shared/parsers/tests/setup.ts"], // Disabled due to JSDOM compatibility issues
    testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"],
    testPathIgnorePatterns: [
        "/external-references/RecipeClipper/",
        "/external-references/sharp-recipe-parser/",
        "/tests/automation/extension-tests/",
        "/tests/automation/browser-startup-debug.spec.js",
        "/tests/automation/extension-debug.spec.js"
    ]
};
