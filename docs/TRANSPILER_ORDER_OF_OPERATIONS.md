# Transpiler Order of Operations Analysis

## Current Problems

### 1. **Duplicate Code Paths**
There are TWO completely different transpilation paths based on the target:

**Path A: Android + native-swc feature** (lib.rs lines 130-145)
```
Source → SWC (parse + React + TS strip) → transform_dynamic_imports → Output
```

**Path B: Everything else** (lib.rs lines 147-160)
```
Source → jsx_parser (custom) → [optional: downlevel_for_jsc if Android] → Output
```

**Problem**: Path B never applies `transform_dynamic_imports`! So if the native-swc feature isn't enabled, dynamic imports don't work.

### 2. **Confusing Feature Gates**
- `#[cfg(all(feature = "native-swc", not(target_arch = "wasm32")))]` gates the SWC path
- But the jsx_parser path doesn't have dynamic import transformation
- The jsx_parser DOES have `transform_dynamic_imports` function but it's only called from Path A

### 3. **ES6 Module Transform Issues**
The `transform_es6_modules` function (jsx_parser.rs line 1329):
- Calls `transform_dynamic_imports` FIRST
- But this is a SEPARATE entry point not used by the main transpiler

### 4. **Lost in Translation**
When Android code goes through Path B (no native-swc):
1. jsx_parser::transpile_jsx() - handles JSX only
2. swc_transformer::downlevel_for_jsc() - ES5 downleveling
3. **NEVER** calls transform_dynamic_imports!

## Correct Order of Operations Should Be

For ALL targets:

```
1. Parse source (detect if TS, JSX exists)
2. Strip TypeScript (if needed)
3. Transform JSX to jsx() calls
4. Transform static imports (import X from 'y' → require/global)
5. Transform dynamic imports (import('x') → __hook_import('x'))  ← CRITICAL
6. Apply CommonJS wrapping (if to_commonjs=true)
7. Downlevel ES features (if target needs it)
8. Emit final code
```

## The Fix

We need to consolidate the paths and ensure dynamic import transformation happens for ALL Android builds, not just those with native-swc.

### Option 1: Always use SWC for Android
- Remove jsx_parser fallback for Android
- Simplify to one code path
- Requires native-swc feature to always be enabled for Android

### Option 2: Add dynamic import transform to jsx_parser path
- Call `jsx_parser::transform_dynamic_imports()` in Path B
- Keep both paths but make them functionally equivalent

### Option 3: Unified pipeline
- Create a single transformation pipeline that handles all cases
- Use SWC when available, jsx_parser as fallback
- Always apply the same transformations regardless of which parser is used

## Current State of Dynamic Imports

The `transform_dynamic_imports` function exists and works correctly (verified by tests), but:

- ✅ Called in SWC path (Path A) - line 141
- ❌ NOT called in jsx_parser path (Path B) - missing!
- ✅ Called in `transform_es6_modules` but that's a separate API

## Recommendation

**Immediate fix**: Add one line to lib.rs around line 155:

```rust
if opts.target == TranspileTarget::Android {
    debug_ctx.trace("Applying ES5 downleveling for Android JavaScriptCore");
    let downleveled = swc_transformer::downlevel_for_jsc(&jsx_output)?;
    
    // ADD THIS LINE:
    let transformed = jsx_parser::transform_dynamic_imports(&downleveled);
    
    return Ok(transformed);
}
```

**Long-term fix**: Refactor to unified pipeline (Option 3) with clear stages that always run in the same order.
