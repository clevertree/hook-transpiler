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
    console.warn('Test App: root container not found');
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
      <div>
        <h2>Local Hook Test</h2>
        <HookRenderer {...props} />
      </div>
    </React.StrictMode>
  );
}

function HookRendererWithErrorBoundary({ rendererProps }) {
  const [error, setError] = React.useState(null);
  const [renderAttempts, setRenderAttempts] = React.useState(0);

  React.useEffect(() => {
    setRenderAttempts(prev => prev + 1);
    console.log('[UrlHookTester] Rendering attempt #' + renderAttempts, { rendererProps });
  }, [rendererProps.host, rendererProps.hookPath, renderAttempts]);

  if (error) {
    return (
      <div style={{ padding: '1rem', background: '#fee', border: '2px solid red', borderRadius: '4px', color: '#c00' }}>
        <h3>❌ Hook Rendering Failed</h3>
        <p><strong>Error:</strong> {error.message}</p>
        <details style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
          <summary>Stack trace</summary>
          <pre style={{ background: '#f5f5f5', padding: '0.5rem', overflow: 'auto', maxHeight: '200px' }}>
            {error.stack}
          </pre>
        </details>
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
          Host: <code>{rendererProps.host}</code><br/>
          Path: <code>{rendererProps.hookPath || '(OPTIONS discovery)'}</code>
        </p>
      </div>
    );
  }

  return (
    <React.Suspense fallback={<div style={{ padding: '1rem', color: '#666' }}>Loading hook...</div>}>
      <HookRenderer 
        {...rendererProps}
        onError={setError}
      />
    </React.Suspense>
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
    console.log('[UrlHookTester] Form submitted', { nextHost, trimmedPath });
    setActiveHost(nextHost);
    // Allow blank path to trigger OPTIONS discovery in HookRenderer
    setActivePath(trimmedPath === '' ? undefined : trimmedPath || defaultPath);
  };

  const rendererProps = React.useMemo(() => {
    const resolvedHost = (activeHost || defaultHost || '').trim() || defaultHost;
    const resolvedPath = activePath === undefined ? undefined : (activePath || defaultPath);
    console.log('[UrlHookTester] Renderer props updated', { resolvedHost, resolvedPath });
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
        <HookRendererWithErrorBoundary rendererProps={rendererProps} />
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

    // Update Styler state
    const stylerState = document.getElementById('styler-state');
    if (stylerState) {
      stylerState.textContent = 'Ready';
    }

    // Start auto-sync for styles
    styleManager.startAutoSync();

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

    // 3. Render pages based on available containers
    const isUrlTesterPage = window.location.pathname.includes('url-tester');
    console.log('Test App: Page type:', isUrlTesterPage ? 'URL Tester' : 'Default Local');
    
    renderDefaultHookRenderer();
    renderUrlTesterPage();

    // 4. Expose loader for e2e testing (wait a bit for HookRenderer to initialize)
    setTimeout(() => {
      if (window.__currentLoader) {
        console.log('Test App: Loader exposed for e2e tests');
      }
    }, 1000);

    // 5. Add e2e status indicator for tests
    const statusEl = document.createElement('div');
    statusEl.id = 'e2e-status';
    statusEl.textContent = 'static-imports-ok';
    statusEl.style.display = 'none';
    document.body.appendChild(statusEl);

    // 6. Debug: Check if containers rendered successfully
    const remoteRoot = document.getElementById('remote-root');
    const root = document.getElementById('root');
    console.log('[Test App] Container check:', {
      'remote-root': remoteRoot ? remoteRoot.childNodes.length + ' children' : 'NOT FOUND',
      'root': root ? root.childNodes.length + ' children' : 'NOT FOUND',
      urlTesterPage: isUrlTesterPage
    });

    if (isUrlTesterPage && remoteRoot && remoteRoot.textContent === 'Loading remote hook tester...') {
      console.warn('[Test App] WARNING: remote-root still has loading text - renderUrlTesterPage may have failed');
    }

    console.log('Test App: Render calls finished');
  } catch (err) {
    console.error('Test App Error:', err);
    const fallbackContainer = document.getElementById('root') || document.getElementById('remote-root');
    if (fallbackContainer) {
      fallbackContainer.innerHTML = `<div style="color: red; padding: 2rem;">
        <h2>Bootstrap Error</h2>
        <p>${err.message}</p>
        <pre style="background: #f5f5f5; padding: 1rem; overflow: auto; font-size: 0.9rem;">${err.stack}</pre>
    </div>`;
    }
  }
}

main();
