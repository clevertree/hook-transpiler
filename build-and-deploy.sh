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

