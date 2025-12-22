# <img src="icon.png" width="32" height="32" align="center" /> @clevertree/hook-transpiler

A minimal JSX/TSX transpiler specifically designed for Relay hooks. This library provides a unified interface for code transpilation across Web (via WASM) and Android (QuickJS + JNI).

## Why this library?

Following the **Relay docs project vision**, Relay aims to provide a seamless, high-performance developer experience across all platforms. Since Relay hooks often involve dynamic code generation or transformation that must be extremely fast and lightweight, a standard heavy transpiler like Babel or SWC (which are bloated and unnecessary for this use case) would be overkill for runtime use in resource-constrained environments like mobile apps.

`@clevertree/hook-transpiler` uses a specialized Rust core, compiled to WASM for web and natively for Android/iOS, ensuring consistent and rapid transpilation regardless of the host environment.

## Usage

### Web (WASM)

In a web application, you must initialize the WASM module before use:

```typescript
import { initTranspiler } from '@clevertree/hook-transpiler';

async function startApp() {
  await initTranspiler();
  // Now globalThis.__hook_transpile_jsx is available
}
```

For a drop-in renderer with minimal glue, use `HookApp`:

```tsx
import { HookApp, initWeb } from '@clevertree/hook-transpiler'

await initWeb()

export function App() {
  return <HookApp host="http://localhost:8002" hookPath="/hooks/client/get-client.jsx" />
}
```

### Android (QuickJS/JNI)

Android builds should expose `globalThis.__hook_transpile_jsx` via the host JNI module (e.g., `RustTranspilerModule.transpile(code, filename)`). The Android entrypoint in this package is a no-op initializer so it will not attempt WASM or React Native bootstraps.

Use `HookApp` for a drop-in QuickJS renderer. Provide your native fetch binding (or any QuickJS-safe fetch) and install basic Web API shims:

```tsx
import { HookApp, initAndroid, installWebApiShims } from '@clevertree/hook-transpiler/android'

// nativeFetch should call your platform HTTP stack (e.g., OkHttp) and return { status, headers, ok, text(), json(), arrayBuffer(), body? }
const nativeFetch = (...args: any[]) => globalThis.__nativeFetch(...args)

await initAndroid()
installWebApiShims({ fetchImpl: nativeFetch })

export function App() {
  return <HookApp host="http://localhost:8002" hookPath="/hooks/client/get-client.jsx" fetchImpl={nativeFetch} />
}
```

## Features

- **Blazing Fast**: Powered by a highly optimized Rust core.
- **Platform Agnostic**: Same API for Web, Android, and iOS.
- **Lightweight**: Zero dependencies on heavy JS transpilers for runtime execution.

## Build & Deploy (Monorepo)

This package’s Rust core must be built with the correct flags to produce a self-contained WASM module that works in web production builds.

- Required command:

```bash
wasm-pack build --release --target web --features wasm
```

- Output files:
  - `pkg/relay_hook_transpiler.js`
  - `pkg/relay_hook_transpiler_bg.wasm` (≈4.4MB)

- Copy to web client (Relay clients):
  - Copy both files to `relay-clients/packages/web/src/wasm/`

- Why `--target web`:
  - Generates a standalone ES module with an async init suitable for Vite production builds.
  - Avoid `--target bundler` as it creates embedded imports that fail with "Import #0 not an object or function".

### Dev Server Notes

Do not use the Vite dev server for this project due to WASM loading issues. Instead use the production watch server:

```bash
cd relay-clients/packages/web
npm run dev  # watch-dev.sh serves dist/ and rebuilds on src/ changes
```

Serves at `http://localhost:5174`.

### WASM Loading in Production

The web entry loads the WASM like this:

```ts
const hookMod = await import('../wasm/relay_hook_transpiler.js')
const wasmUrl = '/wasm/relay_hook_transpiler_bg.wasm'
await hookMod.default({ module_or_path: wasmUrl })
globalThis.__hook_transpile_jsx = hookMod.transpile_jsx
```

Quick checks:
- Ensure `relay_hook_transpiler_bg.wasm` is ~4.4MB
- `window.__hook_transpile_jsx` exists after init
- Console logs show transpiler init info

## Verify Locally

Build and run the self-check:

```bash
npm run build
npm test
```

Dry-run pack to verify publish contents:

```bash
npm pack --dry-run
```

## Node Requirement

Node.js >= 18 is required for ESM and the built-in test runner.
