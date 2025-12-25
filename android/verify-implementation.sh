#!/bin/bash
# Verification script for Hook Transpiler Android Implementation
# Checks that all required files are in place

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "========================================="
echo "Hook Transpiler Android - File Verification"
echo "========================================="
echo ""

# Array of expected files
declare -a EXPECTED_FILES=(
  # Kotlin Source
  "src/main/kotlin/com/clevertree/hooktranspiler/app/HookApp.kt"
  "src/main/kotlin/com/clevertree/hooktranspiler/render/HookRenderer.kt"
  "src/main/kotlin/com/clevertree/hooktranspiler/jni/TranspilerBridge.kt"
  "src/main/kotlin/com/clevertree/hooktranspiler/jni/HookTranspiler.kt"
  "src/main/kotlin/com/clevertree/hooktranspiler/jni/ModuleLoader.kt"
  "src/main/kotlin/com/clevertree/hooktranspiler/jni/JsExecutor.kt"
  "src/main/kotlin/com/clevertree/hooktranspiler/jni/HookExecutor.kt"
  "src/main/kotlin/com/clevertree/hooktranspiler/model/JsxElement.kt"
  "src/main/kotlin/com/clevertree/hooktranspiler/error/HookError.kt"
  "src/main/kotlin/com/clevertree/hooktranspiler/styling/StylingRegistry.kt"
  
  # C++/Native
  "src/main/cpp/hook_transpiler_jni.cpp.template"
  "CMakeLists.txt"
  
  # Build Config
  "build.gradle.kts"
  "pom.xml"
  "gradle.properties"
  "settings.gradle.kts"
  "consumer-proguard-rules.pro"
  "build.sh"
  
  # Tests
  "src/test/kotlin/com/clevertree/hooktranspiler/test/HookTranspilerTests.kt"
  
  # TypeScript
  "index.android.ts"
  
  # Documentation
  "README.md"
  "INTEGRATION.md"
  "IMPLEMENTATION_SUMMARY.md"
  "INDEX.js"
)

echo "Checking ${#EXPECTED_FILES[@]} files..."
echo ""

MISSING=0
FOUND=0

for file in "${EXPECTED_FILES[@]}"; do
  if [ -f "$SCRIPT_DIR/$file" ]; then
    echo "✓ $file"
    ((FOUND++))
  else
    echo "✗ MISSING: $file"
    ((MISSING++))
  fi
done

echo ""
echo "========================================="
echo "Results:"
echo "  Found: $FOUND / ${#EXPECTED_FILES[@]}"
echo "  Missing: $MISSING"
echo "========================================="
echo ""

if [ $MISSING -eq 0 ]; then
  echo "✓ All files present!"
  echo ""
  echo "Package structure is ready for:"
  echo "  1. Gradle build: ./gradlew build"
  echo "  2. Maven build: mvn clean package"
  echo "  3. Local publishing: ./build.sh release publish"
  echo "  4. Integration into Android projects"
  echo ""
  exit 0
else
  echo "✗ Some files are missing!"
  echo ""
  exit 1
fi
