import React, { useState, useEffect } from 'react';
import { setCurrentTheme, getThemes } from '@clevertree/themed-styler';

import UseStateTest from './tests/useState-test.jsx';
import UseEffectTest from './tests/useEffect-test.jsx';
import StylingTest from './tests/styling-test.jsx';
import ArrayTest from './tests/array-test.jsx';
import DynamicImportTest from './tests/dynamic-import-test.jsx';
import RemoteFetchTest from './tests/remote-fetch-test.jsx';
import EventsTest from './tests/events-test.jsx';
import TemplateLiteralsTest from './tests/template-literals-test.jsx';
import MarkdownTest from './tests/markdown-test.jsx';

const TABS = [
  { id: 'state', label: 'useState', component: UseStateTest },
  { id: 'effect', label: 'useEffect', component: UseEffectTest },
  { id: 'styling', label: 'Styling', component: StylingTest },
  { id: 'array', label: '.map()', component: ArrayTest },
  { id: 'lazy', label: 'Lazy Load', component: DynamicImportTest },
  { id: 'fetch', label: 'Fetch', component: RemoteFetchTest },
  { id: 'events', label: 'Events', component: EventsTest },
  { id: 'template', label: 'Templates', component: TemplateLiteralsTest },
  { id: 'markdown', label: 'Markdown-NEW', component: MarkdownTest },
];

export default function TestSuite() {
  const [activeTab, setActiveTab] = useState('markdown');
  const [themeState, setThemeState] = useState(() => getThemes());
  const [renderError, setRenderError] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const currentTheme = themeState.currentTheme || 'light';

  const handleThemeChange = (theme) => {
    setCurrentTheme(theme);
    setThemeState(getThemes());
  };

  const resetState = () => {
    console.log('[TestSuite] Resetting state...');
    setResetKey(prev => prev + 1);
    setRenderError(null);
  };

  const selectedTab = TABS.find(t => t.id === activeTab);
  const ActiveComponent = selectedTab?.component;

  console.log('[TestSuite] Rendering activeTab:', activeTab, 'resetKey:', resetKey);
  console.log('[TestSuite] ActiveComponent:', selectedTab?.label || 'NOT_FOUND');

  const themeOptions = Object.keys(themeState.themes || {}).filter(t => t !== 'default');

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header & Tabs & Theme Switcher */}
      <div className="bg-bg border-b border-themed flex flex-col px-2 pb-2">
        <div className="flex flex-row items-center justify-between py-2">
          <div className="flex flex-row bg-surface rounded-lg p-0.5">
            {themeOptions.length > 0 ? themeOptions.map(theme => (
              <button
                key={theme}
                onClick={() => handleThemeChange(theme)}
                className={`px-2 py-1 rounded-md text-[10px] uppercase tracking-wider ${currentTheme === theme ? 'bg-bg shadow-sm font-bold text-themed' : 'text-muted'}`}
              >
                {theme}
              </button>
            )) : (
              <div className="px-2 py-1 text-[10px] text-muted">No Themes</div>
            )}
          </div>

          <button
            onClick={resetState}
            className="px-3 py-1 bg-surface border border-themed rounded text-[10px] uppercase tracking-wider text-muted hover:text-themed"
          >
            Reset State
          </button>
        </div>

        <div className="flex flex-row overflow-x-auto py-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                console.log('[TestSuite] Tab clicked:', tab.id);
                setRenderError(null);
                setActiveTab(tab.id);
              }}
              className={`px-3 py-1.5 mx-1 whitespace-nowrap rounded-full text-xs transition-colors ${activeTab === tab.id
                ? 'bg-primary text-white font-medium'
                : 'text-muted hover:bg-surface'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {renderError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
          <p className="font-bold">Render Error</p>
          <p className="text-sm">{renderError}</p>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 p-4 overflow-y-auto">
        {!ActiveComponent || typeof ActiveComponent !== 'function' ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
            <p className="font-bold">Error: Invalid component</p>
            <p className="text-sm">activeTab={activeTab}, component type={typeof ActiveComponent}</p>
          </div>
        ) : (
          <ActiveComponent key={`${activeTab}-${resetKey}`} />
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 text-center">
        <p className="text-xs text-muted">
          Transpiler v1.3.20 • Styler v1.2.8 • JSCBridge v1.0.0
        </p>
      </div>
    </div>
  );
}
