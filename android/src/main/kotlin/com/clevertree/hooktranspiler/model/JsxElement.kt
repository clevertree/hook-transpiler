package com.clevertree.hooktranspiler.model

import com.clevertree.hooktranspiler.error.HookError

/**
 * Kotlin representation of JSX elements
 * Mirrors web React.ReactElement but without React dependency
 */
sealed class JsxElement {
    /**
     * Component: represents a component/tag with props and children
     * @param name Tag name (e.g., "View", "Text", "Fragment")
     * @param props Attributes/properties
     * @param children Child elements
     * @param key Optional key for list rendering
     */
    data class Component(
        val name: String,
        val props: Map<String, Any?> = emptyMap(),
        val children: List<JsxElement> = emptyList(),
        val key: String? = null
    ) : JsxElement()

    /**
     * Text node: represents a text string
     */
    data class Text(val content: String) : JsxElement()

    /**
     * Fragment: represents a group of elements without a wrapping tag
     */
    data class Fragment(
        val children: List<JsxElement> = emptyList()
    ) : JsxElement()

    /**
     * Expression: represents an interpolated JavaScript expression result
     */
    data class Expression(val value: Any?) : JsxElement()

    /**
     * Empty: represents null, false, undefined, or empty fragment
     */
    object Empty : JsxElement()
}

/**
 * Hook context: provides the execution environment for hooks
 */
data class HookContext(
    val host: String,
    val hookPath: String,
    val onElement: (tag: String, props: Map<String, Any?>) -> Unit,
    val onError: (error: HookError) -> Unit = {},
    val onReady: () -> Unit = {},
    val onLoading: () -> Unit = {},
    val helpers: HookHelpers = HookHelpers()
)

/**
 * React-like helpers provided to hooks
 */
data class HookHelpers(
    val createElement: (type: String, props: Map<String, Any?>?, children: Array<out Any>) -> JsxElement = { _, _, _ -> JsxElement.Empty },
    val Fragment: String = "Fragment"
)

/**
 * Hook status tracking
 */
data class HookStatus(
    val loading: Boolean = false,
    val error: String? = null,
    val hookPath: String = "",
    val ready: Boolean = false,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Styling registration
 */
data class ElementRegistration(
    val tag: String,
    val props: Map<String, Any?>,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Theme definition
 */
data class ThemeDefinition(
    val name: String,
    val definitions: Map<String, Any?>,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Style snapshot for theme integration
 */
data class StyleSnapshot(
    val registeredElements: Map<String, ElementRegistration> = emptyMap(),
    val themes: Map<String, ThemeDefinition> = emptyMap(),
    val timestamp: Long = System.currentTimeMillis()
)
