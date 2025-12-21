// Android QuickJS/JNI entrypoint: keep API aligned with web exports without Android-specific JSI bindings
export { WebModuleLoader, AndroidModuleLoader, transpileCode, createHookReact, looksLikeTsOrJsx, HookLoader, } from './runtimeLoader.js';
export { HookRenderer } from './components/HookRenderer.js';
export { ErrorBoundary } from './components/ErrorBoundary.js';
export { MarkdownRenderer } from './components/MarkdownRenderer.js';
export { FileRenderer } from './components/FileRenderer.js';
export { ES6ImportHandler } from './es6ImportHandler.js';
export { buildPeerUrl, buildRepoHeaders } from './urlBuilder.js';
// Android uses native JNI/QuickJS to set __hook_transpile_jsx; no WASM or Android bootstrap here
export async function initTranspiler() {
    return;
}
//# sourceMappingURL=index.android.js.map