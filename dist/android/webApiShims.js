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
class URLSearchParamsShim {
    constructor(init) {
        this._entries = [];
        if (!init)
            return;
        if (typeof init === 'string') {
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
export function installWebApiShims(options = {}) {
    const { requireTimers = true, debug = false } = options;
    if (typeof globalThis.fetch !== 'function') {
        console.warn('[webApiShims] fetch not found - QuickJS environment may not be fully initialized. Ensure Kotlin QuickJSManager runs first.');
    }
    if (typeof globalThis.URL !== 'function') {
        if (debug)
            console.log('[webApiShims] Installing URL shim');
        console.warn('[webApiShims] URL is not available in this QuickJS instance. Hooks cannot use new URL(). Provide a host implementation.');
    }
    if (typeof globalThis.URLSearchParams !== 'function') {
        if (debug)
            console.log('[webApiShims] Installing URLSearchParams shim');
        globalThis.URLSearchParams = URLSearchParamsShim;
    }
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