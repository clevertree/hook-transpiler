#!/bin/bash
# Build script for Hook Transpiler Android

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "========================================="
echo "Hook Transpiler Android Build Script"
echo "========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."
if ! command -v gradle &> /dev/null; then
    echo "ERROR: Gradle is not installed"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo "WARNING: Rust/Cargo not found. Native transpiler may not build."
fi

echo "Prerequisites OK"
echo ""

# Options
BUILD_TYPE="${1:-debug}"
PUBLISH="${2:-false}"

case "$BUILD_TYPE" in
    debug)
        echo "Building DEBUG library..."
        gradle -p "$SCRIPT_DIR" clean build
        ;;
    release)
        echo "Building RELEASE library..."
        gradle -p "$SCRIPT_DIR" clean build -x test
        ;;
    *)
        echo "Invalid build type: $BUILD_TYPE"
        echo "Usage: ./build.sh [debug|release] [publish]"
        exit 1
        ;;
esac

echo ""
echo "Build completed successfully!"
echo ""

# Show output locations
AAR_PATH="$SCRIPT_DIR/build/outputs/aar"
if [ -d "$AAR_PATH" ]; then
    echo "Android Archive (AAR) files:"
    find "$AAR_PATH" -name "*.aar" -exec ls -lh {} \;
    echo ""
fi

JAR_PATH="$SCRIPT_DIR/build/libs"
if [ -d "$JAR_PATH" ]; then
    echo "JAR files:"
    find "$JAR_PATH" -name "*.jar" -exec ls -lh {} \;
    echo ""
fi

# Optionally publish
if [ "$PUBLISH" = "publish" ] || [ "$PUBLISH" = "true" ]; then
    echo "Publishing to local Maven repository..."
    if [ "$BUILD_TYPE" = "release" ]; then
        gradle -p "$SCRIPT_DIR" publishLocal
        echo "Published successfully!"
        echo "Maven local repository: ~/.m2/repository/com/clevertree/hook-transpiler-android/"
    else
        echo "Publish only supported for release builds"
    fi
fi

echo ""
echo "Done!"
