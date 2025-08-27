# Code Validation Workflow

## Mandatory Steps Before Claiming "Fixed" or "Ready"

1. **Pre-Edit Checks**
   - Get current file state using `read_file`
   - Check existing linting errors using `get_errors`
   - Document all issues that need to be fixed

2. **Edit Process**
   - Make one focused change at a time
   - After EACH edit:
     - Run `get_errors` to verify no new issues introduced
     - If errors found, revert change and try different approach
     - Never proceed to next edit until current edit is lint-clean

3. **Post-Edit Validation**
   - Run `get_errors` on ALL affected files
   - Verify no linting errors before claiming "fixed"
   - If errors found:
     1. Document all errors
     2. If error count growing, revert to last known good state
     3. Start over with smaller, focused changes

4. **Integration Testing**
   - Only after ALL linting passes
   - Document exact test steps needed
   - Never ask for testing with pending lint errors

## Error Categories to Check

1. **Linting Errors**
   - Undefined variables
   - Unused variables
   - Quote style consistency
   - Missing semicolons
   - Proper spacing and formatting

2. **Type Errors**
   - Undefined types
   - Type mismatches
   - Missing type declarations

3. **Runtime Errors**
   - Reference errors
   - Undefined function calls
   - Missing dependencies

## When to Revert

1. If more than 3 attempts to fix linting fail
2. If file corruption occurs
3. If error count increases after attempted fixes
4. If changes are creating cascade failures

## Communication Standards

1. Never claim "fixed" without clean linting
2. Never request testing without clean linting
3. Be explicit about current state of validation
4. Admit when approach isn't working and need to revert

## Automation Requirements

1. Always run `get_errors` before claiming success
2. Track error counts between iterations
3. Maintain list of affected files
4. Document all validation steps taken
