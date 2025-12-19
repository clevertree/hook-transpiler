export * from './nativeRustTranspiler.native';
export { WebModuleLoader, RNModuleLoader, transpileCode, looksLikeTsOrJsx, HookLoader, } from './runtimeLoader';
export { ES6ImportHandler } from './es6ImportHandler';
export { buildPeerUrl, buildRepoHeaders } from './urlBuilder';
import { initNativeRustTranspiler } from './nativeRustTranspiler.native';
export async function initTranspiler() {
    return initNativeRustTranspiler();
}
//# sourceMappingURL=index.native.js.map