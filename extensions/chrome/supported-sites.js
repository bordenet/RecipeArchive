// Supported Recipe Sites Configuration
// This file defines which sites the extensions should work on

const SUPPORTED_SITES = [
    "smittenkitchen.com",
    "loveandlemons.com", 
    "food52.com",
    "foodnetwork.com",
    "epicurious.com",
    "cooking.nytimes.com",
    "allrecipes.com",
    "seriouseats.com",
    "washingtonpost.com",
    "foodandwine.com",
    "damndelicious.net"
];

/**
 * Check if a URL is from a supported recipe site
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the site is supported
 */
function isSupportedSite(url) {
    if (!url || typeof url !== "string") {
        return false;
    }
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        return SUPPORTED_SITES.some(site => {
            // Remove 'www.' prefix for comparison
            const normalizedHostname = hostname.replace(/^www\./, "");
            const normalizedSite = site.replace(/^www\./, "");
            
            return normalizedHostname === normalizedSite || 
                   normalizedHostname.endsWith("." + normalizedSite);
        });
    } catch (error) {
        console.warn("Invalid URL provided to isSupportedSite:", url, error);
        return false;
    }
}

/**
 * Get the list of supported sites for display
 * @returns {string[]} - Array of supported site domains
 */
function getSupportedSites() {
    return [...SUPPORTED_SITES];
}

// Export functions based on environment
if (typeof module !== "undefined" && module.exports) {
    // Node.js environment
    module.exports = {
        isSupportedSite,
        getSupportedSites,
        SUPPORTED_SITES
    };
} else {
    // Browser environment
    window.RecipeArchiveSites = {
        isSupportedSite,
        getSupportedSites,
        SUPPORTED_SITES
    };
}