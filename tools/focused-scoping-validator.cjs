#!/usr/bin/env node
// Focused JavaScript Scoping Validator - catches try/catch variable scoping issues
// This validator specifically targets the tokenResult-style bugs

const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

class FocusedScopingValidator {
  constructor() {
    this.errors = [];
    this.scopeStack = [];
  }

  validateFile(filePath) {
    console.log(`🔍 Analyzing: ${filePath}`);
    
    const code = fs.readFileSync(filePath, 'utf8');
    let ast;
    
    try {
      ast = parse(code, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        plugins: [
          'asyncGenerators',
          'functionBind',
          'decorators-legacy',
          'objectRestSpread',
          'optionalChaining',
          'nullishCoalescingOperator'
        ]
      });
    } catch (error) {
      console.error(`❌ Parse error in ${filePath}: ${error.message}`);
      return false;
    }

    this.currentFile = filePath;
    this.enterScope('global', null);

    traverse(ast, {
      // Track try/catch scope specifically  
      TryStatement: {
        enter: (path) => {
          this.enterScope('try', path);
        },
        exit: (path) => {
          this.exitScope();
        }
      },
      
      CatchClause: {
        enter: (path) => {
          this.enterScope('catch', path);
          // Add catch parameter to catch scope
          if (path.node.param && path.node.param.name) {
            const paramName = path.node.param.name;
            const line = path.node.param.loc.start.line;
            this.addVariableToCurrentScope(paramName, 'catch-param', line, path);
          }
        },
        exit: (path) => {
          this.exitScope();
        }
      },
      
      // Track variable declarations
      VariableDeclarator: (path) => {
        if (path.node.id && path.node.id.name) {
          const varName = path.node.id.name;
          const kind = path.parent.kind; // let, const, var
          const line = path.node.loc.start.line;
          
          this.addVariableToCurrentScope(varName, kind, line, path);
        }
      },
      
      // Check variable references
      Identifier: (path) => {
        // Only check actual variable references, not declarations or property names
        if (path.isReferencedIdentifier() && !path.isBindingIdentifier()) {
          const varName = path.node.name;
          const line = path.node.loc.start.line;
          
          this.checkVariableReference(varName, line, path);
        }
      }
    });

    this.exitScope(); // Exit global scope
    this.reportResults();
    return this.errors.length === 0;
  }

  isProblematicReference(varName, line, path) {
    // Focus on variables that look like they might be scoping issues
    const problematicPatterns = [
      /^token/, /^result/, /^response/, /^data/, /^config/,
      /^api/, /^client/, /^request/, /^auth/, /^user/
    ];
    
    return problematicPatterns.some(pattern => pattern.test(varName));
  }

  enterScope(type, path) {
    const scope = {
      type,
      variables: new Map(),
      path,
      line: path ? path.node.loc.start.line : 0
    };
    this.scopeStack.push(scope);
  }

  exitScope() {
    this.scopeStack.pop();
  }

  getCurrentScope() {
    return this.scopeStack[this.scopeStack.length - 1];
  }

  addVariableToCurrentScope(name, kind, line, path) {
    const currentScope = this.getCurrentScope();
    currentScope.variables.set(name, { kind, line, path });
  }

  checkVariableReference(name, line, path) {
    // Skip built-in globals and common browser APIs
    const builtinGlobals = new Set([
      'console', 'fetch', 'JSON', 'Error', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Date',
      'window', 'document', 'navigator', 'location', 'chrome', 'browser', 'safari',
      'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Promise', 'Math',
      'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
      'sendRecipeToBackend', 'recipe', 'RecipeArchiveConfig', 'getCurrentAPI', 'getCognitoConfig',
      'getIdToken', 'success', 'operation', 'undefined'
    ]);
    
    if (builtinGlobals.has(name)) {
      return;
    }
    
    // Check current scope context
    const currentCatchScope = this.scopeStack.findIndex(scope => scope.type === 'catch');
    const isInCatchBlock = currentCatchScope !== -1;
    
    if (!isInCatchBlock) {
      return; // Only interested in catch block references
    }
    
    // First check if this variable is a catch parameter in the current catch scope
    if (isInCatchBlock) {
      const catchScope = this.scopeStack[currentCatchScope];
      if (catchScope.variables.has(name)) {
        const variable = catchScope.variables.get(name);
        if (variable.kind === 'catch-param') {
          return; // This is a catch parameter, not a scoping issue
        }
      }
    }
    
    // Look for the variable declaration in try blocks
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      const scope = this.scopeStack[i];
      
      if (scope.variables.has(name)) {
        const variable = scope.variables.get(name);
        
        // Check if variable was declared in a try block and we're now in catch
        if (scope.type === 'try' && isInCatchBlock && 
            (variable.kind === 'let' || variable.kind === 'const')) {
          this.errors.push({
            file: this.currentFile,
            line,
            column: path.node.loc.start.column + 1,
            message: `Variable '${name}' declared in try block (line ${variable.line}) but referenced in catch block - not accessible due to block scoping`,
            type: 'try-catch-scoping'
          });
        }
        return; // Variable found, done checking
      }
    }
  }

  isTryCatchScopingIssue(varName, referenceLine, variable, declaringScope, referencePath) {
    // Find if we're currently in a catch block
    const currentCatchScope = this.scopeStack.find(scope => scope.type === 'catch');
    if (!currentCatchScope) {
      return false; // Not in a catch block
    }

    // Check if variable was declared in a try block
    const tryScope = this.scopeStack.find(scope => scope.type === 'try');
    if (!tryScope || declaringScope !== tryScope) {
      return false; // Variable not declared in try block
    }

    // This is the exact pattern we're looking for: variable declared in try, referenced in catch
    return variable.kind === 'let' || variable.kind === 'const';
  }

  reportResults() {
    if (this.errors.length === 0) {
      console.log('✅ No critical scoping issues found');
      return;
    }

    console.log('\n❌ CRITICAL SCOPING ERRORS:');
    this.errors.forEach(error => {
      console.log(`  ${error.file}:${error.line}:${error.column} - ${error.message}`);
    });
  }
}

// CLI usage
if (require.main === module) {
  const filePaths = process.argv.slice(2);
  
  if (filePaths.length === 0) {
    console.log('Usage: node focused-scoping-validator.cjs <file1.js> [file2.js] ...');
    process.exit(1);
  }

  const validator = new FocusedScopingValidator();
  let allPassed = true;

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      allPassed = false;
      continue;
    }

    const passed = validator.validateFile(filePath);
    if (!passed) {
      allPassed = false;
    }
    console.log(''); // Empty line between files
  }

  process.exit(allPassed ? 0 : 1);
}

module.exports = FocusedScopingValidator;
