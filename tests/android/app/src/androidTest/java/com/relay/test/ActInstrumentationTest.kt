package com.relay.test

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import android.os.Handler
import android.os.Looper
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class ActInstrumentationTest {
    private lateinit var quickJSManager: QuickJSManager
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val mainHandler = Handler(Looper.getMainLooper())

    @Before
    fun setUp() {
        val latch = CountDownLatch(1)
        mainHandler.post {
            // AndroidRenderer needs a container, we can use a dummy one for tests
            val dummyContainer = android.widget.FrameLayout(context)
            AndroidRenderer.initialize(context, dummyContainer)
            quickJSManager = QuickJSManager(context)
            quickJSManager.initialize()
            latch.countDown()
        }
        latch.await(5, TimeUnit.SECONDS)
    }

    @Test
    fun testActRenderingOnDevice() {
        val latch = CountDownLatch(1)
        var error: Throwable? = null

        mainHandler.post {
            try {
                // We'll inject a test component and render it
                quickJSManager.renderHook("test-hook.jsx")
                latch.countDown()
            } catch (e: Throwable) {
                error = e
                latch.countDown()
            }
        }

        assertTrue("Timeout waiting for render", latch.await(10, TimeUnit.SECONDS))
        if (error != null) throw error!!

        // Verify that AndroidRenderer created views
        // We need to wait a bit for the message queue to drain
        Thread.sleep(1500)

        // AndroidRenderer.nodes should contain the tags
        // test-hook.jsx creates:
        // 1. Root div (tag=-1 is rootContainer, but Act might create a root tag for it)
        // Actually, our renderer.js/act.js creates tags starting from 1.
        // test-hook.jsx has 1 div and 3 text elements.
        // Each text element is wrapped in a span if not inside a span.
        // So:
        // tag 1: root div
        // tag 2: text 1 span
        // tag 3: text 2 span
        // tag 4: text 3 span
        
        val count = AndroidRenderer.getNodeCount()
        assertTrue("Expected at least 4 nodes created, got $count", count >= 4)
    }

    @Test
    fun testAndroid/iOS NativeParityOnDevice() {
        val latch = CountDownLatch(1)
        var error: Throwable? = null

        mainHandler.post {
            try {
                quickJSManager.renderHook("rn-parity.jsx")
                latch.countDown()
            } catch (e: Throwable) {
                error = e
                latch.countDown()
            }
        }

        assertTrue("Timeout waiting for render", latch.await(10, TimeUnit.SECONDS))
        if (error != null) throw error!!

        Thread.sleep(1500)
        
        val count = AndroidRenderer.getNodeCount()
        // rn-parity.jsx has:
        // 1. Root view (tag 1)
        // 2. Text (tag 2) - "Android/iOS Native Parity Test"
        // 3. Text (tag 3) - "Using bridge-based components"
        assertTrue("Expected at least 3 nodes created, got $count", count >= 3)
    }
}
