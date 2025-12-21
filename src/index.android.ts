// Android QuickJS/JNI entrypoint: keep API aligned with web exports without Android-specific JSI bindings
export {
    type TransformOptions,
    type TransformResult,
    type HookContext,
    type HookHelpers,
    type LoaderDiagnostics,
    type ModuleLoader,
    type HookLoaderOptions,
    WebModuleLoader,
    AndroidModuleLoader,
    transpileCode,
    looksLikeTsOrJsx,
    HookLoader,
} from './runtimeLoader'

export { ES6ImportHandler, type ImportHandlerOptions } from './es6ImportHandler'
export { buildPeerUrl, buildRepoHeaders } from './urlBuilder'

// Android uses native JNI/QuickJS to set __hook_transpile_jsx; no WASM or Android bootstrap here
export async function initTranspiler(): Promise<void> {
    return
}
