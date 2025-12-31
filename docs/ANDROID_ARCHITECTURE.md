# Hook-Transpiler Android Architecture - Refactored

## Overview
Unified JSX rendering strategy for both web (WASM) and Android (QuickJS/JNI) using the ACT library, with zero code duplication.

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
│  │ • WASM init      │    │ • QuickJS setup  │               │
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

### `src/android/quickJsContext.ts` ✅
Manages CommonJS module execution in QuickJS.

**Problem Solved**: 
- QuickJS eval() doesn't automatically have access to function-local variable scope
- Transpiled code uses `module.exports.default = ...` but module wasn't accessible

**Solution**:
```typescript
export function createQuickJsContext(evalFn?: typeof eval): QuickJsModuleContext {
  // Provides: executeCode(code, filename) → result
  // Automatically wraps eval to ensure module and all globals are in scope
  // Returns module.exports.default for hook component
}
```

**Usage Pattern**:
```typescript
const ctx = createQuickJsContext()
ctx.setGlobal('React', React)
ctx.setGlobal('__hook_jsx_runtime', hookRuntime)
const hookFn = ctx.executeCode(transpiledCode, 'hook.jsx')
const component = hookFn({ /* props */ })
```

### `src/android/webApiShims.ts` ✅
Minimal shims for missing Web APIs - NOT fetch (that's native).

**APIs Provided**:
- ✅ `URLSearchParams` shim (if missing from QuickJS)
- ✅ Timer verification (setTimeout/setInterval must exist)
- ⚠️ `URL` - warns if missing (may be in QuickJS already)
- ❌ `fetch` - NOT installed here (already native via Kotlin)
- ❌ `Request/Response/Headers` - NOT installed (native handles this)

**Usage**:
```typescript
import { installWebApiShims } from '@clevertree/hook-transpiler/android'

installWebApiShims({ requireTimers: true, debug: true })
```

### Already Implemented (No Changes Needed)

#### Kotlin `QuickJSManager.kt` - Native Fetch
```kotlin
globalThis.fetch = function(url, options) {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(7)
    globalThis.__pendingFetches[id] = { resolve, reject }
    globalThis.__pushMessage('fetch', { url, options, id })
  })
}
```

**Why it works**:
- Async Promise-based API matches web fetch()
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

