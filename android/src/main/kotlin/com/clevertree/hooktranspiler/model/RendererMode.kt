package com.clevertree.hooktranspiler.model

/**
 * Supported renderer modes for Hook components
 */
enum class RendererMode {
    /**
     * Use the native Act/Android renderer (default)
     */
    ACT,

    /**
     * Use React Native compatible bridge (for testing or RN integration)
     */
    REACT_NATIVE
}
