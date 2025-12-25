export { type ComponentType, type HookContext, type HookHelpers, type ModuleLoader, AndroidModuleLoader, transpileCode, applyHookRewrite, } from './runtimeLoader.js';
export { HookRenderer, type HookRendererProps } from './components/HookRenderer.js';
export { HookApp, type HookAppProps } from './components/HookApp.js';
export { ES6ImportHandler, type ImportHandlerOptions } from '../shared/es6ImportHandler.js';
export { buildPeerUrl, buildRepoHeaders } from '../shared/urlBuilder.js';
export { installWebApiShims, type WebApiShimOptions } from './webApiShims.js';
export { createQuickJsContext, type QuickJsModuleContext, formatTranspiledCode } from './quickJsContext.js';
export declare function initTranspiler(): Promise<void>;
export declare function initAndroid(opts?: {
    onThemedStylerInit?: () => Promise<void>;
}): Promise<void>;
export declare function transpileHook(code: string, filename?: string, isTypescript?: boolean): Promise<any>;
