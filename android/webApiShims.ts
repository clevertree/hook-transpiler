/**
 * Web API Shims for Android QuickJS
 * 
 * Provides minimal polyfills for missing Web APIs that hooks might use.
 * 
 * IMPORTANT: 
 * - fetch() is already installed by native Android QuickJSManager - DO NOT override it here
 * - URL and URLSearchParams may be missing from QuickJS - install polyfills if needed
 * - Timers (setTimeout/setInterval) must be provided by host - verify they exist
 */

export interface WebApiShimOptions {
    /** Verify timers exist; throw if missing */
    requireTimers?: boolean
    /** Debug logging */
    debug?: boolean
}

class URLSearchParamsShim {
    private _entries: Array<[string, string]> = []

    constructor(init?: string | Record<string, string> | Array<[string, string]>) {
        if (!init) return
        if (typeof init === 'string') {
            const parts = init.split('&')
            for (const part of parts) {
                const idx = part.indexOf('=')
                const key = idx >= 0 ? decodeURIComponent(part.substring(0, idx)) : decodeURIComponent(part)
                const value = idx >= 0 ? decodeURIComponent(part.substring(idx + 1)) : ''
                this._entries.push([key, value])
            }
        } else if (Array.isArray(init)) {
            this._entries = [...init]
        } else {
            for (const [key, value] of Object.entries(init)) {
                this._entries.push([key, value])
            }
        }
    }

    append(name: string, value: string): void {
        this._entries.push([name, value])
    }

    delete(name: string): void {
        this._entries = this._entries.filter(([k]) => k !== name)
    }

    get(name: string): string | null {
        const entry = this._entries.find(([k]) => k === name)
        return entry ? entry[1] : null
    }

    getAll(name: string): string[] {
        return this._entries.filter(([k]) => k === name).map(([, v]) => v)
    }

    has(name: string): boolean {
        return this._entries.some(([k]) => k === name)
    }

    set(name: string, value: string): void {
        this.delete(name)
        this.append(name, value)
    }

    sort(): void {
        this._entries.sort(([a], [b]) => a.localeCompare(b))
    }

    forEach(callback: (value: string, key: string) => void): void {
        for (const [key, value] of this._entries) {
            callback(value, key)
        }
    }

    keys(): IterableIterator<string> {
        return this._entries.map(([k]) => k)[Symbol.iterator]()
    }

    values(): IterableIterator<string> {
        return this._entries.map(([, v]) => v)[Symbol.iterator]()
    }

    entries(): IterableIterator<[string, string]> {
        return this._entries[Symbol.iterator]()
    }

    [Symbol.iterator](): IterableIterator<[string, string]> {
        return this._entries[Symbol.iterator]()
    }

    toString(): string {
        return this._entries.map(([k, v]: [string, string]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    }
}

export function installWebApiShims(options: WebApiShimOptions = {}): void {
    const { requireTimers = true, debug = false } = options

    if (typeof (globalThis as any).fetch !== 'function') {
        console.warn('[webApiShims] fetch not found - QuickJS environment may not be fully initialized. Ensure Kotlin QuickJSManager runs first.')
    }

    if (typeof (globalThis as any).URL !== 'function') {
        if (debug) console.log('[webApiShims] Installing URL shim')
        console.warn('[webApiShims] URL is not available in this QuickJS instance. Hooks cannot use new URL(). Provide a host implementation.')
    }

    if (typeof (globalThis as any).URLSearchParams !== 'function') {
        if (debug) console.log('[webApiShims] Installing URLSearchParams shim')
            ; (globalThis as any).URLSearchParams = URLSearchParamsShim
    }

    if (requireTimers) {
        if (typeof globalThis.setTimeout !== 'function') {
            throw new Error('[webApiShims] setTimeout is required but not found. Ensure host provides timer implementation.')
        }
        if (typeof globalThis.setInterval !== 'function') {
            console.warn('[webApiShims] setInterval not found. Some hooks may fail if they use setInterval.')
        }
    }

    if (debug) {
        console.log('[webApiShims] Installation complete')
    }
}
