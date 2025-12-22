export { type TransformOptions, type TransformResult, type HookContext, type HookHelpers, type LoaderDiagnostics, type ModuleLoader, type HookLoaderOptions, type UnifiedBridge, type StyleManager, WebModuleLoader, AndroidModuleLoader, transpileCode, createHookReact, looksLikeTsOrJsx, HookLoader, } from './runtimeLoader.js';
export { HookRenderer, type HookRendererProps } from './components/android/HookRenderer.js';
export { HookApp, type HookAppProps } from './components/android/HookApp.js';
export { ES6ImportHandler, type ImportHandlerOptions } from './es6ImportHandler.js';
export { buildPeerUrl, buildRepoHeaders } from './urlBuilder.js';
export { installWebApiShims, type WebApiShimOptions } from './android/webApiShims.js';
export { createQuickJsContext, type QuickJsModuleContext, formatTranspiledCode } from './android/quickJsContext.js';
export { initAndroidThemedStyler, createAndroidTheme, applyAndroidThemeStyle } from '@clevertree/themed-styler/android';
export declare function initTranspiler(): Promise<void>;
export declare function initAndroid(opts?: {
    onThemedStylerInit?: () => Promise<void>;
}): Promise<void>;
export declare function transpileHook(code: string, filename?: string, isTypescript?: boolean): Promise<any>;
