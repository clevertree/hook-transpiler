import React from 'react';
import { createRoot } from 'react-dom/client';
import { initTranspiler, HookRenderer, transpileCode } from '@clevertree/hook-transpiler';
import { unifiedBridge, styleManager, initThemedStyler, ensureDefaultsLoaded } from '@clevertree/themed-styler';

async function main() {
  const wasmEl = document.getElementById('wasm-state');
  try {
    console.log('Test App: Starting...');
    wasmEl.textContent = 'Starting...';

    // 1. Initialize WASMs
    console.log('Test App: Initializing WASMs...');
    wasmEl.textContent = 'Initializing WASMs...';

    await Promise.all([
      initTranspiler(),
      initThemedStyler()
    ]);

    await ensureDefaultsLoaded();

    const version = globalThis.__hook_transpiler_version || 'unknown';
    const stylerVersion = globalThis.__themedStylerVersion || 'unknown';
    console.log('Test App: WASMs ready - Transpiler:', version, 'Styler:', stylerVersion);

    // TEST: Manually transpile code with 'as' keyword to see what happens
    const testCode = 'import { x as y } from "./test.js";\nconsole.log(y);';
    console.log('TEST: Transpiling code with "as" keyword:');
    console.log('INPUT:', testCode);
    try {
      const transpiled = await transpileCode(testCode, { filename: 'test.jsx' }, false);
      console.log('OUTPUT:', transpiled);
    } catch (e) {
      console.error('TRANSPILE ERROR:', e);
    }

    wasmEl.textContent = `Ready (Transpiler: v${version}, Styler: v${stylerVersion})`;

    // 2. Themed Styler state
    document.getElementById('styler-state').textContent = 'Ready';

    // Start auto-sync for styles
    styleManager.startAutoSync();

    // 3. Render the HookRenderer component
    console.log('Test App: Rendering component...');
    console.log('React version:', React.version);
    if (!React.useState) {
      console.error('React.useState is MISSING!');
      throw new Error('React.useState is missing');
    }
    const container = document.getElementById('root');
    const root = createRoot(container);

    // Check if HookRenderer is a valid component
    console.log('Test App: HookRenderer type:', typeof HookRenderer);

    const props = {
      host: window.location.origin,
      hookPath: "/hooks/test-hook.jsx",
      onElement: (tag, props) => {
        console.log('registerUsage:', tag);
        unifiedBridge.registerUsage(tag, props);
      },
      requestRender: () => styleManager.requestRender(),
      renderCssIntoDom: () => styleManager.renderCssIntoDom(),
      startAutoSync: (interval) => styleManager.startAutoSync(interval),
      stopAutoSync: () => styleManager.stopAutoSync(),
      registerTheme: (name, defs) => unifiedBridge.registerTheme(name, defs),
      loadThemesFromYamlUrl: (url) => unifiedBridge.loadThemesFromYamlUrl(url)
    };

    console.log('Test App: HookRenderer props:', props);

    root.render(
      <React.StrictMode>
        <HookRenderer {...props} />
      </React.StrictMode>
    );

    // Add e2e status indicator for tests
    const statusEl = document.createElement('div');
    statusEl.id = 'e2e-status';
    statusEl.textContent = 'static-imports-ok';
    statusEl.style.display = 'none';
    document.body.appendChild(statusEl);

    console.log('Test App: Render called');
  } catch (err) {
    console.error('Test App Error:', err);
    document.getElementById('root').innerHTML = `<div style="color: red; padding: 2rem;">
        <h2>Bootstrap Error</h2>
        <pre>${err.message}\n${err.stack}</pre>
    </div>`;
  }
}

main();
