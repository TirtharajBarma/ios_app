#!/usr/bin/env bash
set -e

echo "🔍 Checking for local Xcode..."
if ! command -v xcodebuild &> /dev/null; then
  echo "❌ Error: 'xcodebuild' not found. Local .ipa build requires Xcode to be installed on this Mac."
  echo "💡 Tip: If you do not have Xcode, run the Cloud build instead: npm run build:ipa:cloud"
  exit 1
fi

echo "🚀 Building Release Archive for iOS locally with Xcode..."
rm -rf build/cashveil.xcarchive build/Payload build/cashveil.ipa cashveil.ipa
mkdir -p build

xcodebuild -workspace ios/subscription.xcworkspace \
  -scheme subscription \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/cashveil.xcarchive \
  archive \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  AD_HOC_CODE_SIGNING_ALLOWED=YES

echo "📦 Packaging cashveil.ipa for sideloading..."
mkdir -p build/Payload

APP_PATH=$(find build/cashveil.xcarchive/Products/Applications -name "*.app" -maxdepth 1 | head -n 1)

if [ -z "$APP_PATH" ]; then
  echo "❌ Error: Could not find .app in archive"
  exit 1
fi

cp -r "$APP_PATH" build/Payload/
cd build
zip -r -q ../cashveil.ipa Payload
cd ..

echo "✔ Done! Sideloadable cashveil.ipa is created at: $(pwd)/cashveil.ipa"
