import React from 'react';
import { createRoot } from 'react-dom/client';
import { initTranspiler, HookRenderer } from '@clevertree/hook-transpiler';
import { unifiedBridge, styleManager } from '@clevertree/themed-styler';

async function main() {
  const wasmEl = document.getElementById('wasm-state');
  try {
    console.log('Test App: Starting...');
    wasmEl.textContent = 'Starting...';
    
    // 1. Initialize Hook Transpiler WASM
    console.log('Test App: Initializing transpiler...');
    wasmEl.textContent = 'Initializing WASM...';
    await initTranspiler();
    const version = globalThis.__hook_transpiler_version || 'unknown';
    console.log('Test App: Transpiler ready:', version);
    
    // Test a simple transpilation to confirm it works
    const testResult = globalThis.__hook_transpile_jsx('<div>Test</div>', 'test.jsx');
    console.log('Test App: Test transpilation result:', testResult);
    
    wasmEl.textContent = `Ready (v${version})`;
    
    // 2. Themed Styler state
    document.getElementById('styler-state').textContent = 'Ready';

    // 3. Render the HookRenderer component
    const root = createRoot(document.getElementById('root'));
    root.render(
      React.createElement(React.StrictMode, null, 
        React.createElement(HookRenderer, {
          host: window.location.origin,
          hookPath: '/hooks/test-hook.jsx',
          // Inject themed-styler integration via props
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
        })
      )
    );
  } catch (err) {
    console.error('Test App Error:', err);
    document.getElementById('root').innerHTML = `<div style="color: red; padding: 2rem;">
        <h2>Bootstrap Error</h2>
        <pre>${err.message}\n${err.stack}</pre>
    </div>`;
  }
}

main();
