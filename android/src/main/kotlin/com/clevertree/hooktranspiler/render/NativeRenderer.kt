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
    init {
        Log.wtf(TAG, "NATIVE_RENDERER_CONSTRUCTOR_CALLED: NativeRenderer instance created!")
    }
    companion object {
        // Key for storing rounded radius fallback without requiring app resources
        private val TAG_RADIUS_KEY = View.generateViewId()
    }
    private val gson = Gson()
    init {
        Log.e(TAG, "NativeRenderer initialized - VERSION 2")
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val nodes = ConcurrentHashMap<Int, View>()
    private val containerNodes = ConcurrentHashMap<Int, ViewGroup>()
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
        val className = props["className"] as? String ?: ""
        val styles = if (className.isNotEmpty()) {
            try {
                val s = ThemedStylerModule.getStyles(type, className)
                Log.d(TAG, "[CREATE_VIEW_INTERNAL] tag=$tag type=$type className=$className styles=$s")
                s
            } catch (e: Exception) {
                emptyMap<String, Any>()
            }
        } else {
            emptyMap()
        }

        val view = when (type.lowercase()) {
            "div", "view", "section", "header", "footer", "main", "nav", "article", "aside" -> {
                val isHorizontalScroll = styles["androidScrollHorizontal"] == true
                val isVerticalScroll = styles["androidScrollVertical"] == true
                
                Log.d(TAG, "[CREATE_VIEW_INTERNAL] tag=$tag type=$type isHorizontalScroll=$isHorizontalScroll isVerticalScroll=$isVerticalScroll")
                
                if (isHorizontalScroll) {
                    HorizontalScrollView(context).apply {
                        isFillViewport = true
                        val inner = LinearLayout(context).apply { 
                            orientation = LinearLayout.HORIZONTAL 
                        }
                        addView(inner)
                        containerNodes[tag] = inner
                    }
                } else if (isVerticalScroll) {
                    ScrollView(context).apply {
                        isFillViewport = true
                        val inner = LinearLayout(context).apply { 
                            orientation = LinearLayout.VERTICAL 
                        }
                        addView(inner)
                        containerNodes[tag] = inner
                    }
                } else {
                    LinearLayout(context).apply { 
                        orientation = LinearLayout.VERTICAL 
                        containerNodes[tag] = this
                    }
                }
            }
            "h1", "h2", "h3", "h4", "h5", "h6", "p" -> {
                LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    containerNodes[tag] = this
                }
            }
            "text", "span", "label" -> TextView(context)
            "frame" -> FrameLayout(context).apply { containerNodes[tag] = this }
            "button" -> Button(context)
            "img", "image" -> ImageView(context)
            "scroll", "scrollview" -> ScrollView(context).apply {
                isFillViewport = true
                val inner = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
                addView(inner)
                containerNodes[tag] = inner
            }
            else -> LinearLayout(context).apply { 
                orientation = LinearLayout.VERTICAL 
                containerNodes[tag] = this
            }
        }

        view.id = if (tag > 0) tag else View.generateViewId()
        viewTypes[tag] = type
        nodes[tag] = view  // Register before applying props so updates can run
        viewsCreatedInCurrentRender++

        // Root view (tag=-1) should use FrameLayout.LayoutParams to fill parent width and height
        // ScrollView with isFillViewport=true will handle the scrolling if content exceeds height
        if (tag == -1) {
            view.layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            if (view is ViewGroup) {
                containerNodes[tag] = view
            }
            Log.d(TAG, "[ROOT_VIEW] Creating root view, current rootContainer.childCount=${rootContainer.childCount}")
            rootContainer.removeAllViews()
            rootContainer.addView(view)
            Log.d(TAG, "[ROOT_VIEW] Root view added, new rootContainer.childCount=${rootContainer.childCount}, rootContainer.visibility=${rootContainer.visibility}")
        } else {
            view.layoutParams = LinearLayout.LayoutParams(
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
            if (props.containsKey("className")) {
                val rawClassName = props["className"]
                val className = (rawClassName as? String) ?: ""
                if (className.isNotEmpty()) {
                    Log.d(TAG, "[UpdateProps] tag=$tag className='$className'")
                }
                Log.d(TAG, "[Class-Raw] tag=$tag raw=$rawClassName type=${rawClassName?.javaClass}")
                
                Log.d(TAG, "[Class] tag=$tag className=$className")
                Log.d(TAG, "[Props-Update] tag=$tag className=$className")
                
                // Apply themed styles (unified styler)
                applyThemedStyles(view, className)
            }
            
            if (props.containsKey("className") && props["className"] !is String) {
                Log.w(TAG, "[Class] tag=$tag className type=${props["className"]?.javaClass} value=${props["className"]}")
            }
        }
    }

    private fun applyStyles(view: View, style: Map<String, Any>) {
        val tag = view.id
        lastAppliedStyles[tag] = style
        
        Log.d(TAG, "[applyStyles] tag=$tag properties=${style.keys}")
        
        var lp = view.layoutParams as? ViewGroup.MarginLayoutParams
        if (lp == null) {
            // Default to LinearLayout.LayoutParams as most views are children of a div (LinearLayout)
            lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            view.layoutParams = lp
        }
        
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
                        else -> parseNumber(value)?.toInt() ?: lp?.width ?: ViewGroup.LayoutParams.WRAP_CONTENT
                    }
                    Log.d(TAG, "[applyStyles] tag=$tag setting width=$w (raw=$value)")
                    lp?.width = w
                }
                "height" -> {
                    val h = when (value.toString()) {
                        "match_parent" -> ViewGroup.LayoutParams.MATCH_PARENT
                        "wrap_content" -> ViewGroup.LayoutParams.WRAP_CONTENT
                        else -> parseNumber(value)?.toInt() ?: lp?.height ?: ViewGroup.LayoutParams.WRAP_CONTENT
                    }
                    Log.d(TAG, "[applyStyles] tag=$tag setting height=$h (raw=$value)")
                    lp?.height = h
                }
                "backgroundColor" -> try { 
                    val colorStr = value.toString()
                    if (colorStr.startsWith("#")) {
                        backgroundColor = Color.parseColor(colorStr)
                    }
                } catch (e: Exception) {}
                
                "color" -> {
                    val colorStr = value.toString()
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
                "androidTextGravity" -> {
                    if (view is TextView) {
                        view.gravity = when (value.toString()) {
                            "center_horizontal" -> android.view.Gravity.CENTER_HORIZONTAL
                            "end" -> android.view.Gravity.END
                            else -> android.view.Gravity.START
                        }
                    }
                }
                "androidTypefaceStyle" -> {
                    val typefaceStyle = when (value.toString()) {
                        "bold" -> android.graphics.Typeface.BOLD
                        "italic" -> android.graphics.Typeface.ITALIC
                        "bold_italic" -> android.graphics.Typeface.BOLD_ITALIC
                        else -> android.graphics.Typeface.NORMAL
                    }
                    if (view is TextView) {
                        view.setTypeface(null, typefaceStyle)
                    } else if (view is ViewGroup) {
                        for (i in 0 until view.childCount) {
                            (view.getChildAt(i) as? TextView)?.let {
                                it.setTypeface(null, typefaceStyle)
                            }
                        }
                    }
                }
                
                "paddingTop" -> pTop = parseNumber(value)?.toInt() ?: pTop
                "paddingBottom" -> pBottom = parseNumber(value)?.toInt() ?: pBottom
                "paddingLeft" -> pLeft = parseNumber(value)?.toInt() ?: pLeft
                "paddingRight" -> pRight = parseNumber(value)?.toInt() ?: pRight

                "marginTop" -> lp?.topMargin = parseNumber(value)?.toInt() ?: lp?.topMargin ?: 0
                "marginBottom" -> lp?.bottomMargin = parseNumber(value)?.toInt() ?: lp?.bottomMargin ?: 0
                "marginLeft" -> lp?.leftMargin = parseNumber(value)?.toInt() ?: lp?.leftMargin ?: 0
                "marginRight" -> lp?.rightMargin = parseNumber(value)?.toInt() ?: lp?.rightMargin ?: 0
                
                "borderRadius" -> borderRadius = parseNumber(value) ?: 0f
                "borderWidth" -> borderWidth = parseNumber(value)?.toInt() ?: 0
                "borderColor" -> try { 
                    val colorStr = value.toString()
                    if (colorStr.startsWith("#")) {
                        borderColor = Color.parseColor(colorStr)
                    }
                } catch (e: Exception) {}
                
                "elevation" -> view.elevation = parseNumber(value) ?: 0f

                "androidOrientation" -> {
                    val target = containerNodes[tag] ?: view
                    if (target is LinearLayout) {
                        target.orientation = if (value.toString() == "horizontal") LinearLayout.HORIZONTAL else LinearLayout.VERTICAL
                    }
                }
                "androidGravity" -> {
                    val target = containerNodes[tag] ?: view
                    if (target is LinearLayout) {
                        target.gravity = when (value.toString()) {
                            "center_vertical" -> android.view.Gravity.CENTER_VERTICAL
                            "top" -> android.view.Gravity.TOP
                            "bottom" -> android.view.Gravity.BOTTOM
                            "center_horizontal" -> android.view.Gravity.CENTER_HORIZONTAL
                            "center" -> android.view.Gravity.CENTER
                            "fill_vertical" -> android.view.Gravity.FILL_VERTICAL
                            else -> android.view.Gravity.NO_GRAVITY
                        }
                    }
                }
                "androidLayoutGravity" -> {
                    if (lp is LinearLayout.LayoutParams) {
                        lp.gravity = when (value.toString()) {
                            "center_horizontal" -> android.view.Gravity.CENTER_HORIZONTAL
                            "start" -> android.view.Gravity.START
                            "end" -> android.view.Gravity.END
                            else -> android.view.Gravity.NO_GRAVITY
                        }
                    }
                }
                "gap" -> {
                    val space = parseNumber(value)?.toInt() ?: 0
                    val target = containerNodes[tag] ?: view
                    if (target is LinearLayout && space > 0) {
                        val spacer = GradientDrawable().apply {
                            if (target.orientation == LinearLayout.HORIZONTAL) {
                                setSize(space, 0)
                            } else {
                                setSize(0, space)
                            }
                        }
                        target.dividerDrawable = spacer
                        target.showDividers = LinearLayout.SHOW_DIVIDER_MIDDLE
                    }
                }
                "flex", "flexGrow" -> {
                    // Handled after loop
                }
                "androidScrollHorizontal", "androidScrollVertical" -> {
                    // Handled in createViewInternal
                }
            }
        }
        
        view.setPadding(pLeft, pTop, pRight, pBottom)
        
        // Apply flex/weight LAST to ensure it can override width/height if needed
        val flexValue = style["flex"] ?: style["flexGrow"]
        if (flexValue != null && lp is LinearLayout.LayoutParams) {
            val weight = parseNumber(flexValue) ?: 0f
            lp.weight = weight
            if (weight > 0) {
                val parent = view.parent as? LinearLayout
                val orientation = parent?.orientation ?: if (style["androidOrientation"] == "horizontal") LinearLayout.HORIZONTAL else LinearLayout.VERTICAL
                if (orientation == LinearLayout.VERTICAL) {
                    lp.height = 0
                } else {
                    lp.width = 0
                }
                Log.d(TAG, "[applyStyles] tag=$tag applied weight=$weight, height=${lp.height}, width=${lp.width}")
            }
        }
        
        if (borderRadius > 0 || borderWidth > 0 || borderColor != null) {
            val shape = GradientDrawable()
            if (borderRadius > 0) {
                shape.cornerRadius = borderRadius
                view.outlineProvider = android.view.ViewOutlineProvider.BACKGROUND
                view.clipToOutline = true
            }
            if (backgroundColor != null) {
                shape.setColor(backgroundColor!!)
            }
            if (borderWidth > 0) {
                shape.setStroke(borderWidth, borderColor ?: Color.BLACK)
            }
            view.background = shape
        } else if (backgroundColor != null) {
            view.setBackgroundColor(backgroundColor!!)
        }
        
        if (lp != null) {
            view.layoutParams = lp
        }
        Log.e(TAG, "[applyStyles] tag=$tag DONE")
    }

    private fun applyThemedStyles(view: View, className: String) {
        val tag = view.id
        val type = viewTypes[tag] ?: "div"
        
        Log.d(TAG, "[Styler] applyThemedStyles tag=$tag type=$type class='$className'")
        
        try {
            // Use unified style cache (matches web behavior)
            val styles = ThemedStylerModule.getStyles(type, className)
            
            Log.d(TAG, "[Styler] getStyles for tag=$tag type=$type class='$className' -> ${styles.size} properties: $styles")
            
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
                containerNodes[parentTag] ?: parentNode as? ViewGroup
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
                } else if (parent is ScrollView && child.layoutParams !is FrameLayout.LayoutParams) {
                    val oldLp = child.layoutParams as? ViewGroup.MarginLayoutParams
                    val newLp = FrameLayout.LayoutParams(
                        oldLp?.width ?: ViewGroup.LayoutParams.MATCH_PARENT,
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

                if (parent is LinearLayout && child.layoutParams is LinearLayout.LayoutParams) {
                    val clp = child.layoutParams as LinearLayout.LayoutParams
                    if (clp.weight > 0) {
                        if (parent.orientation == LinearLayout.HORIZONTAL) {
                            if (clp.width == ViewGroup.LayoutParams.WRAP_CONTENT || clp.width == ViewGroup.LayoutParams.MATCH_PARENT) {
                                clp.width = 0
                            }
                        } else {
                            if (clp.height == ViewGroup.LayoutParams.WRAP_CONTENT || clp.height == ViewGroup.LayoutParams.MATCH_PARENT) {
                                clp.height = 0
                            }
                        }
                    }
                }

                if (index >= 0 && index < parent.childCount) {
                    parent.addView(child, index)
                } else {
                    parent.addView(child)
                }
                
                // Handle justify-between for LinearLayout
                lastAppliedStyles[parentTag]?.let { parentStyles ->
                    val justify = parentStyles["justifyContent"]?.toString() ?: parentStyles["justify-content"]?.toString()
                    if (parent is LinearLayout && (justify == "space-between" || justify == "between")) {
                        if (parent.childCount >= 2) {
                            val firstChild = parent.getChildAt(0)
                            (firstChild.layoutParams as? LinearLayout.LayoutParams)?.let {
                                it.weight = 1f
                                firstChild.layoutParams = it
                            }
                        }
                    }
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
