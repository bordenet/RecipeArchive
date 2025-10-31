#!/usr/bin/env bash

################################################################################
# RecipeArchive iOS Development Help
################################################################################
# PURPOSE: Display comprehensive guide for iOS development
#   - Quick start instructions
#   - Usage examples
#   - Workflow guidance
#   - Troubleshooting resources
#
# USAGE:
#   ./scripts/ios/help.sh
#
# EXAMPLES:
#   ./scripts/ios/help.sh
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

log_header "RecipeArchive iOS Development Guide"

cat << 'EOF'

📚 QUICK START
======================================

The iOS development workflow uses a single build script:

  ./scripts/ios/build.sh --dev --run

This handles cleaning, building, and deploying to simulator or device.


📱 USAGE
===================

  ./scripts/ios/build.sh [OPTIONS]


REQUIRED OPTIONS:
  --dev               Development mode (fast iteration)
  --prod              Production mode (create archive)


COMMON OPTIONS:
  --simulator         Build for simulator (default in dev mode)
  --device            Build for physical device
  --debug             Debug configuration (default)
  --release           Release configuration
  --profile           Profile configuration
  --run               Auto-launch after build (dev mode only)
  --clean             Clean before build
  --version X.Y.Z     Set version (prod mode only)


EXAMPLES:

  # Quick development build and run on simulator
  ./scripts/ios/build.sh --dev --run

  # Clean build for simulator testing
  ./scripts/ios/build.sh --dev --clean --simulator --debug

  # Release build for device
  ./scripts/ios/build.sh --dev --device --release

  # Production archive with version
  ./scripts/ios/build.sh --prod --device --release --version 1.0.1


🔧 WORKFLOW
======================

1. Development (fast iteration):
   ./scripts/ios/build.sh --dev --run

2. Testing on device:
   ./scripts/ios/build.sh --dev --device --release

3. Production build:
   ./scripts/ios/build.sh --prod --device --release --version X.Y.Z

   Then export IPA via Xcode Organizer for distribution.


📞 GETTING HELP
===============

If you're stuck:

1. Run the build script with --help:
   ./scripts/ios/build.sh --help

2. Run Flutter diagnostics:
   flutter doctor -v

3. Check Xcode version:
   xcodebuild -version

4. View available simulators:
   xcrun simctl list devices

5. See scripts/ios/ directory for additional utilities

EOF
