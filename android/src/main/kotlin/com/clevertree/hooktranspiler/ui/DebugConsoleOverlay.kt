package com.clevertree.hooktranspiler.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.text.method.ScrollingMovementMethod
import android.widget.Button
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
class DebugConsoleOverlay(context: Context) : LinearLayout(context) {
    private val consoleTextView: TextView
    private val toggleButton: Button
    private val clearButton: Button
    private val exportButton: Button
    private val consolePanel: LinearLayout
    private val modeContainer: LinearLayout
    private val btnAct: Button
    private val btnAndroid: Button
    private val logs = mutableListOf<String>()
    private val dateFormat = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)
    
    var onModeSelected: ((RendererMode) -> Unit)? = null
    private var isExpanded = false
    
    init {
        orientation = VERTICAL
        setBackgroundColor(Color.argb(230, 0, 0, 0))
        
        // Header with controls
        val header = LinearLayout(context).apply {
            orientation = HORIZONTAL
            setBackgroundColor(Color.argb(255, 33, 33, 33))
            setPadding(8, 8, 8, 8)
        }
        
        toggleButton = Button(context).apply {
            text = "▲ Debug Console"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.argb(255, 66, 66, 66))
            textSize = 12f
            setPadding(16, 8, 16, 8)
            setOnClickListener { toggle() }
        }

        modeContainer = LinearLayout(context).apply {
            orientation = HORIZONTAL
            setPadding(8, 0, 8, 0)
        }

        btnAct = Button(context).apply {
            text = "Act"
            textSize = 11f
            setBackgroundColor(Color.parseColor("#4CAF50"))
            setTextColor(Color.WHITE)
            setPadding(12, 6, 12, 6)
            setOnClickListener {
                setMode(RendererMode.ACT)
                onModeSelected?.invoke(RendererMode.ACT)
            }
        }

        btnAndroid = Button(context).apply {
            text = "Android"
            textSize = 11f
            setBackgroundColor(Color.parseColor("#2196F3"))
            setTextColor(Color.WHITE)
            setPadding(12, 6, 12, 6)
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
            textSize = 11f
            setPadding(12, 6, 12, 6)
            setOnClickListener { clear() }
        }
        
        exportButton = Button(context).apply {
            text = "Export"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.argb(255, 13, 110, 253))
            textSize = 11f
            setPadding(12, 6, 12, 6)
            setOnClickListener { exportLogs() }
        }
        
        header.addView(toggleButton, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
        header.addView(modeContainer, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT))
        header.addView(clearButton, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
            marginStart = 8
        })
        header.addView(exportButton, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
            marginStart = 8
        })
        
        addView(header, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        
        // Console panel
        consolePanel = LinearLayout(context).apply {
            orientation = VERTICAL
            setBackgroundColor(Color.argb(245, 0, 0, 0))
        }
        
        consoleTextView = TextView(context).apply {
            text = "Debug Console Ready\n"
            setTextColor(Color.argb(255, 200, 200, 200))
            typeface = Typeface.MONOSPACE
            textSize = 10f
            setPadding(12, 12, 12, 12)
            movementMethod = ScrollingMovementMethod()
            isVerticalScrollBarEnabled = true
            maxLines = 100
        }
        
        consolePanel.addView(consoleTextView, LayoutParams(
            LayoutParams.MATCH_PARENT,
            dpToPx(200)
        ))
        
        addView(consolePanel, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        
        // Start collapsed
        consolePanel.isVisible = false
    }
    
    private fun dpToPx(dp: Int): Int {
        val density = context.resources.displayMetrics.density
        return (dp * density).toInt()
    }
    
    fun toggle() {
        isExpanded = !isExpanded
        consolePanel.isVisible = isExpanded
        toggleButton.text = if (isExpanded) "▼ Debug Console" else "▲ Debug Console"
    }

    fun setMode(mode: RendererMode) {
        btnAct.isEnabled = mode != RendererMode.ACT
        btnAndroid.isEnabled = mode != RendererMode.ANDROID
        btnAct.alpha = if (mode == RendererMode.ACT) 1.0f else 0.5f
        btnAndroid.alpha = if (mode == RendererMode.ANDROID) 1.0f else 0.5f
    }
    
    fun clear() {
        logs.clear()
        consoleTextView.text = "Console cleared at ${dateFormat.format(Date())}\n"
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
        consoleTextView.post {
            consoleTextView.text = logs.joinToString("\n")
            // Auto-scroll to bottom
            val layout = consoleTextView.layout
            if (layout != null) {
                val scrollAmount = layout.getLineTop(consoleTextView.lineCount) - consoleTextView.height
                if (scrollAmount > 0) {
                    consoleTextView.scrollTo(0, scrollAmount)
                }
            }
        }
    }
    
    fun logError(message: String) = log("ERROR", message)
    fun logWarn(message: String) = log("WARN", message)
    fun logInfo(message: String) = log("INFO", message)
    fun logDebug(message: String) = log("LOG", message)
    
    private fun exportLogs() {
        // TODO: Implement export to file or share sheet
        logInfo("Export feature: coming soon")
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
