package com.clevertree.hooktranspiler.transpiler

import com.clevertree.hooktranspiler.error.HookError

/**
 * Hook transpiler wrapper for the Android library
 * Uses the Rust JNI bridge (RustTranspilerModule) for transpilation
 * This is a thin wrapper that delegates to the actual JNI implementation
 * 
 * Note: The actual JNI bridge is com.relay.client.RustTranspilerModule
 * which must be included in the consuming app's dependencies
 */
class HookTranspiler {
    /**
     * Transpile JSX source to JavaScript using Rust transpiler via JNI
     * @param source JSX source code
     * @param filename Source filename for error reporting
     * @param isTypescript Whether the source is TypeScript
     * @return Result containing transpiled JavaScript or error
     */
    fun transpile(
        source: String,
        filename: String = "hook.jsx",
        isTypescript: Boolean = filename.endsWith(".tsx") || filename.endsWith(".ts")
    ): Result<String> {
        return try {
            // Use reflection to call RustTranspilerModule to avoid hard dependency
            val rustClass = Class.forName("com.relay.client.RustTranspilerModule")
            val method = rustClass.getMethod(
                "nativeTranspile",
                String::class.java,
                String::class.java,
                Boolean::class.javaPrimitiveType
            )
            val result = method.invoke(null, source, filename, isTypescript) as String
            Result.success(result)
        } catch (e: ClassNotFoundException) {
            Result.failure(HookError.ExecutionError(
                message = "RustTranspilerModule not found. Make sure relay_hook_transpiler native library is included.",
                sourceCode = source,
                errorCause = e
            ))
        } catch (e: Exception) {
            Result.failure(HookError.ExecutionError(
                message = "Transpilation failed: ${e.message}",
                sourceCode = source,
                errorCause = e
            ))
        }
    }

    /**
     * Get transpiler version
     */
    fun getVersion(): String {
        return try {
            val rustClass = Class.forName("com.relay.client.RustTranspilerModule")
            val method = rustClass.getMethod("nativeGetVersion")
            method.invoke(null) as String
        } catch (e: Exception) {
            "unknown"
        }
    }
}
