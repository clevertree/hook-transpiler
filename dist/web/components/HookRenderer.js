import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HookLoader, WebModuleLoader, transpileCode, createHookReact } from '../runtimeLoader.js';
import ErrorBoundary from './ErrorBoundary.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';
import { FileRenderer } from './FileRenderer.js';
function normalizeHostUrl(host) {
    if (!host)
        return '';
    if (host.startsWith('http://') || host.startsWith('https://'))
        return host;
    if (host.includes(':'))
        return `http://${host}`;
    return `https://${host}`;
}
function ensureLeadingSlash(path) {
    if (!path)
        return '';
    return path.startsWith('/') ? path : `/${path}`;
}
async function discoverHookPathWithOptions(hostUrl) {
    const optionsUrl = hostUrl.endsWith('/') ? hostUrl : `${hostUrl}/`;
    const response = await fetch(optionsUrl, { method: 'OPTIONS' });
    if (!response.ok) {
        throw new Error(`OPTIONS ${optionsUrl} → ${response.status} ${response.statusText}`);
    }
    // Prefer header if provided, fall back to body
    let candidate = response.headers.get('x-hook-path') || response.headers.get('x-relay-hook-path');
    if (!candidate) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            try {
                const json = await response.json();
                candidate = json?.hookPath || json?.hook_path || json?.path || null;
            }
            catch (e) {
                throw new Error(`OPTIONS ${optionsUrl} returned invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        else {
            const text = (await response.text()).trim();
            candidate = text || null;
        }
    }
    if (!candidate) {
        throw new Error(`OPTIONS ${optionsUrl} did not return a hook path`);
    }
    return ensureLeadingSlash(candidate);
}
export const HookRenderer = ({ host, hookPath, onElement, requestRender, renderCssIntoDom, startAutoSync, stopAutoSync, registerTheme, loadThemesFromYamlUrl, markdownOverrides, onError, onReady, onLoading, runtimeMode = 'web', onRuntimeChange, showRuntimeFooter = true, showVersionInfo = true, availableRuntimes = ['web'], }) => {
    const [loading, setLoading] = useState(false);
    const [wasmReady, setWasmReady] = useState(!!globalThis.__hook_transpile_jsx);
    const [wasmError, setWasmError] = useState(null);
    const [error, setError] = useState(null);
    const [element, setElement] = useState(null);
    const [resolvedHookPath, setResolvedHookPath] = useState(hookPath || null);
    const [activeRuntime, setActiveRuntime] = useState(runtimeMode);
    const [runtimeVersion, setRuntimeVersion] = useState('1.0.0');
    const normalizedHost = useMemo(() => normalizeHostUrl(host), [host]);
    const loaderRef = useRef(null);
    // Track runtime version
    useEffect(() => {
        const version = activeRuntime === 'web'
            ? globalThis.__web_runtime_version || '1.0.0'
            : globalThis.__node_runtime_version || '1.0.0';
        setRuntimeVersion(version);
    }, [activeRuntime]);
    // Handle runtime switching
    const handleRuntimeSwitch = useCallback((newRuntime) => {
        if (newRuntime === activeRuntime || availableRuntimes.length <= 1)
            return;
        console.log(`[HookRenderer] Switching runtime from ${activeRuntime} to ${newRuntime}`);
        // Reset state
        setElement(null);
        setError(null);
        setLoading(true);
        // Switch runtime
        setActiveRuntime(newRuntime);
        // Notify parent
        if (onRuntimeChange) {
            try {
                onRuntimeChange(newRuntime, runtimeVersion);
            }
            catch (e) {
                console.debug('[HookRenderer] onRuntimeChange callback failed:', e);
            }
        }
        // Re-render hook with new runtime
        setTimeout(() => {
            void tryRender();
        }, 100);
    }, [activeRuntime, runtimeVersion, onRuntimeChange, availableRuntimes]);
    useEffect(() => {
        if (!onElement) {
            console.warn('[HookRenderer] Warning: onElement (registerUsage) callback is not set. Rendered UI will not be styled.');
        }
    }, [onElement]);
    useEffect(() => {
        if (wasmReady)
            return;
        if (onLoading) {
            try {
                onLoading();
            }
            catch { }
        }
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (globalThis.__hook_transpile_jsx) {
                setWasmReady(true);
                clearInterval(interval);
            }
            else if (attempts > 50) { // 5 seconds
                const msg = 'Hook transpiler (WASM) failed to initialize';
                setWasmError(msg);
                if (onError) {
                    try {
                        onError(msg);
                    }
                    catch { }
                }
                clearInterval(interval);
            }
        }, 100);
        return () => clearInterval(interval);
    }, [wasmReady]);
    useEffect(() => {
        if (!host)
            return;
        const protocol = normalizedHost.startsWith('https://') ? 'https' : 'http';
        const hostOnly = normalizedHost.replace(/^https?:\/\//, '');
        const webLoader = new WebModuleLoader();
        loaderRef.current = new HookLoader({
            host: hostOnly,
            protocol: protocol,
            moduleLoader: webLoader,
            transpiler: (code, filename) => transpileCode(code, { filename })
        });
        // Expose loader for e2e testing
        if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
            window.__currentLoader = loaderRef.current;
        }
        if (startAutoSync) {
            try {
                startAutoSync();
                if (requestRender)
                    requestRender();
            }
            catch (e) {
                console.debug('Failed to start style auto-sync:', e);
            }
        }
        return () => {
            if (stopAutoSync) {
                try {
                    stopAutoSync();
                }
                catch (e) {
                    console.debug('Failed to stop style auto-sync:', e);
                }
            }
        };
    }, [normalizedHost, host, startAutoSync, stopAutoSync, requestRender]);
    useEffect(() => {
        setResolvedHookPath(hookPath || null);
        setError(null);
    }, [hookPath, normalizedHost]);
    const registerUsageFromElement = useCallback((tag, props) => {
        if (onElement) {
            try {
                onElement(tag, props);
                if (requestRender)
                    requestRender();
            }
            catch (e) {
                console.debug('Usage registration failed:', e);
            }
        }
    }, [onElement, requestRender]);
    const createHookContext = useCallback((baseHookPath) => {
        const buildPeer = (p) => `${normalizedHost}${p.startsWith('/') ? p : '/' + p}`;
        const resolveThemeUrl = (path) => {
            if (path.startsWith('/')) {
                return `${normalizedHost}${path}`;
            }
            const base = globalThis.__currentModulePath || baseHookPath || '/';
            const baseDir = base.includes('/') ? base.slice(0, base.lastIndexOf('/')) : '';
            return new URL(path, `${normalizedHost}${baseDir}/`).href;
        };
        const FileRendererAdapter = ({ path }) => {
            const [content, setContent] = useState('');
            const [contentType, setContentType] = useState('text/plain');
            const [loading, setLoading] = useState(true);
            useEffect(() => {
                let cancelled = false;
                (async () => {
                    try {
                        const url = `${normalizedHost}${path.startsWith('/') ? path : '/' + path}`;
                        const resp = await fetch(url);
                        const txt = await resp.text();
                        if (!cancelled) {
                            setContent(txt);
                            setContentType(resp.headers.get('content-type') || 'text/plain');
                        }
                    }
                    catch (e) {
                        if (!cancelled)
                            setContent('');
                    }
                    finally {
                        if (!cancelled)
                            setLoading(false);
                    }
                })();
                return () => { cancelled = true; };
            }, [path]);
            if (loading)
                return _jsx("div", { children: "Loading file..." });
            return _jsx(FileRenderer, { content: content, contentType: contentType, onElement: registerUsageFromElement });
        };
        const registerThemesFromYaml = async (path) => {
            try {
                if (loadThemesFromYamlUrl) {
                    const absolute = resolveThemeUrl(path);
                    await loadThemesFromYamlUrl(absolute);
                    if (renderCssIntoDom)
                        renderCssIntoDom();
                }
            }
            catch (e) {
                console.warn('[HookRenderer] registerThemesFromYaml failed:', e);
            }
        };
        const builtinModules = {
            '@clevertree/markdown': { MarkdownRenderer: (props) => _jsx(MarkdownRenderer, { onElement: registerUsageFromElement, overrides: markdownOverrides, ...props }) },
            '@clevertree/theme': {
                registerThemeStyles: (name, defs) => {
                    if (registerTheme)
                        registerTheme(name, defs);
                    if (renderCssIntoDom)
                        renderCssIntoDom();
                },
                registerThemesFromYaml,
            },
        };
        globalThis.__relay_builtins = builtinModules;
        const loadModule = async (modulePath, fromPathArg) => {
            if (builtinModules[modulePath])
                return builtinModules[modulePath];
            if (!loaderRef.current)
                throw new Error('loader not ready');
            const fromPath = fromPathArg || globalThis.__currentModulePath || baseHookPath;
            return loaderRef.current.loadModule(modulePath, fromPath, createHookContext(fromPath));
        };
        const wrappedReact = createHookReact(React, registerUsageFromElement);
        return {
            React: wrappedReact,
            createElement: wrappedReact.createElement,
            onElement: registerUsageFromElement,
            FileRenderer: FileRendererAdapter,
            Layout: undefined,
            __runtime: activeRuntime,
            __runtimeVersion: runtimeVersion,
            helpers: {
                buildPeerUrl: buildPeer,
                loadModule,
                registerThemeStyles: (name, defs) => {
                    if (registerTheme)
                        registerTheme(name, defs);
                    if (renderCssIntoDom)
                        renderCssIntoDom();
                },
                registerThemesFromYaml,
                getRuntimeInfo: () => ({
                    runtime: activeRuntime,
                    version: runtimeVersion,
                    isWeb: activeRuntime === 'web',
                    isNode: activeRuntime === 'node'
                })
            }
        };
    }, [normalizedHost, onElement, registerUsageFromElement, loadThemesFromYamlUrl, renderCssIntoDom, registerTheme, activeRuntime, runtimeVersion]);
    const resolveHookPath = useCallback(async () => {
        if (!normalizedHost)
            throw new Error('Host is required to resolve hook path');
        if (hookPath)
            return hookPath;
        if (resolvedHookPath)
            return resolvedHookPath;
        const discovered = await discoverHookPathWithOptions(normalizedHost);
        setResolvedHookPath(discovered);
        return discovered;
    }, [hookPath, normalizedHost, resolvedHookPath]);
    const tryRender = useCallback(async () => {
        if (!wasmReady)
            return;
        setLoading(true);
        setError(null);
        setElement(null);
        if (onLoading) {
            try {
                onLoading();
            }
            catch { }
        }
        try {
            const path = await resolveHookPath();
            if (!path)
                throw new Error('Hook path is missing');
            if (!loaderRef.current)
                throw new Error('hook loader not initialized');
            const ctx = createHookContext(path);
            const el = await loaderRef.current.loadAndExecuteHook(path, ctx);
            setElement(el);
            if (renderCssIntoDom)
                renderCssIntoDom();
            if (onReady) {
                try {
                    onReady();
                }
                catch { }
            }
        }
        catch (e) {
            console.error('[HookRenderer] Error loading/executing hook:', e);
            const message = e?.message || String(e);
            const stack = e?.stack || '';
            const fullError = stack ? `${message}\n\nStack Trace:\n${stack}` : message;
            setError(fullError);
            if (onError) {
                try {
                    onError(fullError);
                }
                catch { }
            }
        }
        finally {
            setLoading(false);
        }
    }, [createHookContext, wasmReady, renderCssIntoDom, onLoading, onReady, onError, resolveHookPath]);
    useEffect(() => { void tryRender(); }, [tryRender]);
    useEffect(() => {
        if (onElement) {
            onElement('div', { style: { height: '100%', display: 'flex', flexDirection: 'column' } });
            if (renderCssIntoDom) {
                try {
                    renderCssIntoDom();
                }
                catch (e) { }
            }
        }
    }, [onElement, renderCssIntoDom]);
    // Runtime Footer Component
    const RuntimeFooter = React.useMemo(() => {
        if (!showRuntimeFooter)
            return null;
        return (_jsxs("div", { style: {
                display: 'flex',
                height: '50px',
                borderTop: '1px solid #ddd',
                backgroundColor: '#f5f5f5',
                alignItems: 'center',
                padding: '0 12px',
                justifyContent: 'space-between',
                fontSize: '12px'
            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsxs("span", { style: { color: '#666' }, children: ["Runtime: ", activeRuntime === 'web' ? 'Web WASM' : 'Node.js'] }), showVersionInfo && (_jsxs("span", { style: { color: '#999', fontSize: '11px' }, children: ["v", runtimeVersion] }))] }), availableRuntimes.length > 1 && (_jsx("div", { style: { display: 'flex', gap: '8px' }, children: availableRuntimes.map((rt) => (_jsx("button", { onClick: () => handleRuntimeSwitch(rt), style: {
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: activeRuntime === rt ? '#007AFF' : '#e5e5e5',
                            color: activeRuntime === rt ? '#fff' : '#333',
                            fontSize: '11px',
                            fontWeight: activeRuntime === rt ? 'bold' : 'normal',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }, children: rt === 'web' ? 'WASM' : 'Node' }, rt))) }))] }));
    }, [showRuntimeFooter, activeRuntime, runtimeVersion, showVersionInfo, availableRuntimes, handleRuntimeSwitch]);
    return (_jsxs("div", { style: { height: '100%', display: 'flex', flexDirection: 'column' }, children: [_jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column' }, children: [!wasmReady && !wasmError && _jsx("div", { children: "Initializing WASM transpiler..." }), wasmReady && loading && _jsx("div", { children: "Loading hook..." }), (error || wasmError || element) && (_jsx(ErrorBoundary, { initialError: error || wasmError, onElement: registerUsageFromElement, children: _jsx("div", { style: { flex: 1 }, children: element }) }))] }), RuntimeFooter] }));
};
export default HookRenderer;
//# sourceMappingURL=HookRenderer.js.map