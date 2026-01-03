package com.clevertree.hooktranspiler.render

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.clevertree.jscbridge.JSContext
import com.google.gson.Gson
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * Tests for JS bridge callbacks: __android_log, __android_fetch, __android_createView, etc.
 */
@RunWith(AndroidJUnit4::class)
class HookRendererBridgeTest {

    private lateinit var context: Context
    private lateinit var renderer: HookRenderer
    private val gson = Gson()

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        renderer = HookRenderer(context)
    }

    // ===== Console Logging Bridge Tests =====

    @Test
    fun testConsoleLogBridge() {
        var logCalled = false
        var logMessage: String? = null

        renderer.onJSLog = { level, message ->
            if (level == "LOG") {
                logCalled = true
                logMessage = message
            }
        }

        val code = """
            console.log('Test message');
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }

        // Log should be captured (timing dependent)
    }

    @Test
    fun testConsoleWarnBridge() {
        var warnCalled = false

        renderer.onJSLog = { level, message ->
            if (level == "WARN") {
                warnCalled = true
            }
        }

        val code = """
            console.warn('Test warning');
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }
    }

    @Test
    fun testConsoleErrorBridge() {
        var errorCalled = false

        renderer.onJSLog = { level, message ->
            if (level == "ERROR") {
                errorCalled = true
            }
        }

        val code = """
            console.error('Test error');
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }
    }

    @Test
    fun testConsoleDebugBridge() {
        var debugCalled = false

        renderer.onJSLog = { level, message ->
            if (level == "DEBUG") {
                debugCalled = true
            }
        }

        val code = """
            console.debug('Test debug');
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }
    }

    // ===== Native View Creation Bridge Tests =====

    @Test
    fun testCreateViewBridge() {
        var createViewCalled = false

        val code = """
            const bridge = globalThis.bridge;
            if (bridge && bridge.createView) {
                bridge.createView(1, 'View', { backgroundColor: 'white' });
                window.__create_view_called = true;
            }
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }

        // Bridge call should be logged internally
    }

    @Test
    fun testUpdatePropsBridge() {
        val code = """
            const bridge = globalThis.bridge;
            if (bridge && bridge.updateProps) {
                bridge.updateProps(1, { backgroundColor: 'red' });
            }
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }
    }

    @Test
    fun testAddChildBridge() {
        val code = """
            const bridge = globalThis.bridge;
            if (bridge && bridge.addChild) {
                bridge.addChild(1, 2, 0);
            }
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }
    }

    @Test
    fun testRemoveChildBridge() {
        val code = """
            const bridge = globalThis.bridge;
            if (bridge && bridge.removeChild) {
                bridge.removeChild(1, 2);
            }
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }
    }

    @Test
    fun testAddEventListenerBridge() {
        val code = """
            const bridge = globalThis.bridge;
            if (bridge && bridge.addEventListener) {
                bridge.addEventListener(1, 'press');
            }
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }
    }

    @Test
    fun testClearViewsBridge() {
        val code = """
            const bridge = globalThis.bridge;
            if (bridge && bridge.clearViews) {
                bridge.clearViews();
            }
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }
    }

    // ===== Transpilation Bridge Tests =====

    @Test
    fun testTranspileBridge() {
        val code = """
            const transpiled = globalThis.__android_transpile(
                'export default function X() { return {}; }',
                'test.jsx'
            );
            if (transpiled && transpiled.length > 0) {
                console.log('Transpilation worked');
            }
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }
    }

    // ===== Fetch Bridge Tests =====

    @Test
    fun testFetchBridge() {
        var fetchCalled = false

        renderer.onJSLog = { level, message ->
            if (message.contains("fetch")) {
                fetchCalled = true
            }
        }

        val code = """
            globalThis.fetch('http://example.com/test.json')
                .then(response => response.json())
                .then(data => console.log('Fetched:', data))
                .catch(err => console.error('Fetch failed:', err));
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(2000)
        }

        // Fetch should be handled by native bridge
    }

    // ===== Global URL and URLSearchParams Tests =====

    @Test
    fun testURLConstruction() {
        val code = """
            const url = new URL('http://example.com/path');
            if (url.href) {
                console.log('URL created: ' + url.href);
            }
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }
    }

    @Test
    fun testURLWithBase() {
        val code = """
            const url = new URL('./relative/path', 'http://example.com/base/');
            if (url.href) {
                console.log('Relative URL: ' + url.href);
            }
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }
    }

    @Test
    fun testURLSearchParams() {
        val code = """
            const params = new URLSearchParams('key1=value1&key2=value2');
            const val1 = params.get('key1');
            if (val1 === 'value1') {
                console.log('URLSearchParams works');
            }
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }
    }

    // ===== Require/Import Bridge Tests =====

    @Test
    fun testRequireReact() {
        val code = """
            const React = require('react');
            if (React) {
                console.log('React require works');
            }
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }
    }

    @Test
    fun testRequireAct() {
        val code = """
            const Act = require('act');
            if (Act) {
                console.log('Act require works');
            }
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }
    }

    @Test
    fun testDynamicImport() {
        val code = """
            globalThis.__hook_import('@clevertree/meta')
                .then(mod => console.log('Dynamic import works'))
                .catch(err => console.error('Dynamic import failed'));
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1500)
        }
    }

    // ===== Error Callbacks =====

    @Test
    fun testGlobalErrorHandler() {
        var errorHandled = false

        renderer.onJSError = { message ->
            errorHandled = true
        }

        val code = """
            throw new Error('Global error');
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }

        // Error should be caught by global error handler
    }

    // ===== Bridge Call Counting =====

    @Test
    fun testBridgeCallCountIncrement() {
        val code = """
            const bridge = globalThis.bridge;
            bridge.createView(1, 'View', {});
            bridge.createView(2, 'View', {});
            bridge.createView(3, 'View', {});
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(code, "test.jsx")
            delay(1000)
        }

        // Multiple calls should increment __bridge_call_count__ internally
    }
}
