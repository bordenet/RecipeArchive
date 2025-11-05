#!/usr/bin/env node

/**
 * MCP-Inspired Quality Gate for Husky Pre-commit
 * Validates codebase health using native tools when MCP diagnostics unavailable
 */

import { execSync } from 'child_process';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

class QualityGate {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.startTime = Date.now();
  }

  log(color, message) {
    console.log(`${color}${message}${RESET}`);
  }

  async checkTypeScript() {
    console.log('🔍 Checking TypeScript compilation...');
    try {
      // Check if TypeScript files exist
      const tsFiles = this.findFiles('.', /\.ts$/);
      if (tsFiles.length === 0) return;

      // Run TypeScript compiler check
      // Use 'pipe' instead of 'inherit' to avoid stdout/stderr race conditions during parallel validation
      const output = execSync('npx tsc --noEmit --skipLibCheck', {
        stdio: 'pipe',
        encoding: 'utf8',
      });
      if (output) console.log(output);
      this.log(GREEN, '✅ TypeScript compilation: PASSED');
    } catch (error) {
      if (error.stdout) console.log(error.stdout);
      if (error.stderr) console.error(error.stderr);
      this.errors.push('TypeScript compilation failed');
      this.log(RED, '❌ TypeScript compilation: FAILED');
    }
  }

  async checkFlutterAnalyze() {
    console.log('🔍 Checking Flutter code quality...');
    try {
      // Check if Flutter project exists
      if (!this.fileExists('recipe_archive/pubspec.yaml')) return;

      // Use 'pipe' instead of 'inherit' to avoid stdout/stderr race conditions during parallel validation
      const output = execSync('cd recipe_archive && flutter analyze', {
        stdio: 'pipe',
        encoding: 'utf8',
      });
      if (output) console.log(output);
      this.log(GREEN, '✅ Flutter analyze: PASSED');
    } catch (error) {
      if (error.stdout) console.log(error.stdout);
      if (error.stderr) console.error(error.stderr);
      this.errors.push('Flutter analyze failed');
      this.log(RED, '❌ Flutter analyze: FAILED');
    }
  }

  async checkGoCompilation() {
    console.log('🔍 Checking Go compilation...');
    try {
      const goFiles = this.findFiles('aws-backend/functions', /\.go$/);
      if (goFiles.length === 0) return;

      // Check each Go module
      const goDirs = this.findGoDirs('aws-backend/functions');
      for (const dir of goDirs) {
        try {
          execSync(`cd ${dir} && go build ./...`, { stdio: 'pipe' });
        } catch (error) {
          this.errors.push(`Go compilation failed in ${dir}`);
        }
      }

      if (
        this.errors.filter((e) => e.includes('Go compilation')).length === 0
      ) {
        this.log(GREEN, '✅ Go compilation: PASSED');
      }
    } catch (error) {
      this.errors.push('Go compilation check failed');
      this.log(RED, '❌ Go compilation: FAILED');
    }
  }

  async checkPackageJsonIntegrity() {
    console.log('🔍 Checking package.json integrity...');
    try {
      const packageFiles = this.findFiles('.', /package\.json$/);

      for (const file of packageFiles) {
        try {
          const content = JSON.parse(readFileSync(file, 'utf8'));
          if (!content.name) {
            this.warnings.push(`${file}: Missing name field`);
          }
        } catch (error) {
          this.errors.push(`${file}: Invalid JSON`);
        }
      }

      if (this.errors.filter((e) => e.includes('Invalid JSON')).length === 0) {
        this.log(GREEN, '✅ Package.json integrity: PASSED');
      }
    } catch (error) {
      this.errors.push('Package.json integrity check failed');
    }
  }

  findFiles(dir, pattern, files = []) {
    try {
      const items = readdirSync(dir);
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);

        if (
          stat.isDirectory() &&
          !item.startsWith('.') &&
          item !== 'node_modules'
        ) {
          this.findFiles(fullPath, pattern, files);
        } else if (stat.isFile() && pattern.test(item)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
    return files;
  }

  findGoDirs(dir, dirs = []) {
    try {
      const items = readdirSync(dir);
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.')) {
          // Check if directory contains .go files
          const goFiles = readdirSync(fullPath).filter((f) =>
            f.endsWith('.go')
          );
          if (goFiles.length > 0) {
            dirs.push(fullPath);
          }
          this.findGoDirs(fullPath, dirs);
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
    return dirs;
  }

  fileExists(path) {
    try {
      statSync(path);
      return true;
    } catch {
      return false;
    }
  }

  async run() {
    console.log('🚀 MCP-Inspired Quality Gate Starting...\n');

    await this.checkPackageJsonIntegrity();
    await this.checkTypeScript();
    await this.checkFlutterAnalyze();
    await this.checkGoCompilation();

    console.log('\n📊 Quality Gate Results:');

    if (this.warnings.length > 0) {
      this.log(YELLOW, `⚠️  ${this.warnings.length} warnings:`);
      this.warnings.forEach((w) => this.log(YELLOW, `   ${w}`));
    }

    if (this.errors.length > 0) {
      this.log(RED, `❌ ${this.errors.length} errors:`);
      this.errors.forEach((e) => this.log(RED, `   ${e}`));
      const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
      console.log(
        `\n🚨 Quality gate FAILED - fix errors before committing (${duration}s)`
      );
      process.exit(1);
    }

    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
    this.log(
      GREEN,
      `\n✅ Quality gate PASSED - ready to commit! (${duration}s)`
    );
    process.exit(0);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const gate = new QualityGate();
  gate.run().catch((error) => {
    console.error('Quality gate crashed:', error);
    process.exit(1);
  });
}
