# Hook Transpiler for Android

Native Android implementation of JSX hook transpiler and renderer for Relay hooks.

## Overview

This package provides:

1. **HookTranspiler** - Kotlin wrapper around Rust transpiler (via JNI)
2. **HookExecutor** - Kotlin wrapper for QuickJS JS engine (via JNI)
3. **ModuleLoader** - Pre-fetches hook dependencies before execution
4. **HookRenderer** - Orchestrates transpilation, module loading, and execution
5. **HookApp** - Container for lifecycle management and styling integration
6. **JNI Bindings** - Native bridges to Rust and JS runtime

## Architecture

```
┌─────────────────────────────────────────────┐
│ Kotlin Code (HookApp / HookRenderer)         │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌──────────────────────┐  ┌──────────────────┐
│ JNI Transpiler       │  │ JNI Executor     │
│ - transpileJsx()     │  │ - executeJs()    │
│ - extractImports()   │  │ - setGlobal()    │
└──────────┬───────────┘  └──────────┬───────┘
           │                         │
        ┌──┴─────────────────────────┴──┐
        │                               │
        ▼                               ▼
┌──────────────────────┐     ┌──────────────────┐
│ Rust Transpiler      │     │ QuickJS Runtime  │
│ (WASM-compiled)      │     │ (C/C++ binding)  │
└──────────────────────┘     └──────────────────┘
```

## Building

### Prerequisites

- Android NDK (for native compilation)
- Rust toolchain (for transpiler)
- Gradle or Maven
- Android SDK

### Gradle Build

```bash
cd hook-transpiler/android
./gradlew build
```

This will:
1. Compile Kotlin code
2. Run CMake to build native library
3. Package as AAR

### Maven Build

```bash
cd hook-transpiler/android
mvn clean package
```

### Publish Locally

**Gradle:**
```bash
./gradlew publishLocal
```

**Maven:**
```bash
mvn install
```

## Usage

### Basic Setup

```kotlin
import com.clevertree.hooktranspiler.app.HookApp
import com.clevertree.hooktranspiler.model.HookStatus

// Create HookApp instance
val hookApp = HookApp(
    host = "http://localhost:8002",
    hookPath = "/hooks/client/get-client.jsx",
    onStatus = { status: HookStatus ->
        println("Hook status: $status")
    },
    onError = { error ->
        println("Error: ${error.message}")
    },
    onReady = {
        println("Hook loaded and ready")
    }
)

// Load the hook
hookApp.load()

// Check status
val status = hookApp.getStatus()
println("Loading: ${status.loading}")
println("Ready: ${status.ready}")
```

### With Styling Integration

```kotlin
val hookApp = HookApp(
    host = "http://localhost:8002",
    hookPath = "/hooks/client/app.jsx",
    onElement = { tag, props ->
        // Register with styled-components or similar
        registerElementStyle(tag, props)
    },
    registerTheme = { name, defs ->
        // Register theme for custom styling
        applyTheme(name, defs)
    }
)

hookApp.load()
```

### Status Listeners

```kotlin
// Add multiple status listeners
hookApp.addStatusListener { status ->
    updateUI(status)
}

hookApp.addStatusListener { status ->
    updateAnalytics(status)
}
```

## JNI Integration

### Native Methods

The following native methods are available via JNI:

**TranspilerBridge:**
- `transpileJsx(source, filename)` - Transpile JSX to JS
- `extractImports(source)` - Get import paths from source
- `getVersion()` - Get transpiler version
- `runSelfTest()` - Run transpiler self-test
- `isReady()` - Check if transpiler is ready

**JsExecutor:**
- `initialize()` - Initialize JS runtime
- `executeJs(code, filename)` - Execute JavaScript code
- `setGlobal(name, value)` - Set global variable
- `getGlobal(name)` - Get global variable
- `injectHelpers()` - Inject React-like helpers
- `reset()` - Reset execution context
- `isInitialized()` - Check if executor is ready
- `getEngineVersion()` - Get JS engine version

### Implementing JNI Bindings

1. Create `src/main/cpp/hook_transpiler_jni.cpp` (use template as reference)
2. Implement native methods to call Rust transpiler and JS engine
3. Configure `CMakeLists.txt` to compile native library
4. Package native library with AAR

Example JNI implementation is provided in `src/main/cpp/hook_transpiler_jni.cpp.template`

## Package Structure

```
android/
├── CMakeLists.txt                 # Native build config
├── build.gradle.kts              # Gradle build config
├── pom.xml                       # Maven build config
├── index.android.ts              # TypeScript type definitions
├── src/main/
│   ├── kotlin/com/clevertree/hooktranspiler/
│   │   ├── app/
│   │   │   └── HookApp.kt
│   │   ├── render/
│   │   │   ├── HookRenderer.kt
│   │   │   └── JsxParser.kt
│   │   ├── jni/
│   │   │   ├── TranspilerBridge.kt
│   │   │   ├── HookTranspiler.kt
│   │   │   ├── ModuleLoader.kt
│   │   │   ├── JsExecutor.kt
│   │   │   └── HookExecutor.kt
│   │   ├── model/
│   │   │   └── JsxElement.kt
│   │   ├── error/
│   │   │   └── HookError.kt
│   │   └── styling/
│   │       └── StylingRegistry.kt
│   └── cpp/
│       └── hook_transpiler_jni.cpp.template
└── components/
    └── (React Native components - if applicable)
```

## TypeScript Interfaces

The `index.android.ts` file provides TypeScript interfaces for:

- `HookStatus` - Hook lifecycle status
- `HookError` - Error types and details
- `StyleSnapshot` - Styling registry snapshot
- `TranspilerBridge` - Rust transpiler interface
- `JsExecutorBridge` - JS engine interface
- `ModuleLoader` - Module loading interface
- `HookAppProps` - HookApp configuration
- `HookRendererProps` - HookRenderer configuration

## Error Handling

The package provides detailed error handling:

```kotlin
val result = hookApp.load()
val error = hookApp.getError()

if (error != null) {
    when (error) {
        is HookError.NetworkError -> {
            println("Network error: ${error.message}")
            println("URL: ${error.url}")
            println("Status: ${error.statusCode}")
        }
        is HookError.ExecutionError -> {
            println("Execution error: ${error.message}")
            println("Source: ${error.sourceCode}")
        }
        is HookError.ParseError -> {
            println("Parse error at line ${error.line}")
            println("Context: ${error.context}")
        }
        else -> println("Error: ${error.message}")
    }
}
```

## Module Pre-loading

Hooks can import modules that are pre-fetched before execution:

```kotlin
// ModuleLoader automatically:
// 1. Extracts import paths from source
// 2. Fetches each module from server
// 3. Caches fetched modules
// 4. Injects into execution context

val modules = moduleLoader.preloadModules(source).getOrThrow()
```

## Styling Integration

The package integrates with external styling systems:

```kotlin
hookApp.registerElement("View", mapOf(
    "style" to "color: red"
))

hookApp.registerThemeDefinition("dark", mapOf(
    "primary" to "#333",
    "secondary" to "#666"
))

val snapshot = hookApp.getStyleSnapshot()
println("Registered elements: ${snapshot.registeredElements.size}")
println("Registered themes: ${snapshot.themes.size}")
```

## Maven Repository

Published to Maven Central Repository:

```xml
<dependency>
    <groupId>com.clevertree</groupId>
    <artifactId>hook-transpiler-android</artifactId>
    <version>1.3.9</version>
</dependency>
```

## Building for Distribution

### Create AAR

```bash
./gradlew build
# Output: android/build/outputs/aar/hook-transpiler-android-release.aar
```

### Create JAR (for pure Kotlin consumers)

```bash
./gradlew jar
# Output: android/build/libs/hook-transpiler-android-1.3.9.jar
```

### Publish to Maven Central

```bash
./gradlew publishToSonatype
```

## License

MIT OR Apache-2.0

## Related Packages

- `relay-hook-transpiler` (Rust crate) - JSX transpiler
- `@clevertree/hook-transpiler` (npm) - Web version
- `@clevertree/themed-styler` (npm) - Styling system

## Contributing

See main repository: https://github.com/clevertree/hook-transpiler
