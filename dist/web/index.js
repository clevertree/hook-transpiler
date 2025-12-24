// Web entry for @clevertree/hook-transpiler
export { HookLoader } from './runtimeLoader.js';
export { WebModuleLoader } from './runtimeLoader.js';
export { transpileCode, looksLikeTsOrJsx, applyHookRewrite, createHookReact } from './runtimeLoader.js';
export { default as HookRenderer } from './components/HookRenderer';
export { FileRenderer } from './components/FileRenderer';
export { MarkdownRenderer } from './components/MarkdownRenderer';
export { default as HookApp } from './components/HookApp';
export { ErrorBoundary } from './components/ErrorBoundary';
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
    // Pass options object to avoid deprecated init signature warning
    await init({ module_or_path: url });
    const transpile = mod.transpile_jsx;
    if (typeof transpile !== 'function')
        throw new Error('WASM not exporting transpile_jsx');
    globalThis.__hook_transpile_jsx = transpile;
    // Also expose the metadata version if available
    const transpileWithMetadata = mod.transpile_jsx_with_metadata;
    if (typeof transpileWithMetadata === 'function') {
        globalThis.__hook_transpile_jsx_with_metadata = transpileWithMetadata;
    }
    const version = mod.get_version ? mod.get_version() : 'unknown';
    globalThis.__hook_transpiler_version = version;
}
/**
 * Preload @clevertree/* packages to make them available to hooks
 */
export async function preloadPackages() {
    if (globalThis.__relay_packages) {
        return; // Already loaded
    }
    const packages = {};
    // Dynamically import packages without requiring them to be listed in tsconfig
    const packageNames = ['@clevertree/themed-styler', '@clevertree/hook-transpiler'];
    for (const pkgName of packageNames) {
        try {
            const pkg = await import(pkgName);
            packages[pkgName] = pkg;
        }
        catch (e) {
            console.warn(`[preloadPackages] Failed to load ${pkgName}:`, e);
        }
    }
    // Store packages globally
    globalThis.__relay_packages = packages;
}
// Backwards-compatible alias for tests and existing clients
export const initTranspiler = initHookTranspiler;
//# sourceMappingURL=index.js.map