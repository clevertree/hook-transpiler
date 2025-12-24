import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AndroidModuleLoader, transpileCode } from '../runtimeLoader.js';
import { HookLoader, createHookReact } from '../../web/runtimeLoader.js';
function normalizeHostUrl(host) {
    if (!host)
        return '';
    if (host.startsWith('http://') || host.startsWith('https://'))
        return host;
    if (host.includes(':'))
        return `http://${host}`;
    return `https://${host}`;
}
function getMimeType(path) {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'md':
        case 'markdown':
            return 'text/markdown';
        case 'json':
            return 'application/json';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        case 'gif':
            return 'image/gif';
        case 'txt':
            return 'text/plain';
        default:
            return 'text/plain';
    }
}
const FileRenderer = ({ content, contentType, onElement }) => {
    useEffect(() => {
        if (onElement) {
            const lower = (contentType || '').toLowerCase();
            if (lower.startsWith('image/')) {
                onElement('image', { width: 'match_parent', height: 'wrap_content' });
            }
            else {
                onElement('text', {});
            }
        }
    }, [onElement, contentType]);
    const lower = (contentType || '').toLowerCase();
    if (lower.startsWith('image/')) {
        return _jsx("img", { src: content, style: { width: '100%', height: 'auto' } });
    }
    if (lower.includes('markdown') || lower.includes('md')) {
        return (_jsx("div", { style: { width: '100%', height: '100%', overflow: 'auto' }, children: _jsx("pre", { style: { padding: 16 }, children: content }) }));
    }
    if (lower.includes('json')) {
        let pretty = content;
        try {
            pretty = JSON.stringify(JSON.parse(content), null, 2);
        }
        catch (e) { }
        return (_jsx("div", { style: { width: '100%', height: '100%', overflow: 'auto' }, children: _jsx("pre", { style: { padding: 16 }, children: pretty }) }));
    }
    return (_jsx("div", { style: { width: '100%', height: '100%', overflow: 'auto' }, children: _jsx("pre", { style: { padding: 16 }, children: content }) }));
};
export const HookRenderer = ({ host, hookPath, onElement, requestRender, startAutoSync, stopAutoSync, registerTheme, loadThemesFromYamlUrl, onError, onReady, onLoading, }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [element, setElement] = useState(null);
    const normalizedHost = useMemo(() => normalizeHostUrl(host), [host]);
    const loaderRef = useRef(null);
    useEffect(() => {
        if (!host)
            return;
        const protocol = normalizedHost.startsWith('https://') ? 'https' : 'http';
        const hostOnly = normalizedHost.replace(/^https?:\/\//, '');
        const loader = new AndroidModuleLoader();
        loaderRef.current = new HookLoader({
            host: hostOnly,
            protocol: protocol,
            moduleLoader: loader,
            transpiler: (code, filename) => transpileCode(code, filename)
        });
        if (startAutoSync) {
            try {
                startAutoSync();
            }
            catch (e) { }
        }
        return () => {
            if (stopAutoSync) {
                try {
                    stopAutoSync();
                }
                catch (e) { }
            }
        };
    }, [normalizedHost, host, startAutoSync, stopAutoSync]);
    const registerUsageFromElement = useCallback((tag, props) => {
        if (onElement) {
            try {
                onElement(tag, props);
                if (requestRender)
                    requestRender();
            }
            catch (e) { }
        }
    }, [onElement, requestRender]);
    const createHookContext = useCallback((baseHookPath) => {
        const buildPeer = (p) => `${normalizedHost}${p.startsWith('/') ? p : '/' + p}`;
        const FileRendererAdapter = ({ path }) => {
            const [content, setContent] = useState('');
            const [contentType, setContentType] = useState('text/plain');
            const [fileLoading, setFileLoading] = useState(true);
            useEffect(() => {
                let cancelled = false;
                (async () => {
                    try {
                        const url = `${normalizedHost}${path.startsWith('/') ? path : '/' + path}`;
                        const resp = await fetch(url);
                        const txt = await resp.text();
                        if (!cancelled) {
                            setContent(txt);
                            const ct = resp.headers.get('content-type') || getMimeType(path);
                            setContentType(ct);
                        }
                    }
                    catch (e) {
                        if (!cancelled) {
                            setContent(`Error loading file: ${path}`);
                            setContentType('text/plain');
                        }
                    }
                    finally {
                        if (!cancelled)
                            setFileLoading(false);
                    }
                })();
                return () => { cancelled = true; };
            }, [path]);
            if (fileLoading)
                return _jsx("text", { children: "Loading file..." });
            return _jsx(FileRenderer, { content: content, contentType: contentType, onElement: registerUsageFromElement });
        };
        const registerThemesFromYaml = async (path) => {
            try {
                if (loadThemesFromYamlUrl) {
                    const absolute = buildPeer(path);
                    await loadThemesFromYamlUrl(absolute);
                }
            }
            catch (e) { }
        };
        const wrappedReact = createHookReact(React, registerUsageFromElement);
        return {
            React: wrappedReact,
            createElement: wrappedReact.createElement,
            onElement: registerUsageFromElement,
            FileRenderer: FileRendererAdapter,
            helpers: {
                buildPeerUrl: buildPeer,
                loadModule: async (modulePath, fromPathArg) => {
                    if (!loaderRef.current)
                        throw new Error('loader not ready');
                    const fromPath = fromPathArg || baseHookPath;
                    return loaderRef.current.loadModule(modulePath, fromPath, createHookContext(fromPath));
                },
                registerThemeStyles: (name, defs) => {
                    if (registerTheme)
                        registerTheme(name, defs);
                },
                registerThemesFromYaml,
            }
        };
    }, [normalizedHost, registerUsageFromElement, loadThemesFromYamlUrl, registerTheme]);
    const tryRender = useCallback(async () => {
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
            const path = hookPath || '/hooks/client/get-client.jsx';
            if (!loaderRef.current)
                throw new Error('hook loader not initialized');
            const ctx = createHookContext(path);
            const el = await loaderRef.current.loadAndExecuteHook(path, ctx);
            setElement(el);
            if (onReady) {
                try {
                    onReady();
                }
                catch { }
            }
        }
        catch (e) {
            console.error('[HookRenderer] Android Error:', e);
            const message = e?.message || String(e);
            const stack = e?.stack || '';
            setError(stack ? `${message}\n\nStack:\n${stack}` : message);
            if (onError) {
                try {
                    onError(stack ? `${message}\n\nStack:\n${stack}` : message);
                }
                catch { }
            }
        }
        finally {
            setLoading(false);
        }
    }, [createHookContext, hookPath]);
    useEffect(() => { void tryRender(); }, [tryRender]);
    return (_jsxs("div", { children: [loading && _jsx("text", { children: "Loading hook..." }), error && (_jsx("div", { style: { width: '100%', height: '100%', overflow: 'auto' }, children: _jsxs("pre", { style: { color: '#ff0000', padding: 16 }, children: ["Error: ", error] }) })), !loading && !error && element && (_jsx("div", { style: { width: '100%', height: '100%' }, children: element }))] }));
};
export default HookRenderer;
//# sourceMappingURL=HookRenderer.js.map