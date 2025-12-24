import React from 'react';
import { createRoot } from 'react-dom/client';
import { initTranspiler, HookRenderer, transpileCode } from '@clevertree/hook-transpiler';
import { unifiedBridge, styleManager, initThemedStyler, ensureDefaultsLoaded } from '@clevertree/themed-styler';

const defaultRemoteUrl = new URL('https://clevertree.github.io/relay-template/hooks/client/get-client.jsx');
const defaultRemoteHost = `${defaultRemoteUrl.protocol}//${defaultRemoteUrl.host}`;
const defaultRemotePath = defaultRemoteUrl.pathname;

function buildHookRendererProps(host, hookPath) {
  return {
    host,
    hookPath,
    onElement: (tag, props) => unifiedBridge.registerUsage(tag, props),
    requestRender: () => styleManager.requestRender(),
    renderCssIntoDom: () => styleManager.renderCssIntoDom(),
    startAutoSync: (interval) => styleManager.startAutoSync(interval),
    stopAutoSync: () => styleManager.stopAutoSync(),
    registerTheme: (name, defs) => unifiedBridge.registerTheme(name, defs),
    loadThemesFromYamlUrl: (url) => unifiedBridge.loadThemesFromYamlUrl(url)
  };
}

function renderDefaultHookRenderer() {
  const container = document.getElementById('root');
  if (!container) {
    return;
  }

  console.log('Test App: Rendering default HookRenderer...');
  console.log('React version:', React.version);
  if (!React.useState) {
    console.error('React.useState is MISSING!');
    throw new Error('React.useState is missing');
  }

  const root = createRoot(container);
  const props = buildHookRendererProps(window.location.origin, '/hooks/test-hook.jsx');
  console.log('Test App: Default HookRenderer props:', props);

  root.render(
    <React.StrictMode>
      <HookRenderer {...props} />
    </React.StrictMode>
  );
}

function UrlHookTester({ defaultHost, defaultPath }) {
  const [host, setHost] = React.useState(defaultHost);
  const [hookPath, setHookPath] = React.useState(defaultPath);
  const [activeHost, setActiveHost] = React.useState(defaultHost);
  const [activePath, setActivePath] = React.useState(defaultPath);

  const onSubmit = (event) => {
    event.preventDefault();
    const nextHost = host.trim() || defaultHost;
    const trimmedPath = hookPath.trim();
    setActiveHost(nextHost);
    // Allow blank path to trigger OPTIONS discovery in HookRenderer
    setActivePath(trimmedPath === '' ? undefined : trimmedPath || defaultPath);
  };

  const rendererProps = React.useMemo(() => {
    const resolvedHost = (activeHost || defaultHost || '').trim() || defaultHost;
    const resolvedPath = activePath === undefined ? undefined : (activePath || defaultPath);
    return buildHookRendererProps(resolvedHost, resolvedPath);
  }, [activeHost, activePath, defaultHost, defaultPath]);

  const effectiveUrl = rendererProps.hookPath ? `${rendererProps.host}${rendererProps.hookPath}` : `${rendererProps.host} (OPTIONS discovery)`;

  return (
    <div className="url-tester">
      <form className="url-form" onSubmit={onSubmit}>
        <label>
          Host
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="https://example.com"
          />
        </label>
        <label>
          Path
          <input
            type="text"
            value={hookPath}
            onChange={(e) => setHookPath(e.target.value)}
            placeholder="/hooks/client/get-client.jsx"
          />
        </label>
        <button type="submit">Load Hook</button>
      </form>

      <div className="url-preview">
        <span>Active URL:</span>
        <span className="url-value">{effectiveUrl}</span>
      </div>

      <div className="renderer-container">
        <HookRenderer {...rendererProps} />
      </div>
    </div>
  );
}

function renderUrlTesterPage() {
  const container = document.getElementById('remote-root');
  if (!container) {
    return;
  }

  console.log('Test App: Rendering remote URL HookRenderer tester...');
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <UrlHookTester defaultHost={defaultRemoteHost} defaultPath={defaultRemotePath} />
    </React.StrictMode>
  );
}

async function main() {
  const wasmEl = document.getElementById('wasm-state');
  try {
    console.log('Test App: Starting...');
    if (wasmEl) {
      wasmEl.textContent = 'Starting...';
    }

    // 1. Initialize WASMs
    console.log('Test App: Initializing WASMs...');
    if (wasmEl) {
      wasmEl.textContent = 'Initializing WASMs...';
    }

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

    if (wasmEl) {
      wasmEl.textContent = `Ready (Transpiler: v${version}, Styler: v${stylerVersion})`;
    }

    // 2. Themed Styler state
    const stylerState = document.getElementById('styler-state');
    if (stylerState) {
      stylerState.textContent = 'Ready';
    }

    // Start auto-sync for styles
    styleManager.startAutoSync();

    // 3. Render pages based on available containers
    renderDefaultHookRenderer();
    renderUrlTesterPage();

    // Expose loader for e2e testing (wait a bit for HookRenderer to initialize)
    setTimeout(() => {
      if (window.__currentLoader) {
        console.log('Test App: Loader exposed for e2e tests');
      }
    }, 1000);

    // Add e2e status indicator for tests
    const statusEl = document.createElement('div');
    statusEl.id = 'e2e-status';
    statusEl.textContent = 'static-imports-ok';
    statusEl.style.display = 'none';
    document.body.appendChild(statusEl);

    console.log('Test App: Render calls finished');
  } catch (err) {
    console.error('Test App Error:', err);
    const fallbackContainer = document.getElementById('root') || document.getElementById('remote-root');
    if (fallbackContainer) {
      fallbackContainer.innerHTML = `<div style="color: red; padding: 2rem;">
        <h2>Bootstrap Error</h2>
        <pre>${err.message}\n${err.stack}</pre>
    </div>`;
    }
  }
}

main();
