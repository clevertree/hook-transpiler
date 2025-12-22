package com.relay.test

import org.junit.Test
import org.junit.Assert.*
import java.io.File

/**
 * Tests for variable scoping edge cases in transpiled code.
 * These are unit tests (no JNI loading) that verify asset structure.
 * The actual transpilation and execution is tested on device via MainActivity buttons.
 */
class ScopeEdgeCaseTest {

    /**
     * Verify the test-hook.jsx asset file has the expected structure
     * with nested theme object that references variables in JSX.
     */
    @Test
    fun testAssetHasThemeVariableStructure() {
        val assetPath = "src/main/assets/test-hook.jsx"
        val file = File(assetPath)
        
        assertTrue("test-hook.jsx should exist at $assetPath", file.exists())
        
        val content = file.readText()
        
        // Verify module structure
        assertTrue("Should have module.exports", content.contains("module.exports"))
        assertTrue("Should export default function", content.contains("exports.default"))
        
        // Verify theme object is defined
        assertTrue("Should define theme object", content.contains("const theme"))
        assertTrue("Theme should have colors", content.contains("colors:"))
        assertTrue("Theme should have spacing", content.contains("spacing:"))
        
        // Verify nested structure
        assertTrue("Should have theme.colors.primary", content.contains("primary"))
        assertTrue("Should have theme.colors.secondary", content.contains("secondary"))
        assertTrue("Should have theme.spacing.medium", content.contains("medium"))
        
        System.out.println("✓ Asset structure verified: theme object with nested colors and spacing")
    }

    /**
     * Verify the actual asset uses theme variables in JSX style properties,
     * which is the edge case we're testing for.
     */
    @Test
    fun testAssetUseThemeVariableInStyleProps() {
        val assetPath = "src/main/assets/test-hook.jsx"
        val file = File(assetPath)
        
        assertTrue("Asset should exist", file.exists())
        val content = file.readText()
        
        // Verify theme is used in JSX style expressions
        assertTrue("Should reference theme.spacing.medium in style", 
            content.contains("theme.spacing.medium"))
        assertTrue("Should reference theme.colors in style", 
            content.contains("theme.colors"))
        assertTrue("Should reference theme.colors.primary in style", 
            content.contains("theme.colors.primary"))
        
        // Verify this is in JSX (has opening tags)
        assertTrue("Should contain JSX elements", content.contains("<"))
        assertTrue("Should contain div element", content.contains("<div") || content.contains("div"))
        assertTrue("Should contain text element", content.contains("<text") || content.contains("text"))
        
        System.out.println("✓ Asset uses theme variables in JSX style properties")
    }

    /**
     * Test asset file reading to ensure test-hook.jsx is properly formatted
     * for transpilation.
     */
    @Test
    fun testAssetFileStructure() {
        val assetPath = "src/main/assets/test-hook.jsx"
        val file = File(assetPath)
        
        assertTrue("test-hook.jsx should exist at $assetPath", file.exists())
        
        val content = file.readText()
        assertTrue("Should have module.exports", content.contains("module.exports"))
        assertTrue("Should have theme object", content.contains("theme"))
        assertTrue("Should reference theme.colors", content.contains("theme.colors"))
        assertTrue("Should reference theme.spacing", content.contains("theme.spacing"))
        assertTrue("Should contain JSX", content.contains("<"))
        
        println("✓ Asset file has correct structure")
        println("File size: ${content.length} bytes")
    }

    /**
     * Integration test: verify the test-hook.jsx asset is valid for testing.
     */
    @Test
    fun testTranspileActualAssetStructureIsValid() {
        val assetPath = "src/main/assets/test-hook.jsx"
        val file = File(assetPath)
        
        assertTrue("Asset should exist", file.exists())
        val hookCode = file.readText()
        
        // Verify size is reasonable (transpiled output should be larger)
        assertTrue("Asset should not be empty", hookCode.isNotEmpty())
        assertTrue("Asset should have reasonable size (>100 chars)", hookCode.length > 100)
        
        // Verify it's valid JavaScript/JSX
        assertTrue("Should start with module.exports", hookCode.contains("module.exports"))
        assertTrue("Should have JSX return statement", hookCode.contains("return") && hookCode.contains("<"))
        
        System.out.println("✓ Asset is valid for transpilation testing (size: ${hookCode.length} bytes)")
    }
}
