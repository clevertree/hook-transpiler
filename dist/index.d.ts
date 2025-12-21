export { type TransformOptions, type TransformResult, type HookContext, type HookHelpers, type LoaderDiagnostics, type ModuleLoader, type HookLoaderOptions, type UnifiedBridge, type StyleManager, WebModuleLoader, AndroidModuleLoader, transpileCode, createHookReact, looksLikeTsOrJsx, HookLoader, } from './runtimeLoader.js';
export { HookRenderer, type HookRendererProps } from './components/HookRenderer.js';
export { ErrorBoundary } from './components/ErrorBoundary.js';
export { MarkdownRenderer } from './components/MarkdownRenderer.js';
export { FileRenderer } from './components/FileRenderer.js';
export { ES6ImportHandler, type ImportHandlerOptions } from './es6ImportHandler.js';
export { buildPeerUrl, buildRepoHeaders } from './urlBuilder.js';
export declare function initWasmTranspiler(): Promise<void>;
export declare function initTranspiler(): Promise<void>;
export declare function runSelfCheck(): Promise<{
    ok: boolean;
    version?: string;
    error?: string;
    wasmResults?: string[];
}>;
