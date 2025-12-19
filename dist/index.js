export { WebModuleLoader, RNModuleLoader, transpileCode, looksLikeTsOrJsx, HookLoader, } from './runtimeLoader';
export { ES6ImportHandler } from './es6ImportHandler';
export { buildPeerUrl, buildRepoHeaders } from './urlBuilder';
// @ts-ignore
import wasmPath from '../wasm/relay_hook_transpiler_bg.wasm';
export async function initWasmTranspiler() {
    if (globalThis.__hook_transpile_jsx) {
        return;
    }
    try {
        // @ts-ignore - this will be resolved by the bundler in the web app
        const hookMod = await import('../wasm/relay_hook_transpiler.js');
        const init = hookMod.default;
        // Pass as an object to avoid deprecation warning
        await init({ module_or_path: new URL(wasmPath, import.meta.url) });
        const transpileFn = (code, filename) => {
            return hookMod.transpile_jsx(code, filename || 'module.tsx');
        };
        const version = hookMod.get_version ? hookMod.get_version() : 'wasm';
        globalThis.__hook_transpiler_version = version;
        globalThis.__hook_transpile_jsx = transpileFn;
        console.log('[hook-transpiler] WASM transpiler ready:', version);
    }
    catch (e) {
        console.warn('[hook-transpiler] Failed to initialize WASM transpiler', e);
    }
}
export async function initTranspiler() {
    return initWasmTranspiler();
}
//# sourceMappingURL=index.js.map