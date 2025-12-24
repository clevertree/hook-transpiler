/** Android Runtime Loader for Relay Hooks */
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
export type ComponentType<P = any> = (props: P) => any;
export interface HookHelpers {
    buildPeerUrl: (path: string) => string;
    loadModule: (modulePath: string, fromPath?: string) => Promise<any>;
}
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
export interface ModuleLoader {
    executeModule(code: string, filename: string, context: HookContext, fetchUrl?: string, isMainHook?: boolean): Promise<any>;
}
export declare class AndroidModuleLoader implements ModuleLoader {
    executeModule(code: string, filename: string, context: HookContext, fetchUrl?: string, isMainHook?: boolean): Promise<any>;
}
export declare function transpileCode(code: string, filename: string, isTypescript?: boolean): Promise<string>;
export declare function applyHookRewrite(code: string): string;
