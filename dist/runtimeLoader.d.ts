/**
 * Unified Runtime Loader for Relay Hooks
 *
 * Provides a shared interface for loading and transpiling TS/TSX/JSX hooks
 * across both web and React Native clients. Abstracts away platform-specific
 * module execution (browser import vs RN eval).
 */
import { ES6ImportHandler } from './es6ImportHandler';
export interface TransformOptions {
    filename: string;
    hasJsxPragma?: boolean;
    development?: boolean;
}
/**
 * Result of transpiling code to CommonJS (used in RN)
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
    params: Record<string, any>;
    helpers: HookHelpers;
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
 * React Native module loader: uses Function constructor with ES6 import() support
 *
 * Executes hook code with support for ES6 dynamic imports via __import__() calls.
 * This allows hooks to use modern import() syntax instead of CommonJS require().
 */
export declare class RNModuleLoader implements ModuleLoader {
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
 * @param toCommonJs If true, also transform ESM imports/exports to CommonJS (for RN)
 * @returns Transpiled code
 */
export declare function transpileCode(code: string, options: TransformOptions, _toCommonJs?: boolean): Promise<string>;
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
    loadModule(modulePath: string, fromPath: string, context: HookContext): Promise<any>;
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
