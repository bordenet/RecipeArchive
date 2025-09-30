#!/usr/bin/env node

/**
 * Browser Extension Environment Variable Injection Tool
 *
 * This tool reads environment variables from .env and injects them into
 * extension JavaScript files at build time, replacing placeholder patterns
 * like __ENV_VAR_NAME__ with actual values.
 */

const fs = require('fs');
const path = require('path');
const { execSync: _execSync } = require('child_process');

// Load environment variables
const envPath = path.join(__dirname, '../.env');
console.log(`Loading environment from: ${envPath}`);
require('dotenv').config({ path: envPath });

// Debug environment variable loading
console.log('Environment variables loaded:');
console.log('- AWS_REGION:', process.env.AWS_REGION);
console.log('- COGNITO_USER_POOL_ID:', process.env.COGNITO_USER_POOL_ID);
console.log('- API_BASE_URL:', process.env.API_BASE_URL);

const EXTENSION_ENV_VARS = [
  'AWS_REGION',
  'COGNITO_USER_POOL_ID',
  'COGNITO_APP_CLIENT_ID',
  'API_BASE_URL',
  'WEB_APP_URL',
  'S3_BUCKET_NAME',
];

const TEST_ENV_VARS = [
  'TEST_USER_EMAIL',
  'TEST_USER_PASSWORD',
  'RECIPE_USER_EMAIL',
  'RECIPE_USER_PASSWORD',
];

class ExtensionEnvBuilder {
  constructor(extensionPath) {
    this.extensionPath = extensionPath;
    this.envVars = this.loadEnvironmentVariables();
  }

  loadEnvironmentVariables() {
    const vars = {};

    // Load core environment variables
    EXTENSION_ENV_VARS.forEach((key) => {
      const value = process.env[key];
      if (!value) {
        console.warn(`⚠️  Warning: Environment variable ${key} not found`);
      }
      vars[key] = value || '';
    });

    // Load test variables (optional)
    TEST_ENV_VARS.forEach((key) => {
      const value = process.env[key];
      if (value) {
        vars[key] = value;
      }
    });

    return vars;
  }

  injectEnvironmentVariables(filePath) {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Replace __ENV_VAR_NAME__ patterns with actual values
    Object.entries(this.envVars).forEach(([key, value]) => {
      const placeholder = `__${key}__`;
      if (content.includes(placeholder)) {
        console.log(`🔧 Injecting ${key} into ${path.basename(filePath)}`);
        content = content.replace(new RegExp(placeholder, 'g'), value);
        modified = true;
      }
    });

    // Replace process.env.VAR_NAME patterns (browser extensions can't use process.env)
    Object.entries(this.envVars).forEach(([key, value]) => {
      const processEnvPattern = `process\\.env\\.${key}`;
      const regex = new RegExp(processEnvPattern, 'g');
      if (regex.test(content)) {
        console.log(
          `🔧 Replacing process.env.${key} with literal value in ${path.basename(filePath)}`
        );
        content = content.replace(regex, `'${value}'`);
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }

    return false;
  }

  processExtension() {
    console.log(`🏗️  Processing extension: ${this.extensionPath}`);

    const jsFiles = this.findJavaScriptFiles();
    let totalModified = 0;

    jsFiles.forEach((file) => {
      if (this.injectEnvironmentVariables(file)) {
        totalModified++;
      }
    });

    console.log(
      `✅ Processed ${jsFiles.length} files, modified ${totalModified} files`
    );
    return totalModified;
  }

  findJavaScriptFiles() {
    const files = [];
    const extensions = ['.js', '.ts'];

    // Exclude certain files
    const excludePatterns = [
      'node_modules',
      '__tests__',
      'tests',
      '.test.',
      '.spec.',
      'typescript-parser-bundle.js', // Don't modify compiled bundles
    ];

    const scanDirectory = (dir) => {
      if (!fs.existsSync(dir)) return;

      const items = fs.readdirSync(dir);
      items.forEach((item) => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        // Skip excluded patterns
        if (excludePatterns.some((pattern) => fullPath.includes(pattern))) {
          return;
        }

        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (
          stat.isFile() &&
          extensions.some((ext) => item.endsWith(ext))
        ) {
          files.push(fullPath);
        }
      });
    };

    scanDirectory(this.extensionPath);
    return files;
  }

  generateEnvConfig() {
    const configPath = path.join(this.extensionPath, 'env-config.js');
    const config = {
      AWS_REGION: this.envVars.AWS_REGION,
      COGNITO_USER_POOL_ID: this.envVars.COGNITO_USER_POOL_ID,
      COGNITO_APP_CLIENT_ID: this.envVars.COGNITO_APP_CLIENT_ID,
      API_BASE_URL: this.envVars.API_BASE_URL,
      WEB_APP_URL: this.envVars.WEB_APP_URL,
      S3_BUCKET_NAME: this.envVars.S3_BUCKET_NAME,
    };

    const configContent = `// Auto-generated environment configuration
// This file is generated at build time - do not edit manually
const ENV_CONFIG = ${JSON.stringify(config, null, 2)};

// Make it available globally for browser extensions
if (typeof window !== "undefined") {
  window.ENV_CONFIG = ENV_CONFIG;
}

// Export for module systems
if (typeof module !== "undefined" && module.exports) {
  module.exports = ENV_CONFIG;
}
`;

    fs.writeFileSync(configPath, configContent);
    console.log(
      `📝 Generated env-config.js for ${path.basename(this.extensionPath)}`
    );
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('🔧 Building environment variables for all extensions...');

    // Process both Chrome and Safari extensions
    const extensions = ['chrome', 'safari'];
    let totalModified = 0;

    extensions.forEach((ext) => {
      const extPath = path.join(__dirname, '../extensions', ext);
      if (fs.existsSync(extPath)) {
        const builder = new ExtensionEnvBuilder(extPath);
        builder.generateEnvConfig();
        totalModified += builder.processExtension();
      }
    });

    console.log(`\n✅ Environment variable injection complete!`);
    console.log(`   Modified ${totalModified} files across all extensions`);
  } else {
    // Process specific extension
    const extensionName = args[0];
    const extPath = path.join(__dirname, '../extensions', extensionName);

    if (!fs.existsSync(extPath)) {
      console.error(`❌ Extension not found: ${extensionName}`);
      throw new Error('Extension not found');
    }

    const builder = new ExtensionEnvBuilder(extPath);
    builder.generateEnvConfig();
    builder.processExtension();
  }
}

if (require.main === module) {
  main();
}

module.exports = { ExtensionEnvBuilder };
