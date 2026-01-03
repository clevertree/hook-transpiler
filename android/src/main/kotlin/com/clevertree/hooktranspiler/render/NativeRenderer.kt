package com.clevertree.hooktranspiler.render

import android.content.Context
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.graphics.drawable.GradientDrawable
import android.widget.*
import com.google.gson.Gson
import com.relay.client.ThemedStylerModule
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * Native renderer for Hook components
 * Manages the mapping between JS virtual nodes and Android native views
 */
class NativeRenderer(private val context: Context, private val rootContainer: ViewGroup) {
    private val TAG = "NativeRenderer"
    companion object {
        // Key for storing rounded radius fallback without requiring app resources
        private val TAG_RADIUS_KEY = View.generateViewId()
    }
    private val gson = Gson()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val nodes = ConcurrentHashMap<Int, View>()
    private val viewTypes = ConcurrentHashMap<Int, String>()
    private val lastAppliedStyles = ConcurrentHashMap<Int, Map<String, Any>>()
    private val renderEpoch = AtomicInteger(0)
    private var viewsCreatedInCurrentRender = 0
    private var currentThemeJson: String = "{}"
    
    // Optional: JS context for triggering events back to JS
    private var jsContext: Any? = null

    fun setJSContext(context: Any?) {
        this.jsContext = context
    }

    fun setTheme(themeJson: String) {
        // Inject display metrics into theme for Rust crate
        // The themed-styler crate uses these for accurate unit conversions
        try {
            Log.wtf(TAG, "========== SET THEME CALLED ==========")
            Log.i(TAG, "[Theme] Native version: ${com.relay.client.ThemedStylerModule.nativeGetVersion()}")
            val theme = gson.fromJson(themeJson, MutableMap::class.java) as MutableMap<String, Any>
            Log.i(TAG, "[Theme] Parsed theme keys: ${theme.keys}")
            val currentTheme = theme["current_theme"] as? String
            val themes = theme["themes"] as? Map<String, Any>
            val lightColors = (themes?.get("light") as? Map<String, Any>)?.get("variables") as? Map<String, Any>
            val darkColors = (themes?.get("dark") as? Map<String, Any>)?.get("variables") as? Map<String, Any>
            val defaultSelectors = (themes?.get("default") as? Map<String, Any>)?.get("selectors") as? Map<String, Any>
            
            Log.i(TAG, "[Theme] current_theme: $currentTheme")
            Log.d(TAG, "[Theme] themes available: ${themes?.keys}")
            Log.d(TAG, "[Theme] light.variables: ${lightColors?.keys}")
            Log.d(TAG, "[Theme] dark.variables: ${darkColors?.keys}")
            Log.d(TAG, "[Theme] default.selectors sample: ${defaultSelectors?.keys?.take(5)}")
            
            theme["displayDensity"] = context.resources.displayMetrics.density
            theme["scaledDensity"] = context.resources.displayMetrics.scaledDensity
            this.currentThemeJson = gson.toJson(theme)
            
            Log.i(TAG, "[Theme] Final theme JSON: ${this.currentThemeJson}")
            
            // Update the unified style cache with new theme
            ThemedStylerModule.setTheme(this.currentThemeJson)
            
            Log.d(TAG, "[Theme] Set theme with density=${context.resources.displayMetrics.density} scaledDensity=${context.resources.displayMetrics.scaledDensity}")
            Log.d(TAG, "[Theme] currentThemeJson length: ${this.currentThemeJson.length}")
        } catch (e: Exception) {
            Log.e(TAG, "[Theme] Failed to inject density into theme: ${e.message}", e)
            this.currentThemeJson = themeJson
            ThemedStylerModule.setTheme(this.currentThemeJson)
        }
    }

    fun getViewCount(): Int = viewsCreatedInCurrentRender

    private fun runOnMainThread(action: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            action()
        } else {
            mainHandler.post(action)
        }
    }

    private fun runOnMainThreadBlocking(timeoutMs: Long = 2000, action: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            action()
            return
        }

        val latch = CountDownLatch(1)
        mainHandler.post {
            try {
                action()
            } finally {
                latch.countDown()
            }
        }

        val completed = latch.await(timeoutMs, TimeUnit.MILLISECONDS)
        if (!completed) {
            Log.w(TAG, "Timeout waiting for main-thread execution (timeoutMs=$timeoutMs)")
        }
    }

    private fun isStale(epoch: Int): Boolean = epoch != renderEpoch.get()

    fun createView(tag: Int, type: String, props: Map<String, Any>) {
        Log.d(TAG, "[CREATE_VIEW] tag=$tag, type=$type, isMainThread=${Looper.myLooper() == Looper.getMainLooper()}")
        
        // Ensure view creation happens on main thread, and register immediately after
        runOnMainThreadBlocking {
            val epoch = renderEpoch.get()  // Capture epoch INSIDE main thread to avoid race
            Log.d(TAG, "[CREATE_VIEW_MAIN] tag=$tag, epoch=$epoch")

            try {
                createViewInternal(tag, type, props)
                Log.i(TAG, "[CREATE_VIEW_SUCCESS] tag=$tag, type=$type created (epoch=$epoch, totalViews=$viewsCreatedInCurrentRender)")
            } catch (e: Exception) {
                Log.e(TAG, "[CREATE_VIEW_ERROR] tag=$tag, type=$type", e)
            }
        }
    }

    private fun createViewInternal(tag: Int, type: String, props: Map<String, Any>): View {
        val view = when (type.lowercase()) {
            "div", "view", "section", "header", "footer", "main", "nav", "h1", "h2", "h3", "h4", "h5", "h6", "p", "article", "aside" -> 
                LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
            "text", "span", "label" -> TextView(context)
            "frame" -> FrameLayout(context)
            "button" -> Button(context)
            "img", "image" -> ImageView(context)
            "scroll", "scrollview" -> ScrollView(context)
            else -> LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
        }

        view.id = if (tag > 0) tag else View.generateViewId()
        viewTypes[tag] = type
        nodes[tag] = view  // Register before applying props so updates can run
        viewsCreatedInCurrentRender++

        // Root view (tag=-1) should use FrameLayout.LayoutParams to fill parent width, but wrap height for scrolling
        if (tag == -1) {
            view.layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            Log.d(TAG, "[ROOT_VIEW] Creating root view, current rootContainer.childCount=${rootContainer.childCount}")
            rootContainer.removeAllViews()
            rootContainer.addView(view)
            Log.d(TAG, "[ROOT_VIEW] Root view added, new rootContainer.childCount=${rootContainer.childCount}, rootContainer.visibility=${rootContainer.visibility}")
        } else {
            view.layoutParams = ViewGroup.MarginLayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        updateProps(tag, props)
        return view
    }

    fun addEventListener(tag: Int, event: String) {
        Log.d(TAG, "[addEventListener] CALLED: tag=$tag, event=$event, thread=${Thread.currentThread().name}")
        runOnMainThread {
            val view = nodes[tag]
            Log.d(TAG, "[addEventListener] Inside runOnMainThread: tag=$tag, viewExists=${view != null}")
            if (view == null) {
                Log.w(TAG, "[addEventListener] View not found for tag=$tag")
                return@runOnMainThread
            }
            when (event.lowercase()) {
                "click", "onclick" -> {
                    Log.d(TAG, "[addEventListener] Setting onClickListener for tag=$tag")
                    view.setOnClickListener {
                        Log.d(TAG, "[onClick] Native click detected for tag=$tag")
                        triggerEvent(tag, event, emptyMap<String, Any>())
                    }
                }
            }
        }
    }

    private fun triggerEvent(tag: Int, event: String, data: Map<String, Any>) {
        val ctx = jsContext as? com.clevertree.jscbridge.JSContext ?: return
        val payload = gson.toJson(mapOf(
            "tag" to tag,
            "event" to event,
            "data" to data
        ))
        // We need to call a global function in JS that handles events
        ctx.evaluateScript("if (globalThis.__hook_triggerEvent) globalThis.__hook_triggerEvent($payload);", "event_trigger.js")
    }

    fun updateProps(tag: Int, props: Map<String, Any>) {
        runOnMainThread {
            Log.d(TAG, "[UpdateProps] tag=$tag propsKeys=${props.keys}")
            val view = nodes[tag] ?: return@runOnMainThread
            
            if (props.containsKey("text")) {
                val text = props["text"]?.toString() ?: ""
                Log.d(TAG, "[UpdateProps] tag=$tag setting text='$text'")
                if (view is TextView) {
                    view.text = text
                } else if (view is ViewGroup) {
                    // For ViewGroups, we add a TextView child if it has a text prop
                    val textView = (view.findViewWithTag("text_child") as? TextView) ?: TextView(context).apply {
                        setTag("text_child")
                        view.addView(this, 0)
                    }
                    textView.text = text
                }
            }
            
            // Apply basic styles
            (props["style"] as? Map<String, Any>)?.let { style ->
                applyStyles(view, style)
            }
            
            // Apply className if present (integration with styler)
            val rawClassName = props["className"]
            Log.d(TAG, "[Class-Raw] tag=$tag raw=$rawClassName type=${rawClassName?.javaClass}")
            val className = (rawClassName as? String) ?: ""
            
            Log.d(TAG, "[Class] tag=$tag className=$className")
            Log.d(TAG, "[Props-Update] tag=$tag className=$className")
            
            // Apply themed styles (unified styler)
            applyThemedStyles(view, className)
            
            // Fallback to basic class parsing if no styler is present
            if (className.isNotEmpty()) {
                applyBasicClassStyles(view, className)
            }
            if (props.containsKey("className") && props["className"] !is String) {
                Log.w(TAG, "[Class] tag=$tag className type=${props["className"]?.javaClass} value=${props["className"]}")
            }
        }
    }

    private fun applyStyles(view: View, style: Map<String, Any>) {
        val tag = view.id
        Log.d(TAG, "[Style] Applying styles to tag $tag: $style")
        lastAppliedStyles[tag] = style
        
        val lp = view.layoutParams as? ViewGroup.MarginLayoutParams
        
        var borderRadius = 0f
        var backgroundColor: Int? = null
        var borderWidth = 0
        var borderColor: Int? = null
        
        var pLeft = view.paddingLeft
        var pTop = view.paddingTop
        var pRight = view.paddingRight
        var pBottom = view.paddingBottom

        fun parseNumber(v: Any?): Float? {
            return when (v) {
                is Number -> v.toFloat()
                is String -> v.toFloatOrNull()
                else -> null
            }
        }

        for ((key, value) in style) {
            when (key) {
                "width" -> {
                    val w = when (value.toString()) {
                        "match_parent" -> ViewGroup.LayoutParams.MATCH_PARENT
                        "wrap_content" -> ViewGroup.LayoutParams.WRAP_CONTENT
                        else -> {
                            parseNumber(value)?.toInt() ?: lp?.width ?: ViewGroup.LayoutParams.WRAP_CONTENT
                        }
                    }
                    lp?.width = w
                }
                "height" -> {
                    val h = when (value.toString()) {
                        "match_parent" -> ViewGroup.LayoutParams.MATCH_PARENT
                        "wrap_content" -> ViewGroup.LayoutParams.WRAP_CONTENT
                        else -> {
                            parseNumber(value)?.toInt() ?: lp?.height ?: ViewGroup.LayoutParams.WRAP_CONTENT
                        }
                    }
                    lp?.height = h
                }
                "backgroundColor" -> try { 
                    val colorStr = value.toString()
                    if (colorStr.startsWith("#")) {
                        backgroundColor = Color.parseColor(colorStr)
                        Log.d(TAG, "[Style] tag=$tag backgroundColor=$colorStr parsed=$backgroundColor")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "[Style] tag=$tag failed to parse backgroundColor: $value")
                }
                
                "color" -> {
                    val colorStr = value.toString()
                    Log.d(TAG, "[Style] tag=$tag color=$colorStr")
                    if (view is TextView && colorStr.startsWith("#")) {
                        try { view.setTextColor(Color.parseColor(colorStr)) } catch (e: Exception) {}
                    } else if (view is ViewGroup && colorStr.startsWith("#")) {
                        for (i in 0 until view.childCount) {
                            (view.getChildAt(i) as? TextView)?.let {
                                try { it.setTextColor(Color.parseColor(colorStr)) } catch (e: Exception) {}
                            }
                        }
                    }
                }
                "fontSize" -> {
                    val size = parseNumber(value) ?: 14f
                    if (view is TextView) {
                        view.setTextSize(android.util.TypedValue.COMPLEX_UNIT_PX, size)
                    } else if (view is ViewGroup) {
                        for (i in 0 until view.childCount) {
                            (view.getChildAt(i) as? TextView)?.let {
                                it.setTextSize(android.util.TypedValue.COMPLEX_UNIT_PX, size)
                            }
                        }
                    }
                }
                "fontWeight" -> {
                    val weight = value.toString()
                    val isBold = weight.contains("bold") || 
                                 weight.startsWith("600") || 
                                 weight.startsWith("700") || 
                                 weight.startsWith("500") ||
                                 weight == "600" || weight == "700" || weight == "500"
                    Log.d(TAG, "[Style] tag=$tag fontWeight=$weight isBold=$isBold")
                    if (view is TextView) {
                        view.setTypeface(null, if (isBold) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
                    } else if (view is ViewGroup) {
                        for (i in 0 until view.childCount) {
                            (view.getChildAt(i) as? TextView)?.let {
                                it.setTypeface(null, if (isBold) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
                            }
                        }
                    }
                }
                "textAlign" -> {
                    if (view is TextView) {
                        view.gravity = when (value.toString()) {
                            "center" -> android.view.Gravity.CENTER_HORIZONTAL
                            "right" -> android.view.Gravity.END
                            else -> android.view.Gravity.START
                        }
                    }
                }
                
                "padding" -> {
                    val p = parseNumber(value)?.toInt() ?: 0
                    pLeft = p; pTop = p; pRight = p; pBottom = p
                }
                "paddingTop" -> pTop = parseNumber(value)?.toInt() ?: pTop
                "paddingBottom" -> pBottom = parseNumber(value)?.toInt() ?: pBottom
                "paddingLeft" -> pLeft = parseNumber(value)?.toInt() ?: pLeft
                "paddingRight" -> pRight = parseNumber(value)?.toInt() ?: pRight

                "margin" -> {
                    val m = parseNumber(value)?.toInt() ?: 0
                    lp?.setMargins(m, m, m, m)
                }
                "marginTop" -> {
                    val m = parseNumber(value)?.toInt() ?: lp?.topMargin ?: 0
                    lp?.topMargin = m
                }
                "marginBottom" -> {
                    val m = parseNumber(value)?.toInt() ?: lp?.bottomMargin ?: 0
                    lp?.bottomMargin = m
                }
                "marginLeft" -> {
                    val m = parseNumber(value)?.toInt() ?: lp?.leftMargin ?: 0
                    lp?.leftMargin = m
                }
                "marginRight" -> {
                    val m = parseNumber(value)?.toInt() ?: lp?.rightMargin ?: 0
                    lp?.rightMargin = m
                }
                
                "borderRadius" -> {
                    borderRadius = parseNumber(value) ?: 0f
                    Log.d(TAG, "[Style] tag=$tag borderRadius=$borderRadius")
                }
                "borderWidth" -> {
                    borderWidth = parseNumber(value)?.toInt() ?: 0
                    Log.d(TAG, "[Style] tag=$tag borderWidth=$borderWidth")
                }
                "borderColor" -> try { 
                    val colorStr = value.toString()
                    if (colorStr.startsWith("#")) {
                        borderColor = Color.parseColor(colorStr)
                        Log.d(TAG, "[Style] tag=$tag borderColor=$colorStr parsed=$borderColor")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "[Style] tag=$tag failed to parse borderColor: $value")
                }
                
                "border" -> {
                    val borderStr = value.toString()
                    // Simple parser for "1px solid #color"
                    val parts = borderStr.split(" ")
                    for (part in parts) {
                        if (part.endsWith("px")) {
                            borderWidth = part.removeSuffix("px").toFloatOrNull()?.toInt() ?: borderWidth
                        } else if (part.startsWith("#")) {
                            try { borderColor = Color.parseColor(part) } catch (e: Exception) {}
                        }
                    }
                    Log.d(TAG, "[Style] tag=$tag border=$borderStr parsed: width=$borderWidth color=$borderColor")
                }
                
                "elevation" -> view.elevation = parseNumber(value) ?: 0f
                "boxShadow" -> {
                    // Simple mapping: if there's a boxShadow, give it some elevation
                    if (value.toString().isNotEmpty()) {
                        val elevation = when {
                            value.toString().contains("20px") -> 24f
                            value.toString().contains("15px") -> 16f
                            value.toString().contains("10px") -> 8f
                            value.toString().contains("5px") -> 4f
                            else -> 4f
                        }
                        view.elevation = elevation
                    }
                }

                "display" -> {
                    // Display semantics handled by themed-styler
                }
                "flexDirection" -> {
                    if (view is LinearLayout) {
                        view.orientation = if (value.toString() == "row") LinearLayout.HORIZONTAL else LinearLayout.VERTICAL
                    }
                }
                "androidFlexWrap" -> {
                    // FlexWrap indicator from themed-styler
                    // Android LinearLayout doesn't support wrap natively
                    // Could be implemented with FlexboxLayout if needed
                }
                "androidGravity" -> {
                    if (view is LinearLayout) {
                        view.gravity = when (value.toString()) {
                            "center_vertical" -> android.view.Gravity.CENTER_VERTICAL
                            "top" -> android.view.Gravity.TOP
                            "bottom" -> android.view.Gravity.BOTTOM
                            "center_horizontal" -> android.view.Gravity.CENTER_HORIZONTAL
                            "center" -> android.view.Gravity.CENTER
                            else -> android.view.Gravity.NO_GRAVITY
                        }
                    }
                }
                "androidLayoutGravity" -> {
                    // Layout gravity for positioning within parent
                    // Applied via LayoutParams if needed
                }
                "androidScrollHorizontal", "androidScrollVertical" -> {
                    // Scroll hints from themed-styler
                    // Would need ScrollView wrapper to implement
                }
                "gap", "SpaceY", "SpaceX" -> {
                    val space = parseNumber(value)?.toInt() ?: 0
                    if (view is LinearLayout && space > 0) {
                        val spacer = GradientDrawable().apply {
                            if (key == "SpaceX" || (key == "gap" && view.orientation == LinearLayout.HORIZONTAL)) {
                                setSize(space, 0)
                            } else {
                                setSize(0, space)
                            }
                        }
                        view.dividerDrawable = spacer
                        view.showDividers = LinearLayout.SHOW_DIVIDER_MIDDLE
                    }
                }
                "flex" -> {
                    if (lp is LinearLayout.LayoutParams) {
                        lp.weight = parseNumber(value) ?: 0f
                    }
                }
            }
        }
        
        view.setPadding(pLeft, pTop, pRight, pBottom)
        
        if (borderRadius > 0 || borderWidth > 0 || borderColor != null) {
            Log.d(TAG, "[Style] tag=$tag Creating GradientDrawable: radius=$borderRadius, border=$borderWidth, color=$backgroundColor")
            val shape = GradientDrawable()
            if (borderRadius > 0) shape.cornerRadius = borderRadius
            if (backgroundColor != null) {
                shape.setColor(backgroundColor!!)
            }
            if (borderWidth > 0) {
                shape.setStroke(borderWidth, borderColor ?: Color.BLACK)
            }
            view.background = shape
        } else if (backgroundColor != null) {
            Log.d(TAG, "[Style] tag=$tag Setting simple background color: $backgroundColor")
            view.setBackgroundColor(backgroundColor!!)
        } else {
            // If no background is specified, we might want to clear it if it was set before
            // but for now we leave it as is to avoid flickering
        }
        
        if (lp != null) {
            view.layoutParams = lp
        }
    }

    private fun applyThemedStyles(view: View, className: String) {
        val tag = view.id
        val type = viewTypes[tag] ?: "div"
        
        Log.d(TAG, "[Styler] applyThemedStyles tag=$tag type=$type class='$className'")
        
        try {
            // Use unified style cache (matches web behavior)
            val styles = ThemedStylerModule.getStyles(type, className)
            
            Log.d(TAG, "[Styler] getStyles for tag=$tag type=$type class='$className' -> ${styles.size} properties")
            
            if (styles.isNotEmpty()) {
                Log.d(TAG, "[Styler] Applying ${styles.size} cached styles for tag=$tag")
                applyStyles(view, styles)
            } else {
                Log.w(TAG, "[Styler] No styles found for tag=$tag type=$type class='$className'")
            }
        } catch (e: Exception) {
            Log.e(TAG, "[Styler] Error applying styles for class $className (tag=$tag)", e)
        }
    }

    private fun applyBasicClassStyles(view: View, className: String) {
        // Minimal fallback - themed-styler crate handles all utility classes and conversions
        // This should rarely be called as the Rust crate handles all standard classes  
        Log.d(TAG, "[BasicStyles] Fallback (rarely used): $className for tag=${view.id}")
    }

    fun addChild(parentTag: Int, childTag: Int, index: Int) {
        Log.d(TAG, "addChild: parent=$parentTag, child=$childTag, index=$index")
        runOnMainThreadBlocking {
            val epoch = renderEpoch.get()  // Capture inside main thread
            Log.d(TAG, "[ADD_CHILD_MAIN] parent=$parentTag, child=$childTag, epoch=$epoch")
            val parentNode = nodes[parentTag]
            val child = nodes[childTag] ?: run {
                Log.w(TAG, "addChild failed: child node $childTag not found")
                return@runOnMainThreadBlocking
            }

            // If parent is not a ViewGroup (e.g., TextView/Button), merge text instead of failing
            if (parentTag != -1 && parentNode is TextView && child is TextView) {
                Log.d(TAG, "Merging text child $childTag into non-ViewGroup parent $parentTag")
                parentNode.text = child.text
                nodes.remove(childTag)
                return@runOnMainThreadBlocking
            }

            val parent = if (parentTag == -1) {
                Log.d(TAG, "Adding child $childTag to rootContainer")
                rootContainer
            } else {
                parentNode as? ViewGroup
            }

            if (child.parent != null) {
                (child.parent as ViewGroup).removeView(child)
            }

            if (parent != null) {
                // Ensure child has correct LayoutParams for the parent type
                if (parent is LinearLayout && child.layoutParams !is LinearLayout.LayoutParams) {
                    val oldLp = child.layoutParams as? ViewGroup.MarginLayoutParams
                    val newLp = LinearLayout.LayoutParams(
                        oldLp?.width ?: ViewGroup.LayoutParams.WRAP_CONTENT,
                        oldLp?.height ?: ViewGroup.LayoutParams.WRAP_CONTENT
                    )
                    oldLp?.let {
                        newLp.leftMargin = it.leftMargin
                        newLp.topMargin = it.topMargin
                        newLp.rightMargin = it.rightMargin
                        newLp.bottomMargin = it.bottomMargin
                    }
                    child.layoutParams = newLp
                }

                if (index >= 0 && index < parent.childCount) {
                    parent.addView(child, index)
                } else {
                    parent.addView(child)
                }
                
                Log.d(TAG, "Successfully added child $childTag to parent $parentTag, parent.childCount=${parent.childCount}")
                if (parentTag == -1) {
                    Log.d(TAG, "[ROOT_CHILD] Child added to root, rootContainer.childCount=${rootContainer.childCount}")
                }
                
                // Inherit text styles from parent if child is a TextView
                if (child is TextView) {
                    val parentTag = parent.id
                    lastAppliedStyles[parentTag]?.let { parentStyles ->
                        val textStyles = parentStyles.filterKeys { it in listOf("color", "fontSize", "fontWeight", "textAlign") }
                        if (textStyles.isNotEmpty()) {
                            Log.d(TAG, "Child $childTag inheriting text styles from parent $parentTag: $textStyles")
                            applyStyles(child, textStyles)
                        }
                    }
                }
                
                Log.d(TAG, "Successfully added child $childTag to parent $parentTag")
            } else {
                Log.w(TAG, "addChild failed: parent node $parentTag not found")
            }
        }
    }

    fun removeChild(parentTag: Int, childTag: Int) {
        runOnMainThreadBlocking {
            val parent = if (parentTag == -1) rootContainer else nodes[parentTag] as? ViewGroup
            val child = nodes[childTag] ?: return@runOnMainThreadBlocking
            parent?.removeView(child)
        }
    }

    fun clear(reason: String = "unspecified") {
        runOnMainThreadBlocking {
            val caller = Throwable().stackTrace.getOrNull(1)
            val callerInfo = caller?.let { "${it.className}.${it.methodName}:${it.lineNumber}" } ?: "unknown"
            val oldEpoch = renderEpoch.get()
            Log.d(TAG, "[CLEAR] reason=$reason, caller=$callerInfo, oldEpoch=$oldEpoch, viewsInLastSession=$viewsCreatedInCurrentRender")
            val newEpoch = renderEpoch.incrementAndGet()
            Log.d(TAG, "[CLEAR] Epoch incremented: $oldEpoch -> $newEpoch")
            
            nodes.clear()
            viewTypes.clear()
            lastAppliedStyles.clear()
            rootContainer.removeAllViews()
            viewsCreatedInCurrentRender = 0
            Log.d(TAG, "[CLEAR] Complete. New epoch=$newEpoch, ready for fresh render")
            Log.d(TAG, "[CLEAR] RootContainer state: childCount=${rootContainer.childCount}, visibility=${rootContainer.visibility}, alpha=${rootContainer.alpha}")
        }
    }
}
