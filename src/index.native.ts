export * from './nativeRustTranspiler.native'
export {
  type TransformOptions,
  type TransformResult,
  type HookContext,
  type HookHelpers,
  type LoaderDiagnostics,
  type ModuleLoader,
  type HookLoaderOptions,
  WebModuleLoader,
  RNModuleLoader,
  transpileCode,
  looksLikeTsOrJsx,
  HookLoader,
} from './runtimeLoader'

export { ES6ImportHandler, type ImportHandlerOptions } from './es6ImportHandler'
export { buildPeerUrl, buildRepoHeaders } from './urlBuilder'

import { initNativeRustTranspiler } from './nativeRustTranspiler.native'

export async function initTranspiler(): Promise<void> {
  return initNativeRustTranspiler()
}
