# 🍽️ RecipeArchive

**See also:** [Website Parsers Architecture Decision Record](./architecture/website-parsers.md)

**Registry-Driven, Production-Ready: All Supported Sites Migrated & Validated**

Stop screenshotting recipes like a caveperson! RecipeArchive is your handy little sous chef that captures, stores, and syncs your culinary discoveries across all your devices. Because losing that perfect brownie recipe to a broken bookmark is basically a crime against dessert.

## 🚀 Quick Start

### One-Command Setup

```bash
# Clone and setup everything automatically
git clone https://github.com/yourusername/RecipeArchive
cd RecipeArchive
./dev-tools/setup-local-env.sh
```

### Local Development (Zero AWS Costs)

# Start local development server

cd aws-backend/functions/local-server
go run main.go

# Run comprehensive test suite

npm test

```

**Local Development Features:**
- 🏠 **Local API Server**: http://localhost:8080/api/recipes
- 🔐 **Mock Authentication**: Use any Bearer token
- 💾 **In-Memory Database**: No setup required
- 🌐 **CORS Enabled**: Works with browser extensions
- 💰 **Zero AWS Costs**: Develop without spending money

## 🎯 What We're Building

A cross-platform recipe archiving system currently featuring:

- 🔌 **Browser Extensions** - Chrome & Safari extensions for one-click recipe archiving (PRODUCTION READY)
- ☁️ **AWS Backend** - Go-based serverless backend with local development server (LOCAL DEVELOPMENT COMPLETE)

**🚧 Planned Components:**
- 📱 **iOS App** - Native mobile recipe browsing
- 🌐 **Web App** - Recipe management and meal planning interface

## 🚀 The Big Picture

Turn recipe chaos into culinary zen with:

- **Lightning-fast capture** - Grab ingredients, steps, photos, and timing in seconds
- **Smart organization** - Find that pasta dish from 3 months ago instantly
- **Offline access** - Cook without WiFi like it's 2005
- **Multi-device sync** - Start on phone, finish on laptop
- **Full page archives** - Because food blogs love to disappear recipes
- **Registry-driven architecture** - All supported sites managed in `/parsers/sites/site-registry.ts` and reflected in documentation and PRD

## Tech Stack (Current Implementation)

**Ready for Field Testing:**
- **Browser Extensions:** TypeScript + Manifest V3 (Chrome & Safari)
- **Backend API:** Go with local development server + comprehensive tests
- **Authentication:** AWS Cognito with JWT token management
```
