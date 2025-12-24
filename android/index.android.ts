// Android entry for @clevertree/hook-transpiler

export { AndroidModuleLoader } from './runtimeLoader.js'
export { applyHookRewrite } from './runtimeLoader.js'
export { default as HookRenderer } from './components/HookRenderer'
export { default as HookApp } from './components/HookApp'

export function assertTranspilerReady(): void {
    const fn = (globalThis as any).__hook_transpile_jsx
    if (typeof fn !== 'function') {
        throw new Error('Android transpiler not ready: __hook_transpile_jsx missing')
    }
}
