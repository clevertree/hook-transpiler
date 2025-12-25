package com.clevertree.hooktranspiler.jni

import com.clevertree.hooktranspiler.error.HookError
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

/**
 * Module resolver and pre-fetcher
 * Extracts imports from transpiled code and fetches them before execution
 */
class ModuleLoader(
    private val host: String,
    private val baseDir: String = "/hooks"
) {
    private val cache = ConcurrentHashMap<String, String>()
    private val transpiler = HookTranspiler()

    /**
     * Pre-fetch all modules referenced in source code
     * Extracts import statements and fetches from server
     */
    suspend fun preloadModules(source: String): Result<Map<String, String>> = withContext(Dispatchers.IO) {
        try {
            // Extract import paths from source
            val importsResult = transpiler.getImports(source)
            val imports = importsResult.getOrElse { emptyList() }

            if (imports.isEmpty()) {
                return@withContext Result.success(emptyMap())
            }

            // Fetch each module
            val modules = mutableMapOf<String, String>()
            for (importPath in imports) {
                val moduleResult = fetchModule(importPath)
                if (moduleResult.isSuccess) {
                    modules[importPath] = moduleResult.getOrThrow()
                } else {
                    // Log warning but continue - not all imports may be available
                    val error = moduleResult.exceptionOrNull()
                    System.err.println("Warning: Failed to preload module '$importPath': $error")
                }
            }

            Result.success(modules)
        } catch (e: Exception) {
            Result.failure(HookError.Generic(
                message = "Module preload failed: ${e.message}",
                details = mapOf("error" to e.message)
            ))
        }
    }

    /**
     * Fetch a module from the server
     */
    suspend fun fetchModule(modulePath: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            // Check cache first
            cache[modulePath]?.let { return@withContext Result.success(it) }

            // Normalize path
            val normalizedPath = if (modulePath.startsWith("/")) modulePath else "/$modulePath"

            // Build URL
            val url = URL(host.trimEnd('/') + baseDir + normalizedPath)

            // Fetch
            val conn = url.openConnection() as java.net.HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = 5000
            conn.readTimeout = 5000

            val content = when (conn.responseCode) {
                200 -> {
                    val source = conn.inputStream.bufferedReader().use { it.readText() }
                    cache[modulePath] = source
                    source
                }
                404 -> throw HookError.NetworkError(
                    "Module not found: $modulePath",
                    statusCode = 404,
                    url = url.toString()
                )
                else -> throw HookError.NetworkError(
                    "Failed to fetch module: HTTP ${conn.responseCode}",
                    statusCode = conn.responseCode,
                    url = url.toString()
                )
            }

            Result.success(content)
        } catch (e: Exception) {
            Result.failure(e as? HookError ?: HookError.NetworkError(
                "Failed to fetch module '$modulePath': ${e.message}",
                errorCause = e
            ))
        }
    }

    /**
     * Resolve module path relative to a base path
     */
    fun resolvePath(modulePath: String, relativeTo: String): String {
        if (modulePath.startsWith("/")) return modulePath
        if (modulePath.startsWith(".")) {
            val baseDir = relativeTo.substringBeforeLast("/")
            return "$baseDir/$modulePath".replace(Regex("//+"), "/")
        }
        return "/$modulePath"
    }

    /**
     * Get all cached modules
     */
    fun getCachedModules(): Map<String, String> = cache.toMap()

    /**
     * Clear cache
     */
    fun clearCache() {
        cache.clear()
    }

    /**
     * Get cache size
     */
    fun cacheSize(): Int = cache.size
}

/**
 * Immutable module snapshot after loading
 */
data class ModuleSnapshot(
    val modules: Map<String, String>,
    val timestamp: Long = System.currentTimeMillis()
) {
    /**
     * Resolve a module import from within another module
     */
    fun resolveModule(modulePath: String): String? {
        return modules[modulePath] ?: modules["/$modulePath"]
    }

    /**
     * Create a module context for execution
     */
    fun toExecutionContext(): Map<String, Any?> {
        return mapOf(
            "__modules" to modules,
            "__require" to { path: String -> modules[path] ?: modules["/$path"] }
        )
    }
}
