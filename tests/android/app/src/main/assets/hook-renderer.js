/**
 * Hook Renderer with status UI and renderer switcher.
 * Relies on act-android.bundle.js having already installed global Act.
 */

(function () {
  const g = typeof globalThis !== 'undefined' ? globalThis : (typeof global !== 'undefined' ? global : {});
  const Act = g.Act || null;
  if (!Act) {
    throw new Error('Act runtime not available. Ensure act-android.bundle.js is loaded first.');
  }

  const { createElement: h, useState, useEffect, useMemo } = Act;

  const MODE_OPTIONS = [
    { key: 'react', label: 'React' },
    { key: 'react-native', label: 'React Native' },
    { key: 'act', label: 'Act / Android' }
  ];

  const STATUS_LABEL = {
    loading: 'Loading hook…',
    rendered: 'Rendered',
    error: 'Rendering Failed'
  };

  const STATUS_CLASS = {
    loading: 'text-blue-500',
    rendered: 'text-green-500',
    error: 'text-red-500'
  };

  function SectionTitle(text) {
    return h('text', { text, className: 'text-lg m-1' });
  }

  function StatusRow(status, hookName) {
    const cls = STATUS_CLASS[status] || 'text-blue-500';
    const label = STATUS_LABEL[status] || 'Loading hook…';
    return h('view', { className: 'm-1' }, [
      h('text', { text: hookName ? `Hook: ${hookName}` : 'Hook Renderer', className: 'text-sm text-gray' }),
      h('text', { text: `Status: ${label}`, className: cls })
    ]);
  }

  function VersionRow(versions) {
    if (!versions || typeof versions !== 'object') return null;
    const transpiler = versions.transpiler ? `Transpiler v${versions.transpiler}` : 'Transpiler version: unknown';
    const styler = versions.styler ? `Styler v${versions.styler}` : 'Styler version: unknown';
    return h('view', { className: 'm-1' }, [
      h('text', { text: transpiler, className: 'text-sm text-gray' }),
      h('text', { text: styler, className: 'text-sm text-gray' })
    ]);
  }

  function ErrorPanel(err) {
    if (!err) return null;
    const message = err.message || String(err);
    const stack = err.stack || 'No stack available';
    return h('view', { className: 'bg-gray-200 p-2 m-1' }, [
      h('text', { text: 'Rendering Failed', className: 'text-red-500 text-lg' }),
      h('text', { text: message, className: 'text-sm text-gray' }),
      h('text', { text: 'Stack:', className: 'text-sm text-gray m-1' }),
      h('text', { text: stack, className: 'text-sm text-gray' })
    ]);
  }

  function ModeSwitch(mode, onChange) {
    return h('view', { className: 'm-1' }, MODE_OPTIONS.map(({ key, label }) => {
      const active = mode === key;
      const btnClass = active ? 'p-2 bg-blue-500 text-white m-1' : 'p-2 bg-gray-200 text-black m-1';
      return h('button', { text: active ? `${label} (active)` : label, className: btnClass, onClick: () => onChange(key) });
    }));
  }

  function HookShell({ Component, hookProps, hookName, initialMode, versions }) {
    const [mode, setMode] = useState(initialMode || (g.__runtime && g.__runtime.mode) || 'react');
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState(null);

    const stableProps = useMemo(() => hookProps || {}, [JSON.stringify(hookProps || {})]);

    useEffect(() => {
      setStatus('loading');
    }, [mode, stableProps, Component]);

    useEffect(() => {
      g.__runtime = g.__runtime || {};
      g.__runtime.mode = mode;
    }, [mode]);

    const outcome = useMemo(() => {
      console.log('[HookShell] outcome useMemo: Component type=' + typeof Component + ', Component=' + (Component && Component.name ? Component.name : '?'));
      try {
        if (!Component) {
          console.log('[HookShell] No Component provided');
          return { node: null, error: null };
        }
        // Component should be a React component (function)
        // Call it directly with props
        const node = h(Component, Object.assign({}, stableProps, { runtimeMode: mode }));
        console.log('[HookShell] Created node from Component:', node ? 'success' : 'null');
        return { node, error: null };
      } catch (err) {
        console.error('[HookShell] Error creating node:', err.message);
        return { node: null, error: err };
      }
    }, [Component, stableProps, mode]);

    useEffect(() => {
      if (outcome.error) {
        setError(outcome.error);
        setStatus('error');
        console.log('[HookShell] Status: error, Component type:', typeof Component);
      } else {
        setError(null);
        const newStatus = Component ? 'rendered' : 'loading';
        setStatus(newStatus);
        console.log('[HookShell] Status: ' + newStatus + ', Component type: ' + typeof Component + ', outcome.node exists: ' + (outcome.node !== null));
      }
    }, [outcome, Component]);

    const contentNode = outcome.node || h('text', { text: 'No hook content returned', className: 'text-sm text-gray' });

    console.log('[HookShell] render: status=' + status + ', hasError=' + (error !== null) + ', hasContentNode=' + (contentNode !== null) + ', contentNode type=' + (contentNode && contentNode.type ? contentNode.type : '?'));

    return h('scroll', { width: 'match_parent', height: 'match_parent', className: 'bg-gray-100' }, [
      h('view', { className: 'bg-white p-2 m-1' }, [
        SectionTitle('Hook Renderer'),
        StatusRow(status, hookName),
        VersionRow(versions)
      ]),
      h('view', { className: 'bg-white p-2 m-1' }, [
        error ? ErrorPanel(error) : h('view', { className: 'p-1' }, [contentNode])
      ]),
      h('view', { className: 'bg-white p-2 m-1' }, [
        SectionTitle('Renderer Mode'),
        h('text', { text: 'Choose how to render this hook:', className: 'text-sm text-gray' }),
        ModeSwitch(mode, setMode)
      ])
    ]);
  }

  function normalizeOptions(options) {
    if (!options || Array.isArray(options)) return { hookProps: {} };
    const looksLikePropsOnly = !options.hookName && !options.hookProps && !options.initialMode && !options.rendererMode && !options.versions && !options.props && !options.componentProps;
    if (looksLikePropsOnly) {
      return { hookProps: options };
    }
    return {
      hookProps: options.hookProps || options.props || options.componentProps || {},
      hookName: options.hookName || options.name || 'Hook',
      initialMode: options.initialMode || options.rendererMode || (g.__runtime && g.__runtime.mode) || 'act',
      versions: options.versions || g.__versions || {}
    };
  }

  const HookRenderer = {
    render(Component, options = {}) {
      const normalized = normalizeOptions(options);
      console.log('[HookRenderer] render() called with Component type: ' + typeof Component + ', options:', JSON.stringify(options));
      if (typeof g.nativeBridge === 'undefined' && typeof g.bridge !== 'undefined') {
        g.nativeBridge = g.bridge;
      }

      console.log('[HookRenderer] About to call Act.render with RenderHost');
      const actRenderResult = Act.render(function RenderHost() {
        console.log('[HookRenderer] RenderHost executing, Component type: ' + typeof Component + ', Component name: ' + (Component && Component.name ? Component.name : '?'));
        const result = HookShell({
          Component,
          hookProps: normalized.hookProps,
          hookName: normalized.hookName,
          initialMode: normalized.initialMode,
          versions: normalized.versions
        });
        console.log('[HookRenderer] HookShell returned:', result ? 'element' : 'null');
        return result;
      });
      console.log('[HookRenderer] Act.render completed, result:', actRenderResult ? 'success' : 'null');
      return actRenderResult;
    }
  };

  const ns = g.HookTranspilerAndroid || (g.HookTranspilerAndroid = {});
  ns.HookRenderer = HookRenderer;

  if (typeof module !== 'undefined') {
    module.exports = HookRenderer;
  }
})();
