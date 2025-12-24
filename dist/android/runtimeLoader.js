/** Android Runtime Loader for Relay Hooks */
export class AndroidModuleLoader {
    async executeModule(code, filename, context, fetchUrl, isMainHook = false) {
        const exports = {};
        const module = { exports };
        globalThis.__currentModulePath = filename;
        globalThis.__relay_meta = { filename, dirname: filename.substring(0, filename.lastIndexOf('/') || 0), url: fetchUrl || filename };
        globalThis.__hook_react = context.React;
        const perModuleAlias = `const __hook_import = (spec) => (globalThis.__hook_import_with ? globalThis.__hook_import_with(String(spec), ${JSON.stringify(filename)}) : Promise.reject(new Error('__hook_import_with not available')));\n`;
        globalThis.__hook_import_with = async (spec, fromFile) => {
            const fn = (context && context.helpers && typeof context.helpers.loadModule === 'function') ? context.helpers.loadModule : null;
            if (!fn)
                throw new Error('__hook_import_with unavailable: helpers.loadModule not available');
            return await fn(spec, fromFile);
        };
        const fn = new Function('require', 'module', 'exports', 'context', `\ntry {\n${perModuleAlias}\n${code}\n} catch (err) {\n console.error('[AndroidModuleLoader] Code execution error in ${filename}:', err && (err.message || err));\n throw err;\n}\n//# sourceURL=${filename}\n`);
        const requireShim = (spec) => {
            if (spec === 'react')
                return context.React || {};
            if (spec === '@clevertree/helpers')
                return context.helpers || {};
            if (spec === '@clevertree/file-renderer')
                return context.FileRenderer || (() => null);
            if (spec === '@clevertree/layout')
                return context.Layout || null;
            if (spec === '@clevertree/markdown')
                return globalThis.__relay_builtins?.['@clevertree/markdown'] || {};
            if (spec === '@clevertree/theme')
                return globalThis.__relay_builtins?.['@clevertree/theme'] || {};
            if (spec === '@clevertree/meta')
                return globalThis.__relay_meta || { filename: '', dirname: '', url: '' };
            if (spec === 'react/jsx-runtime') {
                const r = context.React || globalThis.__hook_react || {};
                const jsxFactory = (type, config, maybeKey) => {
                    let key = null;
                    let ref = null;
                    let props = {};
                    const elementType = (() => {
                        try {
                            if (r && typeof r.createElement === 'function') {
                                const el = r.createElement('div', null);
                                if (el && el.$$typeof)
                                    return el.$$typeof;
                            }
                        }
                        catch { }
                        return Symbol.for('react.element');
                    })();
                    if (maybeKey !== undefined)
                        key = String(maybeKey);
                    if (config) {
                        for (let propName in config) {
                            if (propName === 'key')
                                key = String(config.key);
                            else if (propName === 'ref')
                                ref = config.ref;
                            else
                                props[propName] = config[propName];
                        }
                    }
                    return { '$$typeof': elementType, type, key, ref: ref || null, props };
                };
                return { jsx: jsxFactory, jsxs: jsxFactory, Fragment: r.Fragment };
            }
            return {};
        };
        globalThis.__hook_jsx_runtime = globalThis.__hook_jsx_runtime || { jsx: (context.React && context.React.createElement) ? context.React.createElement : (() => null), jsxs: (context.React && context.React.createElement) ? context.React.createElement : (() => null), Fragment: context.React?.Fragment };
        const result = fn(requireShim, module, exports, context);
        const mod = module.exports;
        if (isMainHook && (!mod || typeof mod.default !== 'function')) {
            if (mod && (typeof mod === 'object' || typeof mod === 'function'))
                return mod;
            throw new Error('Hook module does not export a default function');
        }
        return mod;
    }
}
export async function transpileCode(code, filename, isTypescript) {
    const wasmTranspile = globalThis.__hook_transpile_jsx;
    const version = globalThis.__hook_transpiler_version || 'unknown';
    if (typeof wasmTranspile !== 'function') {
        throw new Error(`HookTranspiler WASM not loaded (v${version})`);
    }
    const out = await wasmTranspile(code, filename, !!isTypescript);
    const transpiled = typeof out === 'string' ? out : (out?.code || '');
    if (!transpiled)
        throw new Error('Transpiler returned empty output');
    return applyHookRewrite(transpiled + `\n//# sourceURL=${filename}`);
}
export function applyHookRewrite(code) {
    const mkBuiltin = (spec, destructure) => `const ${destructure} = ((globalThis && globalThis.__relay_builtins && globalThis.__relay_builtins['${spec}']) || {});`;
    const markdownRe = /import\s+\{\s*MarkdownRenderer\s*\}\s+from\s+['"]@clevertree\/markdown['"];?/g;
    const themeRe = /import\s+\{\s*registerThemesFromYaml\s*\}\s+from\s+['"]@clevertree\/theme['"];?/g;
    const metaRe = /import\s+(\w+)\s+from\s+['"]@clevertree\/meta['"];?/g;
    const metaStarRe = /import\s*\*\s*as\s+(\w+)\s+from\s+['"]@clevertree\/meta['"];?/g;
    const metaDestructureRe = /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]@clevertree\/meta['"];?/g;
    const reactRe = /import\s+React\s*(?:,\s*\{([^}]+)\})?\s+from\s+['"]react['"];?/g;
    const reactNamedOnlyRe = /import\s+\{([^}]+)\}\s+from\s+['"]react['"];?/g;
    const reactStarRe = /import\s*\*\s*as\s+React\s+from\s+['"]react['"];?/g;
    const jsxRuntimeRe = /import\s+\{\s*jsx\s+as\s+(_jsx)\s*,\s*jsxs\s+as\s+(_jsxs)\s*,\s*Fragment\s+as\s+(_Fragment)\s*\}\s+from\s+['"]react\/jsx-runtime['"];?/g;
    let rewritten = code.replace(markdownRe, mkBuiltin('@clevertree/markdown', '{ MarkdownRenderer }'));
    rewritten = rewritten.replace(themeRe, mkBuiltin('@clevertree/theme', '{ registerThemesFromYaml }'));
    rewritten = rewritten.replace(reactRe, (_m, named) => {
        let res = 'const React = (globalThis.__hook_react || globalThis.React);';
        if (named)
            res += ` const { ${named} } = React;`;
        return res;
    });
    rewritten = rewritten.replace(reactNamedOnlyRe, (_m, named) => `const { ${named} } = (globalThis.__hook_react || globalThis.React);`);
    rewritten = rewritten.replace(reactStarRe, 'const React = (globalThis.__hook_react || globalThis.React);');
    rewritten = rewritten.replace(metaRe, (_m, name) => `const ${name} = (globalThis.__relay_meta || { filename: '', dirname: '', url: '' });`);
    rewritten = rewritten.replace(metaStarRe, (_m, name) => `const ${name} = (globalThis.__relay_meta || { filename: '', dirname: '', url: '' });`);
    rewritten = rewritten.replace(metaDestructureRe, (_m, destructure) => `const { ${destructure} } = (globalThis.__relay_meta || { filename: '', dirname: '', url: '' });`);
    rewritten = rewritten.replace(jsxRuntimeRe, (_m, a, b, c) => `const ${a} = (globalThis.__hook_jsx_runtime?.jsx || globalThis.__jsx || (globalThis.__hook_react && globalThis.__hook_react.createElement) || (() => null)); const ${b} = (globalThis.__hook_jsx_runtime?.jsxs || globalThis.__jsxs || (globalThis.__hook_react && globalThis.__hook_react.createElement) || (() => null)); const ${c} = (globalThis.__hook_jsx_runtime?.Fragment || globalThis.__Fragment || (globalThis.__hook_react && globalThis.__hook_react.Fragment));`);
    rewritten = rewritten.replace(/export\s+default\s+function\s+(\w+)\s*\(/g, (match, name) => `function ${name}(`);
    rewritten = rewritten.replace(/export\s+default\s+(\w+)\s*;?\s*$/m, (match, name) => `module.exports.default = ${name};`);
    return rewritten;
}
//# sourceMappingURL=runtimeLoader.js.map