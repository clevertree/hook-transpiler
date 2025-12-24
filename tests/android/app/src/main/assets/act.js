"use strict";
(() => {
    // src/core.js
    function createAct(renderer2) {
        var tagCounter = 1;
        var rootComponent = null;
        var rootProps = {};
        var renderQueued = false;
        var isRendering = false;
        var componentState = {};
        var hookCursor = {};
        var pendingEffects = [];
        var currentPath = "root";
        function log(level, message) {
            try {
                var g2 = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : {};
                var logger = g2.console && g2.console[level] ? g2.console[level] : null;
                if (logger) {
                    logger("[act] " + message);
                }
                if (level === "error" && typeof g2.__log === "function") {
                    g2.__log("error", "[act] " + message);
                }
            } catch (e) {
            }
        }
        function emitError(message) {
            log("error", message);
        }
        function flattenChildren(args) {
            var out = [];
            for (var i = 2; i < args.length; i++) {
                var child = args[i];
                if (Array.isArray(child)) {
                    for (var j = 0; j < child.length; j++) out.push(child[j]);
                } else if (child !== void 0 && child !== null && child !== false) {
                    out.push(child);
                }
            }
            return out;
        }
        function createElement(type, props) {
            var children = flattenChildren(arguments);
            var p = props || {};
            if (children.length > 0) {
                p.children = children.length === 1 ? children[0] : children;
            }
            return { type, props: p, children };
        }
        function resetTags() {
            tagCounter = 1;
        }
        function nextTag() {
            return tagCounter++;
        }
        function makePath(parent, key) {
            return parent ? parent + "." + key : String(key);
        }
        function resetHookCursor(path) {
            hookCursor[path] = 0;
        }
        function nextHookIndex(path) {
            var idx = hookCursor[path] !== void 0 ? hookCursor[path] : 0;
            hookCursor[path] = idx + 1;
            return idx;
        }
        function getHookSlot(path, index) {
            var state = componentState[path];
            if (!state) {
                state = { hooks: [] };
                componentState[path] = state;
            }
            if (!state.hooks[index]) {
                state.hooks[index] = {};
            }
            return state.hooks[index];
        }
        function shallowDepsChanged(prev, next) {
            if (!prev || !next) return true;
            if (prev.length !== next.length) return true;
            for (var i = 0; i < prev.length; i++) {
                if (prev[i] !== next[i]) return true;
            }
            return false;
        }
        function scheduleRender() {
            if (!rootComponent) return;
            if (renderQueued) return;
            renderQueued = true;
            renderNow();
        }
        function renderComponent(fn, props, path) {
            if (typeof fn !== "function") return fn;
            resetHookCursor(path);
            var prevPath = currentPath;
            currentPath = path;
            try {
                var vnode = fn(props || {});
                currentPath = prevPath;
                return vnode;
            } catch (e) {
                currentPath = prevPath;
                emitError("renderComponent failed: " + (e.message || String(e)));
                throw e;
            }
        }
        function flushEffects() {
            var effects = pendingEffects.slice();
            pendingEffects.length = 0;
            for (var i = 0; i < effects.length; i++) {
                var item = effects[i];
                if (!item || !item.hook || typeof item.effect !== "function") continue;
                if (typeof item.hook.cleanup === "function") {
                    try {
                        item.hook.cleanup();
                    } catch (e) {
                        log("error", "effect cleanup failed: " + e.message);
                    }
                }
                try {
                    var nextCleanup = item.effect();
                    if (typeof nextCleanup === "function") {
                        item.hook.cleanup = nextCleanup;
                    } else {
                        item.hook.cleanup = null;
                    }
                    item.hook.deps = item.deps;
                } catch (e) {
                    log("error", "effect error: " + e.message);
                }
            }
        }
        function renderNow() {
            renderQueued = false;
            if (isRendering) return;
            if (!rootComponent) return;
            isRendering = true;
            try {
                if (renderer2.clear) renderer2.clear();
                resetTags();
                hookCursor = {};
                var vnode = renderComponent(rootComponent, rootProps || {}, "root");
                renderer2.mountNode(vnode, -1, 0, null, "root", {
                    nextTag,
                    makePath,
                    renderComponent,
                    log,
                    emitError
                });
                flushEffects();
            } catch (e) {
                var errorMsg = "render failed: " + (e.message || String(e));
                log("error", errorMsg);
                emitError(errorMsg);
            } finally {
                isRendering = false;
            }
        }
        function useState(initialValue) {
            var path = currentPath;
            var idx = nextHookIndex(path);
            var hook = getHookSlot(path, idx);
            if (!("value" in hook)) {
                hook.value = typeof initialValue === "function" ? initialValue() : initialValue;
            }
            var setter = function (next) {
                var nextValue = typeof next === "function" ? next(hook.value) : next;
                hook.value = nextValue;
                scheduleRender();
            };
            return [hook.value, setter];
        }
        function useReducer(reducer, initialArg, init) {
            var initialState = init !== void 0 ? init(initialArg) : initialArg;
            var stateHook = useState(initialState);
            var state = stateHook[0];
            var setState = stateHook[1];
            var dispatch = function (action) {
                setState(function (currentState) {
                    return reducer(currentState, action);
                });
            };
            return [state, dispatch];
        }
        function useEffect(effect, deps) {
            var path = currentPath;
            var idx = nextHookIndex(path);
            var hook = getHookSlot(path, idx);
            var shouldRun = shallowDepsChanged(hook.deps, deps);
            if (shouldRun) {
                pendingEffects.push({ hook, effect, deps });
            }
        }
        function useRef(initialValue) {
            var path = currentPath;
            var idx = nextHookIndex(path);
            var hook = getHookSlot(path, idx);
            if (!("ref" in hook)) {
                hook.ref = { current: initialValue };
            }
            return hook.ref;
        }
        function useMemo(factory, deps) {
            var path = currentPath;
            var idx = nextHookIndex(path);
            var hook = getHookSlot(path, idx);
            if (!("value" in hook) || shallowDepsChanged(hook.deps, deps)) {
                hook.value = factory();
                hook.deps = deps;
            }
            return hook.value;
        }
        function useCallback(fn, deps) {
            return useMemo(function () {
                return fn;
            }, deps);
        }
        function createContext(defaultValue) {
            var context = {
                _currentValue: defaultValue,
                Provider: function (props) {
                    if ("value" in props) {
                        context._currentValue = props.value;
                    }
                    return props.children;
                }
            };
            return context;
        }
        function useContext(context) {
            return context._currentValue;
        }
        function render(component, props) {
            rootComponent = component;
            rootProps = props || {};
            scheduleRender();
        }
        function unmount() {
            for (var path in componentState) {
                var state = componentState[path];
                if (state && state.hooks) {
                    for (var i = 0; i < state.hooks.length; i++) {
                        var hook = state.hooks[i];
                        if (hook && typeof hook.cleanup === "function") {
                            try {
                                hook.cleanup();
                            } catch (e) {
                                log("error", "hook cleanup failed: " + e.message);
                            }
                        }
                    }
                }
            }
            if (renderer2.clear) renderer2.clear();
            resetTags();
            componentState = {};
            hookCursor = {};
        }
        var StyleSheet2 = {
            create: function (styles) {
                return styles;
            }
        };
        return {
            createElement,
            render,
            unmount,
            useState,
            useEffect,
            useLayoutEffect: useEffect,
            useRef,
            useMemo,
            useCallback,
            useReducer,
            createContext,
            useContext,
            Fragment: "div",
            memo: function (comp) {
                return comp;
            },
            forwardRef: function (comp) {
                return comp;
            },
            StyleSheet: StyleSheet2,
            ActUtils: {
                act: (cb) => cb()
            }
        };
    }

    // src/renderer-android.js
    function createAndroidRenderer() {
        function normalizeType(type) {
            if (typeof type === "string") return type;
            return "view";
        }
        function getBridge() {
            var g2 = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : {};
            return g2.bridge;
        }
        function mountNode(node, parentTag, index, parentType, path, helpers) {
            if (node === null || node === void 0 || node === false) return;
            var nb = getBridge();
            if (!nb) {
                helpers.log("error", "bridge missing");
                return;
            }
            if (typeof node === "string" || typeof node === "number") {
                var textVal = String(node);
                if (parentType === "span" || parentType === "text" || parentType === "button") {
                    nb.updateProps(parentTag, { text: textVal });
                } else {
                    var textTag = helpers.nextTag();
                    nb.createView(textTag, "span", { text: textVal, width: "wrap_content", height: "wrap_content" });
                    nb.addChild(parentTag, textTag, index);
                }
                return;
            }
            if (typeof node.type === "function") {
                var compPath = helpers.makePath(path, "c" + index);
                try {
                    var rendered = helpers.renderComponent(node.type, node.props || {}, compPath);
                    mountNode(rendered, parentTag, index, parentType, compPath, helpers);
                } catch (e) {
                    helpers.emitError("Failed to mount component: " + (e.message || String(e)));
                }
                return;
            }
            var type = normalizeType(node.type);
            var tag = helpers.nextTag();
            var props = Object.assign({}, node.props || {});
            var onClick = props.onClick;
            delete props.onClick;
            delete props.children;
            if (!props.width && parentTag === -1) props.width = "match_parent";
            if (!props.height && parentTag === -1) props.height = "match_parent";
            nb.createView(tag, type, props);
            if (typeof onClick === "function") {
                nb.addEventListener(tag, "click", onClick);
            }
            var kids = node.children || [];
            if (node.props && node.props.children) {
                if (kids.length === 0) {
                    kids = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
                }
            }
            for (var i = 0; i < kids.length; i++) {
                mountNode(kids[i], tag, i, type, helpers.makePath(path, i), helpers);
            }
            nb.addChild(parentTag, tag, index);
        }
        return {
            mountNode,
            clear: function () {
                var g2 = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : {};
                if (typeof g2.__clearViews === "function") {
                    g2.__clearViews();
                    return;
                }
                var nb = g2.bridge;
                if (nb && nb.removeChild) {
                    try {
                        nb.removeChild(-1, -1);
                    } catch (e) {
                    }
                }
            }
        };
    }

    // src/index.android.js
    var renderer = createAndroidRenderer();
    var Act = createAct(renderer);
    var View = (props) => Act.createElement("view", props);
    var Text = (props) => Act.createElement("text", props);
    var Image = (props) => Act.createElement("image", props);
    var ScrollView = (props) => Act.createElement("scroll", props);
    var StyleSheet = Act.StyleSheet;
    var AppRegistry = {
        registerComponent: (name, factory) => {
            const Component = factory();
            Act.render(Component);
        }
    };
    var g = typeof globalThis !== "undefined" ? globalThis : typeof global !== "undefined" ? global : void 0;
    if (g) {
        g.Act = Act;
        g.React = Act;
        g.Android/iOS Native = {
            View,
            Text,
            Image,
            ScrollView,
            StyleSheet,
            AppRegistry
        };
        g.__hook_jsx_runtime = {
            jsx: Act.createElement,
            jsxs: Act.createElement,
            Fragment: Act.Fragment
        };
        g.__jsx = Act.createElement;
        g.__jsxs = Act.createElement;
        g.__Fragment = Act.Fragment;
    }
    var index_android_default = Act;
})();
