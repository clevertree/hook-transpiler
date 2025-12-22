import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HookLoader, AndroidModuleLoader, transpileCode, createHookReact, type HookContext } from '../../runtimeLoader.js'

export interface HookRendererProps {
    host: string
    hookPath?: string
    onElement?: (tag: string, props: any) => void
    requestRender?: () => void
    renderCssIntoDom?: () => void
    startAutoSync?: (interval?: number) => void
    stopAutoSync?: () => void
    registerTheme?: (name: string, defs?: any) => void
    loadThemesFromYamlUrl?: (url: string) => Promise<void>
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

function getMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase()
    switch (ext) {
        case 'md':
        case 'markdown':
            return 'text/markdown'
        case 'json':
            return 'application/json'
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg'
        case 'png':
            return 'image/png'
        case 'gif':
            return 'image/gif'
        case 'txt':
            return 'text/plain'
        default:
            return 'text/plain'
    }
}

/**
 * Pure Android FileRenderer component.
 * Uses native-compatible tags like div, text, image, scroll.
 */
const FileRenderer: React.FC<{ content: string; contentType: string; onElement?: (tag: string, props: any) => void }> = ({ content, contentType, onElement }) => {
    useEffect(() => {
        if (onElement) {
            const lower = (contentType || '').toLowerCase()
            if (lower.startsWith('image/')) {
                onElement('image', { width: 'match_parent', height: 'wrap_content' })
            } else {
                onElement('text', {})
            }
        }
    }, [onElement, contentType])

    const lower = (contentType || '').toLowerCase()

    if (lower.startsWith('image/')) {
        // In native Android bridge, we might just pass the raw content if it's a data URL or path
        return <image src={content} width="match_parent" height="wrap_content" />
    }

    if (lower.includes('markdown') || lower.includes('md')) {
        // Minimal markdown-to-text conversion for pure android if no heavy renderer is available
        // Or we just render it as text for now as the instruction says "renders markdown or text (default)"
        // "pure android FileRenderer component that ... renders markdown or text (default)"
        // Since we are combining them, let's at least try to show it.
        return (
            <scroll width="match_parent" height="match_parent">
                <text padding="16">{content}</text>
            </scroll>
        )
    }

    if (lower.includes('json')) {
        let pretty = content
        try {
            pretty = JSON.stringify(JSON.parse(content), null, 2)
        } catch (e) { }
        return (
            <scroll width="match_parent" height="match_parent">
                <text padding="16">{pretty}</text>
            </scroll>
        )
    }

    return (
        <scroll width="match_parent" height="match_parent">
            <text padding="16">{content}</text>
        </scroll>
    )
}

export const HookRenderer: React.FC<HookRendererProps> = ({
    host,
    hookPath,
    onElement,
    requestRender,
    startAutoSync,
    stopAutoSync,
    registerTheme,
    loadThemesFromYamlUrl,
    onError,
    onReady,
    onLoading,
}) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [element, setElement] = useState<React.ReactNode | null>(null)
    const normalizedHost = useMemo(() => normalizeHostUrl(host), [host])
    const loaderRef = useRef<HookLoader | null>(null)

    useEffect(() => {
        if (!host) return
        const protocol = normalizedHost.startsWith('https://') ? 'https' : 'http'
        const hostOnly = normalizedHost.replace(/^https?:\/\//, '')

        const loader = new AndroidModuleLoader({
            host: hostOnly,
            transpiler: (code, filename) => transpileCode(code, { filename })
        })
        loaderRef.current = new HookLoader({
            host: hostOnly,
            protocol: protocol as 'http' | 'https',
            moduleLoader: loader,
        })

        if (startAutoSync) {
            try { startAutoSync() } catch (e) { }
        }

        return () => {
            if (stopAutoSync) {
                try { stopAutoSync() } catch (e) { }
            }
        }
    }, [normalizedHost, host, startAutoSync, stopAutoSync])

    const registerUsageFromElement = useCallback((tag: string, props?: Record<string, unknown>) => {
        if (onElement) {
            try {
                onElement(tag, props)
                if (requestRender) requestRender()
            } catch (e) { }
        }
    }, [onElement, requestRender])

    const createHookContext = useCallback((baseHookPath: string): HookContext => {
        const buildPeer = (p: string) => `${normalizedHost}${p.startsWith('/') ? p : '/' + p}`

        const FileRendererAdapter = ({ path }: { path: string }) => {
            const [content, setContent] = useState<string>('')
            const [contentType, setContentType] = useState<string>('text/plain')
            const [fileLoading, setFileLoading] = useState(true)

            useEffect(() => {
                let cancelled = false
                    ; (async () => {
                        try {
                            const url = `${normalizedHost}${path.startsWith('/') ? path : '/' + path}`
                            const resp = await fetch(url)
                            const txt = await resp.text()
                            if (!cancelled) {
                                setContent(txt)
                                const ct = resp.headers.get('content-type') || getMimeType(path)
                                setContentType(ct)
                            }
                        } catch (e) {
                            if (!cancelled) {
                                setContent(`Error loading file: ${path}`)
                                setContentType('text/plain')
                            }
                        } finally {
                            if (!cancelled) setFileLoading(false)
                        }
                    })()
                return () => { cancelled = true }
            }, [path])

            if (fileLoading) return <text>Loading file...</text>
            return <FileRenderer content={content} contentType={contentType} onElement={registerUsageFromElement} />
        }

        const registerThemesFromYaml = async (path: string) => {
            try {
                if (loadThemesFromYamlUrl) {
                    const absolute = buildPeer(path)
                    await loadThemesFromYamlUrl(absolute)
                }
            } catch (e) { }
        }

        const wrappedReact = createHookReact(React, registerUsageFromElement)

        return {
            React: wrappedReact,
            createElement: wrappedReact.createElement,
            onElement: registerUsageFromElement,
            FileRenderer: FileRendererAdapter,
            helpers: {
                buildPeerUrl: buildPeer,
                loadModule: async (modulePath: string, fromPathArg?: string) => {
                    if (!loaderRef.current) throw new Error('loader not ready')
                    const fromPath = fromPathArg || baseHookPath
                    return loaderRef.current.loadModule(modulePath, fromPath, createHookContext(fromPath))
                },
                registerThemeStyles: (name: string, defs?: Record<string, any>) => {
                    if (registerTheme) registerTheme(name, defs)
                },
                registerThemesFromYaml,
            }
        }
    }, [normalizedHost, registerUsageFromElement, loadThemesFromYamlUrl, registerTheme])

    const tryRender = useCallback(async () => {
        setLoading(true)
        setError(null)
        setElement(null)
        if (onLoading) {
            try { onLoading() } catch { }
        }
        try {
            const path = hookPath || '/hooks/client/get-client.jsx'
            if (!loaderRef.current) throw new Error('hook loader not initialized')
            const ctx = createHookContext(path)
            const el = await loaderRef.current.loadAndExecuteHook(path, ctx)
            setElement(el)
            if (onReady) {
                try { onReady() } catch { }
            }
        } catch (e: any) {
            console.error('[HookRenderer] Android Error:', e)
            const message = e?.message || String(e)
            const stack = e?.stack || ''
            setError(stack ? `${message}\n\nStack:\n${stack}` : message)
            if (onError) {
                try { onError(stack ? `${message}\n\nStack:\n${stack}` : message) } catch { }
            }
        } finally {
            setLoading(false)
        }
    }, [createHookContext, hookPath])

    useEffect(() => { void tryRender() }, [tryRender])

    return (
        <div width="match_parent" height="match_parent">
            {loading && <text>Loading hook...</text>}
            {error && (
                <scroll width="match_parent" height="match_parent">
                    <text color="#ff0000" padding="16">Error: {error}</text>
                </scroll>
            )}
            {!loading && !error && element && (
                <div width="match_parent" height="match_parent">
                    {element}
                </div>
            )}
        </div>
    )
}

export default HookRenderer
