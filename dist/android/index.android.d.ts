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
 * Native module interface for accessing Kotlin HookApp
 */
export interface NativeHookAppModule {
    /**
     * Load and render a hook
     */
    load(host: string, hookPath: string): Promise<void>;
    /**
     * Get current status
     */
    getStatus(): Promise<HookStatus>;
    /**
     * Get styling snapshot
     */
    getStyleSnapshot(): Promise<StyleSnapshot>;
    /**
     * Register an element for styling
     */
    registerElement(tag: string, props: Record<string, any>): Promise<void>;
    /**
     * Register a theme
     */
    registerTheme(name: string, defs: Record<string, any>): Promise<void>;
    /**
     * Reload the hook
     */
    reload(): Promise<void>;
    /**
     * Clear state
     */
    clear(): Promise<void>;
}
/**
 * Hook status (mirrors Kotlin HookStatus)
 */
export interface HookStatus {
    loading: boolean;
    error?: string | null;
    hookPath: string;
    ready: boolean;
    timestamp: number;
}
/**
 * Element registration (mirrors Kotlin ElementRegistration)
 */
export interface ElementRegistration {
    tag: string;
    props: Record<string, any>;
    timestamp: number;
}
/**
 * Theme definition (mirrors Kotlin ThemeDefinition)
 */
export interface ThemeDefinition {
    name: string;
    definitions: Record<string, any>;
    timestamp: number;
}
/**
 * Style snapshot (mirrors Kotlin StyleSnapshot)
 */
export interface StyleSnapshot {
    registeredElements: Record<string, ElementRegistration>;
    themes: Record<string, ThemeDefinition>;
    timestamp: number;
}
/**
 * Transpiler bridge - provides access to Rust transpiler via JNI
 */
export interface TranspilerBridge {
    /**
     * Transpile JSX to JavaScript
     */
    transpileJsx(source: string, filename: string): Promise<string>;
    /**
     * Extract import paths from source
     */
    extractImports(source: string): Promise<string[]>;
    /**
     * Get transpiler version
     */
    getVersion(): Promise<string>;
    /**
     * Run self-test
     */
    runSelfTest(): Promise<boolean>;
    /**
     * Check if ready
     */
    isReady(): Promise<boolean>;
}
/**
 * JS Executor bridge - provides access to QuickJS via JNI
 */
export interface JsExecutorBridge {
    /**
     * Initialize JS executor
     */
    initialize(): Promise<boolean>;
    /**
     * Execute JavaScript code
     */
    executeJs(code: string, filename: string): Promise<string>;
    /**
     * Set global variable
     */
    setGlobal(name: string, value: any): Promise<boolean>;
    /**
     * Get global variable
     */
    getGlobal(name: string): Promise<any>;
    /**
     * Inject React-like helpers
     */
    injectHelpers(): Promise<boolean>;
    /**
     * Reset context
     */
    reset(): Promise<boolean>;
    /**
     * Check if initialized
     */
    isInitialized(): Promise<boolean>;
    /**
     * Get engine version
     */
    getEngineVersion(): Promise<string>;
}
/**
 * Module loader - handles pre-fetching dependencies
 */
export interface ModuleLoader {
    /**
     * Pre-load all modules from source
     */
    preloadModules(source: string): Promise<Record<string, string>>;
    /**
     * Fetch a specific module
     */
    fetchModule(modulePath: string): Promise<string>;
    /**
     * Get cached modules
     */
    getCachedModules(): Promise<Record<string, string>>;
    /**
     * Clear cache
     */
    clearCache(): Promise<void>;
}
/**
 * HookApp React component interface (for React Native)
 */
export interface HookAppProps {
    host: string;
    hookPath?: string;
    onStatus?: (status: HookStatus) => void;
    onError?: (error: Error) => void;
    onReady?: () => void;
    onLoading?: () => void;
    onElement?: (tag: string, props: Record<string, any>) => void;
    registerTheme?: (name: string, defs: Record<string, any>) => void;
}
/**
 * HookRenderer React component interface (for React Native)
 */
export interface HookRendererProps extends HookAppProps {
}
/**
 * Error types (mirrors Kotlin HookError)
 */
export interface HookErrorBase {
    message: string;
    toUserMessage(): string;
    toDetailedMessage(): string;
}
export interface NetworkError extends HookErrorBase {
    type: 'NetworkError';
    statusCode?: number;
    url?: string;
}
export interface ParseError extends HookErrorBase {
    type: 'ParseError';
    source: string;
    line: number;
    column: number;
}
export interface ExecutionError extends HookErrorBase {
    type: 'ExecutionError';
    sourceCode: string;
    stackTrace: string;
}
export interface RenderError extends HookErrorBase {
    type: 'RenderError';
    element: string;
    context: string;
}
export interface ValidationError extends HookErrorBase {
    type: 'ValidationError';
    fieldName: string;
    expectedType: string;
}
export type HookError = NetworkError | ParseError | ExecutionError | RenderError | ValidationError;
/**

 */
export declare function getTranspilerBridge(): TranspilerBridge | null;
/**
 * Get JS executor instance (if available)
 */
export declare function getJsExecutorBridge(): JsExecutorBridge | null;
/**
 * Get module loader instance (if available)
 */
export declare function getModuleLoader(): ModuleLoader | null;
/**
 * Module system setup for hooks
 * Provides require() and import support for modules
 */
export interface ModuleSystem {
    /**
     * Load a module
     */
    require(modulePath: string): any;
    /**
     * Register a module
     */
    register(modulePath: string, moduleFactory: () => any): void;
    /**
     * Get all registered modules
     */
    getModules(): Record<string, any>;
    /**
     * Clear module cache
     */
    clearCache(): void;
}
/**
 * Create a module system for hook execution
 */
export declare function createModuleSystem(): ModuleSystem;
