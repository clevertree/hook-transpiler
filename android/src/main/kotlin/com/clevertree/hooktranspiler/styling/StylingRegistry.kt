package com.clevertree.hooktranspiler.styling

import com.clevertree.hooktranspiler.model.ElementRegistration
import com.clevertree.hooktranspiler.model.StyleSnapshot
import com.clevertree.hooktranspiler.model.ThemeDefinition
import java.util.concurrent.ConcurrentHashMap

/**
 * Registry for tracking UI elements for styling integration
 * Used to bridge hook components with external styling systems (e.g., themed-styler)
 */
class ElementRegistry {
    private val elements = ConcurrentHashMap<String, ElementRegistration>()

    /**
     * Register an element for styling
     */
    fun registerElement(tag: String, props: Map<String, Any?>) {
        elements["$tag-${System.nanoTime()}"] = ElementRegistration(tag, props)
    }

    /**
     * Get all registered elements
     */
    fun getElements(): Map<String, ElementRegistration> = elements.toMap()

    /**
     * Clear all registrations
     */
    fun clear() {
        elements.clear()
    }

    /**
     * Get element count
     */
    fun size(): Int = elements.size
}

/**
 * Registry for theme definitions
 * Used to register and manage theme data from hooks
 */
class ThemeRegistry {
    private val themes = ConcurrentHashMap<String, ThemeDefinition>()

    /**
     * Register a theme
     */
    fun registerTheme(name: String, definitions: Map<String, Any?>) {
        themes[name] = ThemeDefinition(name, definitions)
    }

    /**
     * Get a specific theme
     */
    fun getTheme(name: String): ThemeDefinition? = themes[name]

    /**
     * Get all themes
     */
    fun getThemes(): Map<String, ThemeDefinition> = themes.toMap()

    /**
     * Clear all themes
     */
    fun clear() {
        themes.clear()
    }

    /**
     * Get theme count
     */
    fun size(): Int = themes.size
}

/**
 * Combined styling registry
 */
class StylingRegistry {
    private val elementRegistry = ElementRegistry()
    private val themeRegistry = ThemeRegistry()

    fun getElementRegistry(): ElementRegistry = elementRegistry
    fun getThemeRegistry(): ThemeRegistry = themeRegistry

    /**
     * Get current styling snapshot
     */
    fun getSnapshot(): StyleSnapshot = StyleSnapshot(
        registeredElements = elementRegistry.getElements(),
        themes = themeRegistry.getThemes()
    )

    /**
     * Clear all registries
     */
    fun clear() {
        elementRegistry.clear()
        themeRegistry.clear()
    }
}
