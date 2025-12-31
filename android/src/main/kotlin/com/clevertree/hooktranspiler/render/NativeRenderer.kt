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

/**
 * Native renderer for Hook components
 * Manages the mapping between JS virtual nodes and Android native views
 */
class NativeRenderer(private val context: Context, private val rootContainer: ViewGroup) {
    private val TAG = "NativeRenderer"
    private val gson = Gson()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val nodes = ConcurrentHashMap<Int, View>()
    private val viewTypes = ConcurrentHashMap<Int, String>()
    private val lastAppliedStyles = ConcurrentHashMap<Int, Map<String, Any>>()
    private var viewsCreatedInCurrentRender = 0
    private var currentThemeJson: String = "{}"
    
    // Optional: JS context for triggering events back to JS
    private var jsContext: Any? = null

    fun setJSContext(context: Any?) {
        this.jsContext = context
    }

    fun setTheme(themeJson: String) {
        this.currentThemeJson = themeJson
    }

    fun getViewCount(): Int = viewsCreatedInCurrentRender

    private fun dpToPx(dp: Float): Int {
        return (dp * context.resources.displayMetrics.density).toInt()
    }

    private fun spToPx(sp: Float): Float {
        return sp * context.resources.displayMetrics.scaledDensity
    }

    private fun runOnMainThread(action: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            action()
        } else {
            mainHandler.post(action)
        }
    }

    fun createView(tag: Int, type: String, props: Map<String, Any>) {
        Log.d(TAG, "createView: tag=$tag, type=$type")
        runOnMainThread {
            try {
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
                nodes[tag] = view
                viewTypes[tag] = type
                viewsCreatedInCurrentRender++

                // Root view (tag=-1) should use FrameLayout.LayoutParams to fill parent width, but wrap height for scrolling
                if (tag == -1) {
                    view.layoutParams = FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    )
                    rootContainer.removeAllViews()
                    rootContainer.addView(view)
                } else {
                    view.layoutParams = ViewGroup.MarginLayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    )
                }

                updateProps(tag, props)
                Log.d(TAG, "Created view: tag=$tag, type=$type")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to create view: tag=$tag, type=$type", e)
            }
        }
    }

    fun addEventListener(tag: Int, event: String) {
        runOnMainThread {
            val view = nodes[tag] ?: return@runOnMainThread
            when (event.lowercase()) {
                "click", "onclick" -> {
                    view.setOnClickListener {
                        triggerEvent(tag, event, emptyMap<String, Any>())
                    }
                }
            }
        }
    }

    private fun triggerEvent(tag: Int, event: String, data: Map<String, Any>) {
        val ctx = jsContext as? com.facebook.jsc.wrapper.JSContext ?: return
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
            val view = nodes[tag] ?: return@runOnMainThread
            
            if (props.containsKey("text")) {
                val text = props["text"]?.toString() ?: ""
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
            (props["className"] as? String)?.let { className ->
                // Fallback to basic class parsing if no styler is present
                applyClassStyles(view, className)
            }
        }
    }

    private fun applyStyles(view: View, style: Map<String, Any>) {
        val tag = view.id
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

        for ((key, value) in style) {
            when (key) {
                "width" -> {
                    val w = when (value.toString()) {
                        "match_parent" -> ViewGroup.LayoutParams.MATCH_PARENT
                        "wrap_content" -> ViewGroup.LayoutParams.WRAP_CONTENT
                        else -> {
                            val num = (value as? Number)?.toFloat() ?: value.toString().toFloatOrNull()
                            if (num != null) dpToPx(num) else lp?.width ?: ViewGroup.LayoutParams.WRAP_CONTENT
                        }
                    }
                    lp?.width = w
                }
                "height" -> {
                    val h = when (value.toString()) {
                        "match_parent" -> ViewGroup.LayoutParams.MATCH_PARENT
                        "wrap_content" -> ViewGroup.LayoutParams.WRAP_CONTENT
                        else -> {
                            val num = (value as? Number)?.toFloat() ?: value.toString().toFloatOrNull()
                            if (num != null) dpToPx(num) else lp?.height ?: ViewGroup.LayoutParams.WRAP_CONTENT
                        }
                    }
                    lp?.height = h
                }
                "backgroundColor" -> try { 
                    backgroundColor = Color.parseColor(value.toString())
                } catch (e: Exception) {}
                
                "color" -> {
                    val colorStr = value.toString()
                    if (view is TextView) {
                        try { view.setTextColor(Color.parseColor(colorStr)) } catch (e: Exception) {}
                    } else if (view is ViewGroup) {
                        for (i in 0 until view.childCount) {
                            (view.getChildAt(i) as? TextView)?.let {
                                try { it.setTextColor(Color.parseColor(colorStr)) } catch (e: Exception) {}
                            }
                        }
                    }
                }
                "fontSize" -> {
                    val size = (value as? Number)?.toFloat() ?: 14f
                    if (view is TextView) {
                        view.textSize = size
                    } else if (view is ViewGroup) {
                        for (i in 0 until view.childCount) {
                            (view.getChildAt(i) as? TextView)?.let {
                                it.textSize = size
                            }
                        }
                    }
                }
                "fontWeight" -> {
                    val weight = value.toString()
                    val isBold = weight.contains("bold") || weight == "600" || weight == "700" || weight == "500"
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
                    val p = dpToPx((value as? Number)?.toFloat() ?: 0f)
                    pLeft = p; pTop = p; pRight = p; pBottom = p
                }
                "paddingTop" -> pTop = dpToPx((value as? Number)?.toFloat() ?: (pTop / context.resources.displayMetrics.density))
                "paddingBottom" -> pBottom = dpToPx((value as? Number)?.toFloat() ?: (pBottom / context.resources.displayMetrics.density))
                "paddingLeft" -> pLeft = dpToPx((value as? Number)?.toFloat() ?: (pLeft / context.resources.displayMetrics.density))
                "paddingRight" -> pRight = dpToPx((value as? Number)?.toFloat() ?: (pRight / context.resources.displayMetrics.density))

                "margin" -> {
                    val m = dpToPx((value as? Number)?.toFloat() ?: 0f)
                    lp?.setMargins(m, m, m, m)
                }
                "marginTop" -> {
                    val m = dpToPx((value as? Number)?.toFloat() ?: (lp?.topMargin?.toFloat() ?: 0f) / context.resources.displayMetrics.density)
                    lp?.topMargin = m
                    Log.d(TAG, "Set marginTop for tag $tag to $m px")
                }
                "marginBottom" -> {
                    val m = dpToPx((value as? Number)?.toFloat() ?: (lp?.bottomMargin?.toFloat() ?: 0f) / context.resources.displayMetrics.density)
                    lp?.bottomMargin = m
                    Log.d(TAG, "Set marginBottom for tag $tag to $m px")
                }
                "marginLeft" -> {
                    val m = dpToPx((value as? Number)?.toFloat() ?: (lp?.leftMargin?.toFloat() ?: 0f) / context.resources.displayMetrics.density)
                    lp?.leftMargin = m
                    Log.d(TAG, "Set marginLeft for tag $tag to $m px")
                }
                "marginRight" -> {
                    val m = dpToPx((value as? Number)?.toFloat() ?: (lp?.rightMargin?.toFloat() ?: 0f) / context.resources.displayMetrics.density)
                    lp?.rightMargin = m
                    Log.d(TAG, "Set marginRight for tag $tag to $m px")
                }
                
                "borderRadius" -> borderRadius = dpToPx((value as? Number)?.toFloat() ?: 0f).toFloat()
                "borderWidth" -> borderWidth = dpToPx((value as? Number)?.toFloat() ?: 0f)
                "borderColor" -> try { borderColor = Color.parseColor(value.toString()) } catch (e: Exception) {}
                
                "elevation" -> view.elevation = dpToPx((value as? Number)?.toFloat() ?: 0f).toFloat()
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
                        view.elevation = dpToPx(elevation).toFloat()
                    }
                }

                "display" -> {
                    if (value.toString() == "flex" && view is LinearLayout) {
                        // In web flex defaults to row, but our default is vertical.
                    }
                }
                "flexDirection" -> {
                    if (view is LinearLayout) {
                        view.orientation = if (value.toString() == "row") LinearLayout.HORIZONTAL else LinearLayout.VERTICAL
                    }
                }
                "gap", "SpaceY", "SpaceX" -> {
                    val space = dpToPx((value as? Number)?.toFloat() ?: 0f)
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
                        lp.weight = (value as? Number)?.toFloat() ?: 0f
                    }
                }
            }
        }
        
        view.setPadding(pLeft, pTop, pRight, pBottom)
        
        if (borderRadius > 0 || borderWidth > 0 || borderColor != null) {
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
            view.setBackgroundColor(backgroundColor!!)
        }
        
        if (lp != null) {
            view.layoutParams = lp
        }
    }

    private fun applyClassStyles(view: View, className: String) {
        val tag = view.id
        val type = viewTypes[tag] ?: "div"
        
        try {
            // Convert space-separated classes to JSON array as expected by the native styler
            val classesList = className.split("\\s+".toRegex()).filter { it.isNotEmpty() }
            val classesJson = gson.toJson(classesList)
            
            Log.d(TAG, "Calling nativeGetAndroidStyles for type=$type, classes=$classesJson, theme=$currentThemeJson")
            val stylesJson = ThemedStylerModule.nativeGetAndroidStyles(type, classesJson, currentThemeJson)
            Log.d(TAG, "nativeGetAndroidStyles returned: $stylesJson")
            
            if (stylesJson != null && stylesJson.isNotEmpty() && stylesJson != "{}") {
                val styles = gson.fromJson(stylesJson, Map::class.java) as? Map<String, Any>
                if (styles != null) {
                    Log.d(TAG, "Applying styles from styler: $styles")
                    applyStyles(view, styles)
                    return
                }
            } else {
                Log.w(TAG, "Styler returned no styles for class $className. No fallback applied.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error applying themed styles for class $className", e)
        }
    }

    private fun applyBasicClassStyles(view: View, className: String) {
        // Simple utility class support
        val classes = className.split("\\s+".toRegex()).filter { it.isNotEmpty() }
        val lp = view.layoutParams as? ViewGroup.MarginLayoutParams
        
        for (cls in classes) {
            when {
                cls == "flex" -> { /* handled in applyStyles if styler returns it */ }
                cls == "flex-row" -> if (view is LinearLayout) view.orientation = LinearLayout.HORIZONTAL
                cls == "flex-col" -> if (view is LinearLayout) view.orientation = LinearLayout.VERTICAL
                cls.startsWith("shadow") -> {
                    view.elevation = when (cls) {
                        "shadow-sm" -> dpToPx(2f).toFloat()
                        "shadow" -> dpToPx(4f).toFloat()
                        "shadow-md" -> dpToPx(8f).toFloat()
                        "shadow-lg" -> dpToPx(16f).toFloat()
                        "shadow-xl" -> dpToPx(24f).toFloat()
                        "shadow-2xl" -> dpToPx(40f).toFloat()
                        else -> dpToPx(4f).toFloat()
                    }
                }
                cls.startsWith("p-") -> {
                    val p = cls.substring(2).toIntOrNull()?.let { dpToPx(it * 4f) } ?: 0
                    view.setPadding(p, p, p, p)
                }
                cls.startsWith("px-") -> {
                    val p = cls.substring(3).toIntOrNull()?.let { dpToPx(it * 4f) } ?: 0
                    view.setPadding(p, view.paddingTop, p, view.paddingBottom)
                }
                cls.startsWith("py-") -> {
                    val p = cls.substring(3).toIntOrNull()?.let { dpToPx(it * 4f) } ?: 0
                    view.setPadding(view.paddingLeft, p, view.paddingRight, p)
                }
                cls.startsWith("m-") -> {
                    val m = cls.substring(2).toIntOrNull()?.let { dpToPx(it * 4f) } ?: 0
                    lp?.setMargins(m, m, m, m)
                }
                cls.startsWith("mx-") -> {
                    val m = cls.substring(3).toIntOrNull()?.let { dpToPx(it * 4f) } ?: 0
                    lp?.leftMargin = m
                    lp?.rightMargin = m
                }
                cls.startsWith("my-") -> {
                    val m = cls.substring(3).toIntOrNull()?.let { dpToPx(it * 4f) } ?: 0
                    lp?.topMargin = m
                    lp?.bottomMargin = m
                }
                cls.startsWith("mb-") -> {
                    val m = cls.substring(3).toIntOrNull()?.let { dpToPx(it * 4f) } ?: 0
                    lp?.bottomMargin = m
                }
                cls.startsWith("mt-") -> {
                    val m = cls.substring(3).toIntOrNull()?.let { dpToPx(it * 4f) } ?: 0
                    lp?.topMargin = m
                }
                cls.startsWith("ml-") -> {
                    val m = cls.substring(3).toIntOrNull()?.let { dpToPx(it * 4f) } ?: 0
                    lp?.leftMargin = m
                }
                cls.startsWith("mr-") -> {
                    val m = cls.substring(3).toIntOrNull()?.let { dpToPx(it * 4f) } ?: 0
                    lp?.rightMargin = m
                }
                cls.startsWith("rounded") -> {
                    // Basic rounded support if styler misses it
                    val r = when (cls) {
                        "rounded-sm" -> 2f
                        "rounded" -> 4f
                        "rounded-md" -> 6f
                        "rounded-lg" -> 8f
                        "rounded-xl" -> 12f
                        "rounded-2xl" -> 16f
                        "rounded-full" -> 999f
                        else -> 4f
                    }
                    // We'll let applyStyles handle the actual background creation if possible,
                    // but we can store it in a tag for now.
                    view.setTag(android.R.id.custom, r)
                }
            }
        }
        if (lp != null) view.layoutParams = lp
    }

    fun addChild(parentTag: Int, childTag: Int, index: Int) {
        Log.d(TAG, "addChild: parent=$parentTag, child=$childTag, index=$index")
        mainHandler.post {
            val parent = if (parentTag == -1) {
                Log.d(TAG, "Adding child $childTag to rootContainer")
                rootContainer
            } else {
                nodes[parentTag] as? ViewGroup
            }
            val child = nodes[childTag] ?: run {
                Log.w(TAG, "addChild failed: child node $childTag not found")
                return@post
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
        mainHandler.post {
            val parent = if (parentTag == -1) rootContainer else nodes[parentTag] as? ViewGroup
            val child = nodes[childTag] ?: return@post
            parent?.removeView(child)
        }
    }

    fun clear() {
        Log.d(TAG, "Clearing renderer. Total views in last session: $viewsCreatedInCurrentRender")
        runOnMainThread {
            nodes.clear()
            viewTypes.clear()
            rootContainer.removeAllViews()
            viewsCreatedInCurrentRender = 0
        }
    }
}
