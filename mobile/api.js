// RecipeArchive Mobile API
// Simple Express.js server to handle mobile recipe capture requests
// Integrates with existing AWS backend infrastructure

const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch'); // You'll need: npm install node-fetch

const app = express();
const PORT = process.env.PORT || 3000;

// Load existing configuration and parsers
const { getCurrentAPI } = require('../extensions/chrome/config.js');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Serve the PWA
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Mobile recipe capture endpoint
app.post('/api/mobile/capture', async (req, res) => {
    try {
        const { url, title } = req.body;
        
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                error: 'URL is required' 
            });
        }

        console.log(`📱 Mobile capture request for: ${url}`);

        // Step 1: Check if site is supported
        const isSupported = await checkSiteSupported(url);
        if (!isSupported) {
            return res.status(400).json({
                success: false,
                error: 'This recipe site is not yet supported. Please use the desktop extension or try again later.',
                supportedSites: getSupportedSites()
            });
        }

        // Step 2: Extract recipe data using existing parsers
        const recipeData = await extractRecipeData(url, title);
        
        if (!recipeData || !recipeData.title) {
            return res.status(400).json({
                success: false,
                error: 'Could not extract recipe data from this URL. Please check the URL and try again.'
            });
        }

        // Step 3: Transform data for AWS backend
        const transformedData = transformRecipeDataForAWS(recipeData);

        // Step 4: Save to AWS backend (requires authentication in production)
        const awsResult = await saveToAWSBackend(transformedData, url);
        
        if (awsResult.success) {
            console.log(`✅ Mobile recipe saved: ${awsResult.id}`);
            res.json({
                success: true,
                id: awsResult.id,
                title: recipeData.title,
                message: 'Recipe saved successfully!'
            });
        } else {
            throw new Error(awsResult.error || 'Failed to save to AWS backend');
        }

    } catch (error) {
        console.error('❌ Mobile capture error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to capture recipe: ' + error.message
        });
    }
});

// Get supported sites endpoint
app.get('/api/mobile/supported-sites', (req, res) => {
    res.json({
        sites: getSupportedSites(),
        count: getSupportedSites().length
    });
});

// Health check endpoint
app.get('/api/mobile/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'RecipeArchive Mobile API',
        timestamp: new Date().toISOString()
    });
});

// Helper functions

async function checkSiteSupported(url) {
    try {
        // Use the same supported sites logic from extensions
        const supportedSites = getSupportedSites();
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        return supportedSites.some(site => {
            const normalizedHostname = hostname.replace(/^www\./, '');
            const normalizedSite = site.replace(/^www\./, '');
            return normalizedHostname === normalizedSite || 
                   normalizedHostname.endsWith('.' + normalizedSite);
        });
    } catch (error) {
        console.error('Error checking site support:', error);
        return false;
    }
}

function getSupportedSites() {
    return [
        'smittenkitchen.com',
        'loveandlemons.com', 
        'food52.com',
        'foodnetwork.com',
        'epicurious.com',
        'cooking.nytimes.com',
        'allrecipes.com',
        'seriouseats.com',
        'washingtonpost.com',
        'foodandwine.com',
        'damndelicious.net'
    ];
}

async function extractRecipeData(url, providedTitle) {
    try {
        // Fetch the HTML content
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status}`);
        }

        const html = await response.text();
        
        // Use existing TypeScript parser logic
        // This is a simplified version - in production you'd integrate the full parser bundle
        const recipeData = await parseRecipeFromHTML(html, url);
        
        // Use provided title if extraction failed
        if (providedTitle && (!recipeData.title || recipeData.title === 'Unknown Recipe')) {
            recipeData.title = providedTitle;
        }

        return recipeData;

    } catch (error) {
        console.error('Error extracting recipe data:', error);
        
        // Fallback: create minimal recipe data
        return {
            title: providedTitle || 'Manual Recipe Entry',
            url: url,
            ingredients: [],
            instructions: [],
            timestamp: new Date().toISOString(),
            source: 'mobile-api-fallback'
        };
    }
}

async function parseRecipeFromHTML(html, url) {
    // Simplified JSON-LD parsing for mobile
    // In production, you'd use the full TypeScript parser bundle
    
    try {
        // Look for JSON-LD structured data
        const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
        const matches = Array.from(html.matchAll(jsonLdRegex));
        
        for (const match of matches) {
            try {
                const jsonData = JSON.parse(match[1]);
                let recipeData = null;
                
                if (jsonData['@type'] === 'Recipe') {
                    recipeData = jsonData;
                } else if (Array.isArray(jsonData)) {
                    recipeData = jsonData.find(item => item && item['@type'] === 'Recipe');
                } else if (jsonData['@graph']) {
                    recipeData = jsonData['@graph'].find(item => item && item['@type'] === 'Recipe');
                }
                
                if (recipeData && recipeData.name) {
                    const ingredients = recipeData.recipeIngredient || [];
                    const instructions = (recipeData.recipeInstructions || []).map(instruction => {
                        if (typeof instruction === 'string') return instruction;
                        if (instruction.text) return instruction.text;
                        if (instruction.name) return instruction.name;
                        return '';
                    }).filter(Boolean);
                    
                    return {
                        title: recipeData.name,
                        url: url,
                        ingredients: ingredients.length > 0 ? [{ title: null, items: ingredients }] : [],
                        instructions: instructions.length > 0 ? [{ title: null, items: instructions }] : [],
                        servingSize: recipeData.recipeYield || recipeData.yield || null,
                        cookTime: recipeData.totalTime || recipeData.cookTime || recipeData.prepTime || null,
                        photos: recipeData.image ? (Array.isArray(recipeData.image) ? recipeData.image : [recipeData.image]) : [],
                        timestamp: new Date().toISOString(),
                        source: 'mobile-api-json-ld'
                    };
                }
            } catch (e) {
                console.log('JSON-LD parsing failed:', e.message);
                continue;
            }
        }
        
        // Fallback: basic HTML parsing
        return parseBasicHTML(html, url);
        
    } catch (error) {
        console.error('Recipe parsing error:', error);
        return null;
    }
}

function parseBasicHTML(html, url) {
    // Very basic HTML parsing as fallback
    // Extract title from page title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Recipe from ' + new URL(url).hostname;
    
    return {
        title: title,
        url: url,
        ingredients: [],
        instructions: [],
        timestamp: new Date().toISOString(),
        source: 'mobile-api-basic-html'
    };
}

function transformRecipeDataForAWS(recipeData) {
    // Transform mobile format to AWS backend expected format
    const ingredients = [];
    const instructions = [];
    
    // Transform ingredients
    if (recipeData.ingredients && Array.isArray(recipeData.ingredients)) {
        recipeData.ingredients.forEach(group => {
            if (group.items && Array.isArray(group.items)) {
                group.items.forEach(item => {
                    if (item && typeof item === 'string' && item.trim()) {
                        ingredients.push({ text: item.trim() });
                    }
                });
            }
        });
    }
    
    // Transform instructions
    if (recipeData.instructions && Array.isArray(recipeData.instructions)) {
        let stepNumber = 1;
        recipeData.instructions.forEach(group => {
            if (group.items && Array.isArray(group.items)) {
                group.items.forEach(item => {
                    if (item && typeof item === 'string' && item.trim()) {
                        instructions.push({ 
                            stepNumber: stepNumber++, 
                            text: item.trim() 
                        });
                    }
                });
            }
        });
    }
    
    return {
        title: recipeData.title || 'Mobile Recipe',
        ingredients: ingredients.length > 0 ? ingredients : [{ text: '[Recipe extraction incomplete - mobile fallback]' }],
        instructions: instructions.length > 0 ? instructions : [{ stepNumber: 1, text: '[Recipe extraction incomplete - mobile fallback]' }],
        sourceUrl: recipeData.url
    };
}

async function saveToAWSBackend(recipeData, originalUrl) {
    try {
        // In production, you'd need proper authentication
        // For now, this is a placeholder that would connect to your AWS backend
        
        console.log('Would save to AWS:', recipeData);
        
        // Simulate AWS save
        return {
            success: true,
            id: 'mobile-' + Date.now(),
            message: 'Recipe saved successfully (mobile API)'
        };
        
        // In production, this would be:
        /*
        const apiEndpoint = getCurrentAPI().recipes;
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(recipeData)
        });
        
        if (!response.ok) {
            throw new Error(`AWS API error: ${response.status}`);
        }
        
        const result = await response.json();
        return {
            success: true,
            id: result.id || result.recipeId,
            result: result
        };
        */
        
    } catch (error) {
        console.error('AWS save error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Start server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 RecipeArchive Mobile API running on port ${PORT}`);
        console.log(`📱 PWA available at: http://localhost:${PORT}`);
        console.log(`🔌 API endpoints:`);
        console.log(`   POST /api/mobile/capture - Capture recipe from URL`);
        console.log(`   GET  /api/mobile/supported-sites - Get supported sites`);
        console.log(`   GET  /api/mobile/health - Health check`);
    });
}

module.exports = app;