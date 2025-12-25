// Android QuickJS/JNI entrypoint: keep API aligned with web exports without Android-specific JSI bindings
import { transpileCode } from './runtimeLoader.js'
// TODO: Re-enable when themed-styler Android module is available
// import { initAndroidThemedStyler, createAndroidTheme, applyAndroidThemeStyle } from '@clevertree/themed-styler/android'

export {
    type TransformOptions,
    type TransformResult,
    type HookContext,
    type HookHelpers,
    type LoaderDiagnostics,
    type ModuleLoader,
    type HookLoaderOptions,
    type UnifiedBridge,
    type StyleManager,
    WebModuleLoader,
    AndroidModuleLoader,
    transpileCode,
    createHookReact,
    looksLikeTsOrJsx,
    HookLoader,
} from './runtimeLoader.js'

export { HookRenderer, type HookRendererProps } from './components/android/HookRenderer.js'
export { HookApp, type HookAppProps } from './components/android/HookApp.js'
// Note: ErrorBoundary, MarkdownRenderer, and FileRenderer are web-only - not exported for Android

export { ES6ImportHandler, type ImportHandlerOptions } from './es6ImportHandler.js'
export { buildPeerUrl, buildRepoHeaders } from './urlBuilder.js'
export { installWebApiShims, type WebApiShimOptions } from '../android/webApiShims.js'
export { createQuickJsContext, type QuickJsModuleContext, formatTranspiledCode } from '../android/quickJsContext.js'

// ThemedStyler Android exports - TODO: Re-enable when themed-styler Android module is available
// export { initAndroidThemedStyler, createAndroidTheme, applyAndroidThemeStyle } from '@clevertree/themed-styler/android'

// Android uses native JNI/QuickJS to set __hook_transpile_jsx; no WASM or Android bootstrap here
export async function initTranspiler(): Promise<void> {
    return
}

// Convenience init alias for Android consumers.
export async function initAndroid(opts?: { onThemedStylerInit?: () => Promise<void> }): Promise<void> {
    // TODO: Re-enable when themed-styler Android module is available
    // Initialize themed-styler for Android
    // await initAndroidThemedStyler()

    // Call custom init if provided
    if (opts?.onThemedStylerInit) {
        await opts.onThemedStylerInit()
    }
}

// Unified transpile helper that prefers native binding; falls back to transpileCode when available.
export async function transpileHook(code: string, filename = 'module.jsx', isTypescript = false): Promise<any> {
    const g: any = globalThis
    if (typeof g.__hook_transpile_jsx === 'function') {
        return g.__hook_transpile_jsx(code, filename, isTypescript)
    }
    return transpileCode(code, { filename, isTypescript })
}
