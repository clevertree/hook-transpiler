import React, { useState, useEffect } from 'react';

export default function UseEffectTest() {
    const [count, setCount] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => {
        setLogs(prev => [msg, ...prev].slice(0, 5));
    };

    useEffect(() => {
        console.log('[useEffect] Component mounted');
        setMounted(true);
        addLog('Component mounted');

        return () => {
            console.log('[useEffect] Cleanup called');
        };
    }, []);

    useEffect(() => {
        if (mounted) {
            console.log('[useEffect] Count changed to:', count);
            addLog(`Count changed to: ${count}`);
        }
    }, [count]);

    return (
        <div className="p-2">
            <h2 className="text-lg font-bold mb-2 text-themed">useEffect Hook</h2>
            <p className="text-sm text-muted mb-4">Tests: Mount, dependencies, cleanup</p>

            <div className="space-y-4">
                <div className="flex flex-row items-center justify-between bg-surface p-3 rounded border-themed">
                    <span className="text-sm font-medium text-themed">Mount Status</span>
                    <span className="bg-primary text-white text-xs px-2 py-1 rounded-full font-bold">
                        {mounted ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                </div>

                <div className="bg-surface p-4 rounded-lg border-themed">
                    <div className="flex flex-row items-center justify-between mb-4">
                        <span className="text-sm text-muted">Trigger Dependency</span>
                        <button
                            onClick={() => setCount(count + 1)}
                            className="bg-primary text-white px-4 py-1 rounded shadow-sm text-sm"
                        >
                            Count: {count}
                        </button>
                    </div>

                    <h3 className="text-xs font-bold text-muted uppercase mb-2">Effect Logs (Last 5)</h3>
                    <div className="bg-bg border-themed rounded p-2 space-y-1">
                        {logs.length === 0 && <p className="text-xs text-muted italic">No logs yet</p>}
                        {logs.map((log, i) => (
                            <div key={i} className="text-xs text-themed font-mono border-b border-themed last:border-0 pb-1">
                                > {log}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
