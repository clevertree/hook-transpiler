package com.clevertree.hooktranspiler.jni

/**
 * Low-level JNI bindings to Rust hook transpiler
 * DO NOT USE DIRECTLY - use HookTranspiler wrapper from TranspilerBridge instead
 */
object HookTranspilerJNI {
    init {
        try {
            // Load the native library compiled from Rust
            System.loadLibrary("relay_hook_transpiler")
        } catch (e: UnsatisfiedLinkError) {
            throw RuntimeException("Failed to load relay_hook_transpiler native library", e)
        }
    }

    /**
     * Initialize the transpiler (optional, done automatically)
     */
    external fun initialize(): Boolean

    /**
     * Transpile JSX source code to JavaScript
     */
    external fun transpileJsx(source: String, filename: String): String

    /**
     * Get transpiler version
     */
    external fun getVersion(): String

    /**
     * Run self-test to verify transpiler is working
     */
    external fun runSelfTest(): Boolean

    /**
     * Parse hook source and extract module imports
     */
    external fun parseImports(source: String): String

    /**
     * Get detailed error information from last transpilation failure
     */
    external fun getLastError(): String

    /**
     * Verify transpiler is loaded and ready
     */
    fun isReady(): Boolean = try {
        getVersion()
        true
    } catch (e: Exception) {
        false
    }
}

