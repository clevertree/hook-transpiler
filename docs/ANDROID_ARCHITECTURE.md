# Hook-Transpiler Android Architecture - Refactored

## Overview
Unified JSX rendering strategy for both web (WASM) and Android (JavaScriptCore/JNI) using the ACT library, with zero code duplication.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Hook App Layer                        │
│  (index.web.ts / index.android.ts - Platform Entry Points)  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Component Layer                           │
│  HookApp + HookRenderer (wraps transpilation & rendering)   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Runtime/Module Layer                        │
│  ┌──────────────────┐    ┌──────────────────┐               │
│  │  Web Layer       │    │  Android Layer   │               │
│  ├──────────────────┤    ├──────────────────┤               │
│  │ • WASM init      │    │ • JSC setup      │               │
│  │ • Browser APIs   │    │ • JNI transpiler │               │
│  │ • fetch, timers  │    │ • Native fetch   │               │
│  │ • URL, etc       │    │ • Module shims   │               │
│  └──────────────────┘    └──────────────────┘               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Transpiler Layer                                │
│  ┌──────────────────┐    ┌──────────────────┐               │
│  │  relay_hook_     │    │  relay_hook_     │               │
│  │  transpiler.     │    │  transpiler.so   │               │
│  │  wasm + JS       │    │  (JNI via .so)   │               │
│  └──────────────────┘    └──────────────────┘               │
│                          (Compiled from Rust)                │
└─────────────────────────────────────────────────────────────┘
```

## Core Modules

### `HookRenderer.kt` (Kotlin) ✅
The primary entry point for Android. Manages the `JSContext` (via `jscbridge`) and coordinates fetching, transpilation, and rendering.

**Key Responsibilities**:
- Initializes `JSContext` and installs native bridge functions.
- Fetches hook source code (local or remote).
- Calls `HookTranspiler` (Rust/JNI) to convert JSX to JS.
- Executes transpiled JS in the `JSContext`.
- Coordinates with `NativeRenderer` to create Android views.

### `bridge.js` (JavaScript Asset) ✅
A JavaScript shim loaded into every `JSContext` to provide a web-compatible environment.

**APIs Provided**:
- ✅ `setTimeout` / `clearTimeout` (via `__android_schedule_timer`)
- ✅ `setInterval` / `clearInterval`
- ✅ `console` polyfill (via `__android_log`)
- ✅ `fetch` polyfill (via `__android_fetch`)
- ✅ Virtual module system (`globalThis.__clevertree_packages`)

### `NativeRenderer.kt` (Kotlin) ✅
Converts the virtual view hierarchy from the JS runtime into actual Android `View` objects.

**Key Responsibilities**:
- Handles `createView`, `updateProps`, `addChild`, etc.
- Applies styles using `ThemedStylerModule` (Rust/JNI).
- Manages the view tree and event listeners.

### Already Implemented (No Changes Needed)

#### Native Fetch Bridge
```kotlin
ctx.setObjectForKey("__android_fetch", object : JavaScriptObject() {
    fun callString(url: String, optionsJson: String?): String {
        // Native implementation using HttpURLConnection
    }
})
```

**Why it works**:
- `bridge.js` wraps this in a Promise-based `fetch()` function that matches the Web API.
- Returns Response object with `ok`, `status`, `text()`, `json()`
- No CORS (native layer handles allowlists)
- Host bridges HTTP client to QuickJS via `__pushMessage` + `__resolveFetch`

#### Kotlin Transpiler Binding
```kotlin
globalThis.__transpileSync = NativeRenderer.transpiler
globalThis.__hook_jsx_runtime = Act.jsxRuntime
```

**Why it works**:
- JNI callback directly invokes Rust transpiler
- ACT library provides JSX runtime that renders to native views
- Both are pre-initialized before any hook code runs

## Integration Points

### For Web (`src/index.ts`)
```typescript
import { initWasmTranspiler } from '@clevertree/hook-transpiler'

// 1. Load WASM transpiler
await initWasmTranspiler()
globalThis.__hook_transpile_jsx = wasmTranspile

// 2. Use standard Web APIs (nothing extra needed)
// fetch, URL, setTimeout, etc all exist natively

// 3. Render hooks with HookApp
<HookApp>
  {(defaults) => <HookRenderer {...defaults} />}
</HookApp>
```

### For Android (`src/index.android.ts`)
```typescript
import { installWebApiShims } from '@clevertree/hook-transpiler/android'
import { createQuickJsContext } from '@clevertree/hook-transpiler/android'

// 1. Initialize Kotlin QuickJSManager first (sets up fetch, transpiler, etc)
// (This happens in MainActivity during QuickJS setup)

// 2. Install Web API shims (timers, URL, URLSearchParams)
installWebApiShims({ requireTimers: true })

// 3. Render hooks - same API as web!
<HookApp>
  {(defaults) => <HookRenderer {...defaults} />}
</HookApp>
```

## Key Design Decisions

### ✅ NO Fetch Polyfill
- Fetch already handled by native Kotlin code
- Creating a JS polyfill would duplicate logic
- Instead: verify it exists, use it directly

### ✅ Minimal WebAPI Shims
- Only install URL/URLSearchParams if missing
- Verify timers exist (host must provide)
- Don't override anything that's already native

### ✅ Common Module Execution Model
- Same JSX → JavaScript transpilation on both platforms
- Same `module.exports.default` pattern for hooks
- Same error handling and debug logging

### ✅ Same ACT Rendering Pipeline
- Web: `Act.render(component)` → React DOM
- Android: `Act.render(component)` → native views
- Hooks don't know the difference

## What's Already Working

| Feature | Web | Android | Status |
|---------|-----|---------|--------|
| JSX transpilation | WASM | JNI binding | ✅ Both platforms |
| Module execution | eval() in browser | eval() in QuickJS | ✅ Both platforms |
| Component rendering | Act → DOM | Act → native | ✅ Both platforms |
| fetch() API | Native browser | Native Kotlin | ✅ Already native |
| Timers (setTimeout) | Native browser | Handler/Looper | ✅ Host provided |
| URL API | Browser | ⚠️ May need shim | ⏳ Optional |
| URLSearchParams | Browser | 🔧 Polyfill added | ✅ Shimmed |

## What's NEW in This Refactoring

1. **`quickJsContext.ts`** - Proper module eval wrapping for Android
2. **`webApiShims.ts`** - Clarified shims (NO fetch duplicate)
3. **Unified exports** - `index.android.ts` exports consistent API
4. **Clear documentation** - Integration strategy documented

## Testing Checklist

### Phase 1: Module Execution (Current)
- [ ] Simple JSX: `<div>Hello</div>`
- [ ] Theme object: `const colors = { ... }`
- [ ] Nested objects: `colors.primary`
- [ ] Function parameters: `hook(context)` receives context

### Phase 2: Web API Usage
- [ ] Fetch in hook: `await fetch(url).then(r => r.json())`
- [ ] URLSearchParams: `new URLSearchParams(...)`
- [ ] Timers: `setTimeout(() => ..., 1000)`
- [ ] URL: `new URL(href)`

### Phase 3: Advanced JSX
- [ ] Conditional rendering: `props.show ? <div/> : null`
- [ ] Array mapping: `items.map(item => <div key={...} />)`
- [ ] Event handlers: `<button onClick={...} />`
- [ ] Nested components: `<Parent><Child /></Parent>`

### Phase 4: Platform Parity
- [ ] Same hook code renders identically on web + Android
- [ ] Error messages consistent across platforms
- [ ] Performance similar (transpilation time)

## Migration Notes

### For Existing Android Apps
If you have a custom QuickJSManager:

1. **Fetch already exists?** ✅ Do nothing - it's already there
2. **Want URL/URLSearchParams?** Install the web API shims:
   ```kotlin
   // In Kotlin after QuickJS setup:
   engine.evaluate("""
     globalThis.installWebApiShims = ${readAsset("webApiShims.js")}
     globalThis.installWebApiShims()
   """)
   ```
3. **Module execution issues?** Use `createQuickJsContext` pattern:
   ```kotlin
   val ctx = createQuickJsContext()
   val hookFn = ctx.executeCode(transpiledCode)
   ```

### For New Android Apps
Start with the test app pattern:
```kotlin
// 1. Load HookRenderer.kt (includes transpiler + ACT/React)
// 2. Kotlin init creates fetch + timers + transpiler binding
// 3. TypeScript code uses HookApp/HookRenderer
// 4. Same hook code works on Android + web
```

## Success Criteria ✅
- [x] Same hook code compiles on web + Android
- [x] No duplicate fetch implementations
- [x] Clear separation: native vs polyfill
- [x] Minimal Web API shims (URL/URLSearchParams only)
- [x] Module execution properly scoped
- [x] Zero breaking changes to existing web code

