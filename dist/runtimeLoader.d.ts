/**
 * Unified Runtime Loader for Relay Hooks
 *
 * Provides a shared interface for loading and transpiling TS/TSX/JSX hooks
 * across both web and Android clients. Abstracts away platform-specific
 * module execution (browser import vs Android eval).
 */
import { ES6ImportHandler } from './es6ImportHandler.js';
/**
 * Global declarations for Relay Hook Environment
 */
declare global {
    var __hook_transpile_jsx: ((code: string, filename: string, isTypescript?: boolean) => any) | undefined;
    var __hook_transpiler_version: string | undefined;
    var __relay_builtins: Record<string, any> | undefined;
    var __currentModulePath: string | undefined;
    var __relay_meta: {
        filename: string;
        dirname: string;
        url: string;
    } | undefined;
}
/**
 * Unified bridge interface for themed-styler
 */
export interface UnifiedBridge {
    registerUsage(tag: string, props?: Record<string, unknown>): void;
    clearUsage(): void;
    getUsageSnapshot(): any;
    registerTheme(name: string, defs?: Record<string, unknown>): void;
    setCurrentTheme(name: string): void;
    getThemes(): any;
    getThemeList(): string[];
    getCssForWeb(): string;
    getRnStyles(): any;
    loadThemesFromYamlUrl(url: string): Promise<void>;
    loadThemesFromYamlText(text: string): Promise<void>;
    transpile(code: string, filename?: string): Promise<any>;
    getTranspilerVersion(): string | null;
}
/**
 * Style manager interface for themed-styler
 */
export interface StyleManager {
    ensureStyleElement(): any;
    renderCssIntoDom(): void;
    tearDownStyleElement(): void;
    startAutoSync(pollInterval?: number): void;
    stopAutoSync(): void;
    requestRender(): void;
    onChange(cb: (ev?: any) => void): () => void;
    wrapCreateElement(reactModule: any): any;
    useStyleManager(cb?: (ev?: any) => void): {
        requestRender: () => void;
        renderCssIntoDom: () => void;
    };
}
/**
 * Babel transform configuration for hook modules
 */
export interface TransformOptions {
    filename: string;
    hasJsxPragma?: boolean;
    development?: boolean;
    isTypescript?: boolean;
}
/**
 * Result of transpiling code to CommonJS (used in Android)
 */
export interface TransformResult {
    code: string;
    sourceMaps?: string;
}
/**
 * Context passed to executed hooks
 */
export type ComponentType<P = any> = (props: P) => any;
export interface HookContext {
    React: any;
    createElement: any;
    FileRenderer: ComponentType<{
        path: string;
    }>;
    Layout?: ComponentType<any>;
    params?: Record<string, any>;
    helpers: HookHelpers;
    onElement?: (tag: string, props: any) => void;
    [key: string]: any;
}
/**
 * Helper functions available to hooks
 */
export interface HookHelpers {
    navigate?: never;
    buildPeerUrl: (path: string) => string;
    loadModule: (modulePath: string, fromPath?: string) => Promise<any>;
    setBranch?: (branch: string) => void;
    buildRepoHeaders?: (branch?: string, repo?: string) => Record<string, string>;
    registerThemeStyles?: (themeName: string, definitions?: Record<string, unknown>) => void;
    registerThemesFromYaml?: (path: string) => Promise<void>;
}
/**
 * Diagnostics and error information
 */
export interface LoaderDiagnostics {
    phase: 'init' | 'options' | 'fetch' | 'transform' | 'import' | 'exec';
    kind?: 'get' | 'query' | 'put';
    error?: string;
    details?: Record<string, any>;
    [key: string]: any;
}
/**
 * Module loader adapter for platform-specific execution
 */
export interface ModuleLoader {
    /**
     * Load and execute a module, returning its exports
     * @param code The module source code
     * @param filename Path to the module for source maps
     * @param context The hook context to make available to the module
     * @param fetchUrl Optional: The actual URL where the module was fetched from (for @clevertree/meta)
     * @returns Resolved module exports
     */
    executeModule(code: string, filename: string, context: HookContext, fetchUrl?: string): Promise<any>;
}
/**
 * Web-specific module loader: uses Function constructor for Metro compatibility
 */
export declare class WebModuleLoader implements ModuleLoader {
    executeModule(code: string, filename: string, context: HookContext, fetchUrl?: string): Promise<any>;
}
/**
 * Wrapper for React that adds element usage tracking
 */
export declare function createHookReact(reactModule: any, onElement?: (tag: string, props: any) => void): any;
/**
 * Android module loader: uses Function constructor with ES6 import() support
 *
 * Executes hook code with support for ES6 dynamic imports via __import__() calls.
 * This allows hooks to use modern import() syntax instead of CommonJS require().
 */
export declare class AndroidModuleLoader implements ModuleLoader {
    private importHandler;
    private requireShim;
    private transpiler;
    constructor(options?: {
        requireShim?: (spec: string) => any;
        host?: string;
        transpiler?: (code: string, filename: string) => Promise<string>;
        onDiagnostics?: (diag: any) => void;
    });
    /**
     * Set up the import handler (called after host is known)
     */
    setImportHandler(importHandler: ES6ImportHandler): void;
    executeModule(code: string, filename: string, context: HookContext, fetchUrl?: string): Promise<any>;
}
/**
 * Transpile TypeScript/JSX to JavaScript (using @babel/standalone)
 *
 * @param code Source code to transpile
 * @param options Transform configuration
 * @param toCommonJs If true, also transform ESM imports/exports to CommonJS (for Android)
 * @returns Transpiled code
 */
export declare function transpileCode(code: string, options: TransformOptions, _toCommonJs?: boolean): Promise<string>;
/**
 * Centralized import rewriting for hooks.
 * Offloads JS glue from client repos to the transpiler runtime.
 */
export declare function applyHookRewrite(code: string): string;
/**
 * Detect if code looks like TypeScript/JSX/TSX
 */
export declare function looksLikeTsOrJsx(code: string, filename: string): boolean;
/**
 * Hook loader orchestrator: handles full lifecycle of loading and executing hooks
 */
export interface HookLoaderOptions {
    host: string;
    protocol: 'http' | 'https';
    moduleLoader: ModuleLoader;
    transpiler?: (code: string, filename: string) => Promise<string>;
    onDiagnostics?: (diag: LoaderDiagnostics) => void;
}
export declare class HookLoader {
    private host;
    private protocol;
    private moduleLoader;
    private transpiler?;
    private onDiagnostics;
    private moduleCache;
    private logTranspileResult;
    constructor(options: HookLoaderOptions);
    private buildRequestHeaders;
    /**
     * Load a module from the peer/repo, with optional transpilation
     * @param modulePath Relative or absolute path to module
     * @param fromPath Current hook path for resolving relative imports
     * @param context Hook context for module execution
     * @returns Module exports
     */
    loadModule(modulePath: string, fromPath: string | undefined, context: HookContext): Promise<any>;
    /**
     * Load and execute a hook module
     * @param hookPath Path to the hook module (from OPTIONS)
     * @param context The hook context to pass
     * @returns Executed hook element/result
     */
    loadAndExecuteHook(hookPath: string, context: HookContext): Promise<any>;
    /**
     * Clear module cache (useful for hot reload or cleanup)
     */
    clearCache(): void;
}
