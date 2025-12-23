# 📱 Celora Mobile App

React Native application for iOS and Android.

## Quick Start

```bash
# Install dependencies
npm install

# iOS
npm run ios

# Android
npm run android
```

## Features

- ✅ Biometric authentication (Face ID, Touch ID, Fingerprint)
- ✅ QR code scanning for wallet addresses
- ✅ Push notifications (FCM & APNS)
- ✅ Secure keychain storage
- ✅ Complete wallet management
- ✅ Card management
- ✅ Staking & DeFi
- ✅ NFT gallery

## Setup

See [docs/MOBILE-SETUP.md](../docs/MOBILE-SETUP.md) for complete setup instructions.

## Code Sharing

This mobile app shares code with the web app:

- `@/lib` - Validation, utilities
- `@/types` - TypeScript types

Configured via Metro bundler.

## Native Modules

- `react-native-biometrics` - Biometric authentication
- `react-native-camera` - QR code scanning
- `@react-native-firebase/messaging` - Push notifications
- `react-native-keychain` - Secure storage

## Requirements

- Node.js ≥ 20.0.0
- iOS: Xcode 14+, CocoaPods
- Android: Android Studio, Java 11+

## Building

### iOS

```bash
# Development
npm run ios

# Production
# Open ios/Celora.xcworkspace in Xcode
# Archive and upload to App Store
```

### Android

```bash
# Development
npm run android

# Production
cd android
./gradlew bundleRelease
# Upload to Play Console
```
















