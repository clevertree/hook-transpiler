#!/bin/bash
set -e

# Targets to build
TARGETS=("aarch64-linux-android" "armv7-linux-androideabi" "x86_64-linux-android" "i686-linux-android")

# Output directory for JNI libs
JNI_LIBS_DIR="android/jniLibs"
mkdir -p $JNI_LIBS_DIR

for TARGET in "${TARGETS[@]}"; do
    echo "Building for $TARGET..."
    cargo ndk -t $TARGET build --release --features android

    # Map rust target to android jni dir name
    case $TARGET in
        "aarch64-linux-android") JNI_DIR="arm64-v8a" ;;
        "armv7-linux-androideabi") JNI_DIR="armeabi-v7a" ;;
        "x86_64-linux-android") JNI_DIR="x86_64" ;;
        "i686-linux-android") JNI_DIR="x86" ;;
    esac

    mkdir -p "$JNI_LIBS_DIR/$JNI_DIR"
    cp "target/$TARGET/release/librelay_hook_transpiler.so" "$JNI_LIBS_DIR/$JNI_DIR/"
done

echo "Android build complete. Libraries are in $JNI_LIBS_DIR"
