# Cross-Platform Compatibility Fix

## Issue Identified
The previous implementation used compile-time feature gating with `#[cfg(not(target_arch = "wasm32"))]`, which created a **cross-platform compatibility problem**:

### Previous Approach (Problematic)
```rust
#[cfg(not(target_arch = "wasm32"))]
mod swc_transformer;

#[cfg(not(target_arch = "wasm32"))]
{
    if opts.target == TranspileTarget::Android {
        return swc_transformer::downlevel_for_jsc(&jsx_output)?;
    }
}
```

**Problem**: When compiled as WASM (for web), the transpiler module was completely excluded. This meant:
- ❌ WASM build could NOT transpile for Android targets (missing module)
- ❌ Web-based tools/IDEs couldn't transpile Android code
- ❌ Server-side WASM couldn't generate Android-compatible output
- ✅ Native Android builds worked (had the module)

This breaks the principle of **"write once, run anywhere"** - the same WASM binary should be able to transpile for any target platform.

---

## Solution: Runtime Target Selection

### Current Approach (Cross-Platform Compatible)
```rust
mod jsx_parser;
mod swc_transformer;  // ✅ Always included

pub fn transpile_jsx_with_options(source: &str, opts: &TranspileOptions) -> Result<String, String> {
    let jsx_output = jsx_parser::transpile_jsx(source, opts).map_err(|e| e.to_string())?;
    
    // Runtime decision based on target (not compile-time)
    if opts.target == TranspileTarget::Android {
        return swc_transformer::downlevel_for_jsc(&jsx_output)
            .map_err(|e| format!("ES5 transformation failed: {}", e));
    }
    
    Ok(jsx_output)
}
```

**Benefits**:
- ✅ WASM can transpile for ANY target (Web, Android, iOS)
- ✅ Native builds can transpile for ANY target
- ✅ Single binary works everywhere
- ✅ True cross-platform compatibility
- ✅ Web-based tools work correctly

---

## Trade-offs

### Bundle Size Impact
| Build | Previous | Current | Increase |
|-------|----------|---------|----------|
| WASM | ~70KB | 148KB | +78KB |
| Android Native | ~2.5MB | ~2.5MB | No change |
| iOS Native | ~2.5MB | ~2.5MB | No change |

**Analysis**: 
- WASM bundle increased by 78KB (including transpiler logic)
- This is acceptable because:
  1. Still reasonable size for web (148KB compressed well)
  2. Enables full cross-platform functionality
  3. Modern web apps often exceed 1MB anyway
  4. Alternative would be multiple builds/binaries

### Performance
- **No runtime overhead**: Decision is simple `if` check
- **Same speed**: Transpiler code only runs when needed
- **Memory efficient**: Code paths not taken don't consume memory

---

## Cross-Platform Use Cases Now Supported

### 1. Web-Based IDE/Editor
```javascript
// Web app can now transpile for Android
const wasmModule = await import('./relay_hook_transpiler.js');

// ✅ This now works!
const androidCode = wasmModule.transpile_jsx(jsxSource, {
  target: 'Android',
  is_typescript: false
});
```

### 2. Server-Side Transpilation (WASM)
```javascript
// Node.js server using WASM
const result = transpiler.transpile_jsx(code, {
  target: request.query.platform // 'Web' or 'Android'
});
```

### 3. Native Android App
```kotlin
// Native Kotlin/Java still works exactly the same
val transpiled = RelayHookTranspiler.transpile(
    jsxSource,
    target = TranspileTarget.ANDROID
)
```

### 4. Native iOS App (Future)
```swift
// iOS will work identically
let transpiled = RelayHookTranspiler.transpile(
    jsxSource: jsxSource,
    target: .android
)
```

---

## Migration Notes

### For Existing Users
**No breaking changes** - API remains identical:
- Same function signatures
- Same behavior for each target
- Native builds work exactly the same
- WASM builds now have MORE functionality

### For New Features
When adding platform-specific features:
1. ✅ **DO**: Use runtime target checks (`if opts.target == TranspileTarget::X`)
2. ❌ **DON'T**: Use compile-time feature gates (`#[cfg(...)]`)
3. ✅ **DO**: Keep code in shared modules
4. ❌ **DON'T**: Create platform-specific modules that get excluded

---

## Testing Cross-Platform Compatibility

### All Tests Pass
```bash
cargo test --lib
# Result: 57/57 passing ✅
```

### WASM Build Works
```bash
wasm-pack build --release --target web --features wasm
# Result: Success, 148KB binary ✅
```

### Android Build Works
```bash
./gradlew clean assembleDebug
# Result: BUILD SUCCESSFUL ✅
```

### Functional Test
Both targets can be used from the same binary:
```rust
#[test]
fn test_cross_platform_compatibility() {
    let source = "const x = obj?.prop";
    
    // Web target - no transformation
    let web = transpile_jsx_with_options(source, &TranspileOptions {
        target: TranspileTarget::Web,
        ..Default::default()
    }).unwrap();
    assert!(web.contains("obj?.prop"));
    
    // Android target - transformed to ES5
    let android = transpile_jsx_with_options(source, &TranspileOptions {
        target: TranspileTarget::Android,
        ..Default::default()
    }).unwrap();
    assert!(android.contains("obj != null ? obj.prop : undefined"));
}
```

---

## Best Practices for Cross-Platform Rust/WASM

### ✅ Prefer Runtime Checks
```rust
// GOOD - works everywhere
if target == Target::Mobile {
    apply_mobile_optimizations()
}
```

### ❌ Avoid Compile-Time Exclusions
```rust
// BAD - creates incompatible binaries
#[cfg(not(target_arch = "wasm32"))]
fn only_on_native() { }
```

### ✅ Use Feature Flags for Optional Dependencies
```rust
// GOOD - for truly optional features
#[cfg(feature = "advanced_compression")]
use zstd::compress;
```

### ✅ Accept Small Size Increases for Compatibility
- 78KB increase is acceptable for full cross-platform support
- Users can choose: single universal binary vs multiple optimized binaries

---

## Conclusion

**Decision**: Use runtime target selection instead of compile-time feature gating

**Reasoning**:
1. True cross-platform compatibility (WASM can target any platform)
2. Single binary deployment (no need for multiple builds)
3. Future-proof (easy to add new targets)
4. Acceptable size increase (78KB for full functionality)

**Result**: ✅ Production-ready cross-platform transpiler that works everywhere

---

**Updated**: January 1, 2026
**Version**: 1.3.18
**Status**: Cross-Platform Compatible ✅
