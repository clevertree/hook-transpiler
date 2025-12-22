# Hook-Transpiler Android Refactoring Strategy

## Executive Summary
Refactor hook-transpiler to provide a unified API for JSX rendering on web (WASM) and Android (QuickJS/JNI) with consistent behavior using the ACT library for both platforms. The key innovation is proper module execution context and WebAPI shims that make same hook code work identically on both platforms.

## Current Issues

### 1. Module Execution Scope (CRITICAL)
- **Problem**: Transpiler outputs `module.exports.default = ...` but eval'd code lacks proper scope
- **Symptom**: ReferenceError on variable access inside hook functions
- **Root Cause**: eval() context doesn't have access to function-local variables after destructuring
- **Solution**: Implement proper CommonJS module wrapper with function-scoped context

### 2. Platform Divergence
- **Web**: Has `fetch`, `URL`, `URLSearchParams`, timers, all Web APIs
- **Android**: Running in QuickJS (minimal runtime) with only what we inject
- **Solution**: Provide platform-agnostic shims that wrap native bindings (Android) or use standard APIs (web)

### 3. Inconsistent Hook Loading
- **Web**: Files loaded via HTTP, transpiled by WASM, executed in browser context
- **Android**: Files loaded from assets, transpiled by JNI callback, executed in QuickJS eval()
- **Solution**: Unified HookRenderer component that abstracts platform differences

### 4. Theme/Styling Integration
- **Web**: CSS injected into document
- **Android**: Theme objects passed through native bridge
- **Solution**: Abstract theming behind consistent `ThemeRegistry` interface

## Architecture Design

### Layer 1: Core Transpiler (Rust WASM + JNI)
```
relay-hook-transpiler.wasm (web)
  ↓
  transpile_jsx(code, filename) → JavaScript
  ↑
libhook_transpiler.so (Android JNI)
```
**Responsibility**: Convert JSX → JavaScript with automatic import rewriting

### Layer 2: Platform Runtime Shims
```
web:
  ├─ Native fetch, timers, URL API
  └─ Pass-through to platform

android:
  ├─ fetch: ✅ ALREADY injected by Kotlin QuickJSManager
  ├─ timers: Verify setTimeout/setInterval provided by host
  ├─ URL/URLSearchParams: Polyfill if missing (QuickJS may not have it)
  └─ Module: CommonJS wrapper with proper context
```

### Layer 3: Module Execution Context
```
QuickJS eval() environment:
  ├─ globalThis.module = { exports: {} }
  ├─ globalThis.require = { react, jsx-runtime, @clevertree/meta }
  ├─ globalThis.__hook_jsx_runtime = Act's JSX handler
  ├─ globalThis.__hook_transpile_jsx = transpiler callback
  └─ Function-local variables accessible via proper wrapper
```

### Layer 4: Hook Rendering Pipeline
```
HookRenderer (web/android):
  1. Load hook code (HTTP or assets)
  2. Transpile via WASM or JNI
  3. Rewrite exports → module.exports.default
  4. Execute in module context
  5. Call hook function with context
  6. Render result via Act.render()
  7. Error boundary + status callback
```

### Layer 5: Client Integration
```
HookApp (web/android):
  ├─ Initialize transpiler (WASM or native)
  ├─ Install WebAPI shims
  ├─ Register theme loader
  ├─ Setup module loader
  └─ Wrap HookRenderer with defaults
```

## Implementation Plan

### Phase 1: Android Runtime Modules (priority: HIGH)

#### 1.1 `src/android/quickJsContext.ts` ✅ DONE
Creates proper module execution environment for eval()

```typescript
export interface QuickJsModuleContext {
  module: { exports: any }
  executeCode(code: string): any
  setGlobal(name: string, value: any): void
}

export function createQuickJsContext(engine: QuickJs): QuickJsModuleContext {
  // Setup: globalThis.module = { exports: {} }
  // Setup: eval wrapper that preserves local variable scope
}
```

**Key Implementation Details**:
- Use IIFE wrapper to preserve function-local scope during eval
- Pre-declare all globals before eval
- Export `module.exports.default` after execution
- Add debug logging for transpiled output

#### 1.2 `src/android/webApiShims.ts`
Minimal shims for missing Web APIs (URL, URLSearchParams, timers verification):

```typescript
export function installWebApiShims(options?: { requireTimers?: boolean; debug?: boolean }): void {
  // ✅ fetch() is already injected by Kotlin QuickJSManager - DO NOT override
  // ✅ URLSearchParams shim - provides polyfill if missing
  // ✅ Verify setTimeout/setInterval exist (should be provided by host)
  // ✅ Warn if URL not available
}
```

**Key Points**:
- **DOES NOT** install fetch - that's already done by native code
- **URLSearchParams**: Optional polyfill if not in QuickJS
- **Timers**: Verify they exist, throw if missing
- **URL**: Warn if missing (QuickJS may or may not have it)
- **No CORS**: Native layer already handles host allowlists if needed

### Phase 2: Module Execution Fix (priority: CRITICAL)

#### 2.1 Update Module Wrapper
Current broken approach:
```javascript
var module = { exports: {} };
(function() {
  var code = transpiled;
  eval(code);  // ❌ Can't see local variables!
}).call(null);
```

New correct approach:
```javascript
var module = { exports: {} };
var __context__ = {
  module: module,
  React: globalThis.React,
  require: globalThis.require,
  // ... all globals needed by transpiled code
};

eval(transpiled);  // ✅ Direct eval can see local + global scope

// Then use: module.exports.default
```

**Implementation**: Update `QuickJSManager.kt` renderHook() to use correct module wrapper

#### 2.2 Add Transpiled Output Logging
For debugging, log first 500 chars of transpiled code:
```kotlin
val transpiled = globalThis.__transpileSync.transpile(hookCode, filename)
Log.d(TAG, "[HookRenderer] Transpiled code (first 200 chars): ${transpiled.take(200)}")
```

### Phase 3: Android HookRenderer Component

#### 3.1 `src/components/android/HookRenderer.tsx`
TypeScript wrapper over rendering pipeline:

```typescript
export interface HookRendererProps {
  hookPath?: string
  host?: string
  props?: Record<string, any>
  onElement?: (element: any) => void
  onError?: (error: Error) => void
  onStatus?: (status: LoadingStatus) => void
}

export const HookRenderer: React.FC<HookRendererProps> = ({
  hookPath = '/hooks/client/get-client.jsx',
  host = 'http://localhost:8002',
  props = {},
  onElement,
  onError,
  onStatus
}) => {
  // 1. Fetch hook source from host
  // 2. Transpile via __hook_transpile_jsx
  // 3. Execute and call hook function
  // 4. Render result via Act.render()
  // 5. Handle errors with boundary
}
```

**Features**:
- Error boundary with fallback UI
- Loading state callback
- Props passing to hook function
- Transpilation caching
- Auto-retry with backoff

### Phase 4: Android HookApp Wrapper

#### 4.1 `src/components/android/HookApp.tsx`
Drop-in initialization wrapper:

```typescript
export interface HookAppProps {
  hookPath?: string
  host?: string
  fetchImpl?: (url: string, init?: any) => Promise<any>
  transpileImpl?: (code: string, filename: string) => string
  onThemeLoad?: (theme: any) => void
  children?: (renderer: HookRendererProps) => React.ReactNode
}

export const HookApp: React.FC<HookAppProps> = ({
  hookPath,
  host,
  fetchImpl,
  transpileImpl,
  onThemeLoad,
  children
}) => {
  // 1. Initialize transpiler (use transpileImpl if provided)
  // 2. Install WebAPI shims with fetchImpl
  // 3. Setup theme registry with onThemeLoad callback
  // 4. Render children with HookRenderer defaults
}
```

**Defaults**:
- `host`: 'http://localhost:8002'
- `hookPath`: '/hooks/client/get-client.jsx'
- `fetchImpl`: Uses global fetch (after shims installed)

### Phase 5: Documentation & Deployment

#### 5.1 Update README.md

**Web Setup**:
```typescript
import { HookApp, HookRenderer } from '@clevertree/hook-transpiler'

await initWeb()

<HookApp host="http://localhost:8002">
  {(defaults) => <HookRenderer {...defaults} />}
</HookApp>
```

**Android Setup** (from TypeScript):
```typescript
import { HookApp, HookRenderer } from '@clevertree/hook-transpiler/android'

// In Kotlin initialization:
// 1. Load act.js and hook-renderer.js into QuickJS
// 2. Set globalThis.__hook_transpile_jsx callback
// 3. Install fetch/timers shims

// In TypeScript:
export const App = () => (
  <HookApp
    fetchImpl={nativeFetch}  // From native bridge
    transpileImpl={nativeTranspile}  // From JNI callback
    onThemeLoad={applyNativeTheme}
  >
    {(defaults) => <HookRenderer {...defaults} />}
  </HookApp>
)
```

#### 5.2 Update Build Artifacts
- Copy `hook-renderer.js` to Android test assets
- Build TypeScript → JavaScript for Android exports
- Ship both platforms in npm package

## Testing Strategy

### Unit Tests
- Module scope with nested objects ✅
- Transpiler output with variable access ✅
- Import rewriting consistency ✅

### Integration Tests
- Simple JSX: `<div>Hello</div>` → renders on both platforms
- Theme objects: hook with `colors`, `spacing` objects
- Fetch in hook: load data and render
- Error boundary: handle transpilation + execution errors

### Platform Parity
- Same hook code executes identically on web + Android
- Same error messages and stack traces
- Same performance characteristics (transpilation time)

## Migration Path

### Immediate (Current Session)
1. ✅ Fix module scope in QuickJSManager.kt
2. ✅ Verify basic JSX rendering works
3. ✅ Create `src/android/quickJsContext.ts` (extracted from Kotlin pattern)
4. ✅ Clarified that fetch is ALREADY handled by native QuickJSManager - NO duplicate polyfill
5. ✅ Created `src/android/webApiShims.ts` for URL/URLSearchParams/timers verification only

### Short-term (Next Sessions)
4. Create `src/components/android/HookRenderer.tsx`
5. Create `src/components/android/HookApp.tsx`
6. Update `index.android.ts` exports to use new modules
7. Build TypeScript → JavaScript compilation

### Medium-term (Feature Complete)
8. Implement `src/components/android/HookRenderer.tsx`
9. Implement `src/components/android/HookApp.tsx`
10. Update README and build scripts

### Long-term (Maintenance)
11. Platform parity testing suite
12. Performance benchmarks
13. Deprecate old Android integration code

## Success Criteria
- ✅ Same hook code works on web + Android (module scope fixed)
- ✅ WebAPI shims allow hooks to use fetch, timers, URL
- ✅ HookApp provides one-liner initialization for both platforms
- ✅ Documentation shows complete examples
- ✅ No duplicate integration code across projects
- ✅ Error messages are informative on both platforms

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| QuickJS limitations for transpiled code | Test comprehensive JSX patterns, add logging |
| Native fetch integration complexity | Start with simple HTTP, add streaming later |
| Module scope edge cases with destructuring | Unit test destructuring patterns, document limitations |
| TypeScript compilation for Android | Use same tsconfig as web, build separate dist/ |

