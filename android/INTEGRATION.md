# Hook Transpiler Android - Integration Guide

This guide explains how to integrate Hook Transpiler for Android into your Android application.

## Table of Contents

1. [Installation](#installation)
2. [Basic Setup](#basic-setup)
3. [JNI Integration](#jni-integration)
4. [Advanced Usage](#advanced-usage)
5. [Troubleshooting](#troubleshooting)

## Installation

### Option 1: Maven Central (Recommended)

Add to your `build.gradle.kts`:

```kotlin
dependencies {
    implementation("com.clevertree:hook-transpiler-android:1.3.9")
}
```

### Option 2: Local Build

Build locally and publish to your local Maven repository:

```bash
cd hook-transpiler/android
./build.sh release publish
```

Then add to your `build.gradle.kts`:

```kotlin
repositories {
    mavenLocal()
}

dependencies {
    implementation("com.clevertree:hook-transpiler-android:1.3.9")
}
```

## Basic Setup

### Step 1: Initialize in Application

```kotlin
import android.app.Application
import com.clevertree.hooktranspiler.jni.HookTranspiler
import com.clevertree.hooktranspiler.jni.HookExecutor

class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        
        // Initialize transpiler
        val transpiler = HookTranspiler()
        transpiler.initialize()
        
        // Initialize executor
        val executor = HookExecutor()
        executor.initialize()
    }
}
```

Register in `AndroidManifest.xml`:

```xml
<application
    android:name=".MyApp"
    ...>
</application>
```

### Step 2: Create HookApp Component

```kotlin
import com.clevertree.hooktranspiler.app.HookApp

class MyActivity : AppCompatActivity() {
    private lateinit var hookApp: HookApp

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        hookApp = HookApp(
            host = "http://localhost:8002",
            hookPath = "/hooks/client/app.jsx",
            onLoading = {
                showLoadingIndicator()
            },
            onReady = {
                hideLoadingIndicator()
            },
            onError = { error ->
                showError(error.message)
            }
        )
        
        hookApp.load()
    }

    override fun onDestroy() {
        super.onDestroy()
        hookApp.destroy()
    }
}
```

## JNI Integration

### Step 1: Create JNI Wrapper

Create `src/main/cpp/hook_transpiler_jni.cpp`:

```cpp
#include <jni.h>
#include <string>
#include "relay_hook_transpiler.h"  // From Rust crate

extern "C" JNIEXPORT jstring JNICALL
Java_com_clevertree_hooktranspiler_jni_TranspilerBridge_transpileJsx(
    JNIEnv* env, jclass clazz,
    jstring source, jstring filename) {
    
    const char* source_str = env->GetStringUTFChars(source, nullptr);
    const char* filename_str = env->GetStringUTFChars(filename, nullptr);
    
    std::string result = relay_hook_transpiler::transpile(source_str, filename_str);
    jstring result_str = env->NewStringUTF(result.c_str());
    
    env->ReleaseStringUTFChars(source, source_str);
    env->ReleaseStringUTFChars(filename, filename_str);
    
    return result_str;
}

// ... other JNI methods
```

See `src/main/cpp/hook_transpiler_jni.cpp.template` for complete implementation.

### Step 2: Configure CMakeLists.txt

```cmake
cmake_minimum_required(VERSION 3.18)
project(hook_transpiler_android)

set(CMAKE_CXX_STANDARD 17)

find_package(JNI REQUIRED)

add_library(relay_hook_transpiler SHARED src/main/cpp/hook_transpiler_jni.cpp)

target_include_directories(relay_hook_transpiler PRIVATE ${JNI_INCLUDE_DIRS})
target_link_libraries(relay_hook_transpiler PRIVATE ${JNI_LIBRARIES})
```

### Step 3: Configure Gradle

In `build.gradle.kts`:

```kotlin
android {
    ...
    externalNativeBuild {
        cmake {
            path = "CMakeLists.txt"
        }
    }
}
```

### Step 4: Build

```bash
./gradlew build
```

The native library will be compiled and packaged into the AAR.

## Advanced Usage

### Status Monitoring

```kotlin
hookApp.addStatusListener { status ->
    when {
        status.loading -> updateUI("Loading...")
        status.error != null -> updateUI("Error: ${status.error}")
        status.ready -> updateUI("Ready!")
    }
}
```

### Styling Integration

```kotlin
val hookApp = HookApp(
    host = "http://localhost:8002",
    hookPath = "/hooks/client/app.jsx",
    onElement = { tag, props ->
        // Register element with styling system
        val style = props["style"] as? String ?: ""
        applyElementStyle(tag, style)
    },
    registerTheme = { name, defs ->
        // Register theme
        val colors = defs["colors"] as? Map<String, String>
        applyTheme(name, colors)
    }
)
```

### Module Pre-loading

```kotlin
import com.clevertree.hooktranspiler.jni.ModuleLoader

val moduleLoader = ModuleLoader("http://localhost:8002")

// Pre-load modules referenced in hook
val modules = moduleLoader.preloadModules(hookSource).getOrThrow()
println("Loaded ${modules.size} modules")

// Access cached modules
val cachedModules = moduleLoader.getCachedModules()
```

### Custom Error Handling

```kotlin
hookApp = HookApp(
    host = "http://localhost:8002",
    hookPath = "/hooks/client/app.jsx",
    onError = { error ->
        when (error) {
            is HookError.NetworkError -> {
                showNetworkError(error.statusCode, error.url)
            }
            is HookError.ExecutionError -> {
                showExecutionError(error.sourceCode)
            }
            is HookError.ParseError -> {
                showParseError(error.line, error.column, error.source)
            }
            else -> {
                showGenericError(error.message)
            }
        }
    }
)
```

### Transpiler Direct Access

```kotlin
import com.clevertree.hooktranspiler.jni.HookTranspiler

val transpiler = HookTranspiler()
transpiler.initialize()

val source = """
    export default function App() {
        return <Text>Hello</Text>
    }
""".trimIndent()

// Transpile JSX to JavaScript
val jsCode = transpiler.transpile(source).getOrThrow()
println("Transpiled: $jsCode")

// Extract imports
val imports = transpiler.getImports(source).getOrThrow()
println("Imports: $imports")

// Get version
val version = transpiler.getVersion()
println("Transpiler version: $version")
```

### JS Executor Direct Access

```kotlin
import com.clevertree.hooktranspiler.jni.HookExecutor

val executor = HookExecutor()
executor.initialize()

// Execute JavaScript
val result = executor.execute("1 + 1", "math.js").getOrThrow()
println("Result: $result")  // Output: "2"

// Set and get global variables
executor.setGlobal("name", "World")
val greeting = executor.execute("'Hello ' + name", "greeting.js").getOrThrow()
println(greeting)  // Output: "Hello World"
```

## Troubleshooting

### Native Library Not Loading

Error: `UnsatisfiedLinkError: Unable to load library "relay_hook_transpiler"`

**Solutions:**
1. Ensure native library is built: `./gradlew build`
2. Check library name matches: `System.loadLibrary("relay_hook_transpiler")`
3. Verify library exists in APK: `unzip -l app-debug.apk | grep so`

### Transpilation Failures

Error: `Transpilation failed`

**Solutions:**
1. Check JSX syntax is valid
2. Ensure filename ends in `.jsx` or `.tsx`
3. Check transpiler is initialized: `transpiler.initialize()`
4. Run self-test: `transpiler.runSelfTest()`

### Execution Errors

Error: `JS execution failed`

**Solutions:**
1. Ensure JS executor is initialized: `executor.initialize()`
2. Check code syntax is valid JavaScript
3. Inject helpers: `executor.initialize()` does this automatically
4. Check for missing imports/modules

### Module Loading Failures

Error: `Failed to fetch module`

**Solutions:**
1. Verify server is running and accessible
2. Check module path is correct (should start with `/`)
3. Check file exists on server
4. Review network logs for HTTP errors

### Memory Issues

Error: `OutOfMemoryError` or slowness

**Solutions:**
1. Clear module cache: `moduleLoader.clearCache()`
2. Destroy HookApp when done: `hookApp.destroy()`
3. Reduce hook complexity
4. Check for memory leaks in native code

## Performance Optimization

### Module Caching

```kotlin
// Module loader caches modules automatically
// Check cache status
val cacheSize = moduleLoader.cacheSize()
println("Cached modules: $cacheSize")

// Clear if needed
moduleLoader.clearCache()
```

### Lazy Loading

```kotlin
// Don't load hook until it's visible
lazyHookApp = HookApp(host, hookPath)

// Only load when user navigates to hook
override fun onResume() {
    super.onResume()
    lazyHookApp.load()
}

override fun onPause() {
    super.onPause()
    lazyHookApp.clear()
}
```

### Reuse Instances

```kotlin
// Good: Reuse HookApp instance
private lateinit var hookApp: HookApp

override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    hookApp = HookApp(host, hookPath)
    hookApp.load()
}

// Bad: Creating new instance every time
override fun updateHook(path: String) {
    HookApp(host, path).load()  // Don't do this!
}
```

## Next Steps

- Read [README.md](./README.md) for API reference
- Review [PURE_ANDROID_HOOKAPP_DESIGN.md](../PURE_ANDROID_HOOKAPP_DESIGN.md) for architecture
- Check example implementation in test classes
- Implement JNI bindings for your specific JS engine

## Support

For issues and questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review test cases: `src/test/kotlin/`
3. Check example JNI template: `src/main/cpp/hook_transpiler_jni.cpp.template`
4. Open issue on GitHub: https://github.com/clevertree/hook-transpiler
