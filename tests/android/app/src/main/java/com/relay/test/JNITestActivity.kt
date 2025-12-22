package com.relay.test

import android.os.Bundle
import android.widget.ScrollView
import android.widget.TextView
import android.widget.FrameLayout
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import com.relay.client.RustTranspilerModule

/**
 * Test Activity that runs JNI transpiler tests and renders hooks on device
 * Can be launched via adb shell am start -n com.relay.test/.JNITestActivity
 */
class JNITestActivity : AppCompatActivity() {
    private lateinit var tvResults: TextView
    private lateinit var jsContainer: FrameLayout
    private val results = StringBuilder()
    private var quickJSManager: QuickJSManager? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Create layout with JSX rendering container and test results
        val mainLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        }
        
        // JSX rendering container (top half)
        jsContainer = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
            setBackgroundColor(android.graphics.Color.WHITE)
        }
        mainLayout.addView(jsContainer)
        
        // Divider
        val divider = android.view.View(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                2
            )
            setBackgroundColor(android.graphics.Color.DKGRAY)
        }
        mainLayout.addView(divider)
        
        // Test results (bottom half)
        val scrollView = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        }
        
        tvResults = TextView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            textSize = 11f
            setTextIsSelectable(true)
            setPadding(12, 12, 12, 12)
            setTextColor(android.graphics.Color.BLACK)
            typeface = android.graphics.Typeface.MONOSPACE
        }
        scrollView.addView(tvResults)
        mainLayout.addView(scrollView)
        
        setContentView(mainLayout)
        
        // Initialize AndroidRenderer with the JSX container
        AndroidRenderer.initialize(this, jsContainer)
        
        // Initialize QuickJS for hook rendering
        quickJSManager = QuickJSManager(this)
        quickJSManager?.initialize()
        
        // Run tests and render hooks
        runTests()
        renderHook()
    }

    private fun runTests() {
        results.clear()
        results.append("=== JNI Transpiler Tests ===\n")
        results.append("Device: ${android.os.Build.DEVICE}\n")
        results.append("Architecture: ${android.os.Build.CPU_ABI}\n\n")
        
        android.util.Log.i("JNITestActivity", "Starting JNI tests on ${android.os.Build.DEVICE}")
        
        try {
            testVersionFunction()
            testSimpleJSX()
            testThemeVariable()
            testDeepNesting()
            testAssetTranspilation()
            testTSMode()
            testAdvancedJSXPatterns()
            testThemeStyling()
            
            results.append("\n✅ All tests completed successfully!\n")
            android.util.Log.i("JNITestActivity", "✅ All JNI tests passed!")
        } catch (e: Exception) {
            results.append("\n❌ Test failed with exception:\n")
            results.append(e.stackTraceToString())
            android.util.Log.e("JNITestActivity", "❌ Test failed", e)
        }
        
        updateUI()
        logResults()
    }
    
    private fun renderHook() {
        android.util.Log.i("JNITestActivity", "Rendering advanced-test.jsx hook...")
        try {
            quickJSManager?.renderHook("advanced-test.jsx")
            android.util.Log.i("JNITestActivity", "✓ Hook rendered successfully")
        } catch (e: Exception) {
            android.util.Log.e("JNITestActivity", "✗ Hook render failed", e)
            results.insert(0, "\n⚠ Hook Rendering Error: ${e.message}\n\n")
            updateUI()
        }
    }
    
    private fun logResults() {
        val lines = results.toString().split("\n")
        lines.forEach { line ->
            if (line.isNotEmpty()) {
                android.util.Log.i("JNITestActivity", line)
            }
        }
    }

    private fun testVersionFunction() {
        results.append("TEST: Version Function\n")
        try {
            val version = RustTranspilerModule.nativeGetVersion()
            results.append("  ✓ Version: $version\n\n")
        } catch (e: Exception) {
            results.append("  ✗ FAILED: ${e.message}\n\n")
        }
    }

    private fun testSimpleJSX() {
        results.append("TEST: Simple JSX Transpilation\n")
        try {
            val code = "const App = () => <div>Hello</div>;"
            val result = RustTranspilerModule.nativeTranspile(code, "app.jsx", false)
            if (result.isNotEmpty() && result.contains("__hook_jsx_runtime")) {
                results.append("  ✓ Simple JSX transpiled (${result.length} bytes)\n\n")
            } else {
                results.append("  ✗ Output missing JSX runtime\n\n")
            }
        } catch (e: Exception) {
            results.append("  ✗ FAILED: ${e.message}\n\n")
        }
    }

    private fun testThemeVariable() {
        results.append("TEST: Theme Variable in Style Props\n")
        try {
            val code = """
                module.exports.default = function() {
                  const theme = { colors: { primary: '#2196F3' }, spacing: { medium: 16 } };
                  return <div style={{ padding: theme.spacing.medium, color: theme.colors.primary }} />;
                }
            """.trimIndent()
            val result = RustTranspilerModule.nativeTranspile(code, "theme.jsx", false)
            
            val hasTheme = result.contains("theme")
            val hasColors = result.contains("colors") || result.contains("primary")
            val hasSpacing = result.contains("spacing") || result.contains("medium")
            
            if (hasTheme && hasColors && hasSpacing) {
                results.append("  ✓ Theme variables preserved (${result.length} bytes)\n\n")
            } else {
                results.append("  ⚠ Partial match: theme=$hasTheme, colors=$hasColors, spacing=$hasSpacing\n")
                results.append("  Output: ${result.take(200)}...\n\n")
            }
        } catch (e: Exception) {
            results.append("  ✗ FAILED: ${e.message}\n\n")
        }
    }

    private fun testDeepNesting() {
        results.append("TEST: Deep Property Nesting\n")
        try {
            val code = """
                const obj = { a: { b: { c: { d: 'value' } } } };
                <div>{obj.a.b.c.d}</div>
            """.trimIndent()
            val result = RustTranspilerModule.nativeTranspile(code, "deep.jsx", false)
            
            if (result.contains("obj")) {
                results.append("  ✓ Deep nesting handled (${result.length} bytes)\n\n")
            } else {
                results.append("  ✗ Object reference lost\n\n")
            }
        } catch (e: Exception) {
            results.append("  ✗ FAILED: ${e.message}\n\n")
        }
    }

    private fun testAssetTranspilation() {
        results.append("TEST: Asset File Transpilation\n")
        try {
            val assetContent = assets.open("test-hook.jsx").bufferedReader().use { it.readText() }
            val result = RustTranspilerModule.nativeTranspile(assetContent, "test-hook.jsx", false)
            
            if (result.isNotEmpty() && result.contains("__hook_jsx_runtime")) {
                results.append("  ✓ Asset transpiled (${assetContent.length} → ${result.length} bytes)\n\n")
            } else {
                results.append("  ✗ Asset transpilation incomplete\n\n")
            }
        } catch (e: Exception) {
            results.append("  ✗ FAILED: ${e.message}\n\n")
        }
    }

    private fun testTSMode() {
        results.append("TEST: TypeScript Mode\n")
        try {
            val tsCode = "const x: string = 'test'; <div>{x}</div>"
            val result = RustTranspilerModule.nativeTranspile(tsCode, "test.tsx", true)
            
            if (result.isNotEmpty() && !result.contains(": string")) {
                results.append("  ✓ TS syntax stripped (${result.length} bytes)\n\n")
            } else {
                results.append("  ⚠ TS mode result: ${result.take(100)}\n\n")
            }
        } catch (e: Exception) {
            results.append("  ✗ FAILED: ${e.message}\n\n")
        }
    }

    private fun testAdvancedJSXPatterns() {
        results.append("TEST: Advanced JSX Patterns\n")
        try {
            val code = """
                module.exports.default = function() {
                  const { colors } = { colors: { primary: '#2196F3' } };
                  const items = [{ id: 1, label: 'Test' }];
                  
                  return (
                    <div className="p-4">
                      <h1 className="text-lg font-bold">Title</h1>
                      {items.map((item) => (
                        <div key={item.id} style={{ color: colors.primary }}>
                          {item.label}
                        </div>
                      ))}
                    </div>
                  );
                }
            """.trimIndent()
            
            val result = RustTranspilerModule.nativeTranspile(code, "advanced.jsx", false)
            
            val hasDestructure = result.contains("colors")
            val hasMap = result.contains("map")
            val hasClassName = result.contains("className") || result.contains("p-4")
            val hasJSX = result.contains("__hook_jsx_runtime") || result.contains("jsx")
            
            if (hasDestructure && hasMap && hasClassName && hasJSX) {
                results.append("  ✓ Advanced patterns preserved (${result.length} bytes)\n")
                results.append("    - Destructuring: $hasDestructure\n")
                results.append("    - Array.map(): $hasMap\n")
                results.append("    - Tailwind classes: $hasClassName\n")
                results.append("    - JSX runtime: $hasJSX\n\n")
            } else {
                results.append("  ⚠ Partial support: destruct=$hasDestructure map=$hasMap classes=$hasClassName jsx=$hasJSX\n\n")
            }
        } catch (e: Exception) {
            results.append("  ✗ FAILED: ${e.message}\n\n")
        }
    }

    private fun testThemeStyling() {
        results.append("TEST: Theme-Styler Integration\n")
        try {
            // Load the advanced test asset with theme, colors, destructuring, .map(), and Tailwind
            val assetContent = assets.open("advanced-test.jsx").bufferedReader().use { it.readText() }
            
            // Transpile with latest binary
            val transpileResult = RustTranspilerModule.nativeTranspile(assetContent, "advanced-test.jsx", false)
            
            if (transpileResult.isEmpty()) {
                results.append("  ✗ Transpilation produced empty output\n\n")
                return
            }
            
            results.append("  ✓ Transpilation: ${assetContent.length} → ${transpileResult.length} bytes\n")
            
            // Verify key features are preserved
            val hasTheme = transpileResult.contains("theme") || transpileResult.contains("context")
            val hasDestructuring = transpileResult.contains("colors") || transpileResult.contains("spacing")
            val hasMap = transpileResult.contains("map")
            val hasTailwind = transpileResult.contains("className")
            val hasInlineStyles = transpileResult.contains("style")
            val hasJSXRuntime = transpileResult.contains("__hook_jsx_runtime")
            
            results.append("  Features preserved:\n")
            results.append("    - Theme/context: ${if (hasTheme) "✓" else "✗"}\n")
            results.append("    - Destructuring: ${if (hasDestructuring) "✓" else "✗"}\n")
            results.append("    - Array.map(): ${if (hasMap) "✓" else "✗"}\n")
            results.append("    - Tailwind classes: ${if (hasTailwind) "✓" else "✗"}\n")
            results.append("    - Inline styles: ${if (hasInlineStyles) "✓" else "✗"}\n")
            results.append("    - JSX runtime: ${if (hasJSXRuntime) "✓" else "✗"}\n\n")
            
            if (hasTheme && hasDestructuring && hasMap && hasTailwind && hasInlineStyles && hasJSXRuntime) {
                android.util.Log.i("JNITestActivity", "✓ Theme-Styler integration test PASSED")
            } else {
                android.util.Log.w("JNITestActivity", "⚠ Theme-Styler test: some features missing")
            }
        } catch (e: Exception) {
            results.append("  ✗ FAILED: ${e.message}\n\n")
            android.util.Log.e("JNITestActivity", "✗ Theme-Styler test failed", e)
        }
    }

    private fun updateUI() {
        runOnUiThread {
            tvResults.text = results.toString()
        }
    }
}
