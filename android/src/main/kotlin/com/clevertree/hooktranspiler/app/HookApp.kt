package com.clevertree.hooktranspiler.app

import com.clevertree.hooktranspiler.error.HookError
import com.clevertree.hooktranspiler.model.HookStatus
import com.clevertree.hooktranspiler.model.StyleSnapshot
import com.clevertree.hooktranspiler.render.HookRenderer
import com.clevertree.hooktranspiler.styling.StylingRegistry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.CopyOnWriteArrayList

/**
 * HookApp: Container for hook lifecycle, state management, and styling integration
 *
 * Responsibilities:
 * 1. Manage hook loading and rendering lifecycle
 * 2. Track loading/error/ready states
 * 3. Coordinate with HookRenderer for rendering
 * 4. Integrate with external styling systems
 * 5. Manage theme registration
 * 6. Expose current state snapshot for UI updates
 */
class HookApp(
    private val host: String,
    private val hookPath: String? = null,
    private val onStatus: ((status: HookStatus) -> Unit)? = null,
    private val onError: ((error: HookError) -> Unit)? = null,
    private val onReady: (() -> Unit)? = null,
    private val onLoading: (() -> Unit)? = null,
    private val onElement: ((tag: String, props: Map<String, Any?>) -> Unit)? = null,
    private val registerTheme: ((name: String, defs: Map<String, Any?>) -> Unit)? = null
) {
    private val stylingRegistry = StylingRegistry()
    private var currentStatus = HookStatus(hookPath = hookPath ?: "")
    private val statusListeners = CopyOnWriteArrayList<(HookStatus) -> Unit>()
    private val scope = CoroutineScope(Dispatchers.Main)

    private val renderer = HookRenderer(
        host = host,
        onElement = { tag, props ->
            stylingRegistry.getElementRegistry().registerElement(tag, props)
            onElement?.invoke(tag, props)
        },
        registerTheme = { name, defs ->
            stylingRegistry.getThemeRegistry().registerTheme(name, defs)
            registerTheme?.invoke(name, defs)
        },
        onError = { error ->
            currentStatus = currentStatus.copy(error = error.message, loading = false)
            notifyStatusChange()
            onError?.invoke(error)
        },
        onReady = {
            currentStatus = currentStatus.copy(error = null, loading = false, ready = true)
            notifyStatusChange()
            onReady?.invoke()
        },
        onLoading = {
            currentStatus = currentStatus.copy(loading = true, error = null, ready = false)
            notifyStatusChange()
            onLoading?.invoke()
        }
    )

    /**
     * Register a listener for status changes
     */
    fun addStatusListener(listener: (HookStatus) -> Unit) {
        statusListeners.add(listener)
    }

    /**
     * Remove a status listener
     */
    fun removeStatusListener(listener: (HookStatus) -> Unit) {
        statusListeners.remove(listener)
    }

    /**
     * Load and render the hook
     */
    fun load(path: String? = null) {
        scope.launch {
            try {
                val result = renderer.loadAndRender(path ?: hookPath)
                if (result.isSuccess) {
                    // Hook loaded and rendered successfully
                    currentStatus = currentStatus.copy(
                        loading = false,
                        ready = true,
                        error = null,
                        hookPath = path ?: hookPath ?: ""
                    )
                } else {
                    // Handle error
                    val error = result.exceptionOrNull() as? HookError
                    currentStatus = currentStatus.copy(
                        loading = false,
                        ready = false,
                        error = error?.message ?: "Unknown error"
                    )
                }
                notifyStatusChange()
            } catch (e: Exception) {
                currentStatus = currentStatus.copy(
                    loading = false,
                    ready = false,
                    error = e.message ?: "Unknown error"
                )
                notifyStatusChange()
            }
        }
    }

    /**
     * Register an element for styling
     */
    fun registerElement(tag: String, props: Map<String, Any?>) {
        stylingRegistry.getElementRegistry().registerElement(tag, props)
        onElement?.invoke(tag, props)
    }

    /**
     * Register a theme
     */
    fun registerThemeDefinition(name: String, definitions: Map<String, Any?>) {
        stylingRegistry.getThemeRegistry().registerTheme(name, definitions)
        registerTheme?.invoke(name, definitions)
    }

    /**
     * Get current status
     */
    fun getStatus(): HookStatus = currentStatus

    /**
     * Get styling snapshot
     */
    fun getStyleSnapshot(): StyleSnapshot = stylingRegistry.getSnapshot()

    /**
     * Check if hook is loading
     */
    fun isLoading(): Boolean = currentStatus.loading

    /**
     * Check if hook is ready
     */
    fun isReady(): Boolean = currentStatus.ready

    /**
     * Get current error (if any)
     */
    fun getError(): String? = currentStatus.error

    /**
     * Reload the hook
     */
    fun reload() {
        load()
    }

    /**
     * Clear all state
     */
    fun clear() {
        renderer.clear()
        stylingRegistry.clear()
        currentStatus = HookStatus(hookPath = "")
        notifyStatusChange()
    }

    /**
     * Cleanup resources
     */
    fun destroy() {
        clear()
        statusListeners.clear()
        scope.launch {
            // Cleanup tasks here
        }
    }

    /**
     * Notify all listeners of status change
     */
    private fun notifyStatusChange() {
        onStatus?.invoke(currentStatus)
        statusListeners.forEach { it(currentStatus) }
    }
}
