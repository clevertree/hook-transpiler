# @clevertree/hook-transpiler

A minimal JSX/TSX transpiler specifically designed for Relay hooks. This library provides a unified interface for code transpilation across Web (via WASM) and Android/iOS (via native TurboModules).

## Why this library?

Following the **Relay docs project vision**, Relay aims to provide a seamless, high-performance developer experience across all platforms. Since Relay hooks often involve dynamic code generation or transformation that must be extremely fast and lightweight, a standard heavy transpiler like Babel or SWC (in its full form) might be overkill for runtime use in resource-constrained environments like mobile apps.

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

### Android / React Native

The library automatically detects the React Native environment and uses the `RustTranspiler` TurboModule.

```typescript
import { initTranspiler } from '@clevertree/hook-transpiler';

// In your App initialization
useEffect(() => {
  initTranspiler();
}, []);
```

## Features

- **Blazing Fast**: Powered by a highly optimized Rust core.
- **Platform Agnostic**: Same API for Web, Android, and iOS.
- **Lightweight**: Zero dependencies on heavy JS transpilers for runtime execution.
