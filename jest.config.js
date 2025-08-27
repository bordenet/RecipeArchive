export default {
    preset: "ts-jest",
    testEnvironment: "jsdom",
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
    setupFilesAfterEnv: ["<rootDir>/extensions/shared/parsers/tests/setup.ts"],
    testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"]
};
