import React, { useState, useCallback } from 'react';

/**
 * DebugHook - A test component demonstrating debugger breakpoint functionality
 * This hook includes a 'debugger' statement that will trigger breakpoints in dev tools
 * when debug mode is enabled or when DevTools is open.
 */
export function useDebugHook(initialValue = '') {
  const [value, setValue] = useState(initialValue);

  // Debugger breakpoint - triggers when DevTools is open or debug mode enabled
  debugger;

  const handleChange = useCallback((newValue) => {
    // Another breakpoint - useful for tracing input changes
    debugger;
    setValue(newValue);
  }, []);

  return { value, setValue: handleChange };
}

/**
 * DebugComponent - Component that uses the debug hook
 * Shows how breakpoints flow through component lifecycle
 */
export default function DebugComponent() {
  const { value, setValue } = useDebugHook('Enter text...');

  // Breakpoint at render
  debugger;

  return (
    <div className="debug-container">
      <h2>Debug Hook Test</h2>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          // Inline breakpoint in event handler
          debugger;
          setValue(e.target.value);
        }}
        placeholder="Type something..."
      />
      <div className="output">
        <p>Current value: {value}</p>
        <p className="debug-note">
          Open DevTools (F12) to hit these debugger breakpoints
        </p>
      </div>
    </div>
  );
}

// Standalone debug function
export function debugTransformTest() {
  debugger; // Entry point breakpoint

  const testData = {
    name: 'Debug Test',
    timestamp: new Date().toISOString(),
    nested: {
      level2: {
        value: 'deep'
      }
    }
  };

  debugger; // Mid-function breakpoint

  return testData;
}
