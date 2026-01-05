package com.clevertree.hooktranspiler.render

import com.clevertree.hooktranspiler.R
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
    private val classNames = ConcurrentHashMap<Int, String>()
    private val jsxIds = ConcurrentHashMap<String, Int>()
    private val tagProps = ConcurrentHashMap<Int, Map<String, Any>>()
    private val tagMap = java.util.WeakHashMap<View, Int>()
    private val lastAppliedStyles = ConcurrentHashMap<Int, Map<String, Any>>()
    private val renderEpoch = AtomicInteger(0)
    private var viewsCreatedInCurrentRender = 0
    
    // Optional: JS context for triggering events back to JS
    private var jsContext: Any? = null

    fun setJSContext(context: Any?) {
        this.jsContext = context
    }

    fun setTheme(themeJson: String) {
        try {
            Log.i(TAG, "[Theme] Native version: ${com.relay.client.ThemedStylerModule.nativeGetVersion()}")
            val density = context.resources.displayMetrics.density
            val scaledDensity = context.resources.displayMetrics.scaledDensity
            
            // Update the unified style cache with new theme
            ThemedStylerModule.setTheme(themeJson, density, scaledDensity)
            
            Log.d(TAG, "[Theme] Set theme with density=$density scaledDensity=$scaledDensity")
        } catch (e: Exception) {
            Log.e(TAG, "[Theme] Failed to set theme: ${e.message}", e)
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
        val styles = try {
            val s = ThemedStylerModule.getStyles(type, className)
            Log.d(TAG, "[CREATE_VIEW_INTERNAL] tag=$tag type=$type className=$className styles=$s")
            s
        } catch (e: Exception) {
            emptyMap<String, Any>()
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
            "text", "span", "label", "h1", "h2", "h3", "h4", "h5", "h6", "p", "MarkdownRenderer" -> TextView(context)
            "table" -> LinearLayout(context).apply { 
                orientation = LinearLayout.VERTICAL 
                containerNodes[tag] = this 
            }
            "table-row" -> LinearLayout(context).apply { 
                orientation = LinearLayout.HORIZONTAL 
                containerNodes[tag] = this 
            }
            "table-cell" -> LinearLayout(context).apply { 
                orientation = LinearLayout.VERTICAL 
                containerNodes[tag] = this 
            }
            "frame" -> FrameLayout(context).apply { containerNodes[tag] = this }
            "button" -> Button(context)
            "img", "image" -> ImageView(context)
            "input" -> {
                val inputType = props["type"]?.toString()?.lowercase()
                when (inputType) {
                    "checkbox" -> androidx.appcompat.widget.AppCompatCheckBox(context)
                    "radio" -> androidx.appcompat.widget.AppCompatRadioButton(context)
                    else -> {
                        if (props.containsKey("list")) {
                            androidx.appcompat.widget.AppCompatAutoCompleteTextView(context).apply {
                                threshold = 1
                            }
                        } else {
                            androidx.appcompat.widget.AppCompatEditText(context)
                        }
                    }
                }
            }
            "textarea" -> androidx.appcompat.widget.AppCompatEditText(context).apply {
                setSingleLine(false)
                inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
                gravity = android.view.Gravity.TOP
            }
            "checkbox" -> androidx.appcompat.widget.AppCompatCheckBox(context)
            "radio" -> androidx.appcompat.widget.AppCompatRadioButton(context)
            "radiogroup" -> android.widget.RadioGroup(context).apply {
                orientation = LinearLayout.VERTICAL
                containerNodes[tag] = this
            }
            "select" -> androidx.appcompat.widget.AppCompatSpinner(context).apply {
                // Spinner is an AdapterView and doesn't support addView().
                // We use a virtual LinearLayout to collect option tags.
                containerNodes[tag] = LinearLayout(context)
                // Reduce default padding to match EditText more closely
                setPadding(paddingLeft, 0, paddingRight, 0)
                minimumHeight = 0
                gravity = android.view.Gravity.CENTER_VERTICAL
            }
            "datalist" -> LinearLayout(context).apply { 
                visibility = View.GONE 
                containerNodes[tag] = this
            }
            "option" -> View(context).apply { visibility = View.GONE }
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
        tagMap[view] = tag
        viewTypes[tag] = type
        classNames[tag] = className
        nodes[tag] = view  // Register before applying props so updates can run
        viewsCreatedInCurrentRender++
        
        view.setTag(R.id.tag_name, type)
        view.setTag(R.id.tag_id, tag)

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
                "change", "onchange", "input", "oninput" -> {
                    if (view is EditText) {
                        Log.d(TAG, "[addEventListener] Setting TextWatcher for tag=$tag")
                        view.addTextChangedListener(object : android.text.TextWatcher {
                            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                                Log.d(TAG, "[onChange] Native text change detected for tag=$tag: $s")
                                triggerEvent(tag, "change", mapOf("value" to s.toString()))
                            }
                            override fun afterTextChanged(s: android.text.Editable?) {}
                        })
                    } else if (view is android.widget.CompoundButton) {
                        view.setOnCheckedChangeListener { _, isChecked ->
                            Log.d(TAG, "[onChange] Native checked change detected for tag=$tag: $isChecked")
                            triggerEvent(tag, "change", mapOf("checked" to isChecked, "value" to isChecked))
                        }
                    } else if (view is androidx.appcompat.widget.AppCompatSpinner) {
                        view.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
                            override fun onItemSelected(parent: android.widget.AdapterView<*>?, v: View?, position: Int, id: Long) {
                                val selectedValue = parent?.getItemAtPosition(position)?.toString() ?: ""
                                Log.d(TAG, "[onChange] Native spinner selection detected for tag=$tag: $selectedValue")
                                triggerEvent(tag, "change", mapOf("value" to selectedValue))
                            }
                            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
                        }
                    } else if (view is android.widget.RadioGroup) {
                        view.setOnCheckedChangeListener { _, checkedId ->
                            val radioButton = view.findViewById<android.widget.RadioButton>(checkedId)
                            val value = radioButton?.text?.toString() ?: ""
                            Log.d(TAG, "[onChange] Native radiogroup change detected for tag=$tag: $value")
                            triggerEvent(tag, "change", mapOf("value" to value))
                        }
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
        tagProps[tag] = props
        runOnMainThread {
            Log.d(TAG, "[UpdateProps] tag=$tag propsKeys=${props.keys} values=${props.values.map { it.toString().take(20) }}")
            val view = nodes[tag] ?: run {
                Log.w(TAG, "[UpdateProps] View not found for tag=$tag")
                return@runOnMainThread
            }
            
            val textValue = props["text"] ?: props["content"]
            if (textValue != null) {
                val text = textValue.toString()
                Log.d(TAG, "[UpdateProps] tag=$tag setting text='${text.take(50)}...'")
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
            
            // 1. Apply themed styles (unified styler) - always call to get base tag styles
            val className = if (props.containsKey("className")) {
                val cn = (props["className"] as? String) ?: ""
                classNames[tag] = cn
                cn
            } else {
                classNames[tag] ?: ""
            }
            applyThemedStyles(view, className)

            // 2. Apply inline styles (can override themed styles)
            val inlineStyle = props["style"]
            if (inlineStyle != null) {
                Log.d(TAG, "[UpdateProps] tag=$tag found inline style: $inlineStyle (type: ${inlineStyle.javaClass.simpleName})")
                if (inlineStyle is Map<*, *>) {
                    val styleMap = inlineStyle as Map<String, Any>
                    // Process inline styles through themed-styler to expand shorthands and convert units
                    val processedStyle = try {
                        @Suppress("UNCHECKED_CAST")
                        ThemedStylerModule.processStyles(styleMap as Map<String, Any>)
                    } catch (e: Exception) {
                        Log.e(TAG, "Error processing inline styles", e)
                        styleMap
                    }
                    applyStyles(view, processedStyle)
                }
            }

            val srcValue = props["src"]
            if (srcValue != null && view is ImageView) {
                val url = srcValue.toString()
                if (url.isNotEmpty()) {
                    Log.d(TAG, "[UpdateProps] tag=$tag loading image src=$url")
                    // Simple image loader for test app
                    Thread {
                        try {
                            val inputStream = java.net.URL(url).openStream()
                            val bitmap = android.graphics.BitmapFactory.decodeStream(inputStream)
                            runOnMainThread {
                                view.setImageBitmap(bitmap)
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "Error loading image: $url", e)
                        }
                    }.start()
                }
            }
            
            if (props.containsKey("className") && props["className"] !is String) {
                Log.w(TAG, "[Class] tag=$tag className type=${props["className"]?.javaClass} value=${props["className"]}")
            }

            // Handle ID mapping for datalist resolution
            (props["id"] as? String)?.let { id ->
                Log.d(TAG, "[ID_MAP] Mapping id=$id to tag=$tag (type=${viewTypes[tag]})")
                jsxIds[id] = tag
                // If this is a datalist, refresh any inputs that might be waiting for it
                if (viewTypes[tag] == "datalist") {
                    Log.d(TAG, "[ID_MAP] Datalist detected, refreshing inputs for $id")
                    refreshInputsForDatalist(id)
                }
            }

            // Handle input-specific props
            if (view is EditText) {
                Log.d(TAG, "[Input] tag=$tag list=${props["list"]}")
                (props["placeholder"] ?: props["hint"])?.let { view.hint = it.toString() }
                (props["value"])?.let { 
                    val text = it.toString()
                    if (view.text.toString() != text) {
                        view.setText(text)
                    }
                }
                
                // Handle input type
                (props["type"] as? String)?.let { type ->
                    view.inputType = when (type.lowercase()) {
                        "password" -> android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
                        "number" -> android.text.InputType.TYPE_CLASS_NUMBER
                        "decimal" -> android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
                        "email" -> android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
                        "phone", "tel" -> android.text.InputType.TYPE_CLASS_PHONE
                        "url" -> android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI
                        "date" -> android.text.InputType.TYPE_CLASS_DATETIME or android.text.InputType.TYPE_DATETIME_VARIATION_DATE
                        "time" -> android.text.InputType.TYPE_CLASS_DATETIME or android.text.InputType.TYPE_DATETIME_VARIATION_TIME
                        "datetime-local" -> android.text.InputType.TYPE_CLASS_DATETIME
                        "search" -> android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_FILTER
                        else -> {
                            if (viewTypes[tag] == "textarea") {
                                android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
                            } else {
                                android.text.InputType.TYPE_CLASS_TEXT
                            }
                        }
                    }
                }

                // Handle rows for textarea
                if (viewTypes[tag] == "textarea") {
                    (props["rows"])?.let { 
                        val rows = when (it) {
                            is Number -> it.toInt()
                            is String -> it.toIntOrNull() ?: 1
                            else -> 1
                        }
                        view.minLines = rows
                    }
                }

                // Handle datalist linking
                if (view is AutoCompleteTextView && props.containsKey("list")) {
                    val listId = props["list"].toString()
                    jsxIds[listId]?.let { listTag ->
                        val options = getDatalistValues(listTag)
                        if (options.isNotEmpty()) {
                            val adapter = ArrayAdapter<String>(context, android.R.layout.simple_dropdown_item_1line, options)
                            view.setAdapter(adapter)
                        }
                    }
                }
            }

            // Handle CheckBox and RadioButton
            if (view is android.widget.CompoundButton) {
                val checked = when (val c = props["checked"]) {
                    is Boolean -> c
                    is String -> c.toBoolean()
                    else -> false
                }
                if (view.isChecked != checked) {
                    view.isChecked = checked
                }
            }

            // Handle Spinner (select)
            if (view is androidx.appcompat.widget.AppCompatSpinner) {
                refreshSelectOptions(tag)
                (props["value"])?.let { value ->
                    val adapter = view.adapter
                    if (adapter != null) {
                        for (i in 0 until adapter.count) {
                            if (adapter.getItem(i).toString() == value.toString()) {
                                if (view.selectedItemPosition != i) {
                                    view.setSelection(i)
                                }
                                break
                            }
                        }
                    }
                }
            }
        }
    }

    private fun refreshSelectOptions(selectTag: Int) {
        val spinner = nodes[selectTag] as? androidx.appcompat.widget.AppCompatSpinner ?: return
        val options = getDatalistValues(selectTag)
        if (options.isNotEmpty()) {
            runOnMainThread {
                val adapter = ArrayAdapter<String>(context, android.R.layout.simple_spinner_item, options)
                adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                spinner.adapter = adapter
                
                // Re-apply value if present
                tagProps[selectTag]?.get("value")?.let { value ->
                    for (i in 0 until adapter.count) {
                        if (adapter.getItem(i).toString() == value.toString()) {
                            spinner.setSelection(i)
                            break
                        }
                    }
                }
            }
        }
    }

    private fun refreshInputsForDatalist(listId: String) {
        for ((tag, props) in tagProps) {
            if (viewTypes[tag] == "input" && props["list"]?.toString() == listId) {
                val view = nodes[tag] as? AutoCompleteTextView ?: continue
                val listTag = jsxIds[listId] ?: continue
                val options = getDatalistValues(listTag)
                if (options.isNotEmpty()) {
                    runOnMainThread {
                        val adapter = ArrayAdapter<String>(context, android.R.layout.simple_dropdown_item_1line, options)
                        view.setAdapter(adapter)
                    }
                }
            }
        }
    }

    private fun getDatalistValues(datalistTag: Int): List<String> {
        val datalistView = (containerNodes[datalistTag] ?: nodes[datalistTag]) as? ViewGroup ?: run {
            Log.w(TAG, "[Datalist] Tag $datalistTag is not a ViewGroup (view=${nodes[datalistTag]?.javaClass?.simpleName})")
            return emptyList()
        }
        val values = mutableListOf<String>()
        for (i in 0 until datalistView.childCount) {
            val child = datalistView.getChildAt(i)
            val childTag = tagMap[child] ?: continue
            val props = tagProps[childTag] ?: continue
            (props["value"] ?: props["text"])?.let { values.add(it.toString()) }
        }
        return values
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
                "androidOrientation" -> {
                    val target = containerNodes[tag] ?: view
                    if (target is LinearLayout) {
                        target.orientation = if (value.toString() == "horizontal") LinearLayout.HORIZONTAL else LinearLayout.VERTICAL
                    }
                }
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
                "placeholderColor" -> {
                    val colorStr = value.toString()
                    if (view is TextView && colorStr.startsWith("#")) {
                        try { view.setHintTextColor(Color.parseColor(colorStr)) } catch (e: Exception) {}
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

                "androidScaleType" -> {
                    if (view is ImageView) {
                        view.scaleType = when (value.toString()) {
                            "center_crop" -> ImageView.ScaleType.CENTER_CROP
                            "fit_center" -> ImageView.ScaleType.FIT_CENTER
                            "fit_xy" -> ImageView.ScaleType.FIT_XY
                            "center" -> ImageView.ScaleType.CENTER
                            "center_inside" -> ImageView.ScaleType.CENTER_INSIDE
                            else -> ImageView.ScaleType.FIT_CENTER
                        }
                    }
                }

                "androidGravity" -> {
                    val target = containerNodes[tag] ?: view
                    if (target is LinearLayout) {
                        var gravity = android.view.Gravity.NO_GRAVITY
                        val parts = value.toString().split("|")
                        for (part in parts) {
                            gravity = gravity or when (part) {
                                "center_vertical" -> android.view.Gravity.CENTER_VERTICAL
                                "top" -> android.view.Gravity.TOP
                                "bottom" -> android.view.Gravity.BOTTOM
                                "center_horizontal" -> android.view.Gravity.CENTER_HORIZONTAL
                                "center" -> android.view.Gravity.CENTER
                                "fill_vertical" -> android.view.Gravity.FILL_VERTICAL
                                "start" -> android.view.Gravity.START
                                "end" -> android.view.Gravity.END
                                else -> android.view.Gravity.NO_GRAVITY
                            }
                        }
                        target.gravity = gravity
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
                    val f = parseNumber(value) ?: 0f
                    if (lp is LinearLayout.LayoutParams) {
                        lp.weight = f
                        if (lp.width == ViewGroup.LayoutParams.WRAP_CONTENT && f > 0) {
                            lp.width = 0
                        }
                    }
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
                if (parent != null) {
                    if (parent.orientation == LinearLayout.VERTICAL) {
                        lp.height = 0
                    } else {
                        lp.width = 0
                    }
                    Log.d(TAG, "[applyStyles] tag=$tag applied weight=$weight, height=${lp.height}, width=${lp.width} (parent orientation=${if (parent.orientation == LinearLayout.VERTICAL) "VERTICAL" else "HORIZONTAL"})")
                } else {
                    Log.d(TAG, "[applyStyles] tag=$tag applied weight=$weight, but parent is null - waiting for addChild to set 0-dimension")
                }
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
                val existingText = parentNode.text.toString()
                val newText = child.text.toString()
                parentNode.text = existingText + newText
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
                            clp.width = 0
                            // Ensure height is not also 0 (which could happen if it was previously in a vertical layout)
                            if (clp.height == 0) {
                                clp.height = ViewGroup.LayoutParams.WRAP_CONTENT
                            }
                        } else {
                            clp.height = 0
                            // Ensure width is not also 0
                            if (clp.width == 0) {
                                clp.width = ViewGroup.LayoutParams.MATCH_PARENT
                            }
                        }
                        Log.d(TAG, "[ADD_CHILD_WEIGHT] tag=$childTag parentTag=$parentTag weight=${clp.weight} orientation=${if (parent.orientation == LinearLayout.HORIZONTAL) "HORIZONTAL" else "VERTICAL"} -> width=${clp.width}, height=${clp.height}")
                    }
                }

                if (index >= 0 && index < parent.childCount) {
                    parent.addView(child, index)
                } else {
                    parent.addView(child)
                }

                // If we added an option to a datalist, refresh linked inputs
                if (viewTypes[parentTag] == "datalist") {
                    tagProps[parentTag]?.get("id")?.toString()?.let { id ->
                        refreshInputsForDatalist(id)
                    }
                }

                // If parent is a select, refresh its options
                if (viewTypes[parentTag] == "select") {
                    refreshSelectOptions(parentTag)
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

    fun getRenderedHierarchy(): String {
        val sb = StringBuilder()
        // Start from root tag -1 if it exists, otherwise try to find the first child of rootContainer
        val root = nodes[-1] ?: if (rootContainer.childCount > 0) rootContainer.getChildAt(0) else null
        
        if (root != null) {
            traverseHierarchy(root, sb, 0)
        } else {
            sb.append("<!-- No views rendered -->")
        }
        return sb.toString()
    }

    private fun traverseHierarchy(view: View, sb: StringBuilder, indent: Int) {
        val tag = tagMap[view] ?: view.id
        val type = viewTypes[tag] ?: view.javaClass.simpleName.replace("AppCompat", "").replace("TextView", "text").replace("LinearLayout", "div").replace("FrameLayout", "div").lowercase()
        val className = classNames[tag] ?: ""
        
        sb.append("  ".repeat(indent))
        sb.append("<$type")
        if (className.isNotEmpty()) {
            sb.append(" class=\"$className\"")
        }
        
        // Check if it's a ViewGroup with children (excluding the internal text_child we might have added)
        val viewGroup = view as? ViewGroup
        val children = mutableListOf<View>()
        if (viewGroup != null) {
            for (i in 0 until viewGroup.childCount) {
                val child = viewGroup.getChildAt(i)
                if (child.tag != "text_child") {
                    children.add(child)
                }
            }
        }

        val textChild = (view as? ViewGroup)?.findViewWithTag<TextView>("text_child")
        val text = if (view is TextView) view.text.toString() else textChild?.text?.toString() ?: ""

        if (children.isNotEmpty()) {
            sb.append(">\n")
            for (child in children) {
                traverseHierarchy(child, sb, indent + 1)
            }
            sb.append("  ".repeat(indent))
            sb.append("</$type>\n")
        } else if (text.isNotEmpty()) {
            sb.append(">")
            sb.append(text)
            sb.append("</$type>\n")
        } else {
            sb.append(" />\n")
        }
    }

    fun removeChild(parentTag: Int, childTag: Int) {
        runOnMainThreadBlocking {
            val parent = if (parentTag == -1) {
                rootContainer
            } else {
                containerNodes[parentTag] ?: nodes[parentTag] as? ViewGroup
            }
            val child = nodes[childTag] ?: return@runOnMainThreadBlocking
            parent?.removeView(child)

            // If parent is a datalist, notify any inputs using it
            if (viewTypes[parentTag] == "datalist") {
                tagProps[parentTag]?.get("id")?.toString()?.let { id ->
                    refreshInputsForDatalist(id)
                }
            }

            // If parent is a select, refresh its options
            if (viewTypes[parentTag] == "select") {
                refreshSelectOptions(parentTag)
            }
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
            containerNodes.clear()
            viewTypes.clear()
            classNames.clear()
            jsxIds.clear()
            tagProps.clear()
            tagMap.clear()
            lastAppliedStyles.clear()
            rootContainer.removeAllViews()
            viewsCreatedInCurrentRender = 0
            Log.d(TAG, "[CLEAR] Complete. New epoch=$newEpoch, ready for fresh render")
            Log.d(TAG, "[CLEAR] RootContainer state: childCount=${rootContainer.childCount}, visibility=${rootContainer.visibility}, alpha=${rootContainer.alpha}")
        }
    }
}
