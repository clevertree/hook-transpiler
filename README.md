# <img src="icon.png" width="32" height="32" align="center" /> @clevertree/hook-transpiler

A minimal JSX/TSX transpiler specifically designed for Relay hooks. This library provides a unified interface for code transpilation across Web (via WASM) and Android (QuickJS + JNI).

## Why this library?

Following the **Relay project vision**, Relay aims to provide a seamless, high-performance developer experience across all platforms. Since Relay hooks often involve dynamic code generation or transformation that must be extremely fast and lightweight, a standard heavy transpiler like Babel or SWC (which are bloated and unnecessary for this use case) would be overkill for runtime use in resource-constrained environments like mobile apps.

`@clevertree/hook-transpiler` uses a specialized Rust core, compiled to WASM for web and natively for Android/iOS, ensuring consistent and rapid transpilation regardless of the host environment.

## Installation

### NPM/Yarn

Install from npm:

```bash
npm install @clevertree/hook-transpiler
# or
yarn add @clevertree/hook-transpiler
```

The package includes prebuilt WASM files in the `wasm/` directory, so **no additional build step is required during installation**.

### Automatic WASM Inclusion

When you run `npm install`, the WASM files are automatically included:
- `node_modules/@clevertree/hook-transpiler/wasm/relay_hook_transpiler.js` (WASM wrapper)
- `node_modules/@clevertree/hook-transpiler/wasm/relay_hook_transpiler_bg.wasm` (WASM binary, ~4.4MB)

These are bundled and published with every version update. **When you upgrade the package, the WASM files are updated automatically—no manual copy needed.**

## Usage

### Web (WASM)

Initialize the WASM module in your app startup:

```typescript
import { initHookTranspiler, HookRenderer } from '@clevertree/hook-transpiler';

async function startApp() {
  // Initialize the WASM transpiler
  await initHookTranspiler();
  
  // Now globalThis.__hook_transpile_jsx is available
  // You can transpile JSX on demand or use HookRenderer for drop-in rendering
}

// Later, when rendering a hook
import React from 'react';

const MyApp = () => (
  <HookRenderer 
    host="http://localhost:8002" 
    hookPath="/hooks/client/get-client.jsx"
  />
);
```

#### WASM Loading & Bundler Configuration

The WASM files are loaded dynamically by `initHookTranspiler()`. Here are key points for different bundlers:

**For Vite:**
- WASM files must be served as static assets. Standard Vite configuration handles this automatically.
- If using custom vite.config.ts, ensure `.wasm` files are not excluded from assets.

**For esbuild:**
- Use `--loader:.wasm=file` to emit WASM as external files.

**For webpack:**
- Ensure `file-loader` or `asset/resource` is configured for `.wasm` files.

#### Avoiding 404 Errors on WASM Files

If you see console errors like "Failed to load WASM" or network 404 errors for `relay_hook_transpiler_bg.wasm`:

**Step 1: Verify WASM files exist**
```bash
ls node_modules/@clevertree/hook-transpiler/wasm/
# Should output:
#   relay_hook_transpiler.js
#   relay_hook_transpiler_bg.wasm
```

**Step 2: Clear and reinstall if missing**
```bash
rm -rf node_modules
npm install
```

**Step 3: Rebuild your bundle**
```bash
npm run build
```

**Step 4: Check bundler output**
Verify that your bundle includes the WASM files in the dist directory:
```bash
ls dist/  # or dist/assets/ depending on your bundler
# Should see relay_hook_transpiler*.wasm files
```

**Step 5: For custom HTTP servers**
If using a non-Vite HTTP server, ensure it serves WASM with correct MIME type:

```javascript
// Express.js example
app.use('/node_modules/@clevertree/hook-transpiler/wasm', express.static(
  path.join(__dirname, 'node_modules/@clevertree/hook-transpiler/wasm'),
  {
    setHeaders: (res, path) => {
      if (path.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
      }
    }
  }
));
```

**Step 6: Check browser DevTools**
- Open DevTools → Network tab
- Look for `relay_hook_transpiler_bg.wasm` request
- Check the response status and content-type header
- If 404, verify your server is serving from correct path

**Step 7: After upgrading the package**
- Clear browser cache (Ctrl+Shift+Delete / Cmd+Shift+Delete)
- Delete old dist directory: `rm -rf dist`
- Rebuild: `npm run build`
- The WASM files update automatically with npm—no manual copy needed

### Android/iOS Native / Android (QuickJS/JNI)

Android builds should expose `globalThis.__hook_transpile_jsx` via the host JNI module. The Android entrypoint provides utilities and a renderer that work with the native transpiler binding.

```typescript
import { assertTranspilerReady, HookRenderer } from '@clevertree/hook-transpiler/android';

async function startApp() {
  // Verify the native transpiler binding is available
  try {
    assertTranspilerReady();
  } catch (e) {
    console.error('Native transpiler not linked:', e);
    return;
  }
  
  // The transpiler is ready to use via globalThis.__hook_transpile_jsx
}

// Use HookRenderer with your native fetch binding
const MyApp = () => (
  <HookRenderer 
    host="http://localhost:8002" 
    hookPath="/hooks/client/get-client.jsx"
    fetchImpl={globalThis.__nativeFetch}  // your native fetch binding
  />
);
```

#### Android Native Setup

For Android, ensure your app's native code has the Relay JNI module registered:

1. Verify `RustTranspilerModule` is linked in your Gradle build
2. Ensure the native library exports the transpiler function for JSI/JNI access
3. Provide a fetch binding in `globalThis.__nativeFetch` that calls your platform HTTP stack (e.g., OkHttp)

#### Platform-Specific Exports

Use platform-specific entry points to avoid bundling unnecessary code:

```typescript
// Web
import { initHookTranspiler, HookRenderer } from '@clevertree/hook-transpiler';

// Android/Android/iOS Native
import { assertTranspilerReady, HookRenderer } from '@clevertree/hook-transpiler/android';
```

## Key Components

- **`HookRenderer`**: A drop-in React component that fetches a remote JSX hook, transpiles it, and renders the result.
- **`FileRenderer`**: Renders `.md`, `.txt`, and `.html` files with error boundaries.
- **`MarkdownRenderer`**: Specialized renderer for Markdown content.
- **`transpileCode(code, options)`**: Lower-level API for manual transpilation.
- **`initHookTranspiler()` / `initTranspiler()`**: Initialize the WASM transpiler for web.
- **`assertTranspilerReady()`** (Android): Verify native transpiler binding is available.

## Features

- **Blazing Fast**: Powered by a highly optimized Rust core.
- **Platform Agnostic**: Same API for Web, Android, and iOS.
- **Lightweight**: Zero dependencies on heavy JS transpilers for runtime execution.
- **Automatic WASM Updates**: WASM files included with package, no manual copying needed.

## Development

### Build from Source

If modifying the Rust core or TypeScript sources:

```bash
# Install dependencies
npm install

# Compile TypeScript and build WASM
npm run build

# The build script automatically:
# 1. Runs `wasm-pack build --release --target web --features wasm`
# 2. Copies WASM files to `wasm/` directory
# 3. Compiles TypeScript to `dist/web/`, `dist/android/`, and `dist/shared/`

# Verify package contents before publishing
npm pack --dry-run
```

### Important: Why `--target web`

The WASM must be built with `wasm-pack build --release --target web --features wasm`:
- Generates a standalone ES module with an async init suitable for production builds
- Avoid `--target bundler` as it creates embedded imports that fail with "Import #0 not an object or function"

### Testing

Run the test suite:

```bash
# Unit/self-check tests
npm run build
npm test

# Web Cypress e2e tests
cd tests/web
npm install
npm run test:e2e
```

## Requirements

- **Node.js**: >= 18 (required for ESM and tooling)
- **React**: >= 18.0.0 (for HookRenderer components)

## Troubleshooting

### WASM Not Loading

**Symptom**: "Failed to initialize WASM transpiler" or `window.__hook_transpile_jsx` is undefined.

**Solution**:
1. Verify files exist: `ls node_modules/@clevertree/hook-transpiler/wasm/`
2. Check browser network tab for 404 on `relay_hook_transpiler_bg.wasm` (see **Avoiding 404 Errors** section above)
3. Ensure bundler outputs WASM as static assets
4. Clear cache and rebuild: `rm -rf dist && npm run build`
5. If upgrading from older version: `rm -rf node_modules && npm install`

### Native Transpiler Not Linked (Android)

**Symptom**: `assertTranspilerReady()` throws "Android transpiler not ready: __hook_transpile_jsx missing".

**Solution**:
1. Verify the Relay native library is properly compiled and linked in Gradle
2. Ensure `RustTranspilerModule` is registered in your Android/iOS Native TurboModule setup
3. Check logcat for JNI errors: `adb logcat | grep -i transpiler`

### HookRenderer Returns Empty or Errors

**Symptom**: Components don't render or show transpilation errors.

**Solution**:
1. Verify `initHookTranspiler()` completes before rendering (web)
2. Verify transpiler is ready via `assertTranspilerReady()` (Android)
3. Check that the hook file exists at the given `hookPath`
4. Verify the host URL is accessible
5. Check browser console for transpilation errors (will be logged by WASM module)

## Contributing

Contributions are welcome! Please ensure:

1. WASM changes are built with `npm run build`
2. TypeScript changes compile cleanly: `tsc --noEmit`
3. Tests pass: `npm test` and `npm run test:e2e` (web)

## License

See LICENSE file in the repository.
