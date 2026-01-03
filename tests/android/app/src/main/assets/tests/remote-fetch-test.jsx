import React, { useState, useEffect } from 'react';

export default function RemoteFetchTest() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        console.log('[FetchTest] Starting fetch...');
        setLoading(true);
        setError(null);
        try {
            // Using a reliable public API
            const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
            console.log('[FetchTest] Response status:', response.status);
            const json = await response.json();
            console.log('[FetchTest] Data received:', JSON.stringify(json));
            setData(json);
        } catch (e) {
            console.error('[FetchTest] Error:', e.message);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="p-4 bg-surface rounded-xl border-themed shadow-sm">
            <h2 className="text-lg font-bold mb-2 text-themed">Remote Fetch</h2>
            <p className="text-sm text-muted mb-4">Tests: global fetch(), async/await, JSON parsing</p>

            <button
                onClick={fetchData}
                className="bg-primary text-white px-4 py-2 rounded-md shadow-sm w-full mb-4 font-medium"
                disabled={loading}
            >
                {loading ? 'Fetching...' : 'Refetch Data'}
            </button>

            {error && (
                <div className="bg-bg border border-danger text-danger px-4 py-3 rounded mb-4 text-sm">
                    Error: {error}
                </div>
            )}

            {data && (
                <div className="bg-bg p-4 rounded-lg border-themed">
                    <h3 className="font-bold mb-2 text-themed text-sm">Response:</h3>
                    <pre className="text-xs p-2 border-themed rounded overflow-x-auto text-themed">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
