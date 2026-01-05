export { WebModuleLoader, transpileCode, createHookReact, looksLikeTsOrJsx, HookLoader, } from '../web/runtimeLoader.js';
// Note: Android doesn't have TypeScript components - uses Kotlin HookRenderer/HookApp instead
// Exports below are for platform-agnostic utilities
export { ES6ImportHandler } from '../shared/es6ImportHandler.js';
export { buildPeerUrl, buildRepoHeaders } from '../shared/urlBuilder.js';
// Android uses native JNI/JSC to set __hook_transpile_jsx; no WASM needed
export async function initTranspiler() {
    // No-op: Android initializes via native JNI binding
    return;
}
// Convenience init alias for Android consumers
export async function initAndroid() {
    // No-op: Android initializes via native JNI binding
    return;
}
// Unified transpile helper that uses native binding
export async function transpileHook(code, filename = 'module.jsx', isTypescript = false) {
    const g = globalThis;
    if (typeof g.__hook_transpile_jsx !== 'function') {
        throw new Error('Native transpiler is not initialized: expected global __hook_transpile_jsx');
    }
    return g.__hook_transpile_jsx(code, filename, isTypescript);
}
//# sourceMappingURL=index.js.map