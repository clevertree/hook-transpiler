import React from 'react';
import { createRoot } from 'react-dom/client';
import { initTranspiler, HookRenderer, transpileCode } from '@clevertree/hook-transpiler';
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
    
    wasmEl.textContent = `Ready (v${version})`;
    
    // Test direct transpilation
    try {
        console.log('Test App: Testing direct transpilation');
        const code = 'const Test = () => <div>Hello</div>';
        const res = await transpileCode(code, { filename: 'test.jsx' });
        console.log('Test App: Transpilation test success, length:', res.length);
    } catch (e) {
        console.error('Test App: Transpilation test failed:', e);
    }
    
    // 2. Themed Styler state
    document.getElementById('styler-state').textContent = 'Ready';

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
