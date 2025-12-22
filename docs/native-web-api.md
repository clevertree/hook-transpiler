# Native Web API Shims (Android/QuickJS)

## Goal
Provide a minimal, predictable Web API surface for non-web runtimes so transpiled hooks can run without custom glue. CORS is intentionally disabled; hosts may add allowlists if desired. The shims wrap the provided fetch to normalize Response shape and install Request/Response/Headers if missing.

## Required Host Bindings
- `fetch`: native-backed, returning `{ status, ok, headers, text(), json(), arrayBuffer(), body? }`. Streaming is preferred; if no stream, still provide text/json/arrayBuffer. The shim wraps this to normalize shape and sets `globalThis.fetch`.
- Timers: `setTimeout` (required), `setInterval` (preferred). Use host scheduling; do not block the JS thread.
- URL utilities: `URL` and `URLSearchParams`. Provide host implementations; shims will warn if absent.
- Encoders: `TextEncoder`/`TextDecoder` must exist; provide host polyfill if absent.

## Streaming
- Responses should expose `body` as a readable stream or chunk iterator if the host supports it.
- Upload streaming is optional; chunked uploads can be added later.

## CORS
- Do not enforce CORS on native paths. If needed, apply an allowlist in the host layer.

## Using the shims
```ts
import { installWebApiShims } from '@clevertree/hook-transpiler/android'

// nativeFetch should call the platform HTTP stack (e.g., OkHttp) and produce a Response-like object.
const nativeFetch = (...args: any[]) => globalThis.__nativeFetch(...args)

installWebApiShims({ fetchImpl: nativeFetch, requireStreaming: false })
```

If `fetch` is already on `globalThis`, the installer leaves it intact.

## Expectations for native fetch
- Must resolve Promises (no callbacks).
- Must not perform CORS checks.
- Should enforce timeouts and max payload sizes to avoid runaway downloads.
- Headers shape: either a plain object or an iterable of `[key, value]` pairs.

## Future Web API parity (tracked in plan item 17)
- Broader Web APIs (crypto, FormData, Headers, Request) can be added as shims once native needs them.
