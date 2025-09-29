# Web Extension Recipe Parsing Requirements

## Overview

RecipeArchive browser extensions must reliably extract recipe data from ALL supported recipe websites with 100% consistency for both fresh imports and duplicate overwrites.

## Critical Success Criteria

### P1: Universal Recipe Site Support

- **ALL supported recipe websites MUST be successfully parsed**
- **Zero tolerance for parsing failures on supported sites**
- **Consistent extraction quality across Chrome and Safari extensions**

### P2: Import Consistency

- **Fresh recipe import**: Extension creates new recipe in system
- **Duplicate recipe import**: Extension overwrites existing recipe
- **ZERO difference in Flutter app experience between fresh/overwrite scenarios**
- **Identical data structure and user experience regardless of import type**

## Supported Recipe Websites (Non-Negotiable)

### Tier 1 (Critical)

- **AllRecipes**: Complex JSON-LD array structures (`@type: Array(2)`)
- **Food52**: Control character cleaning required for malformed JSON-LD
- **Smitten Kitchen**: Currently broken, must restore functionality
- **Food Network**: High-traffic commercial site
- **Bon Appétit**: Premium content site

### Tier 2 (Important)

- **NYT Cooking**: Paywall considerations
- **Love & Lemons**: Clean structured data
- **King Arthur Baking**: Specialized baking content
- **Serious Eats**: Technical cooking content
- **BBC Good Food**: International content

### Tier 3 (Desirable)

- **Epicurious**: Condé Nast property
- **Taste of Home**: Family-focused content
- Additional sites as identified by user demand

## Technical Requirements

### Data Extraction Standards

- **Primary**: JSON-LD structured data extraction using browser DOM APIs
- **Fallback**: CSS selector-based DOM parsing for common patterns
- **Error Handling**: Graceful degradation with comprehensive logging
- **Security**: Zero CSP violations, no inline script injection

### Parsing Robustness

- **Multiple JSON-LD Scripts**: Parse ALL `script[type="application/ld+json"]` elements
- **Nested Structures**: Handle `@graph`, arrays, nested Recipe objects
- **Type Format Flexibility**: Support string and array `@type` formats
- **Malformed JSON**: Clean control characters and invalid syntax
- **Recursive Search**: Find Recipe objects in any nested property

### Data Consistency

- **Field Standardization**: Convert all time fields to consistent format
- **Required Fields**: Title, ingredients, instructions, source URL
- **Optional Fields**: Prep time, cook time, servings, description, images
- **Validation**: Ensure all extracted data passes schema validation

## Quality Assurance

### Testing Requirements

- **Real Site Testing**: Manual validation on actual recipe pages
- **Automated CSP Compliance**: Zero security violations
- **Regression Prevention**: Extension validation in unpacked mode before deployment
- **Cross-Browser**: Identical functionality Chrome/Safari

### Monitoring & Validation

- **Extension Validation Suite**: `tests/extension-validation.test.cjs`
- **Monorepo Validation**: Integrated with `./validate-monorepo.sh`
- **Console Logging**: Detailed extraction success/failure reporting
- **Error Recovery**: Graceful handling of unsupported site structures

## Error Handling & Recovery

### Parsing Failures

- **Structured Data Missing**: Fall back to DOM parsing
- **DOM Parsing Fails**: Log detailed error information
- **Network Issues**: Retry logic with exponential backoff
- **Authentication Problems**: Clear error messaging to user

### User Experience

- **Loading States**: Clear indication of parsing progress
- **Error Messages**: Actionable feedback for parsing failures
- **Retry Mechanisms**: Allow user to retry failed extractions
- **Support Information**: Easy access to troubleshooting help

## Performance Requirements

### Load Time

- **Initial Load**: < 500ms for supported sites
- **Parsing Time**: < 2 seconds for complex recipes
- **Memory Usage**: < 50MB additional browser memory
- **Battery Impact**: Minimal impact on mobile devices

### Resource Optimization

- **Selective Loading**: Only activate on supported recipe sites
- **Early Termination**: Quick exit for non-recipe pages
- **Efficient DOM Queries**: Minimize DOM traversal overhead
- **Caching**: Cache parsing results for duplicate page visits

## Deployment & Distribution

### Version Management

- **Chrome Extension**: Automated packaging and S3 distribution
- **Safari Extension**: Xcode conversion and distribution
- **Version Synchronization**: Chrome/Safari feature parity
- **Update Mechanism**: Seamless updates without user intervention

### Quality Gates

- **Pre-deployment Testing**: All supported sites must pass extraction tests
- **Automated Validation**: CI/CD integration prevents broken deployments
- **Rollback Capability**: Quick reversion for critical parsing failures
- **User Feedback**: Monitoring and response system for parsing issues

## Success Metrics

### Parsing Accuracy

- **100% success rate** on all Tier 1 supported sites
- **95% success rate** on all Tier 2 supported sites
- **90% success rate** on all Tier 3 supported sites
- **Zero CSP violations** across all supported browsers

### User Experience

- **Seamless import experience** for fresh and duplicate recipes
- **Consistent Flutter app behavior** regardless of import method
- **Sub-3-second** end-to-end recipe extraction time
- **Clear error messaging** for any extraction failures

## Cross-References

- [recipe-schema-normalization.md](./recipe-schema-normalization.md): Schema and OpenAI normalization requirements
- [search-functionality.md](./search-functionality.md): Search and discoverability requirements
- [../architecture/website-parsers.md](../architecture/website-parsers.md): Technical implementation approach
