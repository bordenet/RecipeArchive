#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building TypeScript parser bundle for browser extensions...');

// Define paths
const projectRoot = path.join(__dirname, '..');
const parsersDir = path.join(projectRoot, 'parsers');
const entryFile = path.join(parsersDir, 'index.ts');
const chromeBundle = path.join(projectRoot, 'extensions/chrome/typescript-parser-bundle.js');
const safariBundle = path.join(projectRoot, 'extensions/safari/typescript-parser-bundle.js');

// Create a simple entry point that exports all parsers
const entryContent = `
// TypeScript Parser Bundle Entry Point
import { ParserRegistry } from './parser-registry';
import { SmittenKitchenParser } from './sites/smitten-kitchen';
import { FoodNetworkParser } from './sites/food-network';
import { NYTCookingParser } from './sites/nyt-cooking';
import { Food52Parser } from './sites/food52';
import { SeriousEatsParser } from './sites/serious-eats';
import { AllRecipesParser } from './sites/allrecipes';
import { EpicuriousParser } from './sites/epicurious';
import { DamnDeliciousParser } from './sites/damn-delicious';
import { LoveAndLemonsParser } from './sites/loveandlemons';
import { FoodAndWineParser } from './sites/food-and-wine';
import { WashingtonPostParser } from './sites/washington-post';
import { AlexandrasKitchenParser } from './sites/alexandras-kitchen';

// Initialize registry
const registry = ParserRegistry.getInstance();

// Register all parsers
registry.registerParser('smittenkitchen.com', SmittenKitchenParser);
registry.registerParser('foodnetwork.com', FoodNetworkParser);
registry.registerParser('cooking.nytimes.com', NYTCookingParser);
registry.registerParser('food52.com', Food52Parser);
registry.registerParser('seriouseats.com', SeriousEatsParser);
registry.registerParser('allrecipes.com', AllRecipesParser);
registry.registerParser('epicurious.com', EpicuriousParser);
registry.registerParser('damndelicious.net', DamnDeliciousParser);
registry.registerParser('loveandlemons.com', LoveAndLemonsParser);
registry.registerParser('foodandwine.com', FoodAndWineParser);
registry.registerParser('washingtonpost.com', WashingtonPostParser);
registry.registerParser('alexandracooks.com', AlexandrasKitchenParser);

// Export for browser use
if (typeof window !== 'undefined') {
    window.RecipeArchiveParserRegistry = registry;
    
    // Compatibility interface for content scripts
    window.TypeScriptParser = {
        async extractRecipeFromPage() {
            const url = window.location.href;
            const html = document.documentElement.outerHTML;
            
            try {
                const result = await registry.parseRecipe(html, url);
                
                if (!result) {
                    return {
                        title: document.title || "Unknown Recipe",
                        url: url,
                        timestamp: new Date().toISOString(),
                        ingredients: [],
                        steps: [],
                        source: "no-parser-found"
                    };
                }
                
                return result;
            } catch (error) {
                console.error("TypeScriptParser extraction failed:", error);
                return {
                    title: document.title || "Unknown Recipe",
                    url: url,
                    timestamp: new Date().toISOString(),
                    ingredients: [],
                    steps: [],
                    source: "extraction-error",
                    error: error.message
                };
            }
        }
    };
}

console.log("🎯 TypeScript parser bundle loaded");
`;

// Write entry file
console.log('📝 Creating entry file...');
fs.writeFileSync(entryFile, entryContent);

try {
    // Run esbuild to create bundle, explicitly setting working directory to parsers
    console.log('⚙️  Building bundle with esbuild...');
    const command = `npx esbuild "${entryFile}" --bundle --format=iife --outfile="${chromeBundle}" --platform=browser --target=es2020 --loader:.ts=ts`;
    execSync(command, { cwd: parsersDir, stdio: 'inherit' });
    
    // Copy to Safari extension
    console.log('📋 Copying bundle to Safari extension...');
    fs.copyFileSync(chromeBundle, safariBundle);
    
    console.log('✅ Parser bundle built successfully!');
    console.log(`   Chrome: ${chromeBundle}`);
    console.log(`   Safari: ${safariBundle}`);
    
    // Clean up entry file
    fs.unlinkSync(entryFile);
    
} catch (error) {
    console.error('❌ Bundle build failed:', error.message);
    // Clean up entry file on error
    if (fs.existsSync(entryFile)) {
        fs.unlinkSync(entryFile);
    }
    process.exit(1);
}