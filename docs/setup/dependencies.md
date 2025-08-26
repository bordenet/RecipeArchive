# RecipeArchive Dependencies Guide

## Complete Dependency List

### Root Project Dependencies (package.json)

#### Development Dependencies
- **@typescript-eslint/eslint-plugin**: ^8.40.0 - TypeScript ESLint rules
- **@typescript-eslint/parser**: ^8.40.0 - TypeScript parser for ESLint
- **eslint**: ^8.57.1 - JavaScript/TypeScript linting
- **eslint-config-prettier**: ^10.1.8 - Prettier compatibility for ESLint
- **eslint-plugin-prettier**: ^5.5.4 - Prettier as ESLint rules
- **husky**: ^9.1.7 - Git hooks management
- **lint-staged**: ^16.1.5 - Run linters on staged files
- **prettier**: ^3.0.0 - Code formatting
- **typescript**: ^5.1.6 - TypeScript compiler

### Global Dependencies (installed via npm -g)

#### Required for Development
- **typescript**: Latest - TypeScript compiler (global access)
- **aws-cdk**: 2.87.0 - AWS Cloud Development Kit
- **jest**: ^29.5.0 - Testing framework (optional global)
- **playwright**: ^1.55.0 - Browser automation (optional global)

### Workspace Dependencies

#### packages/shared-types
```json
{
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.1.6"
  },
  "peerDependencies": {
    "typescript": "^5.0.0"
  }
}
```

#### extensions/chrome
```json
{
  "devDependencies": {
    "eslint": "^9.34.0",
    "jest": "^29.0.0",
    "jsdom": "^22.0.0"
  }
}
```

#### extensions/safari
```json
{
  "devDependencies": {
    "eslint": "^9.34.0",
    "jest": "^29.0.0",
    "jest-environment-jsdom": "^29.0.0"
  }
}
```

#### aws-backend/infrastructure
```json
{
  "devDependencies": {
    "@types/jest": "^29.4.0",
    "@types/node": "18.14.6",
    "jest": "^29.5.0",
    "ts-jest": "^29.0.5",
    "aws-cdk": "2.87.0",
    "typescript": "~4.9.5"
  },
  "dependencies": {
    "aws-cdk-lib": "2.87.0",
    "constructs": "^10.0.0"
  }
}
```

## System Dependencies

### macOS Development Tools
- **Homebrew** - Package manager
- **Node.js** - JavaScript runtime (>= 18.0.0)
- **npm** - Package manager (>= 8.0.0)
- **Go** - Backend language (>= 1.25.0)
- **AWS CLI** - AWS command line interface
- **Git** - Version control
- **ImageMagick** - Icon processing
- **Xcode CLI Tools** - Native development (iOS)

### Optional Development Tools
- **Visual Studio Code** - Recommended IDE
- **Playwright browsers** - Chrome, Safari, Firefox for testing
- **Jest** - Global installation for CLI access

## Setup Scripts

### 1. Complete Environment Setup
```bash
../../scripts/setup-macos.sh
```
**Installs:**
- All system dependencies
- Global npm packages
- VS Code extensions
- Development tools
- Environment configuration

### 2. Dependency Installation Only
```bash
../../scripts/install-dependencies.sh
```
**Installs:**
- Root monorepo dependencies
- All workspace dependencies
- Pre-commit hooks setup
- Builds shared types package
- Verifies setup

### 3. Manual Installation Commands

#### Install Root Dependencies
```bash
npm install
```

#### Install All Workspace Dependencies
```bash
npm run install:all
```

#### Install Specific Workspace
```bash
npm run install:chrome
npm run install:safari
npm run install:aws
```

## Verification Commands

### Check Installation
```bash
# Full verification
npm run lint && npm run type-check && npm run build

# Individual checks
npm run lint          # ESLint validation
npm run type-check    # TypeScript compilation
npm run build         # Build all packages
npm run format        # Code formatting
```

### Test Setup
```bash
# Run all tests
npm test

# Test specific components
npm run test:chrome
npm run test:safari
npm run test:aws
```

## Pre-commit Hooks

Automatically runs on `git commit`:
- **lint-staged** - Lints and formats staged files
- **type-check** - TypeScript compilation check

Configure in `.husky/pre-commit`:
```bash
npx lint-staged
```

## Troubleshooting

### Common Issues

1. **TypeScript Compilation Errors**
   ```bash
   npm run type-check
   ```

2. **ESLint Errors**
   ```bash
   npm run lint:fix
   ```

3. **Formatting Issues**
   ```bash
   npm run format
   ```

4. **Missing Dependencies**
   ```bash
   ../../scripts/install-dependencies.sh
   ```

5. **AWS CDK Issues**
   ```bash
   cd aws-backend/infrastructure
   npm install
   npm run synth
   ```

### Version Conflicts

If experiencing version conflicts:
```bash
npm run clean
npm install
npm run install:all
```

## VS Code Extensions

Essential for development:
- **Go** (golang.go)
- **ESLint** (dbaeumer.vscode-eslint)
- **TypeScript** (ms-vscode.vscode-typescript-next)
- **AWS Toolkit** (amazonwebservices.aws-toolkit-vscode)
- **Prettier** (esbenp.prettier-vscode)
- **Playwright** (ms-playwright.playwright)

## Environment Variables

Required for testing:
```bash
export RECIPE_TEST_USER="test"
export RECIPE_TEST_PASS="subject123"
```

## Next Steps

1. Verify setup: `npm run lint && npm run type-check && npm run build`
2. Configure AWS: `aws configure`
3. Deploy infrastructure: `npm run deploy:aws`
4. Load browser extensions in development mode
5. Start development with `npm run dev:<component>`
