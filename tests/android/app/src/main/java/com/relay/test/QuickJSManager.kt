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

enum class RuntimeMode(val mode: String) {
    REACT("react"),
    ACT("act");

    companion object {
        fun fromString(value: String?): RuntimeMode? {
            return values().firstOrNull { it.mode == value?.lowercase() }
        }
    }
}

class QuickJSManager(private val context: Context) {
    companion object {
        private const val TAG = "QuickJSManager"
        var activeManager: QuickJSManager? = null
    }

    private val gson = Gson()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var quickJs: QuickJs? = null
    private var runtimeMode: RuntimeMode = RuntimeMode.ACT
    private var lastAsset: String? = "test-hook.jsx"
    private var lastProps: Map<String, Any> = emptyMap()
    private var themesJson: String = "{}"
    var userMessageHandler: ((String, Boolean) -> Unit)? = null
    var runtimeChangedHandler: ((RuntimeMode) -> Unit)? = null

    fun initialize() {
        loadThemes()
        resetEngine()
    }

    private fun loadThemes() {
        try {
            val yaml = readAssetFile("theme.yaml")
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

    fun setRuntimeMode(mode: RuntimeMode) {
        if (mode == runtimeMode) return
        runtimeMode = mode
        runtimeChangedHandler?.invoke(runtimeMode)
        resetEngine()
        renderHook(lastAsset ?: "test-hook.jsx", lastProps)
    }

    private fun resetEngine() {
        quickJs?.close()
        quickJs = null
        activeManager = this

        quickJs = QuickJs.create().also { engine ->
            Log.i(TAG, "Starting QuickJS engine (runtime=${runtimeMode.mode})")
            installNativeFunctions(engine)
            installConsole(engine)
            installNativeBridge(engine)
            installRenderer(engine)
            NativeRenderer.setQuickJsEngine(engine)
            loadRuntime(engine)
            injectVersions(engine)
            runtimeChangedHandler?.invoke(runtimeMode)
            Log.i(TAG, "QuickJS engine initialized")
        }
    }

    private fun loadRuntime(engine: QuickJs) {
        when (runtimeMode) {
            RuntimeMode.REACT -> {
                loadAsset(engine, "react.production.min.js")
                engine.evaluate(
                    "globalThis.React = (typeof React !== 'undefined') ? React : {}; globalThis.__runtime = { mode: 'react' };",
                    "react_runtime.js"
                )
            }
            RuntimeMode.ACT -> {
                loadAsset(engine, "act.js")
                engine.evaluate(
                    "globalThis.__runtime = { mode: 'act' };",
                    "act_runtime.js"
                )
            }
        }
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

        NativeRenderer.clearAll()
        engine.evaluate("globalThis.__last_module__ = null; delete globalThis.__hook_props;", "reset_globals")

        val propsJson = gson.toJson(props)
        engine.evaluate("globalThis.__hook_props = ${propsJson};", "props_${asset}")

        val source = readAssetFile(asset)
        if (source.isEmpty()) return

        Log.i(TAG, "Transpiling and rendering $asset ...")
        var transpiled = try { 
            RustTranspilerModule.nativeTranspile(source, asset) 
        } catch (e: Exception) {
            Log.e(TAG, "Transpile failed for $asset", e)
            return
        }
        
        transpiled = applyHookRewrite(transpiled)
        Log.d(TAG, "Transpiled and rewritten code for $asset:\n$transpiled")

        try {
            val wrappedCode = "(function() { var exports = {}; var module = { exports: exports }; $transpiled; globalThis.__last_module__ = module.exports; })();"
            engine.evaluate(wrappedCode, asset)
            val renderScript = when (runtimeMode) {
                RuntimeMode.ACT -> """
                    (function(){
                        try {
                            var c=(globalThis.__last_module__ && globalThis.__last_module__.default)||null;
                            if(c && globalThis.Act && Act.render){
                                Act.render(c, globalThis.__hook_props||{});
                            }
                        } catch(e) {
                            console.error('Act render error: ' + (e.message || String(e)));
                        }
                    })();
                """.trimIndent()
                RuntimeMode.REACT -> """
                    (function(){
                        var mod = globalThis.__last_module__ || {};
                        var c=(mod && mod.default) || null;
                        if(!c && typeof mod === 'function') { c = mod; }
                        if(c && typeof __renderHook === 'function'){
                            __renderHook(c, globalThis.__hook_props||{});
                        }
                    })();
                """.trimIndent()
            }
            engine.evaluate(renderScript, "render_${asset}")
        } catch (e: Exception) {
            Log.e(TAG, "Render failed for $asset", e)
        }

        processMessageQueue(engine)
    }

    fun drainMessageQueue() {
        val engine = quickJs ?: return
        processMessageQueue(engine)
    }

    private fun installNativeFunctions(engine: QuickJs) {
        engine.evaluate(
            """
            globalThis.__messageQueue = [];
            globalThis.__pushMessage = function(type, payload) {
                globalThis.__messageQueue.push({ type: type, payload: payload });
            };
            globalThis.__nativeLog = function(level, message) {
                globalThis.__pushMessage('log', { level: level, message: message });
            };
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
            """.trimIndent(),
            "native_stubs.js"
        )
        processMessageQueue(engine)
    }

    private fun processMessageQueue(engine: QuickJs) {
        val queueJson = engine.evaluate("(function() { var q = JSON.stringify(globalThis.__messageQueue); globalThis.__messageQueue = []; return q; })()") as? String ?: return
        if (queueJson.isBlank() || queueJson == "[]") return
        
        val listType = object : TypeToken<List<Map<String, Any>>>() {}.type
        val messages: List<Map<String, Any>> = try { gson.fromJson(queueJson, listType) } catch (e: Exception) { return }
        
        for (msg in messages) {
            val msgType = msg["type"] as? String ?: continue
            val payload = msg["payload"] as? Map<String, Any> ?: continue
            
            mainHandler.post {
                when (msgType) {
                    "log" -> {
                        val level = payload["level"] as? String ?: "log"
                        val message = payload["message"] as? String ?: ""
                        Log.i(TAG, "[JS] $message")
                    }
                    "createView" -> {
                        val tag = (payload["tag"] as? Double)?.toInt() ?: return@post
                        val type = payload["type"] as? String ?: return@post
                        val propsJson = payload["props"] as? String ?: "{}"
                        NativeBridge.createView(tag, type, parseProps(propsJson))
                    }
                    "updateProps" -> {
                        val tag = (payload["tag"] as? Double)?.toInt() ?: return@post
                        val propsJson = payload["props"] as? String ?: "{}"
                        NativeBridge.updateProps(tag, parseProps(propsJson))
                    }
                    "removeView" -> {
                        val tag = (payload["tag"] as? Double)?.toInt() ?: return@post
                        NativeBridge.removeView(tag)
                    }
                    "addChild" -> {
                        val parent = (payload["parent"] as? Double)?.toInt() ?: return@post
                        val child = (payload["child"] as? Double)?.toInt() ?: return@post
                        val childIndex = (payload["index"] as? Double)?.toInt() ?: -1
                        NativeBridge.addChild(parent, child, childIndex)
                    }
                    "removeChild" -> {
                        val parent = (payload["parent"] as? Double)?.toInt() ?: return@post
                        val child = (payload["child"] as? Double)?.toInt() ?: return@post
                        NativeBridge.removeChild(parent, child)
                    }
                    "clearViews" -> NativeRenderer.clearAll()
                    "addEventListener" -> {
                        val tag = (payload["tag"] as? Double)?.toInt() ?: return@post
                        val eventName = payload["eventName"] as? String ?: return@post
                        NativeRenderer.addEventListener(tag, eventName)
                    }
                }
            }
        }
    }

    private fun installConsole(engine: QuickJs) {
        engine.evaluate(
            "globalThis.console = { log: function() { globalThis.__nativeLog('log', Array.from(arguments).join(' ')); }, info: function() { globalThis.__nativeLog('info', Array.from(arguments).join(' ')); }, warn: function() { globalThis.__nativeLog('warn', Array.from(arguments).join(' ')); }, error: function() { globalThis.__nativeLog('error', Array.from(arguments).join(' ')); } };",
            "console.js"
        )
    }

    private fun installNativeBridge(engine: QuickJs) {
        engine.evaluate(
            """
            (function(){
                var jsxRuntime = {
                    jsx: function(type, props){ 
                        var children = (props && props.children) ? ([]).concat(props.children) : []; 
                        return { type:type, props:props||{}, children:children}; 
                    },
                    jsxs: function(type, props){ return jsxRuntime.jsx(type, props); },
                    Fragment: 'div'
                };
                globalThis.__hook_jsx_runtime = jsxRuntime;
            })();
            """.trimIndent(),
            "jsx_runtime.js"
        )
        
        engine.evaluate(
            """
            globalThis.nativeBridge = {
              createView: function(tag, type, props) { globalThis.__nativeCreateView(tag, type, JSON.stringify(props || {})); },
              updateProps: function(tag, props) { globalThis.__nativeUpdateProps(tag, JSON.stringify(props || {})); },
              removeView: function(tag) { globalThis.__nativeRemoveView(tag); },
              addChild: function(parent, child, index) { globalThis.__nativeAddChild(parent, child, index != null ? index : -1); },
              removeChild: function(parent, child) { globalThis.__nativeRemoveChild(parent, child); },
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
            """.trimIndent(),
            "nativeBridge.js"
        )
    }

    private fun installRenderer(engine: QuickJs) {
        engine.evaluate(
            """
            (function(){
                var __tagCounter = 1;
                function nextTag(){ return __tagCounter++; }
                function h(type, props){ var kids = Array.prototype.slice.call(arguments,2); return { type: type, props: props||{}, children: kids }; }
                function normalizeType(t){ return (typeof t === 'function') ? 'div' : String(t).toLowerCase(); }
                function mountNode(node, parentTag, index, parentType){
                    var nb = globalThis.nativeBridge; if(!nb || node == null) return;
                    console.log('[Renderer] mountNode type=' + (node && node.type) + ' isArray=' + Array.isArray(node) + ' node=' + JSON.stringify(node).substring(0,100));
                    if(Array.isArray(node)){
                        node.forEach(function(child, i) { mountNode(child, parentTag, index + i, parentType); });
                        return;
                    }
                    if(typeof node === 'string' || typeof node === 'number'){
                        var textVal = String(node);
                        if(parentType === 'span' || parentType === 'text' || parentType === 'button'){
                            nb.updateProps(parentTag, { text: textVal });
                        } else {
                            var t = nextTag();
                            nb.createView(t, 'span', { text: textVal, width:'wrap_content', height:'wrap_content' });
                            nb.addChild(parentTag, t, index);
                        }
                        return;
                    }
                    var isComponent = typeof node.type === 'function';
                    if(isComponent){ 
                        console.log('[Renderer] Executing component ' + (node.type.name || 'anonymous'));
                        var nextNode = node.type(node.props||{});
                        mountNode(nextNode, parentTag, index, parentType); 
                        return; 
                    }
                    var type = normalizeType(node.type);
                    var tag = nextTag();
                    var props = Object.assign({}, node.props||{});
                    nb.createView(tag, type, props);
                    if(props && props.onClick){ nb.addEventListener(tag, 'click', props.onClick); }
                    
                    var kids = [];
                    if (node.children) {
                        kids = kids.concat(node.children);
                    }
                    if (node.props && node.props.children) {
                        if (Array.isArray(node.props.children)) {
                            kids = kids.concat(node.props.children);
                        } else {
                            kids.push(node.props.children);
                        }
                    }
                    
                    console.log('[Renderer] tag=' + tag + ' kids=' + kids.length);
                    kids.forEach(function(child,i){ mountNode(child, tag, i, type); });
                    nb.addChild(parentTag, tag, index);
                }
                function renderComponent(comp, props){
                    var nb = globalThis.nativeBridge; if(!nb) { console.error('nativeBridge missing'); return; }
                    var root = (typeof comp === 'function') ? comp(props||{}) : comp;
                    if(Array.isArray(root)){
                        root = { type: 'div', props: {}, children: root };
                    }
                    if(!root || !root.type){
                        root = { type: 'div', props: (root && root.props) || {}, children: (root && root.children) || [] };
                    }
                    var rootProps = root.props || {};
                    if(!rootProps.width) rootProps.width = 'match_parent';
                    if(!rootProps.height) rootProps.height = 'match_parent';
                    var rootTag = nextTag();
                    nb.createView(rootTag, normalizeType(root.type), rootProps);
                    nb.addChild(-1, rootTag, 0);
                    (root.children||[]).forEach(function(child,i){ mountNode(child, rootTag, i, root.type); });
                }
                globalThis.__renderHook = renderComponent;
                globalThis.h = h;
            })();
            """.trimIndent(),
            "renderer.js"
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
