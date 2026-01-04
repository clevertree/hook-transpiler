package com.clevertree.hooktranspiler.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.text.method.ScrollingMovementMethod
import android.view.Gravity
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import com.clevertree.hooktranspiler.model.RendererMode
import androidx.core.view.isVisible
import java.text.SimpleDateFormat
import java.util.*

/**
 * Debug Console Overlay for JavaScript debugging
 * Shows real-time console.log, errors, and warnings
 */
class DebugConsoleOverlay(context: Context) : FrameLayout(context) {
    private val consoleTextView: TextView
    private val toggleButton: Button
    private val hoverButton: Button
    private val clearButton: Button
    private val exportButton: Button
    private val consolePanel: LinearLayout
    private val header: LinearLayout
    private val modeContainer: LinearLayout
    private val btnAct: Button
    private val btnAndroid: Button
    private val btnLogs: Button
    private val btnMarkup: Button
    private val logs = mutableListOf<String>()
    private val dateFormat = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)
    
    var onModeSelected: ((RendererMode) -> Unit)? = null
    private var isExpanded = false
    private var showMarkup = false
    private var currentMarkup = ""
    
    init {
        // Hover button (visible when collapsed)
        hoverButton = Button(context).apply {
            text = "DEBUG"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.argb(180, 0, 0, 0))
            textSize = 10f
            setPadding(8, 4, 8, 4)
            setOnClickListener { toggle() }
        }
        addView(hoverButton, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.BOTTOM or Gravity.END
            setMargins(0, 0, 16, 16)
        })

        // Main container (visible when expanded)
        val mainContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.argb(230, 0, 0, 0))
            isVisible = false
        }
        addView(mainContainer, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.BOTTOM
        })

        // Header with controls
        header = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(Color.argb(255, 33, 33, 33))
            setPadding(4, 4, 4, 4)
        }
        
        toggleButton = Button(context).apply {
            text = "▼ HIDE"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.argb(255, 66, 66, 66))
            textSize = 10f
            setPadding(8, 4, 8, 4)
            setOnClickListener { toggle() }
        }

        modeContainer = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(4, 0, 4, 0)
        }

        btnAct = Button(context).apply {
            text = "Act"
            textSize = 9f
            setBackgroundColor(Color.parseColor("#4CAF50"))
            setTextColor(Color.WHITE)
            setPadding(8, 4, 8, 4)
            setOnClickListener {
                setMode(RendererMode.ACT)
                onModeSelected?.invoke(RendererMode.ACT)
            }
        }

        btnAndroid = Button(context).apply {
            text = "Android"
            textSize = 9f
            setBackgroundColor(Color.parseColor("#2196F3"))
            setTextColor(Color.WHITE)
            setPadding(8, 4, 8, 4)
            setOnClickListener {
                setMode(RendererMode.ANDROID)
                onModeSelected?.invoke(RendererMode.ANDROID)
            }
        }
        modeContainer.addView(btnAct)
        modeContainer.addView(btnAndroid)
        
        clearButton = Button(context).apply {
            text = "Clear"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.argb(255, 220, 53, 69))
            textSize = 9f
            setPadding(8, 4, 8, 4)
            setOnClickListener { clear() }
        }
        
        exportButton = Button(context).apply {
            text = "Export"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.argb(255, 13, 110, 253))
            textSize = 9f
            setPadding(8, 4, 8, 4)
            setOnClickListener { exportLogs() }
        }
        
        header.addView(toggleButton, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        header.addView(modeContainer, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        header.addView(clearButton, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            marginStart = 4
        })
        header.addView(exportButton, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            marginStart = 4
        })
        
        mainContainer.addView(header, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        
        // Sub-header for Logs/Markup toggle
        val subHeader = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(Color.argb(255, 44, 44, 44))
            setPadding(4, 4, 4, 4)
        }
        
        btnLogs = Button(context).apply {
            text = "LOGS"
            textSize = 9f
            setBackgroundColor(Color.parseColor("#28a745"))
            setTextColor(Color.WHITE)
            setPadding(8, 4, 8, 4)
            setOnClickListener { 
                showMarkup = false
                updateView()
            }
        }
        
        btnMarkup = Button(context).apply {
            text = "MARKUP"
            textSize = 9f
            setBackgroundColor(Color.parseColor("#6c757d"))
            setTextColor(Color.WHITE)
            setPadding(8, 4, 8, 4)
            setOnClickListener { 
                showMarkup = true
                updateView()
            }
        }
        
        subHeader.addView(btnLogs, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = 2 })
        subHeader.addView(btnMarkup, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = 2 })
        
        mainContainer.addView(subHeader, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        
        // Console panel
        consolePanel = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.argb(245, 0, 0, 0))
        }
        
        consoleTextView = TextView(context).apply {
            text = "Debug Console Ready\n"
            setTextColor(Color.argb(255, 200, 200, 200))
            typeface = Typeface.MONOSPACE
            textSize = 9f
            setPadding(8, 8, 8, 8)
            movementMethod = ScrollingMovementMethod()
            isVerticalScrollBarEnabled = true
            maxLines = 100
        }
        
        consolePanel.addView(consoleTextView, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dpToPx(200)
        ))
        
        mainContainer.addView(consolePanel, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    }
    
    private fun dpToPx(dp: Int): Int {
        val density = context.resources.displayMetrics.density
        return (dp * density).toInt()
    }
    
    fun toggle() {
        isExpanded = !isExpanded
        val mainContainer = consolePanel.parent as LinearLayout
        mainContainer.isVisible = isExpanded
        hoverButton.isVisible = !isExpanded
    }

    fun setMode(mode: RendererMode) {
        btnAct.isEnabled = mode != RendererMode.ACT
        btnAndroid.isEnabled = mode != RendererMode.ANDROID
        btnAct.alpha = if (mode == RendererMode.ACT) 1.0f else 0.5f
        btnAndroid.alpha = if (mode == RendererMode.ANDROID) 1.0f else 0.5f
    }

    fun setMarkup(markup: String) {
        if (currentMarkup == markup) return
        currentMarkup = markup
        if (showMarkup) {
            updateView(isPeriodicUpdate = true)
        }
    }

    private fun updateView(isPeriodicUpdate: Boolean = false) {
        btnLogs.setBackgroundColor(if (!showMarkup) Color.parseColor("#28a745") else Color.parseColor("#6c757d"))
        btnMarkup.setBackgroundColor(if (showMarkup) Color.parseColor("#28a745") else Color.parseColor("#6c757d"))
        
        consoleTextView.post {
            if (showMarkup) {
                val newText = if (currentMarkup.isEmpty()) "<!-- No markup rendered yet -->" else currentMarkup
                if (consoleTextView.text.toString() != newText) {
                    val oldScrollY = consoleTextView.scrollY
                    consoleTextView.text = newText
                    if (isPeriodicUpdate) {
                        consoleTextView.scrollTo(0, oldScrollY)
                    } else {
                        consoleTextView.scrollTo(0, 0)
                    }
                }
            } else {
                val newText = if (logs.isEmpty()) "Debug Console Ready\n" else logs.joinToString("\n")
                if (consoleTextView.text.toString() != newText) {
                    val oldScrollY = consoleTextView.scrollY
                    val wasAtBottom = isAtBottom()
                    
                    consoleTextView.text = newText
                    
                    if (isPeriodicUpdate && !wasAtBottom) {
                        consoleTextView.scrollTo(0, oldScrollY)
                    } else {
                        // Auto-scroll to bottom for logs if we were already at bottom or it's not periodic
                        val layout = consoleTextView.layout
                        if (layout != null) {
                            val scrollAmount = layout.getLineTop(consoleTextView.lineCount) - consoleTextView.height
                            if (scrollAmount > 0) {
                                consoleTextView.scrollTo(0, scrollAmount)
                            }
                        }
                    }
                }
            }
        }
    }

    private fun isAtBottom(): Boolean {
        val layout = consoleTextView.layout ?: return true
        val scrollAmount = layout.getLineTop(consoleTextView.lineCount) - consoleTextView.height
        return consoleTextView.scrollY >= scrollAmount - 10 // 10px buffer
    }
    
    fun clear() {
        logs.clear()
        currentMarkup = ""
        updateView()
    }
    
    fun log(level: String, message: String) {
        android.util.Log.d("HookJS_Console", "[$level] $message")
        val timestamp = dateFormat.format(Date())
        val colorCode = when (level) {
            "ERROR" -> "\uD83D\uDD34" // 🔴
            "WARN" -> "\uD83D\uDFE1"  // 🟡
            "INFO" -> "\uD83D\uDD35"  // 🔵
            else -> "⚪"
        }
        val logEntry = "[$timestamp] $colorCode $level: $message"
        logs.add(logEntry)
        
        // Keep only last 200 entries
        if (logs.size > 200) {
            logs.removeAt(0)
        }
        
        // Update UI
        if (!showMarkup) {
            updateView(isPeriodicUpdate = true)
        }
    }
    
    fun logError(message: String) = log("ERROR", message)
    fun logWarn(message: String) = log("WARN", message)
    fun logInfo(message: String) = log("INFO", message)
    fun logDebug(message: String) = log("LOG", message)
    
    private fun exportLogs() {
        val content = if (showMarkup) currentMarkup else logs.joinToString("\n")
        if (content.isEmpty()) {
            logWarn("Nothing to export")
            return
        }
        
        try {
            val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(android.content.Intent.EXTRA_SUBJECT, if (showMarkup) "Hook Markup Export" else "Hook Console Logs")
                putExtra(android.content.Intent.EXTRA_TEXT, content)
            }
            context.startActivity(android.content.Intent.createChooser(intent, "Export Hook Debug Data"))
        } catch (e: Exception) {
            logError("Export failed: ${e.message}")
        }
    }
    
    /**
     * Pull logs from JSContext's buffered console
     */
    fun pullFromJSContext(jsContext: com.clevertree.jscbridge.JSContext) {
        try {
            val logsJson = jsContext.evaluateScript(
                """
                (function() {
                    const logs = globalThis.__console_logs || [];
                    const result = JSON.stringify(logs);
                    globalThis.__console_logs = []; // Clear after read
                    return result;
                })();
                """.trimIndent(),
                "console_pull.js"
            )
            
            val logsList = com.google.gson.Gson().fromJson(logsJson, List::class.java) as? List<String> ?: emptyList()
            logsList.forEach { rawLog ->
                when {
                    rawLog.startsWith("[LOG]") -> logDebug(rawLog.substring(5).trim())
                    rawLog.startsWith("[WARN]") -> logWarn(rawLog.substring(6).trim())
                    rawLog.startsWith("[ERROR]") -> logError(rawLog.substring(7).trim())
                    rawLog.startsWith("[INFO]") -> logInfo(rawLog.substring(6).trim())
                    else -> logDebug(rawLog)
                }
            }
        } catch (e: Exception) {
            logError("Failed to pull JS logs: ${e.message}")
        }
    }
}
