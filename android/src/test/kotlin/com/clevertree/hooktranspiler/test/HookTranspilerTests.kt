package com.clevertree.hooktranspiler.test

import com.clevertree.hooktranspiler.error.HookError
import com.clevertree.hooktranspiler.model.JsxElement
import com.clevertree.hooktranspiler.styling.ElementRegistry
import com.clevertree.hooktranspiler.styling.ThemeRegistry
import org.junit.Test
import org.junit.Assert.*

/**
 * Basic unit tests for Hook Transpiler Android implementation
 */
class HookTranspilerTests {

    @Test
    fun testElementRegistryEmpty() {
        val registry = ElementRegistry()
        assertEquals(0, registry.size())
    }

    @Test
    fun testElementRegistryRegister() {
        val registry = ElementRegistry()
        registry.registerElement("View", mapOf("id" to "test"))
        assertEquals(1, registry.size())
    }

    @Test
    fun testThemeRegistryEmpty() {
        val registry = ThemeRegistry()
        assertEquals(0, registry.size())
    }

    @Test
    fun testThemeRegistryRegister() {
        val registry = ThemeRegistry()
        registry.registerTheme("dark", mapOf("primary" to "#333"))
        assertEquals(1, registry.size())
    }

    @Test
    fun testJsxElementComponent() {
        val element = JsxElement.Component("View", mapOf("id" to "test"), emptyList())
        assertTrue(element is JsxElement.Component)
    }

    @Test
    fun testJsxElementText() {
        val element = JsxElement.Text("Hello World")
        assertTrue(element is JsxElement.Text)
    }

    @Test
    fun testJsxElementFragment() {
        val element = JsxElement.Fragment(emptyList())
        assertTrue(element is JsxElement.Fragment)
    }

    @Test
    fun testHookErrorNetworkError() {
        val error = HookError.NetworkError("Not found", statusCode = 404)
        assertNotNull(error)
        assertTrue(error is HookError.NetworkError)
    }

    @Test
    fun testHookErrorParseError() {
        val error = HookError.ParseError("Syntax error", line = 10, column = 5)
        assertNotNull(error)
        assertTrue(error is HookError.ParseError)
    }

    @Test
    fun testHookErrorExecutionError() {
        val error = HookError.ExecutionError("Runtime error")
        assertNotNull(error)
        assertTrue(error is HookError.ExecutionError)
    }

    @Test
    fun testHookErrorToUserMessage() {
        val error = HookError.NetworkError("Test error", statusCode = 404)
        val message = error.toUserMessage()
        assertNotNull(message)
        assertTrue(message.contains("Hook not found"))
    }
}

