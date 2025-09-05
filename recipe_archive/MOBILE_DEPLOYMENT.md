# 📱 RecipeArchive Mobile Deployment Guide

## 🎯 Status: Mobile-Ready ✅

The RecipeArchive Flutter app supports **iOS and Android** platforms with complete feature parity to the web version.

## 🚀 Quick Start

```bash
# Build Android debug APK
./scripts/build-mobile.sh android debug

# Build iOS release app  
./scripts/build-mobile.sh ios release

# Build both platforms
./scripts/build-mobile.sh both debug
```

## 📋 Prerequisites

### Android Development
- **Java/JDK 8+**: Required for Gradle builds
- **Android SDK**: Install via Android Studio or command line tools
- **Environment Variables**: Set `ANDROID_HOME` pointing to SDK location

```bash
# Install Android Studio (recommended)
# or set up command line tools
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

### iOS Development (macOS only)
- **Xcode**: Latest version from Mac App Store
- **CocoaPods**: For dependency management
- **iOS Simulator**: For testing (included with Xcode)

```bash
# Install CocoaPods
sudo gem install cocoapods
```

## 🏗️ Build Process

### Android APK
```bash
# Debug build (for testing)
flutter build apk --debug

# Release build (for distribution)
flutter build apk --release

# Output location:
# build/app/outputs/flutter-apk/app-release.apk
```

### iOS App Bundle
```bash
# Update dependencies
cd ios && pod install && cd ..

# Debug build
flutter build ios --debug --no-codesign

# Release build  
flutter build ios --release --no-codesign

# Output location:
# build/ios/iphoneos/Runner.app
```

## 📱 Platform Features

### ✅ Fully Supported Features
- **Recipe browsing**: Full grid/list view with responsive layout
- **Recipe details**: Scaling, instructions, images  
- **Authentication**: AWS Cognito integration
- **Data sync**: Real-time sync with AWS backend
- **Offline viewing**: Cached recipe data
- **Search & filtering**: All web functionality

### ⚠️ Platform-Specific Differences
- **Extension downloads**: Mobile shows installation instructions only (no direct download)
- **File sharing**: Uses native mobile sharing vs. web downloads
- **Deep linking**: Supports mobile app URLs

## 🔧 Configuration

### Environment Variables
The mobile app uses the same `.env` configuration as web:

```env
# AWS Configuration
COGNITO_USER_POOL_ID=us-west-2_qJ1i9RhxD
COGNITO_CLIENT_ID=5grdn7qhf1el0ioqb6hkelr29s
AWS_REGION=us-west-2
API_GATEWAY_URL=https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod
```

### Platform-Specific Settings

#### Android (`android/app/build.gradle`)
- **Min SDK**: API 21 (Android 5.0)
- **Target SDK**: API 34 (Android 14)
- **Permissions**: Internet, network state

#### iOS (`ios/Runner/Info.plist`)
- **Min iOS Version**: 12.0+
- **Permissions**: Network access
- **App Transport Security**: Configured for HTTPS APIs

## 🚀 Distribution

### Android - Google Play Store
1. **Build release APK**: `flutter build apk --release`
2. **Sign APK**: Use Android Studio or jarsigner
3. **Upload to Play Console**: Follow Google Play guidelines
4. **App Bundle**: Consider using `flutter build appbundle` for Play Store

### iOS - App Store
1. **Open in Xcode**: `open ios/Runner.xcworkspace`
2. **Configure signing**: Set development team and provisioning profile
3. **Archive build**: Product → Archive in Xcode
4. **Upload to App Store Connect**: Use Xcode Organizer

## 🧪 Testing

### Device Testing
```bash
# List connected devices
flutter devices

# Run on specific device
flutter run -d <device-id>

# Hot reload for development
# (Ctrl+R in terminal or save files in IDE)
```

### Emulator Testing
```bash
# List available emulators
flutter emulators

# Launch emulator
flutter emulators --launch apple_ios_simulator
flutter emulators --launch Pixel_3a_API_34_extension_level_7_arm64-v8a

# Run app on emulator
flutter run
```

## 📊 Build Verification

After successful builds, verify:

- ✅ **App launches**: Starts without crashes
- ✅ **Authentication**: Cognito login works  
- ✅ **API connectivity**: Recipes load from AWS
- ✅ **Responsive UI**: Layout adapts to screen size
- ✅ **Performance**: Smooth scrolling and navigation

## 🐛 Troubleshooting

### Common Android Issues
- **Java not found**: Install JDK and set JAVA_HOME
- **SDK license not accepted**: Run `flutter doctor --android-licenses`
- **Gradle daemon issues**: Run `./gradlew --stop` in android/ folder

### Common iOS Issues  
- **CocoaPods not found**: Install with `sudo gem install cocoapods`
- **Xcode outdated**: Update to latest Xcode version
- **Provisioning profile**: Set up Apple Developer account for device deployment

### General Flutter Issues
- **Dependencies out of sync**: Run `flutter clean && flutter pub get`
- **Build cache issues**: Delete `build/` folder and rebuild
- **Platform channel errors**: Check for platform-specific code compatibility

## 📚 Additional Resources

- **Flutter Documentation**: https://docs.flutter.dev/deployment
- **Android Publishing**: https://developer.android.com/studio/publish
- **iOS Distribution**: https://developer.apple.com/distribution/
- **Flutter Platform Channels**: https://docs.flutter.dev/platform-integration/platform-channels

---

*The RecipeArchive mobile apps provide complete feature parity with the web version, ensuring a consistent experience across all platforms.*