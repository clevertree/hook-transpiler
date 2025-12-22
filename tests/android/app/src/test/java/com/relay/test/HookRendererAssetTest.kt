package com.relay.test

import org.junit.Test
import org.junit.Assert.assertTrue
import java.io.File

class HookRendererAssetTest {
    @Test
    fun hookRendererBundleExistsAndExports() {
        val file = File("src/main/assets/hook-renderer.js")
        assertTrue("hook-renderer.js asset should exist", file.exists())
        val content = file.readText()
        assertTrue("Bundle should define HookTranspilerAndroid global", content.contains("HookTranspilerAndroid"))
        assertTrue("Bundle should include HookRenderer export", content.contains("HookRenderer"))
    }
}
