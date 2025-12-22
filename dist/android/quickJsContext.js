/**
 * QuickJS Context Manager
 * Manages proper CommonJS module execution in QuickJS environment
 * Ensures local variable scope is preserved during eval()
 */
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
export function createQuickJsContext(evalFn) {
    const $eval = evalFn || globalThis.eval;
    let module = { exports: {} };
    // Store globals that transpiled code might reference
    const globals = {
    // Will be populated by setGlobal()
    };
    return {
        executeCode(code, filename = 'module.jsx') {
            try {
                // Reset module for fresh execution
                module = { exports: {} };
                // Build a wrapper that:
                // 1. Declares module as local variable (so eval sees it)
                // 2. Declares all globals as local variables
                // 3. Executes the transpiled code
                // 4. Returns the exports
                const wrappedCode = `
(function() {
  // Module is local to this function, so eval() sees it
  var module = ${JSON.stringify(module)};
  
  // Declare all globals as local variables for eval() access
  ${Object.keys(globals)
                    .map(key => `var ${key} = globalThis.__quickjs_context_globals['${key}'];`)
                    .join('\n  ')}
  
  // Now eval the transpiled code - it has access to:
  // - module (local var)
  // - all injected globals
  // - any local variables declared within the code
  ${code}
  
  // Return the exports for caller
  return module.exports.default;
})()
`;
                // Store globals in globalThis so the wrapper can access them
                globalThis.__quickjs_context_globals = globals;
                try {
                    const result = $eval(wrappedCode);
                    // After execution, update our module reference
                    module = globalThis.__quickjs_context_module || module;
                    return result;
                }
                finally {
                    delete globalThis.__quickjs_context_globals;
                }
            }
            catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                err.message = `[QuickJsContext] Module execution failed: ${err.message}\nFile: ${filename}`;
                throw err;
            }
        },
        setGlobal(name, value) {
            globals[name] = value;
            globalThis[name] = value;
        },
        getGlobal(name) {
            return globals[name] ?? globalThis[name];
        },
        getModuleExports() {
            return module.exports;
        },
        reset() {
            module = { exports: {} };
            Object.keys(globals).forEach(key => delete globals[key]);
        }
    };
}
/**
 * Alternative simpler approach used in Android QuickJS when direct function wrapping isn't feasible
 *
 * This version sets up module as a global AFTER creating the execution context,
 * ensuring it's available during eval()
 */
export function createQuickJsContextSimple() {
    // Note: This requires that the calling environment has already:
    // 1. Set globalThis.module = { exports: {} }
    // 2. Set all required globals (React, require, etc)
    return {
        executeCode(code, filename = 'module.jsx') {
            try {
                // Simple eval - relies on environment setup
                globalThis.eval(code);
                const module = globalThis.module;
                if (!module?.exports?.default) {
                    throw new Error(`No default export found in ${filename}`);
                }
                return module.exports.default;
            }
            catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                err.message = `[QuickJsContext] Execution failed: ${err.message}\nFile: ${filename}`;
                throw err;
            }
        },
        setGlobal(name, value) {
            globalThis[name] = value;
        },
        getGlobal(name) {
            return globalThis[name];
        },
        getModuleExports() {
            return globalThis.module?.exports || {};
        },
        reset() {
            const module = globalThis.module;
            if (module) {
                module.exports = {};
            }
        }
    };
}
/**
 * Utility: Format transpiled code for debugging
 * Shows first N lines with syntax highlighting context
 */
export function formatTranspiledCode(code, maxLines = 10) {
    const lines = code.split('\n').slice(0, maxLines);
    return lines
        .map((line, idx) => `${String(idx + 1).padStart(3)}: ${line}`)
        .join('\n');
}
//# sourceMappingURL=quickJsContext.js.map