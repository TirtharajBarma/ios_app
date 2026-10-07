#!/usr/bin/env bash
set -e

echo "🚀 Building Release Archive for iOS..."
rm -rf build/monevo.xcarchive build/Payload build/monevo.ipa monevo.ipa
mkdir -p build

xcodebuild -workspace ios/subscription.xcworkspace \
  -scheme subscription \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/monevo.xcarchive \
  archive \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  AD_HOC_CODE_SIGNING_ALLOWED=YES

echo "📦 Packaging monevo.ipa for sideloading..."
mkdir -p build/Payload

APP_PATH=$(find build/monevo.xcarchive/Products/Applications -name "*.app" -maxdepth 1 | head -n 1)

if [ -z "$APP_PATH" ]; then
  echo "❌ Error: Could not find .app in archive"
  exit 1
fi

cp -r "$APP_PATH" build/Payload/
cd build
zip -r -q ../monevo.ipa Payload
cd ..

echo "✔ Done! Sideloadable monevo.ipa is created at: $(pwd)/monevo.ipa"
