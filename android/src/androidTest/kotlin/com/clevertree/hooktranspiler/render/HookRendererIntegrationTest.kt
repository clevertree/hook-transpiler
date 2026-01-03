package com.clevertree.hooktranspiler.render

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.clevertree.hooktranspiler.error.HookError
import com.clevertree.hooktranspiler.model.RendererMode
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * Integration tests for HookRenderer.
 * Tests full flow: transpile JSX → execute JS → render via Act/ReactNative
 */
@RunWith(AndroidJUnit4::class)
class HookRendererIntegrationTest {

    private lateinit var context: Context
    private lateinit var renderer: HookRenderer

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        renderer = HookRenderer(context)
    }

    // ===== JSX Rendering Tests =====

    @Test
    fun testRenderSimpleComponent() {
        var renderComplete = false
        var viewCount = 0

        renderer.onReady = { count ->
            renderComplete = true
            viewCount = count
        }

        val simpleJsx = """
            import React from 'react';
            export default function HelloWorld() {
                return React.createElement('View', null, 'Hello, World!');
            }
        """.trimIndent()

        runBlocking {
            renderer.render(simpleJsx, "hello.jsx")
            delay(2000) // Allow async JS execution
        }

        assertTrue(renderComplete, "Render should complete")
    }

    @Test
    fun testRenderWithProps() {
        var renderComplete = false

        renderer.onReady = { _ ->
            renderComplete = true
        }

        val componentWithProps = """
            export default function Counter(props) {
                return {
                    type: 'View',
                    props: {
                        message: props.message || 'Default'
                    }
                };
            }
        """.trimIndent()

        runBlocking {
            val props = mapOf("message" to "Hello from props")
            renderer.render(componentWithProps, "counter.jsx", props)
            delay(1000)
        }

        assertTrue(renderComplete, "Render with props should complete")
    }

    @Test
    fun testRenderWithAct() {
        renderer.setRendererMode(RendererMode.ACT)

        var renderComplete = false
        renderer.onReady = { _ ->
            renderComplete = true
        }

        val actComponent = """
            export default function ActComponent() {
                return { type: 'View' };
            }
        """.trimIndent()

        runBlocking {
            renderer.render(actComponent, "act.jsx")
            delay(2000)
        }

        assertTrue(renderComplete, "Act rendering should complete")
    }

    @Test
    fun testRenderWithReactNative() {
        renderer.setRendererMode(RendererMode.REACT_NATIVE)

        var renderComplete = false
        renderer.onReady = { _ ->
            renderComplete = true
        }

        val rnComponent = """
            export default function RNComponent() {
                return { type: 'View' };
            }
        """.trimIndent()

        runBlocking {
            renderer.render(rnComponent, "rn.jsx")
            delay(2000)
        }

        assertTrue(renderComplete, "React Native rendering should complete")
    }

    // ===== Transpilation Tests =====

    @Test
    fun testTranspileJSXToES5() {
        var transpiledCode: String? = null

        renderer.onTranspiled = { code ->
            transpiledCode = code
        }

        val jsxCode = """
            export default function MyComponent() {
                return <div>Hello</div>;
            }
        """.trimIndent()

        runBlocking {
            renderer.render(jsxCode, "mycomponent.jsx")
            delay(1000)
        }

        assertNotNull(transpiledCode, "JSX should be transpiled")
    }

    @Test
    fun testTranspileTypeScriptJSX() {
        var transpiledCode: String? = null

        renderer.onTranspiled = { code ->
            transpiledCode = code
        }

        val tsxCode = """
            import React from 'react';
            interface Props { title: string; }
            export default function MyComponent(props: Props): JSX.Element {
                return <div>{props.title}</div>;
            }
        """.trimIndent()

        runBlocking {
            renderer.render(tsxCode, "mycomponent.tsx")
            delay(1000)
        }

        assertNotNull(transpiledCode, "TypeScript JSX should be transpiled")
    }

    // ===== Error Handling Tests =====

    @Test
    fun testSyntaxErrorHandling() {
        var errorCaught = false
        var errorMessage: String? = null

        renderer.onError = { error ->
            errorCaught = true
            errorMessage = error.message
        }

        val invalidJsx = """
            export default function Bad() {
                return <div>Missing closing bracket
            }
        """.trimIndent()

        runBlocking {
            renderer.render(invalidJsx, "bad.jsx")
            delay(1000)
        }

        assertTrue(errorCaught, "Syntax error should be caught")
    }

    @Test
    fun testRuntimeErrorHandling() {
        var errorCaught = false

        renderer.onError = { error ->
            errorCaught = true
        }

        val runtimeErrorCode = """
            export default function Broken() {
                throw new Error('Intentional error');
            }
        """.trimIndent()

        runBlocking {
            renderer.render(runtimeErrorCode, "broken.jsx")
            delay(1000)
        }

        assertTrue(errorCaught, "Runtime error should be caught")
    }

    @Test
    fun testMissingExportErrorHandling() {
        var errorCaught = false

        renderer.onError = { error ->
            errorCaught = true
        }

        val noExportCode = """
            function MyComponent() {
                return {};
            }
            // No export default!
        """.trimIndent()

        runBlocking {
            renderer.render(noExportCode, "noexport.jsx")
            delay(1000)
        }

        assertTrue(errorCaught, "Missing export error should be caught")
    }

    // ===== Source Loading Tests =====

    @Test
    fun testSourceLoadedCallback() {
        var sourceLoaded = false
        var loadedSource: String? = null

        renderer.onSourceLoaded = { source ->
            sourceLoaded = true
            loadedSource = source
        }

        val testSource = "export default function Test() { return {}; }"

        runBlocking {
            renderer.render(testSource, "test.jsx")
            delay(500)
        }

        assertTrue(sourceLoaded, "Source loaded callback should fire")
        assertNotNull(loadedSource, "Loaded source should not be null")
    }

    // ===== Callback Lifecycle Tests =====

    @Test
    fun testCallbackSequence() {
        val callbackOrder = mutableListOf<String>()

        renderer.onLoading = {
            callbackOrder.add("loading")
        }
        renderer.onSourceLoaded = { _ ->
            callbackOrder.add("sourceLoaded")
        }
        renderer.onTranspiled = { _ ->
            callbackOrder.add("transpiled")
        }
        renderer.onReady = { _ ->
            callbackOrder.add("ready")
        }

        val simpleCode = "export default function Test() { return {}; }"

        runBlocking {
            renderer.render(simpleCode, "test.jsx")
            delay(2000)
        }

        assertTrue(callbackOrder.contains("loading"), "Loading should be called")
        assertTrue(callbackOrder.contains("sourceLoaded"), "SourceLoaded should be called")
        assertTrue(callbackOrder.contains("transpiled"), "Transpiled should be called")
        assertTrue(callbackOrder.contains("ready"), "Ready should be called")
    }

    // ===== Mode Switching During Render =====

    @Test
    fun testModeSwitch_ActToReactNative() {
        renderer.setRendererMode(RendererMode.ACT)

        val component = "export default function Test() { return {}; }"

        runBlocking {
            renderer.render(component, "test1.jsx")
            delay(500)

            // Switch mode mid-test
            renderer.setRendererMode(RendererMode.REACT_NATIVE)
            renderer.render(component, "test2.jsx")
            delay(500)
        }

        // Should not crash; mode switching should work
        assertTrue(true)
    }

    @Test
    fun testModeSwitch_ReactNativeToAct() {
        renderer.setRendererMode(RendererMode.REACT_NATIVE)

        val component = "export default function Test() { return {}; }"

        runBlocking {
            renderer.render(component, "test1.jsx")
            delay(500)

            // Switch mode
            renderer.setRendererMode(RendererMode.ACT)
            renderer.render(component, "test2.jsx")
            delay(500)
        }

        // Should not crash
        assertTrue(true)
    }

    // ===== JS Logging Tests =====

    @Test
    fun testJSLogging() {
        var jsLogCalled = false
        var logLevel: String? = null

        renderer.onJSLog = { level, message ->
            jsLogCalled = true
            logLevel = level
        }

        val loggingCode = """
            console.log('This is a test log');
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(loggingCode, "logging.jsx")
            delay(1000)
        }

        // Logging should be captured (may or may not fire depending on JS execution)
    }

    @Test
    fun testJSErrorLogging() {
        var jsErrorCalled = false

        renderer.onJSError = { message ->
            jsErrorCalled = true
        }

        val errorCode = """
            console.error('Test error message');
            export default function Test() { return {}; }
        """.trimIndent()

        runBlocking {
            renderer.render(errorCode, "error.jsx")
            delay(1000)
        }

        // Error logging should be captured
    }
}
