// Web entry for @clevertree/hook-transpiler
export { HookLoader } from './runtimeLoader.js';
export { WebModuleLoader } from './runtimeLoader.js';
export { transpileCode, looksLikeTsOrJsx, applyHookRewrite, createHookReact } from './runtimeLoader.js';
export { default as HookRenderer } from './components/HookRenderer';
export { FileRenderer } from './components/FileRenderer';
export { MarkdownRenderer } from './components/MarkdownRenderer';
export { default as HookApp } from './components/HookApp';
export async function initHookTranspiler(wasmUrl) {
    let mod;
    let url;
    try {
        mod = await import('../wasm/relay_hook_transpiler.js');
        url = wasmUrl || new URL('../wasm/relay_hook_transpiler_bg.wasm', import.meta.url).href;
    }
    catch (e) {
        // Fallback to server-served absolute path used by tests; build path dynamically to avoid TS resolution
        const absJs = '/hook-transpiler/dist/wasm/relay_hook_transpiler.js' + '';
        mod = await import(absJs);
        url = wasmUrl || ('/hook-transpiler/dist/wasm/relay_hook_transpiler_bg.wasm' + '');
    }
    const init = mod && mod.default;
    if (typeof init !== 'function')
        throw new Error('Invalid WASM wrapper: expected default init function');
    await init(url);
    const transpile = mod.transpile_jsx;
    if (typeof transpile !== 'function')
        throw new Error('WASM not exporting transpile_jsx');
    globalThis.__hook_transpile_jsx = transpile;
    const version = mod.get_version ? mod.get_version() : 'unknown';
    globalThis.__hook_transpiler_version = version;
}
// Backwards-compatible alias for tests and existing clients
export const initTranspiler = initHookTranspiler;
//# sourceMappingURL=index.js.map