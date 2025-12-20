export default function Home() {
    console.log('[Home] Component rendering');

    const versions = globalThis.__versions || {};
    const appVersion = globalThis.__appVersion || '1.0.0';

    const [peers, setPeers] = React.useState([]);
    const [newPeerInput, setNewPeerInput] = React.useState('');
    const [probingPeers, setProbingPeers] = React.useState(new Set());

    React.useEffect(() => {
        console.log('[Home] Loading initial peers');
        const defaultPeers = [
            'https://node-dfw1.relaynet.online',
            'https://node-dfw2.relaynet.online',
            'localhost:8080'
        ];

        const initialPeers = defaultPeers.map(host => ({ host, probes: [], isProbing: false }));
        setPeers(initialPeers);
        initialPeers.forEach(peer => probePeer(peer.host));
    }, []);

    const probePeer = async (host) => {
        console.log('[Home] Probing:', host);
        setProbingPeers(prev => new Set(prev).add(host));

        try {
            const startTime = Date.now();
            const normalizedHost = host.startsWith('http') ? host : 'http://' + host;
            const response = await fetch(normalizedHost + '/api/info').catch(() => null);
            const latency = Date.now() - startTime;
            const probeResult = { ok: response && response.ok, latencyMs: latency };
            setPeers(prevPeers => prevPeers.map(p => p.host === host ? Object.assign({}, p, { probes: [probeResult], isProbing: false }) : p));
        } catch (e) {
            console.error('[Home] Probe error:', e);
            setPeers(prevPeers => prevPeers.map(p => p.host === host ? Object.assign({}, p, { probes: [{ ok: false }], isProbing: false }) : p));
        } finally {
            setProbingPeers(prev => { const next = new Set(prev); next.delete(host); return next; });
        }
    };

    const handleAddPeer = () => {
        const trimmed = newPeerInput.trim();
        if (!trimmed || peers.some(p => p.host === trimmed)) {
            setNewPeerInput('');
            return;
        }
        const newPeer = { host: trimmed, probes: [], isProbing: false };
        setPeers(prev => [...prev, newPeer]);
        setNewPeerInput('');
        probePeer(trimmed);
    };

    const handleRemovePeer = (host) => {
        setPeers(prev => prev.filter(p => p.host !== host));
    };

    const handleOpenPeer = (host) => {
        console.log('[Home] Opening peer:', host);
    };

    const renderStatus = (peer) => {
        const isProbing = peer.isProbing || probingPeers.has(peer.host);
        if (isProbing) return <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-600" width="wrap_content" height="wrap_content">Probing...</span>;
        if (!peer.probes || peer.probes.length === 0) return <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600" width="wrap_content" height="wrap_content">Not probed</span>;
        const okProbes = peer.probes.filter(p => p.ok);
        if (okProbes.length === 0) return <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-600 font-semibold" width="wrap_content" height="wrap_content">Offline</span>;
        const latency = okProbes[0].latencyMs;
        return <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 font-semibold" width="wrap_content" height="wrap_content">Online{latency ? ' (' + Math.round(latency) + 'ms)' : ''}</span>;
    };

    return (
        <div className="flex-1 bg-gray-50 w-full h-full" width="match_parent" height="match_parent">
            <div className="p-4 bg-white border-b w-full" width="match_parent" height="wrap_content">
                <div className="flex-row items-center mb-3" width="match_parent" height="wrap_content">
                    <span className="text-2xl mr-2" width="wrap_content" height="wrap_content">⚡</span>
                    <span className="text-xl font-bold" width="wrap_content" height="wrap_content">Relay</span>
                </div>
                <div className="flex-row w-full" width="match_parent" height="wrap_content">
                    <input type="text" placeholder="https://example.com" value={newPeerInput} onChange={(e) => setNewPeerInput(e.target.value)} className="flex-1 px-3 py-2 border rounded mr-2" width="0dp" height="wrap_content" />
                    <button onClick={handleAddPeer} className="px-3 py-2 bg-green-500 text-white rounded text-sm font-semibold" width="wrap_content" height="wrap_content">Add</button>
                </div>
            </div>
            <div className="flex-1 p-2 w-full" width="match_parent" height="0dp">
                {peers.length === 0 ? (
                    <div className="bg-white p-8 rounded text-center" width="match_parent" height="wrap_content">
                        <span className="text-gray-600" width="wrap_content" height="wrap_content">No peers configured. Add one using the form above.</span>
                    </div>
                ) : (
                    peers.map(peer => (
                        <div key={peer.host} className="bg-white p-4 rounded border mb-2 w-full" width="match_parent" height="wrap_content">
                            <div className="flex-row items-center justify-between mb-2 w-full" width="match_parent" height="wrap_content">
                                <span className="font-semibold text-base flex-1" width="0dp" height="wrap_content">{peer.host}</span>
                                <div className="flex-row items-center" width="wrap_content" height="wrap_content">
                                    {renderStatus(peer)}
                                    <button onClick={() => handleRemovePeer(peer.host)} className="ml-2 px-2 py-1 bg-red-500 text-white rounded text-xs font-semibold" width="wrap_content" height="wrap_content">✕</button>
                                </div>
                            </div>
                            <button onClick={() => handleOpenPeer(peer.host)} className="w-full px-2 py-2 mt-2 bg-blue-500 text-white rounded font-semibold text-sm" width="match_parent" height="wrap_content">Open →</button>
                        </div>
                    ))
                )}
            </div>
            <div className="absolute bottom-0 right-0 p-2 bg-gray-800 bg-opacity-75 rounded-tl" width="wrap_content" height="wrap_content">
                <span className="text-white text-xs" width="wrap_content" height="wrap_content">v{appVersion}</span>
            </div>
        </div>
    );
}
