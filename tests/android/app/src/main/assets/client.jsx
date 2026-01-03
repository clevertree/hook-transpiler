import React, { useState, useEffect } from 'react';

// ===== useState Test =====
function UseStateTest() {
    const [count, setCount] = useState(0);
    const [text, setText] = useState('Initial');
    const [history, setHistory] = useState([]);

    return (
        <div className="test-section">
            <h2>useState Test</h2>
            <p>Tests: Basic state management, multiple state variables, state updates</p>

            <div className="test-case">
                <h3>Counter: {String(count)}</h3>
                <button onClick={() => setCount(count + 1)} className="btn">
                    Increment (+1)
                </button>
                <button onClick={() => setCount(count - 1)} className="btn">
                    Decrement (-1)
                </button>
                <button onClick={() => setCount(0)} className="btn btn-secondary">
                    Reset
                </button>
            </div>

            <div className="test-case">
                <h3>Text State: {text}</h3>
                <button onClick={() => setText('Updated!')} className="btn">
                    Update Text
                </button>
                <button onClick={() => setText('Initial')} className="btn btn-secondary">
                    Reset Text
                </button>
                <button
                    onClick={() => {
                        setText(prev => {
                            const next = prev + '✓';
                            setHistory(h => [...h, next]);
                            return next;
                        });
                    }}
                    className="btn btn-secondary"
                >
                    Append ✓ and record
                </button>

                {history.length > 0 && (
                    <div className="note">
                        <strong>History:</strong> {history.join(', ')}
                    </div>
                )}
            </div>
        </div>
    );
}

// ===== useEffect Test =====
function UseEffectTest() {
    const [count, setCount] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [cleanupCount, setCleanupCount] = useState(0);

    useEffect(() => {
        console.log('[useEffect] Component mounted');
        setMounted(true);

        return () => {
            console.log('[useEffect] Cleanup called');
            setCleanupCount(c => c + 1);
        };
    }, []);

    useEffect(() => {
        console.log('[useEffect] Count changed to:', count);
    }, [count]);

    return (
        <div className="test-section">
            <h2>useEffect Test</h2>
            <p>Tests: Mount effects, cleanup, dependency arrays, effect re-running</p>

            <div className="test-case">
                <h3>Mount Status: {mounted ? 'Mounted ✓' : 'Not Mounted'}</h3>
                <h3>Count: {String(count)}</h3>
                <h4>Cleanup calls: {String(cleanupCount)}</h4>
                <p>Check console logs for effect execution</p>
                <button onClick={() => setCount(count + 1)} className="btn">
                    Increment (triggers effect)
                </button>
            </div>
        </div>
    );
}

// ===== Events Test =====
function EventsTest() {
    const [clicks, setClicks] = useState(0);
    const [lastEvent, setLastEvent] = useState('None');
    const [longPress, setLongPress] = useState(false);

    const handleClick = () => {
        setClicks(clicks + 1);
        setLastEvent('Button Click');
        console.log('[Events] Button clicked, total:', clicks + 1);
    };

    const handleLongPress = () => {
        setLongPress(true);
        setLastEvent('Long Press');
        console.log('[Events] Long press detected');
        setTimeout(() => setLongPress(false), 800);
    };

    return (
        <div className="test-section">
            <h2>Event Handling Test</h2>
            <p>Tests: onClick events, event handlers, act/android integration</p>

            <div className="test-case">
                <h3>Click Count: {String(clicks)}</h3>
                <h3>Last Event: {lastEvent}</h3>
                <p>Long press state: {longPress ? 'Active' : 'Idle'}</p>

                <button onClick={handleClick} className="btn btn-primary">
                    Click Me!
                </button>

                <button
                    onClick={() => {
                        setClicks(0);
                        setLastEvent('Reset');
                        console.log('[Events] Reset clicked');
                    }}
                    className="btn btn-secondary"
                >
                    Reset
                </button>

                <button
                    onMouseDown={handleLongPress}
                    onTouchStart={handleLongPress}
                    className="btn"
                >
                    Long Press
                </button>
            </div>
        </div>
    );
}

// ===== Styling Test =====
function StylingTest() {
    return (
        <div className="test-section">
            <h2>Styling Test (themed-styler)</h2>
            <p>Tests: className prop, themed-styler integration, style application</p>

            <div className="test-case">
                <div className="container bg-primary">
                    <p className="text-white">Tailwind-style bg-primary class</p>
                </div>

                <div className="container bg-secondary">
                    <p className="text-white">Tailwind-style bg-secondary class</p>
                </div>

                <div className="container primary-bg">
                    <p className="text-lg">Large text with themed styles</p>
                </div>

                <div className="container secondary-bg">
                    <p className="text-sm">Small text with themed styles</p>
                </div>

                <button className="btn btn-primary">
                    Primary Button
                </button>

                <button className="btn btn-secondary">
                    Secondary Button
                </button>

                <div className="container tertiary-bg mt-2">
                    <p className="text-xs">Tertiary style sample</p>
                </div>
            </div>

            <p className="note">Check logcat for themed-styler style application logs</p>
        </div>
    );
}

// ===== Dynamic Import Test =====
function DynamicImportTest() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [debugLog, setDebugLog] = useState([]);
    const [autoRunDone, setAutoRunDone] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    const addLog = (msg) => {
        console.log('[DynamicImportTest] ' + msg);
        setDebugLog(prev => [...prev, `[${new Date().toISOString().substr(11, 12)}] ${msg}`]);
    };

    const loadData = () => {
        if (globalThis.__android_log) {
            __android_log('INFO', '[DynamicImportTest] loadData invoked, typeof __hook_import=' + (typeof __hook_import));
        }
        const hookImport = globalThis.__hook_import || __hook_import;
        addLog('STEP 1: Function called');
        setLoading(true);
        addLog('STEP 2: Loading set to true');

        try {
            addLog('STEP 3: Entering try block');
            addLog('STEP 4: typeof __hook_import = ' + (typeof hookImport));

            // Check if __hook_import exists
            if (typeof hookImport !== 'function') {
                addLog('STEP 5: __hook_import is not a function!');
                setError('__hook_import is not a function!');
                setLoading(false);
                return;
            }

            addLog('STEP 6: About to call __hook_import directly');

            // Call __hook_import directly to debug
            hookImport('./lazy-data.js', 'client.jsx')
                .then(function (module) {
                    addLog('STEP 7: Promise resolved!');
                    addLog('STEP 8: Module keys: ' + Object.keys(module).join(', '));
                    setData(module.testData || module.default);
                    setLoading(false);
                    setRetryCount(0);
                })
                .catch(function (err) {
                    addLog('STEP 9: Promise rejected: ' + err.message);
                    setError('Import failed: ' + err.message);
                    setLoading(false);
                    setRetryCount(c => c + 1);
                });

            addLog('STEP 10: __hook_import called, waiting for promise...');
        } catch (e) {
            addLog('STEP 11: Caught error: ' + e.message);
            setError('Error: ' + e.message);
            setLoading(false);
        }
    };

    // Auto-run on mount
    useEffect(() => {
        if (!autoRunDone) {
            console.log('[DynamicImportTest] Auto-running loadData on mount...');
            setAutoRunDone(true);
            setTimeout(loadData, 1000);
        }
    }, [autoRunDone]);

    return (
        <div className="test-section">
            <h2>Dynamic Import Test</h2>
            <p>Tests: import() syntax, async module loading, __hook_import bridge</p>

            <div className="test-case">
                <button onClick={loadData} className="btn" disabled={loading}>
                    {loading ? 'Loading...' : 'Load Data'}
                </button>

                {retryCount > 0 && (
                    <p className="note">Retries: {retryCount}</p>
                )}

                {error && <p className="error">Error: {error}</p>}

                {data && (
                    <div>
                        <h3>Loaded Data:</h3>
                        <pre>{JSON.stringify(data, null, 2)}</pre>
                    </div>
                )}

                <div className="debug-log">
                    <h4>Debug Log:</h4>
                    {debugLog.map((log, i) => <p key={i}>{log}</p>)}
                </div>
            </div>
        </div>
    );
}

// ===== Array Test =====
function ArrayTest() {
    const [items, setItems] = useState([
        { id: 1, name: 'Item 1', value: 100 },
        { id: 2, name: 'Item 2', value: 200 },
        { id: 3, name: 'Item 3', value: 300 }
    ]);

    const addItem = () => {
        const newId = items.length + 1;
        setItems([...items, {
            id: newId,
            name: `Item ${newId}`,
            value: newId * 100
        }]);
    };

    const removeItem = (id) => {
        setItems(items.filter(item => item.id !== id));
    };

    const shuffleItems = () => {
        setItems(prev => [...prev].sort(() => Math.random() - 0.5));
    };

    const resetItems = () => {
        setItems([
            { id: 1, name: 'Item 1', value: 100 },
            { id: 2, name: 'Item 2', value: 200 },
            { id: 3, name: 'Item 3', value: 300 }
        ]);
    };

    const totalValue = items.reduce((sum, item) => sum + item.value, 0);

    return (
        <div className="test-section">
            <h2>Array Mapping Test</h2>
            <p>Tests: .map() in JSX, array state updates, keys, filter operations</p>

            <div className="test-case">
                <button onClick={addItem} className="btn">
                    Add Item
                </button>

                <button onClick={shuffleItems} className="btn btn-secondary">
                    Shuffle
                </button>

                <button onClick={resetItems} className="btn btn-secondary">
                    Reset
                </button>

                <h3>Items ({String(items.length)}):</h3>
                <p>Total value: ${String(totalValue)}</p>

                {items.length === 0 && <p className="note">No items. Add one to begin.</p>}

                {items.map(item => (
                    <div key={item.id} className="list-item">
                        <span>{item.name}: ${String(item.value)}</span>
                        <button onClick={() => removeItem(item.id)} className="btn btn-small">
                            Remove
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ===== Template Literals Test =====
function TemplateLiteralsTest() {
    const [name, setName] = useState('User');
    const [count, setCount] = useState(5);
    const [lastMessage, setLastMessage] = useState('');

    const greeting = `Hello, ${name}!`;
    const message = `You have ${count} ${count === 1 ? 'item' : 'items'}.`;

    return (
        <div className="test-section">
            <h2>Template Literals Test</h2>
            <p>Tests: Template literal syntax, expression interpolation</p>

            <div className="test-case">
                <h3>{greeting}</h3>
                <p>{message}</p>
                {lastMessage && <p className="note">Last message: {lastMessage}</p>}

                <button onClick={() => setCount(count + 1)} className="btn">
                    Increment Count
                </button>

                <button onClick={() => setName(name === 'User' ? 'Developer' : 'User')} className="btn">
                    Toggle Name
                </button>

                <button
                    onClick={() => setLastMessage(`${greeting} ${message}`)}
                    className="btn btn-secondary"
                >
                    Capture message snapshot
                </button>
            </div>
        </div>
    );
}

// ===== Main Test Client =====
export default function TestClient() {
    const [activeTest, setActiveTest] = useState('useState');

    // Get versions from native bridge
    const versions = typeof globalThis.__versions !== 'undefined' ? globalThis.__versions : {
        hookTranspiler: '?.?.?',
        jscbridge: '?.?.?',
        themedStyler: '?.?.?'
    };

    const tests = [
        { id: 'useState', name: 'useState', component: UseStateTest },
        { id: 'useEffect', name: 'useEffect', component: UseEffectTest },
        { id: 'events', name: 'Events', component: EventsTest },
        { id: 'styling', name: 'Styling', component: StylingTest },
        { id: 'import', name: 'Dynamic Import', component: DynamicImportTest },
        { id: 'array', name: 'Arrays', component: ArrayTest },
        { id: 'templates', name: 'Templates', component: TemplateLiteralsTest }
    ];

    // Auto-switch to Dynamic Import test after 2 seconds
    useEffect(() => {
        console.log('[TestClient] Auto-switching to Dynamic Import test in 2s...');
        const timer = setTimeout(() => {
            console.log('[TestClient] Switching to import test now');
            setActiveTest('import');
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    const ActiveComponent = tests.find(t => t.id === activeTest)?.component || UseStateTest;

    return (
        <div className="client-container">
            <div className="bg-primary" style={{ padding: '16px', marginBottom: '8px' }}>
                <span className="text-white">BG-PRIMARY TEST (should be #2563eb blue)</span>
            </div>
            <div className="bg-secondary" style={{ padding: '16px', marginBottom: '8px' }}>
                <span className="text-white">BG-SECONDARY TEST (should be #10b981 green)</span>
            </div>
            <h1 className="app-title">Hook Transpiler Test Suite</h1>
            <p className="app-subtitle">Android JNI/JNA • Act Renderer • themed-styler</p>
            <p className="text-xs" style={{ marginTop: '-8px', marginBottom: '8px', opacity: 0.7 }}>
                hook-transpiler v{versions.hookTranspiler} • jscbridge v{versions.jscbridge} • themed-styler v{versions.themedStyler}
            </p>

            <div className="test-nav flex flex-wrap gap-2 items-center overflow-x-auto pb-2">
                {tests.map(test => (
                    <button
                        key={test.id}
                        onClick={() => {
                            console.log('[TestClient] Switching to test:', test.id);
                            setActiveTest(test.id);
                        }}
                        className={activeTest === test.id ? 'nav-btn active' : 'nav-btn'}
                    >
                        {test.name}
                    </button>
                ))}
            </div>

            <div className="test-content border border-gray-300 rounded-lg p-4 mt-4 shadow-sm bg-white/70">
                <ActiveComponent />
            </div>
        </div>
    );
}
