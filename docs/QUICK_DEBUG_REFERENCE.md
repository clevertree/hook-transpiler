# Quick Debug Reference

## One-Liner Builds

```bash
# Debug build with feature
npm run build:debug

# All features for all platforms
cargo build --features debug-all

# Test with debug enabled
npm run test:debug

# Run only debug tests
cargo test --test debug_transpile --features debug
```

## Quick Test: Debug Hook with Breakpoints

```bash
# Transpile test hook and verify debugger statements preserved
cargo test test_transpile_debug_hook_with_debugger_statements --features debug -- --nocapture
```

## Platform Quick Start

### Web/WASM
```javascript
import { transpile_jsx, set_debug_level } from '@clevertree/hook-transpiler';
set_debug_level("trace");
const result = transpile_jsx("<div>test</div>", "test.jsx");
```

### Android
```kotlin
RustTranspiler.setDebugLevel(4) // Trace
val result = RustTranspiler.transpile(code, "hook.jsx")
// adb logcat -s RustTranspiler:*
```

### iOS
```swift
hook_transpiler_set_debug_level(4) // Trace
let result = hook_transpiler_transpile(code, codeLen, filename, fnLen)
// Check Xcode console
```

## Debug Levels

| Name | Value | Use When |
|------|-------|----------|
| off | 0 | Production (no overhead) |
| error | 1 | Only show errors |
| warn | 2 | Errors + warnings |
| info | 3 | General info |
| **trace** | **4** | **Default with feature** |
| verbose | 5 | Maximum debugging |

## Test Hook Breakpoints

File: `tests/fixtures/debug_hook.jsx`

Contains 5 debugger breakpoints:
- Module level
- Hook function entry
- Event handler
- Component render
- Utility function

## Verify Implementation

```bash
# All tests pass
cargo test --features debug

# Check file exists
ls tests/fixtures/debug_hook.jsx

# Check debug module
cargo test --lib debug::tests --features debug

# Check integration tests
cargo test debug_transpile --features debug --no-fail-fast
```

## Feature Flags

```toml
# In Cargo.toml:
[features]
debug          # Enable debug logging
debug-all      # Debug + all platforms (wasm, android, native-swc)
```

```bash
# Build commands:
cargo build --features debug              # Minimal debug
cargo build --features debug-all          # Full debug
cargo build --features debug,wasm         # Debug + WASM
cargo build --features debug,android      # Debug + Android
```

## Check Debug Output

### Web
```javascript
const level = getDebugLevel();
console.log("Current level:", level); // "trace" or "off"
```

### Android
```bash
adb logcat -s RustTranspiler:I
# Look for: [info], [trace], [error]
```

### iOS
```swift
let level = hook_transpiler_get_debug_level()
// Check Xcode console output
```

## Transpilation with Debug

All three platforms support setting debug level before transpilation:

```rust
// Rust API
let opts = TranspileOptions {
    debug_level: DebugLevel::Trace,
    ..Default::default()
};
transpile_jsx_with_options(source, &opts)?;
```

The level filters log output:
- `Off` - no logs
- `Error` - only errors
- `Warn` - errors + warnings
- `Trace` - all steps (DEFAULT with feature)
- `Verbose` - maximum detail

## Files Changed

**Core:**
- ✅ `src/debug.rs` - Debug module (new)
- ✅ `src/lib.rs` - Import & use debug, extend TranspileOptions
- ✅ `Cargo.toml` - Add debug features

**Platforms:**
- ✅ `src/wasm_api.rs` - WASM debug functions
- ✅ `src/android_jni.rs` - JNI debug functions
- ✅ `src/ios_ffi.rs` - C FFI debug functions
- ✅ `src/ffi.rs` - Update FFI to use debug_level

**Tests:**
- ✅ `tests/debug_transpile.rs` - Integration tests (new)
- ✅ `tests/fixtures/debug_hook.jsx` - Test hook with breakpoints (new)

**Build:**
- ✅ `build-and-deploy.sh` - Add --debug flag
- ✅ `package.json` - Add build:debug and test:debug scripts

**Documentation:**
- ✅ `DEBUG_LAYER.md` - Full guide (new)
- ✅ `QUICK_DEBUG_REFERENCE.md` - This file (new)

## Summary

✅ **Default Trace Level** - Debug enabled with --features debug defaults to Trace
✅ **Debugger Statements** - Preserved in all transpiled output
✅ **Test Hook** - 5 breakpoints in `tests/fixtures/debug_hook.jsx`
✅ **All Platforms** - Web, Android, iOS all supported
✅ **Zero Overhead** - No impact when feature disabled (default)
✅ **Complete Tests** - 10 integration tests + 4 unit tests
