import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HookLoader, WebModuleLoader, transpileCode, createHookReact, type HookContext } from '../runtimeLoader.js'
import ErrorBoundary from './ErrorBoundary.js'
import { MarkdownRenderer } from './MarkdownRenderer.js'
import { FileRenderer } from './FileRenderer.js'

export interface HookRendererProps {
    host: string
    hookPath?: string
    // Styler integration (optional, decouples themed-styler)
    onElement?: (tag: string, props: any) => void
    requestRender?: () => void
    renderCssIntoDom?: () => void
    startAutoSync?: (interval?: number) => void
    stopAutoSync?: () => void
    registerTheme?: (name: string, defs?: any) => void
    loadThemesFromYamlUrl?: (url: string) => Promise<void>
    markdownOverrides?: Record<string, React.ComponentType<any>>
    onError?: (msg?: string) => void
    onReady?: () => void
    onLoading?: () => void
}

function normalizeHostUrl(host: string) {
    if (!host) return ''
    if (host.startsWith('http://') || host.startsWith('https://')) return host
    if (host.includes(':')) return `http://${host}`
    return `https://${host}`
}

export const HookRenderer: React.FC<HookRendererProps> = ({
    host,
    hookPath,
    onElement,
    requestRender,
    renderCssIntoDom,
    startAutoSync,
    stopAutoSync,
    registerTheme,
    loadThemesFromYamlUrl,
    markdownOverrides,
    onError,
    onReady,
    onLoading,
}) => {
    const [loading, setLoading] = useState(false)
    const [wasmReady, setWasmReady] = useState(!!globalThis.__hook_transpile_jsx)
    const [wasmError, setWasmError] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [element, setElement] = useState<React.ReactNode | null>(null)
    const normalizedHost = useMemo(() => normalizeHostUrl(host), [host])
    const loaderRef = useRef<HookLoader | null>(null)

    useEffect(() => {
        if (!onElement) {
            console.warn('[HookRenderer] Warning: onElement (registerUsage) callback is not set. Rendered UI will not be styled.')
        }
    }, [onElement])

    useEffect(() => {
        if (wasmReady) return
        if (onLoading) {
            try { onLoading() } catch { }
        }

        let attempts = 0
        const interval = setInterval(() => {
            attempts++
            if (globalThis.__hook_transpile_jsx) {
                setWasmReady(true)
                clearInterval(interval)
            } else if (attempts > 50) { // 5 seconds
                const msg = 'Hook transpiler (WASM) failed to initialize'
                setWasmError(msg)
                if (onError) {
                    try { onError(msg) } catch { }
                }
                clearInterval(interval)
            }
        }, 100)

        return () => clearInterval(interval)
    }, [wasmReady])

    useEffect(() => {
        if (!host) return
        const protocol = normalizedHost.startsWith('https://') ? 'https' : 'http'
        const hostOnly = normalizedHost.replace(/^https?:\/\//, '')

        const webLoader = new WebModuleLoader()
        loaderRef.current = new HookLoader({
            host: hostOnly,
            protocol: protocol as 'http' | 'https',
            moduleLoader: webLoader,
            transpiler: (code, filename) => transpileCode(code, { filename })
        })

        // Expose loader for e2e testing
        if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
            (window as any).__currentLoader = loaderRef.current
        }

        if (startAutoSync) {
            try {
                startAutoSync()
                if (requestRender) requestRender()
            } catch (e) {
                console.debug('Failed to start style auto-sync:', e)
            }
        }

        return () => {
            if (stopAutoSync) {
                try { stopAutoSync() } catch (e) {
                    console.debug('Failed to stop style auto-sync:', e)
                }
            }
        }
    }, [normalizedHost, host, startAutoSync, stopAutoSync, requestRender])

    const registerUsageFromElement = useCallback((tag: string, props?: Record<string, unknown>) => {
        if (onElement) {
            try {
                onElement(tag, props)
                if (requestRender) requestRender()
            } catch (e) {
                console.debug('Usage registration failed:', e)
            }
        }
    }, [onElement, requestRender])

    const createHookContext = useCallback((baseHookPath: string): HookContext => {
        const buildPeer = (p: string) => `${normalizedHost}${p.startsWith('/') ? p : '/' + p}`

        const resolveThemeUrl = (path: string) => {
            if (path.startsWith('/')) {
                return `${normalizedHost}${path}`
            }
            const base = globalThis.__currentModulePath || baseHookPath || '/'
            const baseDir = base.includes('/') ? base.slice(0, base.lastIndexOf('/')) : ''
            return new URL(path, `${normalizedHost}${baseDir}/`).href
        }

        const FileRendererAdapter = ({ path }: { path: string }) => {
            const [content, setContent] = useState<string>('')
            const [contentType, setContentType] = useState<string>('text/plain')
            const [loading, setLoading] = useState(true)
            useEffect(() => {
                let cancelled = false
                    ; (async () => {
                        try {
                            const url = `${normalizedHost}${path.startsWith('/') ? path : '/' + path}`
                            const resp = await fetch(url)
                            const txt = await resp.text()
                            if (!cancelled) {
                                setContent(txt)
                                setContentType(resp.headers.get('content-type') || 'text/plain')
                            }
                        } catch (e) {
                            if (!cancelled) setContent('')
                        } finally {
                            if (!cancelled) setLoading(false)
                        }
                    })()
                return () => { cancelled = true }
            }, [path])

            if (loading) return <div>Loading file...</div>
            return <FileRenderer content={content} contentType={contentType} onElement={registerUsageFromElement} />
        }

        const registerThemesFromYaml = async (path: string) => {
            try {
                if (loadThemesFromYamlUrl) {
                    const absolute = resolveThemeUrl(path)
                    await loadThemesFromYamlUrl(absolute)
                    if (renderCssIntoDom) renderCssIntoDom()
                }
            } catch (e) {
                console.warn('[HookRenderer] registerThemesFromYaml failed:', e)
            }
        }

        const builtinModules: Record<string, any> = {
            '@clevertree/markdown': { MarkdownRenderer: (props: any) => <MarkdownRenderer onElement={registerUsageFromElement} overrides={markdownOverrides} {...props} /> },
            '@clevertree/theme': {
                registerThemeStyles: (name: string, defs?: Record<string, any>) => {
                    if (registerTheme) registerTheme(name, defs)
                    if (renderCssIntoDom) renderCssIntoDom()
                },
                registerThemesFromYaml,
            },
        }

        globalThis.__relay_builtins = builtinModules

        const loadModule = async (modulePath: string, fromPathArg?: string) => {
            if (builtinModules[modulePath]) return builtinModules[modulePath]
            if (!loaderRef.current) throw new Error('loader not ready')
            const fromPath = fromPathArg || globalThis.__currentModulePath || baseHookPath
            return loaderRef.current.loadModule(modulePath, fromPath, createHookContext(fromPath))
        }

        const wrappedReact = createHookReact(React, registerUsageFromElement)
        return {
            React: wrappedReact,
            createElement: wrappedReact.createElement,
            onElement: registerUsageFromElement,
            FileRenderer: FileRendererAdapter,
            Layout: undefined,
            helpers: {
                buildPeerUrl: buildPeer,
                loadModule,
                registerThemeStyles: (name: string, defs?: Record<string, any>) => {
                    if (registerTheme) registerTheme(name, defs)
                    if (renderCssIntoDom) renderCssIntoDom()
                },
                registerThemesFromYaml,
            }
        }
    }, [normalizedHost, onElement, registerUsageFromElement, loadThemesFromYamlUrl, renderCssIntoDom, registerTheme])

    const tryRender = useCallback(async () => {
        if (!wasmReady) return
        setLoading(true)
        setError(null)
        setElement(null)
        if (onLoading) {
            try { onLoading() } catch { }
        }
        try {
            const path = hookPath || 'http://localhost:8002/hooks/client/get-client.jsx'
            if (!loaderRef.current) throw new Error('hook loader not initialized')
            const ctx = createHookContext(path)
            const el = await loaderRef.current.loadAndExecuteHook(path, ctx)
            setElement(el)
            if (renderCssIntoDom) renderCssIntoDom()
            if (onReady) {
                try { onReady() } catch { }
            }
        } catch (e: any) {
            console.error('[HookRenderer] Error loading/executing hook:', e)
            const message = e?.message || String(e)
            const stack = e?.stack || ''
            const fullError = stack ? `${message}\n\nStack Trace:\n${stack}` : message
            setError(fullError)
            if (onError) {
                try { onError(fullError) } catch { }
            }
        } finally {
            setLoading(false)
        }
    }, [createHookContext, hookPath, wasmReady, renderCssIntoDom])

    useEffect(() => { void tryRender() }, [tryRender])

    useEffect(() => {
        if (onElement) {
            onElement('div', { style: { height: '100%', display: 'flex', flexDirection: 'column' } })
            if (renderCssIntoDom) {
                try { renderCssIntoDom() } catch (e) { }
            }
        }
    }, [onElement, renderCssIntoDom])

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {!wasmReady && !wasmError && <div>Initializing WASM transpiler...</div>}
            {wasmReady && loading && <div>Loading hook...</div>}
            {(error || wasmError || element) && (
                <ErrorBoundary
                    initialError={error || wasmError}
                    onElement={registerUsageFromElement}
                >
                    <div style={{ flex: 1 }}>{element}</div>
                </ErrorBoundary>
            )}
        </div>
    )
}

export default HookRenderer
