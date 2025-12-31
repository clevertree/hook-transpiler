package com.relay.test

import android.content.Context
import android.util.Log
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import com.facebook.jsc.wrapper.JSContext
import com.facebook.jsc.wrapper.JSException
import com.facebook.jsc.wrapper.JavaScriptObject
import com.facebook.jsc.wrapper.JSObject
import com.relay.client.RustTranspilerModule
import com.relay.client.ThemedStylerModule
import com.google.gson.Gson

/**
 * JSC Manager for hook-transpiler tests
 * Manages JavaScriptCore runtime with full ES6 support
 */
class JSCManager(private val context: Context) {
    companion object {
        private const val TAG = "JSCManager"
        var activeManager: JSCManager? = null
    }

    private val gson = Gson()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var jsContext: JSContext? = null
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
        jsContext = null
        activeManager = this

        try {
            jsContext = JSContext(JSContext.create()).also { context ->
                Log.i(TAG, "Starting JSC engine with full ES6 support")
                
                // Install console FIRST so injection logs work
                installConsole(context)
                
                // Inject CommonJS module system after console is ready
                injectCommonJSModule(context)
                
                installNativeFunctions(context)
                installAndroidBridge(context)
                AndroidRenderer.setJSContext(context)
                loadRuntime(context)
                injectVersions(context)
                Log.i(TAG, "JSC engine initialized")
            }
        } catch (e: UnsatisfiedLinkError) {
            Log.e(TAG, "Failed to initialize JSC native bindings", e)
            userMessageHandler?.invoke("JSC native bindings missing: ${e.message}", true)
            jsContext = null
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize JSC engine", e)
            userMessageHandler?.invoke("Failed to initialize JSC: ${e.message}", true)
            jsContext = null
        }
    }

    private fun injectCommonJSModule(context: JSContext) {
        // Create a global module system for CommonJS compatibility
        val moduleCode = """
            // Check what globalThis is
            console.log('[commonjs_init] typeof globalThis = ' + typeof globalThis);
            console.log('[commonjs_init] typeof window = ' + typeof window);
            
            // Global module object for CommonJS - JSC might not have globalThis
            // Try both globalThis and window
            var globalObj = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : this);
            console.log('[commonjs_init] using globalObj');
            
            globalObj.module = { exports: {} };
            globalObj.exports = globalObj.module.exports;
            globalObj.__last_module__ = null;
            
            // Module cache to prevent re-execution
            globalObj.__module_cache = {};
            
            // Simple require function for built-in modules and dynamic imports
            globalObj.require = function(id) {
                console.log('[require] Loading module: ' + id);
                
                // Check cache first
                if (globalObj.__module_cache[id]) {
                    console.log('[require] Cache hit for: ' + id);
                    return globalObj.__module_cache[id];
                }
                
                // Handle built-in modules
                if (id === 'react') {
                    const mod = globalObj.__react || {};
                    globalObj.__module_cache[id] = mod;
                    return mod;
                }
                if (id === '@clevertree/meta') {
                    const mod = {
                        dirname: globalObj.__relay_meta?.dirname || '/',
                        filename: globalObj.__relay_meta?.filename || '/index.js',
                        url: globalObj.__relay_meta?.url || 'http://localhost/'
                    };
                    globalObj.__module_cache[id] = mod;
                    return mod;
                }
                
                // For relative imports and asset files, try to load from __loaded_modules
                if (id.startsWith('./') || id.startsWith('../')) {
                    // Try to find in loaded modules
                    if (globalObj.__loaded_modules && globalObj.__loaded_modules[id]) {
                        const mod = globalObj.__loaded_modules[id];
                        globalObj.__module_cache[id] = mod;
                        return mod;
                    }
                    
                        // Module not found - this is an error, not a fallback
                        throw new Error('Module not found: ' + id + ' (must be loaded via loadAsset first)');
                }
                
                throw new Error('Module not found: ' + id);
            };
        """.trimIndent()
        
        try {
            context.evaluateScript(moduleCode, "commonjs_init.js")
            Log.d(TAG, "Injected CommonJS module system with module cache")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to inject CommonJS module system", e)
            throw e
        }
    }

    private fun installNativeFunctions(context: JSContext) {
        // Initialize message queue
        context.evaluateScript("""
            globalThis.__messageQueue = [];
            globalThis.__pushMessage = function(type, payload) {
                __messageQueue.push({ type: type, payload: payload });
            };
        """.trimIndent(), "message_queue_init.js")
        
        // Install transpile function
        context.evaluateScript("""
            globalThis.__native_transpile = function(source, filename) {
                try {
                    return __android_transpile(source, filename);
                } catch (e) {
                    console.error('Transpile error:', e);
                    return 'throw new Error("Transpile failed: ' + e + '")';
                }
            };
        """.trimIndent(), "native_transpile.js")
        
        // Register Java callback for transpilation
        context.setObjectForKey("__android_transpile", object : com.facebook.jsc.wrapper.JavaScriptObject() {
            override fun call(source: String, filename: String): String {
                return try {
                    RustTranspilerModule.nativeTranspile(source, filename, false)
                } catch (e: Exception) {
                    Log.e(TAG, "Transpile error", e)
                    "throw new Error('Transpile failed: ${e.message}');"
                }
            }
        })
    }

    private fun installConsole(context: JSContext) {
        val consoleCode = """
            (function() {
                // Buffered console that stores messages for later retrieval
                if (!globalThis.__console_logs) globalThis.__console_logs = [];
                globalThis.console = {
                    log: function(...args) {
                        const msg = args.map(String).join(' ');
                        globalThis.__console_logs.push('[LOG] ' + msg);
                    },
                    warn: function(...args) {
                        const msg = args.map(String).join(' ');
                        globalThis.__console_logs.push('[WARN] ' + msg);
                    },
                    error: function(...args) {
                        const msg = args.map(String).join(' ');
                        globalThis.__console_logs.push('[ERROR] ' + msg);
                    },
                    info: function(...args) {
                        const msg = args.map(String).join(' ');
                        globalThis.__console_logs.push('[INFO] ' + msg);
                    }
                };
            })();
        """.trimIndent()
        
        context.evaluateScript(consoleCode, "console_shim.js")
        Log.i(TAG, "Console installed (buffered mode)")
    }

    private fun installAndroidBridge(context: JSContext) {
        // Wire JS bridge to native AndroidRenderer
        val bridgeCode = """
            (function() {
                function safeStringify(value) {
                    try { return JSON.stringify(value); } catch (e) { return '{}'; }
                }

                globalThis.nativeBridge = {
                    createView: function(tag, type, props) {
                        const payload = safeStringify({ tag, type, props: props || {} });
                        __android_bridge_createView(payload);
                        return tag;
                    },
                    updateView: function(tag, props) {
                        const payload = safeStringify({ tag, props: props || {} });
                        __android_bridge_updateView(payload);
                    },
                    updateProps: function(tag, props) {
                        const payload = safeStringify({ tag, props: props || {} });
                        __android_bridge_updateView(payload);
                    },
                    addChild: function(parentTag, childTag, index) {
                        const payload = safeStringify({ parentTag, childTag, index: typeof index === 'number' ? index : -1 });
                        __android_bridge_addChild(payload);
                    },
                    removeChild: function(parentTag, childTag) {
                        const payload = safeStringify({ parentTag, childTag });
                        __android_bridge_removeChild(payload);
                    },
                    addEventListener: function(tag, event, handler) {
                        const payload = safeStringify({ tag, event: event || '' });
                        __android_bridge_addEventListener(payload);
                        // Handlers are not wired yet; this keeps parity with renderer expectations.
                    },
                    clearViews: function() {
                        __android_bridge_clearViews();
                    }
                };

                // Alias for frameworks that expect bridge instead of nativeBridge
                globalThis.bridge = globalThis.nativeBridge;
            })();
        """.trimIndent()

        context.evaluateScript(bridgeCode, "android_bridge.js")

        // Bind native implementations
        context.setObjectForKey("__android_bridge_createView", object : JavaScriptObject() {
            override fun call(payload: String) {
                mainHandler.post {
                    try {
                        val data = gson.fromJson(payload, Map::class.java) as Map<String, Any>
                        val tag = (data["tag"] as? Double)?.toInt() ?: -1
                        val type = data["type"] as? String ?: "view"
                        val props = data["props"] as? Map<String, Any> ?: emptyMap()
                        AndroidRenderer.createView(tag, type, props)
                    } catch (e: Exception) {
                        Log.e(TAG, "Bridge createView failed", e)
                    }
                }
            }
        })

        context.setObjectForKey("__android_bridge_updateView", object : JavaScriptObject() {
            override fun call(payload: String) {
                mainHandler.post {
                    try {
                        val data = gson.fromJson(payload, Map::class.java) as Map<String, Any>
                        val tag = (data["tag"] as? Double)?.toInt() ?: return@post
                        val props = data["props"] as? Map<String, Any> ?: emptyMap()
                        AndroidRenderer.updateProps(tag, props)
                    } catch (e: Exception) {
                        Log.e(TAG, "Bridge updateView failed", e)
                    }
                }
            }
        })

        context.setObjectForKey("__android_bridge_addChild", object : JavaScriptObject() {
            override fun call(payload: String) {
                mainHandler.post {
                    try {
                        val data = gson.fromJson(payload, Map::class.java) as Map<String, Any>
                        val parentTag = (data["parentTag"] as? Double)?.toInt() ?: -1
                        val childTag = (data["childTag"] as? Double)?.toInt() ?: -1
                        val index = (data["index"] as? Double)?.toInt() ?: -1
                        AndroidRenderer.addChild(parentTag, childTag, index)
                    } catch (e: Exception) {
                        Log.e(TAG, "Bridge addChild failed", e)
                    }
                }
            }
        })

        context.setObjectForKey("__android_bridge_removeChild", object : JavaScriptObject() {
            override fun call(payload: String) {
                mainHandler.post {
                    try {
                        val data = gson.fromJson(payload, Map::class.java) as Map<String, Any>
                        val parentTag = (data["parentTag"] as? Double)?.toInt() ?: -1
                        val childTag = (data["childTag"] as? Double)?.toInt() ?: -1
                        AndroidRenderer.removeChild(parentTag, childTag)
                    } catch (e: Exception) {
                        Log.e(TAG, "Bridge removeChild failed", e)
                    }
                }
            }
        })

        context.setObjectForKey("__android_bridge_addEventListener", object : JavaScriptObject() {
            override fun call(payload: String) {
                mainHandler.post {
                    try {
                        val data = gson.fromJson(payload, Map::class.java) as Map<String, Any>
                        val tag = (data["tag"] as? Double)?.toInt() ?: -1
                        val event = data["event"] as? String ?: ""
                        AndroidRenderer.addEventListener(tag, event)
                    } catch (e: Exception) {
                        Log.e(TAG, "Bridge addEventListener failed", e)
                    }
                }
            }
        })

        context.setObjectForKey("__android_bridge_clearViews", object : JavaScriptObject() {
            override fun call() {
                mainHandler.post {
                    AndroidRenderer.clearAll()
                }
            }
        })

        Log.i(TAG, "Android bridge installed")
    }

    private fun loadRuntime(context: JSContext) {
        // Load ACT runtime bundle (with full ES6 support)
        loadAsset(context, "act-android.bundle.js")
        
        // Set runtime mode
        context.evaluateScript(
            "globalThis.__runtime = { mode: 'act', engine: 'jsc', es6: true };",
            "runtime_init.js"
        )
        
        // Define require for basic modules
        context.evaluateScript("""
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
        """.trimIndent(), "require_shim.js")
        
        context.evaluateScript(
            """
            globalThis.HookTranspilerAndroid = (typeof HookTranspilerAndroid !== 'undefined') ? HookTranspilerAndroid : {};
            globalThis.HookRenderer = HookTranspilerAndroid.HookRenderer;
            globalThis.HookApp = HookTranspilerAndroid.HookApp;
            globalThis.installWebApiShims = HookTranspilerAndroid.installWebApiShims;
            globalThis.ThemedStyler = (typeof ThemedStyler !== 'undefined') ? ThemedStyler : {};
            """.trimIndent(),
            "hook_renderer_globals.js"
        )
    }

    private fun injectVersions(context: JSContext) {
        try {
            val transpilerVersion = RustTranspilerModule.nativeGetVersion()
            val stylerVersion = ThemedStylerModule.nativeGetVersion()
            val versionsJs = """
                globalThis.__versions = { 
                    transpiler: '${transpilerVersion}', 
                    styler: '${stylerVersion}',
                    engine: 'jsc'
                };
            """.trimIndent()
            context.evaluateScript(versionsJs, "versions.js")
            Log.i(TAG, "Injected versions: transpiler=$transpilerVersion, styler=$stylerVersion, engine=jsc")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to inject versions", e)
        }
    }

    private fun loadAsset(context: JSContext, filename: String) {
        try {
            val source = this.context.assets.open(filename).bufferedReader().use { it.readText() }
            context.evaluateScript(source, filename)
            Log.d(TAG, "Loaded asset: $filename")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load asset: $filename", e)
            throw e
        }
    }

    fun renderHook(asset: String, props: Map<String, Any> = emptyMap()) {
        lastAsset = asset
        lastProps = props
        
        val context = jsContext ?: run {
            Log.w(TAG, "JSC not initialized")
            userMessageHandler?.invoke("Engine is not ready yet. Try restarting.", true)
            return
        }

        AndroidRenderer.clearAll()
        context.evaluateScript("globalThis.__last_module__ = null; delete globalThis.__hook_props;", "reset_globals.js")

        val propsJson = gson.toJson(props)
        context.evaluateScript("globalThis.__hook_props = ${propsJson};", "props_${asset}.js")

        val source = readAssetFile(asset)
        if (source.isEmpty()) {
            Log.w(TAG, "Asset $asset is empty; skipping render")
            userMessageHandler?.invoke("Could not load $asset from app assets.", true)
            return
        }

        try {
            // Transpile with moduleMode=true to convert imports to runtime-compatible format
            val transpiled = RustTranspilerModule.nativeTranspile(source, asset, true)
            Log.d(TAG, "Transpiled $asset (${source.length} → ${transpiled.length} bytes)")
            
            // Execute transpiled code - it's already wrapped in IIFE returning module.exports
            // We just need to assign the result to globalThis.__last_module__
            val wrappedCode = """
                globalThis.__last_module__ = $transpiled;
            """.trimIndent()
            
            try {
                context.evaluateScript(wrappedCode, asset)
                Log.i(TAG, "Hook executed: $asset")
            } catch (e: Exception) {
                Log.e(TAG, "Error executing transpiled code: ${e.message}", e)
                userMessageHandler?.invoke("Transpilation error: ${e.message}", true)
                throw e
            }
            
            // Check what was exported
            val checkExport = context.evaluateScript("typeof globalThis.__last_module__", "check_export.js")
            Log.d(TAG, "Module export type: $checkExport")
            
            val hasDefault = context.evaluateScript("globalThis.__last_module__ && typeof globalThis.__last_module__.default", "check_default.js")
            Log.d(TAG, "Has default export: $hasDefault")
            
            // Dump console logs
            val consoleLogs = context.evaluateScript(
                "globalThis.__console_logs ? globalThis.__console_logs.join('\\n') : 'No logs'",
                "get_console.js"
            )
            if (consoleLogs.isNotEmpty() && consoleLogs != "No logs") {
                Log.d(TAG, "Console output:\n$consoleLogs")
            }
            
            // Now invoke the transpiled hook component directly via Act renderer
            val renderCode = """
                (function() {
                    try {
                        const mod = globalThis.__last_module__;
                        if (!mod) {
                            console.error('[JSCManager] No __last_module__ found');
                            return 'ERROR: No module';
                        }
                        if (!mod.default) {
                            console.error('[JSCManager] No default export in module');
                            return 'ERROR: No default export';
                        }

                        const renderer = globalThis.HookRenderer;
                        if (!renderer || typeof renderer.render !== 'function') {
                            console.error('[JSCManager] HookRenderer.render missing');
                            return 'ERROR: HookRenderer missing';
                        }

                        const hookProps = globalThis.__hook_props || {};
                        const versions = globalThis.__versions || {};
                        console.log('[JSCManager] Rendering via HookRenderer');
                        const renderResult = renderer.render(mod.default, {
                            hookProps,
                            hookName: '${asset}',
                            versions
                        });

                        console.log('[JSCManager] HookRenderer.render returned: ' + typeof renderResult);
                        return 'OK';
                    } catch (e) {
                        console.error('[JSCManager] Render error: ' + e.toString());
                        return 'ERROR: ' + e.toString();
                    }
                })();
            """.trimIndent()
            
            val renderResult = context.evaluateScript(renderCode, "render_${asset}.js")
            Log.i(TAG, "Render invocation result: $renderResult")
            userMessageHandler?.invoke("Rendered successfully", false)
            
            // Get final console logs
            val finalLogs = context.evaluateScript(
                "globalThis.__console_logs ? globalThis.__console_logs.slice(-30).join('\\n') : 'No logs'",
                "get_final_console.js"
            )
            if (finalLogs != "No logs") {
                Log.d(TAG, "Final console:\n$finalLogs")
            }
            
        } catch (e: JSException) {
            Log.e(TAG, "JS execution error in $asset", e)
            userMessageHandler?.invoke("JS Error: ${e.message}", true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to render hook: $asset", e)
            userMessageHandler?.invoke("Error: ${e.message}", true)
        }
    }

    fun renderWithReactNative(asset: String, transpiled: String, props: Map<String, Any> = emptyMap()) {
        lastAsset = asset
        lastProps = props
        
        val context = jsContext ?: run {
            Log.w(TAG, "JSC not initialized")
            userMessageHandler?.invoke("Engine is not ready yet. Try restarting.", true)
            return
        }

        AndroidRenderer.clearAll()
        context.evaluateScript("globalThis.__last_module__ = null; delete globalThis.__hook_props;", "reset_globals.js")

        val propsJson = gson.toJson(props)
        context.evaluateScript("globalThis.__hook_props = ${propsJson};", "props_${asset}.js")

        try {
            // Setup console capture for debugging
            context.evaluateScript("""
                globalThis.__console_logs = [];
                globalThis.__originalLog = console.log;
                globalThis.__originalError = console.error;
                console.log = function() {
                    var args = Array.prototype.slice.call(arguments).map(String);
                    globalThis.__console_logs.push('[LOG] ' + args.join(' '));
                    globalThis.__originalLog.apply(console, arguments);
                };
                console.error = function() {
                    var args = Array.prototype.slice.call(arguments).map(String);
                    globalThis.__console_logs.push('[ERROR] ' + args.join(' '));
                    globalThis.__originalError.apply(console, arguments);
                };
            """.trimIndent(), "console_setup.js")

            // Execute the transpiled code
            context.evaluateScript(transpiled, asset)
            Log.i(TAG, "Hook executed: $asset (React Native test mode)")
            
            // Get console logs
            val consoleLogs = context.evaluateScript(
                "globalThis.__console_logs ? globalThis.__console_logs.join('\\n') : 'No logs'",
                "get_console.js"
            )
            if (consoleLogs.isNotEmpty() && consoleLogs != "No logs") {
                Log.d(TAG, "React Native test - Console output:\n$consoleLogs")
            }

            // For React Native testing, we use the native bridge instead of Act renderer
            // This tests if the native bridge works at all
            val testBridgeCode = """
                (function() {
                    try {
                        const mod = globalThis.__last_module__;
                        if (!mod || !mod.default) {
                            console.error('No default export');
                            return 'ERROR: No default export';
                        }

                        // Try to render using React Native Renderer (not Act)
                        // This bypasses Act and tests the native bridge directly
                        console.log('[ReactNativeTest] Testing native bridge with component...');
                        
                        // Call the component to see if it renders to native views
                        const Component = mod.default;
                        const props = globalThis.__hook_props || {};
                        
                        // Use HookRenderer if available, otherwise fallback to manual bridge calls
                        const renderer = globalThis.HookRenderer;
                        if (renderer && typeof renderer.render === 'function') {
                            console.log('[ReactNativeTest] Using HookRenderer.render in react-native mode');
                            return renderer.render(Component, {
                                hookProps: props,
                                initialMode: 'react-native',
                                name: '$asset'
                            });
                        }

                        console.log('[ReactNativeTest] HookRenderer not found, falling back to manual bridge test');
                        const nb = globalThis.nativeBridge || globalThis.bridge;
                        if (nb && nb.createView) {
                            console.log('[ReactNativeTest] nativeBridge available, attempting to render tree...');
                            nb.createView(-1, 'view', { width: 'match_parent', height: 'match_parent', backgroundColor: '#f0f0f0' });
                            
                            const textTag = 1001;
                            nb.createView(textTag, 'text', { 
                                text: 'React Native Bridge Test (Fallback Mode)\nComponent: ' + (Component.name || 'Anonymous'),
                                fontSize: 18,
                                color: '#333333',
                                width: 'match_parent',
                                height: 'wrap_content'
                            });
                            nb.addChild(-1, textTag, 0);
                            
                            console.log('[ReactNativeTest] Root view and test text created');
                            return 'OK - Bridge works (Fallback)';
                        } else {
                            console.log('[ReactNativeTest] nativeBridge NOT available');
                            return 'ERROR: nativeBridge not found';
                        }
                    } catch (e) {
                        console.error('[ReactNativeTest] Error: ' + e.toString());
                        return 'ERROR: ' + e.toString();
                    }
                })();
            """.trimIndent()

            val testResult = context.evaluateScript(testBridgeCode, "test_bridge.js")
            Log.i(TAG, "React Native test bridge result: $testResult")
            userMessageHandler?.invoke("React Native test: $testResult", false)
            
        } catch (e: JSException) {
            Log.e(TAG, "JS execution error in $asset (React Native mode)", e)
            userMessageHandler?.invoke("JS Error: ${e.message}", true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to render hook with React Native: $asset", e)
            userMessageHandler?.invoke("Error: ${e.message}", true)
        }
    }

    private fun readAssetFile(filename: String): String {
        return try {
            context.assets.open(filename).bufferedReader().use { it.readText() }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read asset: $filename", e)
            ""
        }
    }
    
    fun renderRemoteHook(source: String, container: ViewGroup) {
        val context = jsContext ?: run {
            Log.w(TAG, "JSC not initialized")
            userMessageHandler?.invoke("Engine is not ready yet. Try restarting.", true)
            return
        }
        
        try {
            val transpiled = RustTranspilerModule.nativeTranspile(source, "remote_hook.jsx", false)
            Log.d(TAG, "Transpiled remote hook (${source.length} → ${transpiled.length} bytes)")
            
            // Execute with JSC's full ES6 support
            context.evaluateScript(transpiled, "remote_hook.jsx")
            Log.i(TAG, "Remote hook executed successfully")
            
        } catch (e: JSException) {
            Log.e(TAG, "JS execution error in remote hook", e)
            userMessageHandler?.invoke("JS Error: ${e.message}", true)
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error rendering remote hook", e)
            userMessageHandler?.invoke("Error: ${e.message}", true)
        }
    }

    fun cleanup() {
        jsContext = null
    }

    fun drainMessageQueue() {
        val context = jsContext ?: return
        try {
            val queueJson = context.evaluateScript(
                "(function() { var q = JSON.stringify(globalThis.__messageQueue || []); globalThis.__messageQueue = []; return q; })();",
                "drain_queue.js"
            ) as? String ?: return
            
            if (queueJson.isBlank() || queueJson == "[]") {
                return
            }
            
            Log.d(TAG, "Processing message queue: $queueJson")
        } catch (e: Exception) {
            Log.e(TAG, "Error draining message queue", e)
        }
    }
}
