/**
 * Unified Runtime Loader for Relay Hooks (Web)
 */

// Provide type definitions for global scope (for React and process availability)
declare const global: any

declare global {
    var __hook_transpile_jsx: ((code: string, filename: string, isTypescript?: boolean) => any) | undefined
    var __hook_transpiler_version: string | undefined
    var __relay_builtins: Record<string, any> | undefined
    var __currentModulePath: string | undefined
    var __relay_meta: { filename: string; dirname: string; url: string } | undefined
}

export interface TransformOptions {
    filename: string
    hasJsxPragma?: boolean
    development?: boolean
    isTypescript?: boolean
}

export interface HookHelpers {
    buildPeerUrl: (path: string) => string
    loadModule: (modulePath: string, fromPath?: string) => Promise<any>
    registerThemeStyles?: (themeName: string, definitions?: Record<string, unknown>) => void
    registerThemesFromYaml?: (path: string) => Promise<void>
    buildRepoHeaders?: (branch?: string, repo?: string) => Record<string, string>
}

export type ComponentType<P = any> = (props: P) => any
export interface HookContext {
    React: any
    createElement: any
    FileRenderer: ComponentType<{ path: string }>
    Layout?: ComponentType<any>
    params?: Record<string, any>
    helpers: HookHelpers
    onElement?: (tag: string, props: any) => void
    [key: string]: any
}

export interface LoaderDiagnostics {
    phase: 'init' | 'options' | 'fetch' | 'transform' | 'import' | 'exec'
    kind?: 'get' | 'query' | 'put'
    error?: string
    details?: Record<string, any>
    [key: string]: any
}

export interface ModuleLoader {
    executeModule(code: string, filename: string, context: HookContext, fetchUrl?: string, isMainHook?: boolean): Promise<any>
}

export class WebModuleLoader implements ModuleLoader {
    async executeModule(code: string, filename: string, context: HookContext, fetchUrl?: string, isMainHook: boolean = false): Promise<any> {
        const exports: any = {}
        const module = { exports }

        try {
            ; (window as any).__ctx__ = context
                ; (window as any).__hook_import_with = async (spec: string, fromFile: string) => {
                    try {
                        console.error('[WebModuleLoader] __hook_import_with call:', spec, 'from', fromFile)
                        const fn = (context && context.helpers && typeof context.helpers.loadModule === 'function') ? context.helpers.loadModule : null
                        if (!fn) throw new Error('__hook_import_with unavailable: helpers.loadModule not available')
                        const result = await fn(spec, fromFile)
                        console.error('[WebModuleLoader] __hook_import_with resolved successfully for', spec, 'result keys:', Object.keys(result || {}))
                        return result
                    } catch (e) {
                        console.error('[WebModuleLoader] __hook_import_with failed for', spec, 'from', fromFile, 'error:', e instanceof Error ? e.message : e)
                        throw e
                    }
                }

            const perModuleAlias = `const __hook_import = (spec) => (globalThis.__hook_import_with ? globalThis.__hook_import_with(String(spec), ${JSON.stringify(filename)}) : Promise.reject(new Error('__hook_import_with not available')));\n`
            const __effectiveUrl = (fetchUrl || `${(globalThis as any).location?.origin || 'http://localhost'}${filename}`)
            const __codePatched = code.replace(/\bimport\.meta\.url\b/g, JSON.stringify(__effectiveUrl))

            console.debug('[WebModuleLoader] executeModule: filename', filename, 'has export?', /\bexport\b/.test(code), 'has marker?', /\/\*__ESM__\*\//.test(code))
            const looksLikeESM = /\/\*__ESM__\*\//.test(code) || /\bexport\b/.test(code)
            if (looksLikeESM) {
                try {
                    console.error('[WebModuleLoader] Using ESM execution path for', filename)
                    const dirname = filename.substring(0, filename.lastIndexOf('/') || 0)
                    const url = fetchUrl || `${(globalThis as any).location?.origin || 'http://localhost'}${filename}`
                        ; (globalThis as any).__relay_meta = { filename, dirname, url }
                    const blob = new Blob([perModuleAlias, __codePatched], { type: 'text/javascript' })
                    const blobUrl = URL.createObjectURL(blob)
                        ; (window as any).__hook_react = context.React

                    const createJsxFactory = (React: any) => {
                        if (!React) return undefined
                        const elementType = (() => {
                            try {
                                if (React && typeof React.createElement === 'function') {
                                    const el = React.createElement('div', null)
                                    if (el && el.$$typeof) return el.$$typeof
                                }
                            } catch { }
                            return Symbol.for('react.element')
                        })()
                        return (type: any, config: any, maybeKey: any) => {
                            let key = null
                            let ref = null
                            let props: any = {}
                            if (maybeKey !== undefined) {
                                key = String(maybeKey)
                            }
                            if (config) {
                                for (let propName in config) {
                                    if (propName === 'key') {
                                        key = String(config.key)
                                    } else if (propName === 'ref') {
                                        ref = config.ref
                                    } else {
                                        props[propName] = config[propName]
                                    }
                                }
                            }
                            if (typeof type === 'string' && context.onElement) {
                                try { context.onElement(type, props) } catch { }
                            }
                            return {
                                '$$typeof': elementType,
                                type,
                                key,
                                ref: ref || null,
                                props
                            }
                        }
                    }
                    const jsxFactory = createJsxFactory(context.React)
                    const fragmentFactory = (context.React && (context.React.Fragment || (context.React as any).Fragment)) ? (context.React.Fragment || (context.React as any).Fragment) : undefined
                        ; (window as any).__hook_jsx_runtime = { jsx: jsxFactory, jsxs: jsxFactory, Fragment: fragmentFactory }
                        ; (window as any).__jsx = jsxFactory
                        ; (window as any).__jsxs = jsxFactory
                        ; (window as any).__Fragment = fragmentFactory
                        ; (window as any).__hook_file_renderer = (context && context.FileRenderer) || null
                        ; (window as any).__hook_helpers = (context && context.helpers) || {}

                    await new Promise(resolve => setTimeout(resolve, 0))
                        ; (window as any).__currentModulePath = filename
                    const dynImport = new Function('u', 'return import(u)')
                    const ns = await dynImport(blobUrl)
                    try {
                        const keys = Object.keys(ns || {})
                        console.debug('[WebModuleLoader] ESM module namespace keys:', keys, 'default type:', typeof (ns && ns.default))
                    } catch { }
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
                    const normalized = ns && ns.default ? { ...ns, default: ns.default } : ns
                    return normalized
                } catch (e) {
                    console.error('[WebModuleLoader] Dynamic import of ES module failed', e)
                    throw e
                }
            }

            const fn = new Function(
                'require',
                'module',
                'exports',
                'context',
                `
try {
  ${perModuleAlias}
  ${__codePatched}
} catch (err) {
  console.error('[WebModuleLoader] Code execution error in ${filename}:', err.message || err);
  throw err;
}
        `
            )

                ; (window as any).__currentModulePath = filename
            fn(
                (spec: string) => {
                    if (spec === 'react') return context.React || {}
                    if (spec === '@clevertree/helpers') return context.helpers || {}
                    if (spec === '@clevertree/file-renderer') return context.FileRenderer || (() => null)
                    if (spec === '@clevertree/layout') return context.Layout || null
                    if (spec === '@clevertree/markdown') return (globalThis as any).__relay_builtins?.['@clevertree/markdown'] || {}
                    if (spec === '@clevertree/theme') return (globalThis as any).__relay_builtins?.['@clevertree/theme'] || {}
                    if (spec === '@clevertree/meta') return (globalThis as any).__relay_meta || { filename: '', dirname: '', url: '' }
                    if (spec === 'react/jsx-runtime') {
                        const r: any = context.React || (globalThis as any).__hook_react || (globalThis as any).React || {}
                        const jsxFactory = (type: any, config: any, maybeKey: any) => {
                            let key = null
                            let ref = null
                            let props: any = {}
                            const elementType = (() => {
                                try {
                                    if (r && typeof (r as any).createElement === 'function') {
                                        const el = (r as any).createElement('div', null)
                                        if (el && (el as any).$$typeof) return (el as any).$$typeof
                                    }
                                } catch { }
                                return Symbol.for('react.element')
                            })()
                            if (maybeKey !== undefined) key = String(maybeKey)
                            if (config) {
                                for (let propName in config) {
                                    if (propName === 'key') key = String(config.key)
                                    else if (propName === 'ref') ref = config.ref
                                    else props[propName] = config[propName]
                                }
                            }
                            return {
                                '$$typeof': elementType,
                                type,
                                key,
                                ref: ref || null,
                                props
                            }
                        }
                        return { jsx: jsxFactory, jsxs: jsxFactory, Fragment: r.Fragment }
                    }
                    return {}
                },
                module,
                exports,
                context
            )

            const createJsxFactory2 = (React: any) => {
                if (!React) return undefined
                const elementType = (() => {
                    try {
                        if (React && typeof React.createElement === 'function') {
                            const el = React.createElement('div', null)
                            if (el && el.$$typeof) return el.$$typeof
                        }
                    } catch { }
                    return Symbol.for('react.element')
                })()
                return (type: any, config: any, maybeKey: any) => {
                    let key = null
                    let ref = null
                    let props: any = {}
                    if (maybeKey !== undefined) key = String(maybeKey)
                    if (config) {
                        for (let propName in config) {
                            if (propName === 'key') key = String(config.key)
                            else if (propName === 'ref') ref = config.ref
                            else props[propName] = config[propName]
                        }
                    }
                    if (typeof type === 'string' && context.onElement) {
                        try { context.onElement(type, props) } catch { }
                    }
                    return {
                        '$$typeof': elementType,
                        type,
                        key,
                        ref: ref || null,
                        props
                    }
                }
            }
            const jsxFactory2 = createJsxFactory2(context.React)
            const fragmentFactory = context.React?.Fragment
            if (!(globalThis as any).__hook_jsx_runtime) {
                ; (globalThis as any).__hook_jsx_runtime = { jsx: jsxFactory2, jsxs: jsxFactory2, Fragment: fragmentFactory }
            }
            if (!(globalThis as any).__jsx && jsxFactory2) {
                ; (globalThis as any).__jsx = jsxFactory2
                    ; (globalThis as any).__jsxs = jsxFactory2
            }
            if (!(globalThis as any).__Fragment && fragmentFactory) {
                ; (globalThis as any).__Fragment = fragmentFactory
            }

            const mod = module.exports
            if (isMainHook && (!mod || typeof mod.default !== 'function')) {
                if (mod && (typeof mod === 'object' || typeof mod === 'function')) {
                    return mod
                }
                throw new Error('Hook module does not export a default function')
            }
            return mod
        } finally {
            setTimeout(() => {
                delete (window as any).__ctx__
                try { delete (window as any).__hook_import } catch { }
                delete (window as any).__currentModulePath
            }, 500)
        }
    }
}

export function createHookReact(reactModule: any, onElement?: (tag: string, props: any) => void) {
    if (!reactModule) return undefined
    const baseCreate = reactModule.createElement.bind(reactModule)
    function hookCreateElement(type: any, props: any, ...children: any[]) {
        if (typeof type === 'string' && onElement) {
            try { onElement(type, props || undefined) } catch (e) { }
        }
        return baseCreate(type, props, ...children)
    }
    return { ...reactModule, createElement: hookCreateElement }
}

export async function transpileCode(
    code: string,
    options: TransformOptions,
    _toCommonJs: boolean = false
): Promise<string> {
    const filename = options.filename || 'module.tsx'
    const g: any = (typeof globalThis !== 'undefined' ? (globalThis as any) : {})
    const wasmTranspile: any = g.__hook_transpile_jsx
    const version = g.__hook_transpiler_version || 'unknown'

    if (typeof wasmTranspile !== 'function') {
        const availableKeys = Object.keys(g).filter(k => k.startsWith('__')).join(', ')
        console.error('[transpileCode] WASM not ready:', {
            hasGlobalThis: typeof globalThis !== 'undefined',
            hasHook: '__hook_transpile_jsx' in g,
            type: typeof wasmTranspile,
            globalKeys: availableKeys || '(none)'
        })
        throw new Error(`HookTranspiler WASM not loaded (v${version}): expected globalThis.__hook_transpile_jsx(source, filename)`)
    }

    let out: any;
    try {
        out = await wasmTranspile(code, filename, options.isTypescript)
    } catch (callError) {
        console.error('[transpileCode] WASM call threw exception:', callError)
        throw callError
    }

    let transpiledCode: string;
    if (typeof out === 'object' && out !== null) {
        if (out.error) {
            const errorMsg = `TranspileError: ${filename}: ${out.error} (v${version})`
            console.error('[transpileCode] JSX transpilation failed:', { filename, inputSize: code.length, errorMessage: errorMsg })
                ; (globalThis as any).__lastTranspiledCode = null
                ; (globalThis as any).__lastTranspileError = errorMsg
            throw new Error(errorMsg)
        }
        if (!out.code) {
            throw new Error(`HookTranspiler returned empty code for ${filename}`)
        }
        transpiledCode = out.code
    } else if (typeof out === 'string') {
        transpiledCode = out
    } else {
        throw new Error(`HookTranspiler returned unexpected type: ${typeof out}`)
    }

    ; (globalThis as any).__lastTranspiledCode = transpiledCode
    return applyHookRewrite(transpiledCode + `\n//# sourceURL=${filename}`)
}

function parseStaticImports(code: string): Array<{ statement: string; specifier: string; bindings: string; isDefault: boolean; isNamespace: boolean }> {
    const imports: Array<any> = []
    const importRe = /import\s+((?:[^"']+)\s+from\s+)?['"]([^"']+)['"]\s*;?/g
    let match
    while ((match = importRe.exec(code)) !== null) {
        const statement = match[0]
        const beforeFrom = match[1] || ''
        const specifier = match[2]
        if (specifier.startsWith('@clevertree/') || specifier === 'react' || specifier === 'react/jsx-runtime') continue
        if (!specifier.startsWith('./') && !specifier.startsWith('../') && !specifier.startsWith('/')) continue
        let bindings = beforeFrom.replace(/\s+from\s*$/, '').trim()
        let isDefault = false
        let isNamespace = false
        if (/^\*\s+as\s+\w+$/.test(bindings)) {
            isNamespace = true
        } else if (bindings && !bindings.includes('{')) {
            isDefault = true
        }
        imports.push({ statement, specifier, bindings, isDefault, isNamespace })
    }
    return imports
}

async function resolveStaticImports(code: string, filename: string, context: HookContext): Promise<string> {
    const imports = parseStaticImports(code)
    if (imports.length === 0) return code
    const loadModule = context?.helpers?.loadModule
    if (!loadModule) return code
    const modules = new Map<string, any>()
    await Promise.all(
        imports.map(async (imp) => {
            const mod = await loadModule(imp.specifier, filename)
            modules.set(imp.specifier, mod)
        })
    )
    let rewritten = code
    for (const imp of imports) {
        const mod = modules.get(imp.specifier)
        const varName = `__import_${Math.random().toString(36).substr(2, 9)}`
            ; (globalThis as any)[varName] = mod
        let replacement = ''
        if (imp.isNamespace) {
            const nsName = imp.bindings.replace(/^\*\s+as\s+/, '')
            replacement = `const ${nsName} = globalThis.${varName};`
        } else if (imp.isDefault) {
            const defaultName = imp.bindings.split(',')[0].trim()
            replacement = `const ${defaultName} = (globalThis.${varName}?.default || globalThis.${varName});`
        } else {
            const destructure = imp.bindings.replace(/^\{|\}$/g, '').trim().replace(/\bas\b/g, ':')
            replacement = `const { ${destructure} } = (globalThis.${varName} || {});`
        }
        rewritten = rewritten.replace(imp.statement, replacement)
    }
    return rewritten
}

function rewriteDynamicImports(code: string): string {
    try {
        return code.replace(/\bimport\s*\(/g, '__hook_import(')
    } catch {
        return code
    }
}

export function applyHookRewrite(code: string): string {
    const mkBuiltin = (spec: string, destructure: string) => `const ${destructure} = ((globalThis && globalThis.__relay_builtins && globalThis.__relay_builtins['${spec}']) || {});`
    const markdownRe = /import\s+\{\s*MarkdownRenderer\s*\}\s+from\s+['"]@clevertree\/markdown['"];?/g
    const themeRe = /import\s+\{\s*registerThemesFromYaml\s*\}\s+from\s+['"]@clevertree\/theme['"];?/g
    const metaRe = /import\s+(\w+)\s+from\s+['"]@clevertree\/meta['"];?/g
    const metaStarRe = /import\s*\*\s*as\s+(\w+)\s+from\s+['"]@clevertree\/meta['"];?/g
    const metaDestructureRe = /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]@clevertree\/meta['"];?/g
    const reactRe = /import\s+React\s*(?:,\s*\{([^}]+)\})?\s+from\s+['"]react['"];?/g
    const reactNamedOnlyRe = /import\s+\{([^}]+)\}\s+from\s+['"]react['"];?/g
    const reactStarRe = /import\s*\*\s*as\s+React\s+from\s+['"]react['"];?/g
    const jsxRuntimeRe = /import\s+\{\s*jsx\s+as\s+(_jsx)\s*,\s*jsxs\s+as\s+(_jsxs)\s*,\s*Fragment\s+as\s+(_Fragment)\s*\}\s+from\s+['"]react\/jsx-runtime['"];?/g
    let rewritten = code.replace(markdownRe, mkBuiltin('@clevertree/markdown', '{ MarkdownRenderer }'))
    rewritten = rewritten.replace(themeRe, mkBuiltin('@clevertree/theme', '{ registerThemesFromYaml }'))
    rewritten = rewritten.replace(reactRe, (_m, named) => {
        let res = 'const React = (globalThis.__hook_react || globalThis.React);'
        if (named) res += ` const { ${named} } = React;`
        return res
    })
    rewritten = rewritten.replace(reactNamedOnlyRe, (_m, named) => `const { ${named} } = (globalThis.__hook_react || globalThis.React);`)
    rewritten = rewritten.replace(reactStarRe, 'const React = (globalThis.__hook_react || globalThis.React);')
    rewritten = rewritten.replace(metaRe, (_m, name) => `const ${name} = (globalThis.__relay_meta || { filename: '', dirname: '', url: '' });`)
    rewritten = rewritten.replace(metaStarRe, (_m, name) => `const ${name} = (globalThis.__relay_meta || { filename: '', dirname: '', url: '' });`)
    rewritten = rewritten.replace(metaDestructureRe, (_m, destructure) => `const { ${destructure} } = (globalThis.__relay_meta || { filename: '', dirname: '', url: '' });`)
    rewritten = rewritten.replace(jsxRuntimeRe, (_m, a, b, c) => `const ${a} = (globalThis.__hook_jsx_runtime?.jsx || globalThis.__jsx || (globalThis.__hook_react && globalThis.__hook_react.createElement) || (() => null)); const ${b} = (globalThis.__hook_jsx_runtime?.jsxs || globalThis.__jsxs || (globalThis.__hook_react && globalThis.__hook_react.createElement) || (() => null)); const ${c} = (globalThis.__hook_jsx_runtime?.Fragment || globalThis.__Fragment || (globalThis.__hook_react && globalThis.__hook_react.Fragment));`)

    return rewritten
}

export function looksLikeTsOrJsx(code: string, filename: string): boolean {
    const hasPragma = /@use-jsx|@use-ts|@jsx\s+h/m.test(code)
    const hasJsxSyntax = /<([A-Za-z][A-Za-z0-9]*)\s/.test(code)
    const isTypescriptExt = filename.endsWith('.tsx') || filename.endsWith('.ts') || filename.endsWith('.jsx')
    return hasPragma || hasJsxSyntax || isTypescriptExt
}

export interface HookLoaderOptions {
    host: string
    protocol: 'http' | 'https'
    moduleLoader: ModuleLoader
    transpiler?: (code: string, filename: string) => Promise<string>
    onDiagnostics?: (diag: LoaderDiagnostics) => void
}

export class HookLoader {
    private host: string
    private protocol: 'http' | 'https'
    private moduleLoader: ModuleLoader
    private transpiler?: (code: string, filename: string) => Promise<string>
    private onDiagnostics: (diag: LoaderDiagnostics) => void
    private moduleCache: Map<string, any> = new Map()
    private pendingFetches: Map<string, Promise<any>> = new Map()
    private logTranspileResult(filename: string, code: string): void {
        const containsExport = /\bexport\b/.test(code)
        const sample = code.substring(0, 200).replace(/\n/g, '\\n')
        const logger = containsExport ? console.warn : console.debug
        logger(`[HookLoader] Transpiler output for ${filename} (contains export=${containsExport}, len=${code.length})`, sample)
    }

    constructor(options: HookLoaderOptions) {
        this.host = options.host
        this.protocol = options.protocol
        this.moduleLoader = options.moduleLoader
        this.transpiler = options.transpiler
        this.onDiagnostics = options.onDiagnostics || (() => { })
    }

    private buildRequestHeaders(context: HookContext): Record<string, string> {
        const builder = context?.helpers?.buildRepoHeaders
        if (!builder) return {}
        return { ...builder() }
    }

    private normalizeToAbsolutePath(modulePath: string, fromPath: string): string {
        let normalized = modulePath

        try {
            if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
                const baseDir = fromPath.substring(0, fromPath.lastIndexOf('/')) || '/hooks/client'
                normalized = new URL(modulePath, `http://localhost${baseDir}/`).pathname
            } else if (!modulePath.startsWith('/')) {
                normalized = `/hooks/client/${modulePath}`
            } else {
                normalized = modulePath
            }
        } catch (_) {
            // Fallback: manual path resolution
            const baseDir = fromPath.substring(0, fromPath.lastIndexOf('/')) || '/hooks/client'
            if (modulePath.startsWith('./')) {
                normalized = `${baseDir}/${modulePath.slice(2)}`
            } else if (modulePath.startsWith('../')) {
                const parts = modulePath.split('/')
                let current = baseDir.split('/').filter(Boolean)
                for (const part of parts) {
                    if (part === '..') current.pop()
                    else if (part !== '.') current.push(part)
                }
                normalized = '/' + current.join('/')
            } else if (!modulePath.startsWith('/')) {
                normalized = `/hooks/client/${modulePath}`
            } else {
                normalized = modulePath
            }
        }

        // Remove redundant './' and '../' segments
        const parts = normalized.split('/').filter(Boolean)
        const resolved: string[] = []
        for (const part of parts) {
            if (part === '..') resolved.pop()
            else if (part !== '.') resolved.push(part)
        }

        return '/' + resolved.join('/')
    }

    async loadModule(modulePath: string, fromPath: string = '/hooks/client/get-client.jsx', context: HookContext): Promise<any> {
        try { console.error('[HookLoader] loadModule called:', { modulePath, fromPath }) } catch { }

        // Normalize path early for consistent cache key
        const normalizedPath = this.normalizeToAbsolutePath(modulePath, fromPath)
        const cacheKey = `${this.host}:${normalizedPath}`

        // Check completed module cache first
        if (this.moduleCache.has(cacheKey)) {
            console.error('[HookLoader] Module cache HIT:', cacheKey)
            return this.moduleCache.get(cacheKey)
        }

        // Check if fetch is already in progress
        if (this.pendingFetches.has(cacheKey)) {
            console.error('[HookLoader] Pending fetch HIT (avoiding duplicate):', cacheKey)
            return this.pendingFetches.get(cacheKey)!
        }

        // Start new fetch and cache the promise
        console.error('[HookLoader] Starting NEW fetch:', cacheKey)
        const fetchPromise = this._doLoadModule(normalizedPath, context, cacheKey)
        this.pendingFetches.set(cacheKey, fetchPromise)

        try {
            const result = await fetchPromise
            this.moduleCache.set(cacheKey, result)
            return result
        } finally {
            this.pendingFetches.delete(cacheKey)
        }
    }

    private async _doLoadModule(normalizedPath: string, context: HookContext, cacheKey: string): Promise<any> {

        const requestHeaders = this.buildRequestHeaders(context)
        const fetchOptions = Object.keys(requestHeaders).length ? { headers: requestHeaders } : undefined

        // Build fetch attempts with extension fallbacks while preserving query/hash
        const buildAttempts = (pathIn: string): string[] => {
            const q = pathIn.indexOf('?')
            const h = pathIn.indexOf('#')
            const cut = (q >= 0 && h >= 0) ? Math.min(q, h) : (q >= 0 ? q : h)
            const suffix = cut >= 0 ? pathIn.slice(cut) : ''
            const basePath = cut >= 0 ? pathIn.slice(0, cut) : pathIn
            const last = basePath.split('/').pop() || ''
            const hasExt = last.includes('.')
            const attempts: string[] = []
            attempts.push(basePath + suffix)
            if (!hasExt) {
                attempts.push(basePath + '.js' + suffix)
                const dirname = basePath.includes('/') ? basePath.slice(0, basePath.lastIndexOf('/')) : '.'
                attempts.push(dirname + '/index.js' + suffix)
            }
            return attempts
        }

        try {
            let lastErr: any = null
            let code: string | null = null
            let moduleUrl: string | null = null
            const attempts = buildAttempts(normalizedPath)
            console.error('[HookLoader._doLoadModule] Fetch attempts:', { normalizedPath, attempts })
            for (const candidate of attempts) {
                const url = `${this.protocol}://${this.host}${candidate}`
                console.error('[HookLoader] Loop iteration for candidate:', candidate, 'total attempts:', attempts.length)
                try {
                    console.error('[HookLoader.loadModule] Trying:', url)
                    const response = await fetch(url, fetchOptions)
                    if (!response.ok) { lastErr = new Error(`ModuleLoadError: ${url} → ${response.status} ${response.statusText}`); console.error('[HookLoader.loadModule] Not OK, continuing'); continue }
                    const ct = (response.headers.get('content-type') || '').toLowerCase()
                    if (ct.includes('text/html')) { lastErr = new Error(`ModuleLoadError: ${url} returned HTML (content-type=${ct})`); console.error('[HookLoader.loadModule] HTML response, continuing'); continue }
                    code = await response.text()
                    console.error('[HookLoader.loadModule] Fetched', candidate, 'got', code.length, 'bytes')
                    moduleUrl = url
                    console.error('[HookLoader.loadModule] Success:', url, 'code length:', code.length)
                    break
                } catch (e) {
                    lastErr = e
                    console.error('[HookLoader.loadModule] Fetch error, continuing:', e)
                    continue
                }
            }
            if (!code || !moduleUrl) throw lastErr || new Error(`ModuleLoadError: ${this.protocol}://${this.host}${normalizedPath}`)
            console.error('[HookLoader.loadModule] After loop:', { codeLengthOrNull: code ? code.length : null, moduleUrl })

            let preprocessedCode = code
            try {
                preprocessedCode = await resolveStaticImports(code, normalizedPath, context)
            } catch (resolveErr) {
                console.warn('[RuntimeLoader] Static import resolution failed:', resolveErr)
            }

            let finalCode = preprocessedCode
            const esmHint = /\bexport\s+default\b/.test(preprocessedCode) || /\bimport\s*\(/.test(preprocessedCode)
            const shouldTranspile = !!this.transpiler || looksLikeTsOrJsx(preprocessedCode, normalizedPath)
            if (shouldTranspile) {
                try {
                    if (this.transpiler) {
                        finalCode = await this.transpiler(preprocessedCode, normalizedPath)
                        this.logTranspileResult(normalizedPath, finalCode)
                    } else {
                        finalCode = await transpileCode(preprocessedCode, { filename: normalizedPath }, false)
                    }
                } catch (err) {
                    const msg = (err as any)?.message || String(err)
                    const diag: LoaderDiagnostics = { phase: 'transform', error: msg, details: { moduleUrl, filename: normalizedPath, ...(err as any) } }
                    this.onDiagnostics(diag)
                    throw new Error(`TranspileError: ${normalizedPath}: ${msg}`)
                }
            }
            // Always rewrite dynamic import() to our per-module alias for predictable resolution
            finalCode = rewriteDynamicImports(finalCode)
            if (esmHint) finalCode = `/*__ESM__*/\n` + finalCode

            let mod: any
            try {
                mod = await this.moduleLoader.executeModule(finalCode, normalizedPath, context, moduleUrl, false)
                try {
                    const keys = Object.keys(mod || {})
                    console.error('[HookLoader] Loaded module', normalizedPath, 'keys:', keys, 'default type:', typeof (mod && mod.default))
                } catch { }
            } catch (execErr) {
                const execMsg = (execErr as any)?.message || String(execErr)
                const syntaxMatch = execMsg.match(/Unexpected token|missing \)|SyntaxError/)
                const diag: LoaderDiagnostics = { phase: 'import', error: execMsg, details: { filename: normalizedPath, isSyntaxError: !!syntaxMatch, transpilerVersion: (globalThis as any).__hook_transpiler_version || 'unknown' } }
                console.error('[RuntimeLoader] Module execution failed:', { filename: normalizedPath, error: execMsg, isSyntaxError: !!syntaxMatch, transpilerVersion: (globalThis as any).__hook_transpiler_version })
                this.onDiagnostics(diag)
                throw execErr
            }
            return mod
        } catch (err) {
            console.error('[HookLoader._doLoadModule] Failed:', normalizedPath, err)
            throw err
        }
    }

    async loadAndExecuteHook(hookPath: string, context: HookContext): Promise<any> {
        const diag: LoaderDiagnostics = { phase: 'init' }
        try {
            diag.phase = 'fetch'
            const hookUrl = `${this.protocol}://${this.host}${hookPath}`
            console.debug(`[HookLoader] Fetching hook from: ${hookUrl}`)
            const requestHeaders = this.buildRequestHeaders(context)
            const fetchOptions = Object.keys(requestHeaders).length ? { headers: requestHeaders } : undefined
            let response: Response
            let code: string
            try {
                response = await fetch(hookUrl, fetchOptions)
                code = await response.text()
            } catch (fetchErr) {
                console.error('[HookLoader] Fetch failed, got error immediately:', fetchErr)
                throw fetchErr
            }
            console.debug(`[HookLoader] Received hook code (${code.length} chars)`)
            diag.fetch = { status: response.status, ok: response.ok, contentType: response.headers.get('content-type') }
            if (!response.ok) throw new Error(`ModuleLoadError: ${hookUrl} → ${response.status} ${response.statusText}`)
            const ct = (response.headers.get('content-type') || '').toLowerCase()
            if (ct.includes('text/html')) throw new Error(`ModuleLoadError: ${hookUrl} returned HTML (content-type=${ct})`)
            diag.codeLength = code.length

            console.error(`[HookLoader] About to resolve static imports for ${hookPath}`)
            code = await resolveStaticImports(code, hookPath, context)
            console.error(`[HookLoader] Static imports resolved for ${hookPath}`)

            diag.phase = 'transform'
            let finalCode = code
            const esmHint = /\bexport\s+default\b/.test(code) || /\bimport\s*\(/.test(code)
            const shouldTranspile = !!this.transpiler || looksLikeTsOrJsx(code, hookPath)
            if (shouldTranspile) {
                try {
                    console.debug(`[HookLoader] Transpiling ${hookPath}`)
                    if (this.transpiler) {
                        finalCode = await this.transpiler(code, hookPath)
                        this.logTranspileResult(hookPath, finalCode)
                    } else {
                        finalCode = await transpileCode(code, { filename: hookPath, hasJsxPragma: /@jsx\s+h/m.test(code) }, false)
                    }
                    console.debug(`[HookLoader] Transpilation complete (${finalCode.length} chars)`)
                } catch (err) {
                    const msg = (err as any)?.message || String(err)
                    console.warn('[HookLoader] JSX transpilation failed', { hookPath, error: msg })
                    diag.transpileWarn = msg
                    diag.details = { ...(diag.details || {}), filename: hookPath }
                    diag.error = msg
                    this.onDiagnostics(diag)
                    throw new Error(`TranspileError: ${hookPath}: ${msg}`)
                }
            }
            // Always rewrite dynamic import() to our per-module alias for predictable resolution
            finalCode = rewriteDynamicImports(finalCode)
            if (esmHint) finalCode = `/*__ESM__*/\n` + finalCode

            try {
                const sample = finalCode.slice(0, 200)
                const hasExport = /\bexport\b/.test(finalCode)
                const hasMarker = /\/\*__ESM__\*\//.test(finalCode)
                console.error('[HookLoader] Final code ESM hint:', { esmHint, hasExport, hasMarker, sample })
            } catch { }

            diag.phase = 'import'
            console.debug(`[HookLoader] Executing hook module`)
            try {
                const mod = await this.moduleLoader.executeModule(finalCode, hookPath, context, hookUrl, true)
                if (!mod || typeof mod.default !== 'function') throw new Error('Hook module does not export a default function')
                diag.phase = 'exec'
                console.debug(`[HookLoader] Rendering hook component`)
                const Comp: any = mod.default
                const createEl = (context && context.createElement) || (context && context.React && context.React.createElement)
                if (typeof createEl !== 'function') throw new Error('React createElement not available')
                const element = createEl(Comp, context)
                console.debug(`[HookLoader] Hook component element created`)
                return element
            } catch (execErr) {
                console.error('[HookLoader] Hook execution error:', execErr)
                throw execErr
            }
        } catch (err) {
            diag.error = err instanceof Error ? err.message : String(err)
            diag.stack = err instanceof Error ? err.stack : undefined
            console.error('[HookLoader] Error during loadAndExecuteHook:', diag)
            this.onDiagnostics(diag)
            throw err
        }
    }

    clearCache(): void { 
        this.moduleCache.clear() 
        this.pendingFetches.clear()
    }
}
