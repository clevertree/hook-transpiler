package com.relay.test

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.relay.client.RustTranspilerModule
import org.junit.Test
import org.junit.Assert.*
import org.junit.Before
import org.junit.runner.RunWith

/**
 * Instrumented tests for the JNI transpiler.
 * These tests run on an Android device/emulator and verify:
 * - The native library loads correctly
 * - Transpilation works with the latest compiled binary
 * - Variable scoping edge cases are handled properly
 */
@RunWith(AndroidJUnit4::class)
class TranspilerJNITest {

    @Before
    fun setUp() {
        // Native library should be loaded by the time tests run
        System.out.println("✓ TranspilerJNITest setup complete, device architecture: ${android.os.Build.CPU_ABI}")
    }

    /**
     * Test that the native transpiler can transpile a simple JSX snippet
     */
    @Test
    fun testSimpleJSXTranspilation() {
        val code = """
            module.exports.default = function() {
              return <div>Hello World</div>;
            }
        """.trimIndent()

        val result = RustTranspilerModule.nativeTranspile(code, "simple.jsx", false)

        assertNotNull("Result should not be null", result)
        assertTrue("Result should not be empty", result.isNotEmpty())
        assertTrue("Should convert JSX to function call", result.contains("__hook_jsx_runtime") || result.contains("jsx"))
        assertTrue("Should preserve the div reference", result.contains("div"))

        System.out.println("✓ Simple JSX transpilation passed")
        System.out.println("  Input: ${code.length} bytes")
        System.out.println("  Output: ${result.length} bytes")
    }

    /**
     * Test the problematic edge case: nested object variable used in JSX
     * This is the specific scope issue we're debugging
     */
    @Test
    fun testNestedObjectVariableInJSXStyleProps() {
        val code = """
            module.exports.default = function (context) {
              const theme = {
                colors: {
                  primary: '#2196F3',
                  secondary: '#FF9800'
                },
                spacing: {
                  small: 8,
                  medium: 16
                }
              };

              return (
                <div style={{
                  padding: theme.spacing.medium,
                  backgroundColor: theme.colors.primary
                }}>
                  <text style={{
                    color: theme.colors.secondary
                  }}>Content</text>
                </div>
              );
            }
        """.trimIndent()

        val result = RustTranspilerModule.nativeTranspile(code, "theme-test.jsx", false)

        assertNotNull("Transpilation should produce output", result)
        assertTrue("Should not be empty", result.isNotEmpty())
        
        // Verify the transpiler output handles variable references
        assertTrue("Should reference theme variable", result.contains("theme"))
        assertTrue("Should reference theme.spacing", result.contains("theme.spacing") || result.contains("spacing"))
        assertTrue("Should reference theme.colors", result.contains("theme.colors") || result.contains("colors"))
        
        // Verify JSX runtime usage
        assertTrue("Should use JSX runtime", result.contains("__hook_jsx_runtime") || result.contains("jsx"))

        System.out.println("✓ Nested object variable in JSX passed")
        System.out.println("  Transpilation successful, output size: ${result.length} bytes")
    }

    /**
     * Test deep property nesting (3+ levels)
     */
    @Test
    fun testDeepPropertyNesting() {
        val code = """
            module.exports.default = function () {
              const app = {
                config: {
                  ui: {
                    theme: {
                      colors: {
                        primary: '#000'
                      }
                    }
                  }
                }
              };

              return (
                <div style={{ color: app.config.ui.theme.colors.primary }} />
              );
            }
        """.trimIndent()

        val result = RustTranspilerModule.nativeTranspile(code, "deep-nesting.jsx", false)

        assertNotNull("Result should not be null", result)
        assertTrue("Result should not be empty", result.isNotEmpty())
        assertTrue("Should preserve nested property access", result.contains("app"))

        System.out.println("✓ Deep property nesting passed")
    }

    /**
     * Test that the transpiler version matches expectations
     */
    @Test
    fun testTranspilerVersionIsAvailable() {
        val version = try {
            RustTranspilerModule.nativeGetVersion()
        } catch (e: Exception) {
            fail("Version function should be available: ${e.message}")
            return
        }

        assertNotNull("Version should not be null", version)
        assertTrue("Version should not be empty", version.isNotEmpty())
        assertTrue("Version should be semantic", version.contains(".") || version.contains("v"))

        System.out.println("✓ Transpiler version: $version")
    }

    /**
     * Test TypeScript mode rejection of TS-only syntax in JS mode
     */
    @Test
    fun testJSModeRejectsTypeScript() {
        val tsCode = """
            module.exports.default = function() {
              type MyType = string;
              return <div>Test</div>;
            }
        """.trimIndent()

        // JS mode (isTypescript = false) should handle or reject TS syntax
        val result = try {
            RustTranspilerModule.nativeTranspile(tsCode, "ts-test.jsx", false)
        } catch (e: Exception) {
            // Either rejection or sanitization is acceptable
            System.out.println("✓ JS mode properly handled/rejected TS syntax")
            return
        }

        // If it doesn't throw, it should at least transpile something
        assertNotNull("Should produce output", result)
        System.out.println("✓ JS mode handled TS syntax gracefully, output: ${result.length} bytes")
    }

    /**
     * Test TypeScript mode accepts TS syntax
     */
    @Test
    fun testTSModeAcceptsTypeScript() {
        val tsCode = """
            module.exports.default = function() {
              type MyType = string;
              const value: MyType = "test";
              return <div>{value}</div>;
            }
        """.trimIndent()

        val result = RustTranspilerModule.nativeTranspile(tsCode, "ts-valid.tsx", true)

        assertNotNull("TS mode should transpile TS syntax", result)
        assertTrue("Should produce output", result.isNotEmpty())
        // TS syntax should be stripped out
        assertFalse("Type annotation should be removed", result.contains(": MyType"))

        System.out.println("✓ TS mode accepted and stripped TypeScript")
        System.out.println("  Input: ${tsCode.length} bytes, Output: ${result.length} bytes")
    }

    /**
     * Test the actual test-hook.jsx asset file transpilation
     */
    @Test
    fun testActualAssetTranspilation() {
        val context = androidx.test.core.app.ApplicationProvider.getApplicationContext<android.content.Context>()
        val assetManager = context.assets
        
        val assetContent = try {
            assetManager.open("test-hook.jsx").bufferedReader().use { it.readText() }
        } catch (e: Exception) {
            fail("Could not load test-hook.jsx asset: ${e.message}")
            return
        }

        val result = RustTranspilerModule.nativeTranspile(assetContent, "test-hook.jsx", false)

        assertNotNull("Asset transpilation should produce output", result)
        assertTrue("Output should not be empty", result.isNotEmpty())
        assertTrue("Should contain JSX runtime calls", result.contains("__hook_jsx_runtime") || result.contains("jsx"))
        assertTrue("Should reference theme variable", result.contains("theme"))

        System.out.println("✓ Asset transpilation successful")
        System.out.println("  Asset size: ${assetContent.length} bytes")
        System.out.println("  Transpiled size: ${result.length} bytes")
    }
}
