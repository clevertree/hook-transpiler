# Module Loading Deduplication Strategy

## Problem Analysis

The hook-transpiler library has the following issues causing duplicate module fetches:

1. **No Promise Caching**: `loadModule()` only caches the final result, not in-flight promises. If two parts of the code call `loadModule('./foo.js')` before the first fetch completes, both will trigger separate fetches.

2. **Path Normalization Inconsistency**: Paths like `'./plugin/tmdb.mjs'` and `'/hooks/client/plugin/tmdb.mjs'` resolve to the same file but generate different cache keys, causing duplicate fetches.

3. **Static Import Resolution Race**: `resolveStaticImports()` loads all imports in parallel but doesn't ensure they're cached before child modules try to import them lazily.

4. **Cache Key Mismatch**: Cache key is `${host}:${normalizedPath}` but normalization happens inside `loadModule()`, so the same logical path from different contexts may normalize differently.

## Current Code Issues

### Issue 1: No In-Flight Promise Cache
```typescript
// Current code in loadModule() - line ~530
const cacheKey = `${this.host}:${normalizedPath}`
if (this.moduleCache.has(cacheKey)) return this.moduleCache.get(cacheKey)

// Problem: Only checks for completed modules, not in-flight fetches
// If loadModule() is called twice before first fetch completes, both will fetch
```

### Issue 2: Path Normalization After Cache Check
```typescript
// Path normalization happens BEFORE cache check, but could still have issues
// with URL resolution from different contexts
let normalizedPath = modulePath
try {
    if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
        const base = fromPath && fromPath.startsWith('/') ? fromPath : '/hooks/client/get-client.jsx'
        const baseUrl = new URL(base, 'http://resolver.local')
        const resolved = new URL(modulePath, baseUrl)
        normalizedPath = resolved.pathname
    }
    // ...
}
```

### Issue 3: Static Imports Not Fully Awaited
```typescript
// In resolveStaticImports() - line ~386
await Promise.all(
    imports.map(async (imp) => {
        const mod = await loadModule(imp.specifier, filename)
        modules.set(imp.specifier, mod)
    })
)
// Problem: These calls to loadModule() may race with lazy imports later
// No guarantee subsequent loadModule() calls will hit the cache
```

## Solution Design

### 1. Add In-Flight Promise Cache

Add a separate cache for promises to ensure only one fetch happens per unique module:

```typescript
export class HookLoader {
    private moduleCache: Map<string, any> = new Map()
    private pendingFetches: Map<string, Promise<any>> = new Map() // NEW
    
    async loadModule(modulePath: string, fromPath: string, context: HookContext): Promise<any> {
        const cacheKey = this.normalizeToAbsolutePath(modulePath, fromPath)
        
        // Check completed cache first
        if (this.moduleCache.has(cacheKey)) {
            return this.moduleCache.get(cacheKey)
        }
        
        // Check if fetch is already in progress
        if (this.pendingFetches.has(cacheKey)) {
            return this.pendingFetches.get(cacheKey)!
        }
        
        // Start new fetch and cache the promise
        const fetchPromise = this._fetchAndLoad(cacheKey, normalizedPath, context)
        this.pendingFetches.set(cacheKey, fetchPromise)
        
        try {
            const result = await fetchPromise
            this.moduleCache.set(cacheKey, result)
            return result
        } finally {
            this.pendingFetches.delete(cacheKey)
        }
    }
}
```

### 2. Centralized Path Normalization

Extract path normalization into a dedicated method that produces consistent cache keys:

```typescript
private normalizeToAbsolutePath(modulePath: string, fromPath: string): string {
    // Always resolve to absolute path starting with '/'
    // This ensures './foo.js' from '/hooks/bar.js' and '/hooks/foo.js'
    // both produce the same cache key
    
    let normalized = modulePath
    
    if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
        const baseDir = fromPath.substring(0, fromPath.lastIndexOf('/')) || '/hooks/client'
        normalized = new URL(modulePath, `http://localhost${baseDir}/`).pathname
    } else if (!modulePath.startsWith('/')) {
        normalized = `/hooks/client/${modulePath}`
    }
    
    // Remove redundant './' and '../' segments
    const parts = normalized.split('/').filter(Boolean)
    const resolved: string[] = []
    for (const part of parts) {
        if (part === '..') resolved.pop()
        else if (part !== '.') resolved.push(part)
    }
    
    return '/' + resolved.join('/')
}
```

### 3. Preload Static Imports with Cache Guarantee

Ensure static imports are fully loaded and cached before returning:

```typescript
async function resolveStaticImports(code: string, filename: string, context: HookContext): Promise<string> {
    const imports = parseStaticImports(code)
    if (imports.length === 0) return code
    
    const loadModule = context?.helpers?.loadModule
    if (!loadModule) return code
    
    // Load all static imports and wait for caching
    const loadPromises = imports.map(async (imp) => {
        // This will use the promise cache, so only one fetch per unique module
        const mod = await loadModule(imp.specifier, filename)
        return { specifier: imp.specifier, mod }
    })
    
    const loaded = await Promise.all(loadPromises)
    const modules = new Map(loaded.map(l => [l.specifier, l.mod]))
    
    // Now rewrite the imports to use cached globals
    // ... rest of rewriting logic
}
```

### 4. Cache Key Strategy

Use `${host}:${absolutePath}` where:
- `host` = the origin server (e.g., `localhost:8083`)
- `absolutePath` = normalized absolute path starting with `/` (e.g., `/hooks/client/plugin/tmdb.mjs`)

This ensures:
- `./plugin/tmdb.mjs` from `/hooks/client/get-client.jsx` → `/hooks/client/plugin/tmdb.mjs`
- `/hooks/client/plugin/tmdb.mjs` directly → `/hooks/client/plugin/tmdb.mjs`
- Both produce cache key: `localhost:8083:/hooks/client/plugin/tmdb.mjs`

## Testing Strategy

### Unit Tests

1. **Test Promise Deduplication**
   - Call `loadModule()` twice in parallel for the same path
   - Verify only one fetch occurs (use spy/mock)
   - Verify both calls return the same result

2. **Test Path Normalization**
   - Load `'./plugin/tmdb.mjs'` from `/hooks/client/get-client.jsx`
   - Load `/hooks/client/plugin/tmdb.mjs` directly
   - Verify both produce the same cache key
   - Verify only one fetch occurs

3. **Test Static Import Preloading**
   - Create a module with static imports
   - Load the module
   - Verify static imports are in cache before module execution
   - Attempt to lazy load the same imports
   - Verify no additional fetches occur

### E2E Tests (Cypress)

1. **Test No Duplicate Network Requests**
   - Intercept all fetch/XHR requests
   - Load a hook that imports the same module multiple times
   - Assert each unique module URL is fetched exactly once

2. **Test Lazy + Static Import Interaction**
   - Create hook with both `import` and `import()` for same module
   - Verify module is fetched once
   - Verify both static and dynamic import work correctly

3. **Test Cross-Hook Caching**
   - Load hook A that imports module X
   - Load hook B that also imports module X
   - Verify module X is only fetched once

## Implementation Order

1. ✅ Create this strategy document
2. Add `normalizeToAbsolutePath()` method
3. Add `pendingFetches` Map
4. Refactor `loadModule()` to use promise cache
5. Update `resolveStaticImports()` to ensure caching
6. Add unit tests for cache behavior
7. Add Cypress tests for network deduplication
8. Run existing tests to ensure no regressions

## Expected Outcomes

- **No Duplicate Fetches**: Each unique module URL fetched exactly once per session
- **Correct Path Resolution**: Relative and absolute paths to same file use same cache entry
- **Race Condition Free**: Concurrent calls to load same module don't trigger multiple fetches
- **Static Before Dynamic**: Static imports fully loaded before module execution
- **Testable**: Clear unit and e2e tests verify deduplication behavior
