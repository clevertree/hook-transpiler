package com.clevertree.hooktranspiler.render

import android.content.Context
import android.graphics.Color
import android.util.AttributeSet
import android.util.Log
import android.widget.FrameLayout
import android.widget.ScrollView
import android.widget.TextView
import com.clevertree.hooktranspiler.error.HookError
import com.clevertree.hooktranspiler.model.HookStatus
import com.clevertree.hooktranspiler.model.RendererMode
import com.clevertree.hooktranspiler.transpiler.HookTranspiler
import com.facebook.jsc.wrapper.JSContext
import com.facebook.jsc.wrapper.JSException
import com.facebook.jsc.wrapper.JavaScriptObject
import com.facebook.jsc.wrapper.JSObject
import com.google.gson.Gson
import kotlinx.coroutines.*
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

/**
 * Native Android Hook Renderer component.
 * Handles fetching, transpiling, and rendering JSX hooks into native Android views.
 */
class HookRenderer @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : ScrollView(context, attrs, defStyleAttr) {

    private val TAG = "HookRenderer"
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private val transpiler = HookTranspiler()
    private val nativeRenderer = NativeRenderer(context, this)
    private val cache = ConcurrentHashMap<String, String>()
    
    private var jsContext: JSContext? = null
    private var rendererMode = RendererMode.ACT
    private var host: String = ""
    private var currentStatus = HookStatus(hookPath = "")

    // Callbacks
    var onLoading: (() -> Unit)? = null
    var onReady: ((Int) -> Unit)? = null
    var onError: ((HookError) -> Unit)? = null

    init {
        isFillViewport = true
        setupEngine()
    }

    /**
     * Set the host URL for remote hooks
     */
    fun setHost(hostUrl: String) {
        this.host = hostUrl
    }

    /**
     * Set the renderer mode (ACT or REACT_NATIVE)
     */
    fun setRendererMode(mode: RendererMode) {
        this.rendererMode = mode
    }

    /**
     * Load and render a hook from a URL or local path
     */
    fun loadHook(path: String, props: Map<String, Any> = emptyMap()) {
        Log.d(TAG, "loadHook: $path")
        scope.launch {
            try {
                onLoading?.invoke()
                currentStatus = currentStatus.copy(loading = true, hookPath = path)

                val source = if (path.startsWith("http")) {
                    fetchRemoteHook(path)
                } else {
                    fetchLocalHook(path)
                }

                render(source, path, props)
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    /**
     * Render JSX source code directly
     */
    fun render(source: String, filename: String = "hook.jsx", props: Map<String, Any> = emptyMap()) {
        Log.d(TAG, "render: $filename, source length=${source.length}")
        scope.launch {
            try {
                val transpiled = transpiler.transpile(source, filename).getOrThrow()
                executeJs(transpiled, filename, props)
                
                currentStatus = currentStatus.copy(loading = false, ready = true)
                val viewCount = nativeRenderer.getViewCount()
                Log.i(TAG, "Render complete. Native views created: $viewCount")
                onReady?.invoke(viewCount)
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    private fun setupEngine() {
        Log.d(TAG, "setupEngine: starting")
        try {
            jsContext = JSContext(JSContext.create()).also { ctx ->
                Log.d(TAG, "setupEngine: JSContext created")
                installBridge(ctx)
                Log.d(TAG, "setupEngine: bridge installed")
                nativeRenderer.setJSContext(ctx)
                Log.d(TAG, "setupEngine: loading runtime")
                loadRuntime(ctx)
                Log.d(TAG, "setupEngine: runtime loaded")
            }
            Log.i(TAG, "JS Engine initialized")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize JS Engine", e)
        }
    }

    private fun installBridge(ctx: JSContext) {
        ctx.setObjectForKey("__android_log", object : JavaScriptObject() {
            fun callString(level: String, message: String): String {
                Log.d("HookJS_Bridge", "level=$level, message=$message")
                when (level) {
                    "ERROR" -> Log.e("HookJS", message)
                    "WARN" -> Log.w("HookJS", message)
                    else -> Log.d("HookJS", message)
                }
                return ""
            }
        })

        ctx.setObjectForKey("__android_readFile", object : JavaScriptObject() {
            fun callString(path: String): String {
                return try {
                    context.assets.open(path).bufferedReader().use { it.readText() }
                } catch (e: Exception) {
                    ""
                }
            }
        })

        ctx.setObjectForKey("__android_transpile", object : JavaScriptObject() {
            fun callString(source: String, filename: String): String {
                return transpiler.transpile(source, filename).getOrNull() ?: ""
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
                nativeRenderer.clear()
            }
        })

        // Install require shim
        val bridgeCode = """
            (function() {
                var globalObj = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : this);
                
                globalObj.console = {
                    log: function() { 
                        var args = Array.prototype.slice.call(arguments).map(function(arg) {
                            try {
                                return (typeof arg === 'object' && arg !== null) ? JSON.stringify(arg) : String(arg);
                            } catch (e) {
                                return String(arg);
                            }
                        });
                        __android_log('LOG', args.join(' ')); 
                    },
                    error: function() { 
                        var args = Array.prototype.slice.call(arguments).map(function(arg) {
                            try {
                                return (typeof arg === 'object' && arg !== null) ? JSON.stringify(arg) : String(arg);
                            } catch (e) {
                                return String(arg);
                            }
                        });
                        __android_log('ERROR', args.join(' ')); 
                    },
                    warn: function() { 
                        var args = Array.prototype.slice.call(arguments).map(function(arg) {
                            try {
                                return (typeof arg === 'object' && arg !== null) ? JSON.stringify(arg) : String(arg);
                            } catch (e) {
                                return String(arg);
                            }
                        });
                        __android_log('WARN', args.join(' ')); 
                    }
                };

                globalObj.onerror = function(message, source, lineno, colno, error) {
                    console.error('GLOBAL ERROR: ' + message + ' at ' + source + ':' + lineno + ':' + colno + (error ? '\n' + error.stack : ''));
                };

                globalObj.__require_cache = {};
                
                globalObj.__require_module = function(id, parentPath) {
                    if (id === 'react') return { default: globalObj.Act || globalObj.React || globalObj.__react || {} };
                    if (id === 'act') return { default: globalObj.Act || globalObj.React || {} };
                    if (id === '@clevertree/act') return { default: globalObj.Act || globalObj.React || {} };
                    if (id === '@clevertree/meta') return { default: { url: parentPath || id }, url: parentPath || id };

                    if (globalObj.__require_cache[id]) return globalObj.__require_cache[id];

                    var path = id;
                    if (path.startsWith('./')) path = path.substring(2);
                    if (path.startsWith('/')) path = path.substring(1);
                    if (path.startsWith('hooks/')) path = path.substring(6);
                    
                    var filePath = path.split('?')[0].split('#')[0];
                    
                    var source = __android_readFile(filePath);
                    if (!source && !filePath.endsWith('.jsx')) source = __android_readFile(filePath + '.jsx');
                    if (!source && !filePath.endsWith('.js')) source = __android_readFile(filePath + '.js');

                    if (!source) {
                        console.warn('require failed for: ' + id);
                        return {};
                    }
                    
                    var transpiled = __android_transpile(source, filePath);
                    var module = { exports: {} };
                    var exports = module.exports;
                    
                    try {
                        var fn = new Function('module', 'exports', 'require', transpiled);
                        var requireWrapper = function(childId) {
                            var resolvedId = childId;
                            if (childId.startsWith('./')) {
                                var lastSlash = filePath.lastIndexOf('/');
                                var dir = lastSlash === -1 ? '' : filePath.substring(0, lastSlash + 1);
                                resolvedId = dir + childId.substring(2);
                            } else if (childId.startsWith('/')) {
                                resolvedId = childId.substring(1);
                            }
                            return globalObj.require(resolvedId, id);
                        };
                        fn(module, exports, requireWrapper);
                        globalObj.__require_cache[id] = module.exports;
                        return module.exports;
                    } catch (e) {
                        console.error('Error evaluating module ' + id + ': ' + e.message + '\n' + e.stack);
                        return {};
                    }
                };

                globalObj.require = function(id, parentPath) {
                    var res = globalObj.__require_module(id, parentPath);
                    if (id === 'react' || id === 'act' || id === '@clevertree/act') return res.default;
                    if (id === '@clevertree/meta') return res.default;
                    return (res && res.default !== undefined) ? res.default : res;
                };

                globalObj.__hook_import = function(path) {
                    return new Promise(function(resolve, reject) {
                        try {
                            resolve(globalObj.__require_module(path));
                        } catch (e) {
                            reject(e);
                        }
                    });
                };

                globalObj.nativeBridge = {
                    createView: function(tag, type, props) { __android_createView(JSON.stringify({tag: tag, type: type, props: props || {}})); },
                    updateProps: function(tag, props) { __android_updateProps(JSON.stringify({tag: tag, props: props || {}})); },
                    addChild: function(parent, child, index) { __android_addChild(JSON.stringify({parent: parent, child: child, index: index})); },
                    removeChild: function(parent, child) { __android_removeChild(JSON.stringify({parent: parent, child: child})); },
                    addEventListener: function(tag, event) { __android_addEventListener(JSON.stringify({tag: tag, event: event})); },
                    clearViews: function() { __android_clearViews(); }
                };
                globalObj.bridge = globalObj.nativeBridge;

                globalObj.__hook_triggerEvent = function(data) {
                    if (globalObj.Act && globalObj.Act.triggerEvent) {
                        globalObj.Act.triggerEvent(data.tag, data.event, data.data);
                    } else {
                        console.warn('Act.triggerEvent not found');
                    }
                };
            })();
        """.trimIndent()
        val bridgeResult = ctx.evaluateScript(bridgeCode, "bridge.js")
        Log.d(TAG, "Bridge evaluation result: $bridgeResult")
    }

    private fun loadRuntime(ctx: JSContext) {
        Log.d(TAG, "loadRuntime: reading asset")
        try {
            val source = context.assets.open("act-android.bundle.js").bufferedReader().use { it.readText() }
            Log.d(TAG, "loadRuntime: evaluating runtime (${source.length} bytes)")
            val result = ctx.evaluateScript(source, "act-android.bundle.js")
            Log.d(TAG, "Act runtime evaluation result: $result")
            ctx.evaluateScript("globalThis.__runtime = { mode: 'act', engine: 'jsc' };", "runtime_init.js")
            
            // Alias React to Act for compatibility
            ctx.evaluateScript("if (globalThis.Act && !globalThis.React) { globalThis.React = globalThis.Act; }", "alias.js")
            
            Log.i(TAG, "Act runtime loaded successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load act-android.bundle.js", e)
        }
    }

    private fun executeJs(code: String, filename: String, props: Map<String, Any>) {
        Log.d(TAG, "executeJs: $filename, code length=${code.length}")
        Log.d(TAG, "Code: $code")
        val ctx = jsContext ?: return
        
        nativeRenderer.clear()
        
        val propsJson = gson.toJson(props)
        ctx.evaluateScript("globalThis.__hook_props = $propsJson;", "props.js")
        
        // Update native renderer theme if present in props
        val themes = props["themes"] as? Map<String, Any>
        if (themes != null) {
            nativeRenderer.setTheme(gson.toJson(themes))
        } else {
            // Try to find theme in env
            val env = props["env"] as? Map<String, Any>
            val themeName = env?.get("theme") as? String ?: "light"
            // If we have a themes object in assets, we could load it here
            // For now, we'll just pass an empty object or a basic one
            nativeRenderer.setTheme("{\"theme\": \"$themeName\"}")
        }
        
        // Wrap code to capture export
        val wrapped = """
            (function() {
                try {
                    var module = { exports: {} };
                    var exports = module.exports;
                    $code
                    globalThis.__last_module__ = module.exports;
                    return "OK";
                } catch (e) {
                    return "Error: " + e.message + "\n" + e.stack;
                }
            })();
        """.trimIndent()
        
        val wrappedResult = ctx.evaluateScript(wrapped, filename)
        Log.d(TAG, "Wrapped code evaluation result: $wrappedResult")
        
        if (wrappedResult.startsWith("Error")) {
            handleError(wrappedResult)
            return
        }
        
        if (rendererMode == RendererMode.ACT || rendererMode == RendererMode.REACT_NATIVE) {
            val renderCode = """
                (function() {
                    try {
                        const mod = globalThis.__last_module__;
                        if (!mod) {
                            return 'Error: No module exports found';
                        }
                        const Component = mod.default || mod;
                        
                        // Use Act for both modes for now, but ensure React alias is set
                        const renderer = globalThis.Act || globalThis.React;
                        
                        if (typeof Component === 'function' && renderer) {
                            renderer.render(Component, globalThis.__hook_props);
                            return "OK";
                        } else if (typeof Component === 'object' && Component !== null) {
                            if (renderer && renderer.render) {
                                renderer.render(Component, globalThis.__hook_props);
                                return "OK";
                            }
                            return 'Error: Component is object but renderer.render missing';
                        } else {
                            return 'Error: Cannot render: renderer=' + typeof renderer + ', Component=' + typeof Component;
                        }
                    } catch (e) {
                        return 'Error: ' + e.message + '\n' + e.stack;
                    }
                })();
            """.trimIndent()
            try {
                val renderResult = ctx.evaluateScript(renderCode, "render.js")
                Log.d(TAG, "Render code evaluation result: $renderResult")
                Log.i(TAG, "Render complete. Native views created: ${nativeRenderer.getViewCount()}")
                if (renderResult != null && renderResult.startsWith("Error")) {
                    handleError(renderResult)
                }
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    private suspend fun fetchRemoteHook(url: String): String = withContext(Dispatchers.IO) {
        cache[url]?.let { return@withContext it }
        val source = URL(url).readText()
        cache[url] = source
        source
    }

    private suspend fun fetchLocalHook(path: String): String = withContext(Dispatchers.IO) {
        context.assets.open(path).bufferedReader().use { it.readText() }
    }

    private fun handleError(e: Exception) {
        val error = when (e) {
            is HookError -> e
            else -> HookError.ExecutionError(e.message ?: "Unknown error", errorCause = e)
        }
        currentStatus = currentStatus.copy(loading = false, error = error.message)
        onError?.invoke(error)
        Log.e(TAG, "Error: ${error.message}", e)

        post {
            removeAllViews()
            val errorView = TextView(context).apply {
                text = "Hook Error:\n${error.message}"
                setTextColor(Color.RED)
                setPadding(32, 32, 32, 32)
                textSize = 14f
                layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
            }
            addView(errorView)
        }
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


