var HookTranspilerAndroid = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // ../../dist/es6ImportHandler.js
  var ES6ImportHandler = class {
    constructor(options) {
      this.moduleCache = /* @__PURE__ */ new Map();
      this.transpiling = /* @__PURE__ */ new Map();
      this.currentModulePath = null;
      this.executionContext = null;
      this.loadModuleDelegate = null;
      this.host = options.host;
      this.protocol = options.protocol || "https";
      this.baseUrl = options.baseUrl || "/hooks";
      this.onDiagnostics = options.onDiagnostics || ((diag) => {
        console.debug("[ES6ImportHandler] Diagnostics:", diag);
      });
      this.transpiler = options.transpiler || this.defaultTranspiler;
    }
    /**
     * Allow the host to delegate import() to a provided loader (e.g., helpers.loadModule)
     */
    setLoadModuleDelegate(delegate) {
      this.loadModuleDelegate = delegate;
    }
    /**
     * Inform the handler of the currently executing module path so relative imports resolve correctly
     */
    setCurrentModulePath(path) {
      this.currentModulePath = path || null;
    }
    /**
     * Provide the current execution context so a delegate can use it
     */
    setExecutionContext(ctx) {
      this.executionContext = ctx;
    }
    /**
     * Default transpiler
     */
    async defaultTranspiler(code, filename) {
      console.warn("[ES6ImportHandler] No transpiler provided, returning code as-is");
      return code;
    }
    /**
     * Handle import() calls from hook code
     * Called as: const mod = await __import__('./utils.mjs')
     */
    async handle(modulePath) {
      const normalizedPath = this.normalizePath(modulePath);
      const cacheKey = `${this.host}:${normalizedPath}`;
      this.onDiagnostics({
        phase: "import",
        action: "handle_import",
        modulePath,
        normalizedPath,
        cached: this.moduleCache.has(cacheKey)
      });
      if (this.moduleCache.has(cacheKey)) {
        console.debug("[ES6ImportHandler] Cache hit:", cacheKey);
        return this.moduleCache.get(cacheKey);
      }
      if (this.transpiling.has(cacheKey)) {
        console.debug("[ES6ImportHandler] Waiting for in-flight transpile:", cacheKey);
        return this.transpiling.get(cacheKey);
      }
      const promise = (async () => {
        if (this.loadModuleDelegate) {
          try {
            const mod = await this.loadModuleDelegate(modulePath, this.currentModulePath, this.executionContext);
            this.moduleCache.set(cacheKey, mod);
            this.onDiagnostics({ phase: "import", action: "delegate_success", modulePath, normalizedPath });
            return mod;
          } catch (delegateErr) {
            this.onDiagnostics({ phase: "import", action: "delegate_failed", modulePath, normalizedPath, error: String(delegateErr) });
          }
        }
        return this.loadAndTranspile(modulePath, normalizedPath, cacheKey);
      })();
      this.transpiling.set(cacheKey, promise);
      try {
        const result = await promise;
        return result;
      } finally {
        this.transpiling.delete(cacheKey);
      }
    }
    /**
     * Fetch, transpile, and execute a module
     */
    async loadAndTranspile(originalPath, normalizedPath, cacheKey) {
      const startTime = Date.now();
      console.debug("[ES6ImportHandler] Loading module:", { originalPath, normalizedPath });
      try {
        const moduleUrl = `${this.protocol}://${this.host}${normalizedPath}`;
        console.debug("[ES6ImportHandler] Fetching from:", moduleUrl);
        const response = await fetch(moduleUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${moduleUrl}: ${response.status} ${response.statusText}`);
        }
        const code = await response.text();
        console.debug("[ES6ImportHandler] Fetched code, length:", code.length);
        console.debug("[ES6ImportHandler] Transpiling:", normalizedPath);
        const transpiled = await this.transpiler(code, normalizedPath);
        console.debug("[ES6ImportHandler] Transpiled code, length:", transpiled.length);
        const moduleExports = await this.executeModule(transpiled, normalizedPath);
        this.moduleCache.set(cacheKey, moduleExports);
        const duration = Date.now() - startTime;
        console.debug("[ES6ImportHandler] Successfully loaded module:", {
          path: normalizedPath,
          duration: `${duration}ms`,
          exports: Object.keys(moduleExports).slice(0, 5)
        });
        this.onDiagnostics({
          phase: "import",
          action: "load_success",
          modulePath: normalizedPath,
          duration
        });
        return moduleExports;
      } catch (err) {
        const duration = Date.now() - startTime;
        console.error("[ES6ImportHandler] Failed to load module:", {
          path: normalizedPath,
          error: err instanceof Error ? err.message : String(err),
          duration: `${duration}ms`
        });
        this.onDiagnostics({
          phase: "import",
          action: "load_error",
          modulePath: normalizedPath,
          error: err instanceof Error ? err.message : String(err),
          duration
        });
        throw err;
      }
    }
    /**
     * Execute module code with ES6 import support
     */
    async executeModule(code, filename) {
      const moduleExports = {};
      const module = { exports: moduleExports };
      try {
        const fn = new Function("__import__", "module", "exports", `
// Wrap in async IIFE to allow top-level await patterns in transpiled code
return (async function(){
  try {
    ${code}
  } catch (err) {
    console.error('[ES6ImportHandler.executeModule] Code execution error in ${filename}:', err && (err.message || err));
    throw err;
  }
})()
//# sourceURL=${filename}
      `);
        await fn(this.handle.bind(this), module, moduleExports);
        console.debug("[ES6ImportHandler] Module executed:", filename);
        return moduleExports;
      } catch (err) {
        console.error(`[ES6ImportHandler] Failed to execute module ${filename}:`, err);
        throw err;
      }
    }
    /**
     * Normalize a module path to absolute path
     */
    normalizePath(modulePath) {
      if (modulePath.startsWith("./") || modulePath.startsWith("../")) {
        try {
          const base = this.currentModulePath && this.currentModulePath.startsWith("/") ? this.currentModulePath : `${this.baseUrl}/client/get-client.jsx`;
          const baseUrl = new URL(base, "http://resolver.local");
          const resolvedUrl = new URL(modulePath, baseUrl);
          const resolved = resolvedUrl.pathname;
          console.debug("[ES6ImportHandler] Resolved relative path:", { modulePath, from: this.currentModulePath, resolved });
          return resolved;
        } catch {
          const cleaned = modulePath.replace(/^\.\//g, "");
          const resolved = `${this.baseUrl}/${cleaned}`.replace(/\/+/g, "/").replace(/\/\.\//g, "/");
          console.debug("[ES6ImportHandler] Resolved (fallback) relative path:", { modulePath, resolved });
          return resolved;
        }
      }
      if (modulePath.startsWith("/")) {
        return modulePath;
      }
      if (modulePath.startsWith("@")) {
        return `${this.baseUrl}/${modulePath}`;
      }
      return `${this.baseUrl}/${modulePath}`;
    }
    /**
     * Clear the module cache (useful for development/hot reload)
     */
    clearCache() {
      this.moduleCache.clear();
      console.debug("[ES6ImportHandler] Cache cleared");
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
      return {
        size: this.moduleCache.size,
        entries: Array.from(this.moduleCache.keys())
      };
    }
  };

  // ../../dist/runtimeLoader.js
  function createHookReact(reactModule, onElement) {
    if (!reactModule)
      return void 0;
    const baseCreate = reactModule.createElement.bind(reactModule);
    function hookCreateElement(type, props, ...children) {
      if (typeof type === "string" && onElement) {
        try {
          onElement(type, props || void 0);
        } catch (e) {
        }
      }
      return baseCreate(type, props, ...children);
    }
    return { ...reactModule, createElement: hookCreateElement };
  }
  var AndroidModuleLoader = class {
    constructor(options) {
      this.importHandler = null;
      this.requireShim = options?.requireShim || ((spec) => {
        if (spec === "react") {
          return typeof global.React !== "undefined" ? global.React : {};
        }
        if (spec === "@clevertree/meta") {
          return globalThis.__relay_meta || { filename: "", dirname: "", url: "" };
        }
        if (spec === "@clevertree/markdown" || spec === "@clevertree/theme") {
          return globalThis.__relay_builtins?.[spec] || {};
        }
        return {};
      });
      this.transpiler = options?.transpiler || (async (code) => code);
      if (options?.host) {
        this.importHandler = new ES6ImportHandler({
          host: options.host,
          baseUrl: "/hooks",
          onDiagnostics: options?.onDiagnostics,
          transpiler: this.transpiler
        });
      }
    }
    /**
     * Set up the import handler (called after host is known)
     */
    setImportHandler(importHandler) {
      this.importHandler = importHandler;
    }
    async executeModule(code, filename, context, fetchUrl) {
      const exports = {};
      const module = { exports };
      const usesES6Import = /\bawait\s+import\s*\(|import\s*\(/.test(code);
      if (usesES6Import && !this.importHandler) {
        console.warn("[AndroidModuleLoader] Code uses import() but no ES6ImportHandler available. Install will fail.", { filename });
      }
      const fn = new Function("__import__", "require", "module", "exports", "context", `
try {
  ${code}
} catch (err) {
  console.error('[AndroidModuleLoader] Code execution error in ${filename}:', err.message || err);
  throw err;
}
//# sourceURL=${filename}
    `);
      try {
        if (this.importHandler) {
          try {
            this.importHandler.setCurrentModulePath?.(filename);
            this.importHandler.setExecutionContext?.(context);
          } catch (e) {
            console.warn("[AndroidModuleLoader] Failed to set import handler context:", e);
          }
        }
        let importFn = this.importHandler?.handle.bind(this.importHandler);
        if (!importFn) {
          importFn = (modulePath) => {
            throw new Error(`import('${modulePath}') not supported - ES6ImportHandler not initialized`);
          };
        }
        ;
        globalThis.__currentModulePath = filename;
        globalThis.__hook_import = importFn;
        globalThis.__relay_meta = {
          filename,
          dirname: filename.substring(0, filename.lastIndexOf("/")),
          url: fetchUrl || filename
        };
        await fn(importFn, this.requireShim, module, exports, context);
        setTimeout(() => {
          try {
            delete globalThis.__hook_import;
          } catch {
          }
          try {
            delete globalThis.__currentModulePath;
          } catch {
          }
        }, 500);
        if (module.exports !== exports) {
        } else {
          module.exports = exports;
        }
      } catch (err) {
        console.error(`[AndroidModuleLoader] Failed to execute module ${filename}:`, err);
        throw err;
      }
      const mod = module.exports || exports;
      console.log("[AndroidModuleLoader] After execution - mod object:", JSON.stringify(mod, null, 2));
      console.log("[AndroidModuleLoader] mod.default type:", typeof mod?.default);
      console.log("[AndroidModuleLoader] module.exports === exports?", module.exports === exports);
      console.log("[AndroidModuleLoader] exports object:", JSON.stringify(exports, null, 2));
      if (!mod || typeof mod.default !== "function") {
        throw new Error("Hook module must export default function(ctx)");
      }
      return mod;
    }
  };
  async function transpileCode(code, options, _toCommonJs = false) {
    const filename = options.filename || "module.tsx";
    const g = typeof globalThis !== "undefined" ? globalThis : {};
    const wasmTranspile = g.__hook_transpile_jsx;
    const version = g.__hook_transpiler_version || "unknown";
    const forceServer = !!g.__forceServerTranspile;
    if (forceServer) {
      try {
        const resp = await fetch("/api/transpile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, filename, to_common_js: false })
        });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          throw new Error(`ServerTranspileError: ${resp.status} ${resp.statusText} ${txt}`);
        }
        const data = await resp.json();
        if (!data?.ok || !data?.code) {
          throw new Error(`ServerTranspileError: ${data?.diagnostics || "unknown error"}`);
        }
        const out2 = String(data.code);
        const rewritten = applyHookRewrite(out2.replace(/\bimport\s*\(/g, "context.helpers.loadModule("));
        return rewritten + `
//# sourceURL=${filename}`;
      } catch (e) {
        throw e;
      }
    }
    if (typeof wasmTranspile !== "function") {
      const availableKeys = Object.keys(g).filter((k) => k.startsWith("__")).join(", ");
      console.error("[transpileCode] WASM not ready:", {
        hasGlobalThis: typeof globalThis !== "undefined",
        hasHook: "__hook_transpile_jsx" in g,
        type: typeof wasmTranspile,
        globalKeys: availableKeys || "(none)"
      });
      if (g.__allowServerTranspile) {
        console.warn("[transpileCode] WASM not ready; attempting server fallback /api/transpile");
        try {
          const resp = await fetch("/api/transpile", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code, filename, to_common_js: false })
          });
          if (!resp.ok) {
            const txt = await resp.text().catch(() => "");
            throw new Error(`ServerTranspileError: ${resp.status} ${resp.statusText} ${txt}`);
          }
          const data = await resp.json();
          if (!data?.ok || !data?.code) {
            throw new Error(`ServerTranspileError: ${data?.diagnostics || "unknown error"}`);
          }
          const out2 = String(data.code);
          const rewritten = applyHookRewrite(out2.replace(/\bimport\s*\(/g, "context.helpers.loadModule("));
          return rewritten + `
//# sourceURL=${filename}`;
        } catch (e) {
          console.error("[transpileCode] Server fallback failed:", e);
        }
      }
      throw new Error(`HookTranspiler WASM not loaded (v${version}): expected globalThis.__hook_transpile_jsx(source, filename)`);
    }
    let pragmaFn = "h";
    let pragmaFragFn = "React.Fragment";
    const pragmaMatch = code.match(/\/\*+\s*@jsx\s+([\w.]+)\s*\*+\//);
    const pragmaFragMatch = code.match(/\/\*+\s*@jsxFrag\s+([\w.]+)\s*\*+\//);
    if (pragmaMatch && pragmaMatch[1])
      pragmaFn = pragmaMatch[1];
    if (pragmaFragMatch && pragmaFragMatch[1])
      pragmaFragFn = pragmaFragMatch[1];
    const preamble = ``;
    const codeWithPreamble = preamble + code;
    let out;
    try {
      out = await wasmTranspile(codeWithPreamble, filename, options.isTypescript);
    } catch (callError) {
      console.error("[transpileCode] WASM call threw exception:", callError);
      if (g.__allowServerTranspile) {
        console.warn("[transpileCode] Attempting server fallback due to WASM exception");
        try {
          const resp = await fetch("/api/transpile", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code, filename, to_common_js: false })
          });
          if (!resp.ok) {
            const txt = await resp.text().catch(() => "");
            throw new Error(`ServerTranspileError: ${resp.status} ${resp.statusText} ${txt}`);
          }
          const data = await resp.json();
          if (!data?.ok || !data?.code) {
            throw new Error(`ServerTranspileError: ${data?.diagnostics || "unknown error"}`);
          }
          const out2 = String(data.code);
          const rewritten = applyHookRewrite(out2.replace(/\bimport\s*\(/g, "context.helpers.loadModule("));
          return rewritten + `
//# sourceURL=${filename}`;
        } catch (e) {
          console.error("[transpileCode] Server fallback failed after WASM exception:", e);
        }
      }
      throw callError;
    }
    let transpiledCode;
    if (typeof out === "object" && out !== null) {
      if (out.error) {
        const errorMsg = `TranspileError: ${filename}: ${out.error} (v${version})`;
        console.error("[transpileCode] JSX transpilation failed:", {
          filename,
          inputSize: code.length,
          errorMessage: errorMsg,
          codePreview: code.substring(0, 200)
        });
        globalThis.__lastTranspiledCode = null;
        globalThis.__lastTranspileError = errorMsg;
        if (g.__allowServerTranspile) {
          console.warn("[transpileCode] WASM returned error; attempting server fallback");
          try {
            const resp = await fetch("/api/transpile", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ code, filename, to_common_js: false })
            });
            if (!resp.ok) {
              const txt = await resp.text().catch(() => "");
              throw new Error(`ServerTranspileError: ${resp.status} ${resp.statusText} ${txt}`);
            }
            const data = await resp.json();
            if (!data?.ok || !data?.code) {
              throw new Error(`ServerTranspileError: ${data?.diagnostics || "unknown error"}`);
            }
            transpiledCode = String(data.code);
            const rewritten = transpiledCode.replace(/\bimport\s*\(/g, "context.helpers.loadModule(");
            return rewritten + `
//# sourceURL=${filename}`;
          } catch (e) {
            console.error("[transpileCode] Server fallback failed after WASM error:", e);
          }
        }
        throw new Error(errorMsg);
      }
      if (!out.code) {
        throw new Error(`HookTranspiler returned empty code for ${filename}`);
      }
      transpiledCode = out.code;
    } else if (typeof out === "string") {
      transpiledCode = out;
    } else {
      throw new Error(`HookTranspiler returned unexpected type: ${typeof out}`);
    }
    if (transpiledCode.startsWith("TranspileError:")) {
      const errorMsg = `${transpiledCode} (v${version})`;
      console.error("[transpileCode] JSX transpilation failed:", {
        filename,
        inputSize: code.length,
        errorMessage: errorMsg,
        codePreview: code.substring(0, 200)
      });
      globalThis.__lastTranspiledCode = transpiledCode;
      globalThis.__lastTranspileError = errorMsg;
      if (g.__allowServerTranspile) {
        console.warn("[transpileCode] WASM returned TranspileError; attempting server fallback");
        try {
          const resp = await fetch("/api/transpile", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code, filename, to_common_js: false })
          });
          if (!resp.ok) {
            const txt = await resp.text().catch(() => "");
            throw new Error(`ServerTranspileError: ${resp.status} ${resp.statusText} ${txt}`);
          }
          const data = await resp.json();
          if (!data?.ok || !data?.code) {
            throw new Error(`ServerTranspileError: ${data?.diagnostics || "unknown error"}`);
          }
          transpiledCode = String(data.code);
          const rewritten = transpiledCode.replace(/\bimport\s*\(/g, "context.helpers.loadModule(");
          return rewritten + `
//# sourceURL=${filename}`;
        } catch (e) {
          console.error("[transpileCode] Server fallback failed after TranspileError:", e);
        }
      }
      throw new Error(errorMsg);
    }
    ;
    globalThis.__lastTranspiledCode = transpiledCode;
    const stillHasJsx = /<[A-Z]/.test(transpiledCode);
    if (stillHasJsx) {
      console.warn("[transpileCode] WARNING: Output still contains JSX syntax! Transpilation may have failed silently.");
      console.warn("[transpileCode] Transpiled code available at: window.__lastTranspiledCode");
    } else if (transpiledCode.includes("React.createElement(")) {
      console.log("[transpileCode] \u2713 Output contains React.createElement() calls - transpilation successful");
    }
    return applyHookRewrite(transpiledCode + `
//# sourceURL=${filename}`);
  }
  function applyHookRewrite(code) {
    const mkBuiltin = (spec, destructure) => `const ${destructure} = ((globalThis && globalThis.__relay_builtins && globalThis.__relay_builtins['${spec}']) || {});`;
    const markdownRe = /import\s+\{\s*MarkdownRenderer\s*\}\s+from\s+['"]@clevertree\/markdown['"];?/g;
    const themeRe = /import\s+\{\s*registerThemesFromYaml\s*\}\s+from\s+['"]@clevertree\/theme['"];?/g;
    const metaRe = /import\s+(\w+)\s+from\s+['"]@clevertree\/meta['"];?/g;
    const metaStarRe = /import\s*\*\s*as\s+(\w+)\s+from\s+['"]@clevertree\/meta['"];?/g;
    const metaDestructureRe = /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]@clevertree\/meta['"];?/g;
    const reactRe = /import\s+React\s*(?:,\s*\{([^}]+)\})?\s+from\s+['"]react['"];?/g;
    const reactNamedOnlyRe = /import\s+\{([^}]+)\}\s+from\s+['"]react['"];?/g;
    const reactStarRe = /import\s*\*\s*as\s+React\s+from\s+['"]react['"];?/g;
    const jsxRuntimeRe = /import\s+\{\s*jsx\s+as\s+(_jsx)\s*,\s*jsxs\s+as\s+(_jsxs)\s*,\s*Fragment\s+as\s+(_Fragment)\s*\}\s+from\s+['"]react\/jsx-runtime['"];?/g;
    let rewritten = code.replace(markdownRe, mkBuiltin("@clevertree/markdown", "{ MarkdownRenderer }"));
    rewritten = rewritten.replace(themeRe, mkBuiltin("@clevertree/theme", "{ registerThemesFromYaml }"));
    rewritten = rewritten.replace(reactRe, (_m, named) => {
      let res = "const React = (globalThis.__hook_react || globalThis.React);";
      if (named)
        res += ` const { ${named} } = React;`;
      return res;
    });
    rewritten = rewritten.replace(reactNamedOnlyRe, (_m, named) => {
      return `const { ${named} } = (globalThis.__hook_react || globalThis.React);`;
    });
    rewritten = rewritten.replace(reactStarRe, "const React = (globalThis.__hook_react || globalThis.React);");
    rewritten = rewritten.replace(metaRe, (_m, name) => `const ${name} = (globalThis.__relay_meta || { filename: '', dirname: '', url: '' });`);
    rewritten = rewritten.replace(metaStarRe, (_m, name) => `const ${name} = (globalThis.__relay_meta || { filename: '', dirname: '', url: '' });`);
    rewritten = rewritten.replace(metaDestructureRe, (_m, destructure) => `const { ${destructure} } = (globalThis.__relay_meta || { filename: '', dirname: '', url: '' });`);
    rewritten = rewritten.replace(jsxRuntimeRe, (_m, a, b, c) => `const ${a} = (globalThis.__hook_jsx_runtime?.jsx || globalThis.__jsx || (globalThis.__hook_react && globalThis.__hook_react.createElement) || (() => null)); const ${b} = (globalThis.__hook_jsx_runtime?.jsxs || globalThis.__jsxs || (globalThis.__hook_react && globalThis.__hook_react.createElement) || (() => null)); const ${c} = (globalThis.__hook_jsx_runtime?.Fragment || globalThis.__Fragment || (globalThis.__hook_react && globalThis.__hook_react.Fragment));`);
    rewritten = rewritten.replace(/export\s+default\s+function\s+(\w+)\s*\(/g, (match, name) => {
      return `function ${name}(`;
    });
    rewritten = rewritten.replace(/export\s+default\s+(\w+)\s*;?\s*$/m, (match, name) => {
      return `module.exports.default = ${name};`;
    });
    return rewritten;
  }
  function looksLikeTsOrJsx(code, filename) {
    const hasPragma = /@use-jsx|@use-ts|@jsx\s+h/m.test(code);
    const hasJsxSyntax = /<([A-Za-z][A-Za-z0-9]*)\s/.test(code);
    const isTypescriptExt = filename.endsWith(".tsx") || filename.endsWith(".ts") || filename.endsWith(".jsx");
    return hasPragma || hasJsxSyntax || isTypescriptExt;
  }
  var HookLoader = class {
    logTranspileResult(filename, code) {
      const containsExport = /\bexport\b/.test(code);
      const sample = code.substring(0, 200).replace(/\n/g, "\\n");
      const logger = containsExport ? console.warn : console.debug;
      logger(`[HookLoader] Transpiler output for ${filename} (contains export=${containsExport}, len=${code.length})`, sample);
    }
    constructor(options) {
      this.moduleCache = /* @__PURE__ */ new Map();
      this.host = options.host;
      this.protocol = options.protocol;
      this.moduleLoader = options.moduleLoader;
      this.transpiler = options.transpiler;
      this.onDiagnostics = options.onDiagnostics || (() => {
      });
    }
    buildRequestHeaders(context) {
      const builder = context?.helpers?.buildRepoHeaders;
      if (!builder)
        return {};
      return { ...builder() };
    }
    /**
     * Load a module from the peer/repo, with optional transpilation
     * @param modulePath Relative or absolute path to module
     * @param fromPath Current hook path for resolving relative imports
     * @param context Hook context for module execution
     * @returns Module exports
     */
    async loadModule(modulePath, fromPath = "/hooks/client/get-client.jsx", context) {
      let normalizedPath = modulePath;
      try {
        const dbg = globalThis.__HOOK_DEBUG || typeof localStorage !== "undefined" && localStorage.getItem("hookDebug") === "1";
        if (dbg) {
          try {
            console.debug("[HookLoader.loadModule] start", { modulePath, fromPath });
          } catch {
          }
        }
        if (modulePath.startsWith("./") || modulePath.startsWith("../")) {
          const base = fromPath && fromPath.startsWith("/") ? fromPath : "/hooks/client/get-client.jsx";
          const baseUrl = new URL(base, "http://resolver.local");
          const resolved = new URL(modulePath, baseUrl);
          normalizedPath = resolved.pathname;
        } else if (!modulePath.startsWith("/")) {
          normalizedPath = `/hooks/client/${modulePath}`;
        }
        const parts = normalizedPath.split("/").filter(Boolean);
        const normalized = [];
        for (const part of parts) {
          if (part === "..") {
            normalized.pop();
          } else if (part !== ".") {
            normalized.push(part);
          }
        }
        normalizedPath = "/" + normalized.join("/");
        if (dbg) {
          try {
            console.debug("[HookLoader.loadModule] normalized", { modulePath, fromPath, normalizedPath });
          } catch {
          }
        }
      } catch (_) {
        const baseDir = (fromPath || "/hooks/client/get-client.jsx").split("/").slice(0, -1).join("/") || "/hooks/client";
        const combined = `${baseDir}/${modulePath}`;
        const parts = combined.split("/").filter(Boolean);
        const normalized = [];
        for (const part of parts) {
          if (part === "..") {
            normalized.pop();
          } else if (part !== ".") {
            normalized.push(part);
          }
        }
        normalizedPath = "/" + normalized.join("/");
        try {
          const dbg2 = globalThis.__HOOK_DEBUG || typeof localStorage !== "undefined" && localStorage.getItem("hookDebug") === "1";
          if (dbg2)
            console.debug("[HookLoader.loadModule] normalized (fallback)", { modulePath, fromPath, normalizedPath });
        } catch {
        }
      }
      const cacheKey = `${this.host}:${normalizedPath}`;
      if (this.moduleCache.has(cacheKey)) {
        return this.moduleCache.get(cacheKey);
      }
      const moduleUrl = `${this.protocol}://${this.host}${normalizedPath}`;
      const requestHeaders = this.buildRequestHeaders(context);
      const fetchOptions = Object.keys(requestHeaders).length ? { headers: requestHeaders } : void 0;
      try {
        const response = await fetch(moduleUrl, fetchOptions);
        if (!response.ok) {
          throw new Error(`ModuleLoadError: ${moduleUrl} \u2192 ${response.status} ${response.statusText}`);
        }
        const ct = (response.headers.get("content-type") || "").toLowerCase();
        if (ct.includes("text/html")) {
          throw new Error(`ModuleLoadError: ${moduleUrl} returned HTML (content-type=${ct})`);
        }
        const code = await response.text();
        let finalCode = code;
        const shouldTranspile = !!this.transpiler || looksLikeTsOrJsx(code, normalizedPath);
        if (shouldTranspile) {
          try {
            if (this.transpiler) {
              finalCode = await this.transpiler(code, normalizedPath);
              this.logTranspileResult(normalizedPath, finalCode);
            } else {
              finalCode = await transpileCode(
                code,
                { filename: normalizedPath },
                false
                // Web uses import, not CommonJS
              );
            }
          } catch (err) {
            const msg = err?.message || String(err);
            const diag = {
              phase: "transform",
              error: msg,
              details: { moduleUrl, filename: normalizedPath, ...err }
            };
            this.onDiagnostics(diag);
            throw new Error(`TranspileError: ${normalizedPath}: ${msg}`);
          }
        }
        let mod;
        try {
          mod = await this.moduleLoader.executeModule(finalCode, normalizedPath, context, moduleUrl);
        } catch (execErr) {
          const execMsg = execErr?.message || String(execErr);
          const syntaxMatch = execMsg.match(/Unexpected token|missing \)|SyntaxError/);
          const diag = {
            phase: "import",
            error: execMsg,
            details: {
              filename: normalizedPath,
              isSyntaxError: !!syntaxMatch,
              transpilerVersion: globalThis.__hook_transpiler_version || "unknown"
            }
          };
          console.error("[RuntimeLoader] Module execution failed:", {
            filename: normalizedPath,
            error: execMsg,
            isSyntaxError: !!syntaxMatch,
            transpilerVersion: globalThis.__hook_transpiler_version
          });
          this.onDiagnostics(diag);
          throw execErr;
        }
        this.moduleCache.set(cacheKey, mod);
        return mod;
      } catch (err) {
        console.error("[HookLoader.loadModule] Failed:", modulePath, err);
        throw err;
      }
    }
    /**
     * Load and execute a hook module
     * @param hookPath Path to the hook module (from OPTIONS)
     * @param context The hook context to pass
     * @returns Executed hook element/result
     */
    async loadAndExecuteHook(hookPath, context) {
      const diag = { phase: "init" };
      try {
        diag.phase = "fetch";
        const hookUrl = `${this.protocol}://${this.host}${hookPath}`;
        console.debug(`[HookLoader] Fetching hook from: ${hookUrl}`);
        const requestHeaders = this.buildRequestHeaders(context);
        const fetchOptions = Object.keys(requestHeaders).length ? { headers: requestHeaders } : void 0;
        let response;
        let code;
        try {
          response = await fetch(hookUrl, fetchOptions);
          code = await response.text();
        } catch (fetchErr) {
          console.error("[HookLoader] Fetch failed, got error immediately:", fetchErr);
          throw fetchErr;
        }
        console.debug(`[HookLoader] Received hook code (${code.length} chars)`);
        diag.fetch = {
          status: response.status,
          ok: response.ok,
          contentType: response.headers.get("content-type")
        };
        if (!response.ok) {
          throw new Error(`ModuleLoadError: ${hookUrl} \u2192 ${response.status} ${response.statusText}`);
        }
        const ct = (response.headers.get("content-type") || "").toLowerCase();
        if (ct.includes("text/html")) {
          throw new Error(`ModuleLoadError: ${hookUrl} returned HTML (content-type=${ct})`);
        }
        diag.codeLength = code.length;
        diag.phase = "transform";
        let finalCode = code;
        const shouldTranspile = !!this.transpiler || looksLikeTsOrJsx(code, hookPath);
        if (shouldTranspile) {
          try {
            console.debug(`[HookLoader] Transpiling ${hookPath}`);
            if (this.transpiler) {
              finalCode = await this.transpiler(code, hookPath);
              this.logTranspileResult(hookPath, finalCode);
            } else {
              finalCode = await transpileCode(
                code,
                { filename: hookPath, hasJsxPragma: /@jsx\s+h/m.test(code) },
                false
                // Web uses dynamic import
              );
            }
            console.debug(`[HookLoader] Transpilation complete (${finalCode.length} chars)`);
          } catch (err) {
            const msg = err?.message || String(err);
            console.warn("[HookLoader] JSX transpilation failed", { hookPath, error: msg });
            diag.transpileWarn = msg;
            diag.details = { ...diag.details || {}, filename: hookPath };
            diag.error = msg;
            this.onDiagnostics(diag);
            throw new Error(`TranspileError: ${hookPath}: ${msg}`);
          }
        }
        diag.phase = "import";
        console.debug(`[HookLoader] Executing hook module`);
        try {
          const mod = await this.moduleLoader.executeModule(finalCode, hookPath, context, hookUrl);
          if (!mod || typeof mod.default !== "function") {
            throw new Error("Hook module does not export a default function");
          }
          diag.phase = "exec";
          console.debug(`[HookLoader] Calling hook function`);
          const element = await mod.default(context);
          console.debug(`[HookLoader] Hook executed successfully`);
          return element;
        } catch (execErr) {
          console.error("[HookLoader] Hook execution error:", execErr);
          throw execErr;
        }
      } catch (err) {
        diag.error = err instanceof Error ? err.message : String(err);
        diag.stack = err instanceof Error ? err.stack : void 0;
        console.error("[HookLoader] Error during loadAndExecuteHook:", diag);
        this.onDiagnostics(diag);
        throw err;
      }
    }
    /**
     * Clear module cache (useful for hot reload or cleanup)
     */
    clearCache() {
      this.moduleCache.clear();
    }
  };

  // ../../../themed-styler/dist/index.android.js
  async function initAndroidThemedStyler(opts) {
    const g = globalThis;
    if (g.__themedStylerRenderCss && g.__themedStylerGetRn) {
      console.debug("[themed-styler-android] Already initialized");
      return;
    }
    if (!g.__themedStylerNative) {
      console.warn("[themed-styler-android] Native binding not available - using stubs");
      g.__themedStylerRenderCss = opts?.onRenderCss || ((usage2, themes2) => "");
      g.__themedStylerGetRn = opts?.onGetRnStyles || ((themeName) => ({}));
      g.__themedStylerGetVersion = () => "native-stub";
      return;
    }
    g.__themedStylerRenderCss = (usage2, themes2) => {
      try {
        const result = g.__themedStylerNative.renderCss(JSON.stringify(usage2), JSON.stringify(themes2));
        return result || "";
      } catch (e) {
        console.error("[themed-styler-android] renderCss failed:", e);
        return opts?.onRenderCss ? opts.onRenderCss(usage2, themes2) : "";
      }
    };
    g.__themedStylerGetRn = (themeName) => {
      try {
        const result = g.__themedStylerNative.getRnStyles(themeName);
        return JSON.parse(result || "{}");
      } catch (e) {
        console.error("[themed-styler-android] getRnStyles failed:", e);
        return opts?.onGetRnStyles ? opts.onGetRnStyles(themeName) : {};
      }
    };
    g.__themedStylerGetVersion = () => {
      try {
        return g.__themedStylerNative.getVersion?.() || "native";
      } catch (e) {
        return "native-error";
      }
    };
    console.log("[themed-styler-android] Initialized with native binding:", g.__themedStylerGetVersion?.());
  }
  function createAndroidTheme(definitions) {
    const theme = { ...definitions };
    return {
      getStyle: (name) => theme[name] || {},
      getColor: (name) => theme[name],
      getRenderCss: () => globalThis.__themedStylerRenderCss?.(theme, {})
    };
  }

  // ../../dist/components/android/HookRenderer.js
  var import_jsx_runtime = __require("react/jsx-runtime");
  var import_react = __toESM(__require("react"), 1);
  function normalizeHostUrl(host) {
    if (!host)
      return "";
    if (host.startsWith("http://") || host.startsWith("https://"))
      return host;
    if (host.includes(":"))
      return `http://${host}`;
    return `https://${host}`;
  }
  function getMimeType(path) {
    const ext = path.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "md":
      case "markdown":
        return "text/markdown";
      case "json":
        return "application/json";
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "gif":
        return "image/gif";
      case "txt":
        return "text/plain";
      default:
        return "text/plain";
    }
  }
  var FileRenderer = ({ content, contentType, onElement }) => {
    (0, import_react.useEffect)(() => {
      if (onElement) {
        const lower2 = (contentType || "").toLowerCase();
        if (lower2.startsWith("image/")) {
          onElement("image", { width: "match_parent", height: "wrap_content" });
        } else {
          onElement("text", {});
        }
      }
    }, [onElement, contentType]);
    const lower = (contentType || "").toLowerCase();
    if (lower.startsWith("image/")) {
      return (0, import_jsx_runtime.jsx)("image", { src: content, width: "match_parent", height: "wrap_content" });
    }
    if (lower.includes("markdown") || lower.includes("md")) {
      return (0, import_jsx_runtime.jsx)("scroll", { width: "match_parent", height: "match_parent", children: (0, import_jsx_runtime.jsx)("text", { padding: "16", children: content }) });
    }
    if (lower.includes("json")) {
      let pretty = content;
      try {
        pretty = JSON.stringify(JSON.parse(content), null, 2);
      } catch (e) {
      }
      return (0, import_jsx_runtime.jsx)("scroll", { width: "match_parent", height: "match_parent", children: (0, import_jsx_runtime.jsx)("text", { padding: "16", children: pretty }) });
    }
    return (0, import_jsx_runtime.jsx)("scroll", { width: "match_parent", height: "match_parent", children: (0, import_jsx_runtime.jsx)("text", { padding: "16", children: content }) });
  };
  var HookRenderer = ({ host, hookPath, onElement, requestRender, startAutoSync, stopAutoSync, registerTheme: registerTheme2, loadThemesFromYamlUrl, onError, onReady, onLoading }) => {
    const [loading, setLoading] = (0, import_react.useState)(false);
    const [error, setError] = (0, import_react.useState)(null);
    const [element, setElement] = (0, import_react.useState)(null);
    const normalizedHost = (0, import_react.useMemo)(() => normalizeHostUrl(host), [host]);
    const loaderRef = (0, import_react.useRef)(null);
    (0, import_react.useEffect)(() => {
      if (!host)
        return;
      const protocol = normalizedHost.startsWith("https://") ? "https" : "http";
      const hostOnly = normalizedHost.replace(/^https?:\/\//, "");
      const loader = new AndroidModuleLoader({
        host: hostOnly,
        transpiler: (code, filename) => transpileCode(code, { filename })
      });
      loaderRef.current = new HookLoader({
        host: hostOnly,
        protocol,
        moduleLoader: loader
      });
      if (startAutoSync) {
        try {
          startAutoSync();
        } catch (e) {
        }
      }
      return () => {
        if (stopAutoSync) {
          try {
            stopAutoSync();
          } catch (e) {
          }
        }
      };
    }, [normalizedHost, host, startAutoSync, stopAutoSync]);
    const registerUsageFromElement = (0, import_react.useCallback)((tag, props) => {
      if (onElement) {
        try {
          onElement(tag, props);
          if (requestRender)
            requestRender();
        } catch (e) {
        }
      }
    }, [onElement, requestRender]);
    const createHookContext = (0, import_react.useCallback)((baseHookPath) => {
      const buildPeer = (p) => `${normalizedHost}${p.startsWith("/") ? p : "/" + p}`;
      const FileRendererAdapter = ({ path }) => {
        const [content, setContent] = (0, import_react.useState)("");
        const [contentType, setContentType] = (0, import_react.useState)("text/plain");
        const [fileLoading, setFileLoading] = (0, import_react.useState)(true);
        (0, import_react.useEffect)(() => {
          let cancelled = false;
          (async () => {
            try {
              const url = `${normalizedHost}${path.startsWith("/") ? path : "/" + path}`;
              const resp = await fetch(url);
              const txt = await resp.text();
              if (!cancelled) {
                setContent(txt);
                const ct = resp.headers.get("content-type") || getMimeType(path);
                setContentType(ct);
              }
            } catch (e) {
              if (!cancelled) {
                setContent(`Error loading file: ${path}`);
                setContentType("text/plain");
              }
            } finally {
              if (!cancelled)
                setFileLoading(false);
            }
          })();
          return () => {
            cancelled = true;
          };
        }, [path]);
        if (fileLoading)
          return (0, import_jsx_runtime.jsx)("text", { children: "Loading file..." });
        return (0, import_jsx_runtime.jsx)(FileRenderer, { content, contentType, onElement: registerUsageFromElement });
      };
      const registerThemesFromYaml = async (path) => {
        try {
          if (loadThemesFromYamlUrl) {
            const absolute = buildPeer(path);
            await loadThemesFromYamlUrl(absolute);
          }
        } catch (e) {
        }
      };
      const wrappedReact = createHookReact(import_react.default, registerUsageFromElement);
      return {
        React: wrappedReact,
        createElement: wrappedReact.createElement,
        onElement: registerUsageFromElement,
        FileRenderer: FileRendererAdapter,
        helpers: {
          buildPeerUrl: buildPeer,
          loadModule: async (modulePath, fromPathArg) => {
            if (!loaderRef.current)
              throw new Error("loader not ready");
            const fromPath = fromPathArg || baseHookPath;
            return loaderRef.current.loadModule(modulePath, fromPath, createHookContext(fromPath));
          },
          registerThemeStyles: (name, defs) => {
            if (registerTheme2)
              registerTheme2(name, defs);
          },
          registerThemesFromYaml
        }
      };
    }, [normalizedHost, registerUsageFromElement, loadThemesFromYamlUrl, registerTheme2]);
    const tryRender = (0, import_react.useCallback)(async () => {
      setLoading(true);
      setError(null);
      setElement(null);
      if (onLoading) {
        try {
          onLoading();
        } catch {
        }
      }
      try {
        const path = hookPath || "/hooks/client/get-client.jsx";
        if (!loaderRef.current)
          throw new Error("hook loader not initialized");
        const ctx = createHookContext(path);
        const el = await loaderRef.current.loadAndExecuteHook(path, ctx);
        setElement(el);
        if (onReady) {
          try {
            onReady();
          } catch {
          }
        }
      } catch (e) {
        console.error("[HookRenderer] Android Error:", e);
        const message = e?.message || String(e);
        const stack = e?.stack || "";
        setError(stack ? `${message}

Stack:
${stack}` : message);
        if (onError) {
          try {
            onError(stack ? `${message}

Stack:
${stack}` : message);
          } catch {
          }
        }
      } finally {
        setLoading(false);
      }
    }, [createHookContext, hookPath]);
    (0, import_react.useEffect)(() => {
      void tryRender();
    }, [tryRender]);
    return (0, import_jsx_runtime.jsxs)("div", { width: "match_parent", height: "match_parent", children: [loading && (0, import_jsx_runtime.jsx)("text", { children: "Loading hook..." }), error && (0, import_jsx_runtime.jsx)("scroll", { width: "match_parent", height: "match_parent", children: (0, import_jsx_runtime.jsxs)("text", { color: "#ff0000", padding: "16", children: ["Error: ", error] }) }), !loading && !error && element && (0, import_jsx_runtime.jsx)("div", { width: "match_parent", height: "match_parent", children: element })] });
  };
  var HookRenderer_default = HookRenderer;

  // ../../dist/components/android/HookApp.js
  var import_jsx_runtime2 = __require("react/jsx-runtime");
  var import_react2 = __require("react");

  // ../../dist/themeRegistry.js
  var usage = [];
  var themes = {};
  var currentTheme = null;
  function registerUsage(tag, props) {
    usage.push({ tag, props });
  }
  function getUsageSnapshot() {
    return [...usage];
  }
  function registerTheme(name, defs) {
    themes[name] = defs || {};
  }
  function getThemePayload() {
    return { current: currentTheme, themes: { ...themes } };
  }

  // ../../dist/android/webApiShims.js
  function getEncoder() {
    if (typeof TextEncoder === "function")
      return new TextEncoder();
    throw new Error("TextEncoder is required in this runtime; provide a host polyfill");
  }
  function getDecoder() {
    if (typeof TextDecoder === "function")
      return new TextDecoder();
    throw new Error("TextDecoder is required in this runtime; provide a host polyfill");
  }
  var HeadersShim = class {
    constructor(init) {
      this.map = /* @__PURE__ */ new Map();
      if (!init)
        return;
      if (typeof init.forEach === "function") {
        init.forEach((v, k) => this.map.set(String(k).toLowerCase(), String(v)));
      } else if (Array.isArray(init)) {
        init.forEach(([k, v]) => this.map.set(String(k).toLowerCase(), String(v)));
      } else if (typeof init === "object") {
        Object.keys(init).forEach((k) => this.map.set(k.toLowerCase(), String(init[k])));
      }
    }
    get(name) {
      const v = this.map.get(String(name).toLowerCase());
      return v === void 0 ? null : v;
    }
    has(name) {
      return this.map.has(String(name).toLowerCase());
    }
    append(name, value) {
      const key = String(name).toLowerCase();
      const prev = this.map.get(key);
      this.map.set(key, prev ? `${prev}, ${value}` : value);
    }
    forEach(cb) {
      this.map.forEach((v, k) => cb(v, k));
    }
  };
  async function toUint8Array(body) {
    if (body == null)
      return new Uint8Array();
    if (typeof body === "string")
      return getEncoder().encode(body);
    if (body instanceof Uint8Array)
      return body;
    if (body instanceof ArrayBuffer)
      return new Uint8Array(body);
    if (ArrayBuffer.isView(body))
      return new Uint8Array(body.buffer);
    if (typeof body.arrayBuffer === "function")
      return new Uint8Array(await body.arrayBuffer());
    if (typeof body.getReader === "function") {
      const reader = body.getReader();
      const chunks = [];
      while (true) {
        const r = await reader.read();
        if (r.done)
          break;
        chunks.push(r.value);
      }
      return concatChunks(chunks);
    }
    if (typeof body[Symbol.asyncIterator] === "function") {
      const chunks = [];
      for await (const chunk of body) {
        chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
      }
      return concatChunks(chunks);
    }
    return getEncoder().encode(String(body));
  }
  function concatChunks(chunks) {
    const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      buf.set(c, offset);
      offset += c.byteLength;
    }
    return buf;
  }
  var ResponseShim = class {
    constructor(init) {
      this.status = typeof init.status === "number" ? init.status : 200;
      this.ok = this.status >= 200 && this.status < 300;
      this.headers = new HeadersShim(init.headers);
      this.url = init.url || "";
      this.body = init.body;
    }
    async text() {
      const u8 = await toUint8Array(this.body);
      return getDecoder().decode(u8);
    }
    async json() {
      return JSON.parse(await this.text());
    }
    async arrayBuffer() {
      const u8 = await toUint8Array(this.body);
      return u8.buffer;
    }
  };
  var RequestShim = class {
    constructor(input, init) {
      const href = typeof input === "string" ? input : input && input.url || "";
      this.url = href;
      this.method = (init?.method || input && input.method || "GET").toUpperCase();
      this.headers = new HeadersShim(init?.headers || input && input.headers);
      this.body = init?.body || input && input.body;
    }
  };
  function resolveFetchBase(fetchImpl) {
    if (fetchImpl)
      return fetchImpl;
    if (typeof globalThis.fetch === "function")
      return globalThis.fetch;
    const native = globalThis.__nativeFetch || globalThis.__fetch;
    if (typeof native === "function")
      return native;
    throw new Error("No fetch implementation available. Provide fetchImpl or set globalThis.__nativeFetch");
  }
  function createFetchShim(base) {
    return (async (input, init) => {
      const res = await base(input, init);
      if (res && typeof res.text === "function" && typeof res.arrayBuffer === "function" && "ok" in res) {
        return res;
      }
      return new ResponseShim({
        status: res?.status ?? 200,
        headers: res?.headers,
        body: res?.body ?? res?.data ?? null,
        url: res?.url
      });
    });
  }
  function installWebApiShims(options = {}) {
    const baseFetch = resolveFetchBase(options.fetchImpl);
    const shimmedFetch = createFetchShim(baseFetch);
    globalThis.fetch = shimmedFetch;
    if (typeof globalThis.URL !== "function") {
      console.warn("[hook-transpiler] URL is missing; provide a host implementation");
    }
    if (typeof globalThis.URLSearchParams !== "function") {
      console.warn("[hook-transpiler] URLSearchParams is missing; provide a host implementation");
    }
    if (typeof globalThis.setTimeout !== "function") {
      throw new Error("setTimeout is required; provide a host timer implementation");
    }
    if (typeof globalThis.setInterval !== "function") {
      console.warn("[hook-transpiler] setInterval is missing; provide a host timer implementation");
    }
    if (options.requireStreaming && !globalThis.__hook_streaming_ready) {
      console.warn("[hook-transpiler] Streaming requested but no native streaming body detected");
    }
    if (typeof globalThis.Headers !== "function") {
      ;
      globalThis.Headers = HeadersShim;
    }
    if (typeof globalThis.Response !== "function") {
      ;
      globalThis.Response = ResponseShim;
    }
    if (typeof globalThis.Request !== "function") {
      ;
      globalThis.Request = RequestShim;
    }
  }

  // ../../dist/components/android/HookApp.js
  var DEFAULT_HOST = "http://localhost:8002";
  var DEFAULT_HOOK = "/hooks/client/get-client.jsx";
  var HookApp = ({ host = DEFAULT_HOST, hookPath = DEFAULT_HOOK, onStatus, fetchImpl, requireStreaming, ...rest }) => {
    const [status, setStatus] = (0, import_react2.useState)({ loading: true, error: null, hookPath });
    const handleStatus = (0, import_react2.useCallback)((next) => {
      setStatus(next);
      if (onStatus)
        onStatus(next);
    }, [onStatus]);
    try {
      installWebApiShims({ fetchImpl, requireStreaming });
    } catch {
    }
    const onElement = (0, import_react2.useCallback)((tag, props) => {
      registerUsage(tag, props);
      if (rest.onElement)
        rest.onElement(tag, props);
    }, [rest]);
    const registerThemeStyles = (0, import_react2.useCallback)((name, defs) => {
      registerTheme(name, defs);
      if (rest.registerTheme)
        rest.registerTheme(name, defs);
    }, [rest]);
    const hookRendererProps = (0, import_react2.useMemo)(() => ({
      host,
      hookPath,
      onElement,
      registerTheme: registerThemeStyles,
      ...rest
    }), [host, hookPath, onElement, registerThemeStyles, rest]);
    const handleLoading = (0, import_react2.useCallback)(() => handleStatus({ loading: true, error: null, hookPath }), [handleStatus, hookPath]);
    const handleError = (0, import_react2.useCallback)((err) => handleStatus({ loading: false, error: err, hookPath }), [handleStatus, hookPath]);
    const handleReady = (0, import_react2.useCallback)(() => handleStatus({ loading: false, error: null, hookPath }), [handleStatus, hookPath]);
    return (0, import_jsx_runtime2.jsx)(HookRenderer_default, { ...hookRendererProps, onElement, registerTheme: registerThemeStyles, onError: (msg) => handleError(msg || null), onLoading: handleLoading, onReady: () => {
      handleReady();
      getUsageSnapshot();
      getThemePayload();
    } });
  };

  // <stdin>
  globalThis.HookTranspilerAndroid = {
    HookRenderer,
    HookApp,
    transpileCode,
    installWebApiShims,
    initAndroidThemedStyler,
    createAndroidTheme
  };
})();
