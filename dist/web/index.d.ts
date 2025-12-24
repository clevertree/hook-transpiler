export { HookLoader } from './runtimeLoader.js';
export { WebModuleLoader } from './runtimeLoader.js';
export { transpileCode, looksLikeTsOrJsx, applyHookRewrite, createHookReact } from './runtimeLoader.js';
export { default as HookRenderer } from './components/HookRenderer';
export { FileRenderer } from './components/FileRenderer';
export { MarkdownRenderer } from './components/MarkdownRenderer';
export { default as HookApp } from './components/HookApp';
export { ErrorBoundary } from './components/ErrorBoundary';
export declare function initHookTranspiler(wasmUrl?: string): Promise<void>;
/**
 * Preload @clevertree/* packages to make them available to hooks
 */
export declare function preloadPackages(): Promise<void>;
export declare const initTranspiler: typeof initHookTranspiler;
