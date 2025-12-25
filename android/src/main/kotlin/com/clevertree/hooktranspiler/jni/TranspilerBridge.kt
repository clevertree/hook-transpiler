package com.clevertree.hooktranspiler.jni

import com.clevertree.hooktranspiler.error.HookError

/**
 * JNI bridge to Rust transpiler (relay_hook_transpiler)
 * Provides native bindings to:
 * - transpile_jsx: Convert JSX source to JavaScript
 * - extract_imports: Find module imports for pre-fetching
 * - get_version: Get transpiler version
 */
object TranspilerBridge {
    init {
        try {
            System.loadLibrary("relay_hook_transpiler")
        } catch (e: UnsatisfiedLinkError) {
            throw RuntimeException("Failed to load relay_hook_transpiler native library", e)
        }
    }

    /**
     * Transpile JSX source to JavaScript
     * @param source JSX source code
     * @param filename Source filename for error reporting
     * @return Transpiled JavaScript code
     * @throws HookError.ExecutionError if transpilation fails
     */
    external fun transpileJsx(source: String, filename: String = "hook.jsx"): String

    /**
     * Extract import paths from source code
     * Used to pre-fetch modules before execution
     * @param source JavaScript/JSX source code
     * @return List of import paths
     */
    external fun extractImports(source: String): List<String>

    /**
     * Get transpiler version
     * @return Version string
     */
    external fun getVersion(): String

    /**
     * Run self-test to verify WASM transpiler is working
     * @return true if test passes
     */
    external fun runSelfTest(): Boolean

    /**
     * Check if transpiler is initialized and ready
     * @return true if ready
     */
    external fun isReady(): Boolean
}

/**
 * Kotlin wrapper around transpiler bridge with error handling
 */
class HookTranspiler {
    private var isInitialized = false

    /**
     * Initialize transpiler (check if native library is loaded)
     */
    fun initialize(): Result<Unit> {
        return try {
            val ready = TranspilerBridge.isReady()
            isInitialized = ready
            if (ready) {
                Result.success(Unit)
            } else {
                Result.failure(HookError.Generic("Transpiler native library not ready"))
            }
        } catch (e: Exception) {
            Result.failure(HookError.Generic("Failed to initialize transpiler: ${e.message}", mapOf("cause" to e)))
        }
    }

    /**
     * Transpile JSX source to JavaScript
     */
    fun transpile(source: String, filename: String = "hook.jsx"): Result<String> {
        return try {
            if (!isInitialized) {
                initialize().getOrThrow()
            }
            val js = TranspilerBridge.transpileJsx(source, filename)
            Result.success(js)
        } catch (e: Exception) {
            Result.failure(HookError.ExecutionError(
                message = "Transpilation failed: ${e.message}",
                sourceCode = source,
                errorCause = e
            ))
        }
    }

    /**
     * Extract imports from source for pre-fetching
     */
    fun getImports(source: String): Result<List<String>> {
        return try {
            if (!isInitialized) {
                initialize().getOrThrow()
            }
            val imports = TranspilerBridge.extractImports(source)
            Result.success(imports)
        } catch (e: Exception) {
            Result.failure(HookError.Generic(
                message = "Failed to extract imports: ${e.message}",
                details = mapOf("cause" to e)
            ))
        }
    }

    /**
     * Get transpiler version
     */
    fun getVersion(): String {
        return try {
            TranspilerBridge.getVersion()
        } catch (e: Exception) {
            "unknown"
        }
    }

    /**
     * Run self-test
     */
    fun runSelfTest(): Boolean {
        return try {
            TranspilerBridge.runSelfTest()
        } catch (e: Exception) {
            false
        }
    }
}
