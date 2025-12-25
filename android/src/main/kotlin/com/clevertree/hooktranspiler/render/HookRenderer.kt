package com.clevertree.hooktranspiler.render

import com.clevertree.hooktranspiler.error.HookError
import com.clevertree.hooktranspiler.jni.JsExecutor
import com.clevertree.hooktranspiler.jni.HookExecutor
import com.clevertree.hooktranspiler.jni.HookTranspiler
import com.clevertree.hooktranspiler.jni.ModuleLoader
import com.clevertree.hooktranspiler.jni.TranspilerBridge
import com.clevertree.hooktranspiler.model.HookContext
import com.clevertree.hooktranspiler.model.HookHelpers
import com.clevertree.hooktranspiler.model.HookStatus
import com.clevertree.hooktranspiler.model.JsxElement
import com.clevertree.hooktranspiler.styling.StylingRegistry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

/**
 * Main Hook renderer for Android
 * Responsible for:
 * 1. Discovering and fetching hook source from server
 * 2. Transpiling JSX to JavaScript (via Rust JNI bridge)
 * 3. Pre-loading dependent modules (via module loader)
 * 4. Executing transpiled code (via QuickJS JNI bridge)
 * 5. Parsing execution result to JsxElement tree
 * 6. Integrating with styling system
 * 7. Rendering to native Android views
 */
class HookRenderer(
    private val host: String,
    private val onElement: ((tag: String, props: Map<String, Any?>) -> Unit)? = null,
    private val registerTheme: ((name: String, defs: Map<String, Any?>) -> Unit)? = null,
    private val onError: ((error: HookError) -> Unit)? = null,
    private val onReady: (() -> Unit)? = null,
    private val onLoading: (() -> Unit)? = null
) {
    private val transpiler: HookTranspiler
    private val executor: HookExecutor
    private val moduleLoader: ModuleLoader
    private val stylingRegistry: StylingRegistry
    private var status = HookStatus(hookPath = "")
    private val cache = ConcurrentHashMap<String, String>()

    init {
        transpiler = HookTranspiler()
        executor = HookExecutor()
        moduleLoader = ModuleLoader(host)
        stylingRegistry = StylingRegistry()
    }

    /**
     * Load and render a hook
     * Flow:
     * 1. Fetch hook source from server
     * 2. Transpile JSX to JavaScript (Rust)
     * 3. Extract and pre-load module dependencies
     * 4. Execute transpiled code (QuickJS)
     * 5. Parse execution result to JsxElement tree
     */
    suspend fun loadAndRender(
        hookPath: String? = null,
        assetRoot: String? = null
    ): Result<JsxElement> = withContext(Dispatchers.IO) {
        try {
            onLoading?.invoke()
            status = status.copy(loading = true)

            // Discover hook path if not provided
            val resolvedPath = hookPath ?: discoverHookPath()
            status = status.copy(hookPath = resolvedPath)

            // Step 1: Fetch hook source from server
            val source = fetchHook(resolvedPath)

            // Step 2: Transpile JSX to JavaScript via Rust JNI bridge
            val jsCode = transpiler.transpile(source, resolvedPath).getOrThrow()

            // Step 3: Pre-load all modules referenced in the hook
            val modules = moduleLoader.preloadModules(source).getOrThrow()

            // Step 4: Execute transpiled code with module context
            val executionContext = mapOf(
                "__modules" to modules,
                "__onElement" to { tag: String, props: Map<String, Any?> ->
                    stylingRegistry.getElementRegistry().registerElement(tag, props)
                    onElement?.invoke(tag, props)
                }
            )
            val executionResult = executor.execute(jsCode, resolvedPath, executionContext).getOrThrow()

            // Step 5: Parse execution result to JsxElement tree
            val element = parseExecutionResult(executionResult)

            status = status.copy(loading = false, ready = true)
            onReady?.invoke()

            Result.success(element)
        } catch (e: Exception) {
            val error = when (e) {
                is HookError -> e
                else -> HookError.ExecutionError(e.message ?: "Unknown error", errorCause = e)
            }
            status = status.copy(loading = false, error = error.message)
            onError?.invoke(error)
            Result.failure(error)
        }
    }

    /**
     * Discover hook path from server OPTIONS endpoint
     */
    private suspend fun discoverHookPath(): String = withContext(Dispatchers.IO) {
        try {
            val url = URL(host.trimEnd('/') + "/")
            val conn = url.openConnection() as java.net.HttpURLConnection
            conn.requestMethod = "OPTIONS"
            conn.connectTimeout = 5000
            conn.readTimeout = 5000

            when (conn.responseCode) {
                200 -> {
                    // Try headers first
                    var hookPath = conn.getHeaderField("x-hook-path")
                        ?: conn.getHeaderField("x-relay-hook-path")

                    // Fall back to body
                    if (hookPath == null) {
                        hookPath = conn.inputStream.bufferedReader().use { it.readText() }.trim()
                    }

                    if (hookPath.isNotEmpty()) {
                        if (!hookPath.startsWith("/")) "/$hookPath" else hookPath
                    } else {
                        throw HookError.NetworkError(
                            "OPTIONS $url did not return a hook path",
                            statusCode = 200,
                            url = url.toString()
                        )
                    }
                }
                else -> {
                    throw HookError.NetworkError(
                        "OPTIONS $url → ${conn.responseCode} ${conn.responseMessage}",
                        statusCode = conn.responseCode,
                        url = url.toString()
                    )
                }
            }
        } catch (e: Exception) {
            throw HookError.NetworkError(
                "Failed to discover hook path: ${e.message}",
                errorCause = e
            )
        }
    }

    /**
     * Fetch hook source from server
     */
    private suspend fun fetchHook(hookPath: String): String = withContext(Dispatchers.IO) {
        try {
            // Check cache first
            cache[hookPath]?.let { return@withContext it }

            val url = URL(host.trimEnd('/') + hookPath)
            val conn = url.openConnection() as java.net.HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = 5000
            conn.readTimeout = 5000

            when (conn.responseCode) {
                200 -> {
                    val source = conn.inputStream.bufferedReader().use { it.readText() }
                    cache[hookPath] = source
                    source
                }
                404 -> throw HookError.NetworkError(
                    "Hook not found",
                    statusCode = 404,
                    url = url.toString()
                )
                403 -> throw HookError.NetworkError(
                    "Access denied",
                    statusCode = 403,
                    url = url.toString()
                )
                else -> throw HookError.NetworkError(
                    "HTTP ${conn.responseCode}",
                    statusCode = conn.responseCode,
                    url = url.toString()
                )
            }
        } catch (e: Exception) {
            throw HookError.NetworkError(
                "Failed to fetch hook: ${e.message}",
                errorCause = e
            )
        }
    }

    /**
     * Parse JS execution result (JSON stringified JSX) to JsxElement tree
     */
    private fun parseExecutionResult(result: String): JsxElement {
        return try {
            // The result should be a JSON stringified JSX representation
            // For now, we'll create a simple representation
            // In production, this would parse the actual JSX structure
            if (result.contains("__error")) {
                throw HookError.ExecutionError(
                    "Hook execution returned error: $result"
                )
            }
            // Return as a generic component with the result as content
            JsxElement.Component("HookResult", mapOf("data" to result))
        } catch (e: Exception) {
            throw HookError.RenderError(
                message = e.message ?: "Failed to parse execution result",
                context = result
            )
        }
    }

    /**
     * Create hook execution context (for future use)
     */
    private fun createContext(hookPath: String): HookContext {
        return HookContext(
            host = host,
            hookPath = hookPath,
            onElement = { tag, props ->
                stylingRegistry.getElementRegistry().registerElement(tag, props)
                onElement?.invoke(tag, props)
            },
            helpers = HookHelpers()
        )
    }

    /**
     * Get current status
     */
    fun getStatus(): HookStatus = status

    /**
     * Get styling snapshot
     */
    fun getStylingSnapshot() = stylingRegistry.getSnapshot()

    /**
     * Get module cache stats
     */
    fun getModuleCacheSize(): Int = moduleLoader.cacheSize()

    /**
     * Clear cache and registries
     */
    fun clear() {
        cache.clear()
        moduleLoader.clearCache()
        stylingRegistry.clear()
        status = HookStatus(hookPath = "")
    }
}

