# HookRenderer Architecture & Flow

## Overview
`HookRenderer` is a native Android component that bridges JavaScript/JSX code execution with native Android view rendering. It supports two rendering backends: **Act** (CleverTree's library) and **Android Native**, allowing users to choose which framework best suits their needs.

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INPUT: JSX/TypeScript Source Code                           │
│    • Local file path or remote URL                             │
│    • Supports .jsx, .tsx, .ts, .js files                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. FETCH (Async)                                                │
│    • Remote hooks: URL.readText()                              │
│    • Local hooks: context.assets.open()                        │
│    • Result cached in ConcurrentHashMap<String, String>        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. TRANSPILE (via HookTranspiler Rust crate)                   │
│    • Parse source and resolve scope                            │
│    • Strip TypeScript if .ts/.tsx                              │
│    • Apply React transform (JSX → createElement)               │
│    • Rewrite imports (static → globals, dynamic → __hook_import)│
│    • Output: ES5-compatible transpiled JavaScript              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. EXECUTE JS (in JSContext via jscbridge)                      │
│    • Set up global SWC helpers (_sliced_to_array, etc.)         │
│    • Wrap code in module { exports: {} } closure               │
│    • Execute via new Function() for better error reporting      │
│    • Transpiled code imports/requires resolved dynamically      │
│    • Result: module.exports (expected to be React component)    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. RENDER (via Act or Android Native)                           │
│    • Call renderer.render(Component, props)                    │
│    • Framework triggers bridge calls to create native views     │
│    • Each bridge call incremented and logged                    │
│    • NativeRenderer converts to Android View hierarchy          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. OUTPUT: Android View Tree in HookRenderer (ScrollView)       │
│    • onReady callback fires with native view count              │
│    • Views attached to ScrollView                              │
│    • Ready for display                                          │
└─────────────────────────────────────────────────────────────────┘
```

## Component Lifecycle

### Initialization
```kotlin
val renderer = HookRenderer(context)
renderer.setRendererMode(RendererMode.ACT)  // or ANDROID (default)
renderer.setHost("https://api.example.com")  // Optional, for remote hooks
```

1. **init block**: Calls `setupEngine()` immediately
2. **setupEngine()**: Creates `JSContext` and installs JS bridge
3. **installBridge()**: Registers 10+ native callback functions
4. **loadRuntime()**: Loads Act or Android Native bundle, injects SWC helpers

### Hook Loading
```kotlin
renderer.loadHook("path/to/hook.jsx")
// or
renderer.render(sourceCode, "hook.jsx", mapOf("prop1" to "value1"))
```

Flow:
1. Calls `onLoading` callback
2. Fetches source (local or remote)
3. Calls `onSourceLoaded` callback
4. Transpiles via `HookTranspiler`
5. Calls `onTranspiled` callback
6. Executes transpiled JS
7. Renders via Act/Android
8. Calls `onReady` callback with view count

### Error Handling
On any error, `onError` callback is invoked with `HookError`:
- `ParseError`: Syntax/transpilation errors (line, column, context)
- `ExecutionError`: Runtime errors (message, stack trace)

Error view displayed as red-text `TextView` in HookRenderer.

## JS Bridge API

### Native Callbacks (Kotlin → JS)
Global functions made available to JS code:

| Function | Purpose |
|----------|---------|
| `__android_log(level, msg)` | Relay console output |
| `__android_fetch(url, opts)` | HTTP requests |
| `__android_readFile(path)` | Read local/asset files |
| `__android_transpile(src, filename)` | Transpile JS dynamically |
| `__android_createView(json)` | Create native view |
| `__android_updateProps(json)` | Update view props |
| `__android_addChild(json)` | Add child view |
| `__android_removeChild(json)` | Remove child view |
| `__android_addEventListener(json)` | Register event listener |
| `__android_clearViews()` | Reset view tree |

### Global Objects & Functions (JS → Kotlin)
Available in JavaScript global scope:

| Object/Function | Purpose |
|-----------------|---------|
| `console` | Logging (log, warn, error, debug) |
| `fetch()` | HTTP requests (Promise-based) |
| `URL`, `URLSearchParams` | Web standard APIs |
| `require()` | Synchronous module loading |
| `__hook_import()` | Dynamic module loading (Promise) |
| `bridge` (alias `nativeBridge`) | Direct access to native bridge |
| `SWC helpers` | _sliced_to_array, _type_of, etc. |

### Bridge Logging Helper
```javascript
// Centralized logging for all bridge calls
globalObj.__logBridgeCall = function(methodName, info) {
    globalObj.__bridge_call_count__ = (globalObj.__bridge_call_count__ || 0) + 1;
    console.log('[bridge.' + methodName + '] #' + globalObj.__bridge_call_count__ + ' ' + (info || ''));
};
```

Each nativeBridge method calls this helper to track invocations.

## Module Resolution

### Require Chain
1. **Built-ins** (hardcoded): `react`, `act`, `@clevertree/act`, etc.
2. **Cache check**: By absolute path (relative imports resolved)
3. **File fetch**: Remote URLs or local assets
4. **Extension resolution**: Try `.jsx`, `.js` if no extension
5. **Transpile**: `__android_transpile` called on source
6. **Execute**: `new Function(code)` with helpers in scope
7. **Cache store**: Result cached for future requires

### Example Resolution
```javascript
require('./hooks/MyComponent');
// → parent: 'https://example.com/app/page.jsx'
// → resolved: 'https://example.com/app/hooks/MyComponent'
// → tries: .jsx, .js extensions
// → transpiles, executes, caches
```

## Rendering Mode Switch

Act and React Native have different APIs. HookRenderer abstracts both:

```kotlin
renderer.setRendererMode(RendererMode.ACT)
// → Unloads React Native bundle
// → Loads Act bundle from assets
// → Clears existing views
// → Resets JS context for new runtime
```

The same transpiled JSX code can be rendered with either framework by calling `.setRendererMode()` and re-rendering.

## Caching Strategy

1. **Source Cache**: `ConcurrentHashMap<String, String>` for remote hooks
   - Key: URL
   - Value: Raw source code
   - Avoids re-fetching same hook

2. **Module Cache**: `globalObj.__require_cache` in JS
   - Key: Absolute module path
   - Value: module.exports object
   - Prevents re-execution of same module

## Error Handling & Debugging

### Transpilation Errors
Caught during `transpile()`, reported as `ParseError` with:
- Message: "JS SyntaxError: ..."
- Line/column from transpiler
- Snippet showing error location

### Execution Errors
Caught in JS `new Function()` wrapper, reported as `ExecutionError` with:
- Message: "JS Error: ..."
- Stack trace
- Line info if available

### Bridge Errors
Logged via Log.e() and don't stop rendering
Examples: malformed JSON, missing props

### Debugging Logs
All major steps logged with "[TAG]" prefix:
- `[HookRenderer]`: Component lifecycle
- `[HookJS]`: JS console output
- `[bridge.*]`: Bridge calls with counter
- `[__require_module]`: Module resolution
- `[DIAGNOSTICS]`: Runtime validation

## Performance Considerations

1. **Coroutines**: All I/O (fetch, transpile, render) on `Dispatchers.Main`
2. **Caching**: Both source and module caches prevent redundant work
3. **JSContext Reuse**: Single `JSContext` per HookRenderer; cleared on mode switch
4. **Async Execution**: `scope.launch` prevents blocking UI thread

## Thread Safety

- `cache` & module cache: `ConcurrentHashMap`
- UI updates: Posted to main thread via `post {}`
- Coroutine scope: `Dispatchers.Main` ensures single-threaded JS execution

## Theming System

`HookRenderer` integrates with the `themed-styler` Rust crate to provide a robust, CSS-like theming system for native Android views.

### Architecture
1. **Kotlin Layer (`HookRenderer.kt`)**: Defines the theme JSON structure and manages theme switching.
2. **Rust Layer (`themed-styler`)**: Parses CSS-like rules, applies themes, and handles unit conversions (dp/sp to px).
3. **JS Layer (`@clevertree/themed-styler`)**: Provides a virtual module for hooks to query and change themes.

### Theme Inheritance
Themes follow a hierarchical inheritance model to reduce duplication:
- **`light`**: The base theme containing all core color definitions and styles.
- **`dark`**: Inherits from `light` and overrides specific colors for dark mode.
- **`default`**: Inherits from `light` (or `dark` depending on system settings).

Example definition in Kotlin:
```kotlin
"dark": mapOf(
    "inherits" to "light",
    "colors" to mapOf("surface" to "#1f2937", "text" to "#f9fafb")
)
```

### Dynamic Discovery
Hooks can dynamically discover available themes and their current state using the `@clevertree/themed-styler` module:

```javascript
import { getThemes, setCurrentTheme } from '@clevertree/themed-styler';

const themeState = getThemes();
const availableThemes = Object.keys(themeState.themes); // ['light', 'dark', 'default']

// Switch theme
setCurrentTheme('dark');
```

### Native Rendering Flow
1. JS calls `setCurrentTheme(name)`.
2. Bridge triggers `buildThemesMap(name)` in Kotlin.
3. Kotlin sends the theme JSON to the Rust `StyleCache`.
4. `NativeRenderer` uses the Rust engine to resolve styles for each view.
5. Resolved styles (colors, dimensions) are applied to native Android `View` and `Drawable` objects.

---

## Removal of Obsolete Code (Refactoring Summary)

- ✓ **StrictMode.permitAll()**: Removed (all I/O is async)
- ✓ **sourceMaps cache**: Removed (unused for error reporting)
- ✓ **Duplicate error handling**: Consolidated into single `handleError(HookError)` method
- ✓ **Bridge logging boilerplate**: Extracted to `__logBridgeCall()` helper
- ✓ **SWC helper parameter passing**: Simplified—helpers accessed from global scope

---

## Testing

Three test suites cover the refactored code:

1. **HookRendererTest.kt** (unit tests)
   - Initialization, mode switching, status management, cleanup

2. **HookRendererIntegrationTest.kt** (integration tests)
   - Full transpile→execute→render flow
   - Error handling (syntax, runtime, missing export)
   - Callback lifecycle
   - Mode switching during rendering

3. **HookRendererBridgeTest.kt** (bridge tests)
   - Console logging (log, warn, error, debug)
   - View creation (createView, updateProps, addChild, removeChild, addEventListener, clearViews)
   - Transpilation bridge
   - Fetch & URL APIs
   - Require/import resolution
   - Global error handler
   - Bridge call counting
