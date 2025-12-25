// Android QuickJS/JNI entrypoint: keep API aligned with web exports without Android-specific JSI bindings
import { transpileCode } from './runtimeLoader.js';
// TODO: Re-enable when themed-styler Android module is available
// import { initAndroidThemedStyler, createAndroidTheme, applyAndroidThemeStyle } from '@clevertree/themed-styler/android'
export { AndroidModuleLoader, transpileCode, applyHookRewrite, } from './runtimeLoader.js';
export { HookRenderer } from './components/HookRenderer.js';
export { HookApp } from './components/HookApp.js';
// Note: ErrorBoundary, MarkdownRenderer, and FileRenderer are web-only - not exported for Android
export { ES6ImportHandler } from '../shared/es6ImportHandler.js';
export { buildPeerUrl, buildRepoHeaders } from '../shared/urlBuilder.js';
export { installWebApiShims } from './webApiShims.js';
export { createQuickJsContext, formatTranspiledCode } from './quickJsContext.js';
// ThemedStyler Android exports - TODO: Re-enable when themed-styler Android module is available
// export { initAndroidThemedStyler, createAndroidTheme, applyAndroidThemeStyle } from '@clevertree/themed-styler/android'
// Android uses native JNI/QuickJS to set __hook_transpile_jsx; no WASM or Android bootstrap here
export async function initTranspiler() {
    return;
}
// Convenience init alias for Android consumers.
export async function initAndroid(opts) {
    // TODO: Re-enable when themed-styler Android module is available
    // Initialize themed-styler for Android
    // await initAndroidThemedStyler()
    // Call custom init if provided
    if (opts?.onThemedStylerInit) {
        await opts.onThemedStylerInit();
    }
}
// Unified transpile helper that prefers native binding; falls back to transpileCode when available.
export async function transpileHook(code, filename = 'module.jsx', isTypescript = false) {
    const g = globalThis;
    if (typeof g.__hook_transpile_jsx === 'function') {
        return g.__hook_transpile_jsx(code, filename, isTypescript);
    }
    return transpileCode(code, filename, isTypescript);
}
//# sourceMappingURL=index.js.map