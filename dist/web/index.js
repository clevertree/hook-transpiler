import { transpileCode } from './runtimeLoader.js';
export { WebModuleLoader, transpileCode, createHookReact, looksLikeTsOrJsx, applyHookRewrite, HookLoader, } from './runtimeLoader.js';
export { HookRenderer } from './components/HookRenderer.js';
export { HookApp } from './components/HookApp.js';
export { ErrorBoundary } from './components/ErrorBoundary.js';
export { MarkdownRenderer } from './components/MarkdownRenderer.js';
export { FileRenderer } from './components/FileRenderer.js';
export { ES6ImportHandler } from '../shared/es6ImportHandler.js';
export { buildPeerUrl, buildRepoHeaders } from '../shared/urlBuilder.js';
// WASM-based transpiler for web - Android uses native JSI binding instead
export async function initWasmTranspiler() {
    // This is a no-op for Android
    // Android apps should use the native JSI module initialized separately
    if (globalThis.__hook_transpile_jsx) {
        return;
    }
    // Only attempt web-based WASM loading in non-Android environments
    const isWeb = typeof globalThis.window !== 'undefined';
    const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
    if (!isWeb && !isNode) {
        console.debug('[hook-transpiler] Skipping WASM init in non-web/non-node environment');
        return;
    }
    try {
        // @ts-ignore - this will be resolved by the bundler in the web app
        const { default: init, transpile_jsx, transpile_jsx_with_metadata, get_version, run_self_test } = await import('../wasm/relay_hook_transpiler.js');
        if (isNode) {
            // Node path: resolve the wasm file relative to this module and load from disk to avoid fetch URL issues.
            const fs = await import('node:fs/promises');
            const wasmFile = new URL('../wasm/relay_hook_transpiler_bg.wasm', import.meta.url);
            const buffer = await fs.readFile(wasmFile);
            await init({ module_or_path: buffer });
        }
        else {
            // Browser path: construct a URL relative to origin, fall back to the standard /wasm/ path.
            let wasmPath = '/wasm/relay_hook_transpiler_bg.wasm';
            try {
                wasmPath = new URL('/wasm/relay_hook_transpiler_bg.wasm', window.location.origin);
            }
            catch (e) {
                console.warn('[hook-transpiler] Failed to construct wasm path via URL, using fallback string');
            }
            await init({ module_or_path: wasmPath });
        }
        const transpileFn = (code, filename, isTypescript) => {
            return transpile_jsx(code, filename || 'module.tsx', isTypescript);
        };
        const transpileWithMetadataFn = (code, filename, isTypescript) => {
            return transpile_jsx_with_metadata(code, filename || 'module.tsx', isTypescript);
        };
        const version = get_version ? get_version() : 'wasm';
        globalThis.__hook_transpiler_version = version;
        globalThis.__hook_transpile_jsx = transpileFn;
        globalThis.__hook_transpile_jsx_with_metadata = transpileWithMetadataFn;
        globalThis.__hook_wasm_self_test = run_self_test;
        console.log('[hook-transpiler] WASM transpiler ready:', version);
        // Initialize md2jsx WASM
        try {
            // @ts-ignore
            const { default: initMd, transpile: parseMd } = await import('../wasm/md2jsx.js');
            if (isNode) {
                const fs = await import('node:fs/promises');
                const wasmFile = new URL('../wasm/md2jsx_bg.wasm', import.meta.url);
                const buffer = await fs.readFile(wasmFile);
                await initMd({ module_or_path: buffer });
            }
            else {
                let wasmPath = '/wasm/md2jsx_bg.wasm';
                try {
                    wasmPath = new URL('/wasm/md2jsx_bg.wasm', window.location.origin);
                }
                catch (e) { }
                await initMd({ module_or_path: wasmPath });
            }
            globalThis.__hook_md2jsx_parse = parseMd;
            console.log('[hook-transpiler] md2jsx WASM ready');
        }
        catch (e) {
            console.warn('[hook-transpiler] Failed to initialize md2jsx WASM', e);
        }
    }
    catch (e) {
        console.warn('[hook-transpiler] Failed to initialize WASM transpiler (expected in Android)', e);
    }
}
export async function initTranspiler() {
    return initWasmTranspiler();
}
// Convenience init wrapper for web clients.
export async function initWeb() {
    return initWasmTranspiler();
}
// Unified transpile helper that prefers the global WASM binding.
export async function transpileHook(code, filename = 'module.jsx', isTypescript = false) {
    const g = globalThis;
    if (typeof g.__hook_transpile_jsx === 'function') {
        return g.__hook_transpile_jsx(code, filename, isTypescript);
    }
    // Fallback to JS-based transpileCode (slower, but keeps clients working without glue)
    return transpileCode(code, { filename, isTypescript });
}
export async function runSelfCheck() {
    try {
        await initTranspiler();
        const g = globalThis;
        if (typeof g.__hook_transpile_jsx !== 'function') {
            throw new Error('__hook_transpile_jsx not found on globalThis after init');
        }
        let wasmResults = [];
        if (typeof g.__hook_wasm_self_test === 'function') {
            wasmResults = g.__hook_wasm_self_test();
            const failed = wasmResults.filter(r => r.startsWith('FAIL') || r.startsWith('ERROR'));
            if (failed.length > 0) {
                throw new Error(`WASM self-test failed: ${failed.join(', ')}`);
            }
        }
        const testCode = 'const a = <div>Hello</div>';
        const result = await g.__hook_transpile_jsx(testCode, 'test.jsx');
        let code = '';
        if (typeof result === 'string') {
            code = result;
        }
        else if (result && typeof result.code === 'string') {
            code = result.code;
        }
        if (!code.includes('__hook_jsx_runtime')) {
            console.error('Self-check transpilation result:', result);
            throw new Error('Transpilation failed: output does not contain expected JSX runtime calls');
        }
        return { ok: true, version: g.__hook_transpiler_version, wasmResults };
    }
    catch (e) {
        return { ok: false, error: e.message };
    }
}
//# sourceMappingURL=index.js.map