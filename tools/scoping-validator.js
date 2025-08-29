// Advanced JavaScript Variable Scoping Validator
// Custom AST-based analyzer to catch complex scoping bugs that ESLint might miss

const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

class ScopingValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
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
          'classProperties',
          'objectRestSpread',
          'optionalCatchBinding',
          'optionalChaining',
          'nullishCoalescingOperator'
        ]
      });
    } catch (parseError) {
      this.errors.push({
        file: filePath,
        line: parseError.loc?.line || 1,
        column: parseError.loc?.column || 1,
        message: `Parse error: ${parseError.message}`,
        type: 'PARSE_ERROR'
      });
      return;
    }

    traverse(ast, {
      // Track function scope
      FunctionDeclaration: (path) => {
        this.enterScope('function', path);
      },
      FunctionExpression: (path) => {
        this.enterScope('function', path);
      },
      ArrowFunctionExpression: (path) => {
        this.enterScope('function', path);
      },
      
      // Track block scope
      BlockStatement: (path) => {
        this.enterScope('block', path);
      },
      
      // Track try/catch scope
      TryStatement: (path) => {
        this.enterScope('try', path);
      },
      CatchClause: (path) => {
        this.enterScope('catch', path);
      },
      
      // Track variable declarations
      VariableDeclarator: (path) => {
        const varName = path.node.id.name;
        const kind = path.parent.kind; // let, const, var
        const line = path.node.loc.start.line;
        
        this.addVariableToCurrentScope(varName, kind, line, path);
      },
      
      // Check variable references
      Identifier: (path) => {
        // Skip if this is a declaration
        if (path.isVariableDeclarator() || path.isFunctionDeclaration()) {
          return;
        }
        
        // Skip property access (obj.prop)
        if (path.isMemberExpression() && path.node === path.parent.property) {
          return;
        }
        
        const varName = path.node.name;
        const line = path.node.loc.start.line;
        
        this.checkVariableReference(varName, line, path, filePath);
      },
      
      // Exit scopes
      exit: (path) => {
        if (this.shouldExitScope(path)) {
          this.exitScope();
        }
      }
    });
  }

  enterScope(type, path) {
    const scope = {
      type,
      variables: new Map(),
      line: path.node.loc.start.line,
      path: path
    };
    this.scopeStack.push(scope);
  }

  exitScope() {
    this.scopeStack.pop();
  }

  shouldExitScope(path) {
    return path.isFunctionDeclaration() || 
           path.isFunctionExpression() || 
           path.isArrowFunctionExpression() ||
           path.isBlockStatement() ||
           path.isTryStatement() ||
           path.isCatchClause();
  }

  addVariableToCurrentScope(varName, kind, line, path) {
    if (this.scopeStack.length === 0) return;
    
    const currentScope = this.scopeStack[this.scopeStack.length - 1];
    currentScope.variables.set(varName, {
      name: varName,
      kind,
      line,
      path
    });
  }

  checkVariableReference(varName, line, path, filePath) {
    // Skip built-in globals
    const builtIns = [
      'console', 'window', 'document', 'localStorage', 'fetch', 
      'chrome', 'browser', 'CONFIG', 'SafariCognitoAuth', 'ChromeCognitoAuth',
      'process', 'global', 'require', 'module', 'exports', '__dirname', '__filename'
    ];
    
    if (builtIns.includes(varName)) {
      return;
    }
    
    // Check if variable is defined in any accessible scope
    const isAccessible = this.isVariableAccessible(varName, path);
    
    if (!isAccessible) {
      this.errors.push({
        file: filePath,
        line,
        column: path.node.loc.start.column,
        message: `Variable '${varName}' is referenced but not defined in accessible scope`,
        type: 'UNDEFINED_VARIABLE',
        variable: varName
      });
    }
  }

  isVariableAccessible(varName, path) {
    // Check all scopes from current to root
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      const scope = this.scopeStack[i];
      
      if (scope.variables.has(varName)) {
        const variable = scope.variables.get(varName);
        
        // Special check for block-scoped variables (let/const)
        if (variable.kind === 'let' || variable.kind === 'const') {
          // For try/catch blocks, check if variable declared in try is used in catch
          if (this.isVariableDeclaredInTryUsedInCatch(varName, path)) {
            return false; // This is the tokenResult bug pattern!
          }
        }
        
        return true;
      }
    }
    
    return false; // Variable not found in any scope
  }

  isVariableDeclaredInTryUsedInCatch(varName, usagePath) {
    // Find if we're currently in a catch block
    let currentPath = usagePath;
    let isInCatch = false;
    
    while (currentPath) {
      if (currentPath.isCatchClause()) {
        isInCatch = true;
        break;
      }
      currentPath = currentPath.parentPath;
    }
    
    if (!isInCatch) return false;
    
    // Check if variable was declared in corresponding try block
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      const scope = this.scopeStack[i];
      
      if (scope.type === 'try' && scope.variables.has(varName)) {
        // Found variable declared in try block, being used in catch block
        this.warnings.push({
          file: 'current',
          line: usagePath.node.loc.start.line,
          column: usagePath.node.loc.start.column,
          message: `Variable '${varName}' declared in try block is not accessible in catch block`,
          type: 'TRY_CATCH_SCOPE_VIOLATION',
          variable: varName
        });
        return true;
      }
    }
    
    return false;
  }

  getResults() {
    return {
      errors: this.errors,
      warnings: this.warnings,
      hasIssues: this.errors.length > 0 || this.warnings.length > 0
    };
  }

  printResults() {
    if (this.errors.length > 0) {
      console.log('\n❌ SCOPING ERRORS:');
      this.errors.forEach(error => {
        console.log(`  ${error.file}:${error.line}:${error.column} - ${error.message}`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  SCOPING WARNINGS:');
      this.warnings.forEach(warning => {
        console.log(`  ${warning.file}:${warning.line}:${warning.column} - ${warning.message}`);
      });
    }
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('\n✅ No scoping issues found');
    }
    
    return this.errors.length === 0;
  }
}

// CLI usage
if (require.main === module) {
  const validator = new ScopingValidator();
  const filesToCheck = process.argv.slice(2);
  
  if (filesToCheck.length === 0) {
    console.log('Usage: node scoping-validator.js <file1.js> [file2.js ...]');
    process.exit(1);
  }
  
  filesToCheck.forEach(file => {
    if (fs.existsSync(file)) {
      validator.validateFile(file);
    } else {
      console.log(`❌ File not found: ${file}`);
    }
  });
  
  const success = validator.printResults();
  process.exit(success ? 0 : 1);
}

module.exports = ScopingValidator;
