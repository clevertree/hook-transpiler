/**
 * Hook Transpiler for Android
 * JS glue layer that provides TypeScript/JavaScript interface for native Kotlin implementation
 *
 * Usage:
 * ```ts
 * import { HookApp, HookRenderer } from '@clevertree/hook-transpiler/android'
 * import { NativeModules } from 'react-native'
 *
 * const { HookTranspilerModule } = NativeModules
 *
 * export const App = () => (
 *   <HookApp
 *     host="http://localhost:8002"
 *     hookPath="/hooks/client/get-client.jsx"
 *   />
 * )
 * ```
 */
/**

 */
export function getTranspilerBridge() {
    // Would be injected by native code
    return globalThis.__transpilerBridge || null;
}
/**
 * Get JS executor instance (if available)
 */
export function getJsExecutorBridge() {
    // Would be injected by native code
    return globalThis.__jsExecutorBridge || null;
}
/**
 * Get module loader instance (if available)
 */
export function getModuleLoader() {
    // Would be injected by native code
    return globalThis.__moduleLoader || null;
}
/**
 * Create a module system for hook execution
 */
export function createModuleSystem() {
    const modules = {};
    return {
        require(modulePath) {
            if (!modules[modulePath]) {
                throw new Error(`Module not found: ${modulePath}`);
            }
            return modules[modulePath];
        },
        register(modulePath, moduleFactory) {
            modules[modulePath] = moduleFactory();
        },
        getModules() {
            return { ...modules };
        },
        clearCache() {
            Object.keys(modules).forEach(key => delete modules[key]);
        },
    };
}
//# sourceMappingURL=index.android.js.map