import React, { useState, useEffect } from 'react';

export default function DynamicImportTest() {
    console.log('[DynamicImport] Component rendering');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('[DynamicImport] Starting import of lazy-data.js');
            const module = await import('../lazy-data.js');
            console.log('[DynamicImport] Module loaded:', module);
            setData(module.testData || module.default);
            setLoading(false);
        } catch (e) {
            console.error('[DynamicImport] Failed to load:', e.message);
            setError(e.message);
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log('[DynamicImport] useEffect firing');
        setTimeout(() => {
            console.log('[DynamicImport] setTimeout firing');
            loadData();
        }, 100);
    }, []);

    if (!data && !loading && !error) {
        console.log('[DynamicImport] Auto-triggering loadData during render');
        loadData();
    }

    return (
        <div className="p-2">
            <h2 className="text-lg font-bold mb-2 text-themed">Lazy Loading</h2>
            <p className="text-sm text-muted mb-4">Tests: import() syntax, __hook_import bridge</p>

            <div className="space-y-4">
                <button
                    onClick={loadData}
                    className="bg-primary text-white px-4 py-2 rounded-md shadow-sm w-full"
                    disabled={loading}
                >
                    {loading ? 'Loading Module...' : 'Reload Module'}
                </button>

                {error && (
                    <div className="p-3 bg-surface border border-danger rounded text-danger text-sm">
                        Error: {error}
                    </div>
                )}

                {data ? (
                    <div className="p-4 bg-surface rounded-lg border-themed">
                        <h3 className="text-sm font-bold text-themed mb-2">Module Data:</h3>
                        <pre className="text-xs bg-bg p-2 border-themed rounded overflow-x-auto text-themed">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </div>
                ) : (
                    !loading && (
                        <div className="p-8 text-center text-muted italic text-sm">
                            No data loaded yet
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
