export { type TransformOptions, type HookContext, type HookHelpers, type LoaderDiagnostics, type ModuleLoader, type HookLoaderOptions, WebModuleLoader, transpileCode, createHookReact, looksLikeTsOrJsx, HookLoader, } from '../web/runtimeLoader.js';
export { ES6ImportHandler, type ImportHandlerOptions } from '../shared/es6ImportHandler.js';
export { buildPeerUrl, buildRepoHeaders } from '../shared/urlBuilder.js';
export declare function initTranspiler(): Promise<void>;
export declare function initAndroid(): Promise<void>;
export declare function transpileHook(code: string, filename?: string, isTypescript?: boolean): Promise<string>;
