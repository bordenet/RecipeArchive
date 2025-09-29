#!/usr/bin/env bash

#==============================================================================
# iOS Development Help Script
#==============================================================================
# NAME: ios-help.sh
#
# PURPOSE: Provides a comprehensive guide for iOS development with RecipeArchive,
#          including quick start, detailed commands, troubleshooting, and workflow.
#
# USAGE:
#   ./scripts/ios-help.sh
#
# DEPENDENCIES:
#   - None
#
# NOTES:
#   - This script is a self-contained guide and does not perform any actions.
#   - It is recommended to create an alias for this script for easy access.
#
#==============================================================================

echo "🍎 RecipeArchive iOS Development Guide"
echo "======================================"

cat << 'EOF'

📚 QUICK START (New to iOS Development)
======================================

1. 🛠️  SETUP (First time only)
   ./scripts/ios-setup.sh

2. 🚀 RUN THE APP
   ./scripts/ios-run.sh

3. 🔨 BUILD THE APP
   ./scripts/ios-build.sh

That's it! These scripts handle everything automatically.

📱 DETAILED COMMANDS
===================

SETUP COMMANDS:
  ./scripts/ios-setup.sh              # Complete iOS setup (run first)

RUN COMMANDS:
  ./scripts/ios-simulator.sh          # Launch app in simulator (automated)
  ./scripts/ios-xcode.sh              # Open in Xcode for manual run (recommended)
  ./scripts/ios-run.sh                # Legacy run script
  flutter run                         # Direct Flutter command

BUILD COMMANDS:
  ./scripts/ios-build.sh              # Build debug for simulator
  ./scripts/ios-build.sh --release    # Build release for simulator
  ./scripts/ios-build.sh --device     # Build for physical iOS device
  ./scripts/ios-build.sh --xcode      # Build and open Xcode

XCODE COMMANDS:
  open ios/Runner.xcworkspace         # Open project in Xcode

🔧 TROUBLESHOOTING
=================

PROBLEM: "No iOS simulators found"
SOLUTION:
  1. Open Xcode
  2. Go to Xcode > Preferences > Components
  3. Download iOS simulators
  4. Or: xcrun simctl list devices

PROBLEM: "Flutter not detecting simulator"
SOLUTION:
  1. Open Simulator app manually
  2. Boot a device (Device > iOS > iPhone 15)
  3. Run: flutter devices (should show simulator)
  4. Run: flutter run

PROBLEM: "xcodebuild not found"
SOLUTION:
  1. Install Xcode from App Store
  2. Run: xcode-select --install
  3. Accept license: sudo xcodebuild -license accept

PROBLEM: "CocoaPods not found"
SOLUTION:
  sudo gem install cocoapods

PROBLEM: Build fails with code signing errors
SOLUTION:
  1. Open ios/Runner.xcworkspace in Xcode
  2. Select Runner project > Signing & Capabilities
  3. Choose your development team
  4. Or build for simulator only (no signing required)

📋 DEVELOPMENT WORKFLOW
======================

FOR BEGINNERS:
1. Run: ./scripts/ios-setup.sh       # One-time setup
2. Run: ./scripts/ios-run.sh         # Test your changes
3. Edit Flutter code in lib/
4. Hot reload automatically updates the app

FOR ADVANCED:
1. Open: ios/Runner.xcworkspace      # Use Xcode directly
2. Native iOS debugging and profiling
3. iOS-specific configurations
4. App Store deployment preparation

🏗️  PROJECT STRUCTURE
=====================

ios/                                 # iOS native project
├── Runner.xcworkspace              # Open this in Xcode
├── Runner.xcodeproj/               # Xcode project files
├── Runner/                         # iOS app configuration
│   ├── Info.plist                 # iOS app metadata
│   ├── Assets.xcassets/           # iOS app icons/images
│   └── AppDelegate.swift          # iOS app entry point
├── Podfile                        # CocoaPods dependencies
└── Pods/                          # Installed CocoaPods

🎯 TESTING TARGETS
=================

SIMULATOR TESTING:
- Fast development cycle
- No code signing required
- Perfect for UI testing
- Run: ./scripts/ios-run.sh

DEVICE TESTING:
- Real device performance
- Requires Apple Developer Account
- True iOS experience
- Run: ./scripts/ios-build.sh --device

🚀 DEPLOYMENT
============

APP STORE DEPLOYMENT:
1. Build release: ./scripts/ios-build.sh --release --device
2. Open ios/Runner.xcworkspace in Xcode
3. Archive the app (Product > Archive)
4. Upload to App Store Connect
5. Submit for review

TESTFLIGHT DEPLOYMENT:
1. Same as App Store but select "TestFlight" in distribution
2. Internal testing (no review required)
3. External testing (limited review)

📞 GETTING HELP
===============

If you're stuck:
1. Check this help: ./scripts/ios-help.sh
2. Run diagnostics: flutter doctor -v
3. Check iOS setup: ./scripts/ios-setup.sh
4. Ask for help with specific error messages

🔗 USEFUL RESOURCES
==================

Flutter iOS Documentation: https://docs.flutter.dev/deployment/ios
Xcode Documentation: https://developer.apple.com/xcode/
iOS Human Interface Guidelines: https://developer.apple.com/design/

EOF

echo ""
echo "💡 TIP: Bookmark this help by running: alias ios-help='./scripts/ios-help.sh'"
echo "🚀 Ready to start? Run: ./scripts/ios-setup.sh"