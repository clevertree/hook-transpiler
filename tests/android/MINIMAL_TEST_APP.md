# Minimal Test App Architecture

## Overview
The test app has been simplified to a minimal implementation that uses the hook-transpiler library for all transpilation work. The app demonstrates both local and remote hook testing.

## New UI Structure

### Layouts Created
- `activity_main.xml` - Main activity with TabLayout and ViewPager2
- `fragment_local_hook.xml` - Local hook test UI with output log and render container
- `fragment_remote_hook.xml` - Remote hook test UI with URL input, status log, and render container

### Components

#### MainActivity
- Simple host activity with tab navigation
- Initializes JSCManager for JavaScript execution
- Sets up ViewPager2 with two test fragments

#### LocalHookFragment
Tests local hook from assets:
- Hook file: `tests/android/app/src/main/assets/test-hook.jsx`
- **Process**: Reads asset → Uses library's `HookTranspiler` to transpile → Executes via `JSCManager.renderHook()`
- Shows transpilation status and execution output

#### RemoteHookFragment
Tests remote hook fetching:
- Default URL: `https://clevertree.github.io/relay-template/hooks/client/get-client.jsx`
- **Process**: Uses library's `HookRenderer.fetchAndTranspile()` → Executes via `JSCManager.renderRemoteHook()`
- **Important**: When URL is known, skips OPTIONS query and fetches directly
- Shows fetch/transpile status and execution output

## Library Usage

### HookTranspiler (from library)
```kotlin
val transpiler = com.clevertree.hooktranspiler.transpiler.HookTranspiler()
val result = transpiler.transpile(source, filename)
```
Used for: Local asset transpilation

### HookRenderer (from library)
```kotlin
val renderer = HookRenderer(
    host = hostUrl,
    onLoading = { /* ... */ },
    onReady = { /* ... */ },
    onError = { /* ... */ }
)
val result = renderer.fetchAndTranspile(hookPath).getOrThrow()
```
Used for: Remote hook fetch + transpile (skips OPTIONS when URL is known)

### JSCManager (test app)
```kotlin
jscManager.renderHook("test-hook.jsx")  // For local assets
jscManager.renderRemoteHook(source, container)  // For remote hooks
```
Used for: JavaScript execution via JavaScriptCore

## Architecture Flow

### Local Hook Test
1. Fragment reads `test-hook.jsx` from assets
2. Library's `HookTranspiler.transpile()` converts JSX to JS
3. `JSCManager.renderHook()` executes the transpiled code
4. Views are rendered via AndroidRenderer

### Remote Hook Test
1. Fragment calls library's `HookRenderer.fetchAndTranspile(url)`
2. HookRenderer fetches source from remote URL (no OPTIONS query needed)
3. HookRenderer transpiles JSX using Rust transpiler
4. `JSCManager.renderRemoteHook()` executes the transpiled code
5. Views are rendered via AndroidRenderer

## Key Principles

1. **Minimal Test App**: No duplicate functionality - all transpilation uses library
2. **Library First**: HookTranspiler and HookRenderer from library handle all JSX processing
3. **Known URLs**: When remote URL is known, OPTIONS query is skipped
4. **Separation**: Library handles fetch+transpile, test app handles execution+rendering

## Build & Deploy

```bash
cd tests/android
./gradlew clean assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## File Locations

### Library (android/)
- `src/main/kotlin/.../render/HookRenderer.kt` - Remote fetch+transpile
- `src/main/kotlin/.../transpiler/HookTranspiler.kt` - Transpilation wrapper
- `src/main/java/com/relay/client/RustTranspilerModule.java` - JNI bridge to Rust
- `src/main/java/com/facebook/jsc/wrapper/` - JSC wrappers

### Test App (tests/android/app/)
- `src/main/java/com/relay/test/MainActivity.kt` - Main activity
- `src/main/java/com/relay/test/LocalHookFragment.kt` - Local hook test
- `src/main/java/com/relay/test/RemoteHookFragment.kt` - Remote hook test
- `src/main/java/com/relay/test/JSCManager.kt` - JS execution engine
- `src/main/java/com/relay/test/AndroidRenderer.kt` - Native view rendering
- `src/main/assets/test-hook.jsx` - Local test hook
