package com.clevertree.hooktranspiler.app

import com.clevertree.hooktranspiler.error.HookError
import com.clevertree.hooktranspiler.model.HookStatus
import com.clevertree.hooktranspiler.model.StyleSnapshot
import com.clevertree.hooktranspiler.render.HookRenderer
import com.clevertree.hooktranspiler.styling.StylingRegistry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import java.util.concurrent.CopyOnWriteArrayList

/**
 * HookApp: Container for hook lifecycle and state management
 *
 * Simplified responsibilities:
 * 1. Manage hook loading lifecycle (fetch + transpile only)
 * 2. Track loading/error/ready states
 * 3. Coordinate with HookRenderer for fetching and transpiling
 * 4. Expose transpiled code for execution by consumer
 * 
 * Note: Does NOT execute JavaScript - consumers must provide their own JS runtime
 */
class HookApp(
    private val context: android.content.Context,
    private val host: String,
    private val hookPath: String? = null,
    private val onStatus: ((status: HookStatus) -> Unit)? = null,
    private val onError: ((error: HookError) -> Unit)? = null,
    private val onReady: (() -> Unit)? = null,
    private val onLoading: (() -> Unit)? = null
) {
    private val stylingRegistry = StylingRegistry()
    private var currentStatus = HookStatus(hookPath = hookPath ?: "")
    private val statusListeners = CopyOnWriteArrayList<(HookStatus) -> Unit>()
    private val scope = CoroutineScope(Dispatchers.Main)

    private val renderer = HookRenderer(context).apply {
        setHost(host)
        this.onError = { error ->
            currentStatus = currentStatus.copy(error = error.message, loading = false)
            notifyStatusChange()
            this@HookApp.onError?.invoke(error)
        }
        this.onReady = {
            currentStatus = currentStatus.copy(error = null, loading = false, ready = true)
            notifyStatusChange()
            this@HookApp.onReady?.invoke()
        }
        this.onLoading = {
            currentStatus = currentStatus.copy(loading = true, error = null, ready = false)
            notifyStatusChange()
            this@HookApp.onLoading?.invoke()
        }
    }

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
     * Fetch and transpile the hook (does not execute)
     * Returns transpiled code ready for execution
     */
    fun load(path: String? = null) {
        renderer.loadHook(path ?: hookPath ?: "")
    }

    /**
     * Get the renderer view
     */
    fun getView(): HookRenderer = renderer

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

    private fun notifyStatusChange() {
        onStatus?.invoke(currentStatus)
        statusListeners.forEach { it(currentStatus) }
    }

    /**
     * Clear cache and reset state
     */
    fun clear() {
        // renderer.clear() // Add clear to HookRenderer if needed
        stylingRegistry.clear()
        currentStatus = HookStatus(hookPath = "")
        notifyStatusChange()
    }
}
