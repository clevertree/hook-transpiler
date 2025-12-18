#!/bin/bash
set -e

# Increment patch version in Cargo.toml
VERSION=$(grep '^version = ' Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

echo "Incrementing version: $VERSION -> $NEW_VERSION"
sed -i "s/^version = \"$VERSION\"/version = \"$NEW_VERSION\"/" Cargo.toml

# Build WASM for web
echo "Building WASM for web..."
wasm-pack build --target web --out-dir pkg --features wasm

# Deploy to web client
echo "Deploying to web client..."
cp pkg/hook_transpiler_bg.wasm ../relay-clients/packages/web/src/wasm/
cp pkg/hook_transpiler.js ../relay-clients/packages/web/src/wasm/

# Update React Native dependency version
echo "Updating React Native dependency..."
RN_CARGO="../relay-clients/packages/mobile/rust/Cargo.toml"
if [ -f "$RN_CARGO" ]; then
  # Check if hook-transpiler is already in dependencies
  if grep -q "hook-transpiler" "$RN_CARGO"; then
    # Update existing version
    sed -i "s/hook-transpiler = { version = \"[^\"]*\"/hook-transpiler = { version = \"$NEW_VERSION\"/" "$RN_CARGO"
    echo "Updated hook-transpiler dependency to $NEW_VERSION in React Native"
  else
    echo "Note: hook-transpiler not found in $RN_CARGO dependencies"
  fi
else
  echo "Warning: React Native Cargo.toml not found at $RN_CARGO"
fi

echo "✅ Build complete! Version $NEW_VERSION deployed"
echo "   - Web: relay-clients/packages/web/src/wasm/"
echo "   - React Native: Cargo.toml dependency updated (rebuild native module to apply)"
