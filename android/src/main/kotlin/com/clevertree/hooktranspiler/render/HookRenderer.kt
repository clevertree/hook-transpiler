package com.clevertree.hooktranspiler.render

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.util.AttributeSet
import android.util.Log
import android.os.StrictMode
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.clevertree.hooktranspiler.error.HookError
import com.clevertree.hooktranspiler.model.HookStatus
import com.clevertree.hooktranspiler.model.RendererMode
import com.clevertree.hooktranspiler.transpiler.HookTranspiler
import com.clevertree.hooktranspiler.ui.DebugConsoleOverlay
import com.relay.client.ThemedStylerModule
import com.clevertree.jscbridge.JSContext
import com.clevertree.jscbridge.JSException
import com.clevertree.jscbridge.JavaScriptObject
import com.clevertree.jscbridge.JSObject
import com.google.gson.Gson
import kotlinx.coroutines.*
import java.net.URL
import kotlin.coroutines.coroutineContext
import java.util.concurrent.ConcurrentHashMap

/**
 * Native Android Hook Renderer component.
 * Handles fetching, transpiling, and rendering JSX hooks into native Android views.
 */
class HookRenderer @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    private val TAG = "HookRenderer"
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private val transpiler = HookTranspiler()
    private val cache = ConcurrentHashMap<String, String>()
    private var currentLoadJob: Job? = null  // Track current load job for cancellation
    
    private val scrollView: ScrollView
    private val nativeRenderer: NativeRenderer
    private var debugConsole: DebugConsoleOverlay? = null
    private var customThemesJson: String? = null
    
    private var jsContext: JSContext? = null
    private var rendererMode = RendererMode.ANDROID
    private var host: String = ""
    private var currentStatus = HookStatus(hookPath = "")
    private var currentHookPath: String? = null
    private var currentProps: Map<String, Any> = emptyMap()

    // Callbacks
    var onLoading: (() -> Unit)? = null
    var onReady: ((Int) -> Unit)? = null
    var onError: ((HookError) -> Unit)? = null
    var onSourceLoaded: ((String) -> Unit)? = null
    var onTranspiled: ((String) -> Unit)? = null

    init {
        val rootLayout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        }
        addView(rootLayout)

        // Create ScrollView that will hold the rendered content
        scrollView = ScrollView(context).apply {
            setBackgroundColor(android.graphics.Color.parseColor("#F8F9FA"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
            isFillViewport = true
        }
        rootLayout.addView(scrollView)

        nativeRenderer = NativeRenderer(context, scrollView)

        // Place debug console outside the render container at the bottom
        debugConsole = DebugConsoleOverlay(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            logInfo("Debug console ready")
            onModeSelected = { mode ->
                Log.i(TAG, "[MODE_SWITCH] Requested from console: $mode")
                switchMode(mode)
            }
        }
        rootLayout.addView(debugConsole)
        
        updateModeButtons()
        setupEngine()
    }
    
    private fun switchMode(mode: RendererMode) {
        setRendererMode(mode)
        updateModeButtons()
        // Auto-reload current hook if one was loaded
        currentHookPath?.let { path ->
            Log.d(TAG, "[MODE_SWITCH] Auto-reloading hook: $path")
            loadHook(path, currentProps)  // Preserve props on reload
        }
    }
    
    private fun updateModeButtons() {
        debugConsole?.setMode(rendererMode)
        Log.d(TAG, "[MODE_BUTTONS] Current mode: $rendererMode")
    }

    /**
     * Set the host URL for remote hooks
     */
    fun setHost(hostUrl: String) {
        this.host = hostUrl
    }

    /**
     * Set the renderer mode (ACT or ANDROID)
     */
    fun setRendererMode(mode: RendererMode) {
        Log.i(TAG, "[MODE_SWITCH] Switching from ${this.rendererMode} to $mode")
        this.rendererMode = mode
        
        // Clean up old context first
        jsContext?.let { oldCtx ->
            try {
                Log.d(TAG, "[MODE_SWITCH] Destroying old JSContext")
                // Try to cleanup the old context
                oldCtx.evaluateScript("globalThis.Act = null; globalThis.Android = null; globalThis.React = null;", "cleanup.js")
            } catch (e: Exception) {
                Log.w(TAG, "[MODE_SWITCH] Error cleaning up old context", e)
            }
        }
        jsContext = null
        
        // Don't clear here - let executeJs do it to avoid double-clearing
        Log.d(TAG, "[MODE_SWITCH] Setting up $mode engine (clear will happen in executeJs)")
        setupEngine()
        
        // Verify runtime loaded correctly
        jsContext?.let { ctx ->
            try {
                when (mode) {
                    RendererMode.ACT -> {
                        val hasAct = ctx.evaluateScript("typeof globalThis.Act !== 'undefined' && typeof globalThis.Act.render === 'function'", "verify_act.js")
                        Log.d(TAG, "[MODE_SWITCH] Act verification: $hasAct")
                        if (hasAct.toString() != "true") {
                            Log.e(TAG, "[MODE_SWITCH ERROR] Runtime verification failed for $mode - Act.render not found!")
                        } else {
                            Log.i(TAG, "[MODE_SWITCH] Act runtime verified successfully")
                        }
                    }
                    RendererMode.ANDROID -> {
                        val hasAndroid = ctx.evaluateScript("typeof globalThis.Android !== 'undefined' && typeof globalThis.Android.render === 'function'", "verify_android.js")
                        Log.d(TAG, "[MODE_SWITCH] Android verification: $hasAndroid")
                        if (hasAndroid.toString() != "true") {
                            Log.e(TAG, "[MODE_SWITCH ERROR] Runtime verification failed for $mode - Android.render not found!")
                        } else {
                            Log.i(TAG, "[MODE_SWITCH] Android runtime verified successfully")
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "[MODE_SWITCH ERROR] Failed to verify runtime", e)
            }
        } ?: Log.e(TAG, "[MODE_SWITCH ERROR] jsContext is null after setupEngine()!")
        
        // Ensure ScrollView itself is visible and ready
        scrollView.visibility = View.VISIBLE
        scrollView.alpha = 1.0f
        Log.d(TAG, "[MODE_SWITCH] HookRenderer state: visibility=$visibility, alpha=$alpha, childCount=$childCount")
        
        Log.i(TAG, "[MODE_SWITCH] Complete: now in $mode mode")
    }

    /**
     * Load and render a hook from a URL or local path
     * Both local and remote hooks use the same module loader mechanism
     */
    fun loadHook(path: String, props: Map<String, Any> = emptyMap()) {
        Log.d(TAG, "[LOAD_HOOK] Starting loadHook: $path, thread=${Thread.currentThread().name}")
        currentHookPath = path  // Track for auto-reload on mode switch
        currentProps = props  // Store props for reloads (e.g., theme switches)
        
        // Cancel any previous load job to avoid race conditions
        currentLoadJob?.cancel()
        
        Log.d(TAG, "[LOAD_HOOK] Launching coroutine for $path")
        currentLoadJob = scope.launch {
            Log.d(TAG, "[LOAD_HOOK_COROUTINE] Coroutine started for $path")
            try {
                debugConsole?.logInfo("Loading: ${path.substringAfterLast("/")}")
                onLoading?.invoke()
                currentStatus = currentStatus.copy(loading = true, hookPath = path)

                Log.d(TAG, "[LOAD_HOOK] Fetching source for $path via module loader")
                // Use module loader for both local and remote - no distinction
                val source = fetchViaModuleLoader(path)
                
                if (!isActive) {
                    Log.w(TAG, "[LOAD_HOOK] Coroutine cancelled before render")
                    return@launch
                }
                
                Log.d(TAG, "[LOAD_HOOK] Source fetched: ${source.length} bytes")
                debugConsole?.logInfo("✓ Source loaded (${source.length} bytes)")
                onSourceLoaded?.invoke(source)

                Log.d(TAG, "[LOAD_HOOK] Calling render() for $path")
                render(source, path, props)
                Log.d(TAG, "[LOAD_HOOK] render() completed for $path")
            } catch (e: CancellationException) {
                Log.d(TAG, "[LOAD_HOOK] Load cancelled for $path")
                throw e  // Rethrow to properly handle coroutine cancellation
            } catch (e: Exception) {
                Log.e(TAG, "[LOAD_HOOK_ERROR] Exception in loadHook coroutine", e)
                debugConsole?.logError("❌ Error: ${e.message}")
                handleError(e)
            }
        }
        Log.d(TAG, "[LOAD_HOOK] loadHook() function returned (coroutine launched)")
    }

    /**
     * Render JSX source code directly
     */
    fun render(source: String, filename: String = "hook.jsx", props: Map<String, Any> = emptyMap()) {
        Log.d(TAG, "render: $filename, source length=${source.length}")
        scope.launch {
            try {
                val transpiled = transpiler.transpile(source, filename).getOrThrow()
                debugConsole?.logInfo("✓ Transpiled (${transpiled.length} bytes)")
                onTranspiled?.invoke(transpiled)
                executeJs(transpiled, filename, props)
                
                currentStatus = currentStatus.copy(loading = false, ready = true)
                val viewCount = nativeRenderer.getViewCount()
                Log.i(TAG, "Render complete. Native views created: $viewCount")
                
                if (viewCount == 0) {
                    Log.w(TAG, "No views rendered for $filename")
                    debugConsole?.logError("⚠️ No views rendered. Check if your component returns null or if there was a silent error.")
                } else {
                    debugConsole?.logInfo("✓ Rendered ($viewCount views)")
                }
                
                // Pull logs from JS context
                jsContext?.let { debugConsole?.pullFromJSContext(it) }
                
                onReady?.invoke(viewCount)
            } catch (e: Exception) {
                debugConsole?.logError("❌ Render error: ${e.message}")
                handleError(e)
            }
        }
    }

    private var logPullJob: Job? = null

    private fun startLogPuller() {
        logPullJob?.cancel()
        logPullJob = scope.launch {
            while (isActive) {
                jsContext?.let { ctx ->
                    withContext(Dispatchers.Main) {
                        debugConsole?.pullFromJSContext(ctx)
                    }
                }
                delay(500) // Pull every 500ms
            }
        }
    }

    private fun setupEngine() {
        Log.d(TAG, "setupEngine: starting")
        
        // Allow network on main thread for synchronous fetch in bridge
        val policy = StrictMode.ThreadPolicy.Builder().permitAll().build()
        StrictMode.setThreadPolicy(policy)

        try {
            jsContext = JSContext(JSContext.create()).also { ctx ->
                Log.d(TAG, "setupEngine: JSContext created")
                installBridge(ctx)
                Log.d(TAG, "setupEngine: bridge installed")
                nativeRenderer.setJSContext(ctx)
                
                // Initialize native renderer with default theme
                val initialTheme = buildThemesJson()
                nativeRenderer.setTheme(initialTheme)
                
                Log.d(TAG, "setupEngine: loading runtime")
                loadRuntime(ctx)
                Log.d(TAG, "setupEngine: runtime loaded")
                startLogPuller()
            }
            Log.i(TAG, "JS Engine initialized")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize JS Engine", e)
        }
    }

    // User-facing JS error callback
    var onJSError: ((String) -> Unit)? = null
    var onJSLog: ((level: String, message: String) -> Unit)? = null
    
    private fun installBridge(ctx: JSContext) {
        // Expose version information
        val stylerVersion = try {
            ThemedStylerModule.nativeGetVersion()
        } catch (e: Exception) {
            com.clevertree.hooktranspiler.BuildConfig.THEMED_STYLER_VERSION
        }
        ctx.evaluateScript("""
            globalThis.__versions = {
                hookTranspiler: "${com.clevertree.hooktranspiler.BuildConfig.VERSION_NAME}",
                jscbridge: "${com.clevertree.hooktranspiler.BuildConfig.JSCBRIDGE_VERSION}",
                themedStyler: "$stylerVersion"
            };
        """.trimIndent(), "versions.js")
        
        ctx.setObjectForKey("__android_log", object : JavaScriptObject() {
            fun callString(level: String, message: String): String {
                Log.d("HookJS_Bridge", "level=$level, message=$message")
                when (level) {
                    "ERROR" -> {
                        Log.e("HookJS", message)
                        debugConsole?.logError(message)
                        onJSError?.invoke(message)
                    }
                    "WARN" -> {
                        Log.w("HookJS", message)
                        debugConsole?.log("WARN", message)
                    }
                    "DEBUG" -> Log.d("HookJS", message)
                    else -> {
                        Log.i("HookJS", message)
                        if (message.contains("render", ignoreCase = true) || 
                            message.contains("error", ignoreCase = true) ||
                            message.contains("loading", ignoreCase = true)) {
                            debugConsole?.log("INFO", message)
                        }
                    }
                }
                // Notify debug console
                onJSLog?.invoke(level, message)
                return ""
            }
        })

        ctx.setObjectForKey("__android_readFile", object : JavaScriptObject() {
            fun callString(path: String): String {
                if (path.startsWith("http")) {
                    return try {
                        java.net.URL(path).readText()
                    } catch (e: Exception) {
                        ""
                    }
                }
                return try {
                    context.assets.open(path).bufferedReader().use { it.readText() }
                } catch (e: Exception) {
                    ""
                }
            }
        })

        ctx.setObjectForKey("__android_fetch", object : JavaScriptObject() {
            fun callString(url: String, optionsJson: String?): String {
                val options = try {
                    if (optionsJson != null) gson.fromJson(optionsJson, Map::class.java) else emptyMap<String, Any>()
                } catch (e: Exception) {
                    emptyMap<String, Any>()
                }
                val method = (options["method"] as? String) ?: "GET"
                Log.d("HookRenderer", "Native fetch: $method $url")
                return try {
                    val connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                    connection.requestMethod = method
                    connection.connectTimeout = 5000
                    connection.readTimeout = 5000
                    
                    val status = connection.responseCode
                    val headers = connection.headerFields.filterKeys { it != null }.mapValues { it.value.joinToString(", ") }
                    
                    val body = if (method != "HEAD" && status < 400) {
                        connection.inputStream.bufferedReader().use { it.readText() }
                    } else {
                        ""
                    }
                    
                    val result = mapOf(
                        "status" to status,
                        "ok" to (status in 200..299),
                        "headers" to headers,
                        "body" to body
                    )
                    gson.toJson(result)
                } catch (e: Exception) {
                    Log.e("HookRenderer", "Native fetch failed: $method $url", e)
                    gson.toJson(mapOf("status" to 500, "ok" to false, "body" to "", "headers" to emptyMap<String, String>()))
                }
            }
        })

        ctx.setObjectForKey("__android_transpile", object : JavaScriptObject() {
            fun callString(source: String, filename: String): String {
                Log.d("HookRenderer", "__android_transpile called: filename=$filename, sourceLen=${source.length}")
                val result = transpiler.transpile(source, filename).getOrNull() ?: ""
                Log.d("HookRenderer", "__android_transpile result preview: ${result.take(500)}")
                return result
            }
        })

        ctx.setObjectForKey("__android_createView", object : JavaScriptObject() {
            override fun call(json: String) {
                try {
                    val data = gson.fromJson(json, Map::class.java)
                    val tag = (data["tag"] as Double).toInt()
                    val type = data["type"] as String
                    val props = data["props"] as? Map<String, Any> ?: emptyMap()
                    nativeRenderer.createView(tag, type, props)
                } catch (e: Exception) {
                    Log.e(TAG, "Error in __android_createView", e)
                }
            }
        })

        ctx.setObjectForKey("__android_updateProps", object : JavaScriptObject() {
            override fun call(json: String) {
                try {
                    val data = gson.fromJson(json, Map::class.java)
                    val tag = (data["tag"] as Double).toInt()
                    val props = data["props"] as? Map<String, Any> ?: emptyMap()
                    nativeRenderer.updateProps(tag, props)
                } catch (e: Exception) {
                    Log.e(TAG, "Error in __android_updateProps", e)
                }
            }
        })

        ctx.setObjectForKey("__android_addChild", object : JavaScriptObject() {
            override fun call(json: String) {
                try {
                    val data = gson.fromJson(json, Map::class.java)
                    val parent = (data["parent"] as Double).toInt()
                    val child = (data["child"] as Double).toInt()
                    val index = (data["index"] as? Double)?.toInt() ?: -1
                    nativeRenderer.addChild(parent, child, index)
                } catch (e: Exception) {
                    Log.e(TAG, "Error in __android_addChild", e)
                }
            }
        })

        ctx.setObjectForKey("__android_removeChild", object : JavaScriptObject() {
            override fun call(json: String) {
                try {
                    val data = gson.fromJson(json, Map::class.java)
                    val parent = (data["parent"] as Double).toInt()
                    val child = (data["child"] as Double).toInt()
                    nativeRenderer.removeChild(parent, child)
                } catch (e: Exception) {
                    Log.e(TAG, "Error in __android_removeChild", e)
                }
            }
        })

        ctx.setObjectForKey("__android_addEventListener", object : JavaScriptObject() {
            override fun call(json: String) {
                try {
                    val data = gson.fromJson(json, Map::class.java)
                    val tag = (data["tag"] as Double).toInt()
                    val event = data["event"] as String
                    nativeRenderer.addEventListener(tag, event)
                } catch (e: Exception) {
                    Log.e(TAG, "Error in __android_addEventListener", e)
                }
            }
        })

        ctx.setObjectForKey("__android_clearViews", object : JavaScriptObject() {
            override fun call() {
                nativeRenderer.clear("bridge_clearViews")
            }
        })

        ctx.setObjectForKey("__android_setCurrentTheme", object : JavaScriptObject() {
            override fun call(themeName: String) {
                Log.i(TAG, "[BRIDGE] setCurrentTheme called from JS: $themeName")
                // Update the native renderer's theme immediately
                // This ensures subsequent style computations use the new theme
                val themesJson = customThemesJson?.let { existing ->
                    try {
                        val map = gson.fromJson(existing, MutableMap::class.java) as MutableMap<String, Any>
                        map["current_theme"] = themeName
                        gson.toJson(map)
                    } catch (e: Exception) { null }
                } ?: buildThemesJson(themeName)
                
                nativeRenderer.setTheme(themesJson)
            }
        })

        // Timer support for setTimeout/clearTimeout
        ctx.setObjectForKey("__android_schedule_timer", object : JavaScriptObject() {
            override fun call(json: String) {
                try {
                    Log.d(TAG, "__android_schedule_timer called with json: $json")
                    val data = gson.fromJson(json, Map::class.java)
                    val timerId = (data["timerId"] as Double).toInt()
                    val delay = (data["delay"] as Double).toInt()
                    Log.d(TAG, "__android_schedule_timer: scheduling timer $timerId for ${delay}ms")
                    handler.postDelayed({
                        Log.d(TAG, "__android_schedule_timer: timer $timerId firing now")
                        try {
                            ctx.evaluateScript("if (globalThis.__timer_$timerId) globalThis.__timer_$timerId();", "timer_$timerId.js")
                        } catch (e: Exception) {
                            Log.e(TAG, "Error executing timer $timerId", e)
                        }
                    }, delay.toLong())
                    Log.d(TAG, "__android_schedule_timer: timer $timerId scheduled successfully")
                } catch (e: Exception) {
                    Log.e(TAG, "Error in __android_schedule_timer", e)
                }
            }
        })

        ctx.setObjectForKey("__android_cancel_timer", object : JavaScriptObject() {
            override fun call(json: String) {
                try {
                    val data = gson.fromJson(json, Map::class.java)
                    val timerId = (data["timerId"] as Double).toInt()
                    // Note: We don't track individual Runnables here, so we can't cancel
                    // This is a simplified implementation - in production you'd want to track them
                    Log.d(TAG, "clearTimeout called for timer $timerId")
                } catch (e: Exception) {
                    Log.e(TAG, "Error in __android_cancel_timer", e)
                }
            }
        })

        // Register virtual modules for hooks to import
        // These are provided by the HookRenderer and made available via globalThis.__clevertree_packages
        Log.d(TAG, "installBridge: registering virtual modules")
        try {
            // Initialize __clevertree_packages object if not already present
            ctx.evaluateScript("""
                (function() {
                    if (!globalThis.__clevertree_packages) {
                        globalThis.__clevertree_packages = {};
                    }
                    
                    // Initialize themed-styler bridge state
                    if (!globalThis.__themed_styler_state) {
                        globalThis.__themed_styler_state = {
                            themes: {},
                            currentTheme: null,
                            usage: {
                                tags: new Set(),
                                classes: new Set(),
                                tagClasses: new Set()
                            }
                        };
                    }
                })();
            """.trimIndent(), "init_packages.js")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize __relay_packages", e)
        }

        // Set up the @clevertree/themed-styler module with JavaScript-based implementation
        try {
            ctx.evaluateScript("""
                (function() {
                    var state = globalThis.__themed_styler_state;
                    
                    // Create the themed-styler bridge module
                    globalThis.__clevertree_packages['@clevertree/themed-styler'] = {
                        setCurrentTheme: function(name) {
                            console.log('[themed-styler] setCurrentTheme: ' + name);
                            state.currentTheme = name;
                            if (typeof globalThis.__android_setCurrentTheme === 'function') {
                                globalThis.__android_setCurrentTheme(name);
                            }
                            return true;
                        },
                        getThemeList: function() {
                            console.log('[themed-styler] getThemeList');
                            var list = [];
                            for (var key in state.themes) {
                                list.push({ key: key, name: key });
                            }
                            return list;
                        },
                        getThemes: function() {
                            console.log('[themed-styler] getThemes: current=' + state.currentTheme + ' themes=' + Object.keys(state.themes).join(','));
                            return {
                                themes: state.themes,
                                currentTheme: state.currentTheme,
                                current_theme: state.currentTheme,
                                default_theme: state.currentTheme,
                                variables: {},
                                breakpoints: {}
                            };
                        },
                        registerTheme: function(name, defs) {
                            console.log('[themed-styler] registerTheme: ' + name);
                            state.themes[name] = defs || {};
                            if (!state.currentTheme) state.currentTheme = name;
                            return true;
                        },
                        clearUsage: function() {
                            console.log('[themed-styler] clearUsage');
                            state.usage.tags.clear();
                            state.usage.classes.clear();
                            state.usage.tagClasses.clear();
                            return true;
                        },
                        getUsageSnapshot: function() {
                            console.log('[themed-styler] getUsageSnapshot');
                            var selectors = Array.from(state.usage.tagClasses.values ? state.usage.tagClasses.values() : []);
                            return {
                                tags: Array.from(state.usage.tags.values ? state.usage.tags.values() : []),
                                classes: Array.from(state.usage.classes.values ? state.usage.classes.values() : []),
                                tagClasses: selectors,
                                selectors: selectors
                            };
                        },
                        registerUsage: function(tag, props, hierarchy) {
                            if (!tag) return;
                            state.usage.tags.add(tag);
                            var cls = (props && (props.className || props.class || '')) || '';
                            if (typeof cls === 'string' && cls.trim().length > 0) {
                                var classes = cls.split(/\s+/).map(function(c) { return c.trim(); }).filter(Boolean);
                                for (var i = 0; i < classes.length; i++) {
                                    var c = classes[i];
                                    state.usage.classes.add(c);
                                    state.usage.tagClasses.add(tag + '|' + c);
                                }
                            }
                        }
                    };
                    
                    console.log('[INIT] @clevertree/themed-styler registered in __clevertree_packages');
                })();
            """.trimIndent(), "register_themed_styler.js")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register @clevertree/themed-styler in __clevertree_packages", e)
        }

        // Register other virtual modules (React aliases and metadata)
        try {
            ctx.evaluateScript("""
                (function() {
                    // @clevertree/hook-transpiler - alias to React
                    if (globalThis.__hook_react) {
                        globalThis.__clevertree_packages['@clevertree/hook-transpiler'] = globalThis.__hook_react;
                    }
                    
                    // @clevertree/act - alias to Act or React
                    if (globalThis.Act) {
                        globalThis.__clevertree_packages['@clevertree/act'] = globalThis.Act;
                    } else if (globalThis.__hook_react) {
                        globalThis.__clevertree_packages['@clevertree/act'] = globalThis.__hook_react;
                    }
                    
                    // @clevertree/meta - for import.meta
                    globalThis.__clevertree_packages['@clevertree/meta'] = {
                        filename: '',
                        dirname: '',
                        url: ''
                    };
                    
                    console.log('[INIT] Virtual modules registered:', Object.keys(globalThis.__clevertree_packages || {}));
                })();
            """.trimIndent(), "register_virtual_modules.js")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register virtual modules", e)
        }

        // Load bridge from asset file
        Log.d(TAG, "installBridge: loading bridge.js from assets")
        try {
            val bridgeCode = context.assets.open("bridge.js").bufferedReader().use { it.readText() }
            val bridgeResult = ctx.evaluateScript(bridgeCode, "bridge.js")
            Log.d(TAG, "Bridge evaluation result: $bridgeResult")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load bridge.js from assets", e)
        }
    }

    private fun loadRuntime(ctx: JSContext) {
        Log.d(TAG, "loadRuntime: reading asset")
        try {
            // Set up nativeLoggingHook for Android's console (will override console later)
            val consoleSetup = """
                (function() {
                    if (typeof globalThis.__android_log === 'function') {
                        globalThis.nativeLoggingHook = function(message, level) {
                            var levelStr = 'INFO';
                            if (level === 0) levelStr = 'DEBUG';
                            else if (level === 1) levelStr = 'INFO';
                            else if (level === 2) levelStr = 'WARN';
                            else if (level === 3) levelStr = 'ERROR';
                            globalThis.__android_log(levelStr, message);
                        };
                        globalThis.__android_log('INFO', '[INIT] nativeLoggingHook installed');
                    } else {
                        throw new Error('__android_log not available!');
                    }
                })();
            """.trimIndent()
            Log.d(TAG, "loadRuntime: Setting up nativeLoggingHook")
            ctx.evaluateScript(consoleSetup, "console_setup.js")
            Log.d(TAG, "loadRuntime: nativeLoggingHook setup complete")
            
            // CRITICAL: Inject SWC helpers as GLOBAL VARIABLES before anything else
            // This ensures they're available to Act/RN, user code, and everything in between
            val globalHelpersCode = """
                (function(globalObj) {
                    // Make sure helpers are on the global object with multiple reference paths
                    globalObj._interop_require_default = globalObj._interop_require_default || function(obj) {
                        return obj && obj.__esModule ? obj : { default: obj };
                    };
                    globalObj._interop_require_wildcard = globalObj._interop_require_wildcard || function(obj) {
                        if (obj && obj.__esModule) {
                            return obj;
                        } else {
                            var newObj = {};
                            if (obj != null) {
                                for (var key in obj) {
                                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                                        newObj[key] = obj[key];
                                    }
                                }
                            }
                            newObj.default = obj;
                            return newObj;
                        }
                    };
                    
                    // Array/object helpers
                    globalObj._sliced_to_array = globalObj._sliced_to_array || function(arr, i) {
                        return (Array.isArray(arr) ? arr : Array.prototype.slice.call(arr)).slice(0, i || 1).concat(new Array(Math.max(0, i - arr.length)).fill(void 0));
                    };
                    
                    globalObj._type_of = globalObj._type_of || function(obj) {
                        "@babel/helpers - typeof";
                        return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
                    };
                    
                    globalObj._to_consumable_array = globalObj._to_consumable_array || function(arr) {
                        return Array.isArray(arr) ? arr : Array.from(arr);
                    };

                    globalObj._to_array = globalObj._to_array || globalObj._to_consumable_array;
                    
                    // Class helpers
                    globalObj._classCallCheck = globalObj._classCallCheck || function(instance, Constructor) {
                        if (!(instance instanceof Constructor)) {
                            throw new TypeError("Cannot call a class as a function");
                        }
                    };
                    
                    globalObj._defineProperties = globalObj._defineProperties || function(target, props) {
                        for (var i = 0; i < props.length; i++) {
                            var descriptor = props[i];
                            descriptor.enumerable = descriptor.enumerable || false;
                            descriptor.configurable = true;
                            if ("value" in descriptor) descriptor.writable = true;
                            Object.defineProperty(target, descriptor.key, descriptor);
                        }
                    };
                    
                    globalObj._createClass = globalObj._createClass || function(Constructor, protoProps, staticProps) {
                        if (protoProps) globalObj._defineProperties(Constructor.prototype, protoProps);
                        if (staticProps) globalObj._defineProperties(Constructor, staticProps);
                        return Constructor;
                    };
                    
                    globalObj._define_property = globalObj._define_property || function(obj, key, value) {
                        if (key in obj) {
                            Object.defineProperty(obj, key, {
                                value: value,
                                enumerable: true,
                                configurable: true,
                                writable: true
                            });
                        } else {
                            obj[key] = value;
                        }
                        return obj;
                    };
                    
                    globalObj._object_spread = globalObj._object_spread || function(target) {
                        for (var i = 1; i < arguments.length; i++) {
                            var source = arguments[i] != null ? arguments[i] : {};
                            var ownKeys = Object.keys(source);
                            if (typeof Object.getOwnPropertySymbols === 'function') {
                                ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                                    return Object.getOwnPropertyDescriptor(source, sym).enumerable;
                                }));
                            }
                            ownKeys.forEach(function(key) {
                                globalObj._define_property(target, key, source[key]);
                            });
                        }
                        return target;
                    };

                    // JSX runtime - will be filled by React/Android after bundle loads
                    globalObj._jsxruntime = globalObj._jsxruntime || {
                        jsx: function() { 
                            console.warn('[JSX] jsx() not yet initialized');
                            return null;
                        },
                        jsxs: function() { 
                            console.warn('[JSX] jsxs() not yet initialized');
                            return null;
                        }
                    };
                    
                    console.log('[GLOBAL-SETUP] SWC helpers installed at globalThis level');
                })(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
            """.trimIndent()
            Log.d(TAG, "loadRuntime: injecting SWC helpers FIRST")
            ctx.evaluateScript(globalHelpersCode, "global_helpers.js")
            Log.d(TAG, "loadRuntime: global helpers injection complete")
            
            // Verify the helpers are actually available
            val verifyCode = """
                (function() {
                    var hasSliced = typeof globalThis._sliced_to_array === 'function';
                    var hasTypeOf = typeof globalThis._type_of === 'function';
                    console.log('[VERIFY] _sliced_to_array available: ' + hasSliced);
                    console.log('[VERIFY] _type_of available: ' + hasTypeOf);
                    if (!hasSliced || !hasTypeOf) {
                        console.error('[VERIFY FAILED] Critical helpers missing!');
                    } else {
                        console.log('[VERIFY] All critical helpers present');
                    }
                })();
            """.trimIndent()
            ctx.evaluateScript(verifyCode, "verify_helpers.js")
            
            // ALWAYS load BOTH runtimes - Act is the native renderer, React delegates to it
            Log.d(TAG, "loadRuntime: Loading Act renderer (always loaded)")
            val actSource = context.assets.open("act-android.bundle.js").bufferedReader().use { it.readText() }
            Log.d(TAG, "loadRuntime: evaluating Act runtime (${actSource.length} bytes)")
            ctx.evaluateScript(actSource, "act-android.bundle.js")
            Log.d(TAG, "Act runtime evaluation complete")
            
            Log.d(TAG, "loadRuntime: Loading Android bundle")
            val androidSource = context.assets.open("react-native.bundle.js").bufferedReader().use { it.readText() }
            Log.d(TAG, "loadRuntime: evaluating Android runtime (${androidSource.length} bytes)")
            ctx.evaluateScript(androidSource, "react-native.bundle.js")
            Log.d(TAG, "Android runtime evaluation complete")
            
            // CRITICAL: Override console AFTER Android loads to ensure our implementation always wins
            // This fixes console logging from async/event contexts
            val consoleOverride = """
                (function() {
                    if (typeof globalThis.__android_log !== 'function') {
                        throw new Error('__android_log not available!');
                    }
                    
                    // Force override console with direct __android_log calls
                    // This bypasses Android's complex polyfill which has issues with async contexts
                    globalThis.console = {
                        log: function() {
                            var args = Array.prototype.slice.call(arguments);
                            var message = args.map(function(arg) {
                                if (typeof arg === 'object' && arg !== null) {
                                    try { return JSON.stringify(arg); } catch(e) { return String(arg); }
                                }
                                return String(arg);
                            }).join(' ');
                            globalThis.__android_log('INFO', message);
                        },
                        warn: function() {
                            var args = Array.prototype.slice.call(arguments);
                            var message = args.map(function(arg) {
                                if (typeof arg === 'object' && arg !== null) {
                                    try { return JSON.stringify(arg); } catch(e) { return String(arg); }
                                }
                                return String(arg);
                            }).join(' ');
                            globalThis.__android_log('WARN', message);
                        },
                        error: function() {
                            var args = Array.prototype.slice.call(arguments);
                            var message = args.map(function(arg) {
                                if (typeof arg === 'object' && arg !== null) {
                                    try { return JSON.stringify(arg); } catch(e) { return String(arg); }
                                }
                                return String(arg);
                            }).join(' ');
                            globalThis.__android_log('ERROR', message);
                        },
                        debug: function() {
                            var args = Array.prototype.slice.call(arguments);
                            var message = args.map(function(arg) {
                                if (typeof arg === 'object' && arg !== null) {
                                    try { return JSON.stringify(arg); } catch(e) { return String(arg); }
                                }
                                return String(arg);
                            }).join(' ');
                            globalThis.__android_log('DEBUG', message);
                        },
                        info: function() {
                            var args = Array.prototype.slice.call(arguments);
                            var message = args.map(function(arg) {
                                if (typeof arg === 'object' && arg !== null) {
                                    try { return JSON.stringify(arg); } catch(e) { return String(arg); }
                                }
                                return String(arg);
                            }).join(' ');
                            globalThis.__android_log('INFO', message);
                        }
                    };
                    
                    globalThis.__android_log('INFO', '[Console Override] Simple console implementation installed');
                })();
            """.trimIndent()
            ctx.evaluateScript(consoleOverride, "console_override.js")
            Log.d(TAG, "Console override applied after Android bundle")
            
            // Set up React and Android namespaces that delegate to Act
            ctx.evaluateScript("""
                (function() {
                    console.log('[Setup] Starting runtime initialization...');
                    console.log('[Setup] globalThis.Act available: ' + (typeof globalThis.Act !== 'undefined'));
                    
                    // Create React namespace that delegates to Act for all operations
                    var React = {
                        useState: function(initial) {
                            if (typeof globalThis.Act !== 'undefined' && globalThis.Act.useState) {
                                return globalThis.Act.useState(initial);
                            }
                            console.warn('[React.useState] Act.useState not available');
                            return [initial, function() {}];
                        },
                        useEffect: function(fn, deps) {
                            if (typeof globalThis.Act !== 'undefined' && globalThis.Act.useEffect) {
                                return globalThis.Act.useEffect(fn, deps);
                            }
                            console.warn('[React.useEffect] Act.useEffect not available');
                        },
                        useCallback: function(fn, deps) {
                            if (typeof globalThis.Act !== 'undefined' && globalThis.Act.useCallback) {
                                return globalThis.Act.useCallback(fn, deps);
                            }
                            return fn;
                        },
                        useMemo: function(fn, deps) {
                            if (typeof globalThis.Act !== 'undefined' && globalThis.Act.useMemo) {
                                return globalThis.Act.useMemo(fn, deps);
                            }
                            return fn();
                        },
                        useRef: function(initial) {
                            if (typeof globalThis.Act !== 'undefined' && globalThis.Act.useRef) {
                                return globalThis.Act.useRef(initial);
                            }
                            return { current: initial };
                        },
                        useContext: function(ctx) {
                            if (typeof globalThis.Act !== 'undefined' && globalThis.Act.useContext) {
                                return globalThis.Act.useContext(ctx);
                            }
                            console.warn('[React.useContext] Act.useContext not available');
                        },
                        useReducer: function(reducer, initial) {
                            if (typeof globalThis.Act !== 'undefined' && globalThis.Act.useReducer) {
                                return globalThis.Act.useReducer(reducer, initial);
                            }
                            console.warn('[React.useReducer] Act.useReducer not available');
                            return [initial, function() {}];
                        },
                        createContext: function(initial) {
                            if (typeof globalThis.Act !== 'undefined' && globalThis.Act.createContext) {
                                return globalThis.Act.createContext(initial);
                            }
                            return { Provider: null };
                        },
                        render: function(Component, props) {
                            console.log('[React.render] Called, delegating to Act.render');
                            
                            if (typeof Component !== 'function') {
                                console.error('[React.render] Component must be a function');
                                return;
                            }
                            
                            if (typeof globalThis.Act === 'undefined') {
                                console.error('[React.render] Act renderer not available!');
                                return;
                            }
                            
                            if (typeof globalThis.Act.render !== 'function') {
                                console.error('[Android.render] Act.render is not a function');
                                return;
                            }
                            
                            try {
                                globalThis.Act.render(Component, props);
                            } catch (e) {
                                console.error('[Android.render] Exception: ' + e.message);
                            }
                        }
                    };
                    
                    // Both React and Android point to the same implementation
                    globalThis.React = React;
                    globalThis.Android = React;
                    
                    console.log('[Setup] Runtime initialization complete');
                    console.log('[Setup] React.render available: ' + (typeof globalThis.React.render === 'function'));
                    console.log('[Setup] Android.render available: ' + (typeof globalThis.Android.render === 'function'));
                })();
            """.trimIndent(), "setup-runtimes.js")
            
            // Set up act/android module for Android-specific functionality
            ctx.evaluateScript("""
                // Event handler storage
                var __eventHandlers = {};
                
                // Create act/android module with Android-specific APIs
                var actAndroidModule = {
                    // Store event handler when addEventListener is called from JS
                    storeEventHandler: function(tag, event, handler) {
                        var key = tag + '_' + event;
                        __eventHandlers[key] = handler;
                        console.log('[act/android] Handler stored for tag=' + tag + ', event=' + event);
                    },
                    
                    // Called by native when event occurs
                    triggerEvent: function(payload) {
                        console.log('[act/android] triggerEvent called with:', JSON.stringify(payload));
                        var key = payload.tag + '_' + payload.event;
                        var handler = __eventHandlers[key];
                        if (handler && typeof handler === 'function') {
                            console.log('[act/android] Calling handler for key=' + key);
                            try {
                                handler(payload.data || {});
                            } catch (e) {
                                console.error('[act/android] Handler error:', e.message);
                            }
                        } else {
                            console.warn('[act/android] No handler found for key=' + key);
                        }
                    }
                };
                
                // Register act/android module in the module system
                if (!globalThis.__modules) {
                    globalThis.__modules = {};
                }
                globalThis.__modules['act/android'] = { exports: actAndroidModule };
                
                // Legacy bridge for native code
                globalThis.__hook_triggerEvent = actAndroidModule.triggerEvent;
                
                console.log('[Setup] act/android module registered');
            """.trimIndent(), "act_android_module.js")
            
            ctx.evaluateScript("globalThis.__runtime = { mode: '$rendererMode', engine: 'jsc' };", "runtime_init.js")
            Log.i(TAG, "Both Act and Android runtimes loaded successfully")


            // Add comprehensive validation and diagnostic logging
            val diagnosticsCode = """
                (function() {
                    console.log('[DIAGNOSTICS] Runtime loading complete. Validation starting...');
                    
                    // Check if renderer is available (Act or Android)
                    var hasAct = typeof globalThis.Act !== 'undefined' && globalThis.Act !== null;
                    var hasRN = typeof globalThis.Android !== 'undefined' && globalThis.Android !== null;
                    var hasReact = typeof globalThis.React !== 'undefined' && globalThis.React !== null;
                    
                    console.log('[DIAGNOSTICS] Act available: ' + hasAct);
                    console.log('[DIAGNOSTICS] Android available: ' + hasRN);
                    console.log('[DIAGNOSTICS] React alias available: ' + hasReact);
                    
                    if (hasAct) {
                        console.log('[DIAGNOSTICS] Act.render exists: ' + (typeof globalThis.Act.render === 'function'));
                        console.log('[DIAGNOSTICS] Act.createElement exists: ' + (typeof globalThis.Act.createElement === 'function'));
                    }
                    if (hasRN) {
                        console.log('[DIAGNOSTICS] Android.render exists: ' + (typeof globalThis.Android.render === 'function'));
                        console.log('[DIAGNOSTICS] Android.useState exists: ' + (typeof globalThis.Android.useState === 'function'));
                    }
                    
                    // Check if bridge is available
                    var hasBridge = typeof globalThis.bridge !== 'undefined' && globalThis.bridge !== null;
                    console.log('[DIAGNOSTICS] Bridge available: ' + hasBridge);
                    if (hasBridge) {
                        console.log('[DIAGNOSTICS] Bridge.createView: ' + (typeof globalThis.bridge.createView === 'function'));
                        console.log('[DIAGNOSTICS] Bridge.addChild: ' + (typeof globalThis.bridge.addChild === 'function'));
                        console.log('[DIAGNOSTICS] Bridge.updateProps: ' + (typeof globalThis.bridge.updateProps === 'function'));
                    } else {
                        console.error('[ERROR] Bridge not found! Bridge is required to create native views');
                    }
                    
                    // Check SWC helpers
                    var helperNames = ['_sliced_to_array', '_type_of', '_to_consumable_array', '_classCallCheck', '_createClass'];
                    var missingHelpers = [];
                    for (var i = 0; i < helperNames.length; i++) {
                        if (typeof globalThis[helperNames[i]] !== 'function') {
                            missingHelpers.push(helperNames[i]);
                        }
                    }
                    if (missingHelpers.length > 0) {
                        console.error('[CRITICAL] Missing SWC helpers: ' + missingHelpers.join(', '));
                    } else {
                        console.log('[DIAGNOSTICS] All SWC helpers available');
                    }
                    
                    console.log('[DIAGNOSTICS] All checks complete.');
                })();
            """.trimIndent()
            ctx.evaluateScript(diagnosticsCode, "diagnostics.js")
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load runtime bundle", e)
        }
    }

    private fun executeJs(code: String, filename: String, props: Map<String, Any>) {
        Log.d(TAG, "[EXECUTE_JS] Starting: filename=$filename, codeLength=${code.length}, mode=$rendererMode")
        val ctx = jsContext ?: run {
            Log.e(TAG, "[EXECUTE_JS] Cannot execute - jsContext is null!")
            return
        }
        
        Log.d(TAG, "[EXECUTE_JS] Clearing renderer before execution (mode=$rendererMode)")
        val viewCount = nativeRenderer.getViewCount()
        Log.i(TAG, "[CLEAR_BEFORE_RENDER] About to clear $viewCount views for $rendererMode mode")
        nativeRenderer.clear("executeJs in $rendererMode mode")
        debugConsole?.log("INFO", "🔄 Clearing ($viewCount views)")
        onJSLog?.invoke("INFO", "🔄 Clearing ($viewCount views)")
        
        val propsJson = gson.toJson(props)
        ctx.evaluateScript("globalThis.__hook_props = $propsJson;", "props.js")
        
        // Update native renderer theme if present in props
        val themes = props["themes"] as? Map<String, Any>
        if (themes != null) {
            val themesJson = gson.toJson(themes)
            customThemesJson = themesJson
            nativeRenderer.setTheme(themesJson)
            
            // Sync with JS bridge state for @clevertree/themed-styler
            try {
                val themesMap = themes["themes"] as? Map<String, Any>
                val currentTheme = (themes["current_theme"] as? String) ?: (themes["currentTheme"] as? String)
                
                if (themesMap != null) {
                    val syncScript = StringBuilder()
                    for ((name, def) in themesMap) {
                        val defJson = gson.toJson(def)
                        syncScript.append("globalThis.__clevertree_packages['@clevertree/themed-styler'].registerTheme('$name', $defJson);\n")
                    }
                    if (currentTheme != null) {
                        syncScript.append("globalThis.__clevertree_packages['@clevertree/themed-styler'].setCurrentTheme('$currentTheme');\n")
                    }
                    ctx.evaluateScript(syncScript.toString(), "sync_themes.js")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to sync themes to JS bridge", e)
            }
        } else {
            customThemesJson = null
            // Try to find theme in env
            val env = props["env"] as? Map<String, Any>
            val themeName = env?.get("theme") as? String ?: getSystemTheme()
            // Load bundled themes (light/dark) and set current theme
            val bundledThemes = buildThemesMap(themeName)
            val bundledThemesJson = gson.toJson(bundledThemes)
            nativeRenderer.setTheme(bundledThemesJson)
            
            // Sync bundled themes to JS bridge
            try {
                val themesMap = bundledThemes["themes"] as? Map<String, Any>
                if (themesMap != null) {
                    val syncScript = StringBuilder()
                    for ((name, def) in themesMap) {
                        val defJson = gson.toJson(def)
                        syncScript.append("globalThis.__clevertree_packages['@clevertree/themed-styler'].registerTheme('$name', $defJson);\n")
                    }
                    syncScript.append("globalThis.__clevertree_packages['@clevertree/themed-styler'].setCurrentTheme('$themeName');\n")
                    ctx.evaluateScript(syncScript.toString(), "sync_bundled_themes.js")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to sync bundled themes to JS bridge", e)
            }
        }
        
        // Wrap code to capture export; compile via new Function so syntax errors surface with line info
        val escapedCode = gson.toJson(code)
        val wrapped = """
            (function() {
                var module = { exports: {} };
                var exports = module.exports;
                
                // Local require/import that knows the current file's URL
                var require = function(id) {
                    return globalThis.require(id, "$filename");
                };
                var __hook_import = function(id, parent) {
                    return globalThis.__hook_import(id, parent || "$filename");
                };
                
                var code = $escapedCode;
                try {
                    var factory = new Function('module', 'exports', 'require', '__hook_import', code);
                    factory(module, exports, require, __hook_import);
                    globalThis.__last_module__ = module.exports;
                    return JSON.stringify({ status: "OK" });
                } catch (e) {
                    var line = e.lineNumber || e.line || 0;
                    var col = e.columnNumber || e.column || 0;
                    var snippet = "";
                    try {
                        var lines = code.split(/\n/);
                        if (line > 0 && line <= lines.length) {
                            snippet = lines[line - 1];
                        }
                    } catch (_) {}
                    return JSON.stringify({
                        status: "Error",
                        message: e.message || String(e),
                        stack: e.stack || "",
                        line: line,
                        column: col,
                        snippet: snippet
                    });
                }
            })();
        """.trimIndent()
        
        val wrappedResultJson = try {
            ctx.evaluateScript(wrapped, filename)
        } catch (e: JSException) {
            val msg = e.message ?: e.toString()
            val stack = e.stackTraceToString()
            Log.e(TAG, "JSException during executeJs: $msg\n$stack", e)
            onJSError?.invoke("JSException: $msg")
            handleError(
                HookError.ExecutionError(
                    message = "JSException: $msg",
                    sourceCode = code,
                    stackTrace = stack
                )
            )
            return
        }
        val wrappedStr = wrappedResultJson?.toString()
        Log.d(TAG, "Wrapped code evaluation result length: ${wrappedStr?.length}")
        Log.d(TAG, "Wrapped code evaluation result preview: ${wrappedStr?.take(200)}")
        
        val wrappedResult = try {
            if (wrappedStr.isNullOrEmpty()) {
                mapOf("status" to "Error", "message" to "Execution returned null result")
            } else {
                gson.fromJson(wrappedStr, Map::class.java)
            }
        } catch (e: Exception) {
            Log.e(TAG, "JSON parse error: ${e.message}")
            mapOf("status" to "Error", "message" to "Failed to parse execution result: ${wrappedStr ?: "<null>"}")
        }

        if (wrappedResult == null || wrappedResult["status"] == "Error") {
            val msg = wrappedResult?.get("message") as? String ?: "Unknown error (null result)"
            val stack = wrappedResult?.get("stack") as? String ?: ""
            val line = (wrappedResult?.get("line") as? Double)?.toInt() ?: 0
            val col = (wrappedResult?.get("column") as? Double)?.toInt() ?: 0
            val snippet = wrappedResult?.get("snippet") as? String ?: ""
            val pointer = if (col > 0) {
                val safeCol = col.coerceAtMost(200)
                " ".repeat(safeCol - 1) + "^"
            } else {
                ""
            }
            val contextLine = if (snippet.isNotEmpty() || pointer.isNotEmpty()) listOf(snippet, pointer).joinToString("\n").trimEnd() else ""

            val isSyntax = msg.contains("SyntaxError", ignoreCase = true)
            val error = if (isSyntax) {
                HookError.ParseError(
                    message = "JS SyntaxError: $msg",
                    source = code,
                    line = line,
                    column = col,
                    context = contextLine
                )
            } else {
                HookError.ExecutionError(
                    message = "JS Error: $msg (at $line:$col)",
                    sourceCode = code,
                    stackTrace = stack
                )
            }
            handleError(error)
            return
        }
        
        if (rendererMode == RendererMode.ACT || rendererMode == RendererMode.ANDROID) {
            val renderCode = """
                (function() {
                    try {
                        const mod = globalThis.__last_module__;
                        if (!mod || (typeof mod === 'object' && Object.keys(mod).length === 0)) {
                            return JSON.stringify({ status: 'Error', message: 'No module exports found. Ensure your hook uses "export default".' });
                        }
                        const Component = mod.default || mod;
                        
                        // Select renderer based on CURRENT MODE (not what globals exist)
                        var renderer;
                        var rendererName = '';
                        var currentMode = '${rendererMode}';
                        
                        console.log('[RENDER] Current mode from Kotlin: ' + currentMode);
                        
                        if (currentMode === 'ACT') {
                            if (typeof globalThis.Act !== 'undefined') {
                                renderer = globalThis.Act;
                                rendererName = 'Act';
                            } else {
                                console.error('[RENDER ERROR] Mode is ACT but globalThis.Act is undefined!');
                            }
                        } else if (currentMode === 'ANDROID') {
                            if (typeof globalThis.Android !== 'undefined') {
                                renderer = globalThis.Android;
                                rendererName = 'Android';
                            } else {
                                console.error('[RENDER ERROR] Mode is ANDROID but globalThis.Android is undefined!');
                            }
                        }
                        
                        // Fallback check if renderer wasn't set correctly
                        if (!renderer) {
                            console.warn('[RENDER FALLBACK] Renderer not found for mode ' + currentMode + ', checking globals...');
                            if (typeof globalThis.Act !== 'undefined') {
                                renderer = globalThis.Act;
                                rendererName = 'Act (fallback)';
                            } else if (typeof globalThis.Android !== 'undefined') {
                                renderer = globalThis.Android;
                                rendererName = 'Android (fallback)';
                            } else if (typeof globalThis.React !== 'undefined') {
                                renderer = globalThis.React;
                                rendererName = 'React (fallback alias)';
                            }
                        }
                        
                        // Comprehensive pre-render validation
                        console.log('═════════════════════════════════════');
                        console.log('[PRE-RENDER DIAGNOSTICS]');
                        console.log('Renderer: ' + rendererName);
                        console.log('Bridge available: ' + (globalThis.bridge ? 'YES' : 'NO'));
                        console.log('nativeBridge available: ' + (globalThis.nativeBridge ? 'YES' : 'NO'));
                        console.log('Renderer available: ' + (typeof renderer !== 'undefined' ? 'YES' : 'NO'));
                        console.log('Renderer type: ' + typeof renderer);
                        console.log('Renderer.render: ' + (renderer && typeof renderer.render === 'function' ? 'FUNCTION' : 'MISSING'));
                        console.log('Component type: ' + typeof Component);
                        console.log('Component is function: ' + (typeof Component === 'function'));
                        console.log('═════════════════════════════════════');
                        
                        // If bridge exists, verify its methods are callable
                        if (globalThis.bridge) {
                            console.log('[BRIDGE VALIDATION]');
                            console.log('  createView: ' + (typeof globalThis.bridge.createView === 'function' ? 'OK' : 'BROKEN'));
                            console.log('  addChild: ' + (typeof globalThis.bridge.addChild === 'function' ? 'OK' : 'BROKEN'));
                            console.log('  updateProps: ' + (typeof globalThis.bridge.updateProps === 'function' ? 'OK' : 'BROKEN'));
                            console.log('  clearViews: ' + (typeof globalThis.bridge.clearViews === 'function' ? 'OK' : 'BROKEN'));
                        } else {
                            console.warn('[CRITICAL] Bridge undefined. Rendering will fail.');
                        }
                        
                        if (typeof Component === 'function' && renderer) {
                            console.log('[RENDER] Calling ' + rendererName + '.render with Component');
                            renderer.render(Component, globalThis.__hook_props);
                            console.log('[RENDER] ' + rendererName + '.render completed (no error thrown)');
                            
                            // Post-render diagnostic: check if renderer called any bridge methods
                            var bridgeCallCount = (globalThis.__bridge_call_count__ = (globalThis.__bridge_call_count__ || 0));
                            console.log('[POST-RENDER] Bridge method call count: ' + bridgeCallCount);
                            if (bridgeCallCount === 0) {
                                console.warn('[POST-RENDER WARNING] Bridge methods were never called. ' + rendererName + '.render may not have executed layout logic.');
                            }
                            
                            return JSON.stringify({ status: "OK", bridgeCalls: bridgeCallCount, renderer: rendererName });
                        } else if (typeof Component === 'object' && Component !== null) {
                            if (renderer && renderer.render) {
                                console.log('[RENDER] Calling ' + rendererName + '.render with object Component');
                                renderer.render(Component, globalThis.__hook_props);
                                console.log('[RENDER] ' + rendererName + '.render completed (no error thrown)');
                                return JSON.stringify({ status: "OK", renderer: rendererName });
                            }
                            return JSON.stringify({ status: 'Error', message: 'Component is object but renderer.render missing' });
                        } else {
                            var diagnostics = {
                                rendererType: typeof renderer,
                                componentType: typeof Component,
                                rendererExists: typeof renderer !== 'undefined',
                                bridgeExists: typeof globalThis.bridge !== 'undefined'
                            };
                            return JSON.stringify({ 
                                status: 'Error', 
                                message: 'Cannot render: renderer=' + typeof renderer + ', Component=' + typeof Component,
                                diagnostics: diagnostics
                            });
                        }
                    } catch (e) {
                        console.error('[RENDER ERROR] ' + e.message);
                        console.error('[RENDER ERROR] Stack: ' + e.stack);
                        return JSON.stringify({ status: 'Error', message: e.message, stack: e.stack });
                    }
                })();
            """.trimIndent()
            try {
                val renderResultJson = ctx.evaluateScript(renderCode, "render.js")
                Log.d(TAG, "[RENDER_RESULT] Raw: ${renderResultJson.toString().take(200)}")
                
                val renderResult = try {
                    if (renderResultJson == null) {
                        mapOf("status" to "Error", "message" to "Render returned null result")
                    } else {
                        gson.fromJson(renderResultJson, Map::class.java)
                    }
                } catch (e: Exception) {
                    mapOf("status" to "Error", "message" to "Failed to parse render result: $renderResultJson")
                }

                if (renderResult == null || renderResult["status"] == "Error") {
                    val msg = renderResult?.get("message") as? String ?: "Unknown error (null result)"
                    Log.e(TAG, "[RENDER_ERROR] $msg")
                    handleError(HookError.ExecutionError(
                        message = msg,
                        sourceCode = code,
                        stackTrace = renderResult?.get("stack") as? String ?: ""
                    ))
                    return
                }
                
                val rendererUsed = renderResult["renderer"] as? String ?: "unknown"
                val bridgeCalls = (renderResult["bridgeCalls"] as? Double)?.toInt() ?: 0
                val viewsCreated = nativeRenderer.getViewCount()
                
                Log.i(TAG, "[RENDER_SUCCESS] Renderer: $rendererUsed, Views: $viewsCreated, Bridge calls: $bridgeCalls, Expected: $rendererMode")
                debugConsole?.logInfo("✓ Rendered with $rendererUsed ($viewsCreated views, $bridgeCalls calls)")
                
                // Verify correct renderer was used
                when (rendererMode) {
                    RendererMode.ACT -> {
                        if (!rendererUsed.contains("Act", ignoreCase = true)) {
                            Log.e(TAG, "[RENDER_ERROR] Wrong renderer! Expected Act but got $rendererUsed")
                            debugConsole?.logError("⚠️ Wrong renderer: expected Act, got $rendererUsed")
                        } else {
                            Log.i(TAG, "[RENDER_VERIFIED] Correct renderer used: $rendererUsed for mode $rendererMode")
                        }
                    }
                    RendererMode.ANDROID -> {
                        if (!rendererUsed.contains("Android", ignoreCase = true) && !rendererUsed.contains("React", ignoreCase = true)) {
                            Log.e(TAG, "[RENDER_ERROR] Wrong renderer! Expected Android but got $rendererUsed")
                            debugConsole?.logError("⚠️ Wrong renderer: expected Android, got $rendererUsed")
                        } else {
                            Log.i(TAG, "[RENDER_VERIFIED] Correct renderer used: $rendererUsed for mode $rendererMode")
                        }
                    }
                }
                
                Log.d(TAG, "[RENDER_SUMMARY] ScrollView.childCount=${this@HookRenderer.childCount}, ScrollView.visibility=${this@HookRenderer.visibility}")
                    
                if (viewsCreated == 0) {
                    Log.w(TAG, "WARNING: Bridge was invoked but no views were created. Renderer=$rendererUsed, BridgeCalls=$bridgeCalls")
                    // Show diagnostic error UI
                    val diagnosticMsg = buildString {
                        append("Hook rendered but produced no native views\n\n")
                        append("Details:\n")
                        append("• Renderer: $rendererUsed\n")
                        append("• Bridge calls: $bridgeCalls\n")
                        append("• Component likely returned null or empty\n\n")
                        append("Ensure your hook's default export returns a valid component")
                    }
                    handleError(diagnosticMsg)
                } else {
                    onReady?.invoke(viewsCreated)
                }
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    fun switchTheme(themeName: String) {
        Log.i(TAG, "[THEME_SWITCH] ========== SWITCHING TO THEME: $themeName ==========")
        Log.d(TAG, "[THEME_SWITCH] customThemesJson before: ${customThemesJson?.take(200)}")
        
        val themesJson = customThemesJson?.let { existing ->
            try {
                val map = gson.fromJson(existing, MutableMap::class.java) as MutableMap<String, Any>
                Log.d(TAG, "[THEME_SWITCH] Old current_theme: ${map["current_theme"]}")
                map["current_theme"] = themeName
                if (!map.containsKey("default_theme")) {
                    map["default_theme"] = themeName
                }
                val result = gson.toJson(map)
                Log.d(TAG, "[THEME_SWITCH] New current_theme: $themeName")
                result
            } catch (e: Exception) {
                Log.w(TAG, "[THEME_SWITCH] Failed to update custom theme JSON, falling back", e)
                null
            }
        } ?: buildThemesJson(themeName)

        customThemesJson = themesJson  // Update stored theme so reload uses new theme
        Log.d(TAG, "[THEME_SWITCH] customThemesJson after: ${customThemesJson?.take(200)}")
        Log.d(TAG, "[THEME_SWITCH] Calling nativeRenderer.setTheme()")
        nativeRenderer.setTheme(themesJson)
        currentHookPath?.let { path ->
            Log.i(TAG, "[THEME_SWITCH] Reloading hook $path with theme $themeName")
            loadHook(path, currentProps)  // Preserve props on reload
        }
    }

    private fun getSystemTheme(): String {
        val mode = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        return if (mode == Configuration.UI_MODE_NIGHT_YES) "dark" else "light"
    }

    // Build themes JSON (light/dark) and set current_theme for Android renderer
    private fun buildThemesMap(themeName: String? = null): Map<String, Any> {
        val name = themeName ?: getSystemTheme()
        Log.d(TAG, "buildThemesMap called for theme: $name")
        return mapOf(
            "themes" to mapOf(
                "light" to mapOf(
                    "variables" to mapOf(
                        "primary" to "#3b82f6",
                        "secondary" to "#6366f1",
                        "surface" to "#f3f4f6",
                        "bg" to "#ffffff",
                        "text" to "#1f2937",
                        "muted" to "#6b7280",
                        "border" to "#e5e7eb"
                    ),
                    "selectors" to mapOf(
                        ".bg-surface" to mapOf("backgroundColor" to "#f3f4f6"),
                        ".bg-bg" to mapOf("backgroundColor" to "#ffffff"),
                        ".bg-primary" to mapOf("backgroundColor" to "#3b82f6"),
                        ".text-themed" to mapOf("color" to "#1f2937"),
                        ".text-muted" to mapOf("color" to "#6b7280"),
                        ".border-themed" to mapOf("borderColor" to "#e5e7eb", "borderWidth" to 1)
                    )
                ),
                "dark" to mapOf(
                    "inherits" to "light",
                    "variables" to mapOf(
                        "primary" to "#60a5fa",
                        "secondary" to "#818cf8",
                        "surface" to "#1f2937",
                        "bg" to "#111827",
                        "text" to "#f9fafb",
                        "muted" to "#9ca3af",
                        "border" to "#374151"
                    ),
                    "selectors" to mapOf(
                        ".bg-surface" to mapOf("backgroundColor" to "#1f2937"),
                        ".bg-bg" to mapOf("backgroundColor" to "#111827"),
                        ".bg-primary" to mapOf("backgroundColor" to "#60a5fa"),
                        ".text-themed" to mapOf("color" to "#f9fafb"),
                        ".text-muted" to mapOf("color" to "#9ca3af"),
                        ".border-themed" to mapOf("borderColor" to "#374151", "borderWidth" to 1)
                    )
                ),
                "default" to mapOf(
                    "inherits" to "light",
                    "selectors" to mapOf(
                        "div" to mapOf("padding" to 0),
                        "span" to mapOf("color" to "#1f2937", "fontSize" to 16),
                        ".rounded" to mapOf("borderRadius" to 8),
                        ".rounded-lg" to mapOf("borderRadius" to 12),
                        ".rounded-md" to mapOf("borderRadius" to 6),
                        ".shadow-sm" to mapOf("elevation" to 2)
                    )
                )
            ),
            "current_theme" to name,
            "default_theme" to "default"
        )
    }

    private fun buildThemesJson(themeName: String? = null): String {
        return gson.toJson(buildThemesMap(themeName))
    }

    /**
     * Fetch hook source via module loader - handles both local assets and remote URLs
     */
    private suspend fun fetchViaModuleLoader(path: String): String = withContext(Dispatchers.IO) {
        // Check cache first for remote URLs
        if (path.startsWith("http")) {
            cache[path]?.let { return@withContext it }
        }
        
        // Use __android_readFile bridge (same as module loader)
        val source = if (path.startsWith("http")) {
            URL(path).readText()
        } else {
            context.assets.open(path).bufferedReader().use { it.readText() }
        }
        
        // Cache remote URLs
        if (path.startsWith("http")) {
            cache[path] = source
        }
        
        source
    }

    private fun handleError(error: HookError) {
        currentStatus = currentStatus.copy(loading = false, error = error.message)
        onError?.invoke(error)
        Log.e(TAG, "Error: ${error.message}")
        
        // Ensure ScrollView is visible before showing error
        scrollView.visibility = View.VISIBLE
        scrollView.alpha = 1.0f

        post {
            scrollView.removeAllViews()
            val errorView = TextView(context).apply {
                val errorText = StringBuilder()
                errorText.append("⚠️ Hook Error\n\n")
                errorText.append(error.message)
                
                if (error is HookError.ExecutionError && error.stackTrace.isNotEmpty()) {
                    errorText.append("\n\nStack Trace:\n")
                    errorText.append(error.stackTrace)
                }
                
                if (error is HookError.ParseError) {
                    errorText.append("\n\nPosition: ${error.line}:${error.column}")
                    if (error.context.isNotEmpty()) {
                        errorText.append("\nContext: ${error.context}")
                    }
                }
                
                text = errorText.toString()
                setTextColor(Color.parseColor("#D32F2F"))
                setPadding(48, 48, 48, 48)
                textSize = 14f
                lineSpacingExtra = 8f
                typeface = android.graphics.Typeface.MONOSPACE
                layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
            }
            scrollView.addView(errorView)
        }
    }

    private fun handleError(e: Exception) {
        val error = when (e) {
            is HookError -> e
            else -> HookError.ExecutionError(e.message ?: "Unknown error", errorCause = e)
        }
        handleError(error)
    }

    private fun handleError(message: String) {
        handleError(Exception(message))
    }

    fun getStatus(): HookStatus = currentStatus

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        jsContext = null
        scope.cancel()
    }
}


