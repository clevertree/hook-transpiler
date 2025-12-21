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

// WASM-based transpiler for web - Android uses native JSI binding instead
export async function initWasmTranspiler(): Promise<void> {
  // This is a no-op for Android
  // Android apps should use the native JSI module initialized separately
  if ((globalThis as any).__hook_transpile_jsx) {
    return
  }

  // Only attempt web-based WASM loading in non-Android environments
  const isWeb = typeof (globalThis as any).window !== 'undefined' && typeof (globalThis as any).window?.location !== 'undefined'
  if (!isWeb) {
    console.debug('[hook-transpiler] Skipping WASM init in non-web environment')
    return
  }

  try {
    // @ts-ignore - this will be resolved by the bundler in the web app
    const { default: init, transpile_jsx, get_version } = await import('../wasm/relay_hook_transpiler.js')

    // Get WASM module path - only for web builds
    // @ts-ignore
    const wasmPath = new URL('../wasm/relay_hook_transpiler_bg.wasm', import.meta.url)

    // Pass as an object to avoid deprecation warning
    await init({ module_or_path: wasmPath })

    const transpileFn = (code: string, filename: string) => {
      return transpile_jsx(code, filename || 'module.tsx')
    }

    const version = get_version ? get_version() : 'wasm'
      ; (globalThis as any).__hook_transpiler_version = version
      ; (globalThis as any).__hook_transpile_jsx = transpileFn
    console.log('[hook-transpiler] WASM transpiler ready:', version)
  } catch (e) {
    console.warn('[hook-transpiler] Failed to initialize WASM transpiler (expected in Android)', e)
  }
}

export async function initTranspiler(): Promise<void> {
  return initWasmTranspiler()
}
