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
echo "Building WASM for web with --target web and --features wasm..."
wasm-pack build --release --target web --features wasm

echo "Deploying to web client..."
WASM_DIR="../relay-clients/packages/web/src/wasm"
cp pkg/relay_hook_transpiler_bg.wasm "$WASM_DIR/"
cp pkg/relay_hook_transpiler.js "$WASM_DIR/"
cp pkg/relay_hook_transpiler.d.ts "$WASM_DIR/" 2>/dev/null || true
cp pkg/relay_hook_transpiler_bg.wasm.d.ts "$WASM_DIR/" 2>/dev/null || true
echo "✓ Deployed to $WASM_DIR"

echo "✅ Build complete! Version $NEW_VERSION deployed"
echo "   - Web: relay-clients/packages/web/src/wasm/"
