#!/bin/bash

################################################################################
#
# RecipeArchive Deployment Script Tester
#
# PURPOSE:
#   This script runs a series of checks to ensure that all critical deployment
#   scripts are functional. It helps prevent "bit-rot" where scripts break
#   over time due to changes in the repository or dependencies.
#
# USAGE:
#   ./tools/test-deployment-scripts.sh
#
# HOW IT WORKS:
#   The script executes the '--help' or '--list' command for each of the
#   major deployment scripts. A successful execution (exit code 0) is
#   considered a pass. This verifies that the scripts are executable and
#   their basic command-line parsing is intact.
#
# SCRIPTS TESTED:
#   - scripts/deploy-lambda.sh
#   - scripts/web-deploy.sh
#   - validate-monorepo.sh
#   - npm run build:extensions
#
# DEPENDENCIES:
#   - The scripts that it tests.
#
# NOTES:
#   - This script is intended to be run from the root of the monorepo.
#   - It's a good practice to run this before any major deployment.
#
################################################################################

# Test deployment scripts to prevent bit-rot
# Run this regularly to ensure deployment tools stay functional

set -e

echo "🧪 Testing RecipeArchive Deployment Scripts"
echo "========================================="

# Test Lambda deployment script
echo ""
echo "1. Testing Lambda deployment script..."
if ./scripts/deploy-lambda.sh --list > /dev/null 2>&1; then
    echo "✅ Lambda deployment script works"
else
    echo "❌ Lambda deployment script FAILED"
    exit 1
fi

# Test web app deployment script
echo ""
echo "2. Testing web app deployment script..."
if ./scripts/web-deploy.sh --help > /dev/null 2>&1; then
    echo "✅ Web app deployment script accessible"
else
    echo "❌ Web app deployment script FAILED"
    exit 1
fi

# Test monorepo validator
echo ""
echo "3. Testing monorepo validator..."
if ./validate-monorepo.sh --help > /dev/null 2>&1; then
    echo "✅ Monorepo validator works"
else
    echo "❌ Monorepo validator FAILED"
    exit 1
fi

# Test extension build
echo ""
echo "4. Testing extension build..."
if npm run build:extensions > /dev/null 2>&1; then
    echo "✅ Extension build works"
else
    echo "❌ Extension build FAILED"
    exit 1
fi

echo ""
echo "🎉 All deployment scripts are functional!"
echo ""
echo "💡 Tip: Run this test before major deployments to catch issues early"