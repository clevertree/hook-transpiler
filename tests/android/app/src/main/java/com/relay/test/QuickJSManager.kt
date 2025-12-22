package com.relay.test

import android.content.Context
import android.util.Log
import android.os.Handler
import android.os.Looper
import app.cash.quickjs.QuickJs
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.relay.client.RustTranspilerModule
import com.relay.client.ThemedStylerModule
import java.io.BufferedReader
import java.io.InputStreamReader

// Android uses ACT library exclusively (has full renderer)
// REACT mode is for web only

interface TranspileCallback {
    fun transpile(code: String, filename: String): String
}

class QuickJSManager(private val context: Context) {
    companion object {
        private const val TAG = "QuickJSManager"
        var activeManager: QuickJSManager? = null
    }

    private val gson = Gson()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var quickJs: QuickJs? = null
    private var lastAsset: String? = "test-hook.jsx"
    private var lastProps: Map<String, Any> = emptyMap()
    private var themesJson: String = "{}"
    var userMessageHandler: ((String, Boolean) -> Unit)? = null

    fun initialize() {
        loadThemes()
        resetEngine()
    }

    private fun loadThemes() {
        try {
            // Read theme.yaml if present (ignored when absent)
            readAssetFile("theme.yaml")
            // Simple hack to convert yaml to json-like themes for the styler if needed
            // But usually the styler wants a specific JSON format.
            // For now, let's just use a hardcoded basic theme if we can't parse YAML easily
            // Actually, themed-styler might handle the YAML if we pass it, but JNI expects themes_json.
            // Let's just provide a basic JSON theme for now to ensure it works.
            themesJson = """
                {
                  "themes": {
                    "default": {
                      "variables": { "colors": { "primary": "#3b82f6", "text": "#1f2937" } },
                      "selectors": {
                        "div": { "padding": 16 },
                        "span": { "color": "#1f2937", "fontSize": 16 },
                        ".text-blue-500": { "color": "#3b82f6" },
                        ".font-bold": { "fontWeight": "bold" },
                        ".bg-gray-100": { "backgroundColor": "#f3f4f6" },
                        ".rounded": { "borderRadius": 8 }
                      }
                    }
                  },
                  "current_theme": "default",
                  "default_theme": "default"
                }
            """.trimIndent()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load themes", e)
        }
    }

    fun getThemesJson(): String = themesJson

    private fun resetEngine() {
        quickJs?.close()
        quickJs = null
        activeManager = this

        quickJs = QuickJs.create().also { engine ->
            Log.i(TAG, "Starting QuickJS engine with ACT runtime")
            installNativeFunctions(engine)
            installConsole(engine)
            installAndroidBridge(engine)
            // installRenderer(engine) // Removed: Using act.js bundled renderer
            AndroidRenderer.setQuickJsEngine(engine)
            loadRuntime(engine)
            injectVersions(engine)
            Log.i(TAG, "QuickJS engine initialized")
        }
    }

    private fun loadRuntime(engine: QuickJs) {
        // Load ACT runtime from npm package (@clevertree/act) bundled for Android
        loadAsset(engine, "act-android.bundle.js")
        // act-android.bundle.js sets globalThis.Act and globalThis.React
        
        engine.evaluate(
            "globalThis.__runtime = { mode: 'act' };",
            "act_runtime.js"
        )
        
        // Define require for basic modules
        engine.evaluate("""
            globalThis.require = function(moduleName) {
                if (moduleName === 'react') {
                    return { default: globalThis.React };
                }
                if (moduleName === 'react/jsx-runtime') {
                    return globalThis.__hook_jsx_runtime || {
                        jsx: function(type, props) { return globalThis.React.createElement(type, props); },
                        jsxs: function(type, props) { return globalThis.React.createElement(type, props); },
                        Fragment: 'div'
                    };
                }
                throw new Error('Module not found: ' + moduleName);
            };
        """, "require_shim.js")
        
        loadAsset(engine, "hook-renderer.js")
        engine.evaluate(
            "globalThis.HookTranspilerAndroid = (typeof HookTranspilerAndroid !== 'undefined') ? HookTranspilerAndroid : {};" +
                    "globalThis.HookRenderer = HookTranspilerAndroid.HookRenderer;" +
                    "globalThis.HookApp = HookTranspilerAndroid.HookApp;" +
                    "globalThis.installWebApiShims = HookTranspilerAndroid.installWebApiShims;" +
                    "globalThis.ThemedStyler = (typeof ThemedStyler !== 'undefined') ? ThemedStyler : {};",
            "hook_renderer_globals.js"
        )
    }

    private fun injectVersions(engine: QuickJs) {
        try {
            val transpilerVersion = RustTranspilerModule.nativeGetVersion()
            val stylerVersion = ThemedStylerModule.nativeGetVersion()
            val versionsJs = "globalThis.__versions = { transpiler: '${transpilerVersion}', styler: '${stylerVersion}' };"
            engine.evaluate(versionsJs, "versions.js")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to inject versions", e)
        }
    }

    private fun applyHookRewrite(code: String): String {
        var rewritten = code
        // Simple React rewrite
        val reactRe = Regex("import\\s+React\\s*(?:,\\s*\\{([^}]+)\\})?\\s+from\\s+['\"]react['\"];?")
        rewritten = rewritten.replace(reactRe) { match ->
            val named = match.groups[1]?.value
            var res = "const React = (globalThis.__hook_react || globalThis.React);"
            if (named != null) {
                res += " const { $named } = React;"
            }
            res
        }
        
        val reactNamedOnlyRe = Regex("import\\s+\\{([^}]+)\\}\\s+from\\s+['\"]react['\"];?")
        rewritten = rewritten.replace(reactNamedOnlyRe) { match ->
            val named = match.groups[1]?.value
            "const { $named } = (globalThis.__hook_react || globalThis.React);"
        }

        // Export rewrite
        rewritten = rewritten.replace(Regex("export\\s+default\\s+function\\s*\\("), "module.exports.default = function (")
        rewritten = rewritten.replace(Regex("export\\s+default\\s+function\\s+(\\w+)"), "function $1") // and then add to exports later? No, this is tricky.
        
        // Simpler approach for export default:
        if (rewritten.contains("export default")) {
            rewritten = rewritten.replace("export default", "module.exports.default = ")
        }

        return rewritten
    }

    fun renderHook(asset: String, props: Map<String, Any> = emptyMap()) {
        lastAsset = asset
        lastProps = props
        val engine = quickJs ?: return

        AndroidRenderer.clearAll()
        
        Log.i(TAG, "Loading hook from asset: $asset")
        
        // Load the actual hook file from assets
        var hookCode = readAssetFile(asset)
        if (hookCode.isEmpty()) {
            val errorMsg = "Failed to load hook file: $asset"
            Log.e(TAG, errorMsg)
            showError(engine, errorMsg)
            return
        }
        
        // Rewrite hook code to use CommonJS module.exports instead of ES6 export
        hookCode = applyHookRewrite(hookCode)
        
        Log.i(TAG, "Loaded hook code, size=${hookCode.length}")
        
        val renderScript = """
            (function(){
                try {
                    // Verify ACT runtime is available
                    if (!globalThis.Act || typeof Act.render !== 'function') {
                        throw new Error('ACT runtime not available. Check act-android.bundle.js loaded correctly.');
                    }
                    
                    console.log('[HookRenderer] Transpiling hook code');
                    
                    // Get the hook code (will be substituted by Kotlin)
                    var hookCode = ${gson.toJson(hookCode)};
                    
                    // Transpile using the native transpiler callback
                    if (!globalThis.__transpileSync) {
                        throw new Error('Transpiler not available (__transpileSync not found).');
                    }
                    
                    var transpiled = globalThis.__transpileSync.transpile(hookCode, '$asset');
                    console.log('[HookRenderer] Transpilation successful, output size=' + transpiled.length);
                    console.log('[HookRenderer] Module execution starting with proper scope');
                    
                    // Create proper module execution context with variable scoping
                    // Based on quickJsContext.ts pattern - ensures local variables accessible in eval()
                    (function() {
                        // Create CommonJS module context
                        var module = { exports: {} };
                        var exports = module.exports;
                        
                        // Ensure React and runtime globals are available in local scope
                        var React = globalThis.React;
                        var __runtime = globalThis.__runtime;
                        var __hook_jsx_runtime = globalThis.__hook_jsx_runtime;
                        var __hook_props = globalThis.__hook_props || {};
                        
                        // Execute transpiled code in this context
                        // eval() with direct code preserves function-local scope for declared variables
                        eval(transpiled);
                        
                        // Store result in global for rendering
                        globalThis.__last_module__ = module.exports;
                        globalThis.__last_error__ = null;
                    })();
                    
                    console.log('[HookRenderer] Module execution complete');
                    
                    // Get the exported hook component
                    var HookComponent = globalThis.__last_module__.default;
                    if (typeof HookComponent !== 'function') {
                        throw new Error('Hook must export default function, got: ' + typeof HookComponent);
                    }
                    
                    // Validate Act is available before rendering
                    if (!Act || typeof Act.render !== 'function') {
                        throw new Error('Act.render is not available or not a function. ACT runtime may not be properly initialized.');
                    }
                    
                    // Render using ACT runtime
                    var renderResult = Act.render(HookComponent, {});
                    console.log('[HookRenderer] Act.render completed');
                    
                    console.log('[HookRenderer] Hook rendered successfully');
                } catch(e) {
                    var errMsg = '[HookRenderer] ERROR: ' + (e.message || String(e));
                    if (e.stack) {
                        errMsg += '\n' + e.stack;
                    }
                    console.error(errMsg);

                    // Render a friendly error UI so the user sees something instead of a gray box.
                    try {
                        var message = (e && e.message) ? e.message : 'Unknown error while rendering hook';
                        var details = (e && e.stack) ? e.stack : 'No stack available';
                        
                        // Create a simple error display as a fallback
                        var errorComponent = {
                            type: 'scroll',
                            props: { width: 'match_parent', height: 'match_parent', padding: 16, backgroundColor: '#fff3e0' },
                            children: [
                                { type: 'text', props: { text: '⚠️ Rendering Failed', fontSize: 20, color: '#e65100', fontWeight: 'bold', marginBottom: 12 } },
                                { type: 'text', props: { text: 'Error: ' + message, fontSize: 14, color: '#bf360c', marginBottom: 8 } },
                                { type: 'text', props: { text: 'Stack:', fontSize: 12, color: '#ff6f00', fontWeight: 'bold', marginTop: 8, marginBottom: 4 } },
                                { type: 'text', props: { text: details, fontSize: 11, color: '#666', fontFamily: 'monospace' } }
                            ]
                        };
                        
                        // Try to render the error UI
                        if (Act && typeof Act.render === 'function') {
                            Act.render(errorComponent);
                            console.log('[HookRenderer] Error UI rendered');
                        } else {
                            console.error('[HookRenderer] Cannot render error UI: Act.render not available');
                            // As last resort, at least log the error so it shows up in logcat
                            console.error('RENDER ERROR: ' + message + '\n' + details);
                        }
                    } catch(innerErr) {
                        console.error('[HookRenderer] Failed to render error UI:', innerErr);
                        console.error('Original error was:', e);
                    }
                }
            })();
        """.trimIndent()
        
        Log.d(TAG, "[HookRenderer] Evaluating render script for asset=$asset")
        engine.evaluate(renderScript, "render_hook")
        Log.d(TAG, "[HookRenderer] Render script evaluation complete, processing message queue")
        
        // Process the message queue synchronously to ensure all render operations complete
        // before returning from renderHook
        var attempts = 0
        var hasMessages = true
        while (hasMessages && attempts < 10) {
            processMessageQueue(engine)
            attempts++
            Thread.sleep(10) // Brief delay to allow messages to queue
            
            // Check if there are more messages
            val queueCheck = engine.evaluate("globalThis.__messageQueue.length") as? Double ?: 0.0
            hasMessages = queueCheck > 0
        }
        
        Log.d(TAG, "[HookRenderer] Message queue drained after $attempts iterations")
    }

    private fun showError(engine: QuickJs, message: String) {
        val escapedMsg = message.replace("\"", "\\\"").replace("\n", "\\n")
        val errorScript = """
            (function(){
                if (!globalThis.Act || typeof Act.render !== 'function') {
                    console.error('$escapedMsg');
                    return;
                }
                
                var ErrorComponent = function() {
                    return React.createElement('scroll', { width: 'match_parent', height: 'match_parent' },
                        React.createElement('text', { 
                            padding: '16', 
                            color: '#ff0000',
                            text: '$escapedMsg'
                        })
                    );
                };
                
                Act.render(ErrorComponent, {});
            })();
        """.trimIndent()
        
        engine.evaluate(errorScript, "error_display")
        processMessageQueue(engine)
    }

    fun drainMessageQueue() {
        val engine = quickJs ?: return
        processMessageQueue(engine)
    }

    private fun installNativeFunctions(engine: QuickJs) {
        engine.set("__transpileSync", TranspileCallback::class.java, object : TranspileCallback {
            override fun transpile(code: String, filename: String): String {
                val isTypescript = filename.endsWith(".ts") || filename.endsWith(".tsx")
                return RustTranspilerModule.nativeTranspile(code, filename, isTypescript)
            }
        })
        engine.evaluate(
            """
            globalThis.__messageQueue = [];
            globalThis.__pushMessage = function(type, payload) {
                globalThis.__messageQueue.push({ type: type, payload: payload });
            };
            
            // Logging
            globalThis.__nativeLog = function(level, message) {
                globalThis.__pushMessage('log', { level: level, message: message });
            };
            globalThis.__log = globalThis.__nativeLog;
            
            // Transpilation
            globalThis.__nativeTranspile = function(code, filename) {
                return globalThis.__transpileSync.transpile(code, filename);
            };
            
            // View operations
            globalThis.__nativeCreateView = function(tag, type, propsJson) {
                globalThis.__pushMessage('createView', { tag: tag, type: type, props: propsJson });
            };
            globalThis.__nativeUpdateProps = function(tag, propsJson) {
                globalThis.__pushMessage('updateProps', { tag: tag, props: propsJson });
            };
            globalThis.__nativeRemoveView = function(tag) {
                globalThis.__pushMessage('removeView', { tag: tag });
            };
            globalThis.__nativeAddChild = function(parent, child, index) {
                globalThis.__pushMessage('addChild', { parent: parent, child: child, index: index });
            };
            globalThis.__nativeRemoveChild = function(parent, child) {
                globalThis.__pushMessage('removeChild', { parent: parent, child: child });
            };
            globalThis.__nativeClearViews = function() {
                globalThis.__pushMessage('clearViews', {});
            };
            globalThis.__nativeAddEventListener = function(tag, eventName) {
                globalThis.__pushMessage('addEventListener', { tag: tag, eventName: eventName });
            };
            
            // Legacy aliases used by older renderer code
            globalThis.__createView = globalThis.__nativeCreateView;
            globalThis.__updateProps = globalThis.__nativeUpdateProps;
            globalThis.__removeView = globalThis.__nativeRemoveView;
            globalThis.__addChild = globalThis.__nativeAddChild;
            globalThis.__removeChild = globalThis.__nativeRemoveChild;
            globalThis.__clearViews = globalThis.__nativeClearViews;
            globalThis.__addEventListener = globalThis.__nativeAddEventListener;
            globalThis.__transpile = globalThis.__nativeTranspile;
            
            globalThis.fetch = function(url, options) {
                return new Promise((resolve, reject) => {
                    const id = Math.random().toString(36).substring(7);
                    globalThis.__pendingFetches = globalThis.__pendingFetches || {};
                    globalThis.__pendingFetches[id] = { resolve, reject };
                    globalThis.__pushMessage('fetch', { url: url, options: options, id: id });
                });
            };

            globalThis.__resolveFetch = function(id, ok, status, text) {
                const p = globalThis.__pendingFetches && globalThis.__pendingFetches[id];
                if (p) {
                    delete globalThis.__pendingFetches[id];
                    const headers = { get: function() { return null; } };
                    p.resolve({
                        ok: ok,
                        status: status,
                        headers: headers,
                        text: function() { return Promise.resolve(text); },
                        json: function() { return Promise.resolve(JSON.parse(text)); }
                    });
                }
            };
            """.trimIndent(),
            "native_stubs.js"
        )
        processMessageQueue(engine)
    }

    @Suppress("UNCHECKED_CAST")
    private fun processMessageQueue(engine: QuickJs) {
        val queueJson = engine.evaluate("(function() { var q = JSON.stringify(globalThis.__messageQueue); globalThis.__messageQueue = []; return q; })()") as? String ?: return
        if (queueJson.isBlank() || queueJson == "[]") {
            Log.d(TAG, "[ProcessQueue] Queue is empty")
            return
        }
        
        Log.d(TAG, "[ProcessQueue] Processing ${queueJson.length} bytes of messages")
        
        val listType = object : TypeToken<List<Map<String, Any>>>() {}.type
        val messages: List<Map<String, Any>> = try { gson.fromJson(queueJson, listType) } catch (e: Exception) { 
            Log.e(TAG, "[ProcessQueue] Failed to parse messages: ${e.message}")
            return 
        }
        
        Log.d(TAG, "[ProcessQueue] Found ${messages.size} messages")
        
        for ((index, msg) in messages.withIndex()) {
            val msgType = msg["type"] as? String ?: continue
            val payload = (msg["payload"] as? Map<*, *>)
                ?.mapNotNull { (k, v) -> (k as? String)?.let { it to v as Any } }
                ?.toMap() ?: continue
            
            Log.d(TAG, "[ProcessQueue] Message $index: type=$msgType")
            
            mainHandler.post {
                when (msgType) {
                    "log" -> {
                        val level = (payload["level"] as? String)?.lowercase() ?: "log"
                        val message = payload["message"] as? String ?: ""
                        when (level) {
                            "warn" -> Log.w(TAG, "[JS] $message")
                            "error" -> Log.e(TAG, "[JS] $message")
                            "debug" -> Log.d(TAG, "[JS] $message")
                            else -> Log.i(TAG, "[JS] $message")
                        }
                    }
                    "createView" -> {
                        val tag = (payload["tag"] as? Double)?.toInt() ?: return@post
                        val type = payload["type"] as? String ?: return@post
                        val propsJson = payload["props"] as? String ?: "{}"
                        Log.d(TAG, "[ProcessQueue] Creating view: tag=$tag, type=$type")
                        AndroidBridge.createView(tag, type, parseProps(propsJson))
                    }
                    "updateProps" -> {
                        val tag = (payload["tag"] as? Double)?.toInt() ?: return@post
                        val propsJson = payload["props"] as? String ?: "{}"
                        Log.d(TAG, "[ProcessQueue] Updating props: tag=$tag")
                        AndroidBridge.updateProps(tag, parseProps(propsJson))
                    }
                    "removeView" -> {
                        val tag = (payload["tag"] as? Double)?.toInt() ?: return@post
                        Log.d(TAG, "[ProcessQueue] Removing view: tag=$tag")
                        AndroidBridge.removeView(tag)
                    }
                    "addChild" -> {
                        val parent = (payload["parent"] as? Double)?.toInt() ?: return@post
                        val child = (payload["child"] as? Double)?.toInt() ?: return@post
                        val childIndex = (payload["index"] as? Double)?.toInt() ?: -1
                        Log.d(TAG, "[ProcessQueue] Adding child: parent=$parent, child=$child, index=$childIndex")
                        AndroidBridge.addChild(parent, child, childIndex)
                    }
                    "removeChild" -> {
                        val parent = (payload["parent"] as? Double)?.toInt() ?: return@post
                        val child = (payload["child"] as? Double)?.toInt() ?: return@post
                        Log.d(TAG, "[ProcessQueue] Removing child: parent=$parent, child=$child")
                        AndroidBridge.removeChild(parent, child)
                    }
                    "clearViews" -> {
                        Log.d(TAG, "[ProcessQueue] Clearing views")
                        AndroidRenderer.clearAll()
                    }
                    "addEventListener" -> {
                        val tag = (payload["tag"] as? Double)?.toInt() ?: return@post
                        val eventName = payload["eventName"] as? String ?: return@post
                        Log.d(TAG, "[ProcessQueue] Adding event listener: tag=$tag, event=$eventName")
                        AndroidRenderer.addEventListener(tag, eventName)
                    }
                    "fetch" -> {
                        val url = payload["url"] as? String ?: return@post
                        val id = payload["id"] as? String ?: return@post
                        Thread {
                            try {
                                val result = java.net.URL(url).readText()
                                mainHandler.post {
                                    engine.evaluate("globalThis.__resolveFetch('$id', true, 200, ${gson.toJson(result)})")
                                }
                            } catch (e: Exception) {
                                mainHandler.post {
                                    engine.evaluate("globalThis.__resolveFetch('$id', false, 500, ${gson.toJson(e.message)})")
                                }
                            }
                        }.start()
                    }
                }
            }
        }
    }

    private fun installConsole(engine: QuickJs) {
        engine.evaluate(
            "globalThis.console = { log: function() { globalThis.__log('log', Array.from(arguments).join(' ')); }, info: function() { globalThis.__log('info', Array.from(arguments).join(' ')); }, warn: function() { globalThis.__log('warn', Array.from(arguments).join(' ')); }, error: function() { globalThis.__log('error', Array.from(arguments).join(' ')); } };",
            "console.js"
        )
    }

    private fun installAndroidBridge(engine: QuickJs) {
        engine.evaluate(
            """
            (function(){
              var bridgeImpl = {
                transpile: function(code, filename) { return globalThis.__nativeTranspile(code, filename); },
                createView: function(tag, type, props) { globalThis.__nativeCreateView(tag, type, JSON.stringify(props || {})); },
                updateProps: function(tag, props) { globalThis.__nativeUpdateProps(tag, JSON.stringify(props || {})); },
                removeView: function(tag) { globalThis.__nativeRemoveView(tag); },
                addChild: function(parent, child, index) { globalThis.__nativeAddChild(parent, child, index != null ? index : -1); },
                removeChild: function(parent, child) { globalThis.__nativeRemoveChild(parent, child); },
                clear: function() { globalThis.__nativeClearViews(); },
                addEventListener: function(tag, eventName, callback) {
                    if (!globalThis.__eventCallbacks) globalThis.__eventCallbacks = {};
                    if (!globalThis.__eventCallbacks[tag]) globalThis.__eventCallbacks[tag] = {};
                    globalThis.__eventCallbacks[tag][eventName] = callback;
                    globalThis.__nativeAddEventListener(tag, eventName);
                },
                _triggerEvent: function(tag, eventName, data) {
                    if (globalThis.__eventCallbacks && globalThis.__eventCallbacks[tag] && globalThis.__eventCallbacks[tag][eventName]) {
                        globalThis.__eventCallbacks[tag][eventName](data);
                    }
                }
              };
              globalThis.bridge = bridgeImpl;
              globalThis.nativeBridge = bridgeImpl; // legacy alias
            })();
            """.trimIndent(),
            "bridge.js"
        )
    }

    private fun loadAsset(engine: QuickJs, filename: String) {
        val script = readAssetFile(filename)
        if (script.isNotEmpty()) engine.evaluate(script, filename)
    }

    private fun readAssetFile(filename: String): String {
        return try {
            context.assets.open(filename).bufferedReader().use { it.readText() }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to read asset $filename: ${e.message}")
            ""
        }
    }

    private fun parseProps(json: String): Map<String, Any> {
        val type = object : TypeToken<Map<String, Any>>() {}.type
        return runCatching { gson.fromJson<Map<String, Any>>(json, type) }.getOrElse { emptyMap() }
    }

    fun destroy() {
        quickJs?.close()
        quickJs = null
        if (activeManager === this) activeManager = null
    }
}
