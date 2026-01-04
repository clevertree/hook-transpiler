(function () {
    var globalObj = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : this);

    // Polyfill setTimeout and clearTimeout
    var timerIdCounter = 1;
    var timers = {};

    globalObj.setTimeout = function (callback, delay) {
        var timerId = timerIdCounter++;
        var args = Array.prototype.slice.call(arguments, 2);

        timers[timerId] = true;

        console.log('[bridge.js] setTimeout called, timerId=' + timerId + ', delay=' + delay);

        globalObj.__android_schedule_timer(JSON.stringify({
            timerId: timerId,
            delay: delay || 0
        }));

        // Store callback for when timer fires
        globalObj['__timer_' + timerId] = function () {
            console.log('[bridge.js] Timer ' + timerId + ' callback executing');
            if (timers[timerId]) {
                delete timers[timerId];
                delete globalObj['__timer_' + timerId];
                callback.apply(null, args);
            }
        };

        return timerId;
    };

    globalObj.clearTimeout = function (timerId) {
        console.log('[bridge.js] clearTimeout called for timerId=' + timerId);
        if (timers[timerId]) {
            delete timers[timerId];
            delete globalObj['__timer_' + timerId];
            globalObj.__android_cancel_timer(JSON.stringify({ timerId: timerId }));
        }
    };

    globalObj.setInterval = globalObj.setTimeout; // Simple alias for now
    globalObj.clearInterval = globalObj.clearTimeout;

    globalObj.__clevertree_packages = globalObj.__clevertree_packages || {};

    globalObj.__clevertree_packages['@clevertree/markdown'] = (function () {
        var MarkdownRenderer = function (props) {
            var Act = globalObj.Act || globalObj.React;
            if (!Act) {
                console.error('[Markdown] Act/React not found');
                return null;
            }

            if (typeof globalThis.MarkdownToJsx === 'undefined') {
                console.warn('[Markdown] MarkdownToJsx not loaded, falling back to raw text');
                return Act.createElement('text', { text: props.content || props.children });
            }

            try {
                var compiler = globalThis.MarkdownToJsx.compiler;
                // Map standard HTML tags to our native-supported tags
                var options = {
                    overrides: {
                        MarkdownRenderer: { component: MarkdownRenderer },
                        h1: { component: 'h1' },
                        h2: { component: 'h2' },
                        h3: { component: 'h3' },
                        h4: { component: 'h4' },
                        h5: { component: 'h5' },
                        h6: { component: 'h6' },
                        p: { component: 'p' },
                        span: { component: 'span' },
                        strong: { component: 'span' },
                        em: { component: 'span' },
                        code: { component: 'span' },
                        del: { component: 'span' },
                        ins: { component: 'span' },
                        sub: { component: 'span' },
                        sup: { component: 'span' },
                        div: { component: 'div' },
                        img: { component: 'img' },
                        a: { component: 'span' }, // Map links to spans for now
                        ul: { component: 'div' },
                        ol: { component: 'div' },
                        li: { component: 'div' },
                        table: { component: 'table', props: { className: 'table' } },
                        thead: { component: 'div' },
                        tbody: { component: 'div' },
                        tr: { component: 'table-row', props: { className: 'table-row' } },
                        th: { component: 'table-cell', props: { className: 'table-cell table-header' } },
                        td: { component: 'table-cell', props: { className: 'table-cell' } }
                    },
                    createElement: Act.createElement
                };

                // Merge custom overrides if provided
                if (props.overrides) {
                    for (var key in props.overrides) {
                        options.overrides[key] = props.overrides[key];
                    }
                }

                return compiler(props.content || props.children || '', options);
            } catch (e) {
                console.error('[Markdown] Error rendering markdown:', e);
                return Act.createElement('text', { text: 'Error rendering markdown' });
            }
        };

        return {
            MarkdownRenderer: MarkdownRenderer
        };
    })();

    globalObj.URL = function (url, base) {
        this.href = url;
        if (base) {
            var b = base;
            // If base is a file, get its directory
            if (b.indexOf('http') === 0 && b.indexOf('/', 8) !== -1) {
                var lastSlash = b.lastIndexOf('/');
                if (lastSlash > 8) b = b.substring(0, lastSlash);
            }

            if (url.indexOf('http') === 0) {
                this.href = url;
            } else if (url.indexOf('./') === 0) {
                this.href = b + '/' + url.substring(2);
            } else if (url.indexOf('../') === 0) {
                var parts = b.split('/');
                var urlParts = url.split('/');
                while (urlParts[0] === '..') {
                    if (parts.length > 3) parts.pop();
                    urlParts.shift();
                }
                this.href = parts.join('/') + '/' + urlParts.join('/');
            } else if (url.indexOf('/') === 0) {
                var protoMatch = b.match(/^(https?:\/\/[^\/]+)/);
                if (protoMatch) {
                    this.href = protoMatch[1] + url;
                } else {
                    this.href = url;
                }
            } else {
                this.href = b + '/' + url;
            }
        }
        // Clean up double slashes except after protocol
        this.href = this.href.replace(/([^:])\/\//g, '$1/');
    };

    globalObj.URLSearchParams = function (search) {
        this.params = {};
        if (search) {
            var s = search;
            if (s.indexOf('?') === 0) s = s.substring(1);
            var pairs = s.split('&');
            for (var i = 0; i < pairs.length; i++) {
                var pair = pairs[i].split('=');
                if (pair[0]) {
                    this.params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
                }
            }
        }
        this.get = function (name) { return this.params[name] || null; };
    };

    globalObj.fetch = function (url, init) {
        var baseUrl = (globalObj.__relay_meta && globalObj.__relay_meta.url) || "";
        var resolvedUrl = url;
        if (baseUrl && url.indexOf('http') !== 0) {
            resolvedUrl = new globalObj.URL(url, baseUrl).href;
            console.log('[fetch] Resolved ' + url + ' to ' + resolvedUrl + ' (base=' + baseUrl + ')');
        }

        return new Promise(function (resolve, reject) {
            var options = init || {};
            var resultJson = "";
            if (resolvedUrl.indexOf('http') === 0) {
                resultJson = __android_fetch(resolvedUrl, JSON.stringify(options));
            } else {
                var path = resolvedUrl;
                if (path.indexOf('/') === 0) path = path.substring(1);
                var content = __android_readFile(path);
                resultJson = JSON.stringify({
                    status: content ? 200 : 404,
                    ok: !!content,
                    body: content,
                    headers: {
                        'content-type': path.endsWith('.md') ? 'text/markdown' : (path.endsWith('.json') ? 'application/json' : 'text/plain')
                    }
                });
            }

            var result = JSON.parse(resultJson);
            resolve({
                ok: result.ok,
                status: result.status,
                text: function () { return Promise.resolve(result.body); },
                json: function () { return Promise.resolve(result.body ? JSON.parse(result.body) : {}); },
                headers: {
                    get: function (name) {
                        var lowerName = name.toLowerCase();
                        for (var k in result.headers) {
                            if (k.toLowerCase() === lowerName) return result.headers[k];
                        }
                        return null;
                    }
                }
            });
        });
    };

    // NOTE: DO NOT override console here!
    // Android's polyfill will handle console via nativeLoggingHook
    // which is set up in HookRenderer before this bridge loads.
    // Overriding console here breaks Android's console implementation.

    globalObj.onerror = function (message, source, lineno, colno, error) {
        var errorMsg = 'JS Error: ' + message + ' at ' + source + ':' + lineno + ':' + colno + (error ? '\n' + error.stack : '');
        console.error(errorMsg);
        return true; // Prevent default error handling
    };

    globalObj.__require_cache = {};

    globalObj.__require_module = function (id, parentPath) {
        console.log('[__require_module] START: id=' + id + ', parentPath=' + parentPath);

        // Check virtual packages registered by the host runtime first (e.g., themed-styler, hook-transpiler)
        if (globalObj.__clevertree_packages && globalObj.__clevertree_packages[id]) {
            console.log('[__require_module] Found in __clevertree_packages: ' + id);
            var pkg = globalObj.__clevertree_packages[id];
            var result = { default: pkg };
            // Spread the properties of the module onto the result object
            for (var key in pkg) {
                if (pkg.hasOwnProperty(key)) {
                    result[key] = pkg[key];
                }
            }
            return result;
        }

        if (id === 'react' || id === 'act' || id === '@clevertree/act') {
            var act = globalObj.Act || globalObj.React || globalObj.__react || {};
            var res = { default: act };
            for (var k in act) { if (Object.prototype.hasOwnProperty.call(act, k)) res[k] = act[k]; }
            return res;
        }
        if (id === '__hook_jsx_runtime' || id === '__hook_jsx_runtime/jsx-runtime' || id === 'react/jsx-runtime') {
            return globalObj.__hook_jsx_runtime || {};
        }
        if (id === '@clevertree/meta') return { default: { url: parentPath || id }, url: parentPath || id };


        // Check cache by absolute path
        var cacheKey = id;
        if (parentPath && (id.startsWith('./') || id.startsWith('../'))) {
            // For relative imports, compute absolute path for caching
            var parentDir = parentPath.substring(0, Math.max(0, parentPath.lastIndexOf('/')));
            if (parentDir && !parentDir.endsWith('/')) parentDir += '/';
            var relativePath = id;
            while (relativePath.startsWith('../')) {
                relativePath = relativePath.substring(3);
                var lastSlash = parentDir.lastIndexOf('/', parentDir.length - 2);
                parentDir = lastSlash === -1 ? "" : parentDir.substring(0, lastSlash + 1);
            }
            if (relativePath.startsWith('./')) {
                relativePath = relativePath.substring(2);
            }
            cacheKey = parentDir + relativePath;
            console.log('[__require_module] Relative path resolved: ' + id + ' -> ' + cacheKey + ' (parent=' + parentPath + ')');
        }

        if (globalObj.__require_cache[cacheKey]) {
            console.log('[__require_module] CACHE HIT: ' + cacheKey);
            return globalObj.__require_cache[cacheKey];
        }

        var resolvedPath = cacheKey;
        var isRemote = resolvedPath.startsWith('http://') || resolvedPath.startsWith('https://');

        // For remote URLs, try with and without extensions
        var filePath = resolvedPath.split('?')[0].split('#')[0];
        console.log('[__require_module] Resolved: ' + filePath + ' (isRemote=' + isRemote + ')');

        var source = '';
        if (isRemote) {
            // Try direct URL
            var fetchResult = __android_fetch(filePath, '{}');
            var result = JSON.parse(fetchResult);
            if (result.ok) {
                source = result.body;
            } else {
                // Try with .jsx extension
                if (!filePath.endsWith('.jsx') && !filePath.endsWith('.js')) {
                    fetchResult = __android_fetch(filePath + '.jsx', '{}');
                    result = JSON.parse(fetchResult);
                    if (result.ok) {
                        source = result.body;
                        filePath = filePath + '.jsx';
                    } else {
                        // Try with .js extension
                        fetchResult = __android_fetch(filePath + '.js', '{}');
                        result = JSON.parse(fetchResult);
                        if (result.ok) {
                            source = result.body;
                            filePath = filePath + '.js';
                        }
                    }
                }
            }
        } else {
            // Local file
            source = __android_readFile(filePath);
            if (!source && !filePath.endsWith('.jsx')) source = __android_readFile(filePath + '.jsx');
            if (!source && !filePath.endsWith('.js')) source = __android_readFile(filePath + '.js');
        }

        console.log('[__require_module] File loaded: ' + filePath + ', hasSource=' + !!source + ', sourceLen=' + (source ? source.length : 0));
        if (!source) {
            console.error('[__require_module] Failed to load: ' + id + (parentPath ? ' (parent: ' + parentPath + ')' : ''));
            return {};
        }

        console.log('[__require_module] About to transpile: ' + filePath);
        var transpiled = __android_transpile(source, filePath);
        console.log('[__require_module] Transpiled: ' + filePath + ', result length: ' + transpiled.length);
        if (transpiled.length < 2000) {
            console.log('[__require_module] Transpiled code: ' + transpiled);
        }
        var module = { exports: {} };
        var exports = module.exports;

        try {
            // SWC helpers are available globally; no need to pass them as parameters
            var fn = new Function(
                'module', 'exports', 'require', '__hook_import',
                transpiled
            );
            var requireWrapper = function (childId) {
                return globalObj.require(childId, resolvedPath);
            };
            var importWrapper = function (childId) {
                return globalObj.__hook_import(childId, resolvedPath);
            };
            fn(module, exports, requireWrapper, importWrapper);
            globalObj.__require_cache[cacheKey] = module.exports;
            console.log('[__require_module] SUCCESS: Cached ' + cacheKey + ', keys=' + Object.keys(module.exports || {}).join(','));
            return module.exports;
        } catch (e) {
            var errorMsg = 'Module Error [' + id + ']: ' + e.message;
            if (e.stack) errorMsg += '\n' + e.stack;
            console.error(errorMsg);
            return {};
        }
    };

    globalObj.require = function (id, parentPath) {
        var res = globalObj.__require_module(id, parentPath);
        if (id === 'react' || id === 'act' || id === '@clevertree/act') return res.default || res;
        if (id === '@clevertree/meta') return res.default || res;
        return res;
    };

    globalObj.__hook_import = function (path, parentPath) {
        if (globalObj.__android_log) {
            globalObj.__android_log('INFO', '[__hook_import] start path=' + path + ' parentPath=' + parentPath);
        }
        console.log('[__hook_import] start path=' + path + ' parentPath=' + parentPath);
        return new Promise(function (resolve, reject) {
            try {
                var result = globalObj.__require_module(path, parentPath);
                var isPromise = result && typeof result.then === 'function';
                if (globalObj.__android_log) {
                    globalObj.__android_log('INFO', '[__hook_import] __require_module returned ' + (isPromise ? 'Promise' : 'value') + ' for ' + path);
                }
                console.log('[__hook_import] __require_module returned ' + (isPromise ? 'Promise' : 'value') + ' for ' + path);
                if (isPromise) {
                    result.then(function (val) {
                        if (globalObj.__android_log) {
                            globalObj.__android_log('INFO', '[__hook_import] resolved (async) for ' + path + ', keys=' + Object.keys(val || {}).join(','));
                        }
                        console.log('[__hook_import] resolved (async) for ' + path + ', keys=' + Object.keys(val || {}).join(','));
                        resolve(val);
                    }).catch(function (err) {
                        if (globalObj.__android_log) {
                            globalObj.__android_log('ERROR', '[__hook_import] rejected (async) for ' + path + ': ' + (err && err.message ? err.message : err));
                        }
                        console.error('[__hook_import] rejected (async) for ' + path + ': ' + (err && err.message ? err.message : err));
                        reject(err);
                    });
                } else {
                    if (globalObj.__android_log) {
                        globalObj.__android_log('INFO', '[__hook_import] resolved (sync) for ' + path + ', keys=' + Object.keys(result || {}).join(','));
                    }
                    console.log('[__hook_import] resolved (sync) for ' + path + ', keys=' + Object.keys(result || {}).join(','));

                    // For dynamic import(), we should return the full module object
                    // but ensure it has a .default property if it's an ESM-style module
                    if (result && result.__esModule && result.default === undefined) {
                        result.default = result;
                    }

                    resolve(result);
                }
            } catch (e) {
                if (globalObj.__android_log) {
                    globalObj.__android_log('ERROR', '[__hook_import] Error loading module: ' + (e && e.message ? e.message : e));
                }
                console.error('[__hook_import] Error loading module: ' + (e && e.message ? e.message : e));
                reject(e);
            }
        });
    };

    // Bridge logging helper to reduce boilerplate
    globalObj.__logBridgeCall = function (methodName, info) {
        globalObj.__bridge_call_count__ = (globalObj.__bridge_call_count__ || 0) + 1;
        console.log('[bridge.' + methodName + '] #' + globalObj.__bridge_call_count__ + ' ' + (info || ''));
    };

    globalObj.nativeBridge = {
        createView: function (tag, type, props) {
            globalObj.__logBridgeCall('createView', 'tag=' + tag + ', type=' + type);
            __android_createView(JSON.stringify({ tag: tag, type: type, props: props || {} }));
        },
        updateProps: function (tag, props) {
            globalObj.__logBridgeCall('updateProps', 'tag=' + tag);
            __android_updateProps(JSON.stringify({ tag: tag, props: props || {} }));
        },
        addChild: function (parent, child, index) {
            globalObj.__logBridgeCall('addChild', 'parent=' + parent + ', child=' + child);
            __android_addChild(JSON.stringify({ parent: parent, child: child, index: index }));
        },
        removeChild: function (parent, child) {
            globalObj.__logBridgeCall('removeChild', 'parent=' + parent + ', child=' + child);
            __android_removeChild(JSON.stringify({ parent: parent, child: child }));
        },
        addEventListener: function (tag, event, handler) {
            globalObj.__logBridgeCall('addEventListener', 'tag=' + tag + ', event=' + event);

            // Store the handler in act/android module if available
            if (globalObj.__modules && globalObj.__modules['act/android']) {
                globalObj.__modules['act/android'].exports.storeEventHandler(tag, event, handler);
            } else {
                console.warn('[bridge] act/android module not available yet');
            }

            // Tell native to wire up the click listener
            __android_addEventListener(JSON.stringify({ tag: tag, event: event }));
        },
        clearViews: function () {
            globalObj.__logBridgeCall('clearViews');
            __android_clearViews();
        }
    };
    globalObj.bridge = globalObj.nativeBridge;

    // Expose clearViews globally for act renderer
    globalObj.__clearViews = function () {
        if (globalObj.bridge && globalObj.bridge.clearViews) {
            globalObj.bridge.clearViews();
        }
    };

    // Legacy hook - will be replaced by act/android module
    // This is here for backwards compatibility
    globalObj.__hook_triggerEvent = function (data) {
        console.log('[bridge] __hook_triggerEvent called (legacy path)');
        if (globalObj.__modules && globalObj.__modules['act/android']) {
            globalObj.__modules['act/android'].exports.triggerEvent(data);
        } else {
            console.warn('[bridge] act/android module not available');
        }
    };
})();
