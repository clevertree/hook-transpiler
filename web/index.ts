import { transpileCode } from './runtimeLoader.js'

export {
  type TransformOptions,
  type ComponentType,
  type HookContext,
  type HookHelpers,
  type LoaderDiagnostics,
  type ModuleLoader,
  type HookLoaderOptions,
  WebModuleLoader,
  transpileCode,
  createHookReact,
  looksLikeTsOrJsx,
  applyHookRewrite,
  HookLoader,
} from './runtimeLoader.js'

export { HookRenderer, type HookRendererProps } from './components/HookRenderer.js'
export { HookApp, type HookAppProps } from './components/HookApp.js'
export { ErrorBoundary } from './components/ErrorBoundary.js'
export { MarkdownRenderer } from './components/MarkdownRenderer.js'
export { FileRenderer } from './components/FileRenderer.js'

export { ES6ImportHandler, type ImportHandlerOptions } from '../shared/es6ImportHandler.js'
export { buildPeerUrl, buildRepoHeaders } from '../shared/urlBuilder.js'

// WASM-based transpiler for web - Android uses native JSI binding instead
export async function initWasmTranspiler(): Promise<void> {
  // This is a no-op for Android
  // Android apps should use the native JSI module initialized separately
  if ((globalThis as any).__hook_transpile_jsx) {
    return
  }

  // Only attempt web-based WASM loading in non-Android environments
  const isWeb = typeof (globalThis as any).window !== 'undefined'
  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node
  if (!isWeb && !isNode) {
    console.debug('[hook-transpiler] Skipping WASM init in non-web/non-node environment')
    return
  }

  try {
    // @ts-ignore - this will be resolved by the bundler in the web app
    const { default: init, transpile_jsx, transpile_jsx_with_metadata, get_version, run_self_test } = await import('../wasm/relay_hook_transpiler.js')

    // Get WASM module path - only for web builds
    let wasmPath;
    try {
      // Use the unified /wasm/ path for reliable loading in various environments
      wasmPath = new URL('/wasm/relay_hook_transpiler_bg.wasm', window.location.origin).toString();
    } catch (e) {
      console.warn('[hook-transpiler] Failed to construct wasm path via URL, using fallback string');
      wasmPath = '/wasm/relay_hook_transpiler_bg.wasm';
    }

    // Workaround for esbuild: if wasmPath is an object, convert to string
    const wasmUrl = wasmPath;

    if (isNode && typeof wasmUrl === 'string' && wasmUrl.startsWith('file:')) {
      const fs = await import('node:fs/promises')
      const buffer = await fs.readFile(new URL(wasmUrl))
      await init({ module_or_path: buffer })
    } else {
      // Pass as an object to avoid deprecation warning
      await init({ module_or_path: wasmUrl })
    }

    const transpileFn = (code: string, filename: string, isTypescript?: boolean) => {
      return transpile_jsx(code, filename || 'module.tsx', isTypescript)
    }

    const transpileWithMetadataFn = (code: string, filename: string, isTypescript?: boolean) => {
      return transpile_jsx_with_metadata(code, filename || 'module.tsx', isTypescript)
    }

    const version = get_version ? get_version() : 'wasm'
      ; (globalThis as any).__hook_transpiler_version = version
      ; (globalThis as any).__hook_transpile_jsx = transpileFn
      ; (globalThis as any).__hook_transpile_jsx_with_metadata = transpileWithMetadataFn
      ; (globalThis as any).__hook_wasm_self_test = run_self_test
    console.log('[hook-transpiler] WASM transpiler ready:', version)
  } catch (e) {
    console.warn('[hook-transpiler] Failed to initialize WASM transpiler (expected in Android)', e)
  }
}

export async function initTranspiler(): Promise<void> {
  return initWasmTranspiler()
}

// Convenience init wrapper for web clients.
export async function initWeb(): Promise<void> {
  return initWasmTranspiler()
}

// Unified transpile helper that prefers the global WASM binding.
export async function transpileHook(code: string, filename = 'module.jsx', isTypescript = false): Promise<any> {
  const g: any = globalThis
  if (typeof g.__hook_transpile_jsx === 'function') {
    return g.__hook_transpile_jsx(code, filename, isTypescript)
  }
  // Fallback to JS-based transpileCode (slower, but keeps clients working without glue)
  return transpileCode(code, { filename, isTypescript })
}

export async function runSelfCheck(): Promise<{ ok: boolean; version?: string; error?: string; wasmResults?: string[] }> {
  try {
    await initTranspiler()
    const g: any = globalThis
    if (typeof g.__hook_transpile_jsx !== 'function') {
      throw new Error('__hook_transpile_jsx not found on globalThis after init')
    }

    let wasmResults: string[] = []
    if (typeof g.__hook_wasm_self_test === 'function') {
      wasmResults = g.__hook_wasm_self_test()
      const failed = wasmResults.filter(r => r.startsWith('FAIL') || r.startsWith('ERROR'))
      if (failed.length > 0) {
        throw new Error(`WASM self-test failed: ${failed.join(', ')}`)
      }
    }

    const testCode = 'const a = <div>Hello</div>'
    const result = await g.__hook_transpile_jsx(testCode, 'test.jsx')

    let code = ''
    if (typeof result === 'string') {
      code = result
    } else if (result && typeof result.code === 'string') {
      code = result.code
    }

    if (!code.includes('__hook_jsx_runtime')) {
      console.error('Self-check transpilation result:', result)
      throw new Error('Transpilation failed: output does not contain expected JSX runtime calls')
    }

    return { ok: true, version: g.__hook_transpiler_version, wasmResults }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
