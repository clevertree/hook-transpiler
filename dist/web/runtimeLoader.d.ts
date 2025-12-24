/**
 * Unified Runtime Loader for Relay Hooks (Web)
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
export interface TransformOptions {
    filename: string;
    hasJsxPragma?: boolean;
    development?: boolean;
    isTypescript?: boolean;
}
export interface HookHelpers {
    buildPeerUrl: (path: string) => string;
    loadModule: (modulePath: string, fromPath?: string) => Promise<any>;
    registerThemeStyles?: (themeName: string, definitions?: Record<string, unknown>) => void;
    registerThemesFromYaml?: (path: string) => Promise<void>;
    buildRepoHeaders?: (branch?: string, repo?: string) => Record<string, string>;
}
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
export interface LoaderDiagnostics {
    phase: 'init' | 'options' | 'fetch' | 'transform' | 'import' | 'exec';
    kind?: 'get' | 'query' | 'put';
    error?: string;
    details?: Record<string, any>;
    [key: string]: any;
}
export interface ModuleLoader {
    executeModule(code: string, filename: string, context: HookContext, fetchUrl?: string, isMainHook?: boolean): Promise<any>;
}
export declare class WebModuleLoader implements ModuleLoader {
    executeModule(code: string, filename: string, context: HookContext, fetchUrl?: string, isMainHook?: boolean): Promise<any>;
}
export declare function createHookReact(reactModule: any, onElement?: (tag: string, props: any) => void): any;
export declare function transpileCode(code: string, options: TransformOptions, _toCommonJs?: boolean): Promise<string>;
export declare function applyHookRewrite(code: string): string;
export declare function looksLikeTsOrJsx(code: string, filename: string): boolean;
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
    private pendingFetches;
    private logTranspileResult;
    constructor(options: HookLoaderOptions);
    private buildRequestHeaders;
    private normalizeToAbsolutePath;
    loadModule(modulePath: string, fromPath: string | undefined, context: HookContext): Promise<any>;
    private _doLoadModule;
    loadAndExecuteHook(hookPath: string, context: HookContext): Promise<any>;
    clearCache(): void;
}
