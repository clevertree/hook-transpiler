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
    requireTimers?: boolean;
    /** Debug logging */
    debug?: boolean;
}
/**
 * Install Web API shims for Android QuickJS
 *
 * Note: This function does NOT install fetch - fetch is already provided by native QuickJSManager
 * This only installs URL/URLSearchParams shims if missing, and verifies timers exist.
 */
export declare function installWebApiShims(options?: WebApiShimOptions): void;
