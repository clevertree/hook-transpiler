export { type TransformOptions, type ComponentType, type HookContext, type HookHelpers, type LoaderDiagnostics, type ModuleLoader, type HookLoaderOptions, WebModuleLoader, transpileCode, createHookReact, looksLikeTsOrJsx, applyHookRewrite, HookLoader, } from './runtimeLoader.js';
export { HookRenderer, type HookRendererProps } from './components/HookRenderer.js';
export { HookApp, type HookAppProps } from './components/HookApp.js';
export { ErrorBoundary } from './components/ErrorBoundary.js';
export { MarkdownRenderer } from './components/MarkdownRenderer.js';
export { FileRenderer } from './components/FileRenderer.js';
export { ES6ImportHandler, type ImportHandlerOptions } from '../shared/es6ImportHandler.js';
export { buildPeerUrl, buildRepoHeaders } from '../shared/urlBuilder.js';
export declare function initWasmTranspiler(): Promise<void>;
export declare function initTranspiler(): Promise<void>;
export declare function initWeb(): Promise<void>;
export declare function transpileHook(code: string, filename?: string, isTypescript?: boolean): Promise<any>;
export declare function runSelfCheck(): Promise<{
    ok: boolean;
    version?: string;
    error?: string;
    wasmResults?: string[];
}>;
