#!/bin/bash
set -e

# Targets to build
TARGETS=("aarch64-linux-android" "armv7-linux-androideabi" "x86_64-linux-android" "i686-linux-android")

# Output directory for JNI libs
JNI_LIBS_DIR="android/jniLibs"
mkdir -p $JNI_LIBS_DIR

# Ensure we are in the root directory
cd "$(dirname "$0")/.."

for TARGET in "${TARGETS[@]}"; do
    echo "Building for $TARGET..."
    cargo ndk -t $TARGET build --release --features android --manifest-path "$PWD/Cargo.toml"

    # Map rust target to android jni dir name
    case $TARGET in
        "aarch64-linux-android") JNI_DIR="arm64-v8a" ;;
        "armv7-linux-androideabi") JNI_DIR="armeabi-v7a" ;;
        "x86_64-linux-android") JNI_DIR="x86_64" ;;
        "i686-linux-android") JNI_DIR="x86" ;;
    esac

    mkdir -p "$JNI_LIBS_DIR/$JNI_DIR"
    cp "target/$TARGET/release/librelay_hook_transpiler.so" "$JNI_LIBS_DIR/$JNI_DIR/"
    
    # Also sync themed-styler if it exists
    THEMED_STYLER_DIR="/home/ari/dev/themed-styler"
    if [ -d "$THEMED_STYLER_DIR" ]; then
        cp "$THEMED_STYLER_DIR/target/$TARGET/release/libthemed_styler.so" "$JNI_LIBS_DIR/$JNI_DIR/" || true
    fi

    # Also copy to test app
    TEST_APP_JNI="tests/android/app/src/main/jniLibs/$JNI_DIR"
    mkdir -p "$TEST_APP_JNI"
    cp "$JNI_LIBS_DIR/$JNI_DIR/"*.so "$TEST_APP_JNI/"
done

echo "Android build complete. Libraries are in $JNI_LIBS_DIR"
