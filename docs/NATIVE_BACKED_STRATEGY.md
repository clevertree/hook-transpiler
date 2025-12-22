# Hook-Transpiler: Native-Backed Rendering Strategy

## Overview
A unified JSX rendering system for web and Android that uses:
- **Web**: WASM transpiler + Browser APIs + React/DOM rendering
- **Android**: JNI transpiler + Native APIs + ACT library rendering

**Key Principle**: Native implementation where appropriate, minimal JavaScript shims where needed. Zero polyfill complexity.

## Architecture

### Layer 1: Native Implementations (Platform-Specific)

#### Web
- **Transpiler**: Rust compiled to WASM
- **APIs**: Browser built-ins (fetch, URL, timers, etc.)
- **Rendering**: React → DOM

#### Android
- **Transpiler**: Rust compiled to native `.so` via JNI
- **APIs**: Java/Kotlin implementations (HttpClient, Handler, etc.)
- **Rendering**: ACT library → native views

### Layer 2: Common JavaScript API

Both platforms export the same TypeScript interfaces:
```typescript
// Same for web and android
export { HookApp, HookRenderer, transpileHook }
export { createQuickJsContext } // Android specific, exported for power users
export { installWebApiShims } // Android specific, for missing APIs
```

### Layer 3: Hook Code (Platform Agnostic)

```tsx
// Works identically on web AND Android
export default function MyHook(context: HookContext) {
  const [data, setData] = useState(null)
  
  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(setData)
  }, [])
  
  return (
    <div>
      <h1>Data: {data}</h1>
    </div>
  )
}
```

## API Strategy

### What's Native (Don't Polyfill)

| API | Web | Android | Source |
|-----|-----|---------|--------|
| fetch() | Browser | Java HttpClient | Native code |
| setTimeout | Browser timer | Handler/Looper | Native code |
| JSX → JS | WASM | JNI → Rust | Compiled code |
| Component render | React/DOM | ACT library | Native library |

### What's Shimmed (Only if Missing)

| API | Web | Android | Source |
|-----|-----|---------|--------|
| URLSearchParams | Browser | Polyfill | `webApiShims.ts` |
| URL | Browser | May exist in QuickJS | Warning only |
| Headers | Browser | From fetch impl | Native code |

### Never Polyfill

- ❌ `fetch` - Use the native one already provided
- ❌ `Request/Response` - Part of native fetch binding
- ❌ Event system - Platform-specific (DOM vs native)
- ❌ State management - Use framework-level solution

## Integration Checklist

### For Web Apps

```typescript
import { initWeb, HookApp, HookRenderer } from '@clevertree/hook-transpiler'

// 1. Initialize WASM transpiler
await initWeb()

// 2. Render hooks - native fetch, timers, APIs all available
<HookApp host="http://localhost:8002">
  {(defaults) => <HookRenderer {...defaults} />}
</HookApp>
```

**No extra configuration needed** - Browser APIs are available by default.

### For Android Apps

#### Step 1: Kotlin Setup (in MainActivity)
```kotlin
// This is already done in hook-transpiler test app
val quickJs = QuickJSManager(context)
quickJs.initialize()  // Sets up fetch, timers, transpiler, ACT runtime
```

#### Step 2: TypeScript/JavaScript
```typescript
import { HookApp, HookRenderer, installWebApiShims } from '@clevertree/hook-transpiler/android'

// Optional: Install URL/URLSearchParams shim if needed
installWebApiShims({ requireTimers: true })

// Render hooks - same API as web!
<HookApp host="http://localhost:8002">
  {(defaults) => <HookRenderer {...defaults} />}
</HookApp>
```

**That's it** - fetch, timers, transpiler all pre-initialized by Kotlin.

## API Reference

### `installWebApiShims(options?: WebApiShimOptions): void`

**Android only** - Installs missing Web API shims.

```typescript
export interface WebApiShimOptions {
  /** Require setTimeout/setInterval; throw if missing (default: true) */
  requireTimers?: boolean
  /** Debug logging (default: false) */
  debug?: boolean
}
```

**What it does**:
- ✅ Installs URLSearchParams shim if missing
- ✅ Verifies setTimeout/setInterval exist
- ⚠️ Warns if URL is missing (may not be needed)
- ❌ Does NOT touch fetch (already native)

**Usage**:
```typescript
installWebApiShims({ requireTimers: true, debug: true })
```

### `createQuickJsContext(evalFn?: typeof eval): QuickJsModuleContext`

**Android only** - For power users who need direct control over module execution.

```typescript
export interface QuickJsModuleContext {
  executeCode(code: string, filename?: string): any
  setGlobal(name: string, value: any): void
  getGlobal(name: string): any
  getModuleExports(): any
  reset(): void
}
```

**Usage** (advanced):
```typescript
import { createQuickJsContext } from '@clevertree/hook-transpiler/android'

const ctx = createQuickJsContext()
ctx.setGlobal('React', React)
ctx.setGlobal('__hook_jsx_runtime', hookRuntime)

const transpiledCode = transpile(hookCode)
const hookFn = ctx.executeCode(transpiledCode, 'hook.jsx')
const component = hookFn({ /* props */ })
```

## Design Philosophy

### 1. Principle: Use Native Where Possible
- If the platform provides an API, use it
- Only shim when absolutely necessary
- Keep JavaScript layer thin and focused

### 2. Principle: Platform Agnostic Hook Code
- Hook developers shouldn't know if they're on web or Android
- Same `import` statements
- Same API calls (`fetch`, `fetch().json()`, `setTimeout`, etc.)
- Same Component API (React-like)

### 3. Principle: Minimal Glue Code
- Avoid duplicating implementations
- Android fetch doesn't have a JS polyfill
- Web doesn't need to know about QuickJS
- Components are platform-agnostic

### 4. Principle: Clear Separation
- **Native layer**: Handles integration, performance, security
- **Shim layer**: Only for missing APIs (URL, URLSearchParams, etc.)
- **App layer**: Hook code and React components

## Common Patterns

### Fetching Data
```typescript
// Works on both platforms
const response = await fetch('/api/data')
const data = await response.json()
```

**Behind the scenes**:
- Web: Browser fetch() directly
- Android: Kotlin HTTP client → QuickJS promise resolver

### Query Strings
```typescript
// Works on both platforms (URLSearchParams shim on Android)
const params = new URLSearchParams({ q: 'search' })
const response = await fetch(`/api?${params}`)
```

### Timers
```typescript
// Works on both platforms
setTimeout(() => {
  console.log('After 1 second')
}, 1000)
```

**Behind the scenes**:
- Web: Browser setTimeout
- Android: Handler.postDelayed() → callback

## Troubleshooting

### "fetch is not defined"
- **Web**: Make sure you're in a browser environment
- **Android**: Kotlin QuickJSManager didn't run - check initialization order

### "URL is not defined"
- **Web**: Shouldn't happen in modern browsers
- **Android**: QuickJS might not have URL built-in
- **Solution**: Use URLSearchParams instead, or provide custom URL shim

### "setTimeout is not defined"
- **Both platforms**: Host didn't provide timers
- **Android**: Kotlin QuickJSManager must inject setTimeout before running hook code

### "Variable not defined" inside hook
- **Both platforms**: Module scope issue with destructuring
- **Solution**: Use `const { colors } = theme` in function, not at top level

## FAQ

**Q: Why not have a fetch polyfill for Android?**
A: Fetch is already implemented by native Kotlin code. A JavaScript polyfill would be redundant and harder to maintain.

**Q: Can I use my own fetch implementation?**
A: On Android, modify the native QuickJSManager to use your HTTP client. On web, set `globalThis.__nativeFetch`.

**Q: Do I need to do anything special for Android?**
A: Just call `installWebApiShims()` for optional URL/URLSearchParams. Fetch, transpiler, and rendering are pre-initialized by Kotlin.

**Q: Can hooks access platform-specific APIs?**
A: Hooks should stay platform-agnostic for portability. Use the WebAPI surface (fetch, timers, URL) that both platforms provide.

**Q: What if I need to access native Android APIs?**
A: Use the bridge system - native code can inject custom globals into QuickJS context before running hooks.

## Architecture Decisions

### ✅ Native Fetch, Not Polyfill
- Benefit: Better performance, native error handling, proper streaming
- Trade-off: Requires Kotlin setup (worth it)
- Alternative: Would require JavaScript HTTP client, slower, more buggy

### ✅ Minimal WebAPI Shims
- Benefit: Small bundle size, less complexity, less maintenance
- Trade-off: Hooks can't use URL on Android if QuickJS doesn't have it
- Alternative: Include full URL polyfill (overkill, larger bundle)

### ✅ Platform-Agnostic Hook Code
- Benefit: Same code works everywhere, easier to test
- Trade-off: Can't access platform-specific APIs directly from hooks
- Alternative: Platform-specific hooks (defeats the purpose)

## Summary

**Native-backed rendering** means:
1. Use the platform's built-in APIs whenever possible
2. Shim only the missing pieces
3. Keep hook code completely portable
4. Provide consistent API on both platforms

This results in:
- ✅ Better performance (native implementations)
- ✅ Better reliability (fewer custom implementations)
- ✅ Better developer experience (same code everywhere)
- ✅ Better maintainability (less code to maintain)

