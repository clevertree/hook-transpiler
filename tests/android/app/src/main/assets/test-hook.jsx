import React, { useState, useEffect } from 'react';
import { setCurrentTheme, getThemes } from '@clevertree/themed-styler';

import UseStateTest from './tests/useState-test.jsx';
import UseEffectTest from './tests/useEffect-test.jsx';
import StylingTest from './tests/styling-test.jsx';
import ArrayTest from './tests/array-test.jsx';
import DynamicImportTest from './tests/dynamic-import-test.jsx';
import RemoteFetchTest from './tests/remote-fetch-test.jsx';

const TABS = [
  { id: 'state', label: 'useState', component: UseStateTest },
  { id: 'effect', label: 'useEffect', component: UseEffectTest },
  { id: 'styling', label: 'Styling', component: StylingTest },
  { id: 'array', label: '.map()', component: ArrayTest },
  { id: 'lazy', label: 'Lazy Load', component: DynamicImportTest },
  { id: 'fetch', label: 'Fetch', component: RemoteFetchTest },
];

export default function TestSuite() {
  const [activeTab, setActiveTab] = useState('state');
  const [themeState, setThemeState] = useState(() => getThemes());
  const currentTheme = themeState.currentTheme || 'light';

  const handleThemeChange = (theme) => {
    setCurrentTheme(theme);
    setThemeState(getThemes());
  };

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component || (() => null);
  const themeOptions = Object.keys(themeState.themes || {}).filter(t => t !== 'default');

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header & Theme Switcher */}
      <div className="p-4 bg-bg border-b border-themed flex flex-row justify-between items-center">
        <h1 className="text-xl font-bold text-themed">Relay Hook Test</h1>
        <div className="flex flex-row bg-surface rounded-lg p-1">
          {themeOptions.map(theme => (
            <button
              key={theme}
              onClick={() => handleThemeChange(theme)}
              className={`px-3 py-1 rounded-md text-sm capitalize ${currentTheme === theme ? 'bg-bg shadow-sm font-bold text-themed' : 'text-muted'}`}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>

      {/* Horizontal Tab View */}
      <div className="bg-bg border-b border-themed">
        <div className="flex flex-row overflow-x-auto px-2 py-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 mx-1 whitespace-nowrap rounded-full text-sm transition-colors ${activeTab === tab.id
                ? 'bg-primary text-white font-medium'
                : 'text-muted hover:bg-surface'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4">
        <div className="bg-bg rounded-xl shadow-sm border-themed p-4 min-h-[300px]">
          <ActiveComponent />
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 text-center">
        <p className="text-xs text-muted">
          Transpiler v1.3.20 • Styler v1.2.7 • JSCBridge v1.0.0
        </p>
      </div>
    </div>
  );
}
