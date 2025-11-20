# Browser Extensions

**Production-ready** Chrome and Safari extensions for capturing recipes from supported websites with intelligent parsing and automatic authentication. Part of the complete RecipeArchive cross-platform ecosystem.

## Supported Sites (14)

Smitten Kitchen, Food Network, NYT Cooking, Food52, AllRecipes, Epicurious, Serious Eats, Love & Lemons, Washington Post, Food & Wine, Damn Delicious, Alexandra's Kitchen, Lemons and Zest

## Development

```bash
# Build extensions
npm run build:extensions

# Test parsers
npm run test:parsers

# Package for distribution
./scripts/package-extensions.sh
```

## Environment Configuration

- **Development:** Auto-detected on localhost
- **Production:** Default for all other environments
- **Override:** `localStorage.setItem('recipeArchive.dev', 'true')`

## Features

- Intelligent recipe detection and parsing
- JSON-LD and HTML extraction support
- AWS Cognito authentication integration
- Automatic API environment switching
- Comprehensive parser test coverage (32+ tests)
- Cross-platform sync with web and mobile apps
- Production-ready for browser extension stores

## Integration

Extensions integrate seamlessly with:
- **Web App**: https://your-cloudfront-distribution-id.cloudfront.net (from `.env` WEB_APP_URL)
- **Mobile Apps**: Android and iOS Flutter applications
- **AWS Backend**: Real-time sync and cloud storage

See individual `chrome/` and `safari/` directories for platform-specific setup instructions.