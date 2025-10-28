#!/usr/bin/env bash

#==============================================================================
# Android Development Help Script
#==============================================================================
# NAME: android-help.sh
#
# PURPOSE: Provides a comprehensive guide for Android development with RecipeArchive.
#
# USAGE:
#   ./scripts/android-help.sh
#
#==============================================================================

echo "🤖 RecipeArchive Android Development Guide"
echo "======================================"

cat << 'EOF'

📚 QUICK START (New to Android Development)
========================================

1. 🛠️  SETUP (First time only)
   ./scripts/android-setup.sh

2. 🚀 RUN THE APP
   ./scripts/android-run.sh

3. 🔨 BUILD THE APP
   ./scripts/android-build.sh

That's it! These scripts handle everything automatically.

📱 DETAILED COMMANDS
===================

SETUP COMMANDS:
  ./scripts/android-setup.sh              # Complete Android setup (run first)

EMULATOR COMMANDS:
  ./scripts/android-emulator.sh start     # Start the emulator (default)
  ./scripts/android-emulator.sh create    # Create a new emulator
  ./scripts/android-emulator.sh list      # List available emulators
  ./scripts/android-emulator.sh stop      # Stop the running emulator

RUN COMMANDS:
  ./scripts/android-run.sh                # Run the app on the emulator

BUILD COMMANDS:
  ./scripts/android-build.sh              # Build debug APK
  ./scripts/android-build.sh --release    # Build release APK
  ./scripts/android-build.sh --appbundle  # Build an App Bundle

CLEAN COMMANDS:
  ./scripts/android-clean.sh              # Clean build artifacts
  ./scripts/android-clean.sh --deep       # Clean Gradle cache as well

ANDROID STUDIO COMMANDS:
  ./scripts/android-studio.sh             # Open project in Android Studio

🔧 TROUBLESHOOTING
=================

PROBLEM: "Android SDK not found"
SOLUTION:
  1. Install Android Studio.
  2. Make sure the ANDROID_HOME environment variable is set correctly.
  3. Run ./scripts/android-setup.sh

PROBLEM: "Emulator fails to start"
SOLUTION:
  1. Make sure you have enough RAM available.
  2. Try creating a new emulator with a different system image.
  3. Run ./scripts/android-emulator.sh create

PROBLEM: "App fails to install"
SOLUTION:
  1. Make sure the emulator is running and connected (adb devices).
  2. Try cleaning the project: ./scripts/android-clean.sh --deep
  3. Make sure you have accepted the Android licenses: ./scripts/android-setup.sh

📞 GETTING HELP
===============

If you're stuck:
1. Check this help: ./scripts/android-help.sh
2. Run diagnostics: flutter doctor -v
3. Check Android setup: ./scripts/android-setup.sh
4. Ask for help with specific error messages

EOF

echo ""
echo "💡 TIP: Bookmark this help by running: alias android-help='./scripts/android-help.sh'"
echo "🚀 Ready to start? Run: ./scripts/android-setup.sh"
