#!/usr/bin/env node

/**
 * Hook Transpiler for Android - Package Index
 * 
 * This package provides a complete native Android implementation of:
 * 1. JSX transpiler (via Rust/JNI bridge)
 * 2. JavaScript executor (via QuickJS/JNI bridge)
 * 3. Module loader (for dependency pre-fetching)
 * 4. Hook renderer (orchestrates transpilation, loading, execution)
 * 5. Hook app (lifecycle management, styling integration)
 * 
 * For integration guide, see: INTEGRATION.md
 * For API reference, see: README.md
 * For architecture details, see: ../PURE_ANDROID_HOOKAPP_DESIGN.md
 */

const fs = require('fs')
const path = require('path')

interface PackageFile {
    path: string
    type: 'kotlin' | 'cpp' | 'cmake' | 'gradle' | 'typescript' | 'markdown'
    description: string
}

const packageFiles: PackageFile[] = [
    // Kotlin Source Files
    {
        path: 'src/main/kotlin/com/clevertree/hooktranspiler/app/HookApp.kt',
        type: 'kotlin',
        description: 'Main container for hook lifecycle, state management, and styling integration'
    },
    {
        path: 'src/main/kotlin/com/clevertree/hooktranspiler/render/HookRenderer.kt',
        type: 'kotlin',
        description: 'Orchestrates JSX transpilation, module loading, and JS execution'
    },
    {
        path: 'src/main/kotlin/com/clevertree/hooktranspiler/jni/TranspilerBridge.kt',
        type: 'kotlin',
        description: 'JNI bindings to Rust JSX transpiler'
    },
    {
        path: 'src/main/kotlin/com/clevertree/hooktranspiler/jni/HookTranspiler.kt',
        type: 'kotlin',
        description: 'Kotlin wrapper for transpiler with error handling'
    },
    {
        path: 'src/main/kotlin/com/clevertree/hooktranspiler/jni/ModuleLoader.kt',
        type: 'kotlin',
        description: 'Fetches and caches hook dependencies before execution'
    },
    {
        path: 'src/main/kotlin/com/clevertree/hooktranspiler/jni/JsExecutor.kt',
        type: 'kotlin',
        description: 'JNI bindings to QuickJS JS engine'
    },
    {
        path: 'src/main/kotlin/com/clevertree/hooktranspiler/jni/HookExecutor.kt',
        type: 'kotlin',
        description: 'Kotlin wrapper for JS executor with error handling'
    },
    {
        path: 'src/main/kotlin/com/clevertree/hooktranspiler/model/JsxElement.kt',
        type: 'kotlin',
        description: 'JSX element and related data models'
    },
    {
        path: 'src/main/kotlin/com/clevertree/hooktranspiler/error/HookError.kt',
        type: 'kotlin',
        description: 'Comprehensive error types and reporting'
    },
    {
        path: 'src/main/kotlin/com/clevertree/hooktranspiler/styling/StylingRegistry.kt',
        type: 'kotlin',
        description: 'Tracks registered UI elements and themes for styling integration'
    },

    // C++/JNI Files
    {
        path: 'src/main/cpp/hook_transpiler_jni.cpp.template',
        type: 'cpp',
        description: 'JNI native method implementations (template to fill in)'
    },
    {
        path: 'CMakeLists.txt',
        type: 'cmake',
        description: 'CMake configuration for native library build'
    },

    // Build Configuration
    {
        path: 'build.gradle.kts',
        type: 'gradle',
        description: 'Gradle build configuration for Android library'
    },
    {
        path: 'gradle.properties',
        type: 'gradle',
        description: 'Gradle properties and version information'
    },
    {
        path: 'settings.gradle.kts',
        type: 'gradle',
        description: 'Gradle settings and repository configuration'
    },
    {
        path: 'pom.xml',
        type: 'gradle',
        description: 'Maven build configuration for JAR distribution'
    },
    {
        path: 'consumer-proguard-rules.pro',
        type: 'gradle',
        description: 'ProGuard rules for library consumers'
    },
    {
        path: 'build.sh',
        type: 'gradle',
        description: 'Shell script for building and publishing'
    },

    // TypeScript/JavaScript Definitions
    {
        path: 'index.android.ts',
        type: 'typescript',
        description: 'TypeScript type definitions and JS glue layer'
    },

    // Tests
    {
        path: 'src/test/kotlin/com/clevertree/hooktranspiler/test/HookTranspilerTests.kt',
        type: 'kotlin',
        description: 'Unit tests for transpiler, models, and registries'
    },

    // Documentation
    {
        path: 'README.md',
        type: 'markdown',
        description: 'Complete API reference and usage guide'
    },
    {
        path: 'INTEGRATION.md',
        type: 'markdown',
        description: 'Step-by-step integration guide for Android apps'
    }
]

const filesByType = packageFiles.reduce((acc, file) => {
    if (!acc[file.type]) acc[file.type] = []
    acc[file.type].push(file)
    return acc
}, {} as Record<string, PackageFile[]>)

console.log('Hook Transpiler for Android - Package Index')
console.log('============================================')
console.log()

console.log('Overview:')
console.log('  Total files: ' + packageFiles.length)
console.log('  Languages: ' + Object.keys(filesByType).join(', '))
console.log()

for (const [type, files] of Object.entries(filesByType)) {
    console.log(`${type.toUpperCase()} Files (${files.length}):`)
    files.forEach(file => {
        console.log(`  • ${file.path}`)
        console.log(`    ${file.description}`)
    })
    console.log()
}

console.log('Key Directories:')
console.log('  src/main/kotlin/com/clevertree/hooktranspiler/')
console.log('    ├── app/          - HookApp (lifecycle management)')
console.log('    ├── render/       - HookRenderer (orchestration)')
console.log('    ├── jni/          - JNI bindings and wrappers')
console.log('    ├── model/        - Data structures')
console.log('    ├── error/        - Error handling')
console.log('    └── styling/      - Styling integration')
console.log()

console.log('Build Flow:')
console.log('  1. Kotlin compilation: src/main/kotlin -> build/classes/kotlin')
console.log('  2. CMake build: src/main/cpp -> build/intermediates/cmake')
console.log('  3. AAR packaging: classes + native libs -> build/outputs/aar')
console.log('  4. Maven publish: AAR -> ~/.m2/repository (local) or Maven Central')
console.log()

console.log('Distribution Formats:')
console.log('  • AAR (Android Archive) - includes native libraries')
console.log('  • JAR (Java Archive) - Kotlin classes only')
console.log('  • Maven Central - published via Maven')
console.log('  • Local Maven - ~/.m2/repository')
console.log()

console.log('Getting Started:')
console.log('  1. Read: README.md')
console.log('  2. Follow: INTEGRATION.md')
console.log('  3. Build: ./build.sh release')
console.log('  4. Publish: gradle publishLocal')
console.log()

export { }
