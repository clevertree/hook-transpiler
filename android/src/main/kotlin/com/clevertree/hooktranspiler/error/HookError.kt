package com.clevertree.hooktranspiler.error

/**
 * Hook-related errors with comprehensive context for debugging
 */
sealed class HookError(override val message: String) : Exception(message) {
    /**
     * Network/HTTP errors
     */
    data class NetworkError(
        override val message: String,
        val statusCode: Int? = null,
        val url: String? = null,
        val errorCause: Throwable? = null
    ) : HookError(message)

    /**
     * JSX parsing errors
     */
    data class ParseError(
        override val message: String,
        val source: String = "",
        val line: Int = 0,
        val column: Int = 0,
        val context: String = ""
    ) : HookError(message)

    /**
     * Hook execution errors (runtime)
     */
    data class ExecutionError(
        override val message: String,
        val sourceCode: String = "",
        val stackTrace: String = "",
        val errorCause: Throwable? = null
    ) : HookError(message)

    /**
     * Rendering errors
     */
    data class RenderError(
        override val message: String,
        val element: String = "",
        val context: String = ""
    ) : HookError(message)

    /**
     * Type/validation errors
     */
    data class ValidationError(
        override val message: String,
        val fieldName: String = "",
        val expectedType: String = ""
    ) : HookError(message)

    /**
     * Generic errors
     */
    data class Generic(
        override val message: String,
        val details: Map<String, Any?> = emptyMap()
    ) : HookError(message)

    /**
     * User-friendly error message
     */
    fun toUserMessage(): String = when (this) {
        is NetworkError -> {
            when {
                statusCode == 404 -> "Hook not found on server"
                statusCode == 403 -> "Access denied to hook"
                statusCode != null -> "Server error (${statusCode})"
                else -> "Network error: $message"
            }
        }
        is ParseError -> "Failed to parse hook JSX: $message"
        is ExecutionError -> "Hook execution failed: $message"
        is RenderError -> "Failed to render hook: $message"
        is ValidationError -> "Invalid hook data: $message"
        is Generic -> message
    }

    /**
     * Developer-friendly detailed message
     */
    fun toDetailedMessage(): String = when (this) {
        is NetworkError -> {
            buildString {
                append("Network Error\n")
                if (url != null) append("URL: $url\n")
                if (statusCode != null) append("Status: $statusCode\n")
                append("Message: $message")
            }
        }
        is ParseError -> {
            buildString {
                append("Parse Error\n")
                if (line > 0) append("Line $line, Column $column\n")
                if (context.isNotEmpty()) append("Context: $context\n")
                append("Message: $message")
            }
        }
        is ExecutionError -> {
            buildString {
                append("Execution Error\n")
                append("Message: $message\n")
                if (stackTrace.isNotEmpty()) append("Stack:\n$stackTrace")
            }
        }
        is RenderError -> {
            buildString {
                append("Render Error\n")
                if (element.isNotEmpty()) append("Element: $element\n")
                append("Message: $message")
            }
        }
        is ValidationError -> {
            buildString {
                append("Validation Error\n")
                if (fieldName.isNotEmpty()) append("Field: $fieldName\n")
                if (expectedType.isNotEmpty()) append("Expected: $expectedType\n")
                append("Message: $message")
            }
        }
        is Generic -> message
    }
}

/**
 * Helper to create detailed error reports
 */
data class HookErrorReport(
    val error: HookError,
    val userMessage: String = error.toUserMessage(),
    val technicalDetails: String = error.toDetailedMessage(),
    val timestamp: Long = System.currentTimeMillis(),
    val stackTrace: String = Thread.currentThread().stackTrace.joinToString("\n")
)
