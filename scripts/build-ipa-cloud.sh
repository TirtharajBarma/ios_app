#!/usr/bin/env bash
set -e

echo "☁️  Building iOS .ipa via EAS Cloud (Zero local Xcode required)..."
echo "📌 Profile: preview (configured in eas.json for internal distribution .ipa)"
echo "🚀 Submitting build to Expo Cloud servers..."

npx eas build --platform ios --profile preview "$@"

echo "✔ Cloud build submitted! Check your EAS dashboard or terminal link above to download your .ipa or install directly."
