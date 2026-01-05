#!/bin/bash
set -e

# Parse command line arguments
DEBUG_MODE=0
for arg in "$@"; do
    case $arg in
        --debug)
            DEBUG_MODE=1
            shift
            ;;
    esac
done

# Increment patch version in Cargo.toml and package.json
VERSION=$(grep '^version = ' Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

echo "Incrementing version: $VERSION -> $NEW_VERSION"
sed -i "s/^version = \"$VERSION\"/version = \"$NEW_VERSION\"/" Cargo.toml
sed -i "s/\"version\": \"$VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json

# Build everything
echo "Building TS and WASM..."

if [ $DEBUG_MODE -eq 1 ]; then
    echo "DEBUG MODE ENABLED: Building with debug feature..."
    DEBUG_FEATURES="--features debug"
else
    DEBUG_FEATURES=""
fi

# Build WASM
wasm-pack build --release --target web --features wasm $DEBUG_FEATURES

# WASM Optimization
WASM_OPT_BIN=$(command -v wasm-opt || find /home/ari/.cache/.wasm-pack -name wasm-opt -type f | head -n 1)
if [ -n "$WASM_OPT_BIN" ]; then
    echo "Optimizing WASM with $WASM_OPT_BIN..."
    # Enable bulk-memory to avoid validation errors
    "$WASM_OPT_BIN" -Oz --enable-bulk-memory pkg/relay_hook_transpiler_bg.wasm -o pkg/relay_hook_transpiler_bg.wasm
else
    echo "wasm-opt not found, skipping optimization."
fi

# Copy to local wasm and dist folders
mkdir -p wasm
cp pkg/relay_hook_transpiler* wasm/
mkdir -p dist/web/wasm
cp pkg/relay_hook_transpiler* dist/web/wasm/
mkdir -p dist/wasm
cp pkg/relay_hook_transpiler* dist/wasm/

# Copy md2jsx WASM if present
if [ -d "../md2jsx/pkg" ]; then
    echo "Copying md2jsx WASM..."
    cp ../md2jsx/pkg/md2jsx* wasm/
    cp ../md2jsx/pkg/md2jsx* dist/web/wasm/
    cp ../md2jsx/pkg/md2jsx* dist/wasm/
fi

# Deploy to relay-client-web if it exists
RELAY_CLIENT_WEB="/home/ari/dev/relay-client-web"
if [ -d "$RELAY_CLIENT_WEB" ]; then
    echo "Deploying to relay-client-web..."
    mkdir -p "$RELAY_CLIENT_WEB/src/wasm"
    cp pkg/relay_hook_transpiler* "$RELAY_CLIENT_WEB/src/wasm/"
fi

echo "Build and deploy complete."
