#!/usr/bin/env bash

#==============================================================================
# iOS Development Help Script
#==============================================================================
# NAME: ios-help.sh
#
# PURPOSE: Provides a comprehensive guide for iOS development with RecipeArchive,
#          focusing on the new build and deploy script.
#
# USAGE:
#   ./scripts/ios/ios-help.sh
#
#==============================================================================

echo "🍎 RecipeArchive iOS Development Guide"
echo "======================================"

cat << 'EOF'

📚 QUICK START
======================================

The iOS development workflow has been simplified to a single script:

  ./scripts/ios-build-and-deploy.sh

This script handles everything from cleaning and building to deploying to a simulator or device.


📱 USAGE
===================

  ./scripts/ios-build-and-deploy.sh [options]


OPTIONS:
  --target <target>   Deployment target. Options: simulator, device (default: simulator)
  --config <config>   Build configuration. Options: debug, release (default: debug)
  --help              Show this help


EXAMPLES:

  # Clean build and deploy to simulator in debug mode
  ./scripts/ios-build-and-deploy.sh

  # Clean build and deploy to a physical device in release mode
  ./scripts/ios-build-and-deploy.sh --target device --config release


🔧 WORKFLOW
======================

1. Run the main script:
   ./scripts/ios-build-and-deploy.sh

2. For device builds, the script will open Xcode. From there, you can select your
   device and run the app.

3. For simulator builds, the script will automatically launch the app in the simulator.


📞 GETTING HELP
===============

If you're stuck:

1. Run the help command for the main script:
   ./scripts/ios-build-and-deploy.sh --help

2. Run Flutter diagnostics:
   flutter doctor -v

3. For more detailed scripts, see the `scripts/ios/` directory.

EOF