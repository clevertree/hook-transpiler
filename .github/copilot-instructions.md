# hook-transpiler Copilot Instructions

## Project Overview
Rust WASM transpiler for JSX/TSX → compatible module format for Relay hooks.
Handles React JSX, TypeScript, dynamic/static imports, and special module rewriting.

## Architecture

### Key Components
1. **Import Rewriting** - Converts static imports to global references, dynamic imports to `__hook_import()`
2. **JSX Transformation** - React auto-transform with JSX runtime handling
3. **Module Conversion** - Optional CommonJS output for older environments
4. **WASM Bindings** - Feature-gated WASM API exposed via `transpile_jsx()`

### Build System
- Cargo crate: `name = "relay-hook-transpiler"` (CRITICAL - not "hook-transpiler")
- Features: `wasm` (required for browser use)
- Build script: `build-and-deploy.sh` chains wasm-pack → copy to relay-clients

## Implementation Details

### Process Order (CRITICAL)
1. Parse source
2. Resolve TypeScript/JSX scope
3. Strip TypeScript (if .ts/.tsx)
4. Apply React transform (if JSX detected)
5. **Hook Transpiler Rewrites static imports** (AFTER React transform to catch jsx-runtime)
6. Hook Transpiler Rewrites dynamic imports
7. Apply CommonJS conversion (if requested)
8. Post-process regex fixes for edge cases shouldn't be necessary. 
report edge cases and update hook-transpiler crate. Add test coverage.

## Testing
Tests in `src/lib.rs`:
- `rewrites_static_special_imports()` - Verifies global rewriting
- `rewrites_dynamic_import()` - Checks `__hook_import` conversion
- `transpiles_to_commonjs_exports()` - CommonJS output format
- Fixture tests - Real hook files if present

Run: `cargo test`

## WASM Build Gotchas

**WRONG:** `wasm-pack build --release` (produces 365-byte stub)
**RIGHT:** `wasm-pack build --release --features wasm` (produces 4.4+ MB)

### Build Output
Expected files in `pkg/`:
- `relay_hook_transpiler.js` - Bundled loader
- `relay_hook_transpiler_bg.wasm` - Binary
- `relay_hook_transpiler_bg.wasm.d.ts` - Type definitions
- `relay_hook_transpiler.d.ts` - TypeScript interface

### Deploy
After build, copy to relay-clients:
```bash
cp pkg/*.{js,wasm,wasm.d.ts,d.ts,json} \
  /home/ari/dev/relay-clients/packages/web/src/wasm/
```

## TranspileOptions API
```rust
pub struct TranspileOptions {
    pub filename: Option<String>,      // E.g. "hook.jsx"
    pub react_dev: bool,               // Enable React dev runtime
    pub to_commonjs: bool,             // Output CommonJS instead of ESM
    pub pragma: Option<String>,        // Custom JSX pragma (rarely used)
    pub pragma_frag: Option<String>,   // Custom fragment pragma
}
```

## Common Errors

### "0 && module.exports = ..." in CommonJS output
Expected behavior. Post-process regex wraps in parens:
```
0 && module.exports = X  →  0 && (module.exports = X)
```

### Import not rewritten to global
1. Check spelling matches exactly (case-sensitive)
2. Verify it's in the hardcoded list in `StaticImportRewriter`
3. Confirm React transform ran before rewrite (order matters!)

### JSX not transformed
Check `filename` ends in `.jsx`/`.tsx` or source contains `<` character

## Development Workflow

### After Changes
1. Update tests if logic changed
2. Run `cargo test` to validate
3. If modifying WASM: `bash build-and-deploy.sh`
4. Test in relay-clients/web: `npm run dev`

### Key Files
- `src/lib.rs` - Main implementation
- `Cargo.toml` - Dependencies (serde, swc_core, wasm_bindgen)
- `build-and-deploy.sh` - Build & deploy script

## Dependency Management (CRITICAL)

### Native Library Dependencies
**NEVER** manually copy `libthemed_styler.so` files into hook-transpiler's jniLibs folders!

The themed-styler native libraries should come **only** from the themed-styler-android AAR published to mavenLocal.

**Correct locations for native libs:**
- ✅ `hook-transpiler/android/jniLibs/*/librelay_hook_transpiler.so` (hook transpiler's own libs)
- ✅ `hook-transpiler/android/src/main/jniLibs/*/libjsc.so` (JavaScriptCore)
- ✅ `hook-transpiler/android/src/main/jniLibs/*/libc++_shared.so` (C++ runtime)
- ✅ `hook-transpiler/android/src/main/jniLibs/*/librelay_hook_transpiler.so` (hook transpiler's own libs)
- ❌ `hook-transpiler/android/**/jniLibs/*/libthemed_styler.so` (SHOULD NOT EXIST - comes from AAR)
- ❌ `hook-transpiler/tests/android/app/src/main/jniLibs/*/libthemed_styler.so` (SHOULD NOT EXIST)

### Updating Dependencies After themed-styler Changes

When themed-styler is updated:
1. **Rebuild and publish themed-styler Android AAR:**
   ```bash
   cd /home/ari/dev/themed-styler
   bash scripts/build-android.sh  # Builds native libs for all architectures
   cd android && ./gradlew clean publishToMavenLocal  # Publishes AAR to ~/.m2/repository
   ```

2. **Clean and rebuild hook-transpiler test app:**
   ```bash
   cd /home/ari/dev/hook-transpiler/tests/android
   ./gradlew --refresh-dependencies clean assembleDebug
   ```

3. **Verify the version** (should show latest themed-styler version):
   ```bash
   strings app/build/outputs/apk/debug/app-debug.apk | grep "1\.2\.[0-9]" | head -5
   ```

4. **Install and test:**
   ```bash
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```

**Troubleshooting stale libraries:**
- If APK shows old version despite fresh mavenLocal publish, check for manually copied libs:
  ```bash
  find android tests/android/app -path "*/jniLibs/*" -name "libthemed_styler.so"
  ```
- Delete any found files - they override the AAR dependency
- Gradle picks `src/main/jniLibs` > project `jniLibs` > external AAR dependencies

## Android Virtual Module System

### Architecture
Android HookRenderer provides virtual modules to hooks via `globalThis.__clevertree_packages`:
- Virtual modules are registered in `HookRenderer.kt`'s `installBridge()` method
- Registration happens using `ctx.evaluateScript()` to create JavaScript objects
- The `__require_module` function in `bridge.js` checks `__clevertree_packages` first before attempting file loads

### Key Virtual Modules
1. **@clevertree/themed-styler** - Theme management bridge
   - Methods: `setCurrentTheme()`, `getThemes()`, `getThemeList()`, `registerTheme()`, `clearUsage()`, `getUsageSnapshot()`, `registerUsage()`
   - State stored in `globalThis.__themed_styler_state`
   - Pure JavaScript implementation (no JNI calls for theme state management)

2. **@clevertree/act** - React alias for Act runtime
3. **@clevertree/hook-transpiler** - React alias
4. **@clevertree/meta** - Provides import.meta information

### Adding New Virtual Modules
1. Register module object in `HookRenderer.kt` using `ctx.evaluateScript()`:
   ```kotlin
   ctx.evaluateScript("""
     globalThis.__clevertree_packages['@module/name'] = { ... };
   """.trimIndent(), "register_module.js")
   ```
2. Ensure `__require_module` in `bridge.js` checks `__clevertree_packages` first
3. Publish updated hook-transpiler to mavenLocal: `cd android && ./gradlew publishToMavenLocal`
4. Rebuild consuming apps with `--refresh-dependencies` flag

### Debugging Virtual Modules
- Check logs for: `[__require_module] Checking __clevertree_packages: exists, keys=...`
- Verify module is in the keys list
- Look for: `[__require_module] Found in __clevertree_packages: @module/name`
- If module not found, check `installBridge()` ran before `loadRuntime()`

## Build & Test Playbook (per repo)

### hook-transpiler (this repo)
- Rebuild WASM first: `bash build-and-deploy.sh` (uses `wasm-pack build --release --target web --features wasm`; copies outputs into relay-clients).
- Rust unit tests: `cargo test`.
- JS self-check: `npm test` (runs `npm run build` → `node --test dist/selfCheck.test.js`).
- **Android module:** Publish to mavenLocal: `cd /home/ari/dev/hook-transpiler && ./gradlew publishToMavenLocal`
- **After Android changes:** Rebuild consuming apps with `./gradlew --refresh-dependencies clean assembleDebug`
- **Android test app:** Located at `/home/ari/dev/hook-transpiler/tests/android/app` - primary test for Android integration
- Web e2e (Cypress):
  1) `cd tests/web && npm install` (once).
  2) `npm run build` to refresh bundle.
  3) Start dev server `npm run start` in **one terminal and leave it running**.
  4) In another terminal run `npm run test:e2e` or `npm run cypress:open`.
  5) Do **not** stop the dev server between steps 3 and 4; Cypress needs it alive.

### themed-styler
- Rebuild WASM before any client build: `cd /home/ari/dev/themed-styler && npm install && npm run build` (calls `wasm-pack build --release --target web --features wasm` and populates `wasm/`).
- **Android native libs:** `cd /home/ari/dev/themed-styler && bash scripts/build-android.sh` (builds all architectures).
- **Publish to mavenLocal:** `cd /home/ari/dev/themed-styler/android && ./gradlew publishToMavenLocal`.
- **Android test app:** Located at `/home/ari/dev/themed-styler/tests/android/` - primary test for Android integration with HookRenderer
  - Uses `com.clevertree.jscbridge.JSCManager` base class from jscbridge
  - Override `setupModules()` to register theme modules
  - Build: `cd tests/android && ./gradlew --refresh-dependencies clean assembleDebug` (always use --refresh-dependencies after jscbridge changes)
- Publish prep: `npm run build` already covers `build:wasm`; use `npm run build` prior to `npm publish` or local `npm pack`.

### jscbridge
- Base library for Android JavaScript runtime
- **Build & Publish**: `./gradlew clean publishToMavenLocal`
- **Versioning**: Published to mavenLocal as `com.clevertree:jscbridge:1.0.0`
- **All methods must be `open`**: Any method that subclasses override MUST be marked `open` keyword
- **Key extension point**: `open fun setupModules(context: JSContext)` - for subclass custom module registration
- **After changes**: Consumers must rebuild with `--refresh-dependencies` flag to get updated version
- **Test**: Build themed-styler test app to verify jscbridge changes work: `cd /home/ari/dev/themed-styler/tests/android && ./gradlew --refresh-dependencies clean assembleDebug`

### relay-client-web
- Prereqs: rebuild native deps first (`npm --prefix /home/ari/dev/hook-transpiler run build` and `npm --prefix /home/ari/dev/themed-styler run build`) so local packages have fresh dist/wasm.
- Install deps: `npm install` in `/home/ari/dev/relay-client-web`.
- Dev server: `npm run dev` (esbuild serve).
- Build: `npm run build`.
- Unit tests: `npm test` (Node test runner over `src/tests/**/*.test.ts`).
- Serve built assets with relay-server: `npm run serve:relay` (runs build then serves via compiled relay-server binary on 8080).

### relay (monorepo root)
- Repo root: `/home/ari/dev/relay`.
- Web dev: `npm run web:dev` or `npm run web:dev:full` (full script).
- Web build: `npm run web:build` (or `web:build:debug`).
- Server dev: `npm run dev:server` (cargo run). Release server build: `npm run build:server`.
- Tests: `npm test` (workspace `cargo test`). Playwright e2e: `npm run test:e2e` (ensure server + static assets built if scenario requires).

### relay-client-android
- Before Gradle: refresh transpiler/native bits: `npm --prefix /home/ari/dev/hook-transpiler run build` and ensure JNI/JSI sources are up to date; Gradle will compile native libs.
- Build debug APK: `cd /home/ari/dev/relay-client-android/android && ./gradlew clean assembleDebug`.
- Install to device/emulator: `adb install -r app/build/outputs/apk/debug/app-debug.apk`.
- Logs: `adb logcat | grep -E "HermesManager|NativeRenderer|RelayJSI"`.

