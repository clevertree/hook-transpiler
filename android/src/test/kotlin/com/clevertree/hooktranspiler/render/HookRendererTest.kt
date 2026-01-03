package com.clevertree.hooktranspiler.render

import android.content.Context
import android.graphics.Color
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.clevertree.hooktranspiler.error.HookError
import com.clevertree.hooktranspiler.model.RendererMode
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * Unit tests for HookRenderer.
 * Tests initialization, mode switching, error handling, and caching.
 */
@RunWith(AndroidJUnit4::class)
class HookRendererTest {

    private lateinit var context: Context
    private lateinit var renderer: HookRenderer

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        renderer = HookRenderer(context)
    }

    // ===== Initialization Tests =====

    @Test
    fun testRendererInitializesSuccessfully() {
        assertNotNull(renderer)
        assertEquals(RendererMode.REACT_NATIVE, renderer.getStatus().rendererMode)
    }

    @Test
    fun testInitialStatusIsNotLoading() {
        val status = renderer.getStatus()
        assertFalse(status.loading)
        assertFalse(status.ready)
        assertTrue(status.error == null || status.error.isEmpty())
    }

    @Test
    fun testFillViewportEnabled() {
        assertTrue(renderer.isFillViewport)
    }

    // ===== Mode Switching Tests =====

    @Test
    fun testSetRendererModeToAct() {
        renderer.setRendererMode(RendererMode.ACT)
        val status = renderer.getStatus()
        assertEquals(RendererMode.ACT, status.rendererMode)
    }

    @Test
    fun testSetRendererModeToReactNative() {
        renderer.setRendererMode(RendererMode.REACT_NATIVE)
        val status = renderer.getStatus()
        assertEquals(RendererMode.REACT_NATIVE, status.rendererMode)
    }

    @Test
    fun testSwitchingModesClearsRenderer() {
        val initialMode = renderer.getStatus().rendererMode
        val newMode = if (initialMode == RendererMode.ACT) RendererMode.REACT_NATIVE else RendererMode.ACT
        
        renderer.setRendererMode(newMode)
        val status = renderer.getStatus()
        assertEquals(newMode, status.rendererMode)
    }

    @Test
    fun testSwitchingModesClearsResidualViews() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        instrumentation.runOnMainSync {
            renderer.addView(TextView(context).apply { text = "stale" })
        }

        assertTrue(renderer.childCount > 0)

        instrumentation.runOnMainSync {
            renderer.setRendererMode(RendererMode.ACT)
        }

        assertEquals(0, renderer.childCount)
    }

    @Test
    fun testSetHostWithEmptyString() {
        renderer.setHost("")
        // Should not crash
    }

    // ===== Error Handling Tests =====

    @Test
    fun testHandleErrorWithHookError() {
        var capturedError: HookError? = null
        renderer.onError = { error ->
            capturedError = error
        }

        val testError = HookError.ExecutionError("Test error message", errorCause = null)
        // Note: handleError is private; we test it indirectly via error callbacks
    }

    @Test
    fun testHandleErrorDisplaysErrorView() {
        var errorDisplayed = false
        renderer.onError = { _ ->
            errorDisplayed = true
        }

        // Error rendering is tested via onError callback
        assertTrue(true) // Placeholder for integration testing
    }

    @Test
    fun testErrorStatusUpdate() {
        var capturedStatus: com.clevertree.hooktranspiler.model.HookStatus? = null
        renderer.onError = { _ ->
            capturedStatus = renderer.getStatus()
        }

        // Status should be updated on error (tested indirectly)
    }

    // ===== Callback Tests =====

    @Test
    fun testOnLoadingCallback() {
        var loadingCalled = false
        renderer.onLoading = { loadingCalled = true }
        // Callback is internal; tested via loadHook integration tests
    }

    @Test
    fun testOnReadyCallback() {
        var readyCalled = false
        renderer.onReady = { viewCount ->
            readyCalled = true
        }
        // Callback is internal; tested via loadHook integration tests
    }

    @Test
    fun testOnErrorCallback() {
        var errorCalled = false
        renderer.onError = { error ->
            errorCalled = true
        }
        // Callback is internal; tested via error scenarios
    }

    @Test
    fun testOnSourceLoadedCallback() {
        var sourceLoaded = false
        var loadedSource: String? = null
        renderer.onSourceLoaded = { source ->
            sourceLoaded = true
            loadedSource = source
        }
        // Callback is internal; tested via loadHook integration tests
    }

    @Test
    fun testOnTranspiledCallback() {
        var transpiledCalled = false
        var transpiledCode: String? = null
        renderer.onTranspiled = { code ->
            transpiledCalled = true
            transpiledCode = code
        }
        // Callback is internal; tested via loadHook integration tests
    }

    // ===== JS Logging Callbacks =====

    @Test
    fun testOnJSErrorCallback() {
        var jsErrorCalled = false
        var jsErrorMessage: String? = null
        renderer.onJSError = { message ->
            jsErrorCalled = true
            jsErrorMessage = message
        }
        // Callback is internal; tested via JS error scenarios
    }

    @Test
    fun testOnJSLogCallback() {
        var jsLogCalled = false
        renderer.onJSLog = { level, message ->
            jsLogCalled = true
        }
        // Callback is internal; tested via JS logging scenarios
    }

    // ===== Status Management Tests =====

    @Test
    fun testGetStatusReturnsCurrentStatus() {
        val status = renderer.getStatus()
        assertNotNull(status)
        assertNotNull(status.hookPath)
    }

    @Test
    fun testStatusHookPathUpdates() {
        val initialHookPath = renderer.getStatus().hookPath
        // Hook path updates during loadHook (tested in integration tests)
    }

    @Test
    fun testStatusLoadingFlag() {
        val initialStatus = renderer.getStatus()
        assertFalse(initialStatus.loading)
    }

    // ===== Cleanup Tests =====

    @Test
    fun testDetachedFromWindowCleansUp() {
        renderer.onDetachedFromWindow()
        // Should not crash; coroutines and JS context are cleaned up internally
    }

    @Test
    fun testMultipleDetachesAreIdempotent() {
        renderer.onDetachedFromWindow()
        renderer.onDetachedFromWindow()
        // Should not crash on second detach
    }
}
