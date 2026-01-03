import React, { useState, useEffect, useMemo } from 'react';

// Advanced test fixture used by large_file_test
// Contains hooks, dynamic import, and object spread to exercise the transpiler
export default function AdvancedTest() {
    const [count, setCount] = useState(0);
    const [loaded, setLoaded] = useState(null);
    const [items, setItems] = useState(() => [1, 2, 3]);

    // Derived memoized value
    const summary = useMemo(() => {
        const base = { total: items.length, count };
        return { ...base, label: `Count is ${count}` };
    }, [items, count]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const mod = await import('./lazy-data.js');
                if (!cancelled) {
                    setLoaded(mod.testData || mod.default || null);
                }
            } catch (e) {
                console.error('[AdvancedTest] failed to import lazy-data:', e?.message || e);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const addItem = () => {
        const nextId = items.length + 1;
        setItems([...items, nextId]);
    };

    return (
        <div className="advanced-test">
            <h1>Advanced Test</h1>
            <p>Count: {count}</p>
            <button onClick={() => setCount(count + 1)}>Increment</button>
            <button onClick={addItem}>Add Item</button>
            <pre>{JSON.stringify(summary)}</pre>
            <div>
                <h3>Items</h3>
                {items.map((n) => (
                    <span key={n}>{n}</span>
                ))}
            </div>
            <div>
                <h3>Lazy Data</h3>
                <pre>{loaded ? JSON.stringify(loaded, null, 2) : 'Loading...'}</pre>
            </div>
        </div>
    );
}
