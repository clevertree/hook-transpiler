/**
 * ES6 Import Handler for Android
 *
 * Provides runtime support for ES6 dynamic import() calls in Android.
 * Allows hooks to use modern ES6 import syntax instead of CommonJS require().
 *
 * Usage in hook code:
 *   const Utils = await import('./utils.mjs')
 *   const { formatDate } = await import('@clevertree/shared')
 */
export interface ImportHandlerOptions {
    host: string;
    protocol?: 'http' | 'https';
    baseUrl?: string;
    onDiagnostics?: (diag: any) => void;
    transpiler?: (code: string, filename: string) => Promise<string>;
}
/**
 * ES6 Import Handler - manages dynamic module loading for hooks
 */
export declare class ES6ImportHandler {
    private moduleCache;
    private transpiling;
    private host;
    private protocol;
    private baseUrl;
    private onDiagnostics;
    private transpiler;
    private currentModulePath;
    private executionContext;
    private loadModuleDelegate;
    constructor(options: ImportHandlerOptions);
    /**
     * Allow the host to delegate import() to a provided loader (e.g., helpers.loadModule)
     */
    setLoadModuleDelegate(delegate: (modulePath: string, fromPath?: string | null, ctx?: any) => Promise<any>): void;
    /**
     * Inform the handler of the currently executing module path so relative imports resolve correctly
     */
    setCurrentModulePath(path: string | null): void;
    /**
     * Provide the current execution context so a delegate can use it
     */
    setExecutionContext(ctx: any): void;
    /**
     * Default transpiler
     */
    private defaultTranspiler;
    /**
     * Handle import() calls from hook code
     * Called as: const mod = await __import__('./utils.mjs')
     */
    handle(modulePath: string): Promise<any>;
    /**
     * Fetch, transpile, and execute a module
     */
    private loadAndTranspile;
    /**
     * Execute module code with ES6 import support
     */
    private executeModule;
    /**
     * Normalize a module path to absolute path
     */
    private normalizePath;
    /**
     * Clear the module cache (useful for development/hot reload)
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        entries: string[];
    };
}
