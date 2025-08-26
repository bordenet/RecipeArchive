#!/usr/bin/env node

/**
 * Documentation Organization Script
 * 
 * Automatically moves technical documentation files from the root directory
 * to the appropriate docs/ subdirectory to keep the root clean.
 * 
 * This script runs as part of the pre-commit hook to ensure documentation
 * files are properly organized before commits.
 */

const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

class DocOrganizer {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.docsDir = path.join(this.rootDir, 'docs');
    this.techDocsDir = path.join(this.docsDir, 'technical');
    this.toolsDir = path.join(this.rootDir, 'tools');
    this.lintingDir = path.join(this.toolsDir, 'linting');
    
    // Patterns for documentation files that should be moved
    this.docPatterns = [
      /^.*_FIX\.md$/i,
      /^.*_SOLUTION\.md$/i,
      /^.*_ANALYSIS.*\.md$/i,
      /^LINTING.*\.md$/i,
      /^ENHANCED.*\.md$/i,
      /^CHROME.*\.md$/i,
      /^SAFARI.*\.md$/i,
      /^EXTENSION.*\.md$/i,
      /^DEBUG.*\.md$/i,
      /^TROUBLESHOOT.*\.md$/i,
      /^IMPLEMENTATION.*\.md$/i,
      /^ARCHITECTURE.*\.md$/i,
      /^DESIGN.*\.md$/i
    ];
    
    // Patterns for config files that should be moved to tools/linting
    this.configPatterns = [
      /^eslint\.config\..*\.js$/,
      /^linting-.*\.json$/,
      /^.*\.eslintrc.*$/,
      /^.*lint.*config.*\.(js|json|yaml|yml)$/i
    ];
    
    // Files to keep in root (project documentation)
    this.keepInRoot = [
      'README.md',
      'CLAUDE.md',
      'LICENSE.md',
      'CHANGELOG.md',
      'CONTRIBUTING.md',
      '.eslintrc.js', // Main eslint config stays in root
      'eslint.config.js', // Main eslint config stays in root
      'package.json',
      'package-lock.json'
    ];
  }

  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${path.relative(this.rootDir, dirPath)}`);
    }
  }

  isDocumentationFile(filename) {
    // Skip files that should stay in root
    if (this.keepInRoot.includes(filename)) {
      return false;
    }
    
    // Check if filename matches any documentation pattern
    return this.docPatterns.some(pattern => pattern.test(filename));
  }

  isConfigFile(filename) {
    // Skip files that should stay in root
    if (this.keepInRoot.includes(filename)) {
      return false;
    }
    
    // Check if filename matches any config pattern
    return this.configPatterns.some(pattern => pattern.test(filename));
  }

  moveFile(sourcePath, targetPath) {
    try {
      fs.renameSync(sourcePath, targetPath);
      console.log(`📋 Moved: ${path.basename(sourcePath)} → ${path.relative(this.rootDir, targetPath)}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to move ${path.basename(sourcePath)}: ${error.message}`);
      return false;
    }
  }

  organizeDocumentation() {
    console.log('🔍 Scanning for misplaced documentation files...\n');
    
    this.ensureDirectoryExists(this.docsDir);
    this.ensureDirectoryExists(this.techDocsDir);
    
    const rootFiles = fs.readdirSync(this.rootDir);
    const markdownFiles = rootFiles.filter(file => file.endsWith('.md'));
    
    let movedCount = 0;
    let scannedCount = 0;
    
    for (const filename of markdownFiles) {
      scannedCount++;
      
      if (this.isDocumentationFile(filename)) {
        const sourcePath = path.join(this.rootDir, filename);
        const targetPath = path.join(this.techDocsDir, filename);
        
        if (this.moveFile(sourcePath, targetPath)) {
          movedCount++;
        }
      }
    }
    
    console.log(`\n📊 Documentation Organization Summary:`);
    console.log(`   📄 Scanned: ${scannedCount} markdown files`);
    console.log(`   📁 Moved: ${movedCount} files to docs/technical/`);
    console.log(`   ✅ Root directory: ${scannedCount - movedCount} appropriate files remaining`);
    
    if (movedCount > 0) {
      console.log(`\n💡 Moved files are now organized in: docs/technical/`);
      console.log(`   This keeps the root directory focused on project essentials.`);
    } else {
      console.log(`\n✨ All documentation files are already properly organized!`);
    }
    
    return movedCount;
  }

  organizeConfigFiles() {
    console.log('\n🔧 Scanning for misplaced config files...\n');
    
    this.ensureDirectoryExists(this.toolsDir);
    this.ensureDirectoryExists(this.lintingDir);
    
    const rootFiles = fs.readdirSync(this.rootDir);
    const configFiles = rootFiles.filter(file => this.isConfigFile(file));
    
    let movedCount = 0;
    
    for (const filename of configFiles) {
      const sourcePath = path.join(this.rootDir, filename);
      const targetPath = path.join(this.lintingDir, filename);
      
      if (this.moveFile(sourcePath, targetPath)) {
        movedCount++;
      }
    }
    
    console.log(`\n🔧 Config File Organization Summary:`);
    console.log(`   📄 Scanned: ${configFiles.length} config files`);
    console.log(`   📁 Moved: ${movedCount} files to tools/linting/`);
    console.log(`   ✅ Root directory: ${configFiles.length - movedCount} essential configs remaining`);
    
    if (movedCount > 0) {
      console.log(`\n💡 Moved config files are now organized in: tools/linting/`);
      console.log(`   This keeps the root directory clean and focused.`);
    } else {
      console.log(`\n✨ All config files are already properly organized!`);
    }
    
    return movedCount;
  }

  generateReport() {
    const techDocsPath = this.techDocsDir;
    
    if (!fs.existsSync(techDocsPath)) {
      return;
    }
    
    const techFiles = fs.readdirSync(techDocsPath)
      .filter(file => file.endsWith('.md'))
      .sort();
    
    if (techFiles.length > 0) {
      console.log(`\n📚 Technical Documentation Available:`);
      techFiles.forEach(file => {
        console.log(`   • ${file}`);
      });
    }
  }
}

// Run the organizer
if (require.main === module) {
  const organizer = new DocOrganizer();
  const movedDocsCount = organizer.organizeDocumentation();
  const movedConfigCount = organizer.organizeConfigFiles();
  organizer.generateReport();
  
  const totalMoved = movedDocsCount + movedConfigCount;
  if (totalMoved > 0) {
    console.log(`\n🔄 Remember to add moved files to git:`);
    if (movedDocsCount > 0) {
      console.log(`   git add docs/technical/`);
    }
    if (movedConfigCount > 0) {
      console.log(`   git add tools/linting/`);
    }
    console.log(`   git add . # (to stage deletions from root)`);
  }
}

module.exports = DocOrganizer;
