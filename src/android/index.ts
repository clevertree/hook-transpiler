// Android JavaScriptCore/JNI entrypoint: keep API aligned with web exports without Android-specific JSI bindings
import { transpileCode } from '../web/runtimeLoader.js'

export {
    type TransformOptions,
    type HookContext,
    type HookHelpers,
    type LoaderDiagnostics,
    type ModuleLoader,
    type HookLoaderOptions,
    WebModuleLoader,
    transpileCode,
    createHookReact,
    looksLikeTsOrJsx,
    HookLoader,
} from '../web/runtimeLoader.js'

// Note: Android doesn't have TypeScript components - uses Kotlin HookRenderer/HookApp instead
// Exports below are for platform-agnostic utilities

export { ES6ImportHandler, type ImportHandlerOptions } from '../shared/es6ImportHandler.js'
export { buildPeerUrl, buildRepoHeaders } from '../shared/urlBuilder.js'

// Android uses native JNI/JSC to set __hook_transpile_jsx; no WASM needed
export async function initTranspiler(): Promise<void> {
    // No-op: Android initializes via native JNI binding
    return
}

// Convenience init alias for Android consumers
export async function initAndroid(): Promise<void> {
    // No-op: Android initializes via native JNI binding
    return
}

// Unified transpile helper that uses native binding
export async function transpileHook(code: string, filename = 'module.jsx', isTypescript = false): Promise<string> {
    const g: any = globalThis
    if (typeof g.__hook_transpile_jsx !== 'function') {
        throw new Error('Native transpiler is not initialized: expected global __hook_transpile_jsx')
    }
    return g.__hook_transpile_jsx(code, filename, isTypescript)
}
