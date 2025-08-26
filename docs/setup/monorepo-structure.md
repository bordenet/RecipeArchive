# RecipeArchive Monorepo Structure & Development Workflow

## 📁 Monorepo Organization

This is a **monorepo** containing all RecipeArchive components. Each component is independently developable while sharing common configurations and utilities.

```
RecipeArchive/
├── 📦 packages/                    # Shared libraries and utilities
│   ├── shared-types/              # TypeScript interfaces and types
│   ├── shared-utils/              # Common utilities and helpers
│   └── api-client/                # Shared API client library
├── 🔌 extensions/                 # Browser extensions
│   ├── chrome/                    # Chrome extension
│   └── safari/                    # Safari extension
├── ☁️ aws-backend/                # AWS serverless backend
│   ├── infrastructure/            # CDK infrastructure code
│   ├── functions/                 # Lambda functions
│   └── tests/                     # Backend integration tests
├── 🌐 website/                    # React web application
│   ├── src/                       # Website source code
│   ├── public/                    # Static assets
│   └── tests/                     # Web app tests
├── 📱 ios-app/                    # iOS native application
│   ├── RecipeArchive/             # iOS source code
│   └── RecipeArchiveTests/        # iOS tests
├── 🧪 tests/                      # Cross-component integration tests
│   ├── integration/               # End-to-end tests
│   └── performance/               # Performance testing
├── 📚 docs/                       # Documentation
│   ├── api/                       # API documentation
│   ├── deployment/                # Deployment guides
│   └── development/               # Development guides
└── 🛠️ tools/                      # Development tools and scripts
    ├── scripts/                   # Build and deployment scripts
    └── configs/                   # Shared configurations
```

## 🎯 Development Principles

### 1. **Component Independence**

- Each component can be developed, tested, and deployed independently
- No direct file dependencies between components
- Shared code lives in `packages/` and is explicitly imported

### 2. **Consistent Tooling**

- Unified linting (ESLint) and formatting (Prettier) across all TypeScript/JavaScript
- Consistent testing frameworks and patterns
- Shared development scripts and configurations

### 3. **Quality Gates**

- Linting on every file save and commit
- Automated testing on every change
- Type checking for all TypeScript code
- Pre-commit hooks for quality enforcement

### 4. **Clear Ownership**

- Each component has its own package.json and dependencies
- Clear documentation for each component's purpose and APIs
- Explicit interfaces between components

## 🔧 Development Workflow

### Starting Development

```bash
# Install all dependencies
npm run install:all

# Run linting across entire monorepo
npm run lint

# Run all tests
npm run test

# Start development for specific component
npm run dev:chrome          # Chrome extension
npm run dev:website         # Website
npm run dev:aws             # AWS backend
```

### Quality Checks

```bash
# Lint everything
npm run lint:all

# Fix linting issues
npm run lint:fix

# Type check all TypeScript
npm run type-check

# Run all tests with coverage
npm run test:coverage
```

### Component-Specific Development

```bash
# Chrome Extension
cd extensions/chrome
npm run dev          # Start development server
npm run test         # Run tests
npm run build        # Build for production

# AWS Backend
cd aws-backend
npm run deploy       # Deploy infrastructure
npm run test         # Run Lambda tests
npm run lint         # Lint backend code

# Website
cd website
npm run dev          # Start development server
npm run test         # Run React tests
npm run build        # Build for production
```

## 📋 Quality Standards

### Code Quality Requirements

- **Linting**: ESLint with strict TypeScript rules
- **Formatting**: Prettier with consistent configuration
- **Type Safety**: Strict TypeScript configuration
- **Testing**: Minimum 80% code coverage
- **Documentation**: JSDoc comments for all public APIs

### Pre-commit Requirements

- All files must pass linting
- All tests must pass
- Type checking must pass
- No console.log statements in production code unless we explicitly agree we're debugging something 
- Commit messages must follow conventional commit format

### Continuous Integration

- Automated testing on every pull request
- Linting and type checking on every commit
- Component-specific testing when files change
- Cross-component integration testing

---

**Next Steps**:

1. Set up monorepo package.json with workspace configuration
2. Configure unified linting and testing
3. Create shared type definitions
4. Set up pre-commit hooks and CI/CD
