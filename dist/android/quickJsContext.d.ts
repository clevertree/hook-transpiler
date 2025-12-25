/**
 * QuickJS Context Manager
 * Manages proper CommonJS module execution in QuickJS environment
 * Ensures local variable scope is preserved during eval()
 */
export interface QuickJsModuleContext {
    /** Execute code in module context and return exports.default */
    executeCode(code: string, filename?: string): any;
    /** Set a global variable accessible to executed code */
    setGlobal(name: string, value: any): void;
    /** Get a global variable */
    getGlobal(name: string): any;
    /** Get the current module exports object */
    getModuleExports(): any;
    /** Clear the module context for next execution */
    reset(): void;
}
/**
 * Create a QuickJS module context that wraps eval() with proper scope management
 *
 * The key insight: We need to evaluate transpiled code in a way that:
 * 1. Has access to all globals (React, require, __hook_jsx_runtime, etc)
 * 2. Has access to local variables that might be defined in the code
 * 3. Can set module.exports.default without throwing errors
 * 4. Preserves proper this context and closure capture
 *
 * Solution: Use direct eval() which has access to local scope, but ensure
 * the module object is available as a local variable, not just global.
 *
 * @param evalFn - The eval function to use (usually globalThis.eval)
 * @returns QuickJsModuleContext interface for executing hook code
 */
export declare function createQuickJsContext(evalFn?: typeof eval): QuickJsModuleContext;
/**
 * Alternative simpler approach used in Android QuickJS when direct function wrapping isn't feasible
 *
 * This version sets up module as a global AFTER creating the execution context,
 * ensuring it's available during eval()
 */
export declare function createQuickJsContextSimple(): QuickJsModuleContext;
/**
 * Utility: Format transpiled code for debugging
 * Shows first N lines with syntax highlighting context
 */
export declare function formatTranspiledCode(code: string, maxLines?: number): string;
