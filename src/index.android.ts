// Android QuickJS/JNI entrypoint: keep API aligned with web exports without Android-specific JSI bindings
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

export { HookRenderer, type HookRendererProps } from './components/HookRenderer.js'
export { ErrorBoundary } from './components/ErrorBoundary.js'
export { MarkdownRenderer } from './components/MarkdownRenderer.js'
export { FileRenderer } from './components/FileRenderer.js'

export { ES6ImportHandler, type ImportHandlerOptions } from './es6ImportHandler.js'
export { buildPeerUrl, buildRepoHeaders } from './urlBuilder.js'

// Android uses native JNI/QuickJS to set __hook_transpile_jsx; no WASM or Android bootstrap here
export async function initTranspiler(): Promise<void> {
    return
}
