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
/**
 * Minimal URLSearchParams shim for QuickJS
 * Only required if not already available in host environment
 */
class URLSearchParamsShim {
    constructor(init) {
        this._entries = [];
        if (!init)
            return;
        if (typeof init === 'string') {
            // Parse query string
            const parts = init.split('&');
            for (const part of parts) {
                const idx = part.indexOf('=');
                const key = idx >= 0 ? decodeURIComponent(part.substring(0, idx)) : decodeURIComponent(part);
                const value = idx >= 0 ? decodeURIComponent(part.substring(idx + 1)) : '';
                this._entries.push([key, value]);
            }
        }
        else if (Array.isArray(init)) {
            this._entries = [...init];
        }
        else {
            for (const [key, value] of Object.entries(init)) {
                this._entries.push([key, value]);
            }
        }
    }
    append(name, value) {
        this._entries.push([name, value]);
    }
    delete(name) {
        this._entries = this._entries.filter(([k]) => k !== name);
    }
    get(name) {
        const entry = this._entries.find(([k]) => k === name);
        return entry ? entry[1] : null;
    }
    getAll(name) {
        return this._entries.filter(([k]) => k === name).map(([, v]) => v);
    }
    has(name) {
        return this._entries.some(([k]) => k === name);
    }
    set(name, value) {
        this.delete(name);
        this.append(name, value);
    }
    sort() {
        this._entries.sort(([a], [b]) => a.localeCompare(b));
    }
    forEach(callback) {
        for (const [key, value] of this._entries) {
            callback(value, key);
        }
    }
    keys() {
        return this._entries.map(([k]) => k)[Symbol.iterator]();
    }
    values() {
        return this._entries.map(([, v]) => v)[Symbol.iterator]();
    }
    entries() {
        return this._entries[Symbol.iterator]();
    }
    [Symbol.iterator]() {
        return this._entries[Symbol.iterator]();
    }
    toString() {
        return this._entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    }
}
/**
 * Install Web API shims for Android QuickJS
 *
 * Note: This function does NOT install fetch - fetch is already provided by native QuickJSManager
 * This only installs URL/URLSearchParams shims if missing, and verifies timers exist.
 */
export function installWebApiShims(options = {}) {
    const { requireTimers = true, debug = false } = options;
    // Verify fetch is already available (injected by native code)
    if (typeof globalThis.fetch !== 'function') {
        console.warn('[webApiShims] fetch not found - QuickJS environment may not be fully initialized. Ensure Kotlin QuickJSManager runs first.');
    }
    // Install URL shim if missing
    if (typeof globalThis.URL !== 'function') {
        if (debug)
            console.log('[webApiShims] Installing URL shim');
        // QuickJS may have built-in URL; if not, this would need a more complete implementation
        console.warn('[webApiShims] URL is not available in this QuickJS instance. Hooks cannot use new URL(). Provide a host implementation.');
    }
    // Install URLSearchParams shim if missing
    if (typeof globalThis.URLSearchParams !== 'function') {
        if (debug)
            console.log('[webApiShims] Installing URLSearchParams shim');
        globalThis.URLSearchParams = URLSearchParamsShim;
    }
    // Verify timers exist
    if (requireTimers) {
        if (typeof globalThis.setTimeout !== 'function') {
            throw new Error('[webApiShims] setTimeout is required but not found. Ensure host provides timer implementation.');
        }
        if (typeof globalThis.setInterval !== 'function') {
            console.warn('[webApiShims] setInterval not found. Some hooks may fail if they use setInterval.');
        }
    }
    if (debug) {
        console.log('[webApiShims] Installation complete');
    }
}
//# sourceMappingURL=webApiShims.js.map