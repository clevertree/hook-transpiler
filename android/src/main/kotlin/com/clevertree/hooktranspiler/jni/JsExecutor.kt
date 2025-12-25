package com.clevertree.hooktranspiler.jni

import com.clevertree.hooktranspiler.error.HookError
import com.clevertree.hooktranspiler.model.JsxElement

/**
 * JavaScript execution bridge
 * Executes transpiled JavaScript in a native JS engine (QuickJS, Hermes, etc.)
 * via JNI bindings
 */
object JsExecutor {
    /**
     * Initialize JS execution environment
     * Must be called once before executing any JS
     */
    external fun initialize(): Boolean

    /**
     * Execute JavaScript code in the configured runtime
     * @param code Transpiled JavaScript code
     * @param filename Source filename for error reporting
     * @return Result of execution (typically stringified JSX)
     */
    external fun executeJs(code: String, filename: String = "hook.js"): String

    /**
     * Set global variable in JS context
     * @param name Variable name
     * @param value Variable value (primitive or JSON-serializable)
     */
    external fun setGlobal(name: String, value: Any?): Boolean

    /**
     * Get global variable from JS context
     * @param name Variable name
     * @return Variable value or null
     */
    external fun getGlobal(name: String): Any?

    /**
     * Inject React-like helpers into JS context
     */
    external fun injectHelpers(): Boolean

    /**
     * Reset JS context (clear all variables)
     */
    external fun reset(): Boolean

    /**
     * Check if executor is initialized
     */
    external fun isInitialized(): Boolean

    /**
     * Get JS engine version
     */
    external fun getEngineVersion(): String
}

/**
 * Kotlin wrapper for JS execution with error handling
 */
class HookExecutor {
    private var isInitialized = false

    /**
     * Initialize executor
     */
    fun initialize(): Result<Unit> {
        return try {
            val success = JsExecutor.initialize()
            if (success) {
                isInitialized = true
                // Inject React-like helpers
                JsExecutor.injectHelpers()
                Result.success(Unit)
            } else {
                Result.failure(HookError.Generic("Failed to initialize JS executor"))
            }
        } catch (e: Exception) {
            Result.failure(HookError.Generic(
                "JS executor initialization failed: ${e.message}",
                mapOf("error" to e.message)
            ))
        }
    }

    /**
     * Execute transpiled JavaScript code
     * @param code Transpiled JS code (must export default function)
     * @param filename Source filename for error context
     * @param context Execution context (variables to inject)
     * @return Stringified JSX element or error
     */
    fun execute(
        code: String,
        filename: String = "hook.js",
        context: Map<String, Any?> = emptyMap()
    ): Result<String> {
        return try {
            if (!isInitialized) {
                initialize().getOrThrow()
            }

            // Inject context variables
            for ((name, value) in context) {
                JsExecutor.setGlobal(name, value)
            }

            // Execute code
            val result = JsExecutor.executeJs(code, filename)

            // Check if result looks like an error
            if (result.contains("Error") && !result.startsWith("{")) {
                return Result.failure(HookError.ExecutionError(
                    message = result,
                    sourceCode = code
                ))
            }

            Result.success(result)
        } catch (e: Exception) {
            Result.failure(HookError.ExecutionError(
                message = "JS execution failed: ${e.message}",
                sourceCode = code,
                errorCause = e
            ))
        }
    }

    /**
     * Execute hook function that returns JSX
     * @param code Transpiled code (should have default export function)
     * @param hookPath Hook file path for context
     * @param context Runtime context (meta info, helpers, etc.)
     */
    fun executeHook(
        code: String,
        hookPath: String = "hook.jsx",
        context: Map<String, Any?> = emptyMap()
    ): Result<String> {
        return try {
            if (!isInitialized) {
                initialize().getOrThrow()
            }

            // Add hook-specific context
            val fullContext = context.toMutableMap()
            fullContext["__hookPath"] = hookPath
            fullContext["__hookMeta"] = mapOf(
                "filename" to hookPath,
                "dirname" to hookPath.substringBeforeLast("/"),
                "timestamp" to System.currentTimeMillis()
            )

            // Inject all context
            for ((name, value) in fullContext) {
                JsExecutor.setGlobal(name, value)
            }

            // Execute the hook
            // The transpiled code should have: export default function() { return <JSX> }
            val executionCode = code + """
                
                (function() {
                  try {
                    const result = module.exports.default?.() || module.exports?.();
                    return JSON.stringify(result);
                  } catch (e) {
                    return JSON.stringify({ __error: true, message: e.message });
                  }
                })();
            """.trimIndent()

            val result = JsExecutor.executeJs(executionCode, hookPath)

            Result.success(result)
        } catch (e: Exception) {
            Result.failure(HookError.ExecutionError(
                message = "Hook execution failed: ${e.message}",
                sourceCode = code,
                errorCause = e
            ))
        }
    }

    /**
     * Get variable from JS context
     */
    fun getGlobal(name: String): Any? {
        return try {
            JsExecutor.getGlobal(name)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Set variable in JS context
     */
    fun setGlobal(name: String, value: Any?): Boolean {
        return try {
            JsExecutor.setGlobal(name, value)
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Reset execution context
     */
    fun reset(): Boolean {
        return try {
            JsExecutor.reset()
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Get engine version
     */
    fun getEngineVersion(): String {
        return try {
            JsExecutor.getEngineVersion()
        } catch (e: Exception) {
            "unknown"
        }
    }
}
