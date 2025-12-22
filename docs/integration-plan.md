# Hook-Transpiler Integration Plan

## Goals
- Deliver drop-in web/Android wrappers that require minimal glue in client apps.
- Encapsulate transpiler setup, fetch, theming, and status handling inside the package.
- Provide clear defaults, sensible overrides, and eliminate duplicate integrations across projects.

## Platform Entry
1) Web init: `initWeb()` loads WASM, sets `__hook_transpile_jsx`, and returns a ready `HookRenderer`/`HookApp` instance.
2) Android init: `initAndroid({ fetchImpl?, transpileFn?, onElement? })` binds native transpiler + fetch to globals and returns a ready renderer/bridge.
3) Single import surface: `import { HookApp } from '@clevertree/hook-transpiler'` (web) and `import { HookApp } from '@clevertree/hook-transpiler/android'` (android condition) — no client-side loader assembly.

## Drop-in Components
4) Export `HookApp` per platform that:
   - Normalizes host/path (defaults: host `http://localhost:8002`, hook `/hooks/client/get-client.jsx`).
   - Sets up loader, auto-sync, error boundary, markdown/file renderers, theme loading, and status callbacks.
   - Makes `onElement`/`requestRender` optional; falls back to internal theme registry.
5) Expose `transpileHook(code, filename, platform?)` to route through WASM vs native binding; clients should not call `transpileCode` directly.

## Fetch and I/O
6) Android: include a default QuickJS-safe `fetch` polyfill; allow override via `fetchImpl`.
7) File loading: keep `FileRenderer` adapters internal; infer mime types and render markdown/json/image/text without client glue.

## Theming and Styling
8) Internal theme registry buffers registrations. Web writes CSS immediately; Android emits a JSON theme payload for hosts if needed.
9) Android styling strategy: prefer per-component style objects (maps cleanly to native views, avoids selector parsing). If stylesheet reuse is desired, support a small named-style registry that expands to style objects; avoid CSS selectors on Android to keep the bridge lightweight.
10) Provide `onStatus({ loading, error, hookPath })` so hosts can reflect state without wrapping custom boundaries.

## Bundled Artifacts
11) Ship `android/hook-renderer.js` (QuickJS-safe) exporting `renderHook(host, path, opts)` and `initTranspiler` so test apps can require it directly.
12) Ensure `package.json` exports keep `android` condition pointing to `index.android.js`; include `dist/`, `android/`, and `wasm/` in published files.

## Reliability & DX
13) Retry WASM/JSI init with backoff; graceful offline/fetch handling with readable error surfaces.
14) Update README with one-liner setup for both platforms and documented override points (fetch, markdown overrides, theme loader).

## Cleanup
15) Remove all old JS glue/duplicate integrations between hook-transpiler, themed-styler, and client apps once the new entrypoints and bundled artifacts are in place.

## TODO:
16) Implement same strategy in themed-styler package repo
17) Add a strategy to add missing Web API features to the non web clients.
   - Provide native-backed `fetch` binding with minimal `Request`/`Response` shims, `URL`, and timers; no CORS enforcement.
   - Support streaming bodies: pass-through readable stream for responses; chunked uploads optional.
   - Keep Response surface minimal: `status`, `headers`, `text()`, `json()`, `arrayBuffer()`, `body` (stream), and `ok`.
   - Implement `URL` and `URLSearchParams` shims if missing; prefer host-native if available.
   - Timers: ensure `setTimeout`/`setInterval` exist in QuickJS context with host scheduling (or polyfill).
   - Disable CORS entirely on native paths; allow optional host allowlist for safety.