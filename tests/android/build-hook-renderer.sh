#!/bin/bash
# Build hook-renderer.js for Android tests
# This bundles @clevertree/hook-transpiler and @clevertree/themed-styler for QuickJS/Android

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Build the bundle with esbuild
npx esbuild \
  --bundle \
  --platform=node \
  --format=iife \
  --global-name=HookTranspilerAndroid \
  --external:react \
  --external:android-ios-native \
  --external:yaml \
  --external:themedStylerBridge \
  --external:styleManager \
  --external:unifiedBridge \
  --outfile=app/src/main/assets/hook-renderer.js \
  --minify=false \
  <<'EOF'
// Android hook-renderer entry point
import { HookRenderer, HookApp, transpileCode, installWebApiShims, initAndroidThemedStyler, createAndroidTheme } from '@clevertree/hook-transpiler/android'

// Export for QuickJS global
globalThis.HookTranspilerAndroid = {
  HookRenderer,
  HookApp,
  transpileCode,
  installWebApiShims,
  initAndroidThemedStyler,
  createAndroidTheme
}
EOF

echo "✅ hook-renderer.js built successfully!"
ls -lh app/src/main/assets/hook-renderer.js
