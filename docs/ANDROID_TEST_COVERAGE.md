# Android Regression Test Coverage

## Overview
Comprehensive test suite covering Android-specific transpilation behavior including import handling and React hooks functionality.

## Test Files

### 1. `tests/android_imports.rs`
Tests for static and dynamic import transformation on Android target.

#### Tests:
- **android_static_imports_transformed**: Verifies static imports are handled and JSX is transformed
- **android_dynamic_imports_to_hook_import**: Confirms `import()` calls are converted to `__hook_import()`
- **android_multiple_dynamic_imports**: Validates multiple dynamic imports in Promise.all scenarios
- **android_dynamic_import_with_query_params**: Ensures query strings and hash fragments are preserved

### 2. `tests/useeffect_regression.rs`
Tests for React hooks execution (useEffect, useRef, useState) in transpiled code.

#### Tests:
- **useeffect_mount_unmount_lifecycle**: Validates mount/unmount lifecycle with cleanup functions
- **useeffect_with_dependencies**: Confirms dependency arrays are preserved
- **useeffect_with_async_operations**: Tests async/await patterns within useEffect
- **useeffect_with_promise_all**: Validates Promise.all with dynamic imports in useEffect
- **multiple_useeffects_in_one_component**: Ensures multiple useEffect calls coexist
- **useeffect_with_useref**: Tests useRef integration with useEffect

### 3. `tests/dynamic_import_swc.rs`
Original dynamic import transformation test.

#### Tests:
- **test_dynamic_import_transformation**: Validates basic dynamic import to __hook_import conversion

## Key Validations

### Import Transformation
✅ Static imports preserved (SWC behavior)  
✅ JSX transformed to `_jsx()` calls  
✅ Dynamic `import()` → `__hook_import()`  
✅ Multiple dynamic imports handled  
✅ Query params/hashes preserved  
✅ Relative and absolute paths supported  

### React Hooks
✅ useEffect mount/unmount cycles  
✅ Cleanup functions preserved  
✅ Dependency arrays maintained  
✅ Multiple useEffect calls supported  
✅ useRef integration works  
✅ async/await in useEffect  
✅ Promise.all with dynamic imports  

## Running Tests

```bash
# All Android-specific tests
cargo test --features native-swc --test android_imports
cargo test --features native-swc --test useeffect_regression

# All tests
cargo test --features native-swc
```

## Test Philosophy

1. **Regression Prevention**: Each test captures specific SWC transformation behavior
2. **Real-World Patterns**: Tests mirror actual hook code patterns (lazy loading, lifecycle management)
3. **Platform-Specific**: Tests only run on native targets with SWC feature enabled
4. **Assertion Clarity**: Tests verify transformation output, not just compilation success

## Related Files

- `src/lib.rs`: Dynamic import transformation logic (lines 128-145)
- `src/jsx_parser.rs`: `transform_dynamic_imports()` function
- `src/swc_native.rs`: SWC-based transpilation pipeline
- `tests/android/app/src/main/assets/test-hook.jsx`: Real-world test file with all patterns

## Known Behaviors

1. **Static Imports**: SWC preserves ES6 `import` statements - this is intentional
2. **Dynamic Imports**: Always transformed to `__hook_import()` for bridge compatibility
3. **React Transform**: Automatic JSX runtime (`_jsx` from `__hook_jsx_runtime`)
4. **ES5 Downleveling**: Optional chaining, nullish coalescing handled by SWC

## Future Enhancements

- [ ] Add end-to-end Android runtime tests (requires emulator)
- [ ] Test Act vs ReactNative renderer differences
- [ ] Add TypeScript-specific import tests
- [ ] Test CommonJS output mode
- [ ] Validate source map generation with imports
